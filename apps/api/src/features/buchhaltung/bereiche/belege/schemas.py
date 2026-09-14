"""Schemas des Bereichs »belege« (Belegkette + wiederkehrende Rechnungen).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — wie im
Referenz-Bereich mahnwesen. Ein Beleg ist hier IMMER eine `invoices`-Zeile
(0023) mit `invoice_type`; Angebote (`quotes`, 0024) werden als Belegart
`quote` mitgeführt, weil sie der Anfang der Kette sind.

Die Literale MÜSSEN mit den `check`-Klauseln in 0660/0661 deckungsgleich
bleiben (Regel „DB-CHECK und Pydantic-Literal deckungsgleich").
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# Deckungsgleich mit 0660 `check (invoice_type in (...))`.
BELEGARTEN_INVOICES: frozenset[str] = frozenset(
    {"invoice", "credit_note", "storno", "recurring", "order_confirmation", "delivery_note"}
)
# Plus `quote` (lebt in `quotes`, 0024) — die Belegart, die die Kette beginnt.
Belegart = Literal[
    "quote", "order_confirmation", "delivery_note", "invoice",
    "credit_note", "storno", "recurring",
]
BELEGARTEN: frozenset[str] = BELEGARTEN_INVOICES | {"quote"}

# Zielarten einer Umwandlung — Storno hat seinen eigenen Weg (../../storno.py),
# eine Vorlage entsteht über POST /documents/{id}/recurring.
Zielart = Literal["order_confirmation", "delivery_note", "invoice", "credit_note"]

# Deckungsgleich mit 0661.
RecurringInterval = Literal["weekly", "monthly", "quarterly", "yearly"]
RECURRING_INTERVALS: frozenset[str] = frozenset({"weekly", "monthly", "quarterly", "yearly"})
RecurringStatus = Literal["active", "paused", "completed"]
RECURRING_STATUSES: frozenset[str] = frozenset({"active", "paused", "completed"})

# Rechnungsstatus, wie ihn der Bestand schreibt (0023-Kommentar + `finalized`
# aus dem Versand-Dialog). Kein Literal: der Bestand ist hier nicht per CHECK
# gebunden, ein fremder Wert darf die Liste nicht mit 500 kippen.
MAX_LIMIT = 500


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


# --- Anlegen aus dem Editor ----------------------------------------------------


class PositionInput(_Camel):
    """Eine Position, wie sie der Bestands-Editor schickt (`unitPrice`,
    `taxRate`, `discountPercent`; `category='discount'` = Gesamtrabatt, der im
    Formular positiv gehalten wird und hier abgezogen werden MUSS)."""

    description: str = Field(min_length=1, max_length=2000)
    quantity: Decimal = Field(default=Decimal("1"))
    unit: str | None = Field(default=None, max_length=40)
    unit_price: Decimal = Field(default=Decimal("0"))
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    discount_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    sku: str | None = Field(default=None, max_length=120)
    category: str | None = None


class DocumentCreate(_Camel):
    """POST /documents?type=…: Beleg aus dem EINEN Editor anlegen.

    Beträge kommen NIE vom Client (serverseitig aus den Positionen gerechnet).
    Die Nummer zieht erst POST /documents/{id}/finalize — ein Entwurf trägt
    keine (GoBD-Lückenlosigkeit). `status` wird deshalb hier nicht angenommen.
    """

    customer_id: str | None = None
    issue_date: date | None = None
    due_date: date | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    tax_rule: str | None = Field(default=None, max_length=60)
    head_text: str | None = Field(default=None, max_length=20000)
    head_text_html: str | None = Field(default=None, max_length=20000)  # Alias des Editors
    footer_text: str | None = Field(default=None, max_length=20000)
    notes: str | None = Field(default=None, max_length=4000)
    language: str | None = Field(default=None, max_length=5)
    items: list[PositionInput] = Field(default_factory=list, max_length=500)


class ConvertRequest(_Camel):
    """POST /documents/{id}/convert: Zielart der Kette. `source_type` sagt, in
    welcher Tabelle die Quelle liegt (`quote` → quotes, sonst invoices)."""

    target: Zielart
    source_type: Belegart = "invoice"


class RecurringCreate(_Camel):
    """POST /documents/{id}/recurring: aus einer Rechnung eine Vorlage machen."""

    interval: RecurringInterval
    start_at: date
    end_at: date | None = None


class RecurringUpdate(_Camel):
    """PATCH /documents/{id}/recurring: pausieren/fortsetzen/beenden, Intervall
    oder Termine ändern. Nur gesetzte Felder werden geschrieben."""

    status: RecurringStatus | None = None
    interval: RecurringInterval | None = None
    next_at: date | None = None
    end_at: date | None = None


# --- Antworten -----------------------------------------------------------------


class PositionResponse(_Camel):
    id: str | None = None
    position: int
    description: str
    quantity: Decimal
    unit: str | None = None
    unit_price: Decimal
    tax_rate: Decimal
    discount_percent: Decimal
    net_amount: Decimal
    tax_amount: Decimal
    gross_amount: Decimal
    sku: str | None = None


class DocumentListItem(_Camel):
    id: str
    type: Belegart
    number: str | None = None
    status: str
    customer_id: str | None = None
    customer_name: str | None = None
    issue_date: date | None = None
    # Rechnung: Fälligkeit; Angebot: gültig bis.
    due_date: date | None = None
    currency: str
    net_amount: Decimal
    tax_amount: Decimal
    gross_amount: Decimal
    is_locked: bool = False
    source_document_id: str | None = None
    source_quote_id: str | None = None
    # Angebot: die Rechnung/AB, in die es umgewandelt wurde (0024).
    converted_invoice_id: str | None = None
    # Wiederkehrend (Vorlage) bzw. Lauf-Ergebnis.
    is_recurring_template: bool = False
    recurring_interval: RecurringInterval | None = None
    recurring_status: RecurringStatus | None = None
    recurring_next_at: date | None = None
    recurring_end_at: date | None = None
    recurring_template_id: str | None = None
    recurring_period_start: date | None = None
    created_at: datetime


class DocumentDerived(_Camel):
    """Ein Folgebeleg in der Kette (für die Anzeige „→ LS-0003, RE-0012")."""

    id: str
    type: Belegart
    number: str | None = None
    status: str


class DocumentResponse(DocumentListItem):
    tax_rule: str | None = None
    head_text: str | None = None
    footer_text: str | None = None
    notes: str | None = None
    language: str | None = None
    items: list[PositionResponse] = Field(default_factory=list)
    derived: list[DocumentDerived] = Field(default_factory=list)


class DocumentListResponse(_Camel):
    items: list[DocumentListItem]
    total: int
    type: Belegart


class RecurringRunResult(_Camel):
    """POST /documents/recurring/run: was der Lauf getan hat — je Vorlage."""

    created: int
    skipped: int
    completed: int
    created_ids: list[str] = Field(default_factory=list)
