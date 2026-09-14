"""Schemas des Bereichs »steuer« (Umsatzsteuer-Auswertung, Meldungen, EÜR-Vorschau).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — wie in
den Nachbar-Bereichen.

Die Literale MÜSSEN mit den `check`-Klauseln in 0675/0676 deckungsgleich
bleiben (Regel „DB-CHECK und Pydantic-Literal deckungsgleich": 'stripe' fehlte
einmal im Schema → 500 beim LESEN, ganzes Dashboard tot).

Länderneutral: die Auswertung liefert ZEILEN je (Kategorie, Steuersatz). Die
deutsche Kennzahlen-Zuordnung (Kz 81/86/66/83) ist ein separates Mapping
(`de_ustva.py`) und hängt als `mapping` an der Antwort — nur, wenn das Land des
Betriebs DE ist. Andere Länder bekommen ein leeres Mapping und nur die Zeilen.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# Deckungsgleich mit 0675 `check (status in (...))`.
ReturnStatus = Literal["draft", "submitted", "corrected"]
RETURN_STATUSES: frozenset[str] = frozenset({"draft", "submitted", "corrected"})
# Deckungsgleich mit 0675 `check (period_kind in (...))` und 0676 `vat_period`.
PeriodKind = Literal["month", "quarter", "year"]
PERIOD_KINDS: frozenset[str] = frozenset({"month", "quarter", "year"})

# Kategorien der länderneutralen Umsatzzeilen. `taxable` trägt je Steuersatz
# eine Zeile; die übrigen sind Steuerregeln ohne eigenen Satz (Netto zählt).
SalesCategory = Literal[
    "taxable",  # steuerpflichtig, Satz aus der Position
    "exempt",  # steuerfrei (ohne Vorsteuerabzug)
    "reverse_charge_domestic",  # Steuerschuld beim Leistungsempfänger (Inland)
    "reverse_charge_eu",  # sonstige Leistung an EU-Unternehmer
    "intra_community_supply",  # innergemeinschaftliche Lieferung
    "export",  # Ausfuhr Drittland
    "out_of_scope",  # nicht steuerbar
    "oss",  # One-Stop-Shop (im Bestimmungsland versteuert)
    "undetermined",  # Satz nicht ermittelbar — Datenfehler, prüfen
]


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


# --- Umsatzsteuer-Auswertung ---------------------------------------------------


class SalesLine(_Camel):
    """Eine Zeile der Umsatzseite: Kategorie + Satz → Netto und Steuer."""

    category: SalesCategory
    tax_rate: Decimal | None = None
    net: Decimal
    tax: Decimal
    invoice_count: int


class InputTaxLine(_Camel):
    """Eine Zeile der Vorsteuerseite: Satz → Netto und abziehbare Vorsteuer."""

    tax_rate: Decimal | None = None
    net: Decimal
    tax: Decimal
    expense_count: int


class MappedFigure(_Camel):
    """Eine Kennzahl des Landes-Formulars (bei DE: Kz 81, 86, 66, 83 …)."""

    code: str
    label: str
    amount: Decimal
    kind: Literal["net", "tax", "result"]
    source: str  # welche Zeile(n) einflossen — für die Nachvollziehbarkeit


class VatReturnResponse(_Camel):
    period: str
    period_kind: PeriodKind
    period_start: date
    period_end: date
    country: str
    currency: str
    small_business: bool
    sales: list[SalesLine]
    input_tax: list[InputTaxLine]
    sales_net_total: Decimal
    sales_tax_total: Decimal
    input_tax_total: Decimal
    payable: Decimal  # > 0 Zahllast, < 0 Erstattung
    mapping_scheme: str | None = None  # z. B. "DE_USTVA"; None = kein Mapping
    mapping: list[MappedFigure] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    # Was ein Freeze exakt so speichern würde — die Oberfläche zeigt, ob eine
    # eingefrorene Version mit den Live-Werten übereinstimmt.
    frozen_version: int | None = None


class FreezeRequest(_Camel):
    period: str = Field(min_length=4, max_length=8)
    note: str | None = Field(default=None, max_length=2000)


class TaxReturnResponse(_Camel):
    id: str
    period: str
    period_kind: PeriodKind
    period_start: date
    period_end: date
    version: int
    status: ReturnStatus
    country: str
    currency: str
    small_business: bool
    values: dict
    mapping: dict
    sales_net_total: Decimal
    sales_tax_total: Decimal
    input_tax_total: Decimal
    payable: Decimal
    submitted_at: datetime | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class TaxReturnListResponse(_Camel):
    items: list[TaxReturnResponse]
    total: int


class TaxReturnUpdate(_Camel):
    """PATCH /tax/returns/{id}: Status und Notiz. `submitted_at` darf der Nutzer
    setzen (er hat die Meldung von Hand abgegeben) — fehlt es beim Wechsel auf
    `submitted`, nimmt der Server den Zeitpunkt des Aufrufs (das ist UNSERE
    Handlung, kein Fremdereignis, also darf hier unsere Uhr stehen)."""

    status: ReturnStatus | None = None
    submitted_at: datetime | None = None
    note: str | None = Field(default=None, max_length=2000)


# --- EÜR-Vorschau ---------------------------------------------------------------


class ProfitMonth(_Camel):
    month: int
    income_net: Decimal
    expenses_net: Decimal
    profit: Decimal
    cumulative_profit: Decimal
    estimated_tax: Decimal | None = None  # None = keine Parameter gesetzt


class ProfitEstimateResponse(_Camel):
    year: int
    currency: str
    months: list[ProfitMonth]
    income_net_total: Decimal
    expenses_net_total: Decimal
    profit_total: Decimal
    estimated_tax_total: Decimal | None = None
    estimated_reserve: Decimal | None = None
    tax_rate_total: Decimal | None = None  # income + trade, wie gerechnet wurde
    settings_complete: bool
    warnings: list[str] = Field(default_factory=list)


# --- Einstellungen --------------------------------------------------------------


class TaxSettingsUpdate(_Camel):
    """PUT /tax/settings: alles optional — leer lassen heißt „keine Schätzung",
    nie ein stiller Ersatzwert."""

    income_tax_rate: Decimal | None = Field(default=None, ge=0, le=100)
    trade_tax_rate: Decimal | None = Field(default=None, ge=0, le=100)
    vat_period: PeriodKind | None = None
    reserve_rate: Decimal | None = Field(default=None, ge=0, le=100)
    note: str | None = Field(default=None, max_length=2000)


class TaxSettingsResponse(_Camel):
    income_tax_rate: Decimal | None = None
    trade_tax_rate: Decimal | None = None
    vat_period: PeriodKind | None = None
    reserve_rate: Decimal | None = None
    note: str | None = None
    country: str | None = None
    currency: str | None = None
    small_business: bool
    configured: bool  # income_tax_rate gesetzt → Schätzung möglich
    updated_at: datetime | None = None
