"""Schemas des buchhaltung-Slice (Rechnungen + Kunden).

Übernommen aus Taskilo, auf das NextDays-Mandantenkonzept vereinheitlicht
(tenant_id statt company_id). Beträge als Decimal (Rechnungsgenauigkeit).
"""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


# --- Kunden -----------------------------------------------------------------
# Das übernommene Frontend spricht camelCase (`customerNumber`, `isSupplier`,
# `vatId`) und schickt die Anschrift FLACH (`street`, `postalCode`, `city`,
# `country`) plus `address` als mehrzeiligen Text. Bis zum 11.09.2026 kannte das
# Schema weder Aliase noch die flachen Felder: pydantic verwarf alles außer
# `name`, `email`, `phone` STILL, und der Adress-Text scheiterte an `dict` mit
# 422 — „Kunde anlegen" aus dem Modal ging damit nie durch, und wo es (per
# anderem Aufrufer) durchging, kam ein Kunde ohne Nummer, Anschrift und
# USt-IdNr. an. Beides hier: Aliase und Zusammenführung der Anschrift.
_FLACHE_ANSCHRIFT = (
    ("street", "street"),
    ("houseNumber", "house_number"),
    ("postalCode", "postal_code"),
    ("city", "city"),
    ("country", "country"),
)


def _anschrift_zusammenfuehren(data: object) -> object:
    """Flache Anschriftsfelder und einen Adress-Text in `address` heben."""
    if not isinstance(data, dict):
        return data
    roh = data.get("address")
    anschrift: dict = dict(roh) if isinstance(roh, dict) else {}
    if isinstance(roh, str) and roh.strip():
        anschrift.setdefault("text", roh.strip())
    for camel, snake in _FLACHE_ANSCHRIFT:
        wert = data.get(camel, data.get(snake))
        if isinstance(wert, str) and wert.strip():
            anschrift[snake] = wert.strip()
    if anschrift or "address" in data:
        data = {**data, "address": anschrift}
    return data


class CustomerBase(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="ignore"
    )

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
    # Nur für die Nummernvergabe (Kunde|Lieferant|Partner|Interessenten);
    # keine Spalte — `exclude=True` hält es aus dem Insert heraus.
    organization_type: str | None = Field(default=None, exclude=True)

    @model_validator(mode="before")
    @classmethod
    def _anschrift(cls, data: object) -> object:
        return _anschrift_zusammenfuehren(data)


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="ignore"
    )

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

    @model_validator(mode="before")
    @classmethod
    def _anschrift(cls, data: object) -> object:
        return _anschrift_zusammenfuehren(data)


class CustomerResponse(CustomerBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime


class CustomerListResponse(BaseModel):
    items: list[CustomerResponse]
    total: int


# --- Rechnungspositionen ----------------------------------------------------
# Abrechnungsbasis einer Position (0698): pauschal, je Nacht, je Person,
# je Person und Nacht, je Stück. Spiegelt addons.schemas.AddonBasis plus
# per_guest_night (Kurtaxe, Frühstück). Die Menge folgt aus Basis × Nächte/
# Personen des Belegkopfs — gerechnet im Editor, gespeichert als Zahl.
POSITIONS_BASEN: frozenset[str] = frozenset(
    {"per_stay", "per_night", "per_guest", "per_guest_night", "per_unit"}
)


class LineItemInput(BaseModel):
    description: str = Field(min_length=1)
    quantity: Decimal = Decimal("1")
    unit: str | None = None
    unit_price: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("19")
    discount_percent: Decimal = Decimal("0")
    sku: str | None = None
    basis: str | None = None
    # Aufenthalt DIESER Zeile (0702): Objekt und Zeitraum stehen an der
    # Übernachtungsposition, nicht nur im Belegkopf — ein Beleg über zwei
    # Zimmer oder zwei Zeiträume war sonst nicht darstellbar.
    property_id: str | None = None
    check_in: date | None = None
    check_out: date | None = None
    # Elternzeile einer Zusatzleistung. Im REQUEST steht hier die CLIENT-seitige
    # Zeilen-ID (der Editor kennt die DB-IDs nicht, die Zeilen werden bei jedem
    # Speichern neu angelegt); in die Spalte `parent_line_id` kommt die echte
    # Zeilen-UUID, aufgelöst NACH dem Insert (positionen_kontext.eltern_*).
    # Deshalb kein UUID-Typ hier.
    parent_line_id: str | None = None
    # Eigene Client-ID der Zeile — nur Transport, wird nicht gespeichert; sie
    # ist das Gegenstück, gegen das `parent_line_id` aufgelöst wird.
    client_line_id: str | None = None

    @model_validator(mode="after")
    def _basis_pruefen(self) -> "LineItemInput":
        if self.basis is not None and self.basis not in POSITIONS_BASEN:
            raise ValueError(f"Unbekannte Abrechnungsbasis „{self.basis}“.")
        return self

    @model_validator(mode="after")
    def _zeitraum_pruefen(self) -> "LineItemInput":
        """Abreise muss echt nach der Anreise liegen (wie der CHECK in 0702).

        Fail-closed statt Korrektur: ein verdrehter Zeitraum ist ein Eingabe-
        fehler, kein Anlass, die Daten zu tauschen (Wurzel 4)."""
        if (
            self.check_in is not None
            and self.check_out is not None
            and self.check_out <= self.check_in
        ):
            raise ValueError("Abreise muss nach der Anreise liegen.")
        return self


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
    # Dokumentsprache (0700) — wie invoices.language; None = de bei der Anzeige.
    language: str | None = None
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
    # Aufenthalt des Angebots (0698/0701) für die Liste: Objekt und Zeitraum
    # stehen neben Kunde und Betrag — ohne sie ist eine Angebotsliste eines
    # Beherbergungsbetriebs nicht lesbar.
    property_id: str | None = None
    property_title: str | None = None
    stay_from: date | None = None
    stay_to: date | None = None
    guest_count: int | None = None


class QuoteListResponse(BaseModel):
    items: list[QuoteListItem]
    total: int
