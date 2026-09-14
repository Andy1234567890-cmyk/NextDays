"""Jede Buchung bekommt eine Konversation im Posteingang — nicht nur die vom Portal.

WOZU: Die Nachrichten-Automatisierungen planen ausschliesslich ueber Threads
(`planung.replan_tenant` / `_thread_und_objekt`), und Threads liegen in
`channex_booking`. Der Tabellenname ist historisch (sie entstand fuer den
Channex-Feed), ihr Inhalt ist es nicht: sie ist der Thread-Speicher fuer JEDEN
Kanal.

Was daraus live folgte, bis es dieses Modul gab:

* Eine **Direktbuchung** (Kalender, genehmigter Sperrantrag, CSV-/PMS-Uebernahme)
  hatte keine Zeile in `channex_booking` — also keinen Thread, also keine
  einzige Automail. Der Betrieb sah die Regel „Buchungsbestaetigung, Kanal
  Direkt" in der Oberflaeche stehen und durfte annehmen, sie laufe.
* Eine **Marktplatz-Buchung** (myBestDays) bekam ihren Thread zwar
  (`booking_engine`), war aber unzustellbar: der Versand ging nur ueber Channex.
  Das ist die zweite Haelfte, die `service._per_mail_senden` loest.

EIN Weg, nicht sechs: jeder Pfad, der eine Reservierung anlegt oder aendert,
ruft `spiegeln` — die Zeile wird hier gebaut, nirgends sonst. Das ist dieselbe
Vorgabe wie bei `ReservationsService._release_nights`: ein Gegenzustand, den
jeder inline nachbaut, laeuft beim ersten Zusatz auseinander (Wurzel 1).

IDEMPOTENT (Wurzel 2): `channex_booking_id` traegt die Reservierungs-ID und ist
UNIQUE; der Upsert macht jeden Aufruf wiederholbar. Ein Retry, ein Doppelklick
und die naechste Aenderung derselben Buchung schreiben dieselbe Zeile.

GESCOPT (Wurzel 3): geladen wird die Reservierung IMMER mit `tenant_id` — der
Service-Role-Key umgeht RLS, ein Load allein per ID waere eine offene
Mandantengrenze.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.inbox")

# Welche Quelle hat den Thread angelegt? Steht in `raw.source` und ist die
# Kennung, an der der Versand den Weg waehlt (Channex oder E-Mail).
QUELLE_BOOKING_ENGINE = "booking_engine"
QUELLE_DIREKT = "direkt"
QUELLE_SPERRANTRAG = "sperrantrag"
QUELLE_UEBERNAHME = "uebernahme"

EIGENE_QUELLEN: frozenset[str] = frozenset(
    {
        QUELLE_BOOKING_ENGINE,
        QUELLE_DIREKT,
        QUELLE_SPERRANTRAG,
        QUELLE_UEBERNAHME,
    }
)
"""`raw.source`-Werte eines Threads OHNE Channex-Bezug."""

# Vertriebskanal → der Name, unter dem der Posteingang ihn fuehrt. Die drei
# eigenen Kanaele heissen hier genauso wie im Kanalmanager und in
# `calendar.channel.*` — ein vierter Name waere ein stiller Farb-Fallback auf
# einen FREMDEN Kanal.
_KANAL_NAME: dict[str, str] = {
    "direct": "Direkt",
    "website": "Website",
    "portal": "myBestDays",
}

EIGENE_KANAELE: frozenset[str] = frozenset(_KANAL_NAME.values())
"""`ota_name`-Werte, hinter denen kein Portal steht."""

# Was von der Reservierung gebraucht wird. Bewusst eine Konstante: eine hier
# fehlende Spalte kaeme nie an, und die Zeile stuende dann still ohne Gastmail
# im Posteingang — die Automail waere unzustellbar, ohne dass es auffaellt.
_RES_COLS = (
    "id, tenant_id, property_id, guest_id, channel, ota_name, status, "
    "check_in, check_out, booked_at, created_at, total_amount, currency, "
    "guest_email, guest_phone, guest_language, is_owner_stay, stay_name, "
    "source_channex_booking_id, guests(name, email, phone), owners(name)"
)


def ota_name_fuer(channel: object, ota_name: object) -> str | None:
    """Kanal der Reservierung → Kanalname des Threads.

    Die drei eigenen Kanaele tragen feste Namen (Wurzel 4: keine dritte
    Schreibweise), jeder andere Kanal behaelt den Portalnamen der Buchung; fehlt
    der, bleibt der Kanalwert selbst stehen. Nie ein erfundener Ersatzname —
    `_automation_matches` vergleicht genau darauf, und ein zweiter Name fuer
    denselben Kanal liesse jede Kanal-Regel an der Buchung vorbeilaufen.
    """
    schluessel = str(channel or "").strip().lower()
    if schluessel in _KANAL_NAME:
        return _KANAL_NAME[schluessel]
    name = str(ota_name or "").strip()
    return name or (schluessel or None)


def _status_fuer(status: object) -> str:
    """Reservierungsstatus → Thread-Status (`new|modified|cancelled`).

    Nur die Stornierung ist hier eine eigene Aussage, und sie ist die
    wichtigste: `planung._plan_thread` verweigert fuer sie jede Planung und
    `schedule_automations_for_thread` raeumt ueber `_offene_stornieren` das
    bereits Eingeplante ab (Wurzel 1). Ohne diese Abbildung begruesste die
    Anreise-Automail einen Gast, der abgesagt hat.
    """
    return "cancelled" if str(status or "") == "cancelled" else "new"


def _gastname(res: dict) -> tuple[str, str]:
    """(Vorname-Teil, Nachname) des Gastes — leer, wenn es keinen gibt.

    Der Name steht als EIN Feld in `guests.name`; der Posteingang fuehrt ihn in
    zwei (`customer.name`/`surname`, so liefern es die Portale). Getrennt wird
    am letzten Leerzeichen — das ist eine Zerlegung des vorhandenen Wertes, kein
    geratener zweiter Name: ein einteiliger Name bleibt einteilig.

    Bei einer Eigennutzung gibt es keinen Gast; dort traegt `stay_name` die
    anwesende Person, sonst der Eigentuemer (dieselbe Rangfolge wie
    `reservations._base.anzeigename`).
    """
    if res.get("is_owner_stay"):
        owner = res.get("owners") if isinstance(res.get("owners"), dict) else {}
        voll = str(res.get("stay_name") or (owner or {}).get("name") or "").strip()
    else:
        gast = res.get("guests") if isinstance(res.get("guests"), dict) else {}
        voll = str((gast or {}).get("name") or "").strip()
    if not voll:
        return "", ""
    teile = voll.rsplit(" ", 1)
    return (teile[0], teile[1]) if len(teile) == 2 else (voll, "")


def _customer(res: dict) -> dict[str, Any]:
    """Die Gastdaten des Threads.

    `language` steht NUR drin, wenn die Reservierung wirklich eine traegt:
    `service._customer_of` laesst leere Werte von der rohen Payload ueberschreiben,
    ein "" gaelte dort als gesetzt und der Gast bekaeme dauerhaft die
    Standardfassung statt seiner Sprache (Wurzel 4).
    """
    gast = res.get("guests") if isinstance(res.get("guests"), dict) else {}
    name, surname = _gastname(res)
    customer: dict[str, Any] = {
        "name": name,
        "surname": surname,
        "mail": res.get("guest_email") or (gast or {}).get("email") or "",
        "phone": res.get("guest_phone") or (gast or {}).get("phone") or "",
    }
    if res.get("guest_language"):
        customer["language"] = str(res["guest_language"])
    return customer


def _betrag_cents(res: dict) -> int | None:
    """`reservations.total_amount` (Dezimal) → die CENT-Spalte des Threads.

    Ohne Umrechnung stuende im Posteingang das Hundertfache — lieber gar kein
    Betrag als ein falscher (Wurzel 4).
    """
    betrag = res.get("total_amount")
    if betrag is None:
        return None
    try:
        return round(float(betrag) * 100)
    except (TypeError, ValueError):
        return None


def _buchungszeitpunkt(res: dict, quelle: str) -> object:
    """Der Anker „Buchung" des Threads — oder None.

    Fuer Kalender, Sperrantrag und Buchungsstrecke IST `created_at` der
    Buchungsmoment: die Buchung entsteht in diesem System. Fuer die UEBERNAHME
    (CSV/PMS) ist `created_at` dagegen unsere Importzeit (Wurzel 5b) — als
    Anker gesetzt, haette jede uebernommene Buchung fuenf Minuten nach dem
    Import eine „Buchungsbestaetigung" bekommen, auch die von vor drei Jahren:
    der Zeitpunkt waere frisch, die Nachzuegler-Regel griffe nicht. Fehlt der
    echte Wert, bleibt der Anker leer; `planung` legt `booking_new` dann als
    'anker_fehlt' still, und die datumsgebundenen Regeln laufen weiter.
    """
    if res.get("booked_at"):
        return res["booked_at"]
    if quelle == QUELLE_UEBERNAHME:
        return None
    return res.get("created_at")


def _laden(db: Client, tenant_id: str, reservation_id: str) -> dict | None:
    """Die Reservierung — gescopt auf den Mandanten (Wurzel 3)."""
    rows = (
        db.table("reservations")
        .select(_RES_COLS)
        .eq("id", reservation_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def spiegeln(
    db: Client, tenant_id: str, reservation_id: str, *, quelle: str
) -> str | None:
    """Reservierung → Thread im Posteingang + Automails planen. Gibt die Thread-ID.

    `quelle` ist einer der `QUELLE_*`-Werte und landet in `raw.source`. Er ist
    keine Zierde: der Versand liest ihn, um zwischen Channex und E-Mail zu
    waehlen (`service._per_mail_senden`).

    **OTA-Buchungen werden hier NICHT gespiegelt.** Traegt die Reservierung eine
    `source_channex_booking_id` des Aggregators, gehoert ihr Thread
    `bookings_sync` — eine zweite Zeile daneben waere eine zweite Konversation
    zur selben Buchung, und die Automails liefen doppelt (Wurzel 2). Der
    CSV-Import ist davon ausgenommen: seine Kennung beginnt mit `csv:`, hinter
    ihr steht kein Channex-Thread.

    **Eigennutzung plant keine Automails.** Die Zeile entsteht (der Betrieb soll
    die Sperre im Posteingang sehen), aber ein Eigentuemer-Aufenthalt hat keinen
    Gast: „Wir freuen uns auf Sie" an den Eigentuemer ist falsch, und ohne
    Mailadresse endete jede dieser Automails als Zustellproblem samt Glocke.
    """
    res = _laden(db, tenant_id, reservation_id)
    if res is None:
        log.warning(
            "thread_spiegel_reservierung_fehlt",
            tenant_id=tenant_id,
            reservation_id=str(reservation_id),
        )
        return None
    herkunft = str(res.get("source_channex_booking_id") or "")
    if herkunft and not herkunft.startswith("csv:"):
        return None

    zeile = {
        "tenant_id": tenant_id,
        # Der Dedup-Schluessel. Fuer eine Buchung ohne Aggregator ist die
        # eigene Reservierungs-ID die stabile Kennung.
        "channex_booking_id": str(res["id"]),
        "property_id": res.get("property_id"),
        "guest_id": res.get("guest_id"),
        "ota_name": ota_name_fuer(res.get("channel"), res.get("ota_name")),
        "status": _status_fuer(res.get("status")),
        "arrival_date": res.get("check_in"),
        "departure_date": res.get("check_out"),
        "amount_cents": _betrag_cents(res),
        "currency": res.get("currency"),
        # Wurzel 5b: der Zeitpunkt der Buchung, nicht unsere Verarbeitung.
        # `booked_at` traegt ihn (0291/0398); fehlt er, ist `created_at` bei
        # einer im Haus entstandenen Buchung derselbe Vorgang — ein fremdes
        # Ereignis gibt es hier nicht, dessen Zeitpunkt wir ersetzen wuerden.
        "booked_at": _buchungszeitpunkt(res, quelle),
        "customer": _customer(res),
        "raw": {"source": quelle},
    }
    upserted = (
        db.table("channex_booking")
        .upsert(zeile, on_conflict="channex_booking_id")
        .execute()
    ).data or []
    if not upserted:
        return None
    thread_id = str(upserted[0]["id"])
    if res.get("is_owner_stay"):
        return thread_id
    from src.features.inbox.service import InboxService  # noqa: PLC0415

    InboxService(service_client=db).schedule_automations_for_thread(
        tenant_id, thread_id
    )
    return thread_id


def spiegeln_best_effort(
    db: Client, tenant_id: str, reservation_id: str, *, quelle: str
) -> None:
    """`spiegeln`, ohne den Aufrufer kippen zu koennen.

    Der Aufrufer hat seine Buchung an dieser Stelle bereits committet; sie darf
    an einem Posteingangs-Fehler nicht mehr scheitern. Der Fehler wird trotzdem
    LAUT (`log.error`) — ein stiller Ausfall hier heisst „keine Automail", und
    genau das sieht niemand (Wurzel 5).
    """
    try:
        spiegeln(db, tenant_id, reservation_id, quelle=quelle)
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, Buchung ist committet
        log.error(
            "thread_spiegel_fehlgeschlagen",
            tenant_id=tenant_id,
            reservation_id=str(reservation_id),
            quelle=quelle,
            error=str(exc)[:200],
        )


def ist_eigener_thread(row: dict) -> bool:
    """Steht hinter diesem Thread KEIN Channex-Bezug?

    Zwei Merkmale, weil zwei Bestaende zusammenkommen: Threads aus `spiegeln`
    tragen ihre Quelle in `raw.source`; die Marktplatz-Threads von vor diesem
    Modul haben dort zwar `booking_engine` stehen, der Bestand davor aber nur
    seinen `ota_name`. Beide Wege muessen den E-Mail-Versand finden, sonst
    scheitert eine Automail an einer Channex-Buchungs-ID, die es nicht gibt.
    """
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    if str((raw or {}).get("source") or "") in EIGENE_QUELLEN:
        return True
    return str(row.get("ota_name") or "").strip() in EIGENE_KANAELE
