"""Jeder Pfad, der Reservierungen schreibt, pflegt die Gaeste-Aggregate mit.

WURZEL 1 (Gegenzustand): `guests.stays_count`, `.total_revenue` und
`.last_stay_at` sind ABGELEITETE Werte. Keine DB-Regel pflegt sie — nur der
Aufruf von `recompute_guest_aggregates`. Wer Reservierungen schreibt, ohne ihn
zu rufen, hinterlaesst eine Kartei, die „0 Aufenthalte" behauptet.

DER ANLASS, live gemessen am 30.08.2026 beim Beta-Betrieb: 290 der 293 Gaeste
hatten Buchungen, aber nur EINER gefuellte Aggregate. Der Aufruf hing
ausschliesslich an `reservations/writes.py` und am `booking_engine` — den
Pfaden fuer manuell angelegte und direkt gebuchte Aufenthalte. Der
Channel-Manager schrieb 295 Reservierungen daran vorbei.

Der Test ist bewusst STRUKTURELL (liest den Quelltext), nicht verhaltensbasiert:
ein echter Sync-Durchlauf braucht Channex-Nutzlast, Objekt-Mapping, Einheiten
und Kalender. Diese Kulisse haette den Fehler nicht gefunden — er lag nicht in
der Logik, sondern in einer FEHLENDEN Zeile. Genau darauf schaut der Test.
"""
from pathlib import Path

import pytest

_SLICE = Path(__file__).resolve().parents[1]

# Module, die Reservierungen anlegen oder aendern. Kommt ein weiteres dazu,
# gehoert es hierher — die Liste ist die Pflicht, nicht die Dokumentation.
SCHREIBENDE_MODULE = ("bookings_sync.py", "airbnb_historie_import.py")


@pytest.mark.parametrize("modul", SCHREIBENDE_MODULE)
def test_schreibpfad_rechnet_gast_aggregate_nach(modul: str) -> None:
    quelle = (_SLICE / modul).read_text(encoding="utf-8")
    assert 'table("reservations")' in quelle, (
        f"{modul} schreibt keine Reservierungen mehr — dann gehoert es aus "
        "SCHREIBENDE_MODULE entfernt, statt den Test leerlaufen zu lassen."
    )
    assert "recompute_guest_aggregates(" in quelle, (
        f"{modul} schreibt Reservierungen, ruft aber "
        "`recompute_guest_aggregates` nicht — die Gaestekartei zeigt dann "
        "'0 Aufenthalte' und kein Datum (Wurzel 1, Gegenzustand)."
    )


def test_funktion_existiert_unter_diesem_namen() -> None:
    """Der Test oben prueft einen NAMEN — also muss der Name echt sein.

    Ohne diese Gegenprobe wuerde eine Umbenennung beide Aufrufe unauffindbar
    machen und der Test bliebe trotzdem gruen, solange irgendwo die alte
    Zeichenkette steht.
    """
    from src.features.guests.service import recompute_guest_aggregates

    assert callable(recompute_guest_aggregates)
