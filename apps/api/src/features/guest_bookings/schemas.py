"""Pydantic-Schemas für den guest_bookings-Slice (Gast-Sicht „Meine Buchungen").

Bewusst SCHMAL und maskiert: ein Portal-Gast bekommt nur die für ihn relevanten
Felder seiner eigenen Buchung — KEINE Tenant-Interna (interne User-Namen, andere
Gäste, Owner-/Provisionsdaten). Beträge sind nullable (fehlt/maskiert → null, nie
0 erfunden, Wurzel 4). Währung IMMER aus reservation/property (currency-Spalte),
nie €-Default.
"""
from datetime import date, datetime

from pydantic import BaseModel, Field


class SliceHealth(BaseModel):
    slice: str


class BookingProperty(BaseModel):
    """Objekt-Kurzinfo für Liste/Detail (aus dem properties-Join)."""

    id: str
    title: str
    photo: str | None = None  # erstes Foto (photos[0]), sonst null
    address: str | None = None
    currency: str  # ISO-4217, aus properties.currency — kein Fallback


class GuestBookingSummary(BaseModel):
    """Eine Buchung in der Liste."""

    id: str
    property: BookingProperty
    check_in: date
    check_out: date
    num_guests: int
    status: str
    payment_status: str | None = None
    channel: str
    # Beträge in der Objektwährung (property.currency). Nullable: fehlt der Wert,
    # bleibt er null (nie 0 erfinden).
    total_amount: float | None = None
    paid_amount: float | None = None
    currency: str  # aus reservations.currency


class GuestBookingListResponse(BaseModel):
    items: list[GuestBookingSummary]
    total: int


class GuestBookingDetail(BaseModel):
    """Vollansicht EINER eigenen Buchung."""

    id: str
    property: BookingProperty
    check_in: date
    check_out: date
    num_guests: int
    adults: int
    children: int
    status: str
    payment_status: str | None = None
    channel: str
    total_amount: float | None = None
    paid_amount: float | None = None
    # Offener Betrag (total - paid), nur wenn beide bekannt und > 0; sonst null.
    balance_due: float | None = None
    currency: str
    checkin_time: str | None = None
    checkout_time: str | None = None
    note: str | None = None
    # Positions-Aufschlüsselung der Buchung (quote_items jsonb) — reine Anzeige.
    quote_items: list[dict] = []
    checked_in_at: datetime | None = None
    checked_out_at: datetime | None = None
    cancelled_at: datetime | None = None
    # Ob der Gast selbst noch stornieren darf (frei stornierbar, nicht eingecheckt).
    can_cancel: bool = False


class GuestTimelineEvent(BaseModel):
    """Ein für den Gast sichtbares Zeitleisten-Ereignis (maskiert).

    KEINE internen Auslöser-Namen (by_user_id) und keine tenant-internen
    Detailfelder — nur die für den Gast nachvollziehbaren Eckdaten.
    """

    kind: str
    created_at: datetime
    detail: dict = {}


class GuestTimelineResponse(BaseModel):
    items: list[GuestTimelineEvent]


class GuestCancelRequest(BaseModel):
    """Storno durch den Gast — Begründung optional (Frontend-Textfeld).

    Wurzel 8: Länge serverseitig begrenzt (→422), damit ein unbegrenzter
    Client-Text nicht ungebremst in Storno-Log/Events landet.
    """

    reason: str = Field(default="", max_length=1000)


class GuestCancelResponse(BaseModel):
    id: str
    status: str
