"""Schemas des Bereichs »ausgaben« (Eingangsbelege, Kategorien, Belegausleser).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — so passt
der Bestands-Aufruf aus `ImportXRechnungDialog.tsx` (`vendor`, `invoiceNumber`,
`vatRate`, `netAmount`, `amount`) ohne Umbau. Wo der Bestand einen ANDEREN
Namen als unseren schickt, nimmt `AliasChoices` beide an; intern gibt es nur
einen.

Die Literale MÜSSEN mit den `check`-Klauseln in 0655/0656 deckungsgleich
bleiben (Regel „DB-CHECK und Pydantic-Literal deckungsgleich": 'stripe' fehlte
einmal im Schema → 500 beim LESEN, ganzes Dashboard tot).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# Deckungsgleich mit 0656 `check (payment_status in (...))`.
PaymentStatus = Literal["open", "paid", "cancelled"]
PAYMENT_STATUSES: frozenset[str] = frozenset({"open", "paid", "cancelled"})
# Deckungsgleich mit 0656 `check (recurring_interval in (...))`.
RecurringInterval = Literal["daily", "weekly", "monthly", "quarterly", "yearly"]
RECURRING_INTERVALS: frozenset[str] = frozenset(
    {"daily", "weekly", "monthly", "quarterly", "yearly"}
)
# Deckungsgleich mit 0655 `check (kind in (...))`.
CategoryKind = Literal["einkauf", "betrieb", "personal", "steuern", "sonstiges"]
# Deckungsgleich mit 0656 `check (source in (...))`.
ExpenseSource = Literal["manual", "xrechnung", "ocr", "recurring"]

# Harte Obergrenzen (Wurzel 8).
MAX_LIMIT = 500
MAX_ZEITRAUM_TAGE = 366


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


# --- Kategorien ----------------------------------------------------------------


class ExpenseCategoryCreate(_Camel):
    name: str = Field(min_length=1, max_length=120)
    kind: CategoryKind
    booking_account: str | None = Field(default=None, max_length=20)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    abbreviation: str | None = Field(default=None, max_length=5)


class ExpenseCategoryUpdate(_Camel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    kind: CategoryKind | None = None
    booking_account: str | None = Field(default=None, max_length=20)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    abbreviation: str | None = Field(default=None, max_length=5)
    is_active: bool | None = None


class ExpenseCategoryResponse(_Camel):
    id: str
    tenant_id: str
    name: str
    kind: CategoryKind
    booking_account: str | None = None
    color: str | None = None
    abbreviation: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# --- Ausgaben ------------------------------------------------------------------


class ExpenseCreate(_Camel):
    """POST /expenses.

    Beträge: der Client liefert Brutto (`amount`/`grossAmount`) ODER Netto
    (`netAmount`) plus den Steuersatz; der Server rechnet den Rest. Liefert er
    mehrere und sie passen nicht zusammen (> 2 Cent Abweichung), 422 — kein
    stilles „wir nehmen den ersten". `taxRate` ist PFLICHT: es gibt keinen
    Standardsatz, der für 27 Länder richtig wäre (Wurzel 4).

    Aliase des XRechnung-Imports (`convertToExpenseData`): `amount`,
    `vendor`/`companyName`, `invoiceNumber`, `date`, `vatAmount`, `vatRate`,
    `companyAddress`, `companyVatNumber`, `contactEmail`, `contactPhone`.
    `companyId` wird ignoriert — autoritativ ist der Tenant aus dem JWT.
    """

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    supplier_id: str | None = Field(
        default=None, validation_alias=AliasChoices("supplierId", "supplier_id", "customerId")
    )
    supplier_name: str | None = Field(
        default=None,
        max_length=200,
        validation_alias=AliasChoices("supplierName", "supplier_name", "vendor", "companyName"),
    )
    supplier_address: str | None = Field(
        default=None,
        max_length=1000,
        validation_alias=AliasChoices("supplierAddress", "supplier_address", "companyAddress"),
    )
    supplier_vat_id: str | None = Field(
        default=None,
        max_length=40,
        validation_alias=AliasChoices("supplierVatId", "supplier_vat_id", "companyVatNumber"),
    )
    supplier_email: str | None = Field(
        default=None,
        max_length=200,
        validation_alias=AliasChoices("supplierEmail", "supplier_email", "contactEmail"),
    )
    supplier_phone: str | None = Field(
        default=None,
        max_length=60,
        validation_alias=AliasChoices("supplierPhone", "supplier_phone", "contactPhone"),
    )
    receipt_number: str | None = Field(
        default=None,
        max_length=100,
        validation_alias=AliasChoices("receiptNumber", "receipt_number", "invoiceNumber"),
    )
    expense_date: date = Field(
        validation_alias=AliasChoices("expenseDate", "expense_date", "date")
    )
    due_date: date | None = None
    payment_terms: str | None = Field(default=None, max_length=200)
    gross_amount: Decimal | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("grossAmount", "gross_amount", "amount"),
    )
    net_amount: Decimal | None = Field(default=None, ge=0)
    tax_amount: Decimal | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("taxAmount", "tax_amount", "vatAmount"),
    )
    tax_rate: Decimal = Field(
        ge=0, le=100, validation_alias=AliasChoices("taxRate", "tax_rate", "vatRate")
    )
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    tax_deductible: bool | None = None
    category_id: str | None = None
    # Kategorie als NAME (XRechnung-Import schickt "Sonstiges"): wird gegen die
    # Kategorien des Mandanten aufgelöst; unbekannt → nur als Schnappschuss.
    category: str | None = Field(default=None, max_length=120)
    booking_account: str | None = Field(default=None, max_length=20)
    cost_center: str | None = Field(default=None, max_length=60)
    payment_status: PaymentStatus = "open"
    payment_method: str | None = Field(default=None, max_length=60)
    paid_at: date | None = None
    is_recurring: bool = False
    recurring_interval: RecurringInterval | None = None
    next_due_date: date | None = None
    notes: str | None = Field(default=None, max_length=4000)
    ocr_raw: dict | None = None
    source: ExpenseSource = "manual"


class ExpenseUpdate(_Camel):
    """PATCH /expenses/{id}. Beträge werden bei Änderung NEU gerechnet: wer
    einen Betrag ändert, muss den Steuersatz mitgeben oder den gespeicherten
    gelten lassen. Gesperrte Belege (GoBD) lassen Fachdaten nicht mehr zu."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    supplier_id: str | None = None
    supplier_name: str | None = Field(default=None, max_length=200)
    supplier_address: str | None = Field(default=None, max_length=1000)
    supplier_vat_id: str | None = Field(default=None, max_length=40)
    supplier_email: str | None = Field(default=None, max_length=200)
    supplier_phone: str | None = Field(default=None, max_length=60)
    receipt_number: str | None = Field(default=None, max_length=100)
    expense_date: date | None = None
    due_date: date | None = None
    payment_terms: str | None = Field(default=None, max_length=200)
    gross_amount: Decimal | None = Field(default=None, ge=0)
    net_amount: Decimal | None = Field(default=None, ge=0)
    tax_amount: Decimal | None = Field(default=None, ge=0)
    tax_rate: Decimal | None = Field(default=None, ge=0, le=100)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    tax_deductible: bool | None = None
    category_id: str | None = None
    booking_account: str | None = Field(default=None, max_length=20)
    cost_center: str | None = Field(default=None, max_length=60)
    payment_status: PaymentStatus | None = None
    payment_method: str | None = Field(default=None, max_length=60)
    paid_at: date | None = None
    is_recurring: bool | None = None
    recurring_interval: RecurringInterval | None = None
    next_due_date: date | None = None
    notes: str | None = Field(default=None, max_length=4000)


