"""Der Schalter „Genauen Standort anzeigen" muss zu Airbnb — und zurück.

DER BEFUND (06.09.2026): Die Standort-Maske speichert
`type_attributes.location.showPreciseLocation`, und NIEMAND las den Wert. Er
ging an kein Portal, kam von keinem — eine Insel in der Oberfläche.

Airbnb führt dasselbe als `display_exact_location_to_guest` am Listing (Airbnb
Connection API; live an „Feriehus Snerlebo", Listing 1768637952856703501,
gemessen 06.09.2026: `true`). Damit gibt es beide Richtungen:

    Airbnb → Maske   `airbnb_standort.standort_uebernehmen` (beim Abruf)
    Maske → Airbnb   `airbnb_stammdaten_schreiben` (flacher PUT v2/listings)

Die flache Nutzlast ist Pflicht — mit der Hülle `{"listing": …}` quittiert
Airbnb mit 200 und verwirft den Inhalt (siehe test_airbnb_stammdaten_rueckweg).
"""
from __future__ import annotations

from typing import Any

import pytest

from src.features.channel_manager import airbnb_standort
from src.features.channel_manager.airbnb_direkt import (
    AirbnbDirektMixin,
    standort_schalter,
)
from src.features.channel_manager.airbnb_listing_import import standort_genauigkeit

# --- Airbnb → Maske ---------------------------------------------------------

@pytest.mark.parametrize("wert", [True, False])
def test_airbnbs_stand_landet_in_der_maske(wert: bool) -> None:
    neu: dict[str, Any] = {}
    gesetzt: list[str] = []
    airbnb_standort.standort_uebernehmen(
        {"display_exact_location_to_guest": wert}, {}, neu, gesetzt,
    )
    assert neu["location"]["showPreciseLocation"] is wert
    assert gesetzt == ["standortGenauigkeit"]


def test_fehlendes_feld_setzt_nichts() -> None:
    """Wurzel 4: „Airbnb sagt nichts" ist nicht dasselbe wie „aus"."""
    neu: dict[str, Any] = {}
    gesetzt: list[str] = []
    airbnb_standort.standort_uebernehmen({}, {}, neu, gesetzt)
    assert neu == {} and gesetzt == []


@pytest.mark.parametrize("wert", ["true", 1, None])
def test_nur_ein_echter_bool_zaehlt(wert: object) -> None:
    assert standort_genauigkeit({"display_exact_location_to_guest": wert}) is None


def test_gleicher_stand_schreibt_nicht() -> None:
    """Kein Update, das nichts ändert — sonst zählt jeder Abruf ein Feld als
    „übernommen", das gleich geblieben ist."""
    neu: dict[str, Any] = {}
    gesetzt: list[str] = []
    airbnb_standort.standort_uebernehmen(
        {"display_exact_location_to_guest": True},
        {"location": {"showPreciseLocation": True}}, neu, gesetzt,
    )
    assert neu == {} and gesetzt == []


def test_die_uebrigen_standortfelder_bleiben() -> None:
    """Wurzel 1: `location` trägt Entfernungen, Kartenbild, Wegbeschreibung —
    ein Update mit nur dem Schalter würde sie löschen."""
    alt = {"location": {
        "stateProvince": "North Denmark Region",
        "distances": {"unit": "km", "values": {"airport": 40}},
        "customMapUrl": "https://example.test/karte.png",
        "showPreciseLocation": False,
    }}
    neu: dict[str, Any] = {}
    gesetzt: list[str] = []
    airbnb_standort.standort_uebernehmen(
        {"display_exact_location_to_guest": True}, alt, neu, gesetzt,
    )
    assert neu["location"]["showPreciseLocation"] is True
    assert neu["location"]["stateProvince"] == "North Denmark Region"
    assert neu["location"]["distances"]["values"]["airport"] == 40
    assert neu["location"]["customMapUrl"] == "https://example.test/karte.png"
    # Der Alt-Stand selbst bleibt unberührt (er wird an anderer Stelle noch
    # gegen `neu` verglichen).
    assert alt["location"]["showPreciseLocation"] is False


