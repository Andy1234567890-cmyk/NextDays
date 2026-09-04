"""Marktbeobachtung: Raster, Schwelle, Interpolation — und keine Fremdnamen.

Der wichtigste Test dieser Datei ist `test_quelle_gibt_nur_zahlen_heraus`: er
haelt fest, dass aus der Preisquelle ausschliesslich nackte Zahlen kommen. Wer
sie spaeter um Namen oder IDs erweitert, macht aus einem Preissignal eine
Wettbewerber-Datenbank im Produkt — das soll auffallen, bevor es ausgeliefert
wird, nicht danach.
"""
from __future__ import annotations

import inspect
from datetime import date

from src.features.pricing.market import quelle_airbnb
from src.features.pricing.market.beobachtung import (
    _MIN_OBJEKTE,
    Zelle,
    aggregieren,
    stichtage,
)
from src.features.pricing.market.umgebung import _zwischenwert


def test_zelle_buendelt_nachbarobjekte() -> None:
    """Zwei Objekte wenige km auseinander teilen sich eine Zelle — das ist der
    Grund fuer das Raster: ein Abruf statt zwei."""
    a = Zelle.fuer(57.7265, 10.5810)
    b = Zelle.fuer(57.7100, 10.6200)
    assert a == b


def test_zelle_trennt_ferne_orte() -> None:
    assert Zelle.fuer(57.72, 10.58) != Zelle.fuer(54.12, 12.10)


def test_aggregieren_unter_schwelle_gibt_nichts() -> None:
    """Ein Median aus vier Objekten ist faktisch ein fremder Einzelpreis."""
    assert aggregieren([100.0] * (_MIN_OBJEKTE - 1)) is None


def test_aggregieren_ab_schwelle_liefert_median() -> None:
    werte = aggregieren([100.0, 200.0, 300.0, 400.0, 500.0])
    assert werte is not None
    assert werte["median"] == 300.0
    assert werte["anzahl"] == 5.0


def test_aggregieren_wirft_unsinnige_werte_weg() -> None:
    werte = aggregieren([0.0, -5.0, 100.0, 200.0, 300.0, 400.0, 500.0])
    assert werte is not None
    assert werte["anzahl"] == 5.0


def test_stichtage_sind_nah_dicht_und_fern_grob() -> None:
    tage = stichtage(date(2026, 9, 4))
    assert len(tage) < 40, "ein Abruf je Tag waere weder zumutbar noch noetig"
    abstand_nah = (tage[1] - tage[0]).days
    abstand_fern = (tage[-1] - tage[-2]).days
    assert abstand_nah < abstand_fern


def test_interpolation_zwischen_stuetzstellen() -> None:
    punkte = [(date(2026, 1, 1), 100.0), (date(2026, 1, 11), 200.0)]
    assert _zwischenwert(punkte, date(2026, 1, 6)) == 150.0


def test_keine_extrapolation_ausserhalb() -> None:
    """Ein fortgeschriebener Marktpreis sieht aus wie ein gemessener."""
    punkte = [(date(2026, 1, 1), 100.0), (date(2026, 1, 11), 200.0)]
    assert _zwischenwert(punkte, date(2025, 12, 1)) is None


def test_quelle_gibt_nur_zahlen_heraus() -> None:
    """Die Preisquelle darf NUR Zahlen liefern — keine Namen, keine IDs.

    Steht hier eines Tages `list[dict]`, ist die Zusage gebrochen, dass keine
    fremden Objektnamen ins Produkt gelangen (Entscheidung vom 04.09.2026).
    """
    sig = inspect.signature(quelle_airbnb.preise_im_kasten)
    assert str(sig.return_annotation) in ("list[float]", "typing.List[float]")


def test_quelle_ohne_waehrung_liefert_nichts() -> None:
    """Ein Preis ohne Waehrung waere im Vergleich mit dem Basispreis Unsinn."""
    assert quelle_airbnb.preise_im_kasten(0, 0, 1, 1, date.today(), "") == []


def test_betrag_lehnt_fremde_waehrung_ab() -> None:
    eintrag = {"price": {"unit": {"amount": 900, "currency": "USD"}}}
    assert quelle_airbnb._betrag(eintrag, "DKK") is None


