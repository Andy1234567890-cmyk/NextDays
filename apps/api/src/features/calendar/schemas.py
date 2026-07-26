"""Pydantic-Schemas für den calendar-Slice.

Bildet die availability-Tabelle ab (Migration 0004): eine Zeile pro
(property_id, date) = die eine Wahrheit gegen Double-Bookings.
"""
from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class AvailabilityStatus(StrEnum):
    open = "open"
    booked = "booked"
    blocked = "blocked"


class AvailabilitySource(StrEnum):
    direct = "direct"
    portal = "portal"
    booking = "booking"
    airbnb = "airbnb"
    vrbo = "vrbo"
    # Sonstige OTA (Expedia, Agoda, Namensvarianten). Externer Kanal:
    # 1 % monatlich, kein Charge über uns (Preisliste §2).
    ota_other = "ota_other"
    manual = "manual"


class DateRange(BaseModel):
    start: date
    end: date  # exklusiv (Check-out-Tag ist wieder frei)

    @model_validator(mode="after")
    def _check_order(self) -> "DateRange":
        if self.end <= self.start:
            raise ValueError("end muss nach start liegen")
        return self

    def nights(self) -> list[date]:
        """Alle Übernachtungstage (start inklusive, end exklusiv)."""
        from datetime import timedelta

        days: list[date] = []
        cur = self.start
        while cur < self.end:
            days.append(cur)
            cur += timedelta(days=1)
        return days


class DayAvailability(BaseModel):
    date: date
    status: AvailabilityStatus
    source: AvailabilitySource
    # Tagespreis (Resolver): override > dynamic > weekday > base.
    # None, wenn das Objekt keinen Rate-Plan/Override hat (kein Fallback-Wert).
    price: float | None = None
    # Herkunft des Tagespreises: override | dynamic | weekday | base | none.
    # „dynamic" = von der Dynamic-Pricing-Engine → UI zeigt „auto"-Badge.
    price_source: str = "none"
    # Faktor-Aufschlüsselung bei dynamischem Preis ({faktor: multiplikator}) für
    # den „Warum dieser Preis?"-Tooltip. None außer bei price_source=dynamic.
    price_factors: dict[str, float] | None = None
    # Mindestaufenthalt aus dem Rate-Plan des Objekts (per-Tag-Restriktionen v2).
    min_stay: int | None = None
    # CTA/CTD-Restriktionen je Tag (Default false bei fehlender availability-Zeile).
    closed_to_arrival: bool = False
    closed_to_departure: bool = False


class AvailabilityCheck(BaseModel):
    property_id: str
    available: bool
    conflicting_days: list[date] = []


class BoardProperty(BaseModel):
    """Ein Objekt im Batch-Kalender: Tagesdaten + Stop-Sells in einem Rutsch.

    Ersetzt die N+1-Einzelabrufe (früher 2 HTTP-Calls je Objekt) durch EINE
    gebündelte Antwort für alle Objekte des Tenants — der Board-Endpunkt lädt die
    zugrundeliegenden Tabellen mit wenigen `.in_(property_ids)`-Queries statt mit
    6 Queries pro Objekt."""
    property_id: str
    # Objekt-Währung (aus dem Rate-Plan) für die Tagespreis-Anzeige — damit das
    # Frontend die Währung nicht mehr behelfsweise aus Reservierungen ableitet
    # (Objekte ohne Buchung hätten sonst keine Währung).
    currency: str | None = None
    days: list[DayAvailability] = []
    stop_sell: list["StopSellDay"] = []


class BoardResponse(BaseModel):
    items: list[BoardProperty] = []


class BlockRequest(BaseModel):
    property_id: str
    range: DateRange


class PriceOverrideRequest(BaseModel):
    property_id: str
    date: date
    price: float | None  # None = Überschreibung zurücknehmen (Lastenheft §2.2)


class StopSellSource(StrEnum):
    manual = "manual"
    channex = "channex"


class StopSellScope(StrEnum):
    # all: sperrt alle Vertriebskanäle (Default, wie bisher). channels: nur die
    # in channels[] genannten Kanäle (z. B. ["ota:BookingCom"], ["platform"]).
    all = "all"
    channels = "channels"


