"""Schemas der Familienzugänge (0389).

Eigene Datei neben `schemas.py`, weil das ein abgeschlossener Vorgang ist und
`schemas.py` bereits die Kalender-, Berichts- und Sperrantrags-Verträge trägt.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from src.features.auth.schemas import pruefe_sprache

# Die Stufen aus dem Enum public.owner_family_access (0389). Als Literal, damit
# ein unbekannter Wert schon an der HTTP-Grenze mit 422 abprallt und nicht erst
# als leere Rechte-Menge im Service ankommt.
FamilienStufe = Literal["nutzung", "nutzung_berichte"]


class FamilienZugangCreate(BaseModel):
    """Ein Familienmitglied zu EINEM Objekt einladen."""

    property_id: str
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    # Voreinstellung ist die engere Stufe. Berichte (Umsatz, Abrechnung,
    # Auszahlung) sind Geschäftsdaten des Eigentümers und werden bewusst
    # zugeschaltet, nicht versehentlich mitgegeben (Art. 25 Abs. 2 DSGVO).
    access: FamilienStufe = "nutzung"
    # Sprache des EMPFÄNGERS, nicht des Einladenden — sonst bekäme ein
    # dänisches Familienmitglied die Mail in der Browsersprache des Vaters
    # (dasselbe Argument wie in InviteRequest.preferred_language).
    preferred_language: str | None = Field(default=None, max_length=10)

    @field_validator("preferred_language")
    @classmethod
    def _sprache_pruefen(cls, v: str | None) -> str | None:
        return pruefe_sprache(v)


class FamilienZugangUpdate(BaseModel):
    """Zugriffsstufe eines bestehenden Zugangs ändern."""

    access: FamilienStufe


class FamilienZugangItem(BaseModel):
    id: str
    user_id: str
    property_id: str
    access: FamilienStufe
    email: str | None = None
    full_name: str | None = None
    created_at: datetime | None = None


class FamilienZugangList(BaseModel):
    items: list[FamilienZugangItem]
    total: int


class FamilienZugangCreated(BaseModel):
    """Ergebnis der Einladung.

    `einladung_versendet` sagt ehrlich, ob eine Mail rausging: Bestand die
    Adresse im Betrieb schon als Login, wird nur VERKNÜPFT — dann bekommt
    niemand eine Mail, und die Oberfläche darf nicht „Einladung verschickt"
    behaupten (Wurzel 4; derselbe Fall wie owners/service.py).
    """

    zugang: FamilienZugangItem
    einladung_versendet: bool


class PortalRolleInfo(BaseModel):
    """Was der eingeloggte Portal-Nutzer ist und darf.

    Die Oberfläche braucht das, um keinen Menüpunkt anzubieten, der in eine
    leere Liste oder einen 403 führt. Sie DARF daraus aber keine Sicherheit
    ableiten — jeder Endpunkt prüft seine Rechte selbst (Wurzel 9). Diese
    Auskunft steuert nur, was sichtbar ist.
    """

    ist_familienmitglied: bool
    darf_berichte: bool
    darf_zugaenge: bool


class FreigabeAntragItem(BaseModel):
    """Ein Sperrantrag, der auf die Freigabe des Eigentümers wartet."""

    id: str
    property_id: str
    unit_id: str | None = None
    start_date: str
    end_date: str
    reason: str | None = None
    created_at: datetime | None = None
    requested_by: str
    # Name des Antragstellers, damit der Eigentümer nicht auf eine UUID schaut.
    antragsteller: str | None = None


class FreigabeAntragList(BaseModel):
    items: list[FreigabeAntragItem]
    total: int


class FreigabeEntscheidung(BaseModel):
    """Stufe 1: freigeben oder ablehnen.

    KEINE Kalenderwirkung — erst die Agentur (Stufe 2) legt bei ihrer
    Genehmigung die Reservierung an. Bis dahin bleibt das Objekt verkäuflich.
    """

    freigeben: bool
    note: str | None = Field(default=None, max_length=2000)
