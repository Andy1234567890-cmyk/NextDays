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


# --- Gast-Zahlung / Kaution / Refund ---------------------------------------

class BookingPaymentResult(BaseModel):
    """Antwort auf die Intent-Erstellung: client_secret für das Payment Element.

    Das client_secret wird NICHT in der DB gespeichert (nur an den Browser für
    die clientseitige Bestätigung)."""

    client_secret: str
    payment_id: str
    publishable_key: str          # Frontend braucht den Stripe-Public-Key


class PaymentRow(BaseModel):
    """Eine Zahlung (gast-/tenant-sichtbar, ohne Stripe-Internas)."""

    id: str
    reservation_id: str
    amount: float
    currency: str | None = None
    type: PaymentType
    status: str
    gateway: PaymentGateway


class RefundRequest(BaseModel):
    """Teil-/Vollerstattung zu einer bestehenden Zahlung. amount=None = voll."""

    amount: float | None = None


class DepositCaptureRequest(BaseModel):
    """Kaution einziehen (Schaden). amount=None = Vollbetrag der Vorautorisierung."""

    amount: float | None = None


# --- Stripe Connect --------------------------------------------------------

class ConnectAccountCreate(BaseModel):
    """Request: Stripe Custom Account für einen Gastgeber anlegen."""
    email: str
    country: str = "DE"          # ISO-3166-1 Alpha-2 (Standard: Deutschland)
    tenant_id: str                # interner Tenant → wird als Metadata gespeichert
    # "individual" (Einzelperson) oder "company" (Firma) — bestimmt die Stripe-
    # Pflichtfelder. Default individual (häufigster Fall bei Vermietern).
    business_type: str = "individual"

class ConnectAccountResponse(BaseModel):
    """Response nach Account-Erstellung (Custom: KEIN hosted Onboarding-Link —
    die KYC-Erfassung läuft über die eigene Dashboard-UI)."""
    stripe_account_id: str        # acct_...

class ConnectAccountStatus(BaseModel):
    """Status eines verbundenen Gastgeber-Accounts (für die eigene Onboarding-UI)."""
    stripe_account_id: str
    charges_enabled: bool         # kann Zahlungen empfangen
    payouts_enabled: bool         # kann Auszahlungen erhalten
    details_submitted: bool       # KYC vollständig eingereicht
    requirements: list[str]       # offene Pflichtfelder (leer = alles OK)
    disabled_reason: str | None = None  # warum der Account (noch) gesperrt ist


class ConnectAccountUpdate(BaseModel):
    """Geschäfts-/Inhaberdaten an den Custom-Account (eigene Onboarding-UI).
    ``fields`` ist das Stripe-Account-Update (business_profile/company/individual)."""
    fields: dict[str, object]


class ExternalAccountRequest(BaseModel):
    """Auszahlungs-Bankkonto (IBAN) am Custom-Account hinterlegen."""
    iban: str
    account_holder: str
    country: str = "DE"


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
