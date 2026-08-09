"""Pydantic-Schemas für den public_portal-Slice (Eigentümer-Self-Service-Portal).

Der eingeloggte Eigentümer (Rolle 'owner') sieht NUR seine zugeordneten Objekte
(owner_property_assignments), Beträge/Gäste maskiert (guest_masking, §4.2).
"""
from datetime import date as date_

from pydantic import BaseModel, Field, model_validator


class PortalProperty(BaseModel):
    id: str
    title: str
    city: str | None = None
    photo: str | None = None


class PortalPropertyList(BaseModel):
    items: list[PortalProperty]
    total: int


class PortalNightBooking(BaseModel):
    """EINE Buchung, die diese Nacht belegt — eine Zeile je EINHEIT.

    Seit 0265 führt ein `property_id` n ≥ 1 Einheiten (`property_units`), und
    `reservations.unit_id` sagt, welche eine Buchung belegt. Ein Typ mit fünf
    identischen Studios kann an derselben Nacht fünf Buchungen tragen; jede
    davon ist Geld des Eigentümers. Vorher trug die Antwort je Nacht nur EINE
    Buchung, und die Payouts der übrigen Einheiten fielen still weg.
    """

    reservation_id: str
    # Welche Einheit belegt ist. `None` heißt: die Buchung ist noch nicht auf
    # eine Einheit gelegt (Altbestand vor 0265, oder ein Objekt mit genau einer
    # Einheit) — dann ist es der Typ als Ganzes.
    unit_id: str | None = None
    # Netto-Auszahlung des Eigentümers für DIESE Buchung in DIESER Nacht.
    # None + `payout_unknown_reason` = nicht ausweisbar (Wurzel 4).
    owner_payout_per_night: float | None = None
    currency: str | None = None
    payout_unknown_reason: str | None = None
    guest_first_name: str | None = None
    booking_source: str | None = None


class PortalCalendarDay(BaseModel):
    date: date_
    status: str  # open | booked | blocked
    # Gast-Verkaufspreis/Nacht — nur wenn die Maske Beträge erlaubt (sonst
    # None). Für einen Eigentümer ist das laut §4.2 IMMER None; er sieht
    # stattdessen `owner_payout_per_night` (siehe unten).
    price: float | None = None

    # --- Netto-Auszahlung des Eigentümers je belegter Nacht (Etappe B) ------
    # Was der Eigentümer für DIESE Nacht bekommt: sein Anteil am Buchungs-
    # Payout (total_amount + Extras − channel_fee) nach Abzug der Provision,
    # gleichmäßig über die Nächte des Aufenthalts verteilt. NICHT der
    # Gast-Gesamtpreis — der bleibt ihm verborgen (§4.2).
    #
    # SUMME über alle Einheiten des Typs: seit 0265 können mehrere Buchungen
    # dieselbe Nacht belegen (je Einheit eine). Die Einzelposten stehen in
    # `bookings`; dieses Feld ist ihre Summe, damit die Monatsansicht eine
    # Zahl je Zelle zeigen kann.
    #
    # None bedeutet: für diese Nacht ist kein Betrag ausweisbar (auch dann,
    # wenn nur EINE von mehreren Buchungen unbestimmt ist — eine Teilsumme
    # sähe aus wie der volle Ertrag). Der Grund steht in
    # `owner_payout_unknown_reason` — es wird KEINE Zahl erfunden (Wurzel 4).
    owner_payout_per_night: float | None = None
    # Währung DIESES Betrags, aus den Daten der Reservierung. Nie ersetzt.
    # None, wenn die Buchungen der Nacht verschiedene Währungen tragen.
    currency: str | None = None
    # provision | betrag | naechte — warum kein Betrag ausgewiesen wird.
    owner_payout_unknown_reason: str | None = None

    # Gast NUR mit Vorname — über die zentrale GuestMask gekürzt, nicht per
    # eigener Logik. Ein Eigentümer hat VIEW_GUEST_LIMITED (§4.2).
    # Bei mehreren belegten Einheiten der ERSTE (stabil sortiert); die
    # vollständige Aufstellung steht in `bookings`.
    guest_first_name: str | None = None
    # Buchungsquelle der Nacht (ota_name, sonst channel): woher die Buchung kam
    # und damit, welcher Portal-Abzug im Payout steckt.
    booking_source: str | None = None

    # Alle Buchungen dieser Nacht, eine je belegter EINHEIT (0265). Leer =
    # keine Buchung. Die drei Felder oben sind die Verdichtung davon.
    bookings: list[PortalNightBooking] = Field(default_factory=list)
    # Wie viele Einheiten des Typs an diesem Tag belegt sind. Passt zur
    # Verfügbarkeit je Einheit (0266): der Eigentümer eines Typs mit fünf
    # Studios muss „3 von 5 belegt" sehen können, nicht nur „belegt".
    units_booked: int = 0
    # Wie viele Einheiten der Typ überhaupt führt (property_units). Ohne diese
    # Zahl ist `units_booked` nicht einzuordnen.
    units_total: int = 1


