"""Pydantic-Schemas für den booking_engine-Slice (öffentliche Buchungsstrecke).

Die eigene Plattform (/plattform) liest hierüber öffentlich die Verfügbarkeit und
legt Gastbuchungen an. KEIN JWT — die tenant_id wird aus der Property abgeleitet.
Double-Booking-Schutz + Realtime-Push an Channex laufen serverseitig.
"""
from datetime import date
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


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
    # Haustiere erlaubt? Aus der Hotel-Policy, sonst aus den Merkmalen; ohne
    # Angabe False (fail-closed) — die Buchungsstrecke bietet die Tierauswahl
    # nur an, wo der Betrieb sie ausdrücklich zulässt.
    pets_allowed: bool = False
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
    # Ob diese Objektseite für Suchmaschinen indexierbar ist (Airbnb „Objekte in
    # Suchmaschinen aufnehmen"). false → Frontend rendert robots-noindex-Meta.
    search_engine_indexing: bool = False


class PublicListingListResponse(BaseModel):
    items: list[PublicListing] = []
    total: int = 0


class PublicDestination(BaseModel):
    """Ein echtes Reiseziel aus dem Bestand — Stadt oder Land, in dem wirklich
    buchbare Objekte liegen, mit deren Anzahl. Ersetzt die vorher hartkodierte
    Vorschlagsliste des Suchfelds (Paris/Bangkok/Tokio ohne ein Objekt dort).

    `label` ist die anzeigefertige Bezeichnung („Skagen, Dänemark"), `query` der
    Wert, mit dem die Suche wirklich trifft. Land ohne Namen (unbekannter Code)
    wird NICHT geraten — dann steht nur die Stadt (Wurzel 4)."""

    art: Literal["city", "country"]
    label: str
    query: str
    city: str | None = None
    country: str | None = None
    country_name: str | None = None
    count: int = 0
    # Name der selbst gezeichneten Illustration (ohne Pfad/Endung), abgeleitet aus
    # Objekttyp + Lage — siehe reiseziel_motiv.py. Serverseitig entschieden, damit
    # Plattform, App und White-Label-Seiten dasselbe Bild je Ort zeigen.
    motiv: str = "land"


class PublicDestinationListResponse(BaseModel):
    items: list[PublicDestination] = []


class SitemapEntry(BaseModel):
    """Ein Sitemap-Eintrag: nur ID + letzter Änderungszeitpunkt eines aktiven,
    suchmaschinen-indexierbaren Objekts. Bewusst minimal (kein Preis/keine
    Auflösung), damit die Sitemap-Abfrage billig bleibt."""

    id: str
    updated_at: str | None = None


class SitemapResponse(BaseModel):
    items: list[SitemapEntry] = []


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
    # Mitgebrachte Tiere: preiswirksam, sobald das Objekt eine Haustiergebühr
    # „pro Tier und Aufenthalt" führt. Ohne das Feld zahlte ein Gast mit zwei
    # Hunden dasselbe wie einer ohne.
    pets: int = Field(default=0, ge=0, le=50)
    # Optionale Zusatzleistungen; serverseitig aus dem Katalog bepreist + als
    # reservation_addons angelegt (Client-Beträge werden nicht vertraut).
    addons: list[AddonPick] = []
    # Aktionscode des Gastes („Rabattcode einlösen"). Nur ein FILTER auf die
    # Aktionen des Objekts — der Rabatt selbst wird serverseitig gerechnet, ein
    # Client-Betrag wird nie übernommen. Länge wie im Branchenstandard (15).
    promo_code: str | None = Field(default=None, max_length=15)

    @model_validator(mode="after")
    def _check_dates(self) -> "PublicBookingRequest":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        return self


class PublicQuoteRequest(BaseModel):
    """Preisaufschlüsselung VOR der Buchung, für die Gast-Buchungsstrecke.

    Dieselben Größen wie die Buchung selbst — sonst zeigte das Widget einen
    anderen Preis, als der Server anschließend berechnet.
    """

    property_id: str
    check_in: date
    check_out: date  # exklusiv
    guests: int = Field(default=1, ge=1, le=100)
    pets: int = Field(default=0, ge=0, le=50)
    addons: list[AddonPick] = []
    # Aktionscode des Gastes („Rabattcode einlösen"). Nur ein FILTER auf die
    # Aktionen des Objekts — der Rabatt selbst wird serverseitig gerechnet, ein
    # Client-Betrag wird nie übernommen. Länge wie im Branchenstandard (15).
    promo_code: str | None = Field(default=None, max_length=15)

    @model_validator(mode="after")
    def _check_dates(self) -> "PublicQuoteRequest":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        return self


