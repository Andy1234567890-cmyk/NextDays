"""Der Airbnb-Bestand wird je Tick EINMAL geholt, im nötigen Zeitraum.

Diese Tests halten die Ersparnis vom 12.08.2026 fest. Der Befund war im
Worker-Log direkt zu lesen — viermal pro Tick dieselbe Zeile:

    {"von": "2020-01-01", "bis": "2028-12-31", "etappen": 36,
     "buchungen": 462, "vollstaendig": true}
    {"geprueft": 22, "gesetzt": 0, "tenants": 1}

`sync_bookings_feed` brauchte dafür ⌀78 s (Spitze 129 s) und meldete „nichts zu
tun", weil der Feed leer war. Jeder Test hier ist eine UMKEHRPROBE: er schlägt
an, wenn die alte Verschwendung zurückkommt.
"""

from __future__ import annotations

import time
from datetime import UTC, date, datetime, timedelta
from unittest.mock import patch

from src.features.channel_manager import airbnb_bestand_cache as cache
from src.features.channel_manager.airbnb_bestand_zeitraum import bestandszeitraum
from src.features.channel_manager.airbnb_historie import etappen_planen


class _Bestand:
    """Ein Zähler, der sich merkt, wie oft wirklich abgerufen wurde."""

    def __init__(self) -> None:
        self.abrufe: list[str] = []

    def __call__(self, token: str) -> str:
        self.abrufe.append(token)
        return f"bestand-{token}"


def test_ein_tick_ruft_je_konto_nur_einmal_ab() -> None:
    """Vier Schritte, ein Abruf — genau die Einsparung, um die es geht."""
    leser = _Bestand()
    with cache.fuer_tick():
        ergebnisse = [cache.bestand("tokenA", leser) for _ in range(4)]
    assert ergebnisse == ["bestand-tokenA"] * 4
    assert len(leser.abrufe) == 1, (
        "Vier Nachpflege-Schritte dürfen den Bestand nur EINMAL holen — "
        "genau das kostete vorher 78 s je Feed-Lauf."
    )


def test_zwei_konten_werden_getrennt_gehalten() -> None:
    """Mit dem Token von Konto A findet man die Buchungen von B nicht (0304)."""
    leser = _Bestand()
    with cache.fuer_tick():
        a = cache.bestand("tokenA", leser)
        b = cache.bestand("tokenB", leser)
        cache.bestand("tokenA", leser)
    assert a != b
    assert leser.abrufe == ["tokenA", "tokenB"]


def test_neuer_tick_holt_frisch() -> None:
    """Der Cache darf einen Tick NICHT überleben.

    Sonst würde eine Buchung, die zwischen zwei Ticks hereinkommt, nie gefunden
    — die Nachpflege heilte sie erst, wenn der Prozess neu startet.
    """
    leser = _Bestand()
    with cache.fuer_tick():
        cache.bestand("tokenA", leser)
    with cache.fuer_tick():
        cache.bestand("tokenA", leser)
    assert len(leser.abrufe) == 2


def test_ohne_tick_kein_cache() -> None:
    """Der Handpfad („Historie abrufen") bekommt immer den echten Stand."""
    leser = _Bestand()
    cache.bestand("tokenA", leser)
    cache.bestand("tokenA", leser)
    assert len(leser.abrufe) == 2


def test_verschachtelte_klammer_wirft_den_cache_nicht_weg() -> None:
    """Die innere Klammer darf den gemeinsamen Cache nicht schliessen."""
    leser = _Bestand()
    with cache.fuer_tick():
        cache.bestand("tokenA", leser)
        with cache.fuer_tick():
            cache.bestand("tokenA", leser)
        cache.bestand("tokenA", leser)
    assert len(leser.abrufe) == 1


def test_cache_ist_nach_einer_ausnahme_geschlossen() -> None:
    """Ein Fehler im Tick darf keinen Bestand für den nächsten hinterlassen."""
    leser = _Bestand()
    try:
        with cache.fuer_tick():
            cache.bestand("tokenA", leser)
            raise RuntimeError("Abbruch mitten im Tick")
    except RuntimeError:
        pass
    with cache.fuer_tick():
        cache.bestand("tokenA", leser)
    assert len(leser.abrufe) == 2


# ---------------------------------------------------------------- Zeitraum


