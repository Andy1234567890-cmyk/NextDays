"""Airbnb-Übernahme: die ECHTE `mapping_details`-Antwortform.

Die Beispieldaten hier sind nicht erfunden — sie sind am autorisierten Kanal des
Beta-Betriebs live gemessen (04.08.2026, 18 Listings). Genau diese Form hat der
Code vorher NICHT gelesen: er suchte `listings`/`rooms`/`room_types` und bekam
darum immer eine leere Liste, obwohl Channex mit HTTP 200 antwortete — die UI
meldete „Das Portal liefert keine Zimmer. Prüfe die Zugangsdaten."
"""
from __future__ import annotations

import pytest

from src.features.channel_manager.airbnb_uebernahme import AirbnbUebernahmeMixin
from src.features.channel_manager.channels import ChannelsMixin
from src.features.channel_manager.common import ChannelManagerError

# Zwei Listings aus der echten Antwort, unverändert bis auf die Kürzung.
ECHTE_ANTWORT = {
    "data": {
        "listing_id_dictionary": {
            "values": [
                {
                    "id": "1133122057704952480",
                    "type": "house",
                    "title": "013 Rævlingevej · The Fox House",
                    "city": "Bindslev",
                    "quality_status": "educate",
                    "country_code": "DK",
                    "occupancies": [1, 2, 3, 4, 5, 6],
                    "synchronization_category": None,
                },
                {
                    "id": "1313677925363759741",
                    "type": "apartment",
                    "title": "011 Mosbjergvej 439 (kode 7811) · Fewo-Mosbjerg",
                    "city": "Sindal",
                    "quality_status": "good",
                    "country_code": "DK",
                    "occupancies": [1, 2],
                    "synchronization_category": None,
                },
            ]
        }
    }
}


def test_listings_aus_echter_antwort() -> None:
    werte = AirbnbUebernahmeMixin.airbnb_listings_aus_mapping_details(ECHTE_ANTWORT)
    assert len(werte) == 2
    assert werte[0]["id"] == "1133122057704952480"


def test_fehlender_schluessel_ist_fehler_keine_leere_uebernahme() -> None:
    """Wurzel 5: kein stilles „0 Objekte übernommen", wenn der Abruf misslang."""
    with pytest.raises(ChannelManagerError) as exc:
        AirbnbUebernahmeMixin.airbnb_listings_aus_mapping_details({"data": {}})
    assert exc.value.status_code == 502


def test_listing_zu_objekt_nimmt_nur_echte_felder() -> None:
    """max_guests = Maximum der `occupancies`; nichts erfunden (Wurzel 4)."""
    row = AirbnbUebernahmeMixin._listing_zu_objekt(  # noqa: SLF001
        ECHTE_ANTWORT["data"]["listing_id_dictionary"]["values"][0]
    )
    assert row == {
        "airbnb_listing_id": "1133122057704952480",
        "title": "013 Rævlingevej · The Fox House",
        "city": "Bindslev",
        "country": "DK",
        "max_guests": 6,
    }
    # Kein Preis, keine Adresse, keine Beschreibung — Airbnb liefert sie nicht.
    assert not {"address", "postal_code", "description", "lat", "lng"} & set(row)


def test_listing_ohne_titel_wird_uebersprungen() -> None:
    assert AirbnbUebernahmeMixin._listing_zu_objekt(  # noqa: SLF001
        {"id": "1", "title": "  "}
    ) is None


def test_normalize_mapping_rooms_kennt_die_listing_form() -> None:
    """Der prepare-Pfad muss dieselbe Form verstehen, sonst bleibt die
    Zuordnungs-Maske leer."""
    rooms = ChannelsMixin._normalize_mapping_rooms(ECHTE_ANTWORT)  # noqa: SLF001
    assert [r["id"] for r in rooms] == [
        "1133122057704952480", "1313677925363759741",
    ]
    # Ein Listing hat keine Raten-Ebene: eine Rate je Listing, dieselbe ID.
    assert rooms[0]["rates"][0]["id"] == rooms[0]["id"]
    assert rooms[0]["rates"][0]["max_persons"] == 6
    assert rooms[1]["rates"][0]["max_persons"] == 2


def test_normalize_mapping_rooms_booking_form_bleibt_intakt() -> None:
    rooms = ChannelsMixin._normalize_mapping_rooms(  # noqa: SLF001
        {"data": {"rooms": [
            {"id": "R1", "title": "Doppel", "rates": [
                {"id": "RT1", "title": "Standard", "max_persons": 2},
            ]},
        ]}}
    )
    assert rooms[0]["id"] == "R1"
    assert rooms[0]["rates"][0]["id"] == "RT1"
