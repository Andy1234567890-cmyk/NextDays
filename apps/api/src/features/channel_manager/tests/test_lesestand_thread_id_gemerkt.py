"""Die Thread-ID wird gemerkt — der Bestandsabruf hört auf, ein Dauerlauf zu sein.

DER BEFUND (13.08.2026, live gemessen): `sync_bookings_feed` brauchte ⌀55 s, um
„nichts zu tun" zu melden. Der Feed selbst war in 146 ms fertig; die restliche
Zeit ging an EINEN Nachschlagevorgang im Lesestand-Tick:

    lesestaende_aktualisieren → _thread_ids_des_kontos → nachpflege_bestand
    → {"listing_id": "", "etappen": 24, "buchungen": 431}
    → {"geprueft": 4, "gesetzt": 0}

Alle fünf Minuten wurde der gesamte Airbnb-Bestand über 24 Etappen geholt, nur
um Bestätigungscode → Thread-ID abzubilden — eine Zuordnung, die sich nie
ändert, weil eine Buchung ihren Thread behält.

Jeder Test hier ist eine UMKEHRPROBE: er schlägt an, wenn der Abruf zurückkommt.
"""

from __future__ import annotations

from typing import Any

from src.features.channel_manager.airbnb_lesestand import AirbnbLesestandMixin


class _Query:
    """Nur die Kette, die der Lesestand-Pfad wirklich benutzt."""

    def __init__(self, db: _DB) -> None:
        self._db = db
        self._update: dict[str, Any] | None = None
        self._filter: dict[str, Any] = {}

    def update(self, payload: dict[str, Any]) -> _Query:
        """Wie PostgREST: sammelt die Nutzlast bis zum `execute()`."""
        self._update = payload
        return self

    def eq(self, spalte: str, wert: Any) -> _Query:
        """Filter sammeln — der Test prüft sie zusammen mit der Nutzlast."""
        self._filter[spalte] = wert
        return self

    def execute(self) -> Any:
        """Ein Update landet als eine Zeile in `db.updates`."""
        if self._update is not None:
            self._db.updates.append({**self._filter, **self._update})
        return type("R", (), {"data": []})()


class _DB:  # pylint: disable=too-few-public-methods
    """Fake-Client, der nur mitschreibt, was geschrieben würde."""

    def __init__(self) -> None:
        self.updates: list[dict[str, Any]] = []

    def table(self, _name: str) -> _Query:
        """Der Lesestand-Pfad fasst genau eine Tabelle an."""
        return _Query(self)


class _Dienst(AirbnbLesestandMixin):
    """Der Mixin mit gezählten Fremdzugriffen — kein Netz."""

    def __init__(self, bestand: dict[str, str] | None = None) -> None:
        self.bestand_abrufe = 0
        self.gelesene_threads: list[str] = []
        self._bestand = bestand or {}

    # --- was der Mixin von seinem Service erwartet ---
    def _airbnb_token_am_kanal(self, _channel_id: str) -> tuple[str, str]:
        return ("token-x", "konto-1")

    def _thread_ids_des_kontos(self, _db: Any, _token: str) -> dict[str, str]:
        # DER teure Weg: live 24 Etappen über 431 Buchungen.
        self.bestand_abrufe += 1
        return dict(self._bestand)

    def airbnb_lesestand_lesen(
        self, _token: str, thread_id: str
    ) -> tuple[str | None, str | None]:
        self.gelesene_threads.append(thread_id)
        # Unverändert gegenüber der Zeile → kein Schreibaufruf.
        return ("ref-1", "2026-08-13T10:00:00Z")


def _zeile(code: str, thread: str | None, ref: str = "ref-1") -> dict[str, Any]:
    return {
        "id": f"cb-{code}",
        "tenant_id": "t-1",
        "ota_reservation_code": code,
        "guest_read_message_ref": ref,
        "airbnb_thread_id": thread,
    }


def test_gemerkte_thread_id_spart_den_bestandsabruf() -> None:
    """DER KERN: Sind alle IDs bekannt, wird der Bestand NICHT geholt.

    Das ist die Einsparung von 55 s je Tick.
    """
    dienst = _Dienst()
    zeilen = [_zeile("HMAAA", "thread-1"), _zeile("HMBBB", "thread-2")]
    dienst._lesestaende_eines_kontos(_DB(), "t-1", zeilen, "kanal-1")  # noqa: SLF001  pylint: disable=protected-access
    assert dienst.bestand_abrufe == 0, (
        "Bei bekannten Thread-IDs darf der 24-Etappen-Bestandsabruf NICHT "
        "laufen — genau er kostete 55 s je Feed-Lauf."
    )
    assert sorted(dienst.gelesene_threads) == ["thread-1", "thread-2"]


def test_fehlende_id_holt_den_bestand_und_merkt_sie() -> None:
    """Fehlt eine ID, wird einmal geholt — und das Ergebnis festgehalten."""
    dienst = _Dienst(bestand={"HMBBB": "thread-2"})
    db = _DB()
    zeilen = [_zeile("HMAAA", "thread-1"), _zeile("HMBBB", None)]
    dienst._lesestaende_eines_kontos(db, "t-1", zeilen, "kanal-1")  # noqa: SLF001  pylint: disable=protected-access
    assert dienst.bestand_abrufe == 1
    # Gemerkt, damit der nächste Tick ihn nicht erneut auslöst.
    assert db.updates == [
        {"tenant_id": "t-1", "id": "cb-HMBBB", "airbnb_thread_id": "thread-2"}
    ]


def test_unauffindbare_buchung_wird_nicht_mit_platzhalter_geschlossen() -> None:
    """Kein Thread im Bestand → NULL bleibt NULL (Wurzel 4).

    Ein Platzhalter würde die Zeile als „erledigt" markieren, und ihr Lesestand
    käme nie wieder — schlimmer als ein weiterer Versuch.
    """
    dienst = _Dienst(bestand={})
    db = _DB()
    dienst._lesestaende_eines_kontos(  # noqa: SLF001  pylint: disable=protected-access
        db, "t-1", [_zeile("HMCCC", None)], "kanal-1"
    )
    assert dienst.bestand_abrufe == 1
    assert not db.updates


def test_bestand_wird_je_konto_nur_einmal_geholt() -> None:
    """Mehrere Lücken → EIN Abruf, nicht einer je Zeile."""
    dienst = _Dienst(bestand={"HMAAA": "thread-1", "HMBBB": "thread-2"})
    db = _DB()
    zeilen = [_zeile("HMAAA", None), _zeile("HMBBB", None)]
    dienst._lesestaende_eines_kontos(db, "t-1", zeilen, "kanal-1")  # noqa: SLF001  pylint: disable=protected-access
    assert dienst.bestand_abrufe == 1
    assert len(db.updates) == 2


def test_ohne_token_passiert_nichts() -> None:
    """Kein Zugang am Kanal → kein Abruf, kein Fehler."""

    class _OhneToken(_Dienst):
        def _airbnb_token_am_kanal(self, _channel_id: str) -> None:
            return None

    dienst = _OhneToken()
    assert (
        dienst._lesestaende_eines_kontos(  # noqa: SLF001  pylint: disable=protected-access
            _DB(), "t-1", [_zeile("HMAAA", None)], "kanal-1"
        )
        == 0
    )
    assert dienst.bestand_abrufe == 0