class StopSellDay(BaseModel):
    id: str
    property_id: str
    date: date
    reason: str | None = None
    source: StopSellSource
    # Hotel: Stopp gilt NUR für diesen Rate-Plan (Zeile im Stop-Sell-Kalender).
    # None = Objekt-Ebene (Ferienwohnung/Altdaten) → gilt für alle Pläne.
    rate_plan_id: str | None = None
    # Kanal-Dimension: all = alle Kanäle (Default), channels = nur channels[].
    scope: StopSellScope = StopSellScope.all
    channels: list[str] = []
    # Reisebüro/Veranstalter, an den sich der Stopp richtet (None = alle).
    agency_id: str | None = None
    # Name des Reisebüros (Join travel_agencies) — fürs Kalender-Balken-Label.
    agency_name: str | None = None


class StopSellListResponse(BaseModel):
    items: list[StopSellDay] = []
    total: int = 0


class StopSellRequest(BaseModel):
    """Verkaufsstopp für einen Zeitraum setzen (manuell).

    weekdays: optionale Wochentags-Maske (ISO: 0=Montag … 6=Sonntag) — nur
    passende Tage im Zeitraum werden gesperrt (z. B. nur Wochenenden).
    None/leer = alle Tage.
    """
    property_id: str
    range: DateRange
    reason: str | None = None
    weekdays: list[int] | None = None
    # Adressat der Stop-Sale-Meldung (travel_agencies.id); None = alle Kanäle.
    agency_id: str | None = None

    @model_validator(mode="after")
    def _check_weekdays(self) -> "StopSellRequest":
        if self.weekdays is not None and any(w < 0 or w > 6 for w in self.weekdays):
            raise ValueError("weekdays müssen zwischen 0 (Montag) und 6 (Sonntag) liegen")
        return self


class StopSellClearRequest(BaseModel):
    property_id: str
    range: DateRange
    # Wochentags-Maske wie bei StopSellRequest (nur passende Tage aufheben).
    weekdays: list[int] | None = None
    # include_portal: auch Portal-/Channex-Stops aufheben (nicht nur manuelle).
    # Für versehentlich/über einen Test gesetzte Stops. Öffnet die Tage dann auch
    # an den OTAs (stop_sell=false-Push) — bewusst, daher opt-in.
    include_portal: bool = False

    @model_validator(mode="after")
    def _check_weekdays(self) -> "StopSellClearRequest":
        if self.weekdays is not None and any(w < 0 or w > 6 for w in self.weekdays):
            raise ValueError("weekdays müssen zwischen 0 (Montag) und 6 (Sonntag) liegen")
        return self


class StopSellResetRequest(BaseModel):
    # property_id=None → alle Objekte des Tenants zurücksetzen.
    property_id: str | None = None


class SeasonPriceRequest(BaseModel):
    """Tagespreis für einen Zeitraum setzen (Saisonpreis). end exklusiv."""
    property_id: str
    range: DateRange
    price: float  # pro Nacht


class SeasonPriceDay(BaseModel):
    date: date
    price: float


class SeasonPriceListResponse(BaseModel):
    items: list[SeasonPriceDay] = []
    total: int = 0


# -- Benannte Saisons (Jahres-Kalender, Drag&Drop) --------------------------
class SeasonMode(StrEnum):
    percent = "percent"  # amount = Aufschlag/Abschlag in % auf den Basispreis
    fixed = "fixed"      # amount = fester Nachtpreis


class SeasonCreate(BaseModel):
    """Benannte Saison-Kategorie eines Objekts (Hochsaison, Event …)."""
    property_id: str
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    mode: SeasonMode
    amount: float

    @model_validator(mode="after")
    def _check_amount(self) -> "SeasonCreate":
        if self.mode == SeasonMode.fixed and self.amount < 0:
            raise ValueError("Fester Preis darf nicht negativ sein")
        return self


class SeasonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    mode: SeasonMode | None = None
    amount: float | None = None


class SeasonAssignRequest(BaseModel):
    """Einen Datumsbereich einer Saison zuweisen. end exklusiv (wie DateRange)."""
    property_id: str
    season_id: str
    range: DateRange


class SeasonAssignment(BaseModel):
    id: str
    season_id: str
    start_date: date
    end_date: date  # inklusiv (DB speichert inklusiv)


class SeasonResponse(BaseModel):
    id: str
    property_id: str
    name: str
    color: str
    mode: SeasonMode
    amount: float
    assignments: list[SeasonAssignment] = []


class SeasonListResponse(BaseModel):
    items: list[SeasonResponse] = []
    total: int = 0


