"""Pydantic-Schemas für den inbox-Slice.

Posteingang für OTA-Gästekommunikation. Ein Thread entspricht einer OTA-Buchung
(channex_booking). Nachrichten werden über die Channex-Messaging-API gelesen und
gesendet (Booking.com/Airbnb/Expedia); ein optionaler KI-Antwortvorschlag (Groq)
hilft beim Beantworten. Threads sind mit der lokalen Reservierung verknüpft.
"""
from pydantic import BaseModel


class InboxThread(BaseModel):
    id: str                         # channex_booking.id
    channex_booking_id: str | None = None  # Channex-Booking-UUID (für Messages)
    reservation_id: str | None = None      # verknüpfte lokale Reservierung
    guest_id: str | None = None            # verknüpfter Gast (Resolver) → Gästekarte
    property_id: str | None = None         # zugeordnetes Objekt (für Filter/Anzeige)
    property_title: str | None = None
    ota_name: str | None = None     # Kanal (myNextDays, Booking.com, Airbnb, …)
    ota_reservation_code: str | None = None
    guest_name: str | None = None
    guest_email: str | None = None
    status: str | None = None       # new | modified | cancelled
    arrival_date: str | None = None
    departure_date: str | None = None
    last_message: str | None = None  # Vorschau der letzten Nachricht
    updated_at: str | None = None
    is_read: bool = True
    is_starred: bool = False
    is_archived: bool = False
    inbox_status: str = "active"           # active|archived|trashed
    assigned_user_id: str | None = None    # zugewiesener Tenant-Benutzer
    assigned_user_name: str | None = None


class InboxListResponse(BaseModel):
    items: list[InboxThread] = []
    total: int = 0


class InboxMessage(BaseModel):
    id: str | None = None
    message: str
    sender: str                     # "guest" | "property" | "note"
    sent_at: str | None = None
    author_name: str | None = None  # bei internen Notizen: Verfasser


class InboxMessagesResponse(BaseModel):
    items: list[InboxMessage] = []
    total: int = 0


class ReservationDetail(BaseModel):
    """Reservierungs-Kontext rechts neben dem Chat (white-label)."""

    listing_name: str | None = None
    listing_photo: str | None = None       # Vorschaubild der Unterkunft
    address: str | None = None
    rental_id: str | None = None           # lokale Objekt-ID (Cache)
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    guest_language: str | None = None
    adults: int | None = None
    children: int | None = None
    nights: int | None = None
    total_amount: float | None = None
    paid_amount: float | None = None
    currency: str | None = None
    status: str | None = None
    ota_name: str | None = None
    ota_reservation_code: str | None = None
    check_in: str | None = None
    check_out: str | None = None
    checkin_time: str | None = None
    checkout_time: str | None = None
    note: str | None = None                # interne Notiz (Gastgeber)
    is_starred: bool = False


class SendMessageRequest(BaseModel):
    message: str


class ThreadFlagsUpdate(BaseModel):
    """Interne Konversations-Flags (Favorit/Notiz/Lesen/Archiv/Erinnerung)."""

    is_starred: bool | None = None
    note: str | None = None
    is_read: bool | None = None
    is_archived: bool | None = None
    remind_at: str | None = None


class AiReplyRequest(BaseModel):
    """Optionaler Kontext für den KI-Vorschlag (z.B. der Gast-Text)."""

    prompt: str | None = None


class AiReplyResponse(BaseModel):
    reply: str
    sources: list[str] = []


# --- Vorlagen ---------------------------------------------------------------
class MessageTemplate(BaseModel):
    id: str
    title: str
    body: str


class MessageTemplateList(BaseModel):
    items: list[MessageTemplate] = []
    total: int = 0


class TemplateUpsert(BaseModel):
    title: str
    body: str


# --- KI-Einstellungen -------------------------------------------------------
class AiSettings(BaseModel):
    tone: str = "freundlich"
    language: str = "auto"
    signature: str | None = None
    extra_prompt: str | None = None
    auto_suggest: bool = True


# --- Automatisierungen ------------------------------------------------------
# anchor: Bezugsdatum (arrival|departure|booking); offset_days = vorzeichen-
# behaftetes Tagesdelta (−3 = 3 Tage vor, +1 = 1 Tag nach). send_time = "HH:MM".
# property_ids/channels = Zuweisung (leer = alle); UND-verknüpft (Haus UND Kanal).
class Automation(BaseModel):
    id: str
    name: str
    trigger: str               # booking_new|before_checkin|after_checkout
    anchor: str = "arrival"    # arrival|departure|booking
    offset_days: int = 0
    send_time: str | None = None  # "HH:MM"
    property_ids: list[str] = []
    channels: list[str] = []
    template_id: str | None = None
    message: str | None = None
    is_active: bool = True


class AutomationList(BaseModel):
    items: list[Automation] = []
    total: int = 0


class AutomationUpsert(BaseModel):
    name: str
    trigger: str
    anchor: str = "arrival"
    offset_days: int = 0
    send_time: str | None = None
    property_ids: list[str] = []
    channels: list[str] = []
    template_id: str | None = None
    message: str | None = None
    is_active: bool = True


# --- Zuweisung --------------------------------------------------------------
class TeamMember(BaseModel):
    id: str
    name: str
    email: str | None = None


class TeamMemberList(BaseModel):
    items: list[TeamMember] = []
    total: int = 0


class AssignRequest(BaseModel):
    user_id: str | None = None     # None → Zuweisung aufheben


class InboxStatusUpdate(BaseModel):
    status: str                    # active|archived|trashed|deleted


class LinkGuestRequest(BaseModel):
    # None → „Gast aus Thread anlegen" (Resolver über customer-JSON);
    # gesetzt → bestehenden (tenant-eigenen) Gast verknüpfen.
    guest_id: str | None = None


class LinkGuestResponse(BaseModel):
    guest_id: str | None = None


# --- Interne Notiz (gelb im Verlauf) ----------------------------------------
class NoteCreate(BaseModel):
    body: str


# --- Geplante Nachrichten ----------------------------------------------------
class ScheduleCreate(BaseModel):
    body: str
    send_at: str                   # ISO-Zeitpunkt (UTC)


class ScheduledMessage(BaseModel):
    id: str
    thread_id: str
    body: str
    send_at: str
    status: str                    # pending|sent|failed|cancelled


class ScheduledMessageList(BaseModel):
    items: list[ScheduledMessage] = []
    total: int = 0


# --- Massenaktualisierung ----------------------------------------------------
class BulkUpdateRequest(BaseModel):
    action: str                    # "read" | "archived"
    before: str                    # nur Threads mit letzter Aktivität ≤ Datum (YYYY-MM-DD)


class BulkUpdateResult(BaseModel):
    updated: int


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
