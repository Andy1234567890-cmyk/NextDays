"""`tausch_aus_row` — die EINE Umwandlung einer Tauschzeile (0544, §1.4).

Anlass (04.09.2026): die Umwandlung stand doppelt — einmal in `plan_zusatz`
für den Wochenplan, einmal als `PlanungService._tausch` für die
Tausch-Endpunkte. Beide bauten dieselbe Antwort, und genau das lief
auseinander: die Gegenschicht wurde geladen (`_tausch_schichten` holt BEIDE
Schicht-IDs), aber keine der Kopien stellte sie in die Antwort. Die Oberfläche
benennt den direkten Tausch mit der Zeit der Gegenschicht — der Platzhalter
blieb leer und der Browser zeigte statt des Textes den Schlüsselnamen.

Geprüft wird deshalb nicht „läuft durch", sondern:
  * die Gegenschicht landet MIT Zeiten in der Antwort,
  * eine Zeile ohne Gegenschicht bekommt `None` (kein leeres Gerüst),
  * eine Gegenschicht ohne Datum/Zeiten wird `None` statt halb gefüllt
    (Wurzel 4: keine erfundene Zeit),
  * der Wochenplan und die Endpunkte benutzen wirklich dieselbe Funktion.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from src.features.personal.plan_zusatz import tausch_aus_row

TAG = date(2026, 9, 11)


def _utc(h: int) -> str:
    return datetime(TAG.year, TAG.month, TAG.day, h, tzinfo=UTC).isoformat()


def _schicht(sid: str, von: int, bis: int, **ueber: object) -> dict:
    zeile = {
        "id": sid,
        "user_id": "u-1",
        "datum": TAG.isoformat(),
        "start_at": _utc(von),
        "end_at": _utc(bis),
        "arbeitsbereich_id": "ab-1",
        "property_id": "p-1",
        "status": "veroeffentlicht",
    }
    zeile.update(ueber)
    return zeile


def _zeile(**ueber: object) -> dict:
    zeile = {
        "id": "tw-1",
        "schicht_id": "s-1",
        "von_user_id": "u-1",
        "an_user_id": "u-2",
        "gegen_schicht_id": None,
        "status": "angefragt",
        "grund": None,
        "kommentar": None,
        "angenommen_am": None,
        "entschieden_von": None,
        "entschieden_am": None,
        "created_at": None,
    }
    zeile.update(ueber)
    return zeile


NAMEN = {"u-1": "Ida Iversen", "u-2": "Ole Olsen"}
TITEL = {"p-1": "Nordlicht"}


def test_gegenschicht_kommt_mit_zeiten_in_die_antwort() -> None:
    schichten = {
        "s-1": _schicht("s-1", 8, 16),
        "s-2": _schicht("s-2", 14, 22, user_id="u-2"),
    }
    t = tausch_aus_row(_zeile(gegen_schicht_id="s-2"), schichten, NAMEN, TITEL)

    assert t.gegen_schicht is not None
    assert t.gegen_schicht.datum == TAG
    assert t.gegen_schicht.start_at.hour == 14
    assert t.gegen_schicht.end_at.hour == 22
    assert t.gegen_schicht.property_title == "Nordlicht"
    # Der Bezug der angebotenen Schicht bleibt davon unberührt.
    assert t.schicht is not None
    assert t.schicht.start_at.hour == 8


def test_abgabe_ohne_gegenschicht_bleibt_none() -> None:
    """Abgabe (kein direkter Tausch): kein leeres Gerüst, sondern `None` —
    sonst zeigte die Oberfläche „Tausch gegen" ohne Zeit."""
    t = tausch_aus_row(_zeile(), {"s-1": _schicht("s-1", 8, 16)}, NAMEN, TITEL)

    assert t.gegen_schicht_id is None
    assert t.gegen_schicht is None
    assert t.schicht is not None


def test_gegenschicht_ohne_zeiten_wird_none_statt_halb() -> None:
    """Fehlt eine Zeit, ist die ganze Angabe `None`. Eine halbe Zeitangabe wäre
    eine erfundene (Wurzel 4)."""
    schichten = {
        "s-1": _schicht("s-1", 8, 16),
        "s-2": _schicht("s-2", 14, 22, end_at=None),
    }
    t = tausch_aus_row(_zeile(gegen_schicht_id="s-2"), schichten, NAMEN, TITEL)

    # Die ID bleibt (die Zeile existiert), nur der Anzeigebezug fehlt.
    assert t.gegen_schicht_id == "s-2"
    assert t.gegen_schicht is None


def test_unbekannte_gegenschicht_wird_none() -> None:
    """Die Schicht ist nicht im Fenster geladen — kein KeyError, kein Gerüst."""
    t = tausch_aus_row(
        _zeile(gegen_schicht_id="s-fremd"), {"s-1": _schicht("s-1", 8, 16)}, NAMEN, TITEL
    )

    assert t.gegen_schicht is None


def test_endpunkte_und_wochenplan_teilen_die_umwandlung() -> None:
    """`PlanungService` darf keine eigene Kopie mehr haben.

    Genau diese Kopie war der Fehler: sie kannte `gegen_schicht` nicht, obwohl
    die Modulfunktion es längst füllte. Ein `_tausch`-Attribut hier bedeutet,
    dass die zweite Wahrheit zurück ist.
    """
    from src.features.personal.planung import PlanungService

    assert not hasattr(PlanungService, "_tausch")