class BulkEditRequest(BaseModel):
    """Mehrere Objekte × ein Zeitraum in einem Rutsch bearbeiten (wie Hostaway).

    Es wird nur angewendet, was gesetzt ist (None = unverändert):
      - price:             fester Tagespreis je Tag (price_overrides + Channex)
      - price_adjust_pct:  prozentuale Anpassung des effektiven Tagespreises
                           (z. B. +10 / -15); schließt `price` aus
      - min_stay:          Mindestaufenthalt je Objekt (rate_plans + Channex)
      - max_stay:          Maximalaufenthalt je Objekt (Channex-Restriction)
      - block:             True = sperren, False = Sperre aufheben (availability)
      - stop_sell:         True = Verkaufsstopp setzen, False = aufheben
    """

    property_ids: list[str]
    range: DateRange
    price: float | None = None
    price_adjust_pct: float | None = None
    min_stay: int | None = None
    max_stay: int | None = Field(default=None, ge=0)
    block: bool | None = None
    stop_sell: bool | None = None
    closed_to_arrival: bool | None = None
    closed_to_departure: bool | None = None

    @model_validator(mode="after")
    def _at_least_one(self) -> "BulkEditRequest":
        if not self.property_ids:
            raise ValueError("Mindestens ein Objekt erforderlich")
        if self.price is not None and self.price_adjust_pct is not None:
            raise ValueError(
                "Fester Preis und prozentuale Anpassung schließen sich aus"
            )
        changes = (
            self.price,
            self.price_adjust_pct,
            self.min_stay,
            self.max_stay,
            self.block,
            self.stop_sell,
            self.closed_to_arrival,
            self.closed_to_departure,
        )
        if all(c is None for c in changes):
            raise ValueError("Mindestens eine Änderung erforderlich")
        return self


class BulkEditResult(BaseModel):
    properties: int  # Anzahl bearbeiteter Objekte
    days: int        # Tage je Objekt im Zeitraum
    applied: list[str]  # welche Aktionen ausgeführt wurden


class RestrictionRow(BaseModel):
    """Eine Restriktions-Zeile für einen Datumsbereich (end inklusiv über die
    DateRange, hier als von/bis; end exklusiv). Beliebige Kombination gesetzter
    Felder — nur gesetzte werden an Channex gesendet."""
    range: DateRange
    # Hotel: Zeile gilt für GENAU diesen Rate-Plan (Twin/BAR ≠ Double/B&B am
    # selben Tag). None = Objekt-Ebene (Ferienwohnung) → alle Pläne. Der Plan
    # wird serverseitig gegen das Objekt geprüft (Wurzel 3), nie geglaubt.
    rate_plan_id: str | None = None
    price: float | None = Field(default=None, ge=0)  # fester Nachtpreis
    min_stay: int | None = Field(default=None, ge=1)
    max_stay: int | None = Field(default=None, ge=0)
    closed_to_arrival: bool | None = None
    closed_to_departure: bool | None = None
    stop_sell: bool | None = None
    # Grund für den lokalen stop_sell-Spiegel (Guesty-Muster: „Wartung — Notiz").
    # Geht NICHT an Channex (kennt kein reason-Feld), nur in die eigene Tabelle.
    reason: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "RestrictionRow":
        if all(v is None for v in (
            self.price, self.min_stay, self.max_stay,
            self.closed_to_arrival, self.closed_to_departure, self.stop_sell,
        )):
            raise ValueError("Jede Zeile braucht mindestens eine Restriktion")
        return self


class RestrictionRowsRequest(BaseModel):
    """Mehrere heterogene Restriktions-Zeilen eines Objekts in EINEM Channex-Call
    (Zertifizierung Test 3-8: verschiedene Preise/Restriktionen, 1 API-Call)."""
    property_id: str
    rows: list[RestrictionRow] = Field(min_length=1)


class MultiRestrictionRow(RestrictionRow):
    """Restriktions-Zeile MIT Objekt-Bezug — für die zimmerübergreifende
    Bulk-Aktion (Hotel: eine Aktion über mehrere Zimmer × Rate-Plans).
    property_id wird serverseitig gegen den Tenant geprüft (Wurzel 3)."""
    property_id: str


class MultiRestrictionRowsRequest(BaseModel):
    """Zimmer-übergreifende Bulk-Restriktionen: eine UI-Aktion über mehrere
    Zimmer × Rate-Plans → EIN gebündelter Channex-Call je Channex-Property
    (Zertifizierung Tests 3-8 über Room-Types hinweg)."""
    rows: list[MultiRestrictionRow] = Field(min_length=1)


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
