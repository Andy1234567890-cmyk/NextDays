"""Pydantic-Schemas für den channel_manager-Slice (Channex-Integration)."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
    # Ob der Channex-Provider konfiguriert ist (API-Key gesetzt).
    channex_configured: bool = False


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
    """Lokale Property mit Channex verbinden.

    Entweder bestehende Channex-Property anbinden (channex_property_id gesetzt)
    oder neu in Channex anlegen (channex_property_id leer → wir erzeugen sie).
    """

    property_id: str
    channex_property_id: str | None = None
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
    """Gebündelter ARI-Push (Channex-Best-Practice: batchen, nicht einzeln)."""

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


class ChannelResponse(BaseModel):
    """Ein verbundener Kanal (white-label: kein Provider-Name im Feldnamen)."""

    id: str
    portal: str          # menschlich, z.B. "Booking.com"
    title: str | None = None
    is_active: bool = False


class ChannelListResponse(BaseModel):
    items: list[ChannelResponse]
    total: int


class ConnectChannelRequest(BaseModel):
    """Verbindet ein Portal mit einem lokalen Objekt (eigene Maske)."""

    property_id: str                     # lokale Objekt-ID
    portal_code: str                     # interner Portal-Code (BookingCom, AirBNB …)
    title: str | None = None
    settings: dict = Field(default_factory=dict)  # portal-spezifische Felder


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
