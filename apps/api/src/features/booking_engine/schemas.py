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
    #: Die Bezeichnungen zu ``amenities``, gleiche Reihenfolge, in der Sprache
    #: der Anfrage (0474).
    #:
    #: Zusätzlich zu den Codes und nicht anstelle: die Codes sind die Wahrheit
    #: (sie gehen an die Portale, es hängen Filter daran), die Bezeichnung ist
    #: die Anzeige. Ohne sie zeigte die Kunden-Website die rohen Codes —
    #: „nd_parking_included" stand live auf der Objektseite, weil der Renderer
    #: den Label-Katalog des Dashboards nicht kennt.
    #:
    #: Leer, wenn keine Merkmale gepflegt sind. Ein Code ohne Label erscheint
    #: als Code, damit er auffällt (siehe ``ausstattung_texte.bezeichnung``).
    amenity_labels: list[str] = []
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
    # „Nachricht vor der Buchung" (Airbnb, 0719). None = keine Frage. Auch hier
    # und nicht nur im Quote: das Buchungs-Widget der Betriebs-Website bucht
    # ohne Quote.
    pre_booking_question: str | None = None


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
    # Mitgebrachte Tiere. Preiswirksam in ZWEI Richtungen: „pro Tier und
    # Aufenthalt" multipliziert damit, und jede Haustiergebühr — auch die
    # Pauschale — entfällt ohne Tier (`pricing.tierbedingung`). Ohne das Feld
    # zahlte ein Gast ohne Hund die Tiergebühr mit.
    pets: int = Field(default=0, ge=0, le=50)
    # Optionale Zusatzleistungen; serverseitig aus dem Katalog bepreist + als
    # reservation_addons angelegt (Client-Beträge werden nicht vertraut).
    addons: list[AddonPick] = []
    # Vom Gast gewählte optionale Gebühren (IDs). Ohne Wahl wird eine als
    # optional markierte Gebühr NICHT berechnet — dieselbe Menge wie im Quote,
    # sonst zeigte das Widget einen anderen Preis als die Buchung berechnet.
    fees: list[str] = Field(default_factory=list, max_length=50)
    # Sprache des Gastes für die Bezeichnungen der Aufschlüsselung. Reine
    # Anzeige-Achse; die Beträge sind unberührt. Fehlt sie: Englisch, nicht
    # Deutsch (27 Länder, siehe pricing.schemas).
    locale: str = Field(default="en", max_length=10)
    # Aktionscode des Gastes („Rabattcode einlösen"). Nur ein FILTER auf die
    # Aktionen des Objekts — der Rabatt selbst wird serverseitig gerechnet, ein
    # Client-Betrag wird nie übernommen. Länge wie im Branchenstandard (15).
    promo_code: str | None = Field(default=None, max_length=15)
    # Antwort auf die „Nachricht vor der Buchung" des Gastgebers (Airbnb, 0719).
    # Pflicht nur, wenn das Objekt eine Frage stellt UND sofort gebucht wird —
    # geprüft serverseitig, nicht hier: ob eine Frage existiert, weiß erst der
    # Service. Die Länge ist hier gedeckelt (Wurzel 8): der Endpunkt ist
    # öffentlich und ohne Anmeldung erreichbar.
    vorab_antwort: str | None = Field(default=None, max_length=2000)

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
    # Gewählte optionale Gebühren und Anzeigesprache — beides wie in
    # PublicBookingRequest, damit Anzeige und Buchung übereinstimmen.
    fees: list[str] = Field(default_factory=list, max_length=50)
    locale: str = Field(default="en", max_length=10)
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


class PublicOptionalFee(BaseModel):
    """Eine vom Gast wählbare Gebühr — der Gegenpart zu `fees` in der Anfrage.

    Ohne diese Liste wüsste die Strecke nicht, WAS sie zur Wahl stellen soll:
    die Zeilen der Aufschlüsselung enthalten nur, was schon gilt. `pets_allowed`
    erfüllt dieselbe Aufgabe für die Tierauswahl.

    Der Betrag ist der BRUTTO-Aufschlag für DIESEN Aufenthalt, serverseitig
    gerechnet (Basis, Nächte, Gäste, Steuer) — nicht der eingetippte Rohwert.
    Sonst rechnete der Browser „80 pro Nacht × 7" nach und käme bei einer
    Prozent- oder Gast-Basis auf etwas anderes als der Server (Wurzel 3).
    """

    id: str
    label: str
    amount: float
    # True = der Gast hat sie in DIESER Anfrage gewählt; die Zeile steht dann
    # auch in `lines`. So bleibt die Oberfläche nach dem Neuladen richtig
    # angehakt, ohne dass der Browser den Zustand selbst führt.
    selected: bool = False


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
    # Wählbare Gebühren des Objekts (`fees[].optional`). Leer = keine; dann
    # zeigt die Strecke den Abschnitt nicht.
    optional_fees: list[PublicOptionalFee] = []
    # „Nachricht vor der Buchung" des Gastgebers (Airbnb, 0719). None = keine
    # Frage. Steht sie hier, verlangt die Buchung eine Antwort — die Strecke
    # muss sie also anzeigen.
    pre_booking_question: str | None = None


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

    # --- Zahlung vor der Buchung (0409) -------------------------------------
    # True = es ist NOCH KEINE Buchung entstanden; `id` ist die Buchungsabsicht,
    # nicht die Reservierung. Die Oberfläche muss dann bezahlen lassen und darf
    # keinesfalls „gebucht" melden. Eine Buchung gibt es erst, wenn Stripe die
    # Zahlung bestätigt hat.
    #
    # Bei einer ANFRAGE (`is_request`) bleibt das False: dort zahlt der Gast
    # erst, wenn der Betrieb zugesagt hat.
    zahlung_erforderlich: bool = False
    # Stripe-Zugangsdaten für das Payment Element. Nur gesetzt, solange
    # `zahlung_erforderlich` gilt.
    client_secret: str | None = None
    publishable_key: str | None = None
    # Verbundenes Konto des Betriebs (Stripe Connect) — das Payment Element
    # muss dagegen initialisiert werden, sonst findet es den Intent nicht.
    stripe_account: str | None = None
    # Was der Gast zahlt. Kommt aus dem serverseitigen Quote; die Oberfläche
    # zeigt ihn an, statt selbst zu rechnen.
    total_amount: float | None = None
    currency: str | None = None


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
