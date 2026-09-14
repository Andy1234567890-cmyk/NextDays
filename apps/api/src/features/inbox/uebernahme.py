"""Übernommene Nachrichtenverläufe als gleichwertige Posteingang-Threads.

WOZU: Zieht ein Betrieb von einem anderen PMS zu uns um, kommt die
Korrespondenz mit (`reservation_nachricht_uebernahme`, 0382). Sie liegt in
einer EIGENEN Tabelle — der Posteingang baut seine Threads aber aus
`channex_booking`, und dort hat eine Website-Buchung nichts zu suchen.

Ohne dieses Modul wäre der übernommene Verlauf in der Datenbank, aber für den
Betrieb unsichtbar: Er müsste die Buchung suchen, statt im Posteingang zu
blättern — genau dort, wo er jede andere Konversation liest.

WAS HIER NICHT PASSIERT — und zwar mit Absicht:
Es wird KEINE Zeile nach `channex_booking` oder `portal_messages` geschrieben.
Die übernommenen NACHRICHTEN bleiben, wo sie sind — sie werden nur GELESEN und
in die Form gebracht, die der Posteingang ohnehin spricht (dasselbe Muster wie
die WhatsApp-Threads im Frontend: eigener ID-Präfix, keine Datenwanderung).

WAS SICH 09/2026 GEÄNDERT HAT — und warum das kein Widerspruch ist:
Hier stand zusätzlich die Begründung, in `channex_booking` käme man ohnehin
nicht hinein, weil `channex_booking_id` eine erfundene Channex-ID verlangte.
Das war schon damals falsch: die Spalte ist ein Dedup-SCHLÜSSEL, keine Zusage
über die Herkunft — die eigene Reservierungs-ID ist dort die stabile Kennung
(so macht es der Marktplatz seit jeher). Aus der Fehlannahme folgte ein realer
Ausfall: eine übernommene Buchung hatte keinen Thread, und die
Nachrichten-Automatisierungen planen ausschließlich über Threads. Ein Betrieb,
der mit LAUFENDEN Buchungen zu uns umzieht, bekam für sie keine einzige
Automail — ausgerechnet in der Woche, in der er uns zum ersten Mal braucht.

Die BUCHUNG bekommt deshalb jetzt ihren Thread (`inbox.thread_spiegel`,
aufgerufen aus dem CSV-/PMS-Übernahmepfad). Der übernommene VERLAUF hier bleibt
davon unberührt: er ist ein eingefrorenes Archiv aus einem fremden System und
wandert nirgendwohin. Die befürchtete Mail-Lawine über den Altbestand
verhindert die Nachzügler-Regel (`planung._versandstatus`), nicht das Fehlen
des Threads.

READ-ONLY: Ein übernommener Verlauf ist ein eingefrorenes Archiv aus einem
fremden System. Man kann darauf nicht antworten — der Kanal, über den er lief,
gehört uns nicht mehr. Der Sende-Pfad lehnt diese Threads deshalb ab, statt so
zu tun, als ginge eine Antwort raus (Wurzel 5).
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger

from .errors import InboxError
from .schemas import InboxMessage, InboxMessagesResponse, InboxThread

log = get_logger(__name__)

_TABELLE = "reservation_nachricht_uebernahme"

# Stabiler ID-Präfix, damit ein übernommener Thread von einem OTA-Thread
# unterscheidbar ist — sowohl im Router (welcher Lesepfad?) als auch in der
# Oberfläche (Antworten ausblenden). Gleiches Prinzip wie `wa:` bei WhatsApp.
PREFIX = "ue:"

# Wurzel 8: harte Obergrenze. Ein übernommener Bestand kann Tausende
# Nachrichten haben; die Liste holt nie mehr als das.
MAX_THREADS = 200
MAX_NACHRICHTEN = 500

# Richtung in der Quelle → Absender-Begriff des Posteingangs.
_SENDER = {"gast": "guest", "gastgeber": "property"}


def ist_uebernahme(thread_id: str) -> bool:
    return thread_id.startswith(PREFIX)


def reservation_aus_id(thread_id: str) -> str:
    """`ue:<reservation_id>` → reservation_id."""
    return thread_id[len(PREFIX) :]


def _vorschau(text: str) -> str:
    """Erste sinnvolle Zeile als Listen-Vorschau."""
    for zeile in (text or "").splitlines():
        if zeile.strip():
            return zeile.strip()[:200]
    return ""


def threads_lesen(db: Client, tenant_id: str) -> list[InboxThread]:
    """Übernommene Verläufe als Posteingang-Threads — einer je Buchung.

    Der Aufrufer entscheidet, OB gelesen wird: nur bei scope="all"
    (`InboxService.list_threads`). Ein übernommener Verlauf kennt keine
    Zuweisung, mit der ein „assigned"-Scope arbeiten könnte.
    """
    try:
        zeilen = (
            db.table(_TABELLE)
            .select(
                # EIN Join auf reservations — PostgREST lehnt denselben
                # Tabellennamen zweimal ab (42712); Objekt und Gast hängen
                # beide darunter.
                "reservation_id, kanal, herkunft, richtung, betreff, text, "
                "gesendet_at, "
                "reservations!inner(id, property_id, check_in, check_out, "
                "guest_id, channel, guests(name, email, phone), "
                "properties(title))"
            )
            .eq("tenant_id", tenant_id)
            .order("gesendet_at", desc=True)
            .limit(MAX_NACHRICHTEN)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — der Posteingang darf nicht kippen
        # Wurzel 5: nicht stumm. Fällt diese Quelle aus, fehlen Threads in der
        # Liste — das muss im Log stehen, sonst sucht später jemand den Fehler
        # in der Übernahme statt hier.
        log.warning("inbox_uebernahme_lesen_fehlgeschlagen", error=str(exc)[:200])
        return []

    je_buchung: dict[str, list[dict]] = {}
    for z in zeilen:
        rid = str(z.get("reservation_id") or "")
        if not rid:
            continue
        je_buchung.setdefault(rid, []).append(z)

    threads: list[InboxThread] = []
    for rid, gruppe in je_buchung.items():
        res = gruppe[0].get("reservations") or {}
        gast = (res.get("guests") or {}) if isinstance(res.get("guests"), dict) else {}
        prop = (res.get("properties") or {}) if isinstance(res.get("properties"), dict) else {}
        # Jüngste zuerst (die Abfrage sortiert bereits absteigend).
        neueste = gruppe[0]
        threads.append(
            InboxThread(
                id=f"{PREFIX}{rid}",
                # KEINE erfundene Channex-ID: dieser Thread lief nie über Channex.
                channex_booking_id=None,
                reservation_id=rid,
                guest_id=str(res.get("guest_id")) if res.get("guest_id") else None,
                property_id=str(res.get("property_id")) if res.get("property_id") else None,
                property_title=prop.get("title"),
                # Der Kanal der Buchung, aus der Übernahme mitgeführt.
                ota_name=str(neueste.get("kanal") or "").capitalize() or None,
                guest_name=gast.get("name"),
                guest_email=gast.get("email"),
                guest_phone=gast.get("phone"),
                arrival_date=res.get("check_in"),
                departure_date=res.get("check_out"),
                last_message=_vorschau(str(neueste.get("text") or "")),
                last_sender=_SENDER.get(str(neueste.get("richtung") or "")),
                # Wurzel 5b: der Zeitpunkt der letzten Nachricht kommt aus der
                # QUELLE. Ist er leer, bleibt das Feld leer — nie unsere Uhr.
                letzte_aktivitaet=neueste.get("gesendet_at"),
                # Ein Archiv hat nichts Ungelesenes: es ist abgeschlossen.
                is_read=True,
            )
        )
    threads.sort(key=lambda t: t.letzte_aktivitaet or "", reverse=True)
    return threads[:MAX_THREADS]


def verlauf_antwort(
    db: Client, tenant_id: str, thread_id: str, *, scope: str
) -> InboxMessagesResponse:
    """Den Verlauf eines übernommenen Threads als Antwort des Posteingangs.

    `scope` ist der Inbox-Scope des Aufrufers. Wurzel 9: derselbe Scope wie in
    der Liste — wer den Thread dort nicht sieht, darf ihn auch nicht per ID
    öffnen. 404 statt 403, damit die ID nicht bestätigt wird.
    """
    if scope != "all":
        raise InboxError("Thread nicht gefunden.", status_code=404)
    items = nachrichten_lesen(db, tenant_id, reservation_aus_id(thread_id))
    if not items:
        raise InboxError("Thread nicht gefunden.", status_code=404)
    return InboxMessagesResponse(items=items, total=len(items))


def nachrichten_lesen(
    db: Client, tenant_id: str, reservation_id: str
) -> list[InboxMessage]:
    """Der Verlauf EINER übernommenen Buchung, älteste zuerst."""
    zeilen = (
        db.table(_TABELLE)
        .select("richtung, betreff, text, gesendet_at, anhaenge_anzahl, herkunft")
        .eq("tenant_id", tenant_id)
        .eq("reservation_id", reservation_id)
        .order("gesendet_at")
        .limit(MAX_NACHRICHTEN)
        .execute()
    ).data or []

    items: list[InboxMessage] = []
    for z in zeilen:
        text = str(z.get("text") or "")
        betreff = (z.get("betreff") or "").strip()
        anzahl = int(z.get("anhaenge_anzahl") or 0)
        if anzahl:
            # Die Dateien selbst wurden nicht übernommen (die Quelle liefert nur
            # kurzlebige signierte Links). Das SAGEN, statt es zu verschweigen —
            # sonst wirkt der Verlauf vollständig, obwohl etwas fehlt.
            text = f"{text}\n\n[{anzahl} Anhang/Anhänge im Ursprungssystem]"
        items.append(
            InboxMessage(
                message=f"{betreff}\n\n{text}" if betreff else text,
                sender=_SENDER.get(str(z.get("richtung") or ""), "property"),
                sent_at=z.get("gesendet_at"),
            )
        )
    return items
