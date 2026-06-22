"""Pydantic-Schemas für den calendar-Slice.

Bildet die availability-Tabelle ab (Migration 0004): eine Zeile pro
(property_id, date) = die eine Wahrheit gegen Double-Bookings.
"""
from datetime import date
from enum import StrEnum

from pydantic import BaseModel, model_validator


class AvailabilityStatus(StrEnum):
    open = "open"
    booked = "booked"
    blocked = "blocked"


class AvailabilitySource(StrEnum):
    direct = "direct"
    portal = "portal"
    booking = "booking"
    airbnb = "airbnb"
    vrbo = "vrbo"
    manual = "manual"


class DateRange(BaseModel):
    start: date
    end: date  # exklusiv (Check-out-Tag ist wieder frei)

    @model_validator(mode="after")
    def _check_order(self) -> "DateRange":
        if self.end <= self.start:
            raise ValueError("end muss nach start liegen")
        return self

    def nights(self) -> list[date]:
        """Alle Übernachtungstage (start inklusive, end exklusiv)."""
        from datetime import timedelta

        days: list[date] = []
        cur = self.start
        while cur < self.end:
            days.append(cur)
            cur += timedelta(days=1)
        return days


class DayAvailability(BaseModel):
    date: date
    status: AvailabilityStatus
    source: AvailabilitySource


class AvailabilityCheck(BaseModel):
    property_id: str
    available: bool
    conflicting_days: list[date] = []


class BlockRequest(BaseModel):
    property_id: str
    range: DateRange


class PriceOverrideRequest(BaseModel):
    property_id: str
    date: date
    price: float | None  # None = Überschreibung zurücknehmen (Lastenheft §2.2)


class StopSellSource(StrEnum):
    manual = "manual"
    channex = "channex"


class StopSellDay(BaseModel):
    id: str
    property_id: str
    date: date
    reason: str | None = None
    source: StopSellSource


class StopSellListResponse(BaseModel):
    items: list[StopSellDay] = []
    total: int = 0


class StopSellRequest(BaseModel):
    """Verkaufsstopp für einen Zeitraum setzen (manuell)."""
    property_id: str
    range: DateRange
    reason: str | None = None


class StopSellClearRequest(BaseModel):
    property_id: str
    range: DateRange


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