class _FakeTabelle:
    """Nur so viel PostgREST, wie `bestandszeitraum` benutzt."""

    def __init__(self, zeilen: list[dict[str, object]], spalte: str) -> None:
        self._zeilen = zeilen
        self._spalte = spalte
        self._desc = False

    def select(self, spalte: str) -> _FakeTabelle:
        self._spalte = spalte
        return self

    def eq(self, *_: object) -> _FakeTabelle:
        return self

    def order(self, _spalte: str, *, desc: bool = False) -> _FakeTabelle:
        self._desc = desc
        return self

    def limit(self, _n: int) -> _FakeTabelle:
        return self

    @property
    def not_(self) -> _FakeTabelle:
        return self

    def is_(self, *_: object) -> _FakeTabelle:
        return self

    def execute(self) -> _FakeTabelle:
        werte = [z for z in self._zeilen if z.get(self._spalte)]
        werte.sort(key=lambda z: str(z[self._spalte]), reverse=self._desc)
        self.data = werte[:1]  # noqa: B010 — Attribut wie beim echten Client
        return self


class _FakeDb:
    def __init__(self, zeilen: list[dict[str, object]]) -> None:
        self._zeilen = zeilen

    def table(self, _name: str) -> _FakeTabelle:
        return _FakeTabelle(list(self._zeilen), "check_in")


def test_zeitraum_deckt_den_bestand_mit_polster() -> None:
    """Der Zeitraum umschliesst die echten Daten, statt 8 Jahre zu raten."""
    db = _FakeDb([{"check_in": "2024-03-17", "check_out": "2027-07-15"}])
    zeitraum = bestandszeitraum(db)  # type: ignore[arg-type]
    assert zeitraum is not None
    von, bis = zeitraum
    assert von <= date(2024, 3, 17), "der älteste Aufenthalt muss drin liegen"
    assert bis >= date(2027, 7, 15), "der jüngste Aufenthalt muss drin liegen"


def test_zeitraum_ist_kuerzer_als_der_alte_festwert() -> None:
    """Die Umkehrprobe zur Verschwendung: weniger Etappen bei gleicher Deckung.

    Der alte Festwert war `heute.year - 6` bis `heute.year + 2`. Beim Beta-Betrieb
    (Bestand ab 2024) waren davon vier Jahre garantiert leer.
    """
    db = _FakeDb([{"check_in": "2024-03-17", "check_out": "2027-07-15"}])
    zeitraum = bestandszeitraum(db)  # type: ignore[arg-type]
    assert zeitraum is not None
    heute = date.today()
    alt = etappen_planen(date(heute.year - 6, 1, 1), date(heute.year + 2, 12, 31))
    neu = etappen_planen(*zeitraum)
    assert len(neu) < len(alt), (
        f"Der abgeleitete Zeitraum ({len(neu)} Etappen) muss kürzer sein als der "
        f"alte Festwert ({len(alt)} Etappen)."
    )


def test_ohne_bestand_kein_abruf() -> None:
    """Kein Airbnb-Bestand → nichts zu heilen → kein Abruf (statt 36 Etappen)."""
    assert bestandszeitraum(_FakeDb([])) is None  # type: ignore[arg-type]


def test_heute_liegt_immer_im_zeitraum() -> None:
    """Ein reiner Vergangenheitsbestand darf neue Buchungen nicht ausschliessen."""
    db = _FakeDb([{"check_in": "2020-01-05", "check_out": "2020-02-01"}])
    zeitraum = bestandszeitraum(db)  # type: ignore[arg-type]
    assert zeitraum is not None
    von, bis = zeitraum
    heute = date.today()
    assert von <= heute <= bis


def test_ausreisser_jahr_kappt_den_zeitraum() -> None:
    """Ein Tippfehler im Jahr darf keine 70 Jahre Etappen planen (Wurzel 8)."""
    db = _FakeDb([{"check_in": "2024-03-17", "check_out": "2095-01-01"}])
    zeitraum = bestandszeitraum(db)  # type: ignore[arg-type]
    assert zeitraum is not None
    von, bis = zeitraum
    assert bis.year - von.year <= 12


def test_unsinniges_datum_gilt_nicht_als_grenze() -> None:
    """Ein Datum ausserhalb jeder Plausibilität ist ein Datenfehler."""
    db = _FakeDb([{"check_in": "0001-01-01", "check_out": "1899-12-31"}])
    assert bestandszeitraum(db) is None  # type: ignore[arg-type]


