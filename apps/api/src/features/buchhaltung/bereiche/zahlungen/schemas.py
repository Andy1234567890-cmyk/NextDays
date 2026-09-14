"""Schemas des Bereichs »zahlungen« (Zahlungskonten, Bankumsätze, Verknüpfungen,
Kassenbuch).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — so passen
die portierten Frontend-Aufrufe (`transactionId`, `documentType`, `bookingStatus`)
ohne Umbau. Die Verknüpfungs-Antwort trägt zusätzlich die ALTE Form
(`transactionData`/`documentData`, id `<tx>_<doc>`), die
`services/transaction-link.service.ts` und `InvoiceListView` lesen.

Die Literale MÜSSEN mit den `check`-Klauseln in 0642/0643/0644/0648
deckungsgleich bleiben (Regel „DB-CHECK und Pydantic-Literal deckungsgleich":
ein fehlender Wert im Schema ist ein 500 beim LESEN, nicht beim Schreiben).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# 0642 `check (type in (...))`
AccountType = Literal["bank", "cash", "paypal", "stripe", "other"]
ACCOUNT_TYPES: frozenset[str] = frozenset({"bank", "cash", "paypal", "stripe", "other"})
# 0648 `check (source in (...))`
TransactionSource = Literal["import", "manual", "opening"]
# Abgeleitet (nicht gespeichert): ignored → ignored, link_count > 0 → matched.
TransactionStatus = Literal["unmatched", "matched", "ignored"]
TRANSACTION_STATUSES: frozenset[str] = frozenset({"unmatched", "matched", "ignored"})
# 0644 `check (document_type in (...))` — gespeichert wird die Kleinschreibung;
# die Großschreibung nimmt der Bestand als Eingabe (`documentType: 'INVOICE'`).
DocumentType = Literal["beleg", "rechnung", "gutschrift", "INVOICE", "EXPENSE", "kassenbuch"]
DocumentTypeInput = Literal["INVOICE", "EXPENSE", "rechnung", "gutschrift", "beleg"]
# 0644 `check (booking_status in (...))`
BookingStatus = Literal["open", "booked"]
# 0644 invoice_payments `check (method in (...))`
PaymentMethod = Literal["bank_transfer", "cash", "card", "paypal", "stripe", "other"]
# 0643 `check (format in (...))` — hier nur CSV; CAMT/MT940 bewusst nicht.
ImportFormat = Literal["csv"]

CURRENCY_PATTERN = r"^[A-Z]{3}$"
# Obergrenzen (Wurzel 8)
MAX_LIMIT = 500
MAX_DATE_SPAN_DAYS = 366
MAX_CSV_BYTES = 5 * 1024 * 1024
MAX_CSV_ROWS = 10_000
MAX_TEXT = 1000


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


# --- Zahlungskonten -----------------------------------------------------------


class PaymentAccountCreate(_Camel):
    """POST /payment-accounts. `currency` darf fehlen — dann die des Betriebs
    (`tenants.currency`); fehlt auch die, 422 (Wurzel 4, nie 'EUR').
    `opening_balance` ≠ 0 wird als ERSTE Buchung (`source='opening'`) auf dem
    Konto verbucht; der Kontostand ist immer die Summe der Buchungen."""

    name: str = Field(min_length=1, max_length=120)
    type: AccountType
    iban: str | None = Field(default=None, max_length=34)
    bic: str | None = Field(default=None, max_length=11)
    bank_name: str | None = Field(default=None, max_length=120)
    currency: str | None = Field(default=None, pattern=CURRENCY_PATTERN)
    opening_balance: Decimal = Field(default=Decimal("0"))
    opening_date: date | None = None
    is_default: bool = False


class PaymentAccountUpdate(_Camel):
    """PATCH /payment-accounts/{id}. Typ und Währung sind NICHT änderbar —
    darauf stehen bereits Buchungen in dieser Währung."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    iban: str | None = Field(default=None, max_length=34)
    bic: str | None = Field(default=None, max_length=11)
    bank_name: str | None = Field(default=None, max_length=120)
    is_default: bool | None = None
    active: bool | None = None


class PaymentAccountResponse(_Camel):
    id: str
    tenant_id: str
    name: str
    type: AccountType
    iban: str | None = None
    bic: str | None = None
    bank_name: str | None = None
    currency: str
    opening_balance: Decimal
    # Summe aller Buchungen (inkl. Anfangsbestand) — serverseitig gerechnet.
    balance: Decimal
    transaction_count: int
    is_default: bool
    active: bool
    created_at: datetime
    updated_at: datetime


