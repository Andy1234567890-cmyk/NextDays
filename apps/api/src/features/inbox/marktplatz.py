"""myBestDays-Marktplatz-Konversationen als gleichwertige Posteingang-Threads.

WOZU: myBestDays ist ein Buchungskanal wie Booking.com oder Airbnb — nur einer,
den wir selbst betreiben. Seine Gast-Konversationen liegen aber in einer eigenen
Tabelle (`guest_message_threads`/`guest_messages`, 0181/0196) und wurden bisher
NUR in der separaten Gastgeber-App (`gastgeber/`) angezeigt. Im Posteingang des
PMS, wo der Betrieb jede andere Konversation liest, fehlten sie vollständig.

Für den Betrieb ist der Posteingang EIN Posteingang: er fragt „was hat der Gast
geschrieben", nicht „über welches System kam das". Musste er bisher zwei
getrennte Oberflächen prüfen, war jede Antwort auf die erste Frage unvollständig
— und beim nächsten angebundenen Kanal wäre es eine dritte geworden.

WAS HIER NICHT PASSIERT — mit Absicht (gleiches Prinzip wie `uebernahme.py`):
Es wird KEINE Zeile nach `channex_booking` oder `portal_messages` geschrieben.
`channex_booking.channex_booking_id` ist NOT NULL + unique; dort hineinzukommen
hieße, eine Channex-ID für eine Konversation zu erfinden, die nie über Channex
lief (Wurzel 4). Die Daten bleiben, wo sie sind — sie werden GELESEN und in die
Form gebracht, die der Posteingang ohnehin spricht.

ZEITSTEMPEL (Wurzel 5b): `last_message_at` ist hier ausnahmsweise KEINE fremde
Uhr, die wir uns anmaßen — myBestDays läuft bei uns, die Nachricht entsteht in
unserer Datenbank in dem Moment, in dem der Gast sie absendet. Anders als bei
einem OTA-Feed (wo `created_at` nur unseren Abrufzeitpunkt beschreibt) ist der
Wert also der echte Ereigniszeitpunkt und darf sortieren.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger

from .errors import InboxError
from .schemas import InboxMessage, InboxMessagesResponse, InboxThread

log = get_logger(__name__)

# Stabiler ID-Präfix, damit ein Marktplatz-Thread von einem OTA-Thread
# unterscheidbar bleibt — im Router (welcher Lesepfad?) wie in der Oberfläche.
# Gleiches Prinzip wie `ue:` (Übernahme) und `wa:` (WhatsApp).
PREFIX = "mb:"

# Der Kanalname, unter dem der Marktplatz überall auftritt (Buchungen tragen
# `ota_name='myBestDays'`, 0239). Hier NICHT neu erfinden — sonst steht in der
# Liste ein zweiter Name für denselben Kanal.
KANAL = "myBestDays"

# Wurzel 8: harte Obergrenzen, wie in `uebernahme.py`.
MAX_THREADS = 200
MAX_NACHRICHTEN = 500

# Absender in der Quelle → Absender-Begriff des Posteingangs.
_SENDER = {"guest": "guest", "host": "property"}


def ist_marktplatz(thread_id: str) -> bool:
    return thread_id.startswith(PREFIX)


def thread_aus_id(thread_id: str) -> str:
    """`mb:<thread_id>` → thread_id der Quelle."""
    return thread_id[len(PREFIX) :]


def _vorschau(text: str) -> str:
    """Erste sinnvolle Zeile als Listen-Vorschau."""
    for zeile in (text or "").splitlines():
        if zeile.strip():
            return zeile.strip()[:200]
    return ""


def _letzte_nachrichten(db: Client, thread_ids: list[str]) -> dict[str, dict]:
    """Je Thread die jüngste Nachricht (Vorschau + Absender).

    Eine Abfrage über alle Threads statt einer je Thread: bei 200 Threads wären
    das sonst 200 Roundtrips für eine Listenansicht.
    """
    if not thread_ids:
        return {}
    zeilen = (
        db.table("guest_messages")
        .select("thread_id, body, sender, created_at")
        .in_("thread_id", thread_ids)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    neueste: dict[str, dict] = {}
    for z in zeilen:
        tid = str(z.get("thread_id") or "")
        # Absteigend sortiert → der erste Treffer je Thread ist der jüngste.
        if tid and tid not in neueste:
            neueste[tid] = z
    return neueste


def _ungelesen(zeilen: list[dict], neueste: dict[str, dict]) -> set[str]:
    """Threads mit einer Gast-Nachricht neuer als `host_read_at`.

    Bewusst aus den bereits geladenen Daten gerechnet statt per Zusatzabfrage:
    beide Werte liegen vor, und eine weitere Runde je Thread wäre reine Last.
    """
    offen: set[str] = set()
    for z in zeilen:
        tid = str(z["id"])
        letzte = neueste.get(tid)
        if not letzte or letzte.get("sender") != "guest":
            continue
        gelesen = z.get("host_read_at")
        if not gelesen or str(letzte.get("created_at") or "") > str(gelesen):
            offen.add(tid)
    return offen


def verlauf_antwort(
    db: Client, tenant_id: str, thread_id: str
) -> InboxMessagesResponse:
    """Nachrichtenverlauf EINES Marktplatz-Threads, chronologisch.

    Der Thread wird per (id, tenant_id) geladen — Load und Scope bleiben
    zusammen (Wurzel 3). Fremder oder unbekannter Thread → 404 mit derselben
    Meldung, damit ein fremder Tenant keine Existenz erfährt.
    """
    quell_id = thread_aus_id(thread_id)
    treffer = (
        db.table("guest_message_threads")
        .select("id")
        .eq("id", quell_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    if not treffer:
        raise InboxError("Thread nicht gefunden.", status_code=404)

    zeilen = (
        db.table("guest_messages")
        .select("id, body, sender, created_at")
        .eq("thread_id", quell_id)
        .order("created_at")
        .limit(MAX_NACHRICHTEN)
        .execute()
    ).data or []
    nachrichten = [
        InboxMessage(
            id=str(z.get("id")) if z.get("id") else None,
            message=str(z.get("body") or ""),
            sender=_SENDER.get(str(z.get("sender") or "")) or "guest",
            # Der Marktplatz läuft bei uns: `created_at` IST der Zeitpunkt des
            # Ereignisses, nicht bloß unser Eingang (siehe Modul-Kopf).
            sent_at=str(z.get("created_at") or "") or None,
        )
        for z in zeilen
    ]
    return InboxMessagesResponse(items=nachrichten, total=len(nachrichten))


def threads_lesen(db: Client, tenant_id: str) -> list[InboxThread]:
    """Marktplatz-Konversationen als Posteingang-Threads.

    Der Aufrufer entscheidet, OB gelesen wird (Rollen-Scope). Ein
    Marktplatz-Thread kennt keine Zuweisung, mit der ein „assigned"-Scope
    arbeiten könnte — wie beim übernommenen Verlauf.
    """
    try:
        zeilen = (
            db.table("guest_message_threads")
            .select(
                "id, portal_guest_id, property_id, reservation_id, "
                "last_message_at, host_read_at, host_archived, created_at, "
                "portal_guests(name, email, phone), "
                "properties(title), "
                "reservations(check_in, check_out, guest_id)"
            )
            .eq("tenant_id", tenant_id)
            .order("last_message_at", desc=True)
            .order("created_at", desc=True)
            .limit(MAX_THREADS)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — der Posteingang darf nicht kippen
        # Wurzel 5: nicht stumm. Fällt diese Quelle aus, fehlen Threads in der
        # Liste — das muss im Log stehen, sonst sucht später jemand den Fehler
        # im Marktplatz statt hier.
        log.warning("inbox_marktplatz_lesen_fehlgeschlagen", error=str(exc)[:200])
        return []

    if not zeilen:
        return []

    neueste = _letzte_nachrichten(db, [str(z["id"]) for z in zeilen])
    offen = _ungelesen(zeilen, neueste)

    threads: list[InboxThread] = []
    for z in zeilen:
        tid = str(z["id"])
        gast = z.get("portal_guests") if isinstance(z.get("portal_guests"), dict) else {}
        prop = z.get("properties") if isinstance(z.get("properties"), dict) else {}
        res = z.get("reservations") if isinstance(z.get("reservations"), dict) else {}
        letzte = neueste.get(tid, {})
        threads.append(
            InboxThread(
                id=f"{PREFIX}{tid}",
                # KEINE erfundene Channex-ID: dieser Thread lief nie über Channex.
                channex_booking_id=None,
                reservation_id=(
                    str(z["reservation_id"]) if z.get("reservation_id") else None
                ),
                guest_id=str(res.get("guest_id")) if res.get("guest_id") else None,
                property_id=str(z["property_id"]) if z.get("property_id") else None,
                property_title=(prop or {}).get("title"),
                ota_name=KANAL,
                guest_name=(gast or {}).get("name"),
                guest_email=(gast or {}).get("email"),
                guest_phone=(gast or {}).get("phone"),
                arrival_date=(res or {}).get("check_in"),
                departure_date=(res or {}).get("check_out"),
                last_message=_vorschau(str(letzte.get("body") or "")),
                last_sender=_SENDER.get(str(letzte.get("sender") or "")),
                # Echter Ereigniszeitpunkt (siehe Modul-Kopf): der Marktplatz
                # läuft bei uns, die Nachricht entsteht hier.
                letzte_aktivitaet=z.get("last_message_at"),
                updated_at=z.get("last_message_at"),
                is_read=tid not in offen,
                is_archived=bool(z.get("host_archived")),
                inbox_status="archived" if z.get("host_archived") else "active",
            )
        )
    return threads
