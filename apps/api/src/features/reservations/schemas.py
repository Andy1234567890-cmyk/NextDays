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

    @model_validator(mode="after")
    def _check_order(self) -> "ReservationCreate":
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
    total_amount: float
    currency: str = ""


class ReservationListResponse(BaseModel):
    items: list[ReservationResponse]
    total: int


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
