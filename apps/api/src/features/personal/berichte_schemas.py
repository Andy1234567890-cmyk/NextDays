"""Schemas der Berichte und des Lohnlaufs (0547, Vertrag §4).

Ein Bericht ist EINE Form für fünfzehn Inhalte: `spalten` beschreibt, was in
`zeilen` steht (Schlüssel, Typ, ob die Spalte summiert wird), `hinweise` sagt
LAUT, was fehlt — eine Person ohne Stundenlohn erscheint mit `None` in der
Geldspalte und im Hinweis, nie mit 0 (Wurzel 4).

Die Spaltenschlüssel (`key`) sind Teil des Vertrags: das Frontend beschriftet
sie über `personal.berichte.spalten.<key>`. Wer einen Schlüssel umbenennt,
nimmt der Oberfläche die Beschriftung — deshalb stehen sie in `berichte.py`
in EINER Registry und werden vom Test gegen den Vertrag verglichen.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

BerichtGruppe = Literal["zeit", "abwesenheit", "finanzen", "personal", "plan"]
BerichtFilter = Literal["zeitraum", "arbeitsbereich", "objekt", "person", "beschaeftigungsart"]
BerichtCapability = Literal["view_team_schedule", "export_lohn"]
SpaltenTyp = Literal["text", "zahl", "minuten", "geld", "prozent", "datum", "tage", "status"]
BerichtFormat = Literal["json", "csv"]

LohnlaufStatus = Literal["entwurf", "geprueft", "freigegeben", "exportiert"]
LohnlaufExportFormat = Literal["csv", "datev_lodas"]

# Ein Bericht über mehr als 400 Tage lädt alle Zeiten, Schichten und Anträge
# des Betriebs (Wurzel 8) — dieselbe Grenze wie die Auswertung.
MAX_BERICHT_TAGE = 400


class Spalte(BaseModel):
    """Eine Berichtsspalte. `summe=True` heißt: taucht in `summen` auf."""

    key: str
    typ: SpaltenTyp
    summe: bool = False


class BerichtKatalogItem(BaseModel):
    name: str
    gruppe: BerichtGruppe
    filter: list[BerichtFilter]
    capability: BerichtCapability
    formate: list[BerichtFormat] = Field(default_factory=lambda: ["json", "csv"])


class BerichtResponse(BaseModel):
    name: str
    von: date | None
    bis: date | None
    currency: str | None = None
    hinweise: list[str] = Field(default_factory=list)
    erzeugt_am: datetime
    spalten: list[Spalte]
    zeilen: list[dict[str, Any]]
    summen: dict[str, Any] | None = None
    anzahl: int


# --- Lohnlauf ---------------------------------------------------------------


class Pruefung(BaseModel):
    art: str
    user_id: str | None = None
    name: str | None = None
    werte: dict[str, Any] = Field(default_factory=dict)


class Pruefungen(BaseModel):
    geprueft_am: datetime | None = None
    personen: int = 0
    zeiten: int = 0
    fehler: list[Pruefung] = Field(default_factory=list)
    warnungen: list[Pruefung] = Field(default_factory=list)


class Lohnlauf(BaseModel):
    id: str
    jahr: int
    monat: int
    status: LohnlaufStatus
    pruefungen: Pruefungen
    geprueft_am: datetime | None = None
    freigegeben_am: datetime | None = None
    exportiert_am: datetime | None = None
    export_format: LohnlaufExportFormat | None = None
    export_name: str | None = None
    notiz: str | None = None
    created_at: datetime | None = None


class LohnlaufCreate(BaseModel):
    jahr: int = Field(ge=2000, le=2100)
    monat: int = Field(ge=1, le=12)


class LohnlaufExport(BaseModel):
    format: LohnlaufExportFormat = "csv"


class LohnlaufExportResponse(BaseModel):
    inhalt_base64: str
    mime: str
    name: str


class LohnlaufZuruecksetzen(BaseModel):
    grund: str = Field(min_length=3, max_length=500)
