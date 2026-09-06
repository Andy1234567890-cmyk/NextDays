"""Der Standort-Schalter darf nur bei ECHTER Änderung nach Airbnb.

`type_attributes` steht bei jedem Speichern der Maske im Update — ein Auslöser
ohne Vorher/Nachher-Vergleich schickte bei jedem Klick auf „Speichern" einen
Schreibaufruf an ein Live-Listing.
"""
from __future__ import annotations

from typing import Any

import pytest

from src.features.properties import airbnb_nachziehen as an


@pytest.fixture(name="gerufen")
def _gerufen(monkeypatch: pytest.MonkeyPatch) -> list[str]:
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


def _attrs(wert: bool) -> dict[str, Any]:
    return {"location": {"showPreciseLocation": wert, "stateProvince": "Nordjylland"}}


def test_umgelegter_schalter_geht_raus(gerufen: list[str]) -> None:
    an.airbnb_direkt_nachziehen(
        None, "t-1", "p-1", {"type_attributes": _attrs(True)}, _attrs(False),
    )
    assert gerufen == ["airbnb_stammdaten"]


def test_unveraenderter_schalter_ruft_airbnb_nicht(gerufen: list[str]) -> None:
    """Der eigentliche Schutz: die Maske speichert `type_attributes` immer."""
    an.airbnb_direkt_nachziehen(
        None, "t-1", "p-1", {"type_attributes": _attrs(True)}, _attrs(True),
    )
    assert gerufen == []


def test_andere_aenderung_im_selben_block_ruft_nicht(gerufen: list[str]) -> None:
    alt = _attrs(True)
    neu = {"location": {"showPreciseLocation": True, "stateProvince": "Midtjylland"}}
    an.airbnb_direkt_nachziehen(None, "t-1", "p-1", {"type_attributes": neu}, alt)
    assert gerufen == []


def test_ohne_alt_stand_lieber_einmal_zu_viel(gerufen: list[str]) -> None:
    """Konservativ (Wurzel 1): ein Job zu viel kostet einen Aufruf, ein
    ausgelassener zeigt bei Airbnb den falschen Standort."""
    an.airbnb_direkt_nachziehen(
        None, "t-1", "p-1", {"type_attributes": _attrs(True)}, None,
    )
    assert gerufen == ["airbnb_stammdaten"]


def test_kein_schalter_im_update_ruft_nicht(gerufen: list[str]) -> None:
    an.airbnb_direkt_nachziehen(
        None, "t-1", "p-1", {"type_attributes": {"policies": {}}}, {},
    )
    assert gerufen == []


def test_flaechenaenderung_reiht_nur_einmal_ein(gerufen: list[str]) -> None:
    """Fläche UND Schalter geändert: EIN Job, nicht zwei — er sendet ohnehin
    den vollen Soll-Stand aller drei Felder."""
    an.airbnb_direkt_nachziehen(
        None, "t-1", "p-1",
        {"size_value": 70, "type_attributes": _attrs(True)}, _attrs(False),
    )
    assert gerufen == ["airbnb_stammdaten"]
