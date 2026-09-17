"""Schemas des booking_access-Slice — Buchungsberechtigungen (Airbnb-Modell).

Airbnb führt das als EIN Feld am Inserat (`instant_booking_allowed_category`)
mit fünf Werten. Bei uns sind es zwei Felder: der Modus (Sofortbuchung oder
Anfrage) und, falls Sofortbuchung, für WEN sie gilt. Zusammen ergeben sie
dieselben fünf Zustände — siehe Migration 0718.
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class Buchungsmodus(StrEnum):
    """Airbnb: Sofortbuchung an (`everyone` …) oder aus (`off`)."""

    instant = "instant"
    request = "request"


class Zielgruppe(StrEnum):
    """Für wen die Sofortbuchung gilt — Airbnbs vier „an"-Kategorien."""

    everyone = "everyone"
    guests_with_verified_identity = "guests_with_verified_identity"
    well_reviewed_guests = "well_reviewed_guests"
    well_reviewed_guests_with_verified_identity = (
        "well_reviewed_guests_with_verified_identity"
    )


class Buchungsberechtigung(BaseModel):
    """Die Entscheidung des Betriebs plus der tatsächliche Stand der Objekte.

    `objekte_abweichend` ist kein Beiwerk: die Entscheidung liegt am Betrieb,
    maßgeblich für die einzelne Buchung ist aber das Objekt. Wer ein Objekt im
    Assistenten anders eingestellt hat, muss das hier sehen — sonst zeigt die
    Seite eine Entscheidung an, die für einen Teil des Bestands nicht gilt.
    """

    modus: Buchungsmodus
    zielgruppe: Zielgruppe
    # Airbnb „Nachricht vor der Buchung": None/leer = keine Frage. Kein
    # zusätzlicher Schalter — zwei Felder für dieselbe Aussage laufen
    # auseinander.
    vorab_frage: str | None = None
    objekte_gesamt: int
    objekte_abweichend: int


class BuchungsberechtigungUpdate(BaseModel):
    """Neue Entscheidung. Gilt für den Betrieb UND alle seine Objekte — wie der
    Suchmaschinen-Schalter (0714), aus demselben Grund: eine Entscheidung, die
    nur für künftige Objekte gälte, wäre für den Bestand wirkungslos."""

    modus: Buchungsmodus
    zielgruppe: Zielgruppe = Field(default=Zielgruppe.everyone)
    # Obergrenze am Eingang, nicht erst in der DB (Wurzel 8). 1000 Zeichen sind
    # reichlich für eine Frage und klein genug, dass niemand hier einen Roman
    # in jede Buchungsstrecke schreibt.
    vorab_frage: str | None = Field(default=None, max_length=1000)
