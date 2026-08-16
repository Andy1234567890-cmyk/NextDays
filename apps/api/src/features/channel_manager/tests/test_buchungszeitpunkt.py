"""Der ECHTE Buchungszeitpunkt — nie unsere eigene Uhr (0291/0292).

DER VORFALL, den diese Tests für immer ausschließen sollen (06.08.2026): Der
Posteingang zeigte 22 Airbnb-Buchungen als „heute 10:48". Real gebucht waren
sie am 23.03., 01.06. und 26.07. — die älteste viereinhalb Monate alt. Alle 22
trugen dieselbe Sekunde, weil der Feed sie in einem Rutsch abholte und die
Anzeige unseren Anlagezeitpunkt zeigte. Die Sortierung „letzte Aktivität" war
damit wertlos, und der Betrieb sah einen Posteingang voller vermeintlich neuer
Buchungen.

DIE REGEL, die daraus folgt: Ein Zeitstempel, den WIR setzen, beschreibt unsere
Verarbeitung — nie die Handlung des Gastes. Fehlt der echte Wert, ist die
Antwort None; die Oberfläche sagt dann „Eingang bei uns", statt einen
plausiblen falschen Zeitpunkt zu behaupten (Wurzel 4).
"""
from __future__ import annotations

import json

from src.features.channel_manager.common import ota_buchungszeitpunkt


def test_airbnb_booked_at_gewinnt() -> None:
    """Airbnbs `booked_at` ist die Wahrheit — live gemessen an HMPKWNHQNF."""
    assert ota_buchungszeitpunkt({
        "booked_at": "2026-03-23T15:24:55.612Z",
        "created_at": "2026-03-23T15:24:47.996Z",
    }) == "2026-03-23T15:24:55.612Z"


def test_created_at_der_reservierung_als_ersatz() -> None:
    """Airbnbs eigenes Anlagedatum stammt aus DERSELBEN Quelle und liegt live
    wenige Sekunden vor `booked_at` — brauchbar, wenn letzteres fehlt."""
    assert ota_buchungszeitpunkt(
        {"created_at": "2026-03-23T15:24:47.996Z"}
    ) == "2026-03-23T15:24:47.996Z"


def test_ohne_portal_zeit_kommt_none() -> None:
    """KEIN Rückfall auf unsere Uhr. Genau dieser Rückfall war der Fehler.

    Ein `inserted_at` (Eingang beim Aggregator) darf hier nichts auslösen — er
    stand bei allen 22 Buchungen auf derselben Sekunde.
    """
    assert ota_buchungszeitpunkt({"inserted_at": "2026-08-06T08:48:57"}) is None
    assert ota_buchungszeitpunkt({}) is None


def test_leerer_wert_ist_kein_wert() -> None:
    """Channex liefert `ota_booked_at` als leeres Feld (live geprüft) — das
    darf nicht als gesetzter Zeitpunkt durchgehen."""
    assert ota_buchungszeitpunkt({"booked_at": "", "ota_booked_at": None}) is None


def test_zone_wird_ergaenzt() -> None:
    """Ohne Zone wäre der Zeitpunkt zwei Stunden falsch (CEST): eine Buchung
    um 08:48 UTC ist 10:48 beim Betrieb — genau die Zahl aus dem Vorfall."""
    assert ota_buchungszeitpunkt(
        {"booked_at": "2026-03-23T15:24:55"}
    ) == "2026-03-23T15:24:55Z"


def test_reihenfolge_ist_verlaesslichkeit() -> None:
    """Steht beides, gewinnt das Feld des Portals — nicht das zuerst gefundene."""
    assert ota_buchungszeitpunkt({
        "ota_booked_at": "2026-01-01T00:00:00Z",
        "booked_at": "2026-03-23T15:24:55Z",
    }) == "2026-03-23T15:24:55Z"


def test_airbnb_uhrzeit_mit_zonen_anhang() -> None:
    """Airbnbs `check_in_datetime` trägt Javas Zonen-Kennung in eckigen Klammern.

    `'2026-08-06T16:00+02:00[Europe/Copenhagen]'` — live gemessen.
    `datetime.fromisoformat` scheitert daran; ohne eigenen Parser blieb
    `reservations.checkin_time` leer und jede Anreise-Vorlage meldete
    „Feld ohne Wert: checkin_time".
    """
    from src.features.channel_manager.common import ota_uhrzeit

    assert ota_uhrzeit("2026-08-06T16:00+02:00[Europe/Copenhagen]") == "16:00"
    assert ota_uhrzeit("2026-08-09T10:00+02:00[Europe/Copenhagen]") == "10:00"


def test_channex_uhrzeit_bleibt_wie_sie_ist() -> None:
    """Channex liefert `arrival_hour` schon als „HH:MM"."""
    from src.features.channel_manager.common import ota_uhrzeit

    assert ota_uhrzeit("16:00") == "16:00"


