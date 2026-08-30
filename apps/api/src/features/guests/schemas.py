"""Pydantic-Schemas für den guests-Slice (Enterprise-Gästekarte).

Stammdaten-Profil (vgl. OPERA Cloud „Manage Profile" / protel Gästekartei) +
Sub-Ressourcen: Adressen, Kontakte, Identitätsdokumente, Präferenzen, Consents,
Notizen, Dokumente. Gast-Felder werden serverseitig über den zentralen
guest_masking-Helper maskiert (DSGVO-Daten-Split) — die Schemas erlauben dafür
durchgängig None.
"""
from datetime import date, datetime

from pydantic import BaseModel, Field


# --- Gast-Stammdaten ---------------------------------------------------------
class GuestBase(BaseModel):
    salutation: str | None = None
    title: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    birth_name: str | None = None
    birth_date: date | None = None
    birth_place: str | None = None
    gender: str | None = None
    nationality: str | None = None          # ISO-Land
    language: str | None = None             # Korrespondenzsprache (ISO)
    currency: str | None = None
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    position: str | None = None
    vat_id: str | None = None
    vip_code: str | None = None
    segment: str | None = None
    source: str | None = None
    is_blocked: bool = False
    block_reason: str | None = None


class GuestCreate(GuestBase):
    # name bleibt Pflicht (NOT NULL in der DB); ableitbar aus first/last_name.
    name: str | None = Field(default=None, max_length=200)


class GuestUpdate(BaseModel):
    salutation: str | None = None
    title: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    birth_name: str | None = None
    birth_date: date | None = None
    birth_place: str | None = None
    gender: str | None = None
    nationality: str | None = None
    language: str | None = None
    currency: str | None = None
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    position: str | None = None
    vat_id: str | None = None
    vip_code: str | None = None
    segment: str | None = None
    source: str | None = None
    is_blocked: bool | None = None
    block_reason: str | None = None
    name: str | None = None


class GuestListItem(BaseModel):
    """Kompakte Zeile in der Gästeliste (maskiert je Rolle)."""

    id: str
    name: str | None = None                 # ganz oder nur Vorname (Maske)
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    vip_code: str | None = None
    segment: str | None = None
    is_blocked: bool = False
    stays_count: int = 0
    last_stay_at: date | None = None
    # Unvollständiger Gast: der Kanal hat keinen Namen geliefert (Airbnb nie),
    # oder E-Mail und Telefon zeigten beim Anlegen auf verschiedene Bestands-
    # gäste. Die Oberfläche zeigt statt des nackten '—' den Grund.
    needs_review: bool = False
    # Ersatz-Kennung für genau diese Fälle: woher die Buchung kam und welche.
    # Ein namenloser Gast ist nicht identitätslos — er hängt an einem Objekt
    # und einem Zeitraum, und daran erkennt der Betrieb ihn wieder. Airbnb
    # macht es im eigenen Kalender genauso ("Airbnb-Gast" + Buchungsbezug).
    # Alle drei sind None, sobald ein echter Name existiert: dann ist der
    # Bezug überflüssig und die Antwort bliebe nur unnötig groß.
    letzter_kanal: str | None = None      # 'airbnb', 'booking_com', …
    letztes_objekt: str | None = None     # properties.title
    letzte_anreise: date | None = None


class GuestListResponse(BaseModel):
    items: list[GuestListItem] = []
    total: int = 0


class GuestResponse(GuestBase):
    id: str
    tenant_id: str
    name: str | None = None
    stays_count: int = 0
    last_stay_at: date | None = None
    total_revenue: float | None = None      # maskierbar → None
    anonymized_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


# --- Adressen ----------------------------------------------------------------
class AddressBase(BaseModel):
    type: str = "private"                   # private|business|billing
    street: str | None = None
    house_no: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    is_primary: bool = False


class AddressCreate(AddressBase):
    pass


