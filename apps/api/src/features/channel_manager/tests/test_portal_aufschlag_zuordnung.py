"""Der Portal-Aufschlag muss JEDE Rate seines Portals treffen.

DIE LÜCKE (13.08.2026, live gemessen an „Feriehus Rævehulen"):
`_kanal_zuordnung_anlegen` verlangte ZWINGEND eine `properties.airbnb_listing_id`
und sendete `{"listing_id": …}`. Für Booking.com gab es damit keinen Pfad — der
Aufschlag stand in der Oberfläche und lief in eine Airbnb-Fehlermeldung, obwohl
das Objekt gar keine Airbnb-Anzeige sein musste.

Dazu die zweite Hälfte: Booking führt MEHRERE Raten je Zimmer (live: Standard
Rate 64513248 und Wochenrate 65402734, beide auf denselben Zimmertyp
1621321801), Airbnb genau EINE je Anzeige. Ein Aufschlag, der nur die erste
Rate trifft, lässt die andere zum alten Preis verkaufen.

Der Channex-Skill warnt zusätzlich: „if an unmapped rate is booked on a
connected channel, the reservation will not be sent through" — eine unbelegte
Rate verschluckt also eine Buchung.
"""

from __future__ import annotations

from typing import Any

from src.features.channel_manager.objekt_kanal import ObjektKanalMixin

ziele = ObjektKanalMixin._zuordnungs_ziele  # noqa: SLF001

# Der echte Live-Bestand des Booking-Kanals von „Feriehus Rævehulen".
BOOKING_BESTAND: list[dict[str, Any]] = [
    {
        "rate_plan_id": "ba195be1-1556-4696-828e-3b319d9cf14a",
        "settings": {
            "room_type_code": 1621321801,
            "rate_plan_code": 65402734,  # Wochenrate
            "pricing_type": "Standard",
        },
    },
    {
        "rate_plan_id": "ba195be1-1556-4696-828e-3b319d9cf14a",
        "settings": {
            "room_type_code": 1621321801,
            "rate_plan_code": 64513248,  # Standard Rate
            "pricing_type": "Standard",
        },
    },
]


def test_booking_bekommt_alle_raten() -> None:
    """Beide Booking-Raten müssen zugeordnet werden, nicht nur die erste."""
    gefunden = ziele(BOOKING_BESTAND, None)
    codes = sorted(z["rate_plan_code"] for z in gefunden)
    assert codes == [64513248, 65402734], (
        "Fehlt eine Rate, verkauft sie weiter zum alten Preis — und laut "
        "Channex-Skill verschluckt eine ungemappte Rate sogar Buchungen."
    )
    assert all(z["room_type_code"] == 1621321801 for z in gefunden)


def test_booking_braucht_keine_airbnb_kennung() -> None:
    """Der eigentliche Fehler: ohne `airbnb_listing_id` ging für Booking nichts."""
    assert ziele(BOOKING_BESTAND, None), (
        "Ein Booking-Objekt ohne Airbnb-Anzeige muss einen Aufschlag bekommen "
        "können — vorher warf das „Dieses Objekt ist bei Airbnb noch nicht "
        "zugeordnet“."
    )


def test_codes_bleiben_integer() -> None:
    """Channex erwartet INTEGER-Codes.

    Der Skill ist da eindeutig: Strings lassen Channex die Zuordnung unter
    „removed rates" ablegen, und die OTA-Seite zeigt „Not mapped" — ein Fehler,
    der wie ein Portal-Problem aussieht.
    """
    for z in ziele(BOOKING_BESTAND, None):
        assert isinstance(z["room_type_code"], int)
        assert isinstance(z["rate_plan_code"], int)


def test_doppelte_paare_werden_zusammengefasst() -> None:
    """Dieselbe Rate zweimal anzulegen wäre ein 422 „already exists" für nichts."""
    doppelt = [*BOOKING_BESTAND, dict(BOOKING_BESTAND[0])]
    assert len(ziele(doppelt, None)) == 2


def test_airbnb_nutzt_die_listing_kennung() -> None:
    """Airbnb kennt nur EINE Rate je Anzeige — Schlüssel ist die Listing-ID."""
    gefunden = ziele([], "1234567890")
    assert gefunden == [{"listing_id": "1234567890"}]


def test_bestehende_paare_gehen_vor_der_listing_kennung() -> None:
    """Trägt der Kanal echte OTA-Paare, sind DIE der Schlüssel.

    Ein Objekt kann bei Airbnb UND Booking hängen. Würde die Listing-ID
    gewinnen, bekäme der Booking-Kanal eine Airbnb-Zuordnung.
    """
    gefunden = ziele(BOOKING_BESTAND, "1234567890")
    assert all("listing_id" not in z for z in gefunden)
    assert len(gefunden) == 2


def test_ohne_bestand_und_ohne_kennung_kein_geratenes_ziel() -> None:
    """Nichts erfinden (Wurzel 4): dann gibt es nichts zuzuordnen.

    Der Aufrufer macht daraus einen 422 mit klarer Ansage, statt eine Zuordnung
    auf einen geratenen Code zu legen.
    """
    assert ziele([], None) == []
    assert ziele([{"settings": {}}], None) == []


def test_unvollstaendige_paare_werden_uebersprungen() -> None:
    """Ein halbes Paar ist kein Ziel — ein fehlender Code wird nicht ergänzt."""
    halb = [
        {"settings": {"room_type_code": 1621321801}},  # ohne rate_plan_code
        {"settings": {"rate_plan_code": 64513248}},  # ohne room_type_code
    ]
    assert ziele(halb, None) == []
