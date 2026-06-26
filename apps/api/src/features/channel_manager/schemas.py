"""Pydantic-Schemas für den channel_manager-Slice (Channex-Integration)."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
    # Ob der Channel-Manager einsatzbereit ist (Provider-Key gesetzt). NEUTRALER
    # Feldname — der Provider darf nie im Frontend/Network-Tab auftauchen.
    channel_manager_ready: bool = False


# --- Property-Mapping --------------------------------------------------------
class PropertyMapResponse(BaseModel):
    id: str
    property_id: str
    property_title: str | None = None
    # channex_property_id ist eine INTERNE Provider-ID — bewusst NICHT im
    # Response, damit sie nie im Frontend/Netzwerk-Tab beim Kunden auftaucht.
    sync_enabled: bool
    last_sync_at: datetime | None = None
    last_sync_status: str | None = None
    last_sync_error: str | None = None


class PropertyConnectRequest(BaseModel):
    """Lokales Objekt mit dem Channel-Manager verbinden.

    Entweder ein bestehendes Provider-Objekt anbinden (`external_property_ref`
    gesetzt) oder neu anlegen (leer → wir erzeugen es). Der Feldname ist neutral
    — KEIN Provider-Bezug, der dem Kunden im Request/Network-Tab auffällt.
    """

    property_id: str
    external_property_ref: str | None = None
    # Felder zum Anlegen (nur nötig, wenn neu erzeugt wird):
    title: str | None = Field(default=None, max_length=255)
    currency: str | None = Field(default=None, min_length=3, max_length=3)


class PropertyMapListResponse(BaseModel):
    items: list[PropertyMapResponse]
    total: int


# --- ARI-Push ----------------------------------------------------------------
class AvailabilityUpdate(BaseModel):
    room_type_map_id: str
    date_from: date
    date_to: date
    availability: int = Field(ge=0)


class RateUpdate(BaseModel):
    rate_plan_map_id: str
    date_from: date
    date_to: date
    # Preis in Cent (eindeutig). min_stay/stop_sell optional.
    rate_cents: int | None = Field(default=None, ge=0)
    min_stay_arrival: int | None = Field(default=None, ge=1)
    stop_sell: bool | None = None


class AriPushRequest(BaseModel):
    """Gebündelter ARI-Push (Best-Practice: batchen, nicht einzeln)."""

    availability: list[AvailabilityUpdate] = Field(default_factory=list)
    rates: list[RateUpdate] = Field(default_factory=list)


class AriPushResponse(BaseModel):
    availability_tasks: int = 0
    rate_tasks: int = 0
    warnings: list[str] = Field(default_factory=list)


# --- Bookings ----------------------------------------------------------------
class BookingResponse(BaseModel):
    id: str
    # neutraler Feldname (kein Provider-Name im JSON, das der Kunde sieht)
    external_id: str
    ota_name: str | None = None
    ota_reservation_code: str | None = None
    status: str
    arrival_date: date | None = None
    departure_date: date | None = None
    amount_cents: int | None = None
    currency: str | None = None
    customer: dict = Field(default_factory=dict)
    acknowledged_at: datetime | None = None


class BookingListResponse(BaseModel):
    items: list[BookingResponse]
    total: int


class BookingSyncResponse(BaseModel):
    """Ergebnis eines Feed-Pulls: wie viele Revisionen verarbeitet/ge-ackt."""

    fetched: int = 0
    saved: int = 0
    acknowledged: int = 0
    # Revisionen FREMDER Tenants, die wir bewusst übersprungen haben (Mandanten-
    # trennung). Müssen >0 sein können, ohne dass etwas durchsickert.
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)


# --- Kanäle (OTA-Verbindungen, inhouse) -------------------------------------
class PortalField(BaseModel):
    """Ein Eingabefeld für die Verbinden-Maske eines Portals."""

    key: str
    label: str
    placeholder: str = ""
    required: bool = True


class SupportedPortal(BaseModel):
    """Ein unterstütztes Buchungsportal + die Felder für die eigene Maske.
    `code` ist intern (Provider-Channel-Code), wird dem Kunden nicht erklärt."""

    code: str
    label: str
    icon: str
    fields: list[PortalField] = Field(default_factory=list)
    # "credential" = Hotel-ID/Zugangsdaten eingeben; "oauth" = Verbindung über
    # OAuth-URL (Airbnb, kein eingebbares Credential).
    connection_type: str = "credential"


class ChannelResponse(BaseModel):
    """Ein verbundener Kanal (white-label: kein Provider-Name im Feldnamen)."""

    id: str
    portal: str          # menschlich, z.B. "Booking.com"
    title: str | None = None
    is_active: bool = False


class ChannelListResponse(BaseModel):
    items: list[ChannelResponse]
    total: int


class ConnectionToggleRequest(BaseModel):
    """An-/Abschalten einer OTA-Verbindung pro (Objekt × Portal)."""

    is_active: bool


class ChannelConnectionResponse(BaseModel):
    """Eine gespeicherte OTA-Verbindung eines Objekts (white-label).

    Enthält nur Portal, Hotel-ID und Status — keine rohen Credentials, kein
    Provider-Branding."""

    portal_code: str                     # interner Code (BookingCom …)
    portal: str                          # menschlich, z.B. "Booking.com"
    hotel_id: str                        # Hotel-ID beim OTA (Eingabe des Vermieters)
    channel_id: str | None = None        # erzeugter Channel (None nach Trennen)
    is_active: bool = False
    last_error: str | None = None
    updated_at: str | None = None


class ChannelConnectionListResponse(BaseModel):
    items: list[ChannelConnectionResponse]
    total: int


class PrepareChannelRequest(BaseModel):
    """Schritt 1+2: Zugangsdaten prüfen + OTA-Zimmer/Raten holen (legt nichts an)."""

    property_id: str                     # lokale Objekt-ID
    portal_code: str                     # interner Portal-Code (BookingCom …)
    settings: dict = Field(default_factory=dict)  # z.B. {"hotel_id": "..."}


class OtaRate(BaseModel):
    id: int | str                        # OTA-Raten-Code (integer)
    title: str | None = None
    pricing: str | None = None
    max_persons: int | None = None
    occupancies: list[int] = Field(default_factory=list)


class OtaRoom(BaseModel):
    id: int | str                        # OTA-Zimmer-Code (integer)
    title: str | None = None
    rates: list[OtaRate] = Field(default_factory=list)


class LocalRatePlanOption(BaseModel):
    rate_plan_map_id: str
    title: str


class PrepareChannelResponse(BaseModel):
    """OTA-Zimmer/Raten + unsere lokalen Preispläne zum Zuordnen in der UI."""

    portal: str                          # menschlicher Name
    ota_rooms: list[OtaRoom] = Field(default_factory=list)
    rate_plans: list[LocalRatePlanOption] = Field(default_factory=list)


class ChannelMapping(BaseModel):
    """Eine Zuordnung: unser Preisplan ↔ OTA-Zimmer+Rate (Codes als Integer)."""

    rate_plan_map_id: str
    room_type_code: int
    rate_plan_code: int
    occupancy: int = 2
    pricing_type: str = "Standard"
    primary_occ: bool = True
    readonly: bool = False


class ConnectChannelRequest(BaseModel):
    """Schritt 3+4: Kanal mit Zuordnung anlegen und aktivieren."""

    property_id: str
    portal_code: str
    title: str | None = None
    settings: dict = Field(default_factory=dict)        # z.B. {"hotel_id": "..."}
    mappings: list[ChannelMapping] = Field(default_factory=list)


# --- Airbnb-OAuth (white-label, ohne iFrame) --------------------------------
class OAuthBeginRequest(BaseModel):
    """OAuth-Start: inaktiven Channel anlegen + echte OAuth-URL erzeugen."""

    property_id: str
    portal_code: str                                  # OAuth-Portal (AirBNB)
    title: str | None = None
    settings: dict = Field(default_factory=dict)      # optionale Airbnb-Settings


class OAuthBeginResponse(BaseModel):
    """Die OAuth-URL zum Öffnen ODER Kopieren (an den Eigentümer senden)."""

    channel_id: str
    oauth_url: str
    portal: str                                       # menschlich, z.B. "Airbnb"
    status: str = "pending"


class OAuthStatusResponse(BaseModel):
    """Verbindungsstatus (Poll): verbunden + Host-ID, sobald autorisiert."""

    connected: bool = False
    host_id: str | None = None
    portal: str


class OAuthFinalizeRequest(BaseModel):
    """Nach erfolgreicher Verbindung: Mapping setzen + Channel aktivieren."""

    property_id: str
    portal_code: str
    mappings: list[ChannelMapping] = Field(default_factory=list)


# --- Webhook-Registrierung (Admin) ------------------------------------------
class WebhookInfo(BaseModel):
    id: str
    callback_url: str | None = None
    event_mask: str | None = None
    is_global: bool = False
    is_active: bool = True


class WebhookRegisterResponse(BaseModel):
    callback_url: str
    event_mask: str
    webhook: WebhookInfo | None = None
