"""Schemas des taxpayer-Slice (Airbnb „Konto → Steuern → Steuerzahler").

Die Validierung sitzt hier UND als CHECK in der DB (0226) — doppelt bewusst:
Pydantic liefert dem Nutzer eine sprechende Meldung, der DB-Constraint schuetzt
auch Schreibpfade, die nicht durch dieses Schema laufen.
"""
from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator, model_validator


class TaxpayerKind(StrEnum):
    INDIVIDUAL = "individual"
    ENTITY = "entity"


class TaxpayerBase(BaseModel):
    """Gemeinsame Felder. Welche davon Pflicht sind, entscheidet `kind`."""

    country: str = Field(min_length=2, max_length=2)
    kind: TaxpayerKind
    tin: str | None = None

    # natuerliche Person
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    birth_place_city: str | None = None
    birth_place_country: str | None = Field(default=None, min_length=2, max_length=2)

    # Rechtstraeger
    legal_name: str | None = None
    business_registration_number: str | None = None

    # Anschrift
    address_line1: str | None = None
    address_line2: str | None = None
    postal_code: str | None = None
    city: str | None = None

    @field_validator("country", "birth_place_country")
    @classmethod
    def _laenderkuerzel_gross(cls, v: str | None) -> str | None:
        return v.upper() if v else v

    @field_validator("tin")
    @classmethod
    def _tin_normalisieren(cls, v: str | None) -> str | None:
        """Leerzeichen/Bindestriche raus — Behoerden schreiben sie
        unterschiedlich, gemeldet wird die reine Nummer."""
        if not v:
            return None
        gesaeubert = "".join(v.split()).replace("-", "").replace(".", "")
        return gesaeubert.upper() or None

    @model_validator(mode="after")
    def _pflichtfelder_je_art(self) -> TaxpayerBase:
        """Spiegelt die DB-Constraints aus 0226 mit lesbaren Meldungen."""
        if self.kind is TaxpayerKind.INDIVIDUAL:
            fehlt = [
                name
                for name, wert in (
                    ("Vorname", self.first_name),
                    ("Nachname", self.last_name),
                    ("Geburtsdatum", self.date_of_birth),
                )
                if not wert
            ]
            if fehlt:
                msg = f"Für eine natürliche Person fehlt: {', '.join(fehlt)}."
                raise ValueError(msg)
        elif not self.legal_name:
            msg = "Für ein Unternehmen ist der Firmenname Pflicht."
            raise ValueError(msg)

        # DAC7 laesst den Geburtsort als Ersatz zu, wenn das Land keine
        # Steuer-ID an Privatpersonen vergibt — aber nur dort.
        if not self.tin:
            if self.kind is TaxpayerKind.ENTITY:
                msg = "Für ein Unternehmen ist die Steuernummer Pflicht."
                raise ValueError(msg)
            if not (self.birth_place_city and self.birth_place_country):
                msg = (
                    "Ohne Steueridentifikationsnummer sind Geburtsort und "
                    "Geburtsland Pflicht."
                )
                raise ValueError(msg)
        return self


class TaxpayerCreate(TaxpayerBase):
    """Anlegen oder Ersetzen des Eintrags für ein Land."""


class TaxpayerEntry(TaxpayerBase):
    """Ein gespeicherter Eintrag."""

    id: str
    confirmed_at: datetime | None = None
    updated_at: datetime | None = None


class TaxpayerOverview(BaseModel):
    """Die Sicht für den Steuern-Tab.

    `fehlende_laender` sind Länder, in denen der Betrieb Objekte hat, für die
    aber noch keine Steuerangaben vorliegen — genau die, die nach DAC7 fehlen.
    Sie werden aus den Objekten abgeleitet, nicht geraten (Wurzel 4).
    """

    eintraege: list[TaxpayerEntry]
    fehlende_laender: list[str]
    vat_id: str | None = None
