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


class TicketMessage(BaseModel):
    """Eine Nachricht aus Sicht des Melders.

    Enthält bewusst KEIN internal-Feld: interne Notizen werden serverseitig
    herausgefiltert und dürfen hier gar nicht erst erscheinen.
    """

    id: str
    author_kind: str
    body: str
    created_at: datetime


class Ticket(BaseModel):
    """Ein Ticket aus Sicht des Melders."""

    id: str
    subject: str
    category: str | None = None
    status: str
    priority: str
    created_at: datetime
    last_message_at: datetime | None = None


class TicketDetail(Ticket):
    """Ticket inkl. sichtbarem Verlauf (ohne interne Notizen)."""

    messages: list[TicketMessage] = []


class TicketList(BaseModel):
    items: list[Ticket]
    total: int


class TicketReply(BaseModel):
    """Antwort des Melders auf sein eigenes Ticket."""

    body: str = Field(min_length=1, max_length=5000)
