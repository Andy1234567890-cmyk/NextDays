"""Posteingang-Threads und Portal-Nachrichten für den Demo-Bestand.

WARUM ES DAS BRAUCHT: `seed_demo.py` legt Buchungen in `reservations` an, der
Posteingang liest aber aus `channex_booking` (ein Thread = eine Portalbuchung)
und `portal_messages` (der Verlauf). Ohne diese beiden Tabellen zeigt die App
242 Buchungen und ein LEERES Postfach — genau der Zustand, der die
Marketing-Aufnahmen wertlos machte (30.08.2026).

DIE VERKNÜPFUNG, die den Thread an die Buchung bindet, ist eine Kette über
zwei Tabellen (verifiziert an `InboxService._reservation_ids_for`):

    channex_booking.channex_booking_id  ──►  reservations.source_channex_booking_id
    portal_messages.thread_ref          ──►  channex_booking.id (als Text)

Fehlt `source_channex_booking_id` auf der Reservierung, steht der Thread ohne
Buchung da: kein Reservierungskopf, kein Sprung in die Buchung.

NUR PORTALBUCHUNGEN: ein Thread entsteht ausschliesslich für Buchungen mit
einem echten Portal (booking/airbnb/vrbo). `direct` und `portal` (myBestDays)
laufen nicht über den Channel-Manager und haben dort konstruktiv keinen Thread
— einen zu erfinden hiesse, eine Datenlage zu zeigen, die es nie gibt.

Zeitpunkte kommen aus der BUCHUNG (`booked_at`), nie aus `now()`: unsere Uhr
ist nie der Zeitpunkt eines fremden Ereignisses (Wurzel 5b). Sonst trügen alle
Threads dieselbe Sekunde und die Sortierung „letzte Aktivität" wäre wertlos —
der reale Bug vom 06.08.2026.
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

from konfig import Supabase, demo_id

# Gesprächsverläufe je Portal. Zwei bis vier Nachrichten reichen für ein
# glaubwürdiges Listenbild: die Liste zeigt die letzte Nachricht, der geöffnete
# Thread den Verlauf. Der letzte Sprecher entscheidet, ob der Thread als
# „Gast wartet auf Antwort" erscheint — deshalb enden nicht alle mit uns.
VERLAEUFE: list[list[tuple[str, str]]] = [
    [
        ("guest", "Hallo, wir freuen uns sehr auf den Aufenthalt! "
                  "Können wir schon vor 15 Uhr anreisen?"),
        ("property", "Guten Tag, herzlich willkommen! Ein früherer Check-in ist "
                     "ab 13 Uhr möglich, wenn die Reinigung durch ist. "
                     "Ich melde mich am Vortag mit einer verlässlichen Zeit."),
        ("guest", "Perfekt, vielen Dank!"),
    ],
    [
        ("guest", "Guten Tag, gibt es vor Ort einen Parkplatz für unser Auto?"),
        ("property", "Ja, ein eigener Stellplatz direkt am Haus gehört dazu — "
                     "kostenfrei und ohne Anmeldung."),
    ],
    [
        ("guest", "Wir reisen mit unserem Hund an. Ist das in Ordnung?"),
        ("property", "Hunde sind willkommen. Für die Endreinigung kommen 25 € "
                     "dazu, die rechne ich vor Ort ab."),
        ("guest", "Sehr gern, dann buchen wir so."),
    ],
    [
        ("guest", "Hallo, wie kommen wir an die Schlüssel? "
                  "Wir treffen erst gegen 21 Uhr ein."),
        ("property", "Kein Problem — es gibt einen Schlüsselsafe neben der "
                     "Haustür. Den Code schicke ich Ihnen am Anreisetag."),
    ],
    [
        ("guest", "Können wir einen Tag später abreisen?"),
    ],
    [
        ("guest", "Ist Bettwäsche im Preis enthalten?"),
        ("property", "Ja, Bettwäsche und Handtücher liegen für alle Gäste bereit."),
        ("guest", "Danke für die schnelle Antwort!"),
        ("property", "Sehr gern. Bis bald an der Küste!"),
    ],
    [
        ("guest", "Gibt es WLAN in der Unterkunft?"),
        ("property", "Ja, kostenfreies WLAN in allen Räumen. "
                     "Die Zugangsdaten liegen auf dem Esstisch."),
    ],
]

# Portal-Kanäle mit echtem Thread. `direct`/`portal` fehlen bewusst (s. Kopf).
PORTAL_NAMEN = {
    "booking": "Booking.com",
    "airbnb": "Airbnb",
    "vrbo": "Vrbo",
}


def _iso(zeit: datetime) -> str:
    """Zeitstempel mit Zone — `portal_messages.sent_at` ist timestamptz."""
    return zeit.astimezone(timezone.utc).isoformat()


def _buchungszeit(reservierung: dict[str, Any]) -> datetime:
    """Wann die Buchung einging — Grundlage aller Nachrichtenzeiten.

    `created_at` ist hier ausnahmsweise die richtige Quelle: der Seed SETZT das
    Feld auf den fingierten Buchungszeitpunkt (nicht die Schreibzeit), und eine
    Demo-Buchung hat kein Portal, das einen echten Wert liefern könnte.
    """
    roh = reservierung.get("created_at")
    if isinstance(roh, str):
        return datetime.fromisoformat(roh.replace("Z", "+00:00"))
    return datetime.now(timezone.utc) - timedelta(days=30)


@dataclass(frozen=True)
class _Thread:  # pylint: disable=too-many-instance-attributes
    """Die Kennungen und Zeiten EINES Threads, gebündelt.

    Als Objekt statt als sieben Einzelparameter: die Werte gehören fachlich
    zusammen (sie beschreiben denselben Thread) und werden durch zwei Ebenen
    gereicht.
    """

    reservierung: dict[str, Any]
    thread_id: str
    booking_ref: str
    ota_name: str
    property_map_id: str | None
    gebucht: datetime
    letzte_zeit: datetime
    gast_zuletzt: bool


def _thread_zeile(tenant_id: str, t: _Thread) -> dict[str, Any]:
    """Eine `channex_booking`-Zeile — der Thread, wie ihn die Liste liest."""
    res = t.reservierung
    res_id = res["id"]
    return {
        "id": t.thread_id,
        "tenant_id": tenant_id,
        "channex_booking_id": str(t.booking_ref),
        "ota_name": t.ota_name,
        "ota_reservation_code": f"{t.ota_name[:2].upper()}-{str(res_id)[:8].upper()}",
        "status": "new" if t.gast_zuletzt else "modified",
        "arrival_date": res["check_in"],
        "departure_date": res["check_out"],
        "customer": {
            "name": res.get("guest_email", "").split("@")[0],
            "mail": res.get("guest_email"),
            "phone": res.get("guest_phone"),
            "language": res.get("guest_language") or "de",
        },
        "raw": {},
        "guest_id": res.get("guest_id"),
        "property_id": res.get("property_id"),
        # Die Objektspalte der Liste kommt NICHT aus `property_id`, sondern
        # aus `channex_property_map` (`InboxService._properties_for_maps`) —
        # ohne diese Zuordnung bleibt die Spalte „Objekt" im Posteingang leer.
        "property_map_id": t.property_map_id,
        "amount_cents": int(round(float(res.get("total_amount") or 0) * 100)),
        "currency": res.get("currency"),
        # Ungelesen, wenn der Gast zuletzt schrieb: nur dann wartet jemand auf
        # Antwort. Ein Postfach, in dem alles gelesen ist, zeigt die Funktion
        # "ungelesen" nicht — und eines, in dem nichts gelesen ist, wirkt
        # verwahrlost.
        "is_read": not t.gast_zuletzt,
        "is_starred": False,
        "is_archived": False,
        "inbox_status": "active",
        # Der Buchungszeitpunkt beim Portal — die Sortierachse der Liste.
        "booked_at": _iso(t.gebucht),
        "last_message_at": _iso(t.letzte_zeit),
    }


def _verlauf_zeilen(tenant_id: str, kennung: tuple[str, str],
                    verlauf: list[tuple[str, str]], gebucht: datetime,
                    wuerfel: random.Random) -> tuple[list[dict[str, Any]], datetime]:
    """Die `portal_messages` eines Threads plus den Zeitpunkt der letzten.

    `kennung` ist (thread_id, booking_ref). Der Verlauf setzt kurz nach der
    Buchung ein und läuft über Stunden statt in einer Sekunde: sonst trügen
    alle Nachrichten denselben Zeitstempel und die Reihenfolge wäre zufällig
    (Wurzel 5b).
    """
    thread_id, booking_ref = kennung
    zeilen: list[dict[str, Any]] = []
    zeit = gebucht + timedelta(minutes=wuerfel.randint(20, 240))
    letzte = zeit
    for nummer, (sender, text) in enumerate(verlauf):
        zeilen.append({
            "id": demo_id(f"msg:{thread_id}:{nummer}"),
            "tenant_id": tenant_id,
            "thread_ref": str(thread_id),
            "booking_ref": str(booking_ref),
            "message_ref": f"demo-{thread_id}-{nummer}",
            "sender": sender,
            "body": text,
            "sent_at": _iso(zeit),
        })
        letzte = zeit
        zeit += timedelta(minutes=wuerfel.randint(25, 400))
    return zeilen, letzte


def _map_ids(db: Supabase, tenant_id: str) -> dict[str, str]:
    """property_id → channex_property_map.id für diesen Mandanten."""
    zeilen = db.select("channex_property_map", tenant_id=f"eq.{tenant_id}")
    return {z["property_id"]: z["id"] for z in zeilen if z.get("property_id")}


def threads_anlegen(db: Supabase, tenant_id: str,
                    buchungen: list[dict[str, Any]]) -> int:
    """Zu jeder Portalbuchung einen Posteingang-Thread samt Verlauf anlegen.

    Gibt die Zahl der geschriebenen Threads zurück. Idempotent über
    `demo_id`: ein zweiter Lauf trifft dieselben IDs (Wurzel 2).
    """
    wuerfel = random.Random(20260830)
    karten = _map_ids(db, tenant_id)
    threads: list[dict[str, Any]] = []
    nachrichten: list[dict[str, Any]] = []
    verknuepfungen: list[tuple[str, str]] = []

    # Nur die jüngeren Buchungen bekommen einen Thread: bei 25 Monaten
    # Historie (seed_demo.TAGE_ZURUECK) wären es sonst mehrere hundert, und
    # ein Posteingang mit Gesprächen von vor zwei Jahren ist kein Vorführbild.
    grenze = (date.today() - timedelta(days=90)).isoformat()
    for reservierung in buchungen:
        if str(reservierung.get("check_in") or "") < grenze:
            continue
        ota_name = PORTAL_NAMEN.get(reservierung.get("channel") or "")
        if not ota_name:
            continue  # kein Portal → konstruktiv kein Thread

        # Die Klammer zwischen Thread und Buchung. `booking_ref` ist eine
        # eigene UUID, weil `channex_booking_id` beim echten Aggregator dessen
        # ID ist — nicht unsere Reservierungs-ID.
        kennung = (demo_id(f"thread:{reservierung['id']}"),
                   demo_id(f"cbid:{reservierung['id']}"))
        verlauf = VERLAEUFE[wuerfel.randrange(len(VERLAEUFE))]
        zeilen, letzte_zeit = _verlauf_zeilen(
            tenant_id, kennung, verlauf, _buchungszeit(reservierung), wuerfel,
        )
        nachrichten += zeilen
        threads.append(_thread_zeile(tenant_id, _Thread(
            reservierung=reservierung,
            thread_id=kennung[0],
            booking_ref=kennung[1],
            ota_name=ota_name,
            property_map_id=karten.get(reservierung.get("property_id")),
            gebucht=_buchungszeit(reservierung),
            letzte_zeit=letzte_zeit,
            gast_zuletzt=verlauf[-1][0] == "guest",
        )))
        verknuepfungen.append((reservierung["id"], str(kennung[1])))

    if not threads:
        return 0

    db.upsert("channex_booking", threads)
    db.upsert("portal_messages", nachrichten)
    _reservierungen_verknuepfen(db, verknuepfungen)
    return len(threads)


def _reservierungen_verknuepfen(db: Supabase,
                                paare: list[tuple[str, str]]) -> None:
    """Die Rückrichtung Buchung → Thread setzen.

    Ohne sie kennt der Thread seine Buchung, aber die Buchung nicht ihren
    Thread — der Posteingang zeigt dann keinen Reservierungskopf
    (`InboxService._reservation_ids_for` liest genau dieses Feld).
    """
    for res_id, booking_ref in paare:
        db.patch("reservations", {"source_channex_booking_id": booking_ref},
                 id=f"eq.{res_id}")
