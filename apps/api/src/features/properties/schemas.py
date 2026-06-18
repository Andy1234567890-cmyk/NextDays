"""Pydantic-Schemas für den properties-Slice (Objekt-Verwaltung).

Bildet die Lodgify-„Rental"-Struktur ab: Stammdaten + strukturierte Adresse +
Ausstattung/Fotos. Sektionen ohne eigene Spalte (Rooms, Sleeping arrangements,
Rental-Info-Detailfelder) liegen flexibel im jsonb-Feld `type_attributes`.
"""
from enum import StrEnum

from pydantic import BaseModel, Field


class PropertyType(StrEnum):
    # public.property_type (Migration 0009, ADR-0007)
    ferienhaus = "ferienhaus"
    appartement = "appartement"
    glamping = "glamping"
    tiny_house = "tiny_house"
    stellplatz = "stellplatz"
    hausboot = "hausboot"


class PropertyStatus(StrEnum):
    # public.property_status (Migration 0003)
    draft = "draft"
    active = "active"
    inactive = "inactive"


class PropertyBase(BaseModel):
    """Gemeinsame, bearbeitbare Felder eines Objekts."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    property_type: PropertyType = PropertyType.ferienhaus
    status: PropertyStatus = PropertyStatus.draft

    # Rental info (Lodgify): Größe, Einheiten, Gäste.
    max_guests: int = Field(default=1, ge=1, le=99)

    # Strukturierte Adresse (Lastenheft §6).
    street: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None

    # Listen.
    amenities: list[str] = Field(default_factory=list)
    photos: list[str] = Field(default_factory=list)

    # Flexible Sektionen (Rooms, Sleeping arrangements, m², Einheiten …).
    # Frei strukturierbar, damit neue Lodgify-Sektionen ohne Migration passen.
    type_attributes: dict = Field(default_factory=dict)


class PropertyCreate(PropertyBase):
    """Anlage eines Objekts. tenant_id kommt aus dem eingeloggten Nutzer."""


class PropertyUpdate(BaseModel):
    """Partielle Aktualisierung — nur gesetzte Felder werden übernommen."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    property_type: PropertyType | None = None
    status: PropertyStatus | None = None
    max_guests: int | None = Field(default=None, ge=1, le=99)
    street: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None
    amenities: list[str] | None = None
    photos: list[str] | None = None
    type_attributes: dict | None = None


class PropertyResponse(PropertyBase):
    id: str
    tenant_id: str
    created_at: str | None = None
    updated_at: str | None = None


class PropertyListResponse(BaseModel):
    items: list[PropertyResponse]
    total: int


class ImageUploadResponse(BaseModel):
    """Antwort auf einen Bild-Upload: öffentliche URL des gespeicherten Bildes."""

    url: str


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
