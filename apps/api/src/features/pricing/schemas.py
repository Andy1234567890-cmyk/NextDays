"""Pydantic-Schemas für den pricing-Slice (zentrale Preis-Wahrheit).

Der pricing-Slice ist die EINZIGE Stelle, die einen Effektivpreis pro Tag und
einen vollständigen Buchungs-Quote berechnet. Kalender, Reservierungs-Wizard und
Buchungsstrecke lesen ausschließlich hierüber — kein direktes Preis-Tabellenlesen
mehr in anderen Slices.
"""
from datetime import date

from pydantic import BaseModel, Field, model_validator


class EffectivePriceDay(BaseModel):
    """Effektiver Preis eines einzelnen Tages (kein Fallback: None = kein Preis)."""

    date: date
    price: float | None = None
    # Herkunft des Preises (Transparenz/Debug): override | weekday | base | none.
    source: str = "none"


class QuoteRequest(BaseModel):
    """Anfrage für einen Buchungs-Quote (Preisaufschlüsselung)."""

    property_id: str
    check_in: date
    check_out: date  # exklusiv (Abreisetag ist wieder frei)
    guests: int = Field(default=1, ge=1)
    # Kanal bestimmt den Markup-Aufschlag (direct = kein Markup).
    channel: str = "direct"

    @model_validator(mode="after")
    def _check_order(self) -> "QuoteRequest":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        return self


class QuoteLine(BaseModel):
    """Eine Position der Aufschlüsselung (Label + Betrag; negativ = Rabatt)."""

    label: str
    amount: float


class QuoteResponse(BaseModel):
    """Vollständige Preisaufschlüsselung eines Aufenthalts.

    nightly_total = Summe der Effektiv-Tagespreise (inkl. Längen-/Kurzaufenthalts-
    Logik + Markup + Extra-Gast). lines enthält die einzelnen Positionen in
    Anzeigereihenfolge; total ist die Endsumme. currency stammt aus der Konfig/
    dem Rate-Plan (kein erfundener Default).
    """

    property_id: str
    check_in: date
    check_out: date
    nights: int
    guests: int
    channel: str
    currency: str
    nightly_total: float
    lines: list[QuoteLine] = []
    total: float
    # True, wenn das Objekt keinen bepreisbaren Tag hat (kein Rate-Plan/Override/
    # Wochentagspreis) — der Aufrufer muss dann manuell bepreisen, statt 0 zu zeigen.
    priceless: bool = False


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
