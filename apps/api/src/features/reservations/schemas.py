"""Pydantic-Schemas für den reservations-Slice.

Bildet die reservations- und guests-Tabellen ab. Eine Reservierung belegt
den Zeitraum [check_in, check_out) im Kalender (availability=booked) → der
Double-Booking-Schutz aus dem calendar-Slice greift.
"""
from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class ReservationChannel(StrEnum):
    direct = "direct"
    portal = "portal"
    booking = "booking"
    airbnb = "airbnb"
    vrbo = "vrbo"


class ReservationStatus(StrEnum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


class GuestBreakdown(BaseModel):
    """Gäste-Aufschlüsselung (Lodgify Schritt 1)."""

    adults: int = Field(default=1, ge=1)
    children: int = Field(default=0, ge=0)
    infants: int = Field(default=0, ge=0)
    pets: int = Field(default=0, ge=0)


class GuestContact(BaseModel):
    """Kontaktdaten des Hauptgastes."""

    first_name: str = ""
    last_name: str = ""
    email: str = ""
    phone: str = ""
    country: str = ""
    language: str = ""


class ReservationCreate(BaseModel):
    property_id: str
    check_in: date
    check_out: date  # exklusiv (Check-out-Tag ist wieder frei)
    channel: ReservationChannel = ReservationChannel.direct
    source: str = ""  # frei: „Telefon", „Airbnb" …
    guests: GuestBreakdown = GuestBreakdown()
    contact: GuestContact = GuestContact()
    total_amount: float = Field(default=0, ge=0)
    status: ReservationStatus = ReservationStatus.confirmed
    # Optional: bestehenden Gast fest zuordnen (z. B. aus der Gästekarte). Wenn
    # gesetzt UND gültig, wird kein neuer Gast angelegt (keine Dublette).
    guest_id: str | None = None

    @model_validator(mode="after")
    def _check_order(self) -> "ReservationCreate":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        return self


class ReservationMove(BaseModel):
    """Reservierung verschieben (anderes Objekt/anderer Zeitraum) oder resizen
    (nur Check-in/out). Beides ist ein neues (property_id, check_in, check_out)
    für eine bestehende Reservierung; der Double-Booking-Schutz greift erneut,
    die eigenen alten Tage werden dabei ausgenommen.
    """

    property_id: str
    check_in: date
    check_out: date  # exklusiv

    @model_validator(mode="after")
    def _check_order(self) -> "ReservationMove":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        return self


class ReservationCancel(BaseModel):
    """Storno mit Pflicht-Begründung (wird dokumentiert/auditiert)."""

    reason: str = Field(min_length=1)


class ReservationResponse(BaseModel):
    id: str
    property_id: str
    guest_id: str | None = None
    guest_name: str = ""
    channel: ReservationChannel
    check_in: date
    check_out: date
    status: ReservationStatus
    # None für Rollen ohne VIEW_GUEST_FULL (DSGVO-Daten-Split §4).
    total_amount: float | None = None
    # Bereits bezahlter Betrag (für den Bezahlt-Anteil in der Buchungsliste).
    # Gleiche Maskierung wie total_amount → None ohne Betrags-Sichtbarkeit.
    paid_amount: float | None = None
    currency: str = ""
    ota_name: str | None = None       # echter Portal-Name (Kalender-Herkunft)
    external_ref: str | None = None   # OTA-Reservierungscode
    num_guests: int = 1               # Gästezahl (Balken-Anzeige)
    adults: int = 1                   # Aufschlüsselung (Buchungsliste: Gäste-Icons)
    children: int = 0                 # Kinderzahl (Kinder-Icon nur wenn > 0)
    # Echter Check-in/Check-out-Zustand (0091) — None = noch nicht erfolgt.
    checked_in_at: str | None = None
    checked_out_at: str | None = None


class QuoteItem(BaseModel):
    label: str
    amount: float


class ReservationInvoiceInfo(BaseModel):
    """Aktive Rechnung zur Buchung (Booking→Invoice-Brücke, 0092)."""

    id: str
    invoice_number: str | None = None
    status: str = ""
    # None ohne Betrags-Sichtbarkeit (GuestMask.amounts).
    gross_amount: float | None = None
    currency: str = ""


class ReservationDetail(BaseModel):
    """Vollständige Reservierungs-Detailansicht (rechter Slider, Hostaway-Niveau).

    Beträge/Kontakt sind maskierungskonform: ohne Berechtigung None bzw. nur
    Vorname (DSGVO-Daten-Split §4)."""

    id: str
    property_id: str
    property_title: str = ""
    guest_id: str | None = None
    guest_name: str = ""
    channel: ReservationChannel
    ota_name: str | None = None
    external_ref: str | None = None
    external_url: str | None = None
    check_in: date
    check_out: date
    nights: int
    status: ReservationStatus
    # Belegung
    num_guests: int = 1
    adults: int = 1
    children: int = 0
    infants: int = 0
    pets: int = 0
    # Beträge (maskiert) + Quote-Aufschlüsselung
    currency: str = ""
    total_amount: float | None = None
    paid_amount: float | None = None
    due_amount: float | None = None
    quote_items: list[QuoteItem] = []
    # Policy-Zeiten + Notiz
    checkin_time: str | None = None
    checkout_time: str | None = None
    note: str | None = None
    # Echter Check-in/Check-out-Zustand (0091) — None = noch nicht erfolgt.
    checked_in_at: str | None = None
    checked_out_at: str | None = None
    # Aktive Rechnung zur Buchung (None = noch keine erstellt).
    invoice: ReservationInvoiceInfo | None = None
    # Storno-Dokumentation (gesetzt bei status=cancelled)
    cancel_reason: str | None = None
    cancelled_at: str | None = None
    # Gast-Kontakt (maskiert)
    guest_email: str | None = None
    guest_phone: str | None = None
    guest_language: str | None = None
    guest_country: str | None = None
    created_at: str | None = None


class CheckOutRequest(BaseModel):
    """Zahlart des Gastes beim Check-out (wird an der Rezeption abgefragt).

    cash/card = am Empfang bezahlt → Rechnung sofort 'paid';
    invoice = Zahlung auf Rechnung (Überweisung, Zahlungsziel) → 'finalized'.
    card_brand nur bei Kreditkarte (Visa, Mastercard, …)."""

    payment_method: str = Field(default="invoice", pattern="^(cash|card|invoice)$")
    card_brand: str | None = None


class CheckOutResponse(BaseModel):
    """Ergebnis des Check-outs: Buchung + die dabei erzeugte finale Rechnung
    (invoice_already_existed=True beim idempotenten Retry)."""

    reservation: ReservationResponse
    invoice_id: str
    invoice_number: str | None = None
    invoice_already_existed: bool = False


class ReservationListResponse(BaseModel):
    items: list[ReservationResponse]
    total: int


class DashboardEntry(BaseModel):
    """Eine Zeile in den Check-out/-in/Anstehend-Listen des Dashboards."""

    reservation_id: str
    guest_name: str = ""
    property_title: str = ""
    channel: ReservationChannel
    ota_name: str | None = None
    check_in: date
    check_out: date
    status: ReservationStatus


class DashboardKpi(BaseModel):
    """Eine KPI-Kachel mit Vergleich zu den vorherigen 30 Tagen."""

    value: float
    # Veränderung in Prozent ggü. der Vorperiode; None, wenn keine Vorperiode
    # vorhanden ist (keine erfundenen 0-%-Werte).
    change_pct: float | None = None


class DashboardResponse(BaseModel):
    today: date
    checkouts_today: list[DashboardEntry]
    checkins_today: list[DashboardEntry]
    upcoming: list[DashboardEntry]
    checkins_30d: DashboardKpi
    # None, wenn der Nutzer keine Beträge sehen darf (Owner ohne PM_BOOKING_TOTAL,
    # Daten-Split §4.2 „kein Gesamtpreis") — kein maskierter 0-Betrag erfunden.
    revenue_30d: DashboardKpi | None = None
    confirmed_30d: DashboardKpi
    currency: str = ""


class ChannelBreakdown(BaseModel):
    """Verteilung je Kanal (für die Donut-Diagramme). amount=None ohne Betrags-
    Sichtbarkeit (Daten-Split); nights bleibt sichtbar (keine Finanzangabe)."""

    channel: str
    ota_name: str | None = None
    amount: float | None = None
    nights: int = 0


class StatPoint(BaseModel):
    """Ein Tageswert einer KPI-Zeitreihe (Sparkline / Detail-Chart)."""

    date: date
    value: float


class StatSeries(BaseModel):
    """Zeitreihe EINER KPI über die gewählte Periode (Tagesauflösung).

    Trägt die Kennung (metric) für die Detailseite, den maskierbaren Sichtbar-
    keits-Schalter und die Tagespunkte. Bei Beträgen ohne Sichtbarkeit ist
    `points` leer und `visible=False` (keine erfundenen Werte)."""

    metric: str
    visible: bool = True
    points: list[StatPoint] = []


class StatComparePeriod(BaseModel):
    """Eine Vergleichsperiode auf der KPI-Detailseite (gleiche Länge, davor).

    label = Perioden-Bereich („10 Mai – 8 Jun"); value = Summe/Wert der Periode;
    change_pct = Veränderung ggü. dieser Periode (None ohne Basis)."""

    label: str
    date_from: date
    date_to: date
    value: float | None = None
    change_pct: float | None = None


class StatMetricDetail(BaseModel):
    """Detail-Daten EINER KPI (Lodgify-KPI-Detailseite): die aktuelle Tagesreihe,
    bis zu vier gleich lange Vergleichsperioden davor und die Breakout-Matrix
    (Perioden × Tag-Offset). Beträge maskiert (visible=False → leer)."""

    metric: str
    is_money: bool = False
    visible: bool = True
    currency: str = ""
    date_from: date
    date_to: date
    series: list[StatPoint] = []
    periods: list[StatComparePeriod] = []
    # Breakout: je Vergleichsperiode die Tageswerte (Index 0 = erster Tag der
    # jeweiligen Periode) — für die Tabelle unten auf der Detailseite.
    breakout: list[list[float]] = []


class PropertyStats(BaseModel):
    """Objekt-Kennzahlen für den Statistiken-Reiter (Lodgify „Kontrollzentrum").

    Alle Betrags-KPIs sind maskierbar (None ohne Betrags-Sichtbarkeit, §4.2) und
    tragen die Währung aus den Daten (leer bei gemischten Währungen — keine
    Mischsumme). Zähl-KPIs (Gäste, Nächte, Reservierungen) sind immer sichtbar.
    Jede KPI vergleicht die gewählte Periode mit der gleich langen Vorperiode."""

    property_id: str
    property_title: str = ""
    currency: str = ""
    date_from: date
    date_to: date
    # Betrags-KPIs (None ohne Betrags-Sichtbarkeit)
    revenue: DashboardKpi | None = None
    payments_received: DashboardKpi | None = None
    avg_booking_value: DashboardKpi | None = None
    avg_price_per_night: DashboardKpi | None = None
    # Zähl-KPIs (immer sichtbar)
    hosted_guests: DashboardKpi
    booked_nights: DashboardKpi
    occupancy_rate: DashboardKpi  # Prozent 0..100 (value), change ggü. Vorperiode
    days_booked_ahead: DashboardKpi
    avg_stay_length: DashboardKpi
    created_reservations: DashboardKpi
    cancelled_reservations: DashboardKpi
    cancelled_nights: DashboardKpi
    # Kanal-Verteilung (Einnahmen + Nächte je Kanal)
    by_channel: list[ChannelBreakdown] = []
    # Tages-Zeitreihen je KPI (Sparkline in der Kachel). metric = KPI-Kennung;
    # Betrags-Metriken sind bei fehlender Sichtbarkeit visible=False + leer.
    series: list[StatSeries] = []


class StatMetricDetailResponse(BaseModel):
    """Antwort der KPI-Detailseite (ein einzelnes Aggregat je Metrik)."""

    property_id: str
    property_title: str = ""
    detail: StatMetricDetail


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
