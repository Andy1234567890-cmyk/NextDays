"""Pydantic-Schemas für den payments-Slice."""
from enum import StrEnum

from pydantic import BaseModel


class PaymentGateway(StrEnum):
    stripe = "stripe"     # primär
    revolut = "revolut"   # sekundär


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


# --- Stripe Connect --------------------------------------------------------

class ConnectAccountCreate(BaseModel):
    """Request: Stripe Custom Account für einen Gastgeber anlegen."""
    email: str
    country: str = "DE"          # ISO-3166-1 Alpha-2 (Standard: Deutschland)
    tenant_id: str                # interner Tenant → wird als Metadata gespeichert

class ConnectAccountResponse(BaseModel):
    """Response nach Account-Erstellung."""
    stripe_account_id: str        # acct_...
    onboarding_url: str           # einmaliger Link zum White-Label-Onboarding
    expires_at: int               # Unix-Timestamp, wann der Link abläuft

class ConnectAccountStatus(BaseModel):
    """Status eines verbundenen Gastgeber-Accounts."""
    stripe_account_id: str
    charges_enabled: bool         # kann Zahlungen empfangen
    payouts_enabled: bool         # kann Auszahlungen erhalten
    details_submitted: bool       # KYC vollständig eingereicht
    requirements: list[str]       # offene Pflichtfelder (leer = alles OK)


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
