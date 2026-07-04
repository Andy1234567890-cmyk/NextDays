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
    # Hotel-Zimmertypen (Migration 0098, Betriebsart 'hotel' aus 0090)
    einzelzimmer = "einzelzimmer"
    doppelzimmer = "doppelzimmer"
    zweibettzimmer = "zweibettzimmer"
    familienzimmer = "familienzimmer"
    junior_suite = "junior_suite"
    suite = "suite"


# Typ-Gruppen je Betriebsart (tenants.accommodation_type, Migration 0090).
# Spiegel von apps/web/lib/property-meta.ts (VR_TYPES/HOTEL_TYPES) — die
# UI-Labels leben dort, die Sichtbarkeits-/Validierungs-Wahrheit hier.
VR_TYPES: frozenset[PropertyType] = frozenset(
    {
        PropertyType.ferienhaus,
        PropertyType.appartement,
        PropertyType.glamping,
        PropertyType.tiny_house,
        PropertyType.stellplatz,
        PropertyType.hausboot,
    }
)

HOTEL_TYPES: frozenset[PropertyType] = frozenset(
    {
        PropertyType.einzelzimmer,
        PropertyType.doppelzimmer,
        PropertyType.zweibettzimmer,
        PropertyType.familienzimmer,
        PropertyType.junior_suite,
        PropertyType.suite,
    }
)


def types_for_accommodation(
    accommodation_type: str | None,
) -> frozenset[PropertyType] | None:
    """Erlaubte Objekttypen je Betriebsart; None = keine Einschränkung
    (Tenant ohne gesetzte Betriebsart, Bestand vor Migration 0090)."""
    if accommodation_type == "hotel":
        return HOTEL_TYPES
    if accommodation_type == "vacation_rental":
        return VR_TYPES
    return None


class PropertyStatus(StrEnum):
    # public.property_status (Migration 0003)
    draft = "draft"
    active = "active"
    inactive = "inactive"


class PropertyBase(BaseModel):
    """Gemeinsame, bearbeitbare Felder eines Objekts."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    # Abweichende Beschreibung NUR für die eigene Buchungsstrecke; OTAs/Channex
    # erhalten weiter `description`. None = Fallback auf `description`.
    platform_description: str | None = None
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
    platform_description: str | None = None
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


# --- Foto-/Galerieverwaltung (property_photos, Migration 0061) ---------------


class PropertyPhoto(BaseModel):
    """Ein Foto eines Objekts mit Metadaten (Reihenfolge, Cover, Caption)."""

    id: str
    property_id: str
    url: str
    sort_order: int
    is_cover: bool
    # Locale → Bildunterschrift, z. B. {"de": "Wohnzimmer", "en": "Living room"}.
    caption: dict[str, str] = Field(default_factory=dict)
    # Urheber/Fotograf (an die Buchungsportale mitgesendet). Leer = kein Autor.
    author: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class PropertyPhotoListResponse(BaseModel):
    items: list[PropertyPhoto]
    total: int


class PhotoReorderRequest(BaseModel):
    """Neue Reihenfolge der Fotos als vollständige Liste der Foto-IDs."""

    photo_ids: list[str] = Field(min_length=1)


class PhotoUpdateRequest(BaseModel):
    """Partielle Aktualisierung eines Fotos: Caption je Locale, Cover und/oder
    Autor.

    ``caption`` ersetzt die gesamte Locale-Map (nicht gesetzt = unverändert).
    ``is_cover=true`` macht dieses Foto zum alleinigen Cover des Objekts.
    ``author`` setzt den Urheber (leerer String = Autor entfernen).
    """

    caption: dict[str, str] | None = None
    is_cover: bool | None = None
    author: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