def test_die_vier_schritte_teilen_sich_wirklich_einen_abruf() -> None:
    """Die Klammer in `feed_nachpflege.ausfuehren` MUSS gesetzt sein.

    Die anderen Tests prüfen den Cache für sich; dieser prüft, dass der Feed ihn
    auch benutzt. Ohne ihn blieb die Umkehrprobe grün, obwohl die Klammer entfernt
    war — der teure Zustand wäre unbemerkt zurückgekommen.

    Jeder der vier Schritte fragt hier den Bestand so ab, wie der echte Dienst es
    tut. Gezählt wird, wie oft wirklich geladen wurde.
    """
    from src.jobs import feed_nachpflege

    leser = _Bestand()

    class _Dienst:
        """Vier Schritte, die alle denselben Bestand brauchen."""

        @staticmethod
        def _holen() -> dict[str, int]:
            cache.bestand("tokenA", leser)
            return {"gesetzt": 0}

        buchungszeitpunkte_heilen = _holen
        profilbilder_heilen = _holen
        anreisezeiten_heilen = _holen
        lesestaende_aktualisieren = _holen

    feed_nachpflege.ausfuehren(_Dienst())  # type: ignore[arg-type]
    assert len(leser.abrufe) == 1, (
        "Die vier Nachpflege-Schritte müssen sich EINEN Bestandsabruf teilen. "
        f"Hier waren es {len(leser.abrufe)} — fehlt `airbnb_bestand_cache."
        "fuer_tick()` in `feed_nachpflege.ausfuehren`?"
    )


def test_abgebrochene_verbindung_wird_einmal_wiederholt() -> None:
    """Ein Verbindungsabbruch darf keine Etappe kosten (live: 431 statt 462).

    Airbnb legt sporadisch mitten in der Antwort auf. Ohne Wiederholung fiel die
    ganze Etappe weg, `vollstaendig` wurde false, und die Zeilen darin heilten
    nie — der Fehler hielt sich selbst am Leben.
    """
    import httpx

    from src.features.channel_manager.airbnb_historie import AirbnbHistorieMixin

    class _Antwort:
        status_code = 200

        @staticmethod
        def json() -> dict[str, object]:
            return {"reservations": [{"confirmation_code": "ABC"}], "paging": {}}

    versuche: list[int] = []

    class _Client:
        def __init__(self, **_: object) -> None:
            pass

        def __enter__(self) -> _Client:
            return self

        def __exit__(self, *_: object) -> None:
            return None

        def get(self, *_: object, **__: object) -> _Antwort:
            versuche.append(1)
            if len(versuche) == 1:
                raise httpx.RemoteProtocolError("Server disconnected")
            return _Antwort()

    echt_client, echt_sleep = httpx.Client, time.sleep
    httpx.Client = _Client  # type: ignore[misc,assignment]
    time.sleep = lambda _s: None  # type: ignore[assignment]
    try:
        seite, _ = AirbnbHistorieMixin._reservierungen_seite(  # noqa: SLF001
            "token", "2026-01-01", None
        )
    finally:
        httpx.Client = echt_client  # type: ignore[misc]
        time.sleep = echt_sleep  # type: ignore[assignment]

    assert len(versuche) == 2, "der Abbruch muss genau einmal wiederholt werden"
    assert seite == [{"confirmation_code": "ABC"}], "der zweite Versuch zählt"


def test_fehlerantwort_wird_nicht_wiederholt() -> None:
    """Ein 429 zu wiederholen verdoppelt die Last und führt in die Sperre."""
    import httpx

    from src.features.channel_manager.airbnb_historie import AirbnbHistorieMixin
    from src.features.channel_manager.common import ChannelManagerError

    aufrufe: list[int] = []

    class _Antwort:
        status_code = 429

        @staticmethod
        def json() -> dict[str, object]:
            return {}

    class _Client:
        def __init__(self, **_: object) -> None:
            pass

        def __enter__(self) -> _Client:
            return self

        def __exit__(self, *_: object) -> None:
            return None

        def get(self, *_: object, **__: object) -> _Antwort:
            aufrufe.append(1)
            return _Antwort()

    echt = httpx.Client
    httpx.Client = _Client  # type: ignore[misc,assignment]
    try:
        try:
            AirbnbHistorieMixin._reservierungen_seite(  # noqa: SLF001
                "token", "2026-01-01", None
            )
            raise AssertionError("ein 429 muss als Fehler durchkommen")
        except ChannelManagerError:
            pass
    finally:
        httpx.Client = echt  # type: ignore[misc]

    assert len(aufrufe) == 1, "eine Fehlerantwort darf NICHT wiederholt werden"


def _treffer_ueber_einen_tag(zeile: dict[str, str], heute: date) -> int:
    """In wie vielen der 288 Tagesticks dieser Thread dran wäre.

    Eine Funktion statt einer Klasse in der Schleife: `fest` würde als
    Closure-Variable erst beim Aufruf gelesen (ruff B023) — hier harmlos, aber
    genau der Fehler, den die Regel verhindern soll.
    """
    import src.features.channel_manager.airbnb_lesestand as modul

    gezaehlt = 0
    for tick in range(288):
        stunde, minute = divmod(tick * 5, 60)
        with patch.object(modul, "datetime", _uhr(heute, stunde, minute)):
            if modul._ist_diesmal_dran(heute, zeile):  # noqa: SLF001
                gezaehlt += 1
    return gezaehlt