def test_betrag_nimmt_passende_waehrung() -> None:
    eintrag = {"price": {"unit": {"amount": 900, "currency": "DKK"}}}
    assert quelle_airbnb._betrag(eintrag, "DKK") == 900.0


def test_betrag_ohne_waehrungsangabe_wird_uebernommen() -> None:
    """Die Quelle liefert die angefragte Waehrung, meldet sie aber nicht immer
    im Feld. Gemessen am 04.09.2026: `currency` fehlte, `amount` stimmte."""
    eintrag = {"price": {"unit": {"amount": 900}}}
    assert quelle_airbnb._betrag(eintrag, "DKK") == 900.0


# --- Karte: jeder Preis ein Punkt, keine Schwelle (0558, 04.09.2026) ---------


def test_quelle_mit_ort_gibt_nur_preis_und_ort_heraus() -> None:
    """Auch die Ortsvariante traegt weder Namen noch IDs — nur (preis, lat, lng)."""
    sig = inspect.signature(quelle_airbnb.preise_mit_ort)
    assert str(sig.return_annotation) == "list[tuple[float, float, float]]"


class _Tabelle:
    """Minimaler PostgREST-Builder-Ersatz: merkt sich, was geschrieben wurde."""

    def __init__(self, protokoll: list[tuple[str, str, object]], name: str) -> None:
        self._protokoll = protokoll
        self._name = name

    def delete(self) -> _Tabelle:
        self._protokoll.append((self._name, "delete", None))
        return self

    def insert(self, zeilen: list[dict]) -> _Tabelle:
        self._protokoll.append((self._name, "insert", zeilen))
        return self

    def upsert(self, zeile: dict, **_kw: object) -> _Tabelle:
        self._protokoll.append((self._name, "upsert", zeile))
        return self

    def select(self, *_a: object, **_kw: object) -> _Tabelle:
        return self

    def eq(self, *_a: object) -> _Tabelle:
        return self

    def lt(self, *_a: object) -> _Tabelle:
        return self

    def execute(self) -> object:
        class _R:  # pylint: disable=too-few-public-methods
            data: list = []

        return _R()


class _Db:
    def __init__(self) -> None:
        self.protokoll: list[tuple[str, str, object]] = []

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self.protokoll, name)


def test_punkte_werden_auch_unter_der_medianschwelle_geschrieben() -> None:
    """Drei Angebote reichen fuer keinen Median (Nachbarpreis), aber fuer die
    Karte: sie zeigt, was verlangt wird, ohne Schwelle. Genau an diesen Tagen
    blieb sie vorher leer — der vom Nutzer abgelehnte Zustand."""
    from src.features.pricing.market.beobachtung_service import MarktBeobachtung

    db = _Db()
    dienst = MarktBeobachtung(db)  # type: ignore[arg-type]
    zelle = Zelle.fuer(57.55, 10.15)
    punkte = [(900.0, 57.5, 10.1), (1200.0, 57.6, 10.2), (700.0, 57.4, 10.3)]
    assert len(punkte) < _MIN_OBJEKTE
    geschrieben = dienst._punkte_schreiben(zelle, date(2026, 9, 11), "DKK", punkte)
    assert geschrieben == 3
    inserts = [p for p in db.protokoll if p[1] == "insert"]
    assert len(inserts) == 1 and inserts[0][0] == "markt_punkt"
    zeilen = inserts[0][2]
    assert isinstance(zeilen, list) and len(zeilen) == 3
    # Nur Ort und Preis — kein Feld, das ein Inserat benennt.
    assert set(zeilen[0]) <= {
        "zelle_lat", "zelle_lng", "tag", "objekt_art", "lat", "lng",
        "preis", "waehrung", "quelle", "abgerufen_am",
    }
    # Ort auf ~100 m gerundet (drei Nachkommastellen).
    assert all(round(z["lat"], 3) == z["lat"] for z in zeilen)


