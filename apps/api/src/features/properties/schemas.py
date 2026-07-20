"""Pydantic-Schemas für den properties-Slice (Objekt-Verwaltung).

Bildet die „Rental"-Struktur ab: Stammdaten + strukturierte Adresse +
Ausstattung/Fotos. Sektionen ohne eigene Spalte (Rooms, Sleeping arrangements,
Rental-Info-Detailfelder) liegen flexibel im jsonb-Feld `type_attributes`.
"""
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

from src.core.countries import normalize_country
from src.features.owner_statements.currencies import normalize_currency


def _validate_currency(value: str | None) -> str | None:
    """Objektwährung auf einen unterstützten ISO-4217-Code normalisieren.

    Leer bleibt leer (das Objekt hat dann noch keine bewusst gesetzte Währung →
    symbollose Anzeige, kein erfundenes €, Wurzel 4). Ein nicht unterstützter
    Code ist ein Datenfehler → 422."""
    return normalize_currency(value)


def _validate_country_iso2(value: str | None) -> str | None:
    """Land IMMER als ISO-3166-1 alpha-2 speichern (eine Quelle der Wahrheit).

    Nimmt ISO-2-Code ODER Landesname (der Places-Picker liefert je nach Sprache
    „Germany"/„Deutschland") und normalisiert auf den Code. Leer bleibt leer;
    unbekanntes Land ist ein Datenfehler → 422 (kein erfundener Ersatzwert)."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    code = normalize_country(value)
    if code is None:
        raise ValueError(
            f"Unbekanntes Land: {value!r}. Bitte ein gültiges Land wählen "
            "(ISO-3166-1 alpha-2, z. B. DE)."
        )
    return code


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
    # Sichtbarkeit auf dem eigenen myNextDays-Marktplatz (/plattform) als eigener
    # Buchungskanal — getrennt von status (Lebenszyklus) und OTA-Distribution
    # (channex_property_map.sync_enabled). Marktplatz-Listung = status='active'
    # UND listed_on_marketplace (Migration 0159). Default an (Publish listet).
    listed_on_marketplace: bool = True
    # Sichtbarkeit auf der eigenen Kunden-Website (Page-Builder) als eigener
    # Vertriebskanal (Migration 0162) — pro-Kanal-Achse, getrennt von status,
    # Marktplatz und OTA. Website-Sichtbarkeit = status='active' UND dieses Flag.
    listed_on_website: bool = True

    # Zentrale Währung DES OBJEKTS (Migration 0161). Gilt für ALLE Rate-Plans
    # dieses Objekts (Channex verlangt 1 Objekt = 1 Währung). Nullable, kein
    # Default — fehlt sie, rendert die Anzeige symbollos statt ein € zu erfinden
    # (Wurzel 4). Ein nicht unterstützter Code → 422.
    currency: str | None = None

    # Rental info: Größe, Einheiten, Gäste.
    max_guests: int = Field(default=1, ge=1, le=99)

    # Strukturierte Adresse (Lastenheft §6).
    street: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None

    # Objektkartei Stufe 1 — OBJEKTINFORMATION (Lastenheft §6). Nur bfe_number
    # (DK-Katasternummer) ist ein echtes neues Kartei-Feld. Bewusst NICHT in
    # _CONTENT_FIELDS (service.py) → kein Channex/OTA-Sync. Name/Typ/Adresse/
    # Kapazität kommen aus dem Bestand (title, property_type, house_number,
    # max_guests, type_attributes.size_m2) — keine zweite Wahrheit.
    bfe_number: str | None = None

    # Listen.
    amenities: list[str] = Field(default_factory=list)
    photos: list[str] = Field(default_factory=list)

    # Flexible Sektionen (Rooms, Sleeping arrangements, m², Einheiten …).
    # Frei strukturierbar, damit neue Sektionen ohne Migration passen.
    type_attributes: dict = Field(default_factory=dict)

    _norm_country = field_validator("country")(_validate_country_iso2)
    _norm_currency = field_validator("currency")(_validate_currency)


class PropertyCreate(PropertyBase):
    """Anlage eines Objekts. tenant_id kommt aus dem eingeloggten Nutzer."""


class PropertyUpdate(BaseModel):
    """Partielle Aktualisierung — nur gesetzte Felder werden übernommen."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    platform_description: str | None = None
    property_type: PropertyType | None = None
    status: PropertyStatus | None = None
    # Marktplatz-Kanal an/aus (0159) — pro-Kanal-Sichtbarkeit, unabhängig von
    # status und OTA. Toggle für „auf dem eigenen Marktplatz zeigen/verstecken".
    listed_on_marketplace: bool | None = None
    # Website-Kanal an/aus (0162) — pro-Kanal-Sichtbarkeit, unabhängig von
    # status, Marktplatz und OTA. Toggle für „auf der eigenen Website zeigen".
    listed_on_website: bool | None = None
    # Zentrale Objektwährung (0161) — beim Setzen ziehen alle Rate-Plans mit
    # (service.update, Wurzel 1). Nicht unterstützter Code → 422.
    currency: str | None = None
    max_guests: int | None = Field(default=None, ge=1, le=99)
    street: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None
    # Objektkartei (Lastenheft §6) — nur bfe_number, kein OTA-Sync (nicht in _CONTENT_FIELDS).
    bfe_number: str | None = None
    amenities: list[str] | None = None

    _norm_country = field_validator("country")(_validate_country_iso2)
    _norm_currency = field_validator("currency")(_validate_currency)
    photos: list[str] | None = None
    type_attributes: dict | None = None


class ChannelState(StrEnum):
    """Sichtbarkeits-Zustand eines Objekts PRO Vertriebskanal (Ebene B, getrennt
    vom Lebenszyklus properties.status). Branchen-Standard-Zustandsmodell
    (Guesty/Cloudbeds/SiteMinder): aktiv, pausiert (Nutzer-Wille, kein Alarm),
    nicht eingerichtet, Fehler (Handlungsbedarf) — bewusst getrennte Zustände,
    nicht „alles Nicht-Grüne = rot"."""

    active = "active"          # Kanal-Flag an UND status='active' → sichtbar
    paused = "paused"          # verbunden/aktivierbar, aber Kanal-Flag aus
    not_connected = "not_connected"  # Kanal nicht eingerichtet (Portale ohne Map)
    error = "error"            # Sync-/Verbindungsfehler (nur Portale möglich)


class PropertyChannels(BaseModel):
    """Abgeleiteter Kanal-Sichtbarkeitszustand je Objekt (nicht persistiert).
    Speist die drei Kanal-Chips (Website · Plattform · Portale) auf der
    Objektkarte. Portale ist ein Aggregat des Channex/OTA-Zustands."""

    website: ChannelState
    marketplace: ChannelState
    portals: ChannelState


class PropertyResponse(PropertyBase):
    id: str
    tenant_id: str
    created_at: str | None = None
    updated_at: str | None = None
    # Abgeleiteter Kanal-Zustand (Ebene B) für die Kanal-Chips. Optional, weil
    # nur die Listen-/Detail-Wege ihn befüllen; None = nicht berechnet.
    channels: PropertyChannels | None = None


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