def _uhr(tag: date, stunde: int, minute: int) -> type[datetime]:
    """Eine `datetime`-Klasse, deren `now()` einen festen Zeitpunkt liefert."""
    fest = datetime(tag.year, tag.month, tag.day, stunde, minute, tzinfo=UTC)

    class _Fest(datetime):
        @classmethod
        def now(cls, tz: object = None) -> datetime:  # noqa: ARG003
            return fest

    return _Fest


def test_laufender_aufenthalt_wird_immer_geprueft() -> None:
    """Wer JETZT da ist, wird in JEDEM Tick geprüft — ohne Ausnahme.

    Die Staffelung darf genau dort nicht sparen, wo die Korrespondenz stattfindet.
    Ein übersprungener Tick heisst hier: das Häkchen im Posteingang kommt bis zu
    sechs Stunden zu spät.
    """
    from src.features.channel_manager.airbnb_lesestand import _ist_diesmal_dran

    heute = date(2026, 8, 13)
    laufend = {
        "external_ref": "HMABC123",
        "check_in": "2026-08-10",
        "check_out": "2026-08-16",
    }
    assert _ist_diesmal_dran(heute, laufend)


def test_fehlende_daten_werden_nie_uebersprungen() -> None:
    """Ohne Datumsangabe gilt „ganz nah" — nie „nie" (Wurzel 4)."""
    from src.features.channel_manager.airbnb_lesestand import _ist_diesmal_dran

    heute = date(2026, 8, 13)
    assert _ist_diesmal_dran(heute, {"external_ref": "HMX", "check_in": None,
                                     "check_out": None})
    assert _ist_diesmal_dran(heute, {"external_ref": "HMY"})


def test_ferner_aufenthalt_wird_seltener_geprueft_aber_nie_nie() -> None:
    """Ein ferner Thread läuft seltener — muss aber im Tagesverlauf drankommen.

    „Seltener" und „nie" liegen einen Tippfehler auseinander; nur dieser Test
    unterscheidet sie. Geprüft wird über alle 288 Ticks eines Tages.
    """
    heute = date(2026, 8, 13)
    treffer = _treffer_ueber_einen_tag(
        {
            "external_ref": "HMFERN99",
            "check_in": "2026-10-20",
            "check_out": "2026-10-27",
        },
        heute,
    )
    assert treffer > 0, "ein ferner Thread darf nicht dauerhaft ausfallen"
    assert treffer < 288, "ein ferner Thread darf nicht in jedem Tick laufen"


def test_naeher_aufenthalt_laeuft_oefter_als_ferner() -> None:
    """Die Staffel muss monoton sein: näher ⇒ häufiger."""
    heute = date(2026, 8, 13)

    def treffer(check_in: str, check_out: str) -> int:
        return _treffer_ueber_einen_tag(
            {
                # gleicher Code ⇒ gleicher Versatz, damit nur die Nähe zählt
                "external_ref": "HMGLEICH",
                "check_in": check_in,
                "check_out": check_out,
            },
            heute,
        )

    nah = treffer("2026-08-17", "2026-08-20")  # in 4 Tagen
    mittel = treffer("2026-09-05", "2026-09-10")  # in ~3 Wochen
    fern = treffer("2026-10-25", "2026-10-30")  # in ~10 Wochen
    assert nah > mittel > fern, f"nicht monoton: {nah} / {mittel} / {fern}"


def test_lesestand_fenster_hat_beide_raender() -> None:
    """Das Thread-Fenster muss vorne UND hinten begrenzt sein.

    Ein Thread-Abruf kostet live 5,0 s. Ohne den vorderen Rand liefen die 8
    Threads des Folgejahres bei jedem Tick mit — 40 s für eine Auskunft, die sich
    monatelang nicht ändert.
    """
    from src.features.channel_manager.airbnb_lesestand import (
        _NACHLAUF_TAGE,
        _VORLAUF_TAGE,
    )

    heute = date.today()
    assert heute - timedelta(days=_NACHLAUF_TAGE) < heute
    assert heute + timedelta(days=_VORLAUF_TAGE) > heute
    assert _NACHLAUF_TAGE >= 14, (
        "Airbnbs Bewertungsfrist sind 14 Tage — kürzer abzuschneiden würde "
        "Nachkorrespondenz übersehen."
    )
    assert _VORLAUF_TAGE >= 60, (
        "Die Gastkorrespondenz beginnt Wochen vor der Anreise — ein zu enges "
        "Fenster übersieht einen echten Lesestand, und ein fehlendes Häkchen im "
        "Posteingang ist eine Falschaussage."
    )
