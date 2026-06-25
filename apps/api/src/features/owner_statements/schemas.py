"""Pydantic-Schemas für den owner_statements-Slice (Owner-Statements + Expenses).

Spiegelt die Hostaway-„Owner Statements": Kopf-Snapshot (PM + Owner), Filter,
Summen, Rental activity (per reservation/listing) und Expenses & Extras.
"""
from datetime import date as date_
from enum import StrEnum

from pydantic import BaseModel, Field


class StatementBasis(StrEnum):
    check_in = "check_in"
    check_out = "check_out"


class StatementStatus(StrEnum):
    draft = "draft"
    finalized = "finalized"
    cancelled = "cancelled"


class StatementKind(StrEnum):
    invoice = "invoice"
    cancellation = "cancellation"


class TaxBreakdown(BaseModel):
    """EN-16931-Steueraufschlüsselung (BG-23) — eingefroren bei Finalisierung."""

    category: str = "S"  # EN BT-118: S | AE | E | Z
    rate: float = 0
    net: float = 0
    tax: float = 0
    gross: float = 0
    exemption_reason: str | None = None


# --- Expenses & Extras -------------------------------------------------------


class ExpenseBase(BaseModel):
    concept: str = Field(min_length=1, max_length=300)
    date: date_
    category: str | None = None
    listing_id: str | None = None
    reservation_id: str | None = None
    owner_id: str | None = None
    amount: float
    attachment_url: str | None = None
    hidden_from_owner: bool = False


class ExpenseCreate(ExpenseBase):
    statement_id: str | None = None


class ExpenseUpdate(BaseModel):
    concept: str | None = Field(default=None, min_length=1, max_length=300)
    date: date_ | None = None
    category: str | None = None
    listing_id: str | None = None
    reservation_id: str | None = None
    owner_id: str | None = None
    amount: float | None = None
    attachment_url: str | None = None
    hidden_from_owner: bool | None = None


class ExpenseResponse(ExpenseBase):
    id: str
    tenant_id: str
    statement_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


# --- Rental activity ---------------------------------------------------------


class RentalRow(BaseModel):
    """Eine Zeile der Rental activity (Per reservation).

    Beträge in der QUELLWÄHRUNG der Buchung (currency). owner_payout ist der
    Buchungssatz = Auszahlung − Provision in Quellwährung. Liegt die Owner-
    Zielwährung anders, trägt owner_payout_converted den in Owner-Währung
    umgerechneten Betrag samt verwendetem Tageskurs (fx_rate) und Stichtag
    (fx_date, Check-out). Bei gleicher Währung bleibt fx_rate = 1.
    """

    reservation_id: str
    guest: str | None = None
    nights: int
    listing_id: str
    listing: str | None = None
    channel: str
    total_price: float
    total_payout: float
    currency: str = "EUR"
    owner_payout: float = 0.0
    owner_payout_converted: float = 0.0
    fx_rate: float = 1.0
    fx_date: date_ | None = None


class ListingRow(BaseModel):
    """Eine Zeile der Rental activity (Per listing, aggregiert)."""

    listing_id: str
    listing: str | None = None
    nights: int
    reservations: int
    total_price: float
    total_payout: float


# --- Statement-Kopf (Snapshot PM + Owner) ------------------------------------


class StatementHeader(BaseModel):
    pm_name: str | None = None
    pm_email: str | None = None
    pm_phone: str | None = None
    pm_address: str | None = None
    pm_tax_id: str | None = None
    pm_logo_url: str | None = None
    owner_name: str | None = None
    owner_email: str | None = None
    owner_phone: str | None = None
    owner_address: str | None = None
    owner_tax_id: str | None = None
    invoice_number: str | None = None
    notes: str | None = None


# --- Statement: erzeugen / aktualisieren / Antwort ---------------------------


class StatementGenerateRequest(BaseModel):
    """Statement erzeugen: Owner + Zeitraum + Filter. PM/Owner-Kopf wird aus den
    Stammdaten vorbefüllt (überschreibbar per Update)."""

    owner_id: str
    period_from: date_
    period_to: date_
    basis: StatementBasis = StatementBasis.check_in
    reservation_statuses: list[str] = Field(default_factory=list)
    commission_pct: float | None = Field(default=None, ge=0, le=100)


class StatementUpdate(BaseModel):
    """Kopf-Daten + Provision (Deduct percentage) + Filter/Zeitraum aktualisieren."""

    header: StatementHeader | None = None
    commission_pct: float | None = Field(default=None, ge=0, le=100)
    basis: StatementBasis | None = None
    reservation_statuses: list[str] | None = None
    period_from: date_ | None = None
    period_to: date_ | None = None


class CurrencyAmount(BaseModel):
    """Betrag mit Währung — für je-Währung getrennte Summen (keine Mischsumme)."""

    currency: str
    amount: float


class StatementSummary(BaseModel):
    total_price: float
    total_payout: float
    expenses_total: float
    owner_payout: float
    pm_payout: float
    currency: str
    booking_count: int
    # Owner-Zielwährung (aus Herkunftsland). owner_payout ist in DIESER Währung
    # (Summe der umgerechneten Buchungssätze).
    owner_currency: str = "EUR"
    # Verwaltungs-Auszahlung bleibt in der jeweiligen Quellwährung — je Währung
    # getrennt, da Beträge verschiedener Währungen nicht addiert werden dürfen.
    pm_payout_by_currency: list[CurrencyAmount] = Field(default_factory=list)
    # Mieteinnahmen/Auszahlung je Quellwährung (Anzeige; keine Mischsumme).
    totals_by_currency: list[CurrencyAmount] = Field(default_factory=list)


class StatementResponse(BaseModel):
    id: str
    tenant_id: str
    owner_id: str
    period_from: date_
    period_to: date_
    basis: StatementBasis
    reservation_statuses: list[str]
    status: StatementStatus
    kind: StatementKind = StatementKind.invoice
    commission_pct: float
    header: StatementHeader
    summary: StatementSummary
    # Beleg-/Steuer-Metadaten (EN 16931) — bei Finalisierung gesetzt.
    invoice_date: date_ | None = None
    due_date: date_ | None = None
    supply_country: str | None = None
    buyer_vat_id: str | None = None
    tax: TaxBreakdown = Field(default_factory=TaxBreakdown)
    # Storno-Verknüpfung.
    cancels_statement_id: str | None = None
    cancelled_by_statement_id: str | None = None
    rental_rows: list[RentalRow] = Field(default_factory=list)
    listing_rows: list[ListingRow] = Field(default_factory=list)
    expenses: list[ExpenseResponse] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class StatementListItem(BaseModel):
    id: str
    owner_id: str
    owner_name: str | None = None
    period_from: date_
    period_to: date_
    status: StatementStatus
    owner_payout: float
    pm_payout: float
    currency: str
    invoice_number: str | None = None
    created_at: str | None = None


class StatementListResponse(BaseModel):
    items: list[StatementListItem]
    total: int


class AutoStatementRunResponse(BaseModel):
    generated: int
    owners: int


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