def test_punkte_schreiben_raeumt_den_tag_vorher_ab() -> None:
    """Wurzel 1/2: derselbe Stichtag zweimal am Tag darf keine Dubletten lassen."""
    from src.features.pricing.market.beobachtung_service import MarktBeobachtung

    db = _Db()
    dienst = MarktBeobachtung(db)  # type: ignore[arg-type]
    dienst._punkte_schreiben(
        Zelle.fuer(57.55, 10.15), date(2026, 9, 11), "DKK", [(900.0, 57.5, 10.1)]
    )
    arten = [art for tbl, art, _ in db.protokoll if tbl == "markt_punkt"]
    assert arten == ["delete", "insert"]


def test_verfall_raeumt_beide_tabellen() -> None:
    """Stichtage von gestern sind heute keine mehr — ohne Verfall waechst
    `markt_punkt` je Zelle um tausende Zeilen pro Tag, unerreichbar fuer jeden
    Leser."""
    from src.features.pricing.market.beobachtung_service import MarktBeobachtung

    db = _Db()
    MarktBeobachtung(db)._verfallenes_aufraeumen(date(2026, 9, 5))  # type: ignore[arg-type]
    geloescht = {tbl for tbl, art, _ in db.protokoll if art == "delete"}
    assert geloescht == {"markt_beobachtung", "markt_punkt"}


def test_naechste_deckelt_je_tag_und_behaelt_die_nahen() -> None:
    """Der Deckel gilt JE TAG; greift er, bleiben die dem Objekt naechsten
    Punkte — sie sind der relevantere Wettbewerb."""
    from src.features.pricing.ki_schemas import MarktAngebot
    from src.features.pricing.market.stand import _naechste

    nah = MarktAngebot(tag="2026-09-11", lat=57.56, lng=10.16, preis=1.0)
    fern = MarktAngebot(tag="2026-09-11", lat=57.20, lng=9.95, preis=2.0)
    mittel = MarktAngebot(tag="2026-09-11", lat=57.50, lng=10.10, preis=3.0)
    behalten = _naechste([fern, nah, mittel], 57.554, 10.150, 2)
    assert [a.preis for a in behalten] == [1.0, 3.0]
    assert _naechste([fern, nah], 57.554, 10.150, 5) == [fern, nah]


# --- Rand-Interpolation: Stuetzstellen mit Rand laden (04.09.2026) -------------


def test_provider_laedt_stuetzstellen_mit_rand() -> None:
    """Ein Tag am Rand des angefragten Zeitraums liegt zwischen einer Stuetze
    innerhalb und einer ausserhalb. Ohne Rand kam fuer heute+20 kein Signal,
    obwohl beide Nachbar-Stichtage im Raster standen (gemessen 04.09.2026)."""
    from datetime import timedelta

    from src.features.pricing.market.beobachtung import _FERN_SCHRITT
    from src.features.pricing.market.umgebung import UmgebungProvider

    gesehen: dict[str, date] = {}

    class _P(UmgebungProvider):
        def _standort(self):  # type: ignore[override]
            return (Zelle.fuer(57.55, 10.15), "DKK")

        def _stuetzstellen(self, zelle, waehrung, von, bis):  # type: ignore[override]
            gesehen["von"], gesehen["bis"] = von, bis
            return {von: 1000.0, bis: 1100.0}

    tage = [date(2026, 9, 24), date(2026, 10, 14)]
    sig = _P(None, "p1").market_signal(None, [], tage)  # type: ignore[arg-type]
    assert gesehen["von"] == tage[0] - timedelta(days=_FERN_SCHRITT)
    assert gesehen["bis"] == tage[-1] + timedelta(days=_FERN_SCHRITT)
    # Beide Randtage bekommen einen Wert — vorher blieb der erste neutral.
    assert set(sig) == {"2026-09-24", "2026-10-14"}


# --- KI-Berater: Marktregel und Regel-Kontext ---------------------------------


def _berater_mit(settings: dict, lage: dict | None):
    from src.features.pricing.ki_berater import DpKiBerater

    class _B(DpKiBerater):
        def _markt_lage(self, _pid, _settings, _heute):  # type: ignore[override]
            return lage

    return _B(None)


