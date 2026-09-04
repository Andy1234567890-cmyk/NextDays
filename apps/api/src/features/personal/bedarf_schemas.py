"""Schemas der Bedarfsplanung, Kennzahlen, Budget und Umsatzbuch (0545, Vertrag §2.1/§2.2).

Geld immer in Minor + `currency`. Fehlt die Währung oder mischen sich mehrere,
steht `None` und ein Hinweis in `hinweise` — nie ein Ersatzwert (Wurzel 4).

Finanzfelder (`*_minor`, `quote`, `produktivitaet`, `budget_*`) sind für
Aufrufer ohne `EXPORT_LOHN` `None`; die Hotel-Zeile (Anreisen, Abreisen, Gäste
im Haus, Belegung) sieht jede Schichtleitung — sie ist Planungsgrundlage, keine
Finanzauskunft (Wurzel 3, §4.3).
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

# Ein Kennzahlenfenster ist höchstens sechs Wochen — dieselbe Grenze wie der
# freie Dienstplan-Zeitraum (§1.3). Ohne Deckel würde ein Aufruf über zwei
# Jahre alle Reservierungen und Schichten des Betriebs laden (Wurzel 8).
MAX_KENNZAHLEN_TAGE = 42

ProduktivitaetBasis = Literal[
    "einheiten_belegt", "abreisen", "anreisen", "gaeste", "umsatz", "fest"
]
BedarfQuelle = Literal["manuell", "vorlage", "prognose"]
UmsatzQuelle = Literal["buchungen", "manuell", "prognose"]


class BedarfZeile(BaseModel):
    """Eine Schichthülle: Soll-Besetzung je Bereich, Zeitfenster und Wochentag ODER Datum."""

    id: str | None = None
    arbeitsbereich_id: str
    property_id: str | None = None
    wochentag: int | None = Field(default=None, ge=0, le=6)
    datum: date | None = None
    # 'HH:MM' — dieselbe Form wie die Verfügbarkeiten im Wochenplan.
    zeit_von: str
    zeit_bis: str
    anzahl: int = Field(ge=0, le=200)
    quelle: BedarfQuelle = "manuell"
    notiz: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _entweder_oder(self) -> BedarfZeile:
        if (self.wochentag is None) == (self.datum is None):
            msg = "Entweder wochentag ODER datum angeben."
            raise ValueError(msg)
        return self


class BedarfListe(BaseModel):
    vorlagen: list[BedarfZeile] = Field(default_factory=list)
    tage: list[BedarfZeile] = Field(default_factory=list)


class BudgetZeile(BaseModel):
    id: str | None = None
    wochentag: int | None = Field(default=None, ge=0, le=6)
    datum: date | None = None
    stunden: float | None = Field(default=None, ge=0)
    betrag_minor: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    notiz: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _form(self) -> BudgetZeile:
        if (self.wochentag is None) == (self.datum is None):
            msg = "Entweder wochentag ODER datum angeben."
            raise ValueError(msg)
        if self.stunden is None and self.betrag_minor is None:
            msg = "Stunden oder Betrag angeben."
            raise ValueError(msg)
        if self.betrag_minor is not None and not self.currency:
            # Wurzel 4: ein Betrag ohne Währung ist ein Datenfehler, kein EUR.
            msg = "Betrag ohne Währung."
            raise ValueError(msg)
        return self


class BudgetListe(BaseModel):
    vorlagen: list[BudgetZeile] = Field(default_factory=list)
    tage: list[BudgetZeile] = Field(default_factory=list)


class ProduktivitaetZeile(BaseModel):
    """Annahme je Bereich: wie viele Einheiten einer Basis eine Arbeitsstunde schafft."""

    arbeitsbereich_id: str
    basis: ProduktivitaetBasis
    wert: float = Field(gt=0)
    min_stunden_tag: float | None = Field(default=None, ge=0)
    max_stunden_tag: float | None = Field(default=None, ge=0)
    notiz: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _min_max(self) -> ProduktivitaetZeile:
        if (
            self.min_stunden_tag is not None
            and self.max_stunden_tag is not None
            and self.min_stunden_tag > self.max_stunden_tag
        ):
            msg = "min_stunden_tag über max_stunden_tag."
            raise ValueError(msg)
        return self


class UmsatzbuchZeile(BaseModel):
    """Plan-/Ist-Umsatz eines Tages; `arbeitsbereich_id=None` = Betrieb gesamt."""

    datum: date
    arbeitsbereich_id: str | None = None
    plan_minor: int | None = Field(default=None, ge=0)
    ist_minor: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    quelle: UmsatzQuelle | None = None
    # Was die Buchungen für diesen Tag hergeben (gerechnet, nicht gespeichert).
    buchungen_ist_minor: int | None = None
    notiz: str | None = Field(default=None, max_length=2000)


class UmsatzbuchSchreiben(BaseModel):
    datum: date
    arbeitsbereich_id: str | None = None
    plan_minor: int | None = Field(default=None, ge=0)
    ist_minor: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    notiz: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _waehrung_bei_betrag(self) -> UmsatzbuchSchreiben:
        if (self.plan_minor is not None or self.ist_minor is not None) and not self.currency:
            msg = "Betrag ohne Währung."
            raise ValueError(msg)
        return self


# --- Kennzahlen -------------------------------------------------------------


class KennzahlTag(BaseModel):
    datum: date
    feiertag: str | None = None
    # Hotel-Zeile: die Buchungslage. Sichtbar für jede Schichtleitung.
    anreisen: int = 0
    abreisen: int = 0
    gaeste_im_haus: int = 0
    einheiten_belegt: int = 0
    einheiten_gesamt: int = 0
    belegung_pct: float | None = None
    # Umsatz und Kosten: nur mit EXPORT_LOHN.
    umsatz_ist_minor: int | None = None
    umsatz_plan_minor: int | None = None
    umsatz_quelle: UmsatzQuelle | None = None
    plan_minuten: int = 0
    ist_minuten: int = 0
    einsaetze: int = 0
    personen: int = 0
    personalkosten_plan_minor: int | None = None
    personalkosten_ist_minor: int | None = None
    personalkostenquote_pct: float | None = None
    produktivitaet_minor_je_stunde: int | None = None
    ziel_produktivitaet_minor: int | None = None
    stundenlimit_minuten: int | None = None
    budget_stunden: float | None = None
    budget_minor: int | None = None
    abweichung_budget_pct: float | None = None


class BereichTag(BaseModel):
    datum: date
    soll_anzahl: int = 0
    ist_anzahl: int = 0
    soll_minuten: int = 0
    ist_minuten: int = 0
    einsaetze: int = 0
    stundenlimit_minuten: int | None = None


class BereichZeile(BaseModel):
    arbeitsbereich_id: str
    tage: list[BereichTag] = Field(default_factory=list)


class KennzahlSumme(BaseModel):
    anreisen: int = 0
    abreisen: int = 0
    gaeste_im_haus: int = 0
    plan_minuten: int = 0
    ist_minuten: int = 0
    einsaetze: int = 0
    umsatz_ist_minor: int | None = None
    umsatz_plan_minor: int | None = None
    personalkosten_plan_minor: int | None = None
    personalkosten_ist_minor: int | None = None
    personalkostenquote_pct: float | None = None
    produktivitaet_minor_je_stunde: int | None = None
    stundenlimit_minuten: int | None = None
    budget_stunden: float | None = None
    budget_minor: int | None = None


class KennzahlenResponse(BaseModel):
    von: date
    bis: date
    currency: str | None = None
    hinweise: list[str] = Field(default_factory=list)
    tage: list[KennzahlTag] = Field(default_factory=list)
    bereiche: list[BereichZeile] = Field(default_factory=list)
    summe: KennzahlSumme = Field(default_factory=KennzahlSumme)
