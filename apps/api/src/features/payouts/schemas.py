"""Schemas des Auszahlungs-Slices."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

PayoutInterval = Literal["daily", "weekly", "monthly"]


class PayoutSettings(BaseModel):
    """Auszahlungsrhythmus eines Betriebs (Booking-Modell)."""

    interval: PayoutInterval = "weekly"
    paused: bool = False
    paused_reason: str | None = None


class PayoutSettingsUpdate(BaseModel):
    """Rhythmus ändern. ``paused`` setzt nur die Plattform, nie der Betrieb."""

    interval: PayoutInterval


class PayoutRow(BaseModel):
    """Eine Auszahlung je Buchung."""

    id: str
    reservation_id: str
    gross_amount_cents: int
    platform_fee_cents: int
    donation_cents: int
    cohost_cents: int
    net_amount_cents: int
    currency: str
    status: str
    due_at: datetime
    paid_at: datetime | None = None


class PayoutAdjustmentRow(BaseModel):
    """Ein Verrechnungsposten (Storno nach Auszahlung, Rückbuchung, Gebühr)."""

    id: str
    reservation_id: str | None = None
    kind: str
    amount_cents: int
    settled_cents: int
    currency: str
    note: str | None = None
    created_at: datetime


class PayoutSummary(BaseModel):
    """Summen je Währung — offen und bereits ausgezahlt."""

    currency: str
    pending_amount_cents: int
    paid_amount_cents: int
    count: int


class PayoutOverview(BaseModel):
    """Was die Auszahlungsansicht braucht — in einem Aufruf."""

    settings: PayoutSettings
    summary: list[PayoutSummary]
    recent: list[PayoutRow]
    adjustments: list[PayoutAdjustmentRow]
