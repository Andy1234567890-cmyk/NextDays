"""Schemas des Pakets Planung (0544): Mehrfachaktion, Wochenvorlagen, Tausch,
Abwesenheits-Vorschau.

Die Formen aus `schemas.py`, die mehrere Pakete teilen (`Tausch`, `PlanPerson`,
`WochenplanResponse`), stehen dort; hier stehen nur die Formen, die
ausschließlich die Planungs-Routen brauchen (Vertrag §0).
"""

from __future__ import annotations

from datetime import date, time
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from .schemas import AbwesenheitArt

# Obergrenzen (Wurzel 8): eine Mehrfachauswahl im Plan umfasst realistisch
# einige Dutzend Schichten; 200 ist reichlich und trotzdem eine Grenze.
MAX_MEHRFACH = 200
# Ein Wochengerüst hat 7 Tage × Bereiche × Personen — 500 Zeilen sind das
# Vielfache eines echten Hotelplans.
MAX_VORLAGE_SCHICHTEN = 500
# Freies Zeitfenster des Dienstplans: sechs Wochen (Monatsansicht mit Rändern).
MAX_ZEITRAUM_PLAN_TAGE = 42

MehrfachAktion = Literal["verschieben", "loeschen", "zuweisen", "freigeben"]


class LeerenResponse(BaseModel):
    """Woche leeren: Entwürfe verschwinden, Veröffentlichtes wird abgesagt."""

    geloescht: int
    abgesagt: int


class MehrfachRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=MAX_MEHRFACH)
    aktion: MehrfachAktion
    # Nur bei `verschieben`: Versatz in Tagen (negativ = nach vorn).
    tage: int | None = Field(default=None, ge=-365, le=365)
    # Nur bei `zuweisen`: die neue Person.
    user_id: str | None = None
    warnungen_akzeptieren: bool = False

    @model_validator(mode="after")
    def _aktion_braucht_ihr_feld(self) -> MehrfachRequest:
        if self.aktion == "verschieben" and not self.tage:
            msg = "Verschieben braucht einen Versatz in Tagen (≠ 0)."
            raise ValueError(msg)
        if self.aktion == "zuweisen" and not self.user_id:
            msg = "Zuweisen braucht eine Person."
            raise ValueError(msg)
        if len(set(self.ids)) != len(self.ids):
            msg = "Eine Schicht steht doppelt in der Auswahl."
            raise ValueError(msg)
        return self


class MehrfachKonflikt(BaseModel):
    schicht_id: str
    konflikte: list[dict[str, object]] = Field(default_factory=list)


class MehrfachResponse(BaseModel):
    geaendert: int
    konflikte: list[MehrfachKonflikt] = Field(default_factory=list)


# --- Wochenvorlagen ---------------------------------------------------------


class WochenvorlageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    notiz: str | None = Field(default=None, max_length=2000)
    # Aus welcher Woche wird das Gerüst gezogen (Montag wird selbst gerechnet)?
    aus_woche: date
    mit_personen: bool = True


class WochenvorlageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    notiz: str | None = Field(default=None, max_length=2000)


class WochenvorlageSchicht(BaseModel):
    id: str
    wochentag: int = Field(ge=0, le=6)
    start_zeit: time
    end_zeit: time
    pause_min: int
    arbeitsbereich_id: str | None = None
    property_id: str | None = None
    # None = offene Schicht im Gerüst (Bedarf ohne Person).
    user_id: str | None = None
    schichtvorlage_id: str | None = None
    notiz: str | None = None


class Wochenvorlage(BaseModel):
    id: str
    name: str
    notiz: str | None = None
    anzahl_schichten: int
    created_at: str | None = None


class WochenvorlageDetail(Wochenvorlage):
    schichten: list[WochenvorlageSchicht] = Field(default_factory=list)


class WochenvorlageAnwenden(BaseModel):
    mit_personen: bool = True
    warnungen_akzeptieren: bool = False


# --- Tausch -----------------------------------------------------------------


class TauschCreate(BaseModel):
    an_user_id: str
    # Direkter Tausch: die Gegen-Schicht der annehmenden Person. None = Abgabe.
    gegen_schicht_id: str | None = None
    grund: str | None = Field(default=None, max_length=2000)


class TauschEntscheiden(BaseModel):
    freigeben: bool
    kommentar: str | None = Field(default=None, max_length=2000)
    warnungen_akzeptieren: bool = False


# --- Abwesenheits-Vorschau --------------------------------------------------


class AbwesenheitVorschauRequest(BaseModel):
    user_id: str | None = None
    art: AbwesenheitArt
    von: date
    bis: date
    halbtag_start: bool = False
    halbtag_ende: bool = False

    @model_validator(mode="after")
    def _bis_nach_von(self) -> AbwesenheitVorschauRequest:
        if self.bis < self.von:
            msg = "Ende liegt vor dem Beginn."
            raise ValueError(msg)
        if (self.bis - self.von).days > 365:
            msg = "Zeitraum zu lang."
            raise ValueError(msg)
        return self


class SperreHinweis(BaseModel):
    grund: str
    von: date
    bis: date


class KollegeAbwesend(BaseModel):
    user_id: str
    full_name: str | None = None
    art: AbwesenheitArt


class AbwesenheitVorschau(BaseModel):
    """Der Live-Zähler des Antrags — was der Antrag KOSTET, bevor er gestellt wird.

    `rest_vorher`/`rest_nachher` sind `None`, wenn die Art kein Urlaubskonto
    berührt oder kein Anspruch erfasst ist (kein 0-Ersatz, Wurzel 4).
    `fehler` trägt genau die Codes, die `beantragen` werfen würde.
    """

    tage: float
    rest_vorher: float | None = None
    rest_nachher: float | None = None
    sperre: SperreHinweis | None = None
    schichten_betroffen: int = 0
    kollegen_abwesend: list[KollegeAbwesend] = Field(default_factory=list)
    fehler: list[str] = Field(default_factory=list)