class PublicQuoteLine(BaseModel):
    """Eine Zeile der Gast-Aufschlüsselung.

    Bewusst OHNE `fee_id`/`tax_rate`: der Gast braucht Bezeichnung und Betrag,
    interne Kennungen und Steuersätze gehören nicht in eine JWT-lose Antwort.
    """

    label: str
    amount: float
    kind: str | None = None


class PublicPaymentPlan(BaseModel):
    """Wann der Gast zahlt — aus der Buchungskondition des Betriebs
    (`booking_conditions`), NICHT geschätzt. Dieselbe Rechnung, die der
    Zahlungspfad später einzieht (`booking_conditions.plan`).

    Ohne Ratenzahlung ist `due_now` der Gesamtbetrag und `due_later` 0; der
    Checkout zeigt dann nur „jetzt vollständig bezahlen".
    """

    installments: int = 1
    due_now: float
    due_later: float = 0
    # Fälligkeit der Restzahlung (ISO-Datum). None = keine Restzahlung.
    balance_due_date: date | None = None


class PublicRefundRule(BaseModel):
    """Eine Stufe der Storno-Staffel: bis X Tage vor Anreise Y % zurück."""

    days_before_arrival: int
    refund_percent: float


class PublicCancellation(BaseModel):
    """Stornobedingungen des Objekts. `mode` ist der Modus des Betriebs
    (z. B. flexibel/moderat/streng), `rules` die gepflegte Staffel — leer, wenn
    der Betrieb keine hinterlegt hat (dann behauptet die Strecke keine)."""

    mode: str | None = None
    rules: list[PublicRefundRule] = []


class PublicDeposit(BaseModel):
    """Kaution, wenn der Betrieb eine verlangt. Betrag in `currency`; bei
    prozentualer Kaution schon auf den Aufenthalt umgerechnet."""

    amount: float
    method: str | None = None
    currency: str | None = None


class PublicQuoteResponse(BaseModel):
    property_id: str
    nights: int
    currency: str
    lines: list[PublicQuoteLine] = []
    total: float
    # Zahlungszeitpunkt/Storno/Kaution der geltenden Buchungskondition. Alle drei
    # sind None, wenn der Betrieb keine Kondition gepflegt hat — dann ist alles
    # sofort fällig und der Checkout lässt die Blöcke weg (keine Attrappe).
    payment_plan: PublicPaymentPlan | None = None
    cancellation: PublicCancellation | None = None
    deposit: PublicDeposit | None = None
    # Hat der eingegebene Code WIRKLICH eine Aktion ausgelöst? False bei leerem
    # oder unbekanntem Code — die Strecke sagt dann „Code ungültig", auch wenn
    # eine automatische Aktion greift und ein Rabatt in den Zeilen steht.
    promo_code_applied: bool = False
    # True = das Objekt hat für diesen Zeitraum keinen hinterlegten Preis. Dann
    # zeigt die Oberfläche „Preis auf Anfrage" statt einer 0 (Wurzel 4).
    priceless: bool = False
    # Haustiere überhaupt erlaubt? Entscheidet, ob die Auswahl angeboten wird.
    pets_allowed: bool = False
    max_guests: int = 1


class PublicBookingResponse(BaseModel):
    id: str
    property_id: str
    check_in: date
    check_out: date
    status: str
    # Airbnb-Modell: True = Anfrage (status='requested'), der Gast wartet auf die
    # Host-Zusage; False = Sofortbuchung (status='confirmed'). Steuert das Gast-UI
    # („Anfrage gesendet" vs. „Gebucht").
    is_request: bool = False
    # Ablauf der Anfrage (ISO, 24 h). None bei Sofortbuchung.
    request_expires_at: str | None = None


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