# --- Bankumsätze ----------------------------------------------------------------


class BankTransactionCreate(_Camel):
    """POST /bank-transactions: eine von Hand erfasste Buchung (Kasse, oder ein
    Bankumsatz ohne Datei). Währung kommt vom Konto, nie vom Client."""

    payment_account_id: str = Field(min_length=1)
    booking_date: date
    value_date: date | None = None
    amount: Decimal
    counterpart_name: str | None = Field(default=None, max_length=200)
    purpose: str | None = Field(default=None, max_length=MAX_TEXT)
    reference: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=MAX_TEXT)


class BankTransactionUpdate(_Camel):
    """PATCH /bank-transactions/{id}: beiseitelegen / Notiz. Beträge und Daten
    sind Tatsachen der Bank und hier nicht änderbar."""

    ignored: bool | None = None
    note: str | None = Field(default=None, max_length=MAX_TEXT)


class LinkedDocument(_Camel):
    """Kurzform einer Verknüpfung in der Umsatzliste (der Bestand liest
    `linkedInvoices[]` mit genau diesen drei Feldern)."""

    link_id: str
    document_id: str
    document_type: DocumentType
    document_number: str
    customer_name: str
    amount_allocated: Decimal


class BankTransactionResponse(_Camel):
    id: str
    tenant_id: str
    payment_account_id: str
    payment_account_name: str | None = None
    import_batch_id: str | None = None
    booking_date: date
    value_date: date | None = None
    amount: Decimal
    currency: str
    counterpart_name: str | None = None
    counterpart_iban: str | None = None
    counterpart_bic: str | None = None
    purpose: str | None = None
    reference: str | None = None
    transaction_code: str | None = None
    source: TransactionSource
    ignored: bool
    note: str | None = None
    link_count: int
    linked_amount: Decimal
    # amount - linked_amount: was von diesem Umsatz noch zuzuordnen ist.
    remaining_amount: Decimal
    status: TransactionStatus
    linked_documents: list[LinkedDocument] = Field(default_factory=list)
    # Nur UNSER Eingang (Wurzel 5b) — die Bank-Zeitpunkte sind booking/value_date.
    created_at: datetime


class BankTransactionListResponse(_Camel):
    items: list[BankTransactionResponse]
    total: int
    # Summen über die gefilterte Liste (serverseitig).
    sum_in: Decimal
    sum_out: Decimal


# --- CSV-Import -------------------------------------------------------------


Encoding = Literal["auto", "utf-8", "cp1252", "latin-1"]
DecimalSeparator = Literal["auto", ",", "."]


class CsvMapping(_Camel):
    """Spaltenzuordnung als Spaltenindex (0-basiert). `amount` ODER
    (`debit` und/oder `credit`) — deutsche Kontoauszüge führen Soll/Haben
    oft getrennt."""

    date: int = Field(ge=0, le=200)
    amount: int | None = Field(default=None, ge=0, le=200)
    debit: int | None = Field(default=None, ge=0, le=200)
    credit: int | None = Field(default=None, ge=0, le=200)
    name: int | None = Field(default=None, ge=0, le=200)
    purpose: int | None = Field(default=None, ge=0, le=200)
    value_date: int | None = Field(default=None, ge=0, le=200)
    reference: int | None = Field(default=None, ge=0, le=200)
    iban: int | None = Field(default=None, ge=0, le=200)
    currency: int | None = Field(default=None, ge=0, le=200)


class CsvPreviewRequest(_Camel):
    """POST /bank-transactions/import/preview: Kopfzeile + erste Zeilen, damit
    die Oberfläche die Spalten zuordnen kann. Inhalt Base64 (die Server-
    Actions sprechen JSON; ein CSV-Kontoauszug ist klein)."""

    file_name: str = Field(min_length=1, max_length=200)
    content_base64: str = Field(min_length=1)
    delimiter: str | None = Field(default=None, min_length=1, max_length=1)
    has_header: bool = True
    encoding: Encoding = "auto"


class CsvPreviewResponse(_Camel):
    delimiter: str
    encoding: str
    header: list[str]
    rows: list[list[str]]
    row_count: int
    # Aus den Kopfzeilen-Namen geraten (Datum/Betrag/Verwendungszweck …) —
    # nur ein Vorschlag, die Oberfläche zeigt ihn und lässt ihn ändern.
    suggested_mapping: CsvMapping | None = None


class CsvImportRequest(CsvPreviewRequest):
    payment_account_id: str = Field(min_length=1)
    mapping: CsvMapping
    date_format: str | None = Field(default=None, max_length=20)
    decimal_separator: DecimalSeparator = "auto"


