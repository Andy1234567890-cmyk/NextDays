"""Schemas der KI-Werkzeuge im Dienstplan (0546, Vertrag §2.3).

Drei Werkzeuge, ehrlich getrennt: die Prognose RECHNET der Server (aus
`personal_produktivitaet`) und Gemini erklärt sie nur; die Autoplanung rechnet
ein Solver (OR-Tools) und Gemini erklärt die Varianten; der Assistent
formuliert eine Antwort aus den Plandaten.

Jede erzeugte Ausgabe trägt `content_origin='ki'` (EU AI Act Art. 50 Abs. 2) —
das ist unser eigenes Feld, nicht ein Wasserzeichen des Anbieters.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

Planungstyp = Literal[
    "performer",
    "alleskoenner",
    "superfaire",
    "zeitschwaermer",
    "talentscout",
    "faire",
    "philanthrop",
]
LaufStatus = Literal["laeuft", "fertig", "fehler", "uebernommen"]
PrognoseStatus = Literal["fertig", "fehler"]

# Wie viele Wochen Historie in den Prompt gehen (Plan-/Ist-Minuten je Tag).
HISTORIE_WOCHEN = 8
# Höchstlänge der Erklärung. Ein längerer Text wird im Panel nicht gelesen
# und kostet Tokens; der Deckel steht im Prompt UND wird nachher geschnitten.
MAX_ERKLAERUNG_ZEICHEN = 1_200
MAX_FRAGE_ZEICHEN = 500


class PrognoseEingabeTag(BaseModel):
    datum: date
    anreisen: int = 0
    abreisen: int = 0
    gaeste_im_haus: int = 0
    einheiten_belegt: int = 0
    einheiten_gesamt: int = 0
    feiertag: str | None = None
    umsatz_plan_minor: int | None = None


class PrognoseEingaben(BaseModel):
    tage: list[PrognoseEingabeTag] = Field(default_factory=list)
    historie_wochen: int = HISTORIE_WOCHEN


class PrognoseBereich(BaseModel):
    arbeitsbereich_id: str
    stunden: float
    anzahl: int
    basis: str
    basis_wert: float


class PrognoseAusgabeTag(BaseModel):
    datum: date
    bereiche: list[PrognoseBereich] = Field(default_factory=list)
    stundenlimit_minuten: int | None = None
    hinweise: list[str] = Field(default_factory=list)


class PrognoseAusgabe(BaseModel):
    tage: list[PrognoseAusgabeTag] = Field(default_factory=list)


class Prognose(BaseModel):
    id: str
    woche_start: date
    status: PrognoseStatus
    eingaben: PrognoseEingaben
    ausgabe: PrognoseAusgabe
    erklaerung: str | None = None
    content_origin: str = "ki"
    modell: str | None = None
    region: str | None = None
    dauer_ms: int | None = None
    fehler: str | None = None
    uebernommen_am: datetime | None = None
    created_at: datetime | None = None


class AutoplanRequest(BaseModel):
    planungstyp: Planungstyp
    varianten: int = Field(default=1, ge=1, le=3)
    zeitlimit_s: int = Field(default=10, ge=1, le=30)
    # Nur Hüllen planen, für die noch keine Schicht steht.
    nur_offene: bool = True


class VarianteSchicht(BaseModel):
    bedarf_id: str | None = None
    user_id: str
    start_at: datetime
    end_at: datetime
    pause_min: int = 0
    arbeitsbereich_id: str | None = None
    property_id: str | None = None


class VarianteKennzahlen(BaseModel):
    stunden: float
    kosten_minor: int | None = None
    currency: str | None = None
    fairness_pct: float
    wunsch_erfuellt_pct: float
    unbesetzt: int
    konflikte: int


class Variante(BaseModel):
    name: str
    schichten: list[VarianteSchicht] = Field(default_factory=list)
    kennzahlen: VarianteKennzahlen


class Planungslauf(BaseModel):
    id: str
    woche_start: date
    planungstyp: Planungstyp
    status: LaufStatus
    solver: str | None = None
    varianten: list[Variante] = Field(default_factory=list)
    gewaehlte_variante: int | None = None
    erklaerung: str | None = None
    content_origin: str = "ki"
    dauer_ms: int | None = None
    fehler: str | None = None
    uebernommen_am: datetime | None = None
    created_at: datetime | None = None


class UebernehmenRequest(BaseModel):
    variante: int = Field(ge=0, le=2)


class VerworfenResponse(BaseModel):
    geloescht: int


class AssistentRequest(BaseModel):
    frage: str = Field(min_length=3, max_length=MAX_FRAGE_ZEICHEN)
    woche: date


class AssistentAntwort(BaseModel):
    antwort: str
    content_origin: str = "ki"
    quellen: list[str] = Field(default_factory=list)


class KiStatus(BaseModel):
    konfiguriert: bool
    verbrauch_heute: int
    tageslimit: int
    solver: str = "ortools"
