"""Schemas des host_messages-Slice — Betrieb-Seite des PLATTFORM-Posteingangs.

WICHTIG: Das ist der Chat der EIGENEN Plattform (/plattform, guest_message_threads
+ guest_messages, portal_guest ↔ Betrieb) — NICHT der Channel-Manager/OTA-inbox
(channex_booking). Der Gastgeber liest hier seine Plattform-Threads und antwortet
als 'host'. UI-Referenz: Airbnb „Messages" (3 Spalten: Liste / Chat / Reservierung).
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class HostThreadSummary(BaseModel):
    """Ein Thread in der linken Liste (Airbnb-Konversationsliste)."""

    id: str
    portal_guest_id: str
    guest_name: str | None = None
    guest_email: str | None = None
    property_id: str | None = None
    property_title: str | None = None
    reservation_id: str | None = None
    check_in: str | None = None
    check_out: str | None = None
    last_message: str | None = None       # Vorschau der letzten Nachricht
    last_message_at: str | None = None
    unread_count: int = 0                  # ungelesene Gast-Nachrichten (Betrieb-Sicht)
    is_archived: bool = False
    is_blocked: bool = False               # ist dieser Gast blockiert?
    created_at: str | None = None


class HostThreadListResponse(BaseModel):
    threads: list[HostThreadSummary] = []


class HostMessageView(BaseModel):
    id: str
    sender: str                            # 'guest' | 'host'
    body: str
    created_at: str | None = None


class HostThreadDetail(BaseModel):
    id: str
    portal_guest_id: str
    guest_name: str | None = None
    guest_email: str | None = None
    property_id: str | None = None
    property_title: str | None = None
    reservation_id: str | None = None
    is_archived: bool = False
    is_blocked: bool = False
    messages: list[HostMessageView] = []


class HostSendMessageRequest(BaseModel):
    body: str = Field(min_length=1)


class HostThreadFlagsUpdate(BaseModel):
    """Betrieb-Flags: archivieren / (wieder) aktiv. None = unverändert."""

    is_archived: bool | None = None


class HostReservationDetail(BaseModel):
    """Rechte Spalte (Airbnb „Reservation"): Objekt + Reservierungs-/Zahldetails.
    Alle Felder optional — fehlt etwas, rendert das UI „—" (kein Fake, Wurzel 4)."""

    property_id: str | None = None
    property_title: str | None = None
    property_photos: list[str] = []
    city: str | None = None
    country: str | None = None
    guest_name: str | None = None
    check_in: str | None = None
    check_out: str | None = None
    nights: int | None = None
    num_guests: int | None = None
    status: str | None = None
    total_amount: float | None = None
    paid_amount: float | None = None
    currency: str | None = None
    payment_status: str | None = None
    cancel_reason: str | None = None
    cancelled_at: str | None = None


# --- Quick Replies (Airbnb „Quick replies") ---------------------------------
class QuickReply(BaseModel):
    id: str
    title: str
    body: str
    property_ids: list[str] = []           # leer = alle Objekte


class QuickReplyList(BaseModel):
    items: list[QuickReply] = []


class QuickReplyUpsert(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=5000)
    property_ids: list[str] = []


class SliceHealth(BaseModel):
    slice: str = "host_messages"
    status: str = "ok"
