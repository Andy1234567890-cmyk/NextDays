"""Support-Konversationen aus Sicht des MELDERS (Formular-Anfrage UND Chat).

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
   ausliefern. Das gilt auch für die abgeleitete Vorschau
   (last_message_preview): sie wird nur aus SICHTBAREN Nachrichten gesetzt.
"""
from __future__ import annotations

import hashlib
import secrets as pysecrets
from datetime import UTC, datetime

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import secrets_match

from .schemas import (
    ChatStart,
    PublicChatStart,
    PublicTicket,
    Ticket,
    TicketCreate,
    TicketDetail,
    TicketList,
    TicketMessage,
    UnreadSummary,
)

log = get_logger("nextdays.support")

# Harte Obergrenze je Abfrage (Wurzel 8).
_MAX_LIMIT = 100

# Wie viele Nachrichten für die Ungelesen-Zählung höchstens betrachtet werden.
# Die Zahl steht im Badge — eine exakte Zählung über Jahre alter Verläufe wäre
# teuer und für die Anzeige belanglos (Wurzel 8: jeder Bereich bekommt ein Dach).
_UNREAD_SCAN = 500

# Länge der Vorschau in Liste und Widget.
_PREVIEW_LEN = 160

# Länge des aus der ersten Chat-Nachricht abgeleiteten Betreffs.
_SUBJECT_LEN = 80

# Wie viele Nachrichten das Website-Widget je Abruf höchstens bekommt. Eine
# Verkaufs-Konversation ist kurz; die Grenze verhindert, dass ein sehr langer
# Verlauf den unauthentifizierten Endpunkt teuer macht (Wurzel 8).
_PUBLIC_MSG_LIMIT = 200

