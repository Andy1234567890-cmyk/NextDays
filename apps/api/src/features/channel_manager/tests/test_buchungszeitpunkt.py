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
from datetime import UTC, datetime, timedelta

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


# ── Das Frische-Fenster (`ist_frisch`) ────────────────────────────────────────
#
# Die Arithmetik „liegt dieser fremde Zeitpunkt in den letzten n Stunden" stand
# bis zum 09.09.2026 DREIMAL im Slice (`_frisch_gebucht`, `_bestand`,
# `_frische_nachricht`) — mit je invertierter Rueckgabe und je invertiertem
# fail-Wert. Hier steht sie einmal, und hier wird sie einmal geprueft; die
# Aufrufstellen pruefen nur noch ihre eigene Fail-Richtung.


def test_ist_frisch_prueft_die_grenze_beidseitig() -> None:
    """Innerhalb des Fensters `True`, ausserhalb `False` — an der Grenze selbst.

    Die Stuetzwerte liegen fuenf Minuten neben der Grenze, nicht Jahre davon
    entfernt: ein Test mit `now()` gegen ein Datum von 2020 bleibt gruen, egal
    ob das Fenster 1 Stunde oder 500 Stunden breit ist. Er prueft dann den
    Codepfad, nicht die Grenze.
    """
    from src.features.channel_manager.common import ist_frisch

    jetzt = datetime.now(UTC)
    drinnen = (jetzt - timedelta(hours=24) + timedelta(minutes=5)).isoformat()
    draussen = (jetzt - timedelta(hours=24) - timedelta(minutes=5)).isoformat()

    assert ist_frisch(drinnen, stunden=24) is True
    assert ist_frisch(draussen, stunden=24) is False


def test_ist_frisch_ohne_zone_gilt_als_utc() -> None:
    """Channex liefert `inserted_at` ohne Zonen-Suffix; gemeint ist UTC.

    Ohne diese Annahme deutete Python den Wert als naive Ortszeit und der
    Vergleich wuerde je Serverzone um Stunden springen (Begruendung bei
    `ota_zeitstempel_utc`).
    """
    from src.features.channel_manager.common import ist_frisch

    ohne_zone = datetime.now(UTC).replace(tzinfo=None).isoformat()
    assert ist_frisch(ohne_zone, stunden=1) is True


def test_ist_frisch_gibt_none_statt_eines_fail_werts() -> None:
    """Fehlt/unlesbar → `None`, NICHT `True` und nicht `False`.

    Der fail-Wert ist an den drei Aufrufstellen ein ANDERER (Recovery meldet
    lieber nichts, die Glocke laeutet lieber nicht, der Abgleich gilt lieber als
    Bestand). Ihn hier zu waehlen hiesse, ihn zu verstecken — und genau das
    versteckte Vorzeichen war die Falle der drei Vorgaenger-Kopien.
    """
    from src.features.channel_manager.common import ist_frisch

    assert ist_frisch(None, stunden=24) is None
    assert ist_frisch("", stunden=24) is None
    assert ist_frisch("kaputt", stunden=24) is None


def test_ist_frisch_meldet_zukunftswerte_als_datenfehler(monkeypatch) -> None:
    """Ein Zeitstempel in der ZUKUNFT ist kein Normalfall — `None` plus Log.

    Alle drei Vorgaenger verglichen einseitig (`jetzt - zeitpunkt <= fenster`).
    Fuer einen Zukunftswert — Portal mit falsch gestellter Uhr, falsches
    Vorzeichen im Offset, vertauschtes Tag/Monat — ist das DAUERHAFT wahr: der
    Wert gilt fuer immer als frisch, und die Meldung wiederholt sich bei jedem
    Lauf, ohne dass etwas auffaellt. Ein solcher Wert ist ein Datenfehler und
    wird LAUT gemeldet (Wurzel 4/5), statt still als frisch durchzugehen.

    Die Warnung wird am `log`-Objekt des Moduls abgefangen, nicht ueber
    capsys/caplog: structlog schreibt weder in den stdlib-Logger noch
    verlaesslich nach stdout, sobald pytest die Ausgabe umleitet (dieselbe
    Begruendung wie in `test_uebrige_portal_raten_paarung`).
    """
    from src.features.channel_manager import common as common_modul

    warnungen: list[tuple[str, dict]] = []
    monkeypatch.setattr(
        common_modul.log, "warning",
        lambda ereignis, **felder: warnungen.append((ereignis, felder)),
    )
    voraus = (datetime.now(UTC) + timedelta(days=30)).isoformat()

    assert common_modul.ist_frisch(voraus, stunden=24) is None

    gemeldet = [f for e, f in warnungen if e == "ota_zeitstempel_in_der_zukunft"]
    assert len(gemeldet) == 1, warnungen
    # Der Vorsprung steht in der Meldung: an ihm erkennt der Leser den
    # Unterschied zwischen Uhr-Drift und vertauschtem Tag/Monat.
    assert gemeldet[0]["vorsprung_sekunden"] > 0


def test_ist_frisch_vertraegt_sekunden_uhr_drift() -> None:
    """Wenige Sekunden Vorsprung sind Uhr-Drift, kein Datenfehler.

    Zwei Rechenzentren driften um Sekunden, und ein Portal darf einen Vorgang
    auf die Sekunde stempeln, in der unsere Uhr noch nicht ist. Wuerde die
    Zukunftspruefung schon hier greifen, verloere der Live-Feed genau die
    frischesten Buchungen — die, um die es geht.
    """
    from src.features.channel_manager.common import ist_frisch

    knapp_voraus = (datetime.now(UTC) + timedelta(seconds=5)).isoformat()
    assert ist_frisch(knapp_voraus, stunden=24) is True
