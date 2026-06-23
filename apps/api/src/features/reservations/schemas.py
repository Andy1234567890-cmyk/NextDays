"""Pydantic-Schemas für den reservations-Slice.

Bildet die reservations- und guests-Tabellen ab. Eine Reservierung belegt
den Zeitraum [check_in, check_out) im Kalender (availability=booked) → der
Double-Booking-Schutz aus dem calendar-Slice greift.
"""
from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class ReservationChannel(StrEnum):
    direct = "direct"
    portal = "portal"
    booking = "booking"
    airbnb = "airbnb"
    vrbo = "vrbo"


class ReservationStatus(StrEnum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


class GuestBreakdown(BaseModel):
    """Gäste-Aufschlüsselung (Lodgify Schritt 1)."""

    adults: int = Field(default=1, ge=1)
    children: int = Field(default=0, ge=0)
    infants: int = Field(default=0, ge=0)
    pets: int = Field(default=0, ge=0)


class GuestContact(BaseModel):
    """Kontaktdaten des Hauptgastes."""

    first_name: str = ""
    last_name: str = ""
    email: str = ""
    phone: str = ""
    country: str = ""
    language: str = ""


class ReservationCreate(BaseModel):
    property_id: str
    check_in: date
    check_out: date  # exklusiv (Check-out-Tag ist wieder frei)
    channel: ReservationChannel = ReservationChannel.direct
    source: str = ""  # frei: „Telefon", „Airbnb" …
    guests: GuestBreakdown = GuestBreakdown()
    contact: GuestContact = GuestContact()
    total_amount: float = Field(default=0, ge=0)
    status: ReservationStatus = ReservationStatus.confirmed
    # Optional: bestehenden Gast fest zuordnen (z. B. aus der Gästekarte). Wenn
    # gesetzt UND gültig, wird kein neuer Gast angelegt (keine Dublette).
    guest_id: str | None = None

    @model_validator(mode="after")
    def _check_order(self) -> "ReservationCreate":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        return self


class ReservationMove(BaseModel):
    """Reservierung verschieben (anderes Objekt/anderer Zeitraum) oder resizen
    (nur Check-in/out). Beides ist ein neues (property_id, check_in, check_out)
    für eine bestehende Reservierung; der Double-Booking-Schutz greift erneut,
    die eigenen alten Tage werden dabei ausgenommen.
    """

    property_id: str
    check_in: date
    check_out: date  # exklusiv

    @model_validator(mode="after")
    def _check_order(self) -> "ReservationMove":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        return self


class ReservationResponse(BaseModel):
    id: str
    property_id: str
    guest_id: str | None = None
    guest_name: str = ""
    channel: ReservationChannel
    check_in: date
    check_out: date
    status: ReservationStatus
    # None für Rollen ohne VIEW_GUEST_FULL (DSGVO-Daten-Split §4).
    total_amount: float | None = None
    currency: str = ""
    ota_name: str | None = None       # echter Portal-Name (Kalender-Herkunft)
    external_ref: str | None = None   # OTA-Reservierungscode


class ReservationListResponse(BaseModel):
    items: list[ReservationResponse]
    total: int


class DashboardEntry(BaseModel):
    """Eine Zeile in den Check-out/-in/Anstehend-Listen des Dashboards."""

    reservation_id: str
    guest_name: str = ""
    property_title: str = ""
    channel: ReservationChannel
    ota_name: str | None = None
    check_in: date
    check_out: date
    status: ReservationStatus


class DashboardKpi(BaseModel):
    """Eine KPI-Kachel mit Vergleich zu den vorherigen 30 Tagen."""

    value: float
    # Veränderung in Prozent ggü. der Vorperiode; None, wenn keine Vorperiode
    # vorhanden ist (keine erfundenen 0-%-Werte).
    change_pct: float | None = None


class DashboardResponse(BaseModel):
    today: date
    checkouts_today: list[DashboardEntry]
    checkins_today: list[DashboardEntry]
    upcoming: list[DashboardEntry]
    checkins_30d: DashboardKpi
    revenue_30d: DashboardKpi
    confirmed_30d: DashboardKpi
    currency: str = ""


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
