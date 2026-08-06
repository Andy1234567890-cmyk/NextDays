"""Welche Änderung stößt welchen Airbnb-Direktweg an?

Der Auslöser ist die eigentliche Fehlerquelle: fehlt er, ist die Maske eine
Einbahnstraße — bei uns gespeichert, bei Airbnb der alte Stand. Genau das war
06.08.2026 bei Fläche und Kapazität der Fall.
"""
from __future__ import annotations

from typing import Any

import pytest

from src.features.properties import airbnb_nachziehen as an


@pytest.fixture(name="gerufen")
def _gerufen(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Ersetzt die beiden Einreih-Funktionen und merkt sich die Aufrufe."""
    protokoll: list[str] = []

    def falle(name: str) -> Any:
        def _f(_db: Any, _tenant: str, _prop: str) -> None:
            protokoll.append(name)
        _f.__name__ = f"try_enqueue_{name}"
        return _f

    monkeypatch.setattr(an, "_AUSLOESER", (
        (frozenset({"amenities", "room_amenities"}), falle("airbnb_ausstattung")),
        (frozenset({"size_value", "size_unit", "max_guests"}),
         falle("airbnb_stammdaten")),
    ))
    return protokoll


@pytest.mark.parametrize("feld", ["size_value", "size_unit", "max_guests"])
def test_jedes_stammdatenfeld_loest_aus(gerufen: list[str], feld: str) -> None:
    """DER gemeldete Fehler: geändert, aber nie zu Airbnb geschickt."""
    an.airbnb_direkt_nachziehen(None, "t-1", "p-1", {feld: 1})
    assert gerufen == ["airbnb_stammdaten"]


def test_zwei_felder_eines_jobs_reihen_einmal_ein(gerufen: list[str]) -> None:
    """Der Job sendet den vollen Soll-Stand — zweimal wäre derselbe PUT."""
    an.airbnb_direkt_nachziehen(
        None, "t-1", "p-1", {"size_value": 70, "size_unit": "sqm"}
    )
    assert gerufen == ["airbnb_stammdaten"]


def test_ausstattung_und_stammdaten_sind_getrennt(gerufen: list[str]) -> None:
    """Beide Wege gehen, wenn beides geändert wurde — und nur dann."""
    an.airbnb_direkt_nachziehen(
        None, "t-1", "p-1", {"amenities": [], "max_guests": 4}
    )
    assert gerufen == ["airbnb_ausstattung", "airbnb_stammdaten"]


def test_unbeteiligte_aenderung_ruft_airbnb_nicht(gerufen: list[str]) -> None:
    """Ein Titel-Update darf keinen Fremdaufruf auslösen (Wurzel 2)."""
    an.airbnb_direkt_nachziehen(None, "t-1", "p-1", {"title": "Neu"})
    assert gerufen == []


def test_leere_aenderung_tut_nichts(gerufen: list[str]) -> None:
    """Kein Feld geändert → kein Job."""
    assert an.airbnb_direkt_nachziehen(None, "t-1", "p-1", {}) == []
    assert gerufen == []
