"""Support-Tickets aus Sicht des MELDERS.

Zwei getrennte Zugänge auf dieselben Tabellen:
  • dieser Slice  — der Melder (Betriebs-Nutzer ODER Plattform-Gast)
  • platform_admin — das Betreiber-Team

Zwei Regeln, die hier immer gelten und den Unterschied ausmachen:

1. SCOPE: Ein Melder sieht ausschließlich seine EIGENEN Tickets. Der Filter
   läuft über reporter_user_id bzw. reporter_guest_id — nie über eine vom
   Client mitgeschickte ID (Wurzel 3/9).
2. INTERNE NOTIZEN: support_messages.internal = true ist eine Team-Notiz und
   wird hier IMMER herausgefiltert. Das ist der sensibelste Punkt des Slice —
   eine vergessene Filterung würde interne Einschätzungen an den Melder
   ausliefern.
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger

from .schemas import (
    Ticket,
    TicketCreate,
    TicketDetail,
    TicketList,
    TicketMessage,
)

log = get_logger("nextdays.support")

# Harte Obergrenze je Abfrage (Wurzel 8).
_MAX_LIMIT = 100

# Spalten, die der Melder sehen darf. Bewusst OHNE assignee_user_id und
# reporter_*: wer intern zuständig ist, geht den Melder nichts an.
_TICKET_COLUMNS = (
    "id, subject, category, status, priority, created_at, last_message_at"
)

# Priorität je Thema. Sie wird SERVERSEITIG abgeleitet und ist bewusst KEIN
# Eingabefeld des Melders — Branchenstandard (Zendesk blendet das Feld vor
# Endkunden aus, ServiceNow setzt es schreibgeschützt und berechnet es). Ein
# frei wählbares Feld führt zur Prioritäts-Inflation: wer sein Anliegen schnell
# gelöst haben will, wählt immer die höchste Stufe, und die Skala wird wertlos.
# Zugleich ist es Wurzel 3: ein Feld, das Ressourcenzuteilung steuert, darf
# nicht vom Client kommen.
_PRIO_JE_THEMA = {
    # Geld und laufende Aufenthalte sind zeitkritisch.
    "zahlung": "high",
    "buchung": "high",
    # Objekt-/Kontofragen sind wichtig, aber selten akut.
    "objekt": "normal",
    "konto": "normal",
    "technik": "normal",
    "sonstiges": "low",
}
_PRIO_STANDARD = "normal"


def _prioritaet_fuer(kategorie: str | None) -> str:
    """Priorität aus dem gewählten Thema ableiten (nie aus dem Request)."""
    if not kategorie:
        return _PRIO_STANDARD
    return _PRIO_JE_THEMA.get(kategorie.strip().lower(), _PRIO_STANDARD)


# Interner Status → das, was der MELDER sieht. Branchenstandard: Zendesk,
# Freshdesk, HubSpot und Intercom trennen alle zwischen Agenten- und
# Kundensicht. Der Grund ist inhaltlich: „waiting" heißt intern „wir warten auf
# den Melder" — aus dessen Sicht ist die richtige Aussage „du bist dran". Und
# „resolved" vs. „closed" ist eine interne Unterscheidung, die für den Melder
# keinen Unterschied macht.
_MELDER_STATUS = {
    "open": "in_bearbeitung",
    "waiting": "wartet_auf_dich",
    "resolved": "geloest",
    "closed": "geloest",
}


def _melder_status(intern: str | None) -> str:
    """Internen Status in die Melder-Sicht übersetzen (fail-safe)."""
    return _MELDER_STATUS.get(intern or "", "in_bearbeitung")


class SupportError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class SupportService:
    def __init__(self, db: Client) -> None:
        self._db = db

    def create(
        self,
        req: TicketCreate,
        *,
        user_id: str | None = None,
        guest_id: str | None = None,
        tenant_id: str | None = None,
    ) -> TicketDetail:
        """Ein Ticket eröffnen. Genau EINE Melder-Identität ist erlaubt.

        Der DB-Check support_tickets_genau_ein_melder erzwingt dasselbe — hier
        wird es zusätzlich früh und mit klarer Meldung abgefangen.
        """
        if bool(user_id) == bool(guest_id):
            raise SupportError(
                "Ticket braucht genau eine Melder-Identität.", status_code=400
            )

        jetzt = datetime.now(UTC).isoformat()
        res = (
            self._db.table("support_tickets")
            .insert(
                {
                    "reporter_user_id": user_id,
                    "reporter_guest_id": guest_id,
                    "tenant_id": tenant_id,
                    "subject": req.subject,
                    "category": req.category,
                    # Serverseitig abgeleitet — der Melder kann sie nicht setzen.
                    "priority": _prioritaet_fuer(req.category),
                    "reservation_id": req.reservation_id,
                    "property_id": req.property_id,
                    "last_message_at": jetzt,
                }
            )
            .execute()
        ).data
        if not res:
            raise SupportError("Ticket konnte nicht angelegt werden.", status_code=502)
        ticket = res[0]

        # Der Eröffnungstext ist die erste Nachricht — nie intern.
        self._db.table("support_messages").insert(
            {
                "ticket_id": ticket["id"],
                "author_kind": "reporter",
                "author_user_id": user_id,
                "body": req.body,
                "internal": False,
            }
        ).execute()

        log.info(
            "support_ticket_created",
            ticket_id=ticket["id"],
            tenant_id=tenant_id,
            von_gast=bool(guest_id),
        )
        return self.detail(
            ticket["id"], user_id=user_id, guest_id=guest_id
        )  # type: ignore[return-value]

    def list(
        self,
        *,
        user_id: str | None = None,
        guest_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> TicketList:
        """Die eigenen Tickets des Melders, zuletzt aktive zuerst."""
        limit = max(1, min(_MAX_LIMIT, limit))
        offset = max(0, offset)

        query = (
            self._db.table("support_tickets")
            .select(_TICKET_COLUMNS, count="exact")
            .order("last_message_at", desc=True)
        )
        query = self._scope(query, user_id=user_id, guest_id=guest_id)
        res = query.range(offset, offset + limit - 1).execute()
        return TicketList(
            items=[
                Ticket(**{**r, "status": _melder_status(r.get("status"))})
                for r in (res.data or [])
            ],
            total=res.count or 0,
        )

    def detail(
        self,
        ticket_id: str,
        *,
        user_id: str | None = None,
        guest_id: str | None = None,
    ) -> TicketDetail | None:
        """Ein eigenes Ticket mit sichtbarem Verlauf. None = fremd/unbekannt.

        Der Scope wird auf dem Ticket erzwungen (Wurzel 9: derselbe Filter wie
        in der Liste) — ein fremdes Ticket ist von einem nicht existierenden
        nicht unterscheidbar.
        """
        query = self._db.table("support_tickets").select(_TICKET_COLUMNS).eq(
            "id", ticket_id
        )
        query = self._scope(query, user_id=user_id, guest_id=guest_id)
        rows = query.limit(1).execute().data or []
        if not rows:
            return None

        # INTERNE NOTIZEN AUSSCHLIESSEN — der Kern dieses Slice.
        msgs = (
            self._db.table("support_messages")
            .select("id, author_kind, body, created_at")
            .eq("ticket_id", ticket_id)
            .eq("internal", False)
            .order("created_at", desc=False)
            .execute()
        ).data or []

        return TicketDetail(
            **{**rows[0], "status": _melder_status(rows[0].get("status"))},
            messages=[TicketMessage(**m) for m in msgs],
        )

    def reply(
        self,
        ticket_id: str,
        body: str,
        *,
        user_id: str | None = None,
        guest_id: str | None = None,
    ) -> TicketMessage | None:
        """Auf das EIGENE Ticket antworten. None = fremd/unbekannt.

        Eine Antwort des Melders öffnet ein gelöstes Ticket wieder — sonst ginge
        eine Rückfrage nach dem Schließen unter.
        """
        eigenes = self.detail(ticket_id, user_id=user_id, guest_id=guest_id)
        if eigenes is None:
            return None

        jetzt = datetime.now(UTC).isoformat()
        res = (
            self._db.table("support_messages")
            .insert(
                {
                    "ticket_id": ticket_id,
                    "author_kind": "reporter",
                    "author_user_id": user_id,
                    "body": body,
                    "internal": False,
                }
            )
            .execute()
        ).data
        felder: dict[str, str] = {"last_message_at": jetzt, "updated_at": jetzt}
        # ACHTUNG: eigenes.status ist bereits die MELDER-Sicht (übersetzt) —
        # 'resolved' und 'closed' erscheinen dort beide als 'geloest'. Deshalb
        # hier gegen den übersetzten Wert prüfen, nicht gegen den internen.
        if eigenes.status == "geloest":
            felder["status"] = "open"
        self._db.table("support_tickets").update(felder).eq(
            "id", ticket_id
        ).execute()
        return TicketMessage(**res[0])

    @staticmethod
    def _scope(query, *, user_id: str | None, guest_id: str | None):  # noqa: ANN001, ANN205
        """Auf die Melder-Identität einschränken (fail-closed).

        Ohne Identität würde die Abfrage sonst ALLE Tickets liefern — daher
        wird ein solcher Aufruf hart abgelehnt statt still zu öffnen.
        """
        if user_id:
            return query.eq("reporter_user_id", user_id)
        if guest_id:
            return query.eq("reporter_guest_id", guest_id)
        raise SupportError("Keine Melder-Identität.", status_code=401)