# --- Maske → Airbnb ---------------------------------------------------------

class _Dienst(AirbnbDirektMixin):
    """Fängt Schreib- und Leseaufruf ab, statt Airbnb zu rufen."""

    def __init__(self, stand: dict[str, Any] | None = None) -> None:
        self.gesendet: list[tuple[str, dict[str, Any]]] = []
        self._stand = stand

    def _airbnb_put(  # type: ignore[override]  # noqa: D102
        self, token: str, pfad: str, nutzlast: dict[str, Any]
    ) -> dict[str, Any]:
        self.gesendet.append((pfad, nutzlast))
        return {}

    def _airbnb_get(  # type: ignore[override]  # noqa: D102
        self, token: str, pfad: str, params: dict | None = None
    ) -> dict | None:
        if self._stand is not None:
            return self._stand
        letzte = self.gesendet[-1][1] if self.gesendet else {}
        return {"listing": {
            "display_exact_location_to_guest": letzte.get(
                "display_exact_location_to_guest"
            ),
        }}


@pytest.mark.parametrize("wert", [True, False])
def test_schalter_geht_flach_an_airbnb(wert: bool) -> None:
    """Auch `false` geht raus: „nicht anzeigen" ist eine Entscheidung des
    Betriebs, kein fehlender Wert."""
    dienst = _Dienst()
    dienst.airbnb_stammdaten_schreiben(
        "tok", "l-1", None, None, None, genauer_standort=wert,
    )
    pfad, nutzlast = dienst.gesendet[0]
    assert pfad == "v2/listings/l-1"
    assert nutzlast == {"display_exact_location_to_guest": wert}
    assert "listing" not in nutzlast


def test_ohne_schalter_kein_aufruf() -> None:
    """Nicht gepflegt heißt nicht senden — sonst überschriebe ein leeres
    Objektformular Airbnbs Einstellung."""
    dienst = _Dienst()
    assert dienst.airbnb_stammdaten_schreiben(
        "tok", "l-1", None, None, None, genauer_standort=None,
    ) == {}
    assert dienst.gesendet == []


def test_verworfener_schalter_wird_erkannt() -> None:
    """Airbnb quittiert eine verworfene Nutzlast mit 200 — nur die Rücklesung
    entscheidet (Wurzel 5)."""
    dienst = _Dienst(stand={"listing": {"display_exact_location_to_guest": False}})
    erg = dienst.airbnb_stammdaten_schreiben(
        "tok", "l-1", None, None, None, genauer_standort=True,
    )
    assert erg["angekommen"] is False


def test_geht_zusammen_mit_flaeche_und_kapazitaet() -> None:
    """EIN Aufruf für alle drei Felder — der Job sendet den vollen Soll-Stand."""
    dienst = _Dienst(stand={"listing": {
        "property_details": {"listing_size": {"size": 69, "size_unit": "SQUARE_METERS"}},
        "person_capacity": 4,
        "display_exact_location_to_guest": True,
    }})
    erg = dienst.airbnb_stammdaten_schreiben(
        "tok", "l-1", 69.0, "sqm", 4, genauer_standort=True,
    )
    assert dienst.gesendet[0][1]["display_exact_location_to_guest"] is True
    assert dienst.gesendet[0][1]["person_capacity"] == 4
    assert erg["angekommen"] is True


# --- Der Schalter-Leser -----------------------------------------------------

@pytest.mark.parametrize(
    ("attrs", "erwartet"),
    [
        ({"location": {"showPreciseLocation": True}}, True),
        ({"location": {"showPreciseLocation": False}}, False),
        ({"location": {}}, None),
        ({"location": "kaputt"}, None),
        ({}, None),
        (None, None),
        # Ein String ist kein Bool: „true" käme bei Airbnb als Unsinn an.
        ({"location": {"showPreciseLocation": "true"}}, None),
    ],
)
def test_schalter_lesen(attrs: object, erwartet: bool | None) -> None:
    assert standort_schalter(attrs) is erwartet
