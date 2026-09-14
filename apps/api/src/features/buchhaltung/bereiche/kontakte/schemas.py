"""Schemas des Bereichs »kontakte« (Ansprechpartner, Anschriften, Notizen,
Kundenübersicht, Lieferanten).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — wie im
Bestand (`CustomerBase`) und im Referenzbereich »mahnwesen«. `extra="ignore"`,
damit portierte Formulare Darstellungsfelder mitschicken dürfen, ohne 422.

Die Literale MÜSSEN mit den `check`-Klauseln in 0666 deckungsgleich bleiben
(Regel „DB-CHECK und Pydantic-Literal deckungsgleich").
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

# Deckungsgleich mit 0666 `check (type in (...))`.
AddressType = Literal["billing", "shipping", "other"]
ADDRESS_TYPES: frozenset[str] = frozenset({"billing", "shipping", "other"})

_KURZ = Field(default=None, max_length=200)
_LANG = Field(default=None, max_length=2000)


def _leer_zu_none(wert: str | None) -> str | None:
    if wert is None:
        return None
    wert = wert.strip()
    return wert or None


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


# --- Ansprechpartner -----------------------------------------------------------


class ContactCreate(_Camel):
    name: str = Field(min_length=1, max_length=200)
    role: str | None = _KURZ
    email: str | None = _KURZ
    phone: str | None = _KURZ
    is_primary: bool = False
    notes: str | None = _LANG

    @field_validator("name", "role", "email", "phone", "notes", mode="before")
    @classmethod
    def _trim(cls, wert: object) -> object:
        return _leer_zu_none(wert) if isinstance(wert, str) else wert


class ContactUpdate(_Camel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = _KURZ
    email: str | None = _KURZ
    phone: str | None = _KURZ
    is_primary: bool | None = None
    notes: str | None = _LANG

    @field_validator("role", "email", "phone", "notes", mode="before")
    @classmethod
    def _trim(cls, wert: object) -> object:
        return _leer_zu_none(wert) if isinstance(wert, str) else wert


class ContactResponse(_Camel):
    id: str
    tenant_id: str
    customer_id: str
    name: str
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary: bool
    notes: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


# --- Anschriften ---------------------------------------------------------------


class AddressCreate(_Camel):
    type: AddressType
    label: str | None = _KURZ
    recipient: str | None = _KURZ
    street: str | None = _KURZ
    house_number: str | None = Field(default=None, max_length=20)
    postal_code: str | None = Field(default=None, max_length=20)
    city: str | None = _KURZ
    # ISO-3166-1 alpha-2, Pflicht (0666 `check (country ~ '^[A-Z]{2}$')`).
    country: str = Field(min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$")
    is_default: bool = False

    @field_validator("country")
    @classmethod
    def _gross(cls, wert: str) -> str:
        return wert.upper()

    @field_validator(
        "label", "recipient", "street", "house_number", "postal_code", "city", mode="before"
    )
    @classmethod
    def _trim(cls, wert: object) -> object:
        return _leer_zu_none(wert) if isinstance(wert, str) else wert


class AddressUpdate(_Camel):
    type: AddressType | None = None
    label: str | None = _KURZ
    recipient: str | None = _KURZ
    street: str | None = _KURZ
    house_number: str | None = Field(default=None, max_length=20)
    postal_code: str | None = Field(default=None, max_length=20)
    city: str | None = _KURZ
    country: str | None = Field(default=None, min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$")
    is_default: bool | None = None

    @field_validator("country")
    @classmethod
    def _gross(cls, wert: str | None) -> str | None:
        return wert.upper() if wert else wert

    @field_validator(
        "label", "recipient", "street", "house_number", "postal_code", "city", mode="before"
    )
    @classmethod
    def _trim(cls, wert: object) -> object:
        return _leer_zu_none(wert) if isinstance(wert, str) else wert


class AddressResponse(_Camel):
    id: str
    tenant_id: str
    customer_id: str
    type: AddressType
    label: str | None = None
    recipient: str | None = None
    street: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str
    is_default: bool
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


# --- Notizen -------------------------------------------------------------------

MAX_TAGS = 20


def _tags_bereinigen(tags: list[str]) -> list[str]:
    """Schlagwörter trimmen, leere raus, Dubletten (ohne Groß/Klein) raus,
    Reihenfolge behalten."""
    gesehen: set[str] = set()
    sauber: list[str] = []
    for roh in tags:
        tag = roh.strip()
        if not tag:
            continue
        schluessel = tag.casefold()
        if schluessel in gesehen:
            continue
        gesehen.add(schluessel)
        sauber.append(tag)
    return sauber


class NoteCreate(_Camel):
    text: str = Field(min_length=1, max_length=5000)
    tags: list[str] = Field(default_factory=list, max_length=MAX_TAGS)

    @field_validator("text", mode="before")
    @classmethod
    def _trim(cls, wert: object) -> object:
        return wert.strip() if isinstance(wert, str) else wert

    @field_validator("tags")
    @classmethod
    def _tags(cls, tags: list[str]) -> list[str]:
        for tag in tags:
            if len(tag) > 50:
                raise ValueError("Ein Schlagwort hat höchstens 50 Zeichen.")
        return _tags_bereinigen(tags)


class NoteUpdate(_Camel):
    text: str | None = Field(default=None, min_length=1, max_length=5000)
    tags: list[str] | None = Field(default=None, max_length=MAX_TAGS)

    @field_validator("text", mode="before")
    @classmethod
    def _trim(cls, wert: object) -> object:
        return wert.strip() if isinstance(wert, str) else wert

    @field_validator("tags")
    @classmethod
    def _tags(cls, tags: list[str] | None) -> list[str] | None:
        if tags is None:
            return None
        for tag in tags:
            if len(tag) > 50:
                raise ValueError("Ein Schlagwort hat höchstens 50 Zeichen.")
        return _tags_bereinigen(tags)


class NoteResponse(_Camel):
    id: str
    tenant_id: str
    customer_id: str
    text: str
    tags: list[str]
    created_by: str | None = None
    author_name: str | None = None
    created_at: datetime
    updated_at: datetime


# --- Kundenübersicht -----------------------------------------------------------


class WaehrungsKennzahlen(_Camel):
    """Kennzahlen EINER Währung. Ein Kunde mit Belegen in zwei Währungen
    bekommt zwei Einträge — Beträge verschiedener Währungen werden NIE
    summiert (Wurzel 4)."""

    currency: str
    revenue_total: Decimal
    open_amount: Decimal
    overdue_amount: Decimal
    invoice_count: int
    open_count: int
    overdue_count: int


class OverviewInvoice(_Camel):
    id: str
    invoice_number: str | None = None
    invoice_type: str
    status: str
    issue_date: date | None = None
    due_date: date | None = None
    gross_amount: Decimal
    paid_amount: Decimal
    open_amount: Decimal
    currency: str
    is_overdue: bool
    created_at: datetime | None = None


class CustomerOverview(_Camel):
    customer_id: str
    by_currency: list[WaehrungsKennzahlen]
    invoice_count: int
    last_invoice_date: date | None = None
    last_invoice_number: str | None = None
    # true, wenn mehr Belege existieren, als die Kennzahlen einbeziehen konnten
    # (harte Obergrenze, Wurzel 8) — dann sind die Summen unvollständig und
    # die UI sagt das, statt eine falsche Zahl groß zu zeigen.
    truncated: bool
    contact_count: int
    address_count: int
    note_count: int
    tags: list[str]
    invoices: list[OverviewInvoice]