class ExpenseResponse(_Camel):
    id: str
    tenant_id: str
    supplier_id: str | None = None
    supplier_name: str | None = None
    supplier_address: str | None = None
    supplier_vat_id: str | None = None
    supplier_email: str | None = None
    supplier_phone: str | None = None
    title: str
    description: str | None = None
    receipt_number: str | None = None
    expense_date: date
    due_date: date | None = None
    payment_terms: str | None = None
    net_amount: Decimal
    tax_amount: Decimal
    gross_amount: Decimal
    tax_rate: Decimal
    currency: str
    tax_deductible: bool | None = None
    category_id: str | None = None
    category_name: str | None = None
    booking_account: str | None = None
    cost_center: str | None = None
    payment_status: PaymentStatus
    payment_method: str | None = None
    paid_at: date | None = None
    is_recurring: bool
    recurring_interval: RecurringInterval | None = None
    next_due_date: date | None = None
    template_id: str | None = None
    has_receipt: bool
    receipt_filename: str | None = None
    receipt_mime: str | None = None
    receipt_size_bytes: int | None = None
    ocr_raw: dict | None = None
    is_locked: bool
    locked_at: datetime | None = None
    notes: str | None = None
    source: ExpenseSource
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


class ExpenseListResponse(_Camel):
    items: list[ExpenseResponse]
    total: int
    # Summen über die gefilterte Liste — je Währung, weil ein Betrieb mit
    # Belegen in zwei Währungen keine eine Summe hat (Wurzel 4).
    sum_gross_by_currency: dict[str, Decimal]


class ReceiptUrlResponse(_Camel):
    url: str
    filename: str | None = None
    mime: str | None = None
    expires_in_seconds: int


class RecurringRunResult(_Camel):
    """POST /expenses/recurring/run: was der Lauf getan hat — ehrlich in
    Zahlen, damit ein „0 angelegt" nachvollziehbar bleibt."""

    templates_checked: int
    created: int
    skipped_existing: int
    created_ids: list[str]


# --- Belegausleser -------------------------------------------------------------


class ReceiptExtraction(_Camel):
    """POST /expenses/ocr/extract-receipt: Vorschläge aus dem Beleg. Nichts
    davon wird gespeichert — die Oberfläche füllt damit das Formular vor, der
    Mensch prüft. `raw` ist die ungefilterte Modellantwort für `ocrRaw`."""

    supplier_name: str | None = None
    supplier_address: str | None = None
    supplier_vat_id: str | None = None
    supplier_email: str | None = None
    receipt_number: str | None = None
    expense_date: date | None = None
    due_date: date | None = None
    net_amount: Decimal | None = None
    tax_amount: Decimal | None = None
    gross_amount: Decimal | None = None
    tax_rate: Decimal | None = None
    currency: str | None = None
    iban: str | None = None
    description: str | None = None
    confidence: Literal["hoch", "mittel", "niedrig"] | None = None
    raw: dict
