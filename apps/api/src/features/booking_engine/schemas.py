"""Pydantic-Schemas für den booking_engine-Slice (öffentliche Buchungsstrecke).

Die eigene Plattform (/plattform) liest hierüber öffentlich die Verfügbarkeit und
legt Gastbuchungen an. KEIN JWT — die tenant_id wird aus der Property abgeleitet.
Double-Booking-Schutz + Realtime-Push an Channex laufen serverseitig.
"""
from datetime import date

from pydantic import BaseModel, EmailStr, model_validator


class PublicListing(BaseModel):
    """Gast-sichere Listendarstellung eines öffentlichen (active) Objekts.

    NUR unkritische Felder — keine exakte Adresse, kein Eigentümer/Tenant, keine
    internen Preis-/Kostendetails. `price_from` ist der „ab"-Basispreis pro Nacht
    aus dem Pricing-Resolver (None, wenn kein Preis hinterlegt — kein Fallback).
    Bewertungen werden NICHT erfunden (optional, nur bei echten Daten).
    """

    id: str
    title: str
    property_type: str
    city: str | None = None
    country: str | None = None
    photos: list[str] = []
    max_guests: int = 1
    bedrooms: int | None = None
    baths: int | None = None
    amenities: list[str] = []
    price_from: float | None = None
    currency: str = ""
    rating: float | None = None
    rating_count: int | None = None


class PublicAddon(BaseModel):
    """Gast-sichere Darstellung einer buchbaren Zusatzleistung (Upsell).

    Nur die für die Buchungsstrecke freigegebenen, aktiven Add-ons. Texte
    mehrsprachig (Locale → Text); price/basis fürs Frontend-Rechnen, der
    verbindliche Betrag wird serverseitig im Quote/Kauf ermittelt.
    """

    id: str
    name: dict[str, str] = {}
    description: dict[str, str] = {}
    media: list[str] = []
    price: float = 0
    basis: str = "per_stay"
    mandatory: bool = False
    tax_rate: float | None = None


class PublicListingDetail(PublicListing):
    """Detailansicht eines active Objekts vor der Buchung.

    Zusätzlich Beschreibung, alle Fotos (in `photos`) und die UNGEFÄHRE Lage
    (city/country + grob gerundete lat/lng), niemals die genaue Anschrift.
    `price` ist der Effektivpreis für den angefragten Zeitraum (falls start/end),
    sonst gleich `price_from`. `addons` sind die buchbaren Zusatzleistungen.
    """

    description: str | None = None
    lat: float | None = None  # auf ~2 Nachkommastellen gerundet (ungefähr)
    lng: float | None = None
    price: float | None = None
    nights: int | None = None
    addons: list[PublicAddon] = []


class PublicListingListResponse(BaseModel):
    items: list[PublicListing] = []
    total: int = 0


class PublicDay(BaseModel):
    date: date
    available: bool  # True = buchbar (status open), False = belegt/gesperrt


class PublicAvailabilityResponse(BaseModel):
    property_id: str
    days: list[PublicDay] = []


class GuestContact(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str = ""


class AddonPick(BaseModel):
    """Vom Gast gewählte Zusatzleistung (Katalog-ID + Menge)."""

    addon_id: str
    qty: int = 1


class PublicBookingRequest(BaseModel):
    property_id: str
    check_in: date
    check_out: date  # exklusiv
    contact: GuestContact
    total_amount: float = 0
    guests: int = 1
    # Optionale Zusatzleistungen; serverseitig aus dem Katalog bepreist + als
    # reservation_addons angelegt (Client-Beträge werden nicht vertraut).
    addons: list[AddonPick] = []

    @model_validator(mode="after")
    def _check_dates(self) -> "PublicBookingRequest":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        return self


class PublicBookingResponse(BaseModel):
    id: str
    property_id: str
    check_in: date
    check_out: date
    status: str


class PurchasedAddon(BaseModel):
    """Ein bereits gekauftes Upsell (gast-sichere Sicht: Name/Menge/Betrag/Status)."""

    id: str
    name: dict[str, str] = {}
    qty: int = 1
    total: float = 0
    status: str = "pending"


class ReservationAddonsView(BaseModel):
    """Gast-Sicht auf eine Reservierung für den Nach-Buchung-Verkauf.

    ``available`` = noch buchbare (guest_portal-)Upsells unter Beachtung der
    „wann anzeigen"-Regel; ``purchased`` = bereits dazugebuchte.
    """

    reservation_id: str
    available: list[PublicAddon] = []
    purchased: list[PurchasedAddon] = []


class PostBookingAddonRequest(BaseModel):
    """Nachträglicher Add-on-Kauf durch den Gast (E-Mail verifiziert leicht)."""

    email: EmailStr
    addons: list[AddonPick] = []


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
