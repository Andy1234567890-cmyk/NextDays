"""Schemas für Überstundenanträge, Guttage, Zeit-Listen und terminierte
Akte-Änderungen (0544, Vertrag §3.1/§3.4/§3.5).

Alles, was das Paket „Zeit" an eigenen Formen mitbringt, liegt hier — die vier
Klassen der gemeinsamen `schemas.py` (Akte, AkteUpdate, Zeiterfassung,
StempelStart) sind dort erweitert, jede NEUE Klasse gehört laut Vertrag §0 in
die Paket-Datei.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

UeberstundenStatus = Literal["beantragt", "genehmigt", "abgelehnt"]
GuttageGrund = Literal["feiertagsarbeit", "ausgleich", "korrektur", "abbau"]

# Harte Obergrenzen (Wurzel 8): ein Antrag deckt höchstens einen Tag (12 h) ab,
# eine terminierte Änderung höchstens 40 Felder.
MAX_UEBERSTUNDEN_MINUTEN = 720
MAX_AENDERUNG_FELDER = 40


# --- Zeit-Listen (§3.4) ------------------------------------------------------


class ZeitZusammenfassung(BaseModel):
    user_id: str
    full_name: str | None = None
    arbeitstage: int
    netto_minuten: int
    # None, wenn die Akte keine Wochenstunden trägt — kein erfundenes Soll.
    soll_minuten: int | None = None
    ueberstunden_minuten: int
    krank_tage: float
    urlaub_tage: float
    unbestaetigt: int
    verspaetungen: int


class ZeitOffenPunkte(BaseModel):
    user_id: str
    full_name: str | None = None
    unbestaetigt: int
    verpasst: int
    aelteste: date | None = None


# --- Überstundenanträge (§3.5) ----------------------------------------------


class UeberstundenCreate(BaseModel):
    datum: date
    minuten: int = Field(ge=1, le=MAX_UEBERSTUNDEN_MINUTEN)
    grund: str = Field(min_length=3, max_length=1000)
    zeiterfassung_id: str | None = None


class UeberstundenEntscheiden(BaseModel):
    genehmigen: bool
    kommentar: str | None = Field(default=None, max_length=1000)


class Ueberstundenantrag(BaseModel):
    id: str
    user_id: str
    full_name: str | None = None
    datum: date
    minuten: int
    grund: str
    status: UeberstundenStatus
    kommentar: str | None = None
    zeiterfassung_id: str | None = None
    entschieden_von: str | None = None
    entschieden_am: datetime | None = None
    created_at: datetime | None = None


# --- Guttage (§3.5) ---------------------------------------------------------


class GuttageBuchungCreate(BaseModel):
    user_id: str
    datum: date
    # 0 ist keine Buchung (DB-CHECK `tage <> 0`); Vorzeichen trägt die Richtung.
    tage: float = Field(ge=-30, le=30)
    grund: GuttageGrund
    notiz: str | None = Field(default=None, max_length=1000)
    abwesenheit_id: str | None = None


class GuttageBuchung(BaseModel):
    id: str
    user_id: str
    datum: date
    tage: float
    grund: GuttageGrund
    notiz: str | None = None
    abwesenheit_id: str | None = None
    created_at: datetime | None = None


class Guttagekonto(BaseModel):
    user_id: str
    saldo_tage: float
    buchungen: list[GuttageBuchung] = Field(default_factory=list)


# --- Terminierte Akte-Änderungen (§3.1) -------------------------------------


class AkteAenderungCreate(BaseModel):
    gueltig_ab: date
    # Teilmenge der AkteUpdate-Felder; der Dienst prüft die Namen (422
    # `feld_unbekannt`) und die Werte, indem er sie durch AkteUpdate schickt.
    felder: dict[str, Any] = Field(min_length=1, max_length=MAX_AENDERUNG_FELDER)
    grund: str | None = Field(default=None, max_length=1000)


class AkteAenderung(BaseModel):
    id: str
    user_id: str
    gueltig_ab: date
    felder: dict[str, Any]
    grund: str | None = None
    angewendet_am: datetime | None = None
    erstellt_von_name: str | None = None
    created_at: datetime | None = None