def test_berater_marktregel_aus_wird_benannt() -> None:
    """Regel aus → Pruefung 'aus', kein Vorschlag, kein stilles None."""
    from src.features.pricing.ki_berater import Pruefung

    erg = _berater_mit({}, None)._markt_pruefen("p1", {"market_enabled": False}, date(2026, 9, 5))
    assert isinstance(erg, Pruefung) and erg.ergebnis == "aus"


def test_berater_marktregel_an_ohne_signal_ist_zu_wenig_daten() -> None:
    """Regel an, aber kein Marktsignal — genau die Attrappe, die ein halbes
    Jahr unbemerkt blieb. Der Berater muss sie benennen."""
    from src.features.pricing.ki_berater import Pruefung

    erg = _berater_mit({}, None)._markt_pruefen(
        "p1", {"market_enabled": True}, date(2026, 9, 5)
    )
    assert isinstance(erg, Pruefung) and erg.ergebnis == "zu_wenig_daten"


def test_berater_marktregel_am_deckel_schlaegt_hoeheren_deckel_vor() -> None:
    """Greift der Deckel an jedem zweiten Tag, ist er die eigentliche Regel."""
    from src.features.pricing.ki_berater import Vorschlag

    lage = {
        "markt_median": 1080.0, "eigener_schnitt": 470.0, "abstand_pct": -56.5,
        "tage": 90.0, "tage_am_deckel": 60.0, "noetig_pct": 38.0,
    }
    erg = _berater_mit({}, lage)._markt_pruefen(
        "p1", {"market_enabled": True, "market_max_adjust_pct": 25.0}, date(2026, 9, 5)
    )
    assert isinstance(erg, Vorschlag)
    assert erg.feld == "market_max_adjust_pct"
    assert erg.wert_alt == 25.0 and erg.wert_neu == 40.0
    assert erg.belege["tage_am_deckel"] == 60


def test_berater_marktregel_wirkt_ohne_deckel_passt() -> None:
    from src.features.pricing.ki_berater import Pruefung

    lage = {
        "markt_median": 1080.0, "eigener_schnitt": 470.0, "abstand_pct": -56.5,
        "tage": 90.0, "tage_am_deckel": 3.0, "noetig_pct": 22.0,
    }
    erg = _berater_mit({}, lage)._markt_pruefen(
        "p1", {"market_enabled": True, "market_max_adjust_pct": 25.0}, date(2026, 9, 5)
    )
    assert isinstance(erg, Pruefung) and erg.ergebnis == "passt"
    assert erg.belege["markt_median"] == 1080.0


def test_regel_kontext_nennt_nur_eingeschaltete_regeln() -> None:
    """Gemini bekommt, was WIRKT — nicht die ganze Zeile."""
    from src.features.pricing.ki_berater import DpKiBerater

    k = DpKiBerater._regel_kontext(
        {
            "enabled": True, "market_enabled": True, "market_sensitivity": 20,
            "market_max_adjust_pct": 25, "weather_enabled": False,
            "occupancy_steps": [{"ab_pct": 60, "adjust_pct": 4}],
            "far_future": [], "rate_rules": [],
        }
    )
    assert k["marktregel"] == {"empfindlichkeit_pct": 20, "deckel_pct": 25}
    assert "wetterregel" not in k
    assert k["auslastungsstufen"] == [{"ab_pct": 60, "adjust_pct": 4}]
    assert "auslastungs_empfindlichkeit_pct" not in k
    assert "fruehbucher_aufschlag" not in k and "eigene_regeln" not in k


def test_preis_kurve_laedt_settings_zeile_nach() -> None:
    """Vorschau ohne geladene Zeile verlor market_key/comp_refs — der Berater
    haette eine andere Wirkung gezeigt als der spaetere Lauf."""
    from unittest.mock import MagicMock

    from src.features.pricing.engine import DpSettings
    from src.features.pricing.recompute import DynamicPricingRecompute

    rc = DynamicPricingRecompute(MagicMock())
    rc._load_settings = MagicMock(return_value=DpSettings())  # type: ignore[method-assign]
    rc._price_curve = MagicMock(return_value=[])  # type: ignore[method-assign]
    rc.preis_kurve("p1", 100.0, DpSettings(), date(2026, 9, 5), date(2026, 9, 5), date(2026, 9, 6))
    rc._load_settings.assert_called_once_with("p1")
