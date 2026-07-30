"""Schemas des support-Slice (Ticket-Eingang für Melder).

Getrennt vom platform_admin-Slice: hier schreibt und liest der MELDER, dort das
Betreiber-Team. Der wichtigste Unterschied: interne Notizen (support_messages.
internal) tauchen in diesen Schemas gar nicht erst auf.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TicketCreate(BaseModel):
    """Ein neues Ticket eröffnen."""

    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=1, max_length=5000)
    # Freies Thema ('zahlung', 'objekt', 'konto' …) — kein Enum, weil sich
    # Support-Kategorien häufiger ändern als Schemata.
    category: str | None = Field(default=None, max_length=50)
    # Optionaler Bezug auf einen konkreten Vorgang.
    reservation_id: str | None = None
    property_id: str | None = None


class ChatStart(BaseModel):
    """Eine Konversation aus dem Chat-Widget eröffnen.

    Ein Chat hat KEINEN Betreff — der Melder tippt einfach los (Intercom-,
    Zendesk- und Crisp-Muster). Der Betreff wird serverseitig aus der ersten
    Nachricht abgeleitet, damit die Agenten-Liste weiterhin eine Überschrift hat.
    """

    body: str = Field(min_length=1, max_length=5000)
    category: str | None = Field(default=None, max_length=50)
    # Vom Client erzeugte UUID: Doppelklick/Retry darf keine zweite
    # Konversation eröffnen (Wurzel 2).
    client_msg_id: str | None = Field(default=None, max_length=64)


class TicketMessage(BaseModel):
    """Eine Nachricht aus Sicht des Melders.

    Enthält bewusst KEIN internal-Feld: interne Notizen werden serverseitig
    herausgefiltert und dürfen hier gar nicht erst erscheinen.
    """

    id: str
    author_kind: str
    body: str
    created_at: datetime
    # Spiegelt die client_msg_id zurück, damit die optimistisch angezeigte
    # Nachricht ersetzt und nicht doppelt einsortiert wird.
    client_msg_id: str | None = None


class Ticket(BaseModel):
    """Ein Ticket aus Sicht des Melders."""

    id: str
    subject: str
    category: str | None = None
    status: str
    priority: str
    created_at: datetime
    last_message_at: datetime | None = None
    # 'form' = klassische Anfrage, 'chat' = Widget-Konversation.
    source: str = "form"
    last_message_preview: str | None = None
    last_message_kind: str | None = None
    # Ungelesene Team-Nachrichten dieser Konversation (Melder-Sicht).
    unread: int = 0
    # Wann das Team zuletzt hineingesehen hat — daraus wird „Gelesen" an der
    # eigenen letzten Nachricht abgeleitet.
    agent_last_read_at: datetime | None = None
    rating: int | None = None


class TicketDetail(Ticket):
    """Ticket inkl. sichtbarem Verlauf (ohne interne Notizen)."""

    messages: list[TicketMessage] = []


class TicketList(BaseModel):
    items: list[Ticket]
    total: int


class TicketReply(BaseModel):
    """Antwort des Melders auf sein eigenes Ticket."""

    body: str = Field(min_length=1, max_length=5000)
    client_msg_id: str | None = Field(default=None, max_length=64)


class TicketRating(BaseModel):
    """Zufriedenheit mit einer abgeschlossenen Konversation (1–5)."""

    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class SupportOk(BaseModel):
    """Schlichte Bestätigung (Lesebestätigung, Bewertung)."""

    ok: bool = True


class UnreadSummary(BaseModel):
    """Zähler für das Symbol im Dashboard.

    `conversations` ist die Zahl, die als Badge angezeigt wird — Intercom zählt
    ebenfalls Konversationen, nicht einzelne Nachrichten (vier Antworten in
    einem Thread sind eine offene Sache, nicht vier).
    """

    conversations: int = 0
    messages: int = 0
