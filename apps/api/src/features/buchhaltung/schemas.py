"""Schemas des buchhaltung-Slice (Rechnungen + Kunden).

Übernommen aus Taskilo, auf das NextDays-Mandantenkonzept vereinheitlicht
(tenant_id statt company_id). Beträge als Decimal (Rechnungsgenauigkeit).
"""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


# --- Kunden -----------------------------------------------------------------
class CustomerBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    customer_number: str | None = None
    email: str | None = None
    phone: str | None = None
    vat_id: str | None = None
    tax_number: str | None = None
    is_supplier: bool = False
    customer_type: str = "business"  # private|business
    address: dict = Field(default_factory=dict)
    default_payment_days: int | None = None
    credit_limit: Decimal | None = None
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = None
    customer_number: str | None = None
    email: str | None = None
    phone: str | None = None
    vat_id: str | None = None
    tax_number: str | None = None
    is_supplier: bool | None = None
    customer_type: str | None = None
    address: dict | None = None
    default_payment_days: int | None = None
    credit_limit: Decimal | None = None
    notes: str | None = None


class CustomerResponse(CustomerBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime


class CustomerListResponse(BaseModel):
    items: list[CustomerResponse]
    total: int


# --- Rechnungspositionen ----------------------------------------------------
class LineItemInput(BaseModel):
    description: str = Field(min_length=1)
    quantity: Decimal = Decimal("1")
    unit: str | None = None
    unit_price: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("19")
    discount_percent: Decimal = Decimal("0")
    sku: str | None = None


class LineItemResponse(LineItemInput):
    id: str
    position: int
    net_amount: Decimal
    tax_amount: Decimal
    gross_amount: Decimal


# --- Rechnungen -------------------------------------------------------------
class InvoiceCreate(BaseModel):
    customer_id: str | None = None
    invoice_type: str = "invoice"  # invoice|credit_note|storno
    status: str = "draft"
    issue_date: date | None = None
    due_date: date | None = None
    # Wurzel 4: kein erfundener EUR-Default. Fehlt die Währung, löst der Service
    # sie aus der Mandanten-Währung auf (_tenant_currency, fail-closed 422).
    currency: str | None = None
    tax_rule: str | None = None
    head_text: str | None = None
    footer_text: str | None = None
    notes: str | None = None
    items: list[LineItemInput] = Field(default_factory=list)


class InvoiceUpdate(BaseModel):
    customer_id: str | None = None
    status: str | None = None
    issue_date: date | None = None
    due_date: date | None = None
    tax_rule: str | None = None
    head_text: str | None = None
    footer_text: str | None = None
    notes: str | None = None
    items: list[LineItemInput] | None = None


class InvoiceResponse(BaseModel):
    id: str
    tenant_id: str
    customer_id: str | None = None
    invoice_number: str | None = None
    invoice_type: str
    status: str
    issue_date: date | None = None
    due_date: date | None = None
    currency: str
    net_amount: Decimal
    tax_amount: Decimal
    gross_amount: Decimal
    paid_amount: Decimal
    tax_rule: str | None = None
    is_kleinunternehmer: bool = False
    head_text: str | None = None
    footer_text: str | None = None
    notes: str | None = None
    gobd_status: str = "open"
    is_locked: bool = False
    pdf_url: str | None = None
    # Dokumentsprache des Belegs (0099, Gastsprache); None = Bestand → de.
    language: str | None = None
    created_at: datetime
    updated_at: datetime
    items: list[LineItemResponse] = Field(default_factory=list)


class InvoiceListItem(BaseModel):
    """Schlanke Listenansicht (ohne Positionen)."""
    id: str
    invoice_number: str | None = None
    customer_id: str | None = None
    invoice_type: str
    status: str
    issue_date: date | None = None
    due_date: date | None = None
    gross_amount: Decimal
    currency: str
    is_locked: bool = False
    created_at: datetime


class InvoiceListResponse(BaseModel):
    items: list[InvoiceListItem]
    total: int


# --- Angebote ---------------------------------------------------------------
class QuoteCreate(BaseModel):
    customer_id: str | None = None
    status: str = "draft"  # draft|sent|accepted|rejected|expired|converted
    issue_date: date | None = None
    valid_until: date | None = None
    # Wurzel 4: kein erfundener EUR-Default. Fehlt die Währung, löst der Service
    # sie aus der Mandanten-Währung auf (_tenant_currency, fail-closed 422).
    currency: str | None = None
    tax_rule: str | None = None
    head_text: str | None = None
    footer_text: str | None = None
    notes: str | None = None
    items: list[LineItemInput] = Field(default_factory=list)


class QuoteUpdate(BaseModel):
    customer_id: str | None = None
    status: str | None = None
    issue_date: date | None = None
    valid_until: date | None = None
    tax_rule: str | None = None
    head_text: str | None = None
    footer_text: str | None = None
    notes: str | None = None
    items: list[LineItemInput] | None = None


class QuoteResponse(BaseModel):
    id: str
    tenant_id: str
    customer_id: str | None = None
    quote_number: str | None = None
    status: str
    issue_date: date | None = None
    valid_until: date | None = None
    currency: str
    net_amount: Decimal
    tax_amount: Decimal
    gross_amount: Decimal
    tax_rule: str | None = None
    head_text: str | None = None
    footer_text: str | None = None
    notes: str | None = None
    converted_invoice_id: str | None = None
    pdf_url: str | None = None
    created_at: datetime
    updated_at: datetime
    items: list[LineItemResponse] = Field(default_factory=list)


class QuoteListItem(BaseModel):
    id: str
    quote_number: str | None = None
    customer_id: str | None = None
    status: str
    issue_date: date | None = None
    valid_until: date | None = None
    gross_amount: Decimal
    currency: str
    converted_invoice_id: str | None = None
    created_at: datetime


class QuoteListResponse(BaseModel):
    items: list[QuoteListItem]
    total: int