class AddressResponse(AddressBase):
    id: str
    guest_id: str


# --- Kontakte ----------------------------------------------------------------
class ContactBase(BaseModel):
    type: str = "mobile"                    # mobile|private|business|email
    value: str = Field(min_length=1)
    is_primary: bool = False


class ContactCreate(ContactBase):
    pass


class ContactResponse(ContactBase):
    id: str
    guest_id: str


# --- Identitätsdokumente (DSGVO-sensibel) ------------------------------------
class IdentityDocBase(BaseModel):
    doc_type: str                           # id_card|passport|driver_license
    number: str = Field(min_length=1)
    issuing_country: str | None = None
    valid_until: date | None = None


class IdentityDocCreate(IdentityDocBase):
    pass


class IdentityDocResponse(BaseModel):
    id: str
    guest_id: str
    doc_type: str
    number: str | None = None               # maskiert ohne VIEW_GUEST_ID_DOCS
    issuing_country: str | None = None
    valid_until: date | None = None


# --- Präferenzen (1:1) -------------------------------------------------------
class PreferencesBase(BaseModel):
    non_smoking: bool | None = None
    pets: bool | None = None
    dietary: str | None = None
    preferred_arrival_time: str | None = None
    room_preferences: str | None = None
    language: str | None = None
    wishes: str | None = None


class PreferencesResponse(PreferencesBase):
    guest_id: str


# --- Consents (append-only) --------------------------------------------------
class ConsentCreate(BaseModel):
    consent_type: str                       # marketing_email|marketing_sms|data_storage
    status: str                             # granted|revoked
    source: str | None = None
    expires_at: datetime | None = None


class ConsentResponse(BaseModel):
    id: str
    guest_id: str
    consent_type: str
    status: str
    source: str | None = None
    expires_at: datetime | None = None
    created_at: datetime


class ConsentListResponse(BaseModel):
    items: list[ConsentResponse] = []
    total: int = 0


# --- Notizen (intern) --------------------------------------------------------
class NoteCreate(BaseModel):
    body: str = Field(min_length=1)
    category: str | None = None


class NoteResponse(BaseModel):
    id: str
    guest_id: str
    author_id: str | None = None
    author_name: str | None = None
    category: str | None = None
    body: str
    created_at: datetime


# --- Dokumente (Storage-Referenz) --------------------------------------------
class DocumentCreate(BaseModel):
    name: str = Field(min_length=1)
    storage_path: str = Field(min_length=1)
    doc_type: str | None = None


class DocumentResponse(BaseModel):
    id: str
    guest_id: str
    name: str
    doc_type: str | None = None
    storage_path: str
    uploaded_by: str | None = None
    created_at: datetime


# --- Verknüpfte Daten (Joins) ------------------------------------------------
class GuestReservationItem(BaseModel):
    id: str
    property_id: str | None = None
    check_in: date | None = None
    check_out: date | None = None
    status: str | None = None
    channel: str | None = None
    total_amount: float | None = None       # maskierbar
    currency: str | None = None
    # Summe der gebuchten Zusatzleistungen (reservation_addons, ohne stornierte);
    # maskierbar wie total_amount. 0 = keine Extras.
    addons_total: float | None = None


class GuestThreadItem(BaseModel):
    id: str                                 # channex_booking.id (Inbox-Thread)
    ota_name: str | None = None
    ota_reservation_code: str | None = None
    last_message_at: str | None = None


class GuestInvoiceItem(BaseModel):
    id: str
    invoice_number: str | None = None
    status: str | None = None
    issue_date: date | None = None
    gross_amount: float | None = None       # maskierbar
    currency: str | None = None


class ListResponse(BaseModel):
    """Generische Liste für Sub-Ressourcen (Adressen/Kontakte/…)."""

    items: list = []
    total: int = 0


class MergeRequest(BaseModel):
    source_id: str                          # wird in target zusammengeführt
    target_id: str


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
