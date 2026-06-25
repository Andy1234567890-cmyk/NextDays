"""Pydantic-Schemas für den public_portal-Slice (Eigentümer-Self-Service-Portal).

Der eingeloggte Eigentümer (Rolle 'owner') sieht NUR seine zugeordneten Objekte
(owner_property_assignments), Beträge/Gäste maskiert (guest_masking, §4.2).
"""
from datetime import date as date_

from pydantic import BaseModel, Field


class PortalProperty(BaseModel):
    id: str
    title: str
    city: str | None = None
    photo: str | None = None


class PortalPropertyList(BaseModel):
    items: list[PortalProperty]
    total: int


class PortalCalendarDay(BaseModel):
    date: date_
    status: str  # open | booked | blocked
    # Netto-Preis/Nacht — nur wenn die Maske Beträge erlaubt (sonst None).
    price: float | None = None


class PortalCalendarResponse(BaseModel):
    property_id: str
    days: list[PortalCalendarDay]


class PortalEarningsItem(BaseModel):
    property_id: str
    title: str
    nights: int
    reservations: int
    # Maskiert: nur sichtbar, wenn die Maske Beträge erlaubt.
    payout: float | None = None
    currency: str


class PortalEarningsResponse(BaseModel):
    period_from: date_
    period_to: date_
    items: list[PortalEarningsItem]
    total_payout: float | None = None
    currency: str


class PortalStatementItem(BaseModel):
    id: str
    period_from: date_
    period_to: date_
    status: str
    owner_payout: float
    currency: str
    invoice_number: str | None = None
    created_at: str | None = None


class PortalStatementList(BaseModel):
    items: list[PortalStatementItem]
    total: int


class BlockRequestCreate(BaseModel):
    property_id: str
    start_date: date_
    end_date: date_


class BlockRequestItem(BaseModel):
    id: str
    property_id: str
    start_date: date_
    end_date: date_
    status: str
    created_at: str | None = None


class BlockRequestList(BaseModel):
    items: list[BlockRequestItem]
    total: int


class MeterReadingCreate(BaseModel):
    property_id: str
    meter_kind: str = Field(min_length=1, max_length=50)
    value: float = Field(ge=0)
    read_at: date_


class MeterReadingItem(BaseModel):
    id: str
    property_id: str
    meter_kind: str
    value: float
    read_at: date_
    created_at: str | None = None


class MeterReadingList(BaseModel):
    items: list[MeterReadingItem]
    total: int


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
