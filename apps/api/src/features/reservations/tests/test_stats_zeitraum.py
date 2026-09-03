"""Der Zeitraum-Wächter der Statistik-Endpunkte (Wurzel 8).

WARUM ER EXISTIERT (gemessen 03.09.2026):
`reads._stats_untergrenze` lädt Zeilen ab `date_from − Spanne ×
(COMPARE_PERIODS + 1)`. Das Ladefenster wächst also mit dem FÜNFFACHEN des
angefragten Zeitraums — und keiner der vier Statistik-Endpunkte prüfte die
Länge. Eine Anfrage über 2020-01-01..2026-12-31 zog das Fenster bis zum
30.12.1984 auf: ein Vollscan über den gesamten Bestand, ausgelöst von zwei
Query-Parametern. Mit `vergleich_jahre=5` kommt der Jahressprung obendrauf.

Der Wächter sitzt an EINER Stelle für alle vier Endpunkte — dreimal kopiert
wäre er beim vierten vergessen worden, und genau der wäre dann das Loch.
"""
from datetime import date, timedelta

import pytest
from fastapi import HTTPException

from src.features.reservations.reads import _stats_untergrenze
from src.features.reservations.router import MAX_STATS_TAGE, _stats_zeitraum


def test_vorgabe_sind_30_tage_inklusive_heute():
    """Ohne Argumente unverändert wie vorher — der Wächter darf nichts ändern."""
    start, ende = _stats_zeitraum(None, None)
    assert ende == date.today()
    assert (ende - start).days == 29


def test_nur_bis_gesetzt_behaelt_die_30_tage():
    start, ende = _stats_zeitraum(None, date(2026, 6, 30))
    assert ende == date(2026, 6, 30)
    assert start == date(2026, 6, 1)


def test_zeitraum_bis_zur_grenze_geht_durch():
    von = date(2026, 12, 31) - timedelta(days=MAX_STATS_TAGE)
    assert _stats_zeitraum(von, date(2026, 12, 31)) == (von, date(2026, 12, 31))


def test_ein_tag_ueber_der_grenze_wird_abgewiesen():
    von = date(2026, 12, 31) - timedelta(days=MAX_STATS_TAGE + 1)
    with pytest.raises(HTTPException) as exc:
        _stats_zeitraum(von, date(2026, 12, 31))
    assert exc.value.status_code == 422


def test_bis_vor_von_ist_422_kein_negativer_zeitraum():
    """Ohne die Prüfung ergäbe die Spanne einen NEGATIVEN Wert — das Ladefenster
    liefe damit in die Zukunft statt in die Vergangenheit."""
    with pytest.raises(HTTPException) as exc:
        _stats_zeitraum(date(2026, 12, 31), date(2026, 1, 1))
    assert exc.value.status_code == 422


def test_der_reale_fall_wird_gedeckelt():
    """Der gemessene Fall: sieben Jahre Zeitraum zogen das Fenster bis 1984."""
    von, bis = date(2020, 1, 1), date(2026, 12, 31)
    # So weit reichte das Ladefenster ungedeckelt:
    assert _stats_untergrenze(von, bis, 5) < "1985-01-01"
    # Und so wird die Anfrage jetzt abgewiesen:
    with pytest.raises(HTTPException):
        _stats_zeitraum(von, bis)


def test_gedeckelter_zeitraum_haelt_das_ladefenster_endlich():
    """Innerhalb der Grenze bleibt das Fenster in vertretbarem Rahmen.

    Ein Jahr Zeitraum plus 5-Jahres-Vergleich reicht bis knapp über sechs
    Jahre zurück — nicht über vier Jahrzehnte.
    """
    von, bis = date(2026, 1, 1), date(2026, 12, 31)
    _stats_zeitraum(von, bis)  # geht durch
    grenze = date.fromisoformat(_stats_untergrenze(von, bis, 5))
    assert grenze >= date(2019, 1, 1)
