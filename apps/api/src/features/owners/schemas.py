"""Pydantic-Schemas für den owners-Slice (verwaltete Eigentümer).

Die verwaltete Eigentümer-PARTEI (Stammdaten, Bankverbindung, Default-Provision)
getrennt vom Owner-Login-User. Objekt-Zuordnung mit Anteil + Provisions-Override.
"""
from enum import StrEnum

from pydantic import BaseModel, Field


class StatementFrequency(StrEnum):
    # public.owners.statement_frequency (Migration 0063)
    none = "none"
    monthly = "monthly"


class OwnerBase(BaseModel):
    """Gemeinsame, bearbeitbare Stammdaten eines Eigentümers."""

    name: str = Field(min_length=1, max_length=200)
    company: str | None = None
    email: str | None = None
    phone: str | None = None

    # Strukturierte Adresse.
    street: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None

    tax_id: str | None = None
    vat_id: str | None = None

    # Auszahlungs-Bankdaten.
    iban: str | None = None
    bic: str | None = None
    bank_name: str | None = None
    account_holder: str | None = None

    # Provision + Auszahlungs-/Statement-Konfig.
    default_commission_pct: float = Field(default=0, ge=0, le=100)
    default_payout_method: str | None = None
    statement_frequency: StatementFrequency = StatementFrequency.none
    notes: str | None = None

    # Optionale Verknüpfung zum Owner-Login-User (Self-Service-Portal).
    user_id: str | None = None


class OwnerCreate(OwnerBase):
    """Anlage eines Eigentümers. tenant_id kommt aus dem eingeloggten Nutzer."""


class OwnerUpdate(BaseModel):
    """Partielle Aktualisierung — nur gesetzte Felder werden übernommen."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    street: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    tax_id: str | None = None
    vat_id: str | None = None
    iban: str | None = None
    bic: str | None = None
    bank_name: str | None = None
    account_holder: str | None = None
    default_commission_pct: float | None = Field(default=None, ge=0, le=100)
    default_payout_method: str | None = None
    statement_frequency: StatementFrequency | None = None
    notes: str | None = None
    user_id: str | None = None


class OwnerPropertyLink(BaseModel):
    """Ein Objekt-Zuordnungs-Eintrag eines Eigentümers."""

    property_id: str
    ownership_share: float = Field(default=100, ge=0, le=100)
    commission_override_pct: float | None = Field(default=None, ge=0, le=100)


class OwnerResponse(OwnerBase):
    id: str
    tenant_id: str
    properties: list[OwnerPropertyLink] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class OwnerListItem(OwnerBase):
    """Listen-Eintrag: Stammdaten + Anzahl zugeordneter Objekte (ohne Detail)."""

    id: str
    tenant_id: str
    property_count: int = 0
    created_at: str | None = None
    updated_at: str | None = None


class OwnerListResponse(BaseModel):
    items: list[OwnerListItem]
    total: int


class OwnerPropertyAssign(BaseModel):
    """Objekt einem Eigentümer zuordnen (mit Anteil + Provisions-Override)."""

    property_id: str
    ownership_share: float = Field(default=100, ge=0, le=100)
    commission_override_pct: float | None = Field(default=None, ge=0, le=100)


class AvailableProperty(BaseModel):
    """Objekt, das einem Eigentümer zugeordnet werden darf: entweder frei (keinem
    Owner zugeordnet) oder bereits diesem Owner. So bleibt ein Objekt exklusiv
    bei einem Eigentümer (kein Mehrfach-Owner)."""

    id: str
    title: str


class AvailablePropertiesResponse(BaseModel):
    items: list[AvailableProperty]


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