# Spalten, die der Melder sehen darf. Bewusst OHNE assignee_user_id und
# reporter_*: wer intern zuständig ist, geht den Melder nichts an.
# reporter_last_read_at ist sein EIGENER Lese-Cursor und wird nur intern für die
# Ungelesen-Zählung gebraucht (vor der Ausgabe entfernt).
_TICKET_COLUMNS = (
    "id, subject, category, status, priority, created_at, last_message_at, "
    "source, last_message_preview, last_message_kind, agent_last_read_at, "
    "reporter_last_read_at, rating"
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


def _vorschau(text: str) -> str:
    """Einzeilige Vorschau der letzten Nachricht (für Liste und Badge)."""
    flach = " ".join(text.split())
    if len(flach) <= _PREVIEW_LEN:
        return flach
    return flach[: _PREVIEW_LEN - 1].rstrip() + "…"


def _token_hash(token: str) -> str:
    """SHA-256 (hex) eines Besucher-Tokens. In der DB liegt nur dieser Wert."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _betreff_aus_nachricht(text: str) -> str:
    """Betreff einer Chat-Konversation aus der ersten Nachricht ableiten.

    Ein Chat hat keinen Betreff — die Agenten-Liste braucht aber eine
    Überschrift. Intercom erzeugt sie inzwischen per KI; hier reicht der Anfang
    der ersten Nachricht, weil daneben ohnehin die Vorschau steht.
    """
    flach = " ".join(text.split())
    if not flach:
        # Kann nicht passieren (min_length=1), aber ein leerer Betreff würde
        # gegen NOT NULL laufen — lieber ein sprechender Ersatz als ein 500.
        return "Chat"
    if len(flach) <= _SUBJECT_LEN:
        return flach
    return flach[: _SUBJECT_LEN - 1].rstrip() + "…"


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
        """Ein Ticket über das Formular eröffnen (Betreff + Text)."""
        return self._eroeffnen(
            subject=req.subject,
            body=req.body,
            category=req.category,
            source="form",
            reservation_id=req.reservation_id,
            property_id=req.property_id,
            client_msg_id=None,
            user_id=user_id,
            guest_id=guest_id,
            tenant_id=tenant_id,
        )

    def start_chat(
        self,
        req: ChatStart,
        *,
        user_id: str | None = None,
        guest_id: str | None = None,
        tenant_id: str | None = None,
    ) -> TicketDetail:
        """Eine Chat-Konversation eröffnen (nur Text, Betreff abgeleitet).

        Idempotent über client_msg_id (Wurzel 2): schickt der Client dieselbe
        Eröffnung zweimal (Doppelklick, Retry nach Timeout), wird die bereits
        angelegte Konversation zurückgegeben statt einer zweiten.
        """
        if req.client_msg_id:
            vorhanden = self._chat_zu_client_id(
                req.client_msg_id, user_id=user_id, guest_id=guest_id
            )
            if vorhanden is not None:
                return vorhanden
        return self._eroeffnen(
            subject=_betreff_aus_nachricht(req.body),
            body=req.body,
            category=req.category,
            source="chat",
            reservation_id=None,
            property_id=None,
            client_msg_id=req.client_msg_id,
            user_id=user_id,
            guest_id=guest_id,
            tenant_id=tenant_id,
        )

    def _eroeffnen(  # noqa: PLR0913 — ein Ticket hat nun einmal viele Felder
        self,
        *,
        subject: str,
        body: str,
        category: str | None,
        source: str,
        reservation_id: str | None,
        property_id: str | None,
        client_msg_id: str | None,
        user_id: str | None,
        guest_id: str | None,
        tenant_id: str | None,
    ) -> TicketDetail:
        """Gemeinsamer Eröffnungspfad für Formular und Chat.

        Der DB-Check support_tickets_genau_ein_melder erzwingt dieselbe Regel —
        hier wird sie zusätzlich früh und mit klarer Meldung abgefangen.
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
                    "subject": subject,
                    "category": category,
                    # Serverseitig abgeleitet — der Melder kann sie nicht setzen.
                    "priority": _prioritaet_fuer(category),
                    "source": source,
                    "reservation_id": reservation_id,
                    "property_id": property_id,
                    "last_message_at": jetzt,
                    "last_message_preview": _vorschau(body),
                    "last_message_kind": "reporter",
                    # Der Melder hat seine eigene Nachricht selbstverständlich
                    # gelesen — sonst zeigte das Widget sofort „1 ungelesen".
                    "reporter_last_read_at": jetzt,
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
                "body": body,
                "internal": False,
                "client_msg_id": client_msg_id,
            }
        ).execute()

        log.info(
            "support_ticket_created",
            ticket_id=ticket["id"],
            tenant_id=tenant_id,
            quelle=source,
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
        rows = res.data or []
        ungelesen = self._ungelesen_je_ticket(rows)
        return TicketList(
            items=[self._ticket(r, ungelesen) for r in rows],
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
        rows = self._eigene_zeile(ticket_id, user_id=user_id, guest_id=guest_id)
        if rows is None:
            return None

        # INTERNE NOTIZEN AUSSCHLIESSEN — der Kern dieses Slice.
        msgs = (
            self._db.table("support_messages")
            .select("id, author_kind, body, created_at, client_msg_id")
            .eq("ticket_id", ticket_id)
            .eq("internal", False)
            .order("created_at", desc=False)
            .limit(_UNREAD_SCAN)
            .execute()
        ).data or []

        basis = self._ticket(rows, self._ungelesen_je_ticket([rows]))
        return TicketDetail(
            **basis.model_dump(),
            messages=[TicketMessage(**m) for m in msgs],
        )

    def reply(
        self,
        ticket_id: str,
        body: str,
        *,
        user_id: str | None = None,
        guest_id: str | None = None,
        client_msg_id: str | None = None,
    ) -> TicketMessage | None:
        """Auf das EIGENE Ticket antworten. None = fremd/unbekannt.

        Eine Antwort des Melders öffnet ein gelöstes Ticket wieder — sonst ginge
        eine Rückfrage nach dem Schließen unter.

        Idempotent (Wurzel 2): derselbe client_msg_id wird nicht zweimal
        eingefügt. Der partielle UNIQUE-Index (0236) ist der Backstop; die
        23505-Verletzung eines Retrys ist der ERFOLGSPFAD, nicht ein Fehler —
        es wird die bereits gespeicherte Zeile zurückgegeben.
        """
        zeile = self._eigene_zeile(ticket_id, user_id=user_id, guest_id=guest_id)
        if zeile is None:
            return None

        try:
            res = (
                self._db.table("support_messages")
                .insert(
                    {
                        "ticket_id": ticket_id,
                        "author_kind": "reporter",
                        "author_user_id": user_id,
                        "body": body,
                        "internal": False,
                        "client_msg_id": client_msg_id,
                    }
                )
                .execute()
            ).data
        except APIError as exc:
            if getattr(exc, "code", None) != "23505" or not client_msg_id:
                raise
            bestehend = self._nachricht_zu_client_id(ticket_id, client_msg_id)
            if bestehend is None:
                raise
            return bestehend

        jetzt = datetime.now(UTC).isoformat()
        felder: dict[str, str] = {
            "last_message_at": jetzt,
            "updated_at": jetzt,
            "last_message_preview": _vorschau(body),
            "last_message_kind": "reporter",
            # Wer selbst schreibt, hat den Verlauf offen — Cursor mitziehen.
            "reporter_last_read_at": jetzt,
        }
        # ACHTUNG: der Status in der Zeile ist der INTERNE Wert.
        if (zeile.get("status") or "") in ("resolved", "closed"):
            felder["status"] = "open"
        self._db.table("support_tickets").update(felder).eq(
            "id", ticket_id
        ).execute()
        return TicketMessage(**res[0])

    def mark_read(
        self,
        ticket_id: str,
        *,
        user_id: str | None = None,
        guest_id: str | None = None,
    ) -> bool:
        """Lese-Cursor des Melders auf jetzt setzen. False = fremd/unbekannt."""
        if self._eigene_zeile(ticket_id, user_id=user_id, guest_id=guest_id) is None:
            return False
        self._db.table("support_tickets").update(
            {"reporter_last_read_at": datetime.now(UTC).isoformat()}
        ).eq("id", ticket_id).execute()
        return True

    def rate(
        self,
        ticket_id: str,
        *,
        rating: int,
        comment: str | None,
        user_id: str | None = None,
        guest_id: str | None = None,
    ) -> bool:
        """Abgeschlossene Konversation bewerten. False = fremd/unbekannt.

        Bewertet wird nur, was abgeschlossen ist (Intercom fragt beim Schließen)
        — eine Note auf einen laufenden Vorgang misst nichts.
        """
        zeile = self._eigene_zeile(ticket_id, user_id=user_id, guest_id=guest_id)
        if zeile is None:
            return False
        if (zeile.get("status") or "") not in ("resolved", "closed"):
            raise SupportError(
                "Bewertung erst nach Abschluss der Konversation möglich.",
                status_code=409,
            )
        self._db.table("support_tickets").update(
            {
                "rating": rating,
                "rating_comment": comment,
                "rated_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", ticket_id).execute()
        return True

    def unread(
        self, *, user_id: str | None = None, guest_id: str | None = None
    ) -> UnreadSummary:
        """Ungelesene Team-Antworten über alle eigenen Konversationen.

        Gezählt werden Konversationen (Badge-Zahl) UND Nachrichten. Intercom
        zeigt im Launcher die Zahl der Konversationen — vier Antworten in einem
        Thread sind eine offene Sache, nicht vier.
        """
        query = (
            self._db.table("support_tickets")
            .select("id, reporter_last_read_at, last_message_kind")
            .order("last_message_at", desc=True)
        )
        query = self._scope(query, user_id=user_id, guest_id=guest_id)
        rows = query.limit(_MAX_LIMIT).execute().data or []
        ungelesen = self._ungelesen_je_ticket(rows)
        return UnreadSummary(
            conversations=sum(1 for n in ungelesen.values() if n > 0),
            messages=sum(ungelesen.values()),
        )

    # -- anonyme Website-Besucher ---------------------------------------------

    def start_public_chat(self, req: PublicChatStart) -> PublicTicket:
        """Konversation eines anonymen Besuchers eröffnen.

        Der Besucher hat kein Konto. Statt einer Melder-ID bekommt das Ticket
        Kontaktdaten und ein Zufallstoken; gespeichert wird nur dessen Hash
        (Muster wie bei Sitzungs-/Einladungstoken). Das Klartext-Token wird
        EINMAL zurückgegeben und lebt danach nur im Browser.

        Idempotent über client_msg_id (Wurzel 2): derselbe Doppelklick eröffnet
        keine zweite Konversation, sondern liefert die vorhandene — samt neuem
        Token, denn der Client hat seines in dem Fall ja noch nicht.
        """
        if req.client_msg_id:
            vorhanden = self._public_zu_client_id(req.client_msg_id)
            if vorhanden is not None:
                return vorhanden

        token = pysecrets.token_urlsafe(32)
        jetzt = datetime.now(UTC).isoformat()
        res = (
            self._db.table("support_tickets")
            .insert(
                {
                    "subject": _betreff_aus_nachricht(req.body),
                    # Anfragen von der Website sind Vertriebskontakt, kein
                    # Störfall — die Priorität leitet der Server ab, nie der
                    # Client (Wurzel 3).
                    "category": "vertrieb",
                    "priority": _PRIO_STANDARD,
                    "source": "web",
                    "reporter_name": req.name.strip(),
                    "reporter_email": str(req.email).strip().lower(),
                    "reporter_phone": (req.phone or "").strip() or None,
                    "visitor_token_hash": _token_hash(token),
                    "last_message_at": jetzt,
                    "last_message_preview": _vorschau(req.body),
                    "last_message_kind": "reporter",
                    "reporter_last_read_at": jetzt,
                }
            )
            .execute()
        ).data
        if not res:
            raise SupportError("Anfrage konnte nicht angelegt werden.", status_code=502)
        ticket = res[0]

        self._db.table("support_messages").insert(
            {
                "ticket_id": ticket["id"],
                "author_kind": "reporter",
                "body": req.body,
                "internal": False,
                "client_msg_id": req.client_msg_id,
            }
        ).execute()

        log.info("support_web_chat_started", ticket_id=ticket["id"])
        detail = self.public_detail(token)
        if detail is None:  # pragma: no cover — direkt nach dem Insert unmöglich
            raise SupportError("Anfrage nicht lesbar.", status_code=502)
        return PublicTicket(**{**detail.model_dump(), "token": token})

    def public_detail(self, token: str) -> PublicTicket | None:
        """Konversation zu einem Besucher-Token. None = unbekannt.

        Der Scope ist das Token — genau wie sonst die Melder-ID (Wurzel 9).
        Gesucht wird über den Hash; ein unbekanntes Token ist von einem
        fremden nicht unterscheidbar.
        """
        zeile = self._besucher_zeile(token)
        if zeile is None:
            return None
        msgs = (
            self._db.table("support_messages")
            .select("id, author_kind, body, created_at, client_msg_id")
            .eq("ticket_id", zeile["id"])
            .eq("internal", False)
            .order("created_at", desc=False)
            .limit(_PUBLIC_MSG_LIMIT)
            .execute()
        ).data or []
        return PublicTicket(
            ticket_id=zeile["id"],
            status=_melder_status(zeile.get("status")),
            messages=[TicketMessage(**m) for m in msgs],
        )

    def reply_public(
        self, token: str, body: str, *, client_msg_id: str | None = None
    ) -> TicketMessage | None:
        """Antwort des Besuchers. None = unbekanntes Token."""
        zeile = self._besucher_zeile(token)
        if zeile is None:
            return None

        try:
            res = (
                self._db.table("support_messages")
                .insert(
                    {
                        "ticket_id": zeile["id"],
                        "author_kind": "reporter",
                        "body": body,
                        "internal": False,
                        "client_msg_id": client_msg_id,
                    }
                )
                .execute()
            ).data
        except APIError as exc:
            if getattr(exc, "code", None) != "23505" or not client_msg_id:
                raise
            bestehend = self._nachricht_zu_client_id(zeile["id"], client_msg_id)
            if bestehend is None:
                raise
            return bestehend

        jetzt = datetime.now(UTC).isoformat()
        felder: dict[str, str] = {
            "last_message_at": jetzt,
            "updated_at": jetzt,
            "last_message_preview": _vorschau(body),
            "last_message_kind": "reporter",
            "reporter_last_read_at": jetzt,
        }
        if (zeile.get("status") or "") in ("resolved", "closed"):
            felder["status"] = "open"
        self._db.table("support_tickets").update(felder).eq(
            "id", zeile["id"]
        ).execute()
        return TicketMessage(**res[0])

    def _besucher_zeile(self, token: str) -> dict | None:
        """Ticket-Zeile zu einem Besucher-Token (über den Hash).

        Der Hash-Vergleich läuft zusätzlich byteweise über secrets_match: die
        Gleichheit entscheidet zwar schon der eindeutige Index, aber der
        Rückvergleich schließt aus, dass eine künftige Änderung (z. B. ein
        LIKE-Filter) den Abgleich unbemerkt aufweicht.
        """
        if not token:
            return None
        gehasht = _token_hash(token)
        rows = (
            self._db.table("support_tickets")
            .select("id, status, visitor_token_hash")
            .eq("visitor_token_hash", gehasht)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return None
        if not secrets_match(rows[0].get("visitor_token_hash"), gehasht):
            return None
        return rows[0]

    def _public_zu_client_id(self, client_msg_id: str) -> PublicTicket | None:
        """Bereits mit dieser client_msg_id eröffnete Besucher-Konversation.

        Anders als bei eingeloggten Meldern gibt es hier keine Identität, an der
        man den Treffer gegenprüfen könnte — deshalb wird NUR zurückgegeben,
        was auch wirklich eine Website-Konversation ist (source='web'), und das
        Token wird neu vergeben (der Aufrufer ist derselbe Client, der die
        Eröffnung wiederholt).
        """
        rows = (
            self._db.table("support_messages")
            .select("ticket_id")
            .eq("client_msg_id", client_msg_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return None
        ticket = (
            self._db.table("support_tickets")
            .select("id, status, source")
            .eq("id", rows[0]["ticket_id"])
            .eq("source", "web")
            .limit(1)
            .execute()
        ).data or []
        if not ticket:
            return None

        token = pysecrets.token_urlsafe(32)
        self._db.table("support_tickets").update(
            {"visitor_token_hash": _token_hash(token)}
        ).eq("id", ticket[0]["id"]).execute()
        detail = self.public_detail(token)
        if detail is None:  # pragma: no cover
            return None
        return PublicTicket(**{**detail.model_dump(), "token": token})

    # -- intern ---------------------------------------------------------------

    def _ticket(self, row: dict, ungelesen: dict[str, int]) -> Ticket:
        """DB-Zeile in die Melder-Sicht übersetzen."""
        daten = {k: v for k, v in row.items() if k != "reporter_last_read_at"}
        daten["status"] = _melder_status(row.get("status"))
        return Ticket(**daten, unread=ungelesen.get(row["id"], 0))

    def _eigene_zeile(
        self, ticket_id: str, *, user_id: str | None, guest_id: str | None
    ) -> dict | None:
        """Ticket-Zeile im Melder-Scope laden (inkl. internem Status)."""
        query = (
            self._db.table("support_tickets")
            .select(_TICKET_COLUMNS)
            .eq("id", ticket_id)
        )
        query = self._scope(query, user_id=user_id, guest_id=guest_id)
        rows = query.limit(1).execute().data or []
        return rows[0] if rows else None

    def _ungelesen_je_ticket(self, rows: list[dict]) -> dict[str, int]:
        """Ungelesene Team-Nachrichten je Ticket zählen.

        Eine Abfrage für alle übergebenen Tickets (kein N+1). Gezählt werden nur
        SICHTBARE Nachrichten des Teams, die jünger sind als der eigene
        Lese-Cursor. Ohne Cursor gilt alles vom Team als ungelesen.
        """
        ids = [r["id"] for r in rows]
        if not ids:
            return {}
        msgs = (
            self._db.table("support_messages")
            .select("ticket_id, created_at")
            .in_("ticket_id", ids)
            .eq("author_kind", "agent")
            .eq("internal", False)
            .order("created_at", desc=True)
            .limit(_UNREAD_SCAN)
            .execute()
        ).data or []

        cursor = {r["id"]: r.get("reporter_last_read_at") for r in rows}
        gezaehlt: dict[str, int] = {tid: 0 for tid in ids}
        for m in msgs:
            gelesen_bis = cursor.get(m["ticket_id"])
            if gelesen_bis is None or m["created_at"] > gelesen_bis:
                gezaehlt[m["ticket_id"]] += 1
        return gezaehlt

    def _nachricht_zu_client_id(
        self, ticket_id: str, client_msg_id: str
    ) -> TicketMessage | None:
        """Bereits gespeicherte Nachricht zu einer client_msg_id."""
        rows = (
            self._db.table("support_messages")
            .select("id, author_kind, body, created_at, client_msg_id")
            .eq("ticket_id", ticket_id)
            .eq("client_msg_id", client_msg_id)
            .limit(1)
            .execute()
        ).data or []
        return TicketMessage(**rows[0]) if rows else None

    def _chat_zu_client_id(
        self, client_msg_id: str, *, user_id: str | None, guest_id: str | None
    ) -> TicketDetail | None:
        """Konversation, die bereits mit dieser client_msg_id eröffnet wurde.

        Der Treffer wird über die NACHRICHT gesucht und dann im Melder-Scope
        geladen — nie umgekehrt (Wurzel 3: eine fremde client_msg_id darf keine
        fremde Konversation aufschließen).
        """
        rows = (
            self._db.table("support_messages")
            .select("ticket_id")
            .eq("client_msg_id", client_msg_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return None
        return self.detail(rows[0]["ticket_id"], user_id=user_id, guest_id=guest_id)

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
