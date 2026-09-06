"""`PrepareChannelResponse` traegt `airbnb_listing_id` bis zum Frontend (06.09.2026).

Der Service berechnet die Listing-ID je lokalem Zimmer (`_local_room_options`),
damit die Zuordnungsmaske die Airbnb-Anzeige exakt vorwaehlt. FastAPI
serialisiert ueber das Pydantic-Modell und verwirft Felder, die dort nicht
stehen — still. Genau das war passiert: `prepare_debug` loggte die ID, die
Antwort enthielt sie nicht, die Maske stand auf „nicht zuordnen".

Dieser Test prueft die SERIALISIERTE Antwort (`model_dump`), nicht das Dict
davor — nur so faellt ein erneut gestrichenes Feld auf.
"""

from src.features.channel_manager.schemas import PrepareChannelResponse


def test_listing_id_ueberlebt_die_serialisierung() -> None:
    antwort = PrepareChannelResponse(
        portal="Airbnb",
        ota_rooms=[],
        rooms=[
            {
                "local_property_id": "e38e2397",
                "title": "Feriehus Snerlebo",
                "suggested_bcrt_code": 29,
                "suggested_bcrt_name": "Holiday home",
                "airbnb_listing_id": "1768637952856703501",
            }
        ],
        direktzuordnung=False,
    )
    raus = antwort.model_dump()
    assert raus["rooms"][0]["airbnb_listing_id"] == "1768637952856703501"


def test_listing_id_ohne_airbnb_ist_none() -> None:
    # Ein Booking.com-Objekt hat keine Anzeige — das Feld ist da, aber leer.
    # Kein Ersatzwert, kein leerer String (Wurzel 4).
    antwort = PrepareChannelResponse(
        portal="Booking.com",
        rooms=[{"local_property_id": "x", "title": "Zimmer"}],
    )
    assert antwort.model_dump()["rooms"][0]["airbnb_listing_id"] is None