class PortalCalendarResponse(BaseModel):
    property_id: str
    days: list[PortalCalendarDay]


class PortalEarningsItem(BaseModel):
    property_id: str
    title: str
    nights: int
    reservations: int
    # Maskiert: nur sichtbar, wenn die Maske Beträge erlaubt.
    payout: float | None = None
    currency: str


class PortalEarningsResponse(BaseModel):
    period_from: date_
    period_to: date_
    items: list[PortalEarningsItem]
    total_payout: float | None = None
    currency: str


class PortalStatementItem(BaseModel):
    id: str
    period_from: date_
    period_to: date_
    status: str
    owner_payout: float
    currency: str
    invoice_number: str | None = None
    created_at: str | None = None


class PortalStatementList(BaseModel):
    items: list[PortalStatementItem]
    total: int


class BlockRequestCreate(BaseModel):
    """Sperrwunsch des Eigentümers. `start_date`/`end_date` sind INKLUSIV
    („vom 1. bis zum 5."); die Umrechnung auf den exklusiven Kalender-Range
    passiert erst bei der Genehmigung."""

    property_id: str
    start_date: date_
    end_date: date_
    # Warum gesperrt werden soll (Eigennutzung, Handwerker …). Optional, aber
    # die Agentur kann ohne sie schlecht entscheiden.
    reason: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _check_order(self) -> "BlockRequestCreate":
        # Ohne diese Prüfung ließe sich ein Antrag mit end < start speichern,
        # der erst bei der Genehmigung auffiele — der Service prüft es zwar
        # auch, aber ein ungültiger Antrag soll gar nicht erst entstehen.
        if self.end_date < self.start_date:
            msg = "end_date darf nicht vor start_date liegen"
            raise ValueError(msg)
        return self


class BlockRequestItem(BaseModel):
    id: str
    property_id: str
    start_date: date_
    end_date: date_
    status: str
    reason: str | None = None
    # Entscheidung der Agentur — der Eigentümer sieht, WANN und mit welcher
    # Anmerkung entschieden wurde (nicht, WER es war: die interne Zuständigkeit
    # geht ihn nichts an).
    decided_at: str | None = None
    decision_note: str | None = None
    created_at: str | None = None


class BlockRequestList(BaseModel):
    items: list[BlockRequestItem]
    total: int


class MeterReadingCreate(BaseModel):
    property_id: str
    meter_kind: str = Field(min_length=1, max_length=50)
    value: float = Field(ge=0)
    read_at: date_


class MeterReadingItem(BaseModel):
    id: str
    property_id: str
    meter_kind: str
    value: float
    read_at: date_
    created_at: str | None = None


class MeterReadingList(BaseModel):
    items: list[MeterReadingItem]
    total: int


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
