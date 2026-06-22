"""Pydantic-Schemas für den booking_engine-Slice (öffentliche Buchungsstrecke).

Die eigene Plattform (/plattform) liest hierüber öffentlich die Verfügbarkeit und
legt Gastbuchungen an. KEIN JWT — die tenant_id wird aus der Property abgeleitet.
Double-Booking-Schutz + Realtime-Push an Channex laufen serverseitig.
"""
from datetime import date

from pydantic import BaseModel, EmailStr, model_validator


class PublicDay(BaseModel):
    date: date
    available: bool  # True = buchbar (status open), False = belegt/gesperrt


class PublicAvailabilityResponse(BaseModel):
    property_id: str
    days: list[PublicDay] = []


class GuestContact(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str = ""


class PublicBookingRequest(BaseModel):
    property_id: str
    check_in: date
    check_out: date  # exklusiv
    contact: GuestContact
    total_amount: float = 0

    @model_validator(mode="after")
    def _check_dates(self) -> "PublicBookingRequest":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        return self


class PublicBookingResponse(BaseModel):
    id: str
    property_id: str
    check_in: date
    check_out: date
    status: str


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