class ImportRowError(_Camel):
    row: int
    message: str


class ImportResult(_Camel):
    batch_id: str
    row_count: int
    imported_count: int
    duplicate_count: int
    error_count: int
    errors: list[ImportRowError] = Field(default_factory=list)


# --- Verknüpfungen ----------------------------------------------------------


class BookingAccountRef(_Camel):
    id: str
    number: str = ""
    name: str = ""
    type: str = ""


class TransactionLinkCreate(_Camel):
    """POST /transaction-links: Umsatz ↔ Rechnung/Ausgabe.

    Beträge der Rechnung kommen aus der Rechnung, der Betrag des Umsatzes aus
    dem Umsatz — vom Client nur, WIE VIEL dieses Umsatzes auf den Beleg gehen
    soll (`amount_allocated`, Standard: Restbetrag des Umsatzes) und ein
    Differenzgrund, wenn der Beleg trotz Differenz als erledigt gelten soll.
    """

    transaction_id: str = Field(min_length=1)
    document_type: DocumentTypeInput
    document_id: str = Field(min_length=1)
    amount_allocated: Decimal | None = None
    amount_difference_reason: str | None = Field(default=None, max_length=500)
    booking_account: BookingAccountRef | None = None


class LegacyLinkCreate(_Camel):
    """Body des Bestands (`TransactionLinkService.createLink`): darin stehen
    Rechnungsbeträge, Kundennamen und Datum aus dem Browser — die werden hier
    NICHT übernommen (Wurzel 3), nur die Kennungen und der Differenzgrund."""

    transaction_id: str = Field(min_length=1)
    document_id: str = Field(min_length=1)
    document_type: str = "rechnung"
    amount_difference: Decimal | None = None
    amount_difference_reason: str | None = Field(default=None, max_length=500)
    booking_account: BookingAccountRef | None = None


class BookingStatusUpdate(_Camel):
    booking_status: BookingStatus


class TransactionLinkResponse(_Camel):
    """Alte Form (Bestand) + neue Felder. `id` ist wie alt `<tx>_<doc>`."""

    id: str
    tenant_id: str
    transaction_id: str
    document_id: str
    document_type: DocumentType
    invoice_id: str | None = None
    expense_id: str | None = None
    cashbook_entry_id: str | None = None
    document_number: str
    document_date: date | None = None
    document_amount: Decimal
    customer_name: str
    currency: str
    amount_allocated: Decimal
    amount_difference: Decimal | None = None
    amount_difference_reason: str | None = None
    booking_account: BookingAccountRef | None = None
    booking_status: BookingStatus
    booked_at: datetime | None = None
    link_date: datetime
    created_by: str
    invoice_payment_id: str | None = None
    transaction_data: dict
    document_data: dict
    created_at: datetime
    updated_at: datetime


class SuggestionResponse(_Camel):
    """GET /bank-transactions/{id}/suggestions: eine offene Rechnung, die zu
    diesem Umsatz passen könnte, mit Punktzahl und Gründen."""

    invoice_id: str
    invoice_number: str | None = None
    customer_id: str | None = None
    customer_name: str | None = None
    issue_date: date | None = None
    due_date: date | None = None
    gross_amount: Decimal
    paid_amount: Decimal
    amount_open: Decimal
    currency: str
    status: str
    score: int
    reasons: list[str]


# --- Kassenbuch -------------------------------------------------------------


class CashbookEntryCreate(_Camel):
    """POST /cashbook/entries: Ein- (>0) oder Auszahlung (<0) auf einer Kasse.
    Der Verwendungszweck ist Pflicht — ein Kassenbuch ohne Text ist keins."""

    payment_account_id: str = Field(min_length=1)
    booking_date: date
    amount: Decimal
    purpose: str = Field(min_length=1, max_length=MAX_TEXT)
    counterpart_name: str | None = Field(default=None, max_length=200)
    reference: str | None = Field(default=None, max_length=200)


class CashbookEntry(_Camel):
    id: str
    booking_date: date
    amount: Decimal
    counterpart_name: str | None = None
    purpose: str | None = None
    reference: str | None = None
    source: TransactionSource
    link_count: int
    running_balance: Decimal
    created_at: datetime


class CashbookResponse(_Camel):
    account: PaymentAccountResponse
    month: str
    opening_balance: Decimal
    entries: list[CashbookEntry]
    sum_in: Decimal
    sum_out: Decimal
    closing_balance: Decimal
