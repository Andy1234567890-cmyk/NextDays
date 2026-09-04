"""Schemas des Terminal-Pakets (0544, Vertrag §3.1/§3.2).

Zwei Welten in einer Datei, weil sie dasselbe Gerät beschreiben:
  * Verwaltung (`Terminal*`) — Guard MANAGE_PERSONAL, Nutzer-JWT.
  * Gerät (`TerminalInfo`, `TerminalStatus*`, `TerminalStempeln`) — KEIN
    Nutzer-JWT, nur der Header `X-Terminal-Token`. Was hier herausgeht, sieht
    ein öffentlicher Bildschirm an der Rezeption: darum `anzeige_name`
    („Vorname N."), nie der vollständige Name, keine Mailadresse, kein Lohn.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from .schemas import Zeiterfassung

TerminalAktion = Literal["start", "pause", "pause_ende", "ende"]


class TerminalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    property_id: str | None = None


class TerminalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    aktiv: bool | None = None
    property_id: str | None = None


class Terminal(BaseModel):
    id: str
    name: str
    property_id: str | None = None
    property_title: str | None = None
    aktiv: bool
    letzter_kontakt_am: datetime | None = None
    created_at: datetime | None = None


class TerminalMitToken(Terminal):
    """Antwort von POST /terminals und POST /terminals/{id}/token.

    Das Token steht NUR hier — in der DB liegt sein SHA-256. Wer es verliert,
    rotiert es; ein zweites Anzeigen gibt es nicht.
    """

    token: str


class TerminalToken(BaseModel):
    token: str


class TerminalZugangSet(BaseModel):
    """Terminal-Zugang einer Person: vierstellige Stempel-ID + PIN."""

    stempel_id: str | None = Field(default=None, pattern=r"^[0-9]{4}$")
    pin: str = Field(pattern=r"^[0-9]{4,6}$")


class TerminalZugang(BaseModel):
    stempel_id: str


class TerminalWetter(BaseModel):
    datum: str
    temp_min: float | None = None
    temp_max: float | None = None
    code: int | None = None
    niederschlag_mm: float | None = None


class TerminalBetrieb(BaseModel):
    name: str
    zeitzone: str


class TerminalGeraet(BaseModel):
    name: str
    property_title: str | None = None


class TerminalInfo(BaseModel):
    terminal: TerminalGeraet
    betrieb: TerminalBetrieb
    wetter_heute: TerminalWetter | None = None


class TerminalStatusRequest(BaseModel):
    stempel_id: str = Field(pattern=r"^[0-9]{4}$")


class TerminalSchichtHeute(BaseModel):
    start_at: datetime
    end_at: datetime
    arbeitsbereich_kurz: str | None = None


class TerminalStatus(BaseModel):
    anzeige_name: str
    offen: Zeiterfassung | None = None
    schicht_heute: TerminalSchichtHeute | None = None


class TerminalStempeln(BaseModel):
    stempel_id: str = Field(pattern=r"^[0-9]{4}$")
    pin: str = Field(pattern=r"^[0-9]{4,6}$")
    aktion: TerminalAktion
