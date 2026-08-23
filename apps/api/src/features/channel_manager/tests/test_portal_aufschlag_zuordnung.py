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

# Der echte Live-Bestand des Booking-Kanals von „Feriehus Rævehulen"
# (Kanal 1e553277-034e-40e4-a4f0-be89711b5006, zurueckgelesen 23.08.2026).
# BEWUSST vollstaendig abgeschrieben: `occupancy`, `pricing_type`, `primary_occ`
# und `readonly` gehoeren dazu. Die frueheren Fixtures liessen sie weg, und
# genau das war der Fehler, den sie nicht fanden — ein Ziel ohne diese Felder
# ist am Kanal eine Attrappe, die keine Restriktionen sendet.
BOOKING_BESTAND: list[dict[str, Any]] = [
    {
        "id": "83587e08-75fb-448f-a4dc-0fdc1476504d",
        "rate_plan_id": "ba195be1-1556-4696-828e-3b319d9cf14a",
        "settings": {
            "readonly": False,
            "occupancy": 6,
            "room_type_code": 1621321801,
            "rate_plan_code": 65402734,  # Wochenrate
            "pricing_type": "Standard",
            "primary_occ": False,
        },
    },
    {
        "id": "a137de3f-9050-4a5e-8d8e-e824872efc36",
        "rate_plan_id": "ba195be1-1556-4696-828e-3b319d9cf14a",
        "settings": {
            "readonly": False,
            "occupancy": 6,
            "room_type_code": 1621321801,
            "rate_plan_code": 64513248,  # Standard Rate
            "pricing_type": "Standard",
            "primary_occ": True,
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


def test_ziele_tragen_belegung_und_primary_occ() -> None:
    """DER BEFUND VOM 23.08.2026: die Ziele trugen nur die beiden Codes.

    Ein so angelegter Eintrag steht am Kanal ohne `primary_occ` — Channex sendet
    dort keine Restriktionen, und der alte Eintrag desselben Paares bleibt ihr
    Traeger. Gemessen an „FeWo *Stjerneskud*": die Wochenrate zeigte im
    Booking-Extranet weiter Mindestaufenthalt 2 statt 7.

    `occupancy`/`pricing_type` kommen aus dem BESTEHENDEN Eintrag desselben
    Paares (dort stehen die Werte, die das Portal kennt) — nicht aus einem
    Standardwert (Wurzel 4).
    """
    for z in ziele(BOOKING_BESTAND, None):
        assert z["primary_occ"] is True, "ohne primary_occ keine Restriktionen"
        assert z["occupancy"] == 6, "Belegung aus dem Bestand, nicht geraten"
        assert z["pricing_type"] == "Standard"
        assert z["readonly"] is False


def test_paar_ohne_belegung_wird_nicht_zugeordnet() -> None:
    """Fehlt der Bestandseintrag mit `occupancy`, wird NICHT zugeordnet.

    Eine geratene Belegung waere ein anderer Preis fuer dieselbe Rate
    (fail-closed, Wurzel 4/5). Genau so aussieht der kaputte Eintrag, den der
    Lauf am 23.08. selbst hinterliess: nur die beiden Codes.
    """
    attrappe = [{
        "id": "c59e353e-0eb3-48ef-b02c-cbc2d91c43bc",
        "rate_plan_id": "9c01b70e-dc3d-4b21-a317-c2216184bd47",
        "settings": {"room_type_code": 1621321801, "rate_plan_code": 65402734},
    }]
    assert ziele(attrappe, None) == []


def test_mehrere_belegungs_varianten_sind_nicht_entscheidbar() -> None:
    """Zwei nicht-primaere Eintraege desselben Paares (occ 1 und occ 4): dann
    ist nicht entscheidbar, welche Belegung die des Portals ist — also keine."""
    varianten = [
        {"id": "m1", "rate_plan_id": "cx-a",
         "settings": {"room_type_code": 1621321801, "rate_plan_code": 63941996,
                      "occupancy": 1, "pricing_type": "RLO",
                      "primary_occ": False}},
        {"id": "m2", "rate_plan_id": "cx-a",
         "settings": {"room_type_code": 1621321801, "rate_plan_code": 63941996,
                      "occupancy": 4, "pricing_type": "RLO",
                      "primary_occ": False}},
    ]
    assert ziele(varianten, None) == []


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
