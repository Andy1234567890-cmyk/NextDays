"""Pydantic-Schemas für den booking_conditions-Slice.

Eine Kondition (Buchungsbedingung) bündelt Zahlungsplan, Stornierung und Kaution
als wiederverwendbare Vorlage (Lodgify-Modell). Beträge/Währung kommen aus den
Daten (properties.currency), nie ein €-Default (Wurzel 4).
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SliceHealth(BaseModel):
    slice: str


class RefundRule(BaseModel):
    """Eine gestaffelte Storno-Regel: X % erstattet, wenn ≥ Y Tage vor Anreise."""

    refund_percent: float = Field(ge=0, le=100)
    days_before_arrival: int = Field(ge=0)


class BookingConditionBase(BaseModel):
    internal_name: str = Field(min_length=1, max_length=255)
    is_default: bool = False

    # Zahlungsplan
    installments: Literal[1, 2, 3] = 1
    first_payment_amount_type: Literal["percent", "absolute"] = "percent"
    first_payment_percent: float | None = Field(default=None, ge=0, le=100)
    first_payment_timing: Literal["on_booking", "days_before_arrival"] = "on_booking"
    first_payment_days: int | None = Field(default=None, ge=0)
    # Fälligkeits-Achse der Restzahlung (2./3. Rate).
    balance_timing: Literal[
        "days_before_arrival",
        "days_after_arrival",
        "days_before_departure",
        "not_scheduled",
    ] = "days_before_arrival"
    balance_days_before_arrival: int | None = Field(default=None, ge=0)
    third_payment_percent: float | None = Field(default=None, ge=0, le=100)
    third_payment_days_before: int | None = Field(default=None, ge=0)

    # Stornierung
    cancellation_mode: Literal["non_refundable", "refundable", "partial"] = (
        "non_refundable"
    )
    refund_rules: list[RefundRule] = Field(default_factory=list)

    # Kaution (optional)
    deposit_required: bool = False
    # preauth = auf Karte autorisieren (empfohlen); manual = manuell erheben.
    deposit_method: Literal["preauth", "manual"] = "preauth"
    deposit_amount_type: Literal["absolute", "percent"] = "absolute"
    deposit_amount: float | None = Field(default=None, ge=0)
    deposit_currency: str | None = None
    preauth_days_before_arrival: int | None = Field(default=None, ge=0)
    release_days_after_departure: int | None = Field(default=None, ge=0)

    # Angebots-Gültigkeit
    quote_validity_hours: int | None = Field(default=None, ge=0)


class BookingConditionCreate(BookingConditionBase):
    pass


class BookingConditionUpdate(BookingConditionBase):
    pass


class BookingConditionResponse(BookingConditionBase):
    id: str
    tenant_id: str
