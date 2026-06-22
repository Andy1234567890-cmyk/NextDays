"""Pydantic-Schemas für den inbox-Slice.

Posteingang für OTA-Gästekommunikation. Ein Thread entspricht einer OTA-Buchung
(channex_booking); Nachrichten-Versand an die Plattform folgt separat (Channex
Messaging-API), vorerst Anzeige des Buchungs-/Gastkontexts.
"""
from pydantic import BaseModel


class InboxThread(BaseModel):
    id: str                         # channex_booking.id
    ota_name: str | None = None     # Portal (Booking.com, Airbnb, …)
    ota_reservation_code: str | None = None
    guest_name: str | None = None
    guest_email: str | None = None
    status: str | None = None       # new | modified | cancelled
    arrival_date: str | None = None
    departure_date: str | None = None
    updated_at: str | None = None


class InboxListResponse(BaseModel):
    items: list[InboxThread] = []
    total: int = 0


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
