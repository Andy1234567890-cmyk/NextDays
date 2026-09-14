"""Schemas des Bereichs »datev« (EXTF-CSV-Export für den Steuerberater).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — wie in
`../mahnwesen/schemas.py`. Die Literale MÜSSEN mit den `check`-Klauseln in
0685/0686 deckungsgleich bleiben (Regel „DB-CHECK und Pydantic-Literal
deckungsgleich").

Kein Feld der Einstellungen hat einen Default (Wurzel 4): Beraternummer,
Mandant, Kontenrahmen, Konten und BU-Schlüssel entscheidet der Steuerberater.
`DatevSettingsUpdate` verlangt deshalb ALLE Pflichtfelder; die Antwort
`DatevSettingsResponse` trägt `configured` und `fehlende_felder`, damit die
Oberfläche zeigt, was noch fehlt, und der Export ohne sie mit 422 antwortet.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

# Deckungsgleich mit 0685 `check (kontenrahmen in (...))`.
Kontenrahmen = Literal["SKR03", "SKR04"]
# Deckungsgleich mit 0686 `check (export_type in (...))`.
ExportTyp = Literal["buchungsstapel", "stammdaten"]
# Deckungsgleich mit 0686 `check (status in (...))`.
ExportStatus = Literal["erstellt", "fehlgeschlagen"]
# Belegarten des Buchungsstapels — was in den Stapel kommt.
Belegart = Literal["ausgangsrechnungen", "gutschriften", "ausgaben", "zahlungen"]
BELEGARTEN: tuple[str, ...] = ("ausgangsrechnungen", "gutschriften", "ausgaben", "zahlungen")

# Harte Obergrenze für den Exportzeitraum (Wurzel 8): ein Wirtschaftsjahr.
MAX_ZEITRAUM_TAGE = 366
# Sachkonten sind 4-8 Stellen, nur Ziffern (0685-Check).
_KONTO_MUSTER = r"^[0-9]{4,8}$"
# BU-Schlüssel: leer (Automatikkonto) oder 1-4 Ziffern.
_BU_MUSTER = r"^[0-9]{0,4}$"


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


def _steuersatz_schluessel(wert: str) -> str:
    """Normalisiert einen Steuersatz-Schlüssel der BU-Map auf zwei Nachkommastellen
    (`"19"`, `"19.0"`, `"19,00"` → `"19.00"`), damit Map und Rechnungszeile
    dieselbe Schreibweise treffen."""
    text = str(wert).strip().replace(",", ".")
    try:
        zahl = float(text)
    except ValueError as exc:
        raise ValueError(f"Steuersatz '{wert}' ist keine Zahl.") from exc
    if zahl < 0 or zahl > 100:
        raise ValueError(f"Steuersatz '{wert}' liegt außerhalb von 0-100.")
    return f"{zahl:.2f}"


def _bu_map_pruefen(map_: dict[str, str]) -> dict[str, str]:
    raus: dict[str, str] = {}
    for satz, bu in map_.items():
        bu_text = str(bu or "").strip()
        if not (bu_text == "" or (bu_text.isdigit() and len(bu_text) <= 4)):
            raise ValueError(f"BU-Schlüssel '{bu}' ist ungültig (leer oder 1-4 Ziffern).")
        raus[_steuersatz_schluessel(satz)] = bu_text
    return raus


# --- Einstellungen -------------------------------------------------------------


class DatevSettingsUpdate(_Camel):
    """PUT /datev/settings: alle Pflichtfelder — es gibt keinen stillen
    Ersatzwert, mit dem eine halbe Einstellung einen gültigen Stapel ergäbe."""

    berater_nummer: int = Field(ge=1001, le=9999999)
    mandanten_nummer: int = Field(ge=1, le=99999)
    kontenrahmen: Kontenrahmen
    sachkontenlaenge: int = Field(ge=4, le=8)
    wirtschaftsjahr_beginn_monat: int = Field(ge=1, le=12)
    standard_erloeskonto: str = Field(pattern=_KONTO_MUSTER)
    standard_aufwandskonto: str = Field(pattern=_KONTO_MUSTER)
    standard_finanzkonto: str = Field(pattern=_KONTO_MUSTER)
    debitor_konto_start: int = Field(ge=1000, le=999999999)
    kreditor_konto_start: int = Field(ge=1000, le=999999999)
    bu_schluessel_erloes: dict[str, str] = Field(min_length=1, max_length=20)
    bu_schluessel_aufwand: dict[str, str] = Field(min_length=1, max_length=20)
    finanzkonten: dict[str, str] = Field(default_factory=dict, max_length=50)
    festschreibung: bool

    @field_validator("bu_schluessel_erloes", "bu_schluessel_aufwand")
    @classmethod
    def _bu(cls, wert: dict[str, str]) -> dict[str, str]:
        return _bu_map_pruefen(wert)

    @field_validator("finanzkonten")
    @classmethod
    def _finanzkonten(cls, wert: dict[str, str]) -> dict[str, str]:
        raus: dict[str, str] = {}
        for konto_id, sachkonto in wert.items():
            text = str(sachkonto or "").strip()
            if not (text.isdigit() and 4 <= len(text) <= 8):
                raise ValueError(f"Finanzkonto '{sachkonto}' ist kein Sachkonto (4-8 Ziffern).")
            raus[str(konto_id)] = text
        return raus


class DatevSettingsResponse(_Camel):
    """GET: fehlt die Zeile oder ein Feld, steht dort `null`; `configured`
    und `fehlende_felder` sagen der Oberfläche, was der Export noch braucht."""

    berater_nummer: int | None = None
    mandanten_nummer: int | None = None
    kontenrahmen: Kontenrahmen | None = None
    sachkontenlaenge: int | None = None
    wirtschaftsjahr_beginn_monat: int | None = None
    standard_erloeskonto: str | None = None
    standard_aufwandskonto: str | None = None
    standard_finanzkonto: str | None = None
    debitor_konto_start: int | None = None
    kreditor_konto_start: int | None = None
    bu_schluessel_erloes: dict[str, str] | None = None
    bu_schluessel_aufwand: dict[str, str] | None = None
    finanzkonten: dict[str, str] = Field(default_factory=dict)
    festschreibung: bool | None = None
    configured: bool
    fehlende_felder: list[str] = Field(default_factory=list)
    updated_at: datetime | None = None


# --- Export --------------------------------------------------------------------


class ExportAnfrage(_Camel):
    """POST /datev/export und /datev/export/vorschau.

    `export_type='buchungsstapel'` verlangt mindestens eine Belegart;
    `'stammdaten'` exportiert Debitoren/Kreditoren (Kunden/Lieferanten mit
    Kundennummer) — der Zeitraum grenzt dort die Anlage (`created_at`) NICHT
    ein, sondern wird nur protokolliert.
    """

    export_type: ExportTyp = "buchungsstapel"
    date_from: date
    date_to: date
    belegarten: list[Belegart] = Field(default_factory=list, max_length=4)

    @field_validator("belegarten")
    @classmethod
    def _eindeutig(cls, wert: list[str]) -> list[str]:
        return sorted(set(wert), key=BELEGARTEN.index)


class Vorschau(_Camel):
    """Anzahl je Belegart VOR dem Export — plus Hinweise, die der Export als
    422 werfen würde (fehlende Einstellungen, Kunden ohne Nummer …)."""

    export_type: ExportTyp
    date_from: date
    date_to: date
    anzahl_gesamt: int
    anzahl_je_belegart: dict[str, int]
    probleme: list[str] = Field(default_factory=list)
    warnungen: list[str] = Field(default_factory=list)


class ExportResponse(_Camel):
    id: str
    tenant_id: str
    export_type: ExportTyp
    date_from: date
    date_to: date
    belegarten: list[str]
    anzahl: int
    content_hash: str
    dateiname: str
    groesse: int
    status: ExportStatus
    kontenrahmen: Kontenrahmen
    warnungen: list[str] = Field(default_factory=list)
    # True, wenn dieser Aufruf einen BESTEHENDEN Lauf zurückgab (Idempotenz).
    wiederverwendet: bool = False
    created_by: str | None = None
    created_at: datetime