def test_uhrzeit_wird_nicht_nach_utc_gerechnet() -> None:
    """„Check-in ab 16:00" ist eine HAUSREGEL in Ortszeit, kein Zeitpunkt.

    Nach UTC geschoben stünde „14:00" da — eine Uhrzeit, zu der niemand
    anreisen darf.
    """
    from src.features.channel_manager.common import ota_uhrzeit

    assert ota_uhrzeit("2026-08-06T16:00+02:00[Europe/Copenhagen]") != "14:00"


def test_ohne_uhrzeit_kein_ersatzwert() -> None:
    """Lieber „Feld ohne Wert" als eine erfundene Zeit, nach der sich ein Gast
    richtet und vor verschlossener Tür steht (Wurzel 4)."""
    from src.features.channel_manager.common import ota_uhrzeit

    assert ota_uhrzeit("") is None
    assert ota_uhrzeit(None) is None
    assert ota_uhrzeit("demnächst") is None


def test_airbnb_zeit_kommt_aus_der_durchgereichten_nutzlast() -> None:
    """Der Fall, der lange durchfiel (15.08.2026).

    Channex normalisiert Airbnbs An-/Abreisezeit NICHT: `arrival_hour` und
    `checkin_time` sind dort leer. Die Zeit steht in der durchgereichten
    Original-Nutzlast. Live an 22 von 22 Buchungen gemessen — der Import las
    nur `attrs["checkin_time"]` und schrieb deshalb überall NULL, während
    dieselbe Buchung über den Airbnb-Direktabruf eine Zeit bekam. Wer die
    Reihenfolge hier ändert, bricht genau das wieder.
    """
    from src.features.channel_manager.common import ota_an_abreisezeit

    attrs = {
        "ota_name": "AirBNB",
        "arrival_hour": None,
        "checkin_time": None,
        "raw_message": {
            "reservation": {
                "check_in_datetime": "2026-10-16T16:00+02:00[Europe/Copenhagen]",
                "check_out_datetime": "2026-10-23T10:00+02:00[Europe/Copenhagen]",
            }
        },
    }
    assert ota_an_abreisezeit(attrs) == ("16:00", "10:00")


def test_raw_message_auch_als_json_text() -> None:
    """`raw_message` kommt je nach Weg als dict ODER als JSON-Text herein.

    Der Webhook reicht das Objekt durch, die Staging-Zeile speichert Text.
    Ohne beides hinge die Zeit davon ab, auf welchem Weg die Buchung kam.
    """
    from src.features.channel_manager.common import ota_an_abreisezeit

    attrs = {
        "raw_message": json.dumps(
            {"reservation": {"check_in_datetime": "2026-10-16T15:00+02:00[Europe/Oslo]"}}
        )
    }
    assert ota_an_abreisezeit(attrs)[0] == "15:00"


def test_channex_feld_gewinnt_vor_der_rohnutzlast() -> None:
    """Das normalisierte Feld steht zuerst: es ist das dokumentierte."""
    from src.features.channel_manager.common import ota_an_abreisezeit

    attrs = {
        "arrival_hour": "18:30",
        "raw_message": {
            "reservation": {
                "check_in_datetime": "2026-10-16T16:00+02:00[Europe/Copenhagen]"
            }
        },
    }
    assert ota_an_abreisezeit(attrs)[0] == "18:30"


def test_booking_ohne_zeit_bleibt_leer() -> None:
    """Booking.com überträgt die Gast-ETA im Reservierungs-Feed NICHT.

    Belegt in zwei Richtungen: live an 67 von 67 Buchungen (`arrival_hour`
    null, kein `TimeSpan`, kein `ResGuest@ArrivalTime` in der Nutzlast) und in
    Booking.coms eigener `ResGuest`-Referenz, die als einziges Attribut
    `@ResGuestRPH` führt. Die ETA gibt es dort nur über das separate Produkt
    „Online Check-in API", nicht über den Feed, den ein Channel-Manager holt.

    Hier steht deshalb None — NICHT die Hausregel des Objekts (die greift erst
    eine Ebene höher, in `_zeiten_vom_objekt`) und nicht die Zeit eines anderen
    Portals (Wurzel 4). Bookings `time` ist der BUCHUNGSzeitpunkt und darf hier
    nie durchrutschen.
    """
    from src.features.channel_manager.common import ota_an_abreisezeit

    attrs = {
        "ota_name": "BookingCom",
        "arrival_hour": None,
        "raw_message": {
            "id": "5778403810",
            "date": "2026-01-04",
            "time": "17:16:38",
            "rooms": [{"arrival_date": "2026-08-05", "departure_date": "2026-08-12"}],
        },
    }
    assert ota_an_abreisezeit(attrs) == (None, None)
