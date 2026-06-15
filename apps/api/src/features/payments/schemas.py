"""Pydantic-Schemas für den payments-Slice."""
from enum import StrEnum

from pydantic import BaseModel


class PaymentGateway(StrEnum):
    revolut = "revolut"   # primär (ADR-0003)
    stripe = "stripe"     # sekundär


class PaymentType(StrEnum):
    deposit = "deposit"
    full = "full"
    refund = "refund"


class ChargeRequest(BaseModel):
    reservation_id: str
    amount: float          # glatter Betrag (ADR-0005), Darstellung gerundet
    currency: str
    type: PaymentType = PaymentType.full


class ChargeResult(BaseModel):
    gateway: PaymentGateway
    gateway_ref: str
    status: str


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
