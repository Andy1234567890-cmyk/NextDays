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
    # Tagespreis: price_overrides (Tag) > rate_plans.base_price (Default).
    # None, wenn das Objekt keinen Rate-Plan/Override hat (kein Fallback-Wert).
    price: float | None = None
    # Mindestaufenthalt aus dem Rate-Plan des Objekts (per-Tag-Restriktionen v2).
    min_stay: int | None = None


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


class SeasonPriceRequest(BaseModel):
    """Tagespreis für einen Zeitraum setzen (Saisonpreis). end exklusiv."""
    property_id: str
    range: DateRange
    price: float  # pro Nacht


class SeasonPriceDay(BaseModel):
    date: date
    price: float


class SeasonPriceListResponse(BaseModel):
    items: list[SeasonPriceDay] = []
    total: int = 0


class BulkEditRequest(BaseModel):
    """Mehrere Objekte × ein Zeitraum in einem Rutsch bearbeiten (wie Hostaway).

    Es wird nur angewendet, was gesetzt ist (None = unverändert):
      - price:    Tagespreis je Tag (price_overrides + Channex-Rate-Push)
      - min_stay: Mindestaufenthalt je Objekt (rate_plans + Channex-Restriktion)
      - block:    True = sperren, False = Sperre aufheben (availability)
      - stop_sell:True = Verkaufsstopp setzen, False = aufheben
    """

    property_ids: list[str]
    range: DateRange
    price: float | None = None
    min_stay: int | None = None
    block: bool | None = None
    stop_sell: bool | None = None

    @model_validator(mode="after")
    def _at_least_one(self) -> "BulkEditRequest":
        if not self.property_ids:
            raise ValueError("Mindestens ein Objekt erforderlich")
        if (
            self.price is None
            and self.min_stay is None
            and self.block is None
            and self.stop_sell is None
        ):
            raise ValueError("Mindestens eine Änderung erforderlich")
        return self


class BulkEditResult(BaseModel):
    properties: int  # Anzahl bearbeiteter Objekte
    days: int        # Tage je Objekt im Zeitraum
    applied: list[str]  # welche Aktionen ausgeführt wurden


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
