"""Schemas fuer die Steuern, die der Gastgeber je Objekt selbst festlegt."""
from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class ChargeMode(StrEnum):
    """Abrechnungsart — die vier aus dem Airbnb-Modell (Hilfeartikel 2523)."""

    PERCENTAGE_PER_BOOKING = "percentage_per_booking"
    PER_GUEST = "per_guest"
    PER_NIGHT = "per_night"
    PER_GUEST_PER_NIGHT = "per_guest_per_night"


class TaxableBase(StrEnum):
    """Worauf ein Prozentsatz rechnet.

    Die Servicegebuehr der Plattform fehlt bewusst und darf nie dazukommen:
    sie ist unser Entgelt, nicht die Leistung des Gastgebers — Airbnb schliesst
    sie ebenso aus ("Airbnb service fees" nicht besteuerbar).
    """

    BASE_PRICE = "base_price"
    CLEANING_FEE = "cleaning_fee"
    LINEN_FEE = "linen_fee"
    RESORT_FEE = "resort_fee"
    MANAGEMENT_FEE = "management_fee"
    COMMUNITY_FEE = "community_fee"


class PropertyTaxInput(BaseModel):
    """Eine Steuer, wie der Gastgeber sie anlegt."""

    tax_type: str = Field(min_length=1, max_length=120)
    charge_mode: ChargeMode
    # Basispunkte statt Prozent: 0,1 % waere als Integer-Prozent nicht
    # darstellbar und wuerde auf 0 gerundet.
    rate_bps: int | None = Field(default=None, gt=0, le=10000)
    amount_minor: int | None = Field(default=None, gt=0)
    taxable_base: list[TaxableBase] = Field(default_factory=list)
    # Ohne Registrierungsnummer reicht auch Airbnb keine Steuer durch. Eine
    # Steuer ohne Registrierung ist eine Behauptung, kein Anspruch.
    registration_number: str = Field(min_length=1, max_length=120)
    long_stay_exempt_nights: int | None = Field(default=None, gt=0)
    taxable_first_nights: int | None = Field(default=None, gt=0)
    max_amount_minor: int | None = Field(default=None, gt=0)
    active: bool = True

    @model_validator(mode="after")
    def _betrag_passt_zur_art(self) -> PropertyTaxInput:
        """Genau EINE Betragsangabe, passend zur Abrechnungsart.

        Ohne diese Pruefung koennte eine Zeile „5 %" UND „3 EUR" sagen — die
        Berechnung waere nicht entscheidbar, und der Gast bekaeme je nach
        Codepfad einen anderen Preis. Der gleiche CHECK steht in der DB; hier
        steht er, damit der Fehler als 422 mit Klartext zurueckkommt statt als
        Constraint-Verletzung.
        """
        prozent = self.charge_mode is ChargeMode.PERCENTAGE_PER_BOOKING
        if prozent and (self.rate_bps is None or self.amount_minor is not None):
            raise ValueError(
                "Bei einem Prozentsatz gehört der Satz in rate_bps und "
                "amount_minor bleibt leer."
            )
        if not prozent and (
            self.amount_minor is None or self.rate_bps is not None
        ):
            raise ValueError(
                "Bei einem Festbetrag gehört der Betrag in amount_minor und "
                "rate_bps bleibt leer."
            )
        # Eine Bemessungsgrundlage ohne Prozentsatz taeuscht eine Genauigkeit
        # vor, die die Rechnung nicht hat.
        if not prozent and self.taxable_base:
            raise ValueError(
                "Eine Bemessungsgrundlage gibt es nur beim Prozentsatz."
            )
        if prozent and not self.taxable_base:
            raise ValueError(
                "Wähle mindestens eine Bemessungsgrundlage, sonst ist "
                "unklar, worauf der Prozentsatz rechnet."
            )
        return self


class PropertyTaxResponse(PropertyTaxInput):
    id: str
    property_id: str
    created_at: datetime
    updated_at: datetime
