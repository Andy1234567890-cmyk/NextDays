"""Pydantic-Schemas des Slice `personal` (0541)."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Beschaeftigungsart = Literal["vollzeit", "teilzeit", "aushilfe", "extern"]
Abrechnung = Literal["je_einsatz", "je_stunde"]
Qualifikationsstufe = Literal["lernend", "selbststaendig", "anleitend"]
DokumentArt = Literal[
    "vertrag",
    "ausweis",
    "arbeitserlaubnis",
    "fuehrungszeugnis",
    "gesundheitszeugnis",
    "belehrung",
    "zertifikat",
    "attest",
    "datenschutz",
    "betriebsvereinbarung",
    "sonstiges",
]
SchichtStatus = Literal["entwurf", "veroeffentlicht", "bestaetigt", "abgesagt"]
SchichtQuelle = Literal[
    "manuell",
    "vorlage",
    "bedarf_aufgabe",
    "abwesenheit",
    "kopie",
    # 0544/0545/0546: Wochenvorlage, Tausch, Autoplan, Bedarfshülle.
    "wochenvorlage",
    "tausch",
    "autoplan",
    "bedarf",
]
# Kennzahl-Zeilen, die der Plan je Arbeitsbereich zeigen kann (0545). Die Liste
# ist der Vertrag mit dem Frontend; ein unbekannter Wert ist 422, kein Default.
KENNZAHLEN_ZEILEN: tuple[str, ...] = (
    "besetzung",
    "stundenlimit",
    "einsaetze",
    "kosten",
    "umsatz",
    "produktivitaet",
    "quote",
    "budget",
)
AbwesenheitArt = Literal[
    "urlaub",
    "krank",
    "kind_krank",
    "unbezahlt",
    "sonderurlaub",
    "schulung",
    "frei",
]
# `vorgenehmigt` (0544): die Schichtleitung hat zugestimmt, die Leitung
# entscheidet noch. Nur bei `zweistufige_genehmigung`.
AbwesenheitStatus = Literal[
    "beantragt", "vorgenehmigt", "genehmigt", "abgelehnt", "storniert"
]
VerfuegbarkeitArt = Literal["wunsch", "gesperrt"]
TauschStatus = Literal["angefragt", "angenommen", "abgelehnt", "freigegeben", "verworfen"]
ZeitQuelle = Literal["web", "app", "korrektur", "import", "terminal"]
VerdienstgrenzeZeitraum = Literal["monat", "jahr"]
ZeitStatus = Literal["offen", "abgeschlossen", "bestaetigt"]
AzkGrund = Literal["monatsabschluss", "abbau", "auszahlung", "korrektur", "uebertrag"]
BewerbungStatus = Literal["offen", "angenommen", "abgelehnt"]
Familienstand = Literal["ledig", "verheiratet", "partnerschaft", "geschieden", "verwitwet"]

# Harte Obergrenzen für Zeitraum-Abfragen (Wurzel 8): eine Wochenansicht braucht
# 7 Tage, eine Monatsauswertung 31, eine Jahresübersicht 366.
MAX_ZEITRAUM_TAGE = 400
MAX_LISTE = 500


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


class Paar(BaseModel):
    """Schlüssel/Wert — Lohnmerkmale, Vertragsbedingungen."""

    schluessel: str = Field(min_length=1, max_length=120)
    wert: str = Field(max_length=500)


class KostenSumme(BaseModel):
    currency: str
    minor: int
    personen: int


# --- Stammdaten -------------------------------------------------------------


class FremdfirmaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    kontakt_name: str | None = Field(default=None, max_length=200)
    kontakt_email: str | None = Field(default=None, max_length=200)
    kontakt_telefon: str | None = Field(default=None, max_length=60)
    abrechnung: Abrechnung
    satz_minor: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    notiz: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _satz_mit_waehrung(self) -> FremdfirmaCreate:
        if (self.satz_minor is None) != (self.currency is None):
            msg = "Satz und Währung gehören zusammen (Wurzel 4)."
            raise ValueError(msg)
        return self


class FremdfirmaUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    kontakt_name: str | None = Field(default=None, max_length=200)
    kontakt_email: str | None = Field(default=None, max_length=200)
    kontakt_telefon: str | None = Field(default=None, max_length=60)
    abrechnung: Abrechnung | None = None
    satz_minor: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    notiz: str | None = Field(default=None, max_length=2000)
    archiviert: bool | None = None


class Fremdfirma(BaseModel):
    id: str
    name: str
    kontakt_name: str | None = None
    kontakt_email: str | None = None
    kontakt_telefon: str | None = None
    abrechnung: Abrechnung
    satz_minor: int | None = None
    currency: str | None = None
    notiz: str | None = None
    archived_at: datetime | None = None
    anzahl_personen: int = 0


class ArbeitsbereichCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kurz: str = Field(min_length=1, max_length=4)
    farbe: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    sort: int = 0


class ArbeitsbereichUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    kurz: str | None = Field(default=None, min_length=1, max_length=4)
    farbe: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    sort: int | None = None
    archiviert: bool | None = None


class Arbeitsbereich(BaseModel):
    id: str
    name: str
    kurz: str
    farbe: str
    sort: int
    archived_at: datetime | None = None


class Qualifikation(BaseModel):
    id: str
    user_id: str
    arbeitsbereich_id: str
    property_id: str | None = None
    stufe: Qualifikationsstufe


class QualifikationSet(BaseModel):
    arbeitsbereich_id: str
    property_id: str | None = None
    stufe: Qualifikationsstufe = "selbststaendig"


class AkteUpdate(BaseModel):
    """Alle Felder optional; `None` im JSON löscht ein Feld nur, wenn es in
    `geleert` genannt ist — sonst heißt Weglassen „nicht anfassen"."""

    employee_number: str | None = Field(default=None, max_length=40)
    beschaeftigungsart: Beschaeftigungsart | None = None
    firma_id: str | None = None
    position: str | None = Field(default=None, max_length=120)
    eintritt: date | None = None
    austritt: date | None = None
    probezeit_bis: date | None = None
    wochenstunden: float | None = Field(default=None, ge=0, le=168)
    tagesstunden: float | None = Field(default=None, ge=0, le=24)
    arbeitstage_je_woche: int | None = Field(default=None, ge=1, le=7)
    stundenlohn_minor: int | None = Field(default=None, ge=0)
    gehalt_minor: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    urlaubsanspruch_tage: float | None = Field(default=None, ge=0, le=365)
    geburtsdatum: date | None = None
    geburtsort: str | None = Field(default=None, max_length=120)
    staatsangehoerigkeit: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    strasse: str | None = Field(default=None, max_length=200)
    hausnummer: str | None = Field(default=None, max_length=20)
    plz: str | None = Field(default=None, max_length=20)
    ort: str | None = Field(default=None, max_length=120)
    land: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    notfall_name: str | None = Field(default=None, max_length=200)
    notfall_beziehung: str | None = Field(default=None, max_length=80)
    notfall_telefon: str | None = Field(default=None, max_length=60)
    steuer_id: str | None = Field(default=None, max_length=40)
    sv_nummer: str | None = Field(default=None, max_length=40)
    krankenkasse: str | None = Field(default=None, max_length=120)
    iban: str | None = Field(default=None, max_length=40)
    bic: str | None = Field(default=None, max_length=20)
    bank_name: str | None = Field(default=None, max_length=120)
    kontoinhaber: str | None = Field(default=None, max_length=200)
    notiz: str | None = Field(default=None, max_length=4000)
    # Kartei (0543)
    familienstand: Familienstand | None = None
    kinder_anzahl: int | None = Field(default=None, ge=0, le=30)
    lohnmerkmale: list[Paar] | None = Field(default=None, max_length=30)
    arbeitgeber_aufschlag_pct: float | None = Field(default=None, ge=0, le=200)
    # Verdienstgrenze (0544, Gastromatic „Max. Verdienst" für Aushilfen): Paar aus
    # Betrag und Zeitraum, die Währung kommt aus `currency` — fehlt sie, ist das
    # ein Datenfehler (422 `waehrung_fehlt`), kein Ersatzwert (Wurzel 4).
    verdienstgrenze_minor: int | None = Field(default=None, ge=0)
    verdienstgrenze_zeitraum: VerdienstgrenzeZeitraum | None = None
    # Felder, die auf NULL gesetzt werden sollen (Weglassen ≠ Löschen).
    geleert: list[str] = Field(default_factory=list, max_length=60)


class Akte(BaseModel):
    user_id: str
    employee_number: str | None = None
    beschaeftigungsart: Beschaeftigungsart
    firma_id: str | None = None
    firma_name: str | None = None
    position: str | None = None
    eintritt: date | None = None
    austritt: date | None = None
    probezeit_bis: date | None = None
    wochenstunden: float | None = None
    tagesstunden: float | None = None
    arbeitstage_je_woche: int | None = None
    stundenlohn_minor: int | None = None
    gehalt_minor: int | None = None
    currency: str | None = None
    urlaubsanspruch_tage: float | None = None
    geburtsdatum: date | None = None
    geburtsort: str | None = None
    staatsangehoerigkeit: str | None = None
    strasse: str | None = None
    hausnummer: str | None = None
    plz: str | None = None
    ort: str | None = None
    land: str | None = None
    notfall_name: str | None = None
    notfall_beziehung: str | None = None
    notfall_telefon: str | None = None
    # Entschlüsselt, aber MASKIERT (letzte 4 Zeichen). Der volle Wert verlässt
    # den Server nur für den Lohnexport, nie für die Anzeige.
    steuer_id_maskiert: str | None = None
    sv_nummer_maskiert: str | None = None
    iban_maskiert: str | None = None
    krankenkasse: str | None = None
    bic: str | None = None
    bank_name: str | None = None
    kontoinhaber: str | None = None
    notiz: str | None = None
    familienstand: Familienstand | None = None
    kinder_anzahl: int | None = None
    lohnmerkmale: list[Paar] = Field(default_factory=list)
    arbeitgeber_aufschlag_pct: float | None = None
    verdienstgrenze_minor: int | None = None
    verdienstgrenze_zeitraum: VerdienstgrenzeZeitraum | None = None
    # Terminal-Zugang (0544): die Stempel-ID darf die Leitung sehen, die PIN
    # niemals — nur, DASS eine gesetzt ist.
    stempel_id: str | None = None
    hat_terminal_pin: bool = False
    updated_at: datetime | None = None


class MitarbeiterListItem(BaseModel):
    user_id: str
    full_name: str | None
    email: str | None
    role: str
    is_active: bool
    avatar_url: str | None = None
    beschaeftigungsart: Beschaeftigungsart | None = None
    firma_name: str | None = None
    position: str | None = None
    employee_number: str | None = None
    eintritt: date | None = None
    austritt: date | None = None
    wochenstunden: float | None = None
    arbeitsbereiche: list[str] = Field(default_factory=list)
    # Anzahl Dokumente, die abgelaufen sind oder in 30 Tagen ablaufen.
    dokumente_faellig: int = 0
    akte_vorhanden: bool = False
    phone: str | None = None
    kosten_monat_minor: int | None = None
    kosten_currency: str | None = None


class MitarbeiterListResponse(BaseModel):
    items: list[MitarbeiterListItem]
    # Kachel „Kosten/Monat" je Währung (nie gemischt, Wurzel 4); leer für
    # die Schichtleitung.
    kosten_monat: list[KostenSumme] = Field(default_factory=list)
    # Personen ohne Lohn/Aufschlag → laut benannt statt still 0.
    kosten_hinweise: list[str] = Field(default_factory=list)


class DokumentAnfrage(BaseModel):
    art: DokumentArt
    titel: str = Field(min_length=1, max_length=200)
    ablauf_am: date | None = None
    notiz: str | None = Field(default=None, max_length=2000)
    dokument_nummer: str | None = Field(default=None, max_length=120)
    ausgestellt_am: date | None = None
    behoerde: str | None = Field(default=None, max_length=200)


class DokumentUpdate(BaseModel):
    titel: str | None = Field(default=None, min_length=1, max_length=200)
    ablauf_am: date | None = None
    notiz: str | None = Field(default=None, max_length=2000)
    geprueft: bool | None = None
    dokument_nummer: str | None = Field(default=None, max_length=120)
    ausgestellt_am: date | None = None
    behoerde: str | None = Field(default=None, max_length=200)


class Dokument(BaseModel):
    id: str
    user_id: str
    art: DokumentArt
    titel: str
    eingereicht: bool
    content_type: str | None = None
    groesse_bytes: int | None = None
    ablauf_am: date | None = None
    angefragt_am: datetime | None = None
    eingereicht_am: datetime | None = None
    geprueft_am: datetime | None = None
    notiz: str | None = None
    dokument_nummer: str | None = None
    ausgestellt_am: date | None = None
    behoerde: str | None = None
    # abgelaufen | laeuft_ab | gueltig | offen
    zustand: str
    download_url: str | None = None


class RegelnSet(BaseModel):
    zeitzone: str = Field(min_length=3, max_length=64)
    feiertage_region: str | None = Field(default=None, max_length=10)
    ruhezeit_stunden: float = Field(ge=0, le=24)
    max_tagesstunden: float = Field(ge=1, le=24)
    max_wochenstunden: float = Field(ge=1, le=168)
    nacht_von: time
    nacht_bis: time
    zuschlag_nacht_pct: float = Field(ge=0, le=300)
    zuschlag_sonntag_pct: float = Field(ge=0, le=300)
    zuschlag_feiertag_pct: float = Field(ge=0, le=300)
    zuschlag_ueberstunden_pct: float = Field(ge=0, le=300)
    urlaubsjahr_start_monat: int = Field(ge=1, le=12)
    uebertrag_verfall_monat: int | None = Field(default=None, ge=1, le=12)
    uebertrag_max_tage: float | None = Field(default=None, ge=0)
    mindest_vorlauf_urlaub_tage: int = Field(default=0, ge=0, le=365)
    datev_berater_nr: str | None = Field(default=None, max_length=10)
    datev_mandanten_nr: str | None = Field(default=None, max_length=10)
    # Lohnart je Schlüssel (grundlohn, nacht, sonntag, feiertag, ueberstunden,
    # urlaub, krank, unbezahlt) — Werte des Lohnprogramms, keine Erfindung.
    lohnarten: dict[str, str] = Field(default_factory=dict)

    # --- Jugendschutz (0544) ------------------------------------------------
    # NULL = keine Prüfung. Die Werte kommen aus dem Ländervorschlag
    # (laender.jugendschutz_fuer) und werden vom Betrieb bestätigt.
    jugendschutz_bis_alter: int | None = Field(default=None, ge=14, le=21)
    jugendschutz_max_tagesstunden: float | None = Field(default=None, ge=1, le=12)
    jugendschutz_nacht_von: time | None = None
    jugendschutz_nacht_bis: time | None = None

    # --- Abwesenheit (0544) -------------------------------------------------
    zweistufige_genehmigung: bool = False
    max_urlaub_zusammenhaengend_tage: int | None = Field(default=None, ge=1, le=365)

    # --- Zeiterfassung (0544) -----------------------------------------------
    gps_pflicht: bool = False
    gps_radius_m: int = Field(default=250, ge=25, le=5000)
    stempel_ab_schichtbeginn: bool = False
    verspaetung_melden_min: int | None = Field(default=None, ge=1, le=240)
    terminal_aktiv: bool = False
    wetter_anzeigen: bool = True

    # --- Kennzahlen-Ziele (0545) --------------------------------------------
    ziel_umsatzproduktivitaet_minor: int | None = Field(default=None, gt=0)
    ziel_personalkostenquote_pct: float | None = Field(default=None, ge=0, le=100)
    # Währung ist Pflicht, sobald ein Geldziel steht (Wurzel 4).
    kennzahlen_currency: str | None = Field(default=None, min_length=3, max_length=3)
    kennzahlen_zeilen: list[str] = Field(
        default_factory=lambda: ["besetzung", "stundenlimit"], max_length=len(KENNZAHLEN_ZEILEN)
    )

    @model_validator(mode="after")
    def _regeln_paare(self) -> RegelnSet:
        if (self.jugendschutz_bis_alter is None) != (
            self.jugendschutz_max_tagesstunden is None
        ):
            msg = "Jugendschutz braucht Altersgrenze UND Höchststunden."
            raise ValueError(msg)
        unbekannt = [z for z in self.kennzahlen_zeilen if z not in KENNZAHLEN_ZEILEN]
        if unbekannt:
            msg = f"Unbekannte Kennzahl-Zeile: {', '.join(sorted(unbekannt))}"
            raise ValueError(msg)
        if self.ziel_umsatzproduktivitaet_minor is not None and not self.kennzahlen_currency:
            msg = "Ein Umsatzziel ohne Währung ist kein Betrag."
            raise ValueError(msg)
        return self


class Regeln(RegelnSet):
    land: str
    bestaetigt_am: datetime | None = None
    bestaetigt_von: str | None = None


class JugendschutzVorschlag(BaseModel):
    """Jugendschutz-Werte eines Landes MIT Quelle (0544).

    Ohne belegte Quelle gibt es keinen Vorschlag — dann ist das ganze Objekt
    `None` und der Betrieb trägt seine Werte selbst ein (Wurzel 4).
    """

    bis_alter: int
    max_tagesstunden: float
    nacht_von: time
    nacht_bis: time
    quelle: str


class RegelVorschlag(BaseModel):
    """Vorschlag aus `laender.py` — noch nicht gespeichert."""

    land: str
    vorhanden: bool
    werte: RegelnSet | None = None
    quelle: str | None = None
    hinweise: list[str] = Field(default_factory=list)
    # Eigenes Feld mit eigener Quelle: Jugendschutz steht in einem anderen
    # Gesetz als die Arbeitszeit (DE: JArbSchG vs. ArbZG).
    jugendschutz: JugendschutzVorschlag | None = None


class PausenmodellSet(BaseModel):
    arbeitsbereich_id: str | None = None
    ab_minuten: int = Field(gt=0, le=24 * 60)
    pause_minuten: int = Field(gt=0, le=8 * 60)


class Pausenmodell(PausenmodellSet):
    id: str


class SchichtvorlageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kurz: str = Field(min_length=1, max_length=4)
    start_zeit: time
    end_zeit: time
    pause_min: int = Field(default=0, ge=0, le=8 * 60)
    farbe: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    arbeitsbereich_id: str | None = None
    sort: int = 0


class SchichtvorlageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    kurz: str | None = Field(default=None, min_length=1, max_length=4)
    start_zeit: time | None = None
    end_zeit: time | None = None
    pause_min: int | None = Field(default=None, ge=0, le=8 * 60)
    farbe: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    arbeitsbereich_id: str | None = None
    sort: int | None = None
    archiviert: bool | None = None


class Schichtvorlage(BaseModel):
    id: str
    name: str
    kurz: str
    start_zeit: time
    end_zeit: time
    pause_min: int
    farbe: str
    arbeitsbereich_id: str | None = None
    sort: int
    archived_at: datetime | None = None


# --- Dienstplan -------------------------------------------------------------


class Konflikt(BaseModel):
    # ruhezeit | max_tagesstunden | max_wochenstunden | doppelbelegung |
    # abwesenheit | gesperrt | qualifikation | urlaubssperre | ohne_regeln
    art: str
    schwere: Literal["warnung", "fehler"]
    # Zahlenwerte für die Anzeige (z. B. {"ist": 9.5, "max": 8})
    werte: dict[str, float | str] = Field(default_factory=dict)


class SchichtCreate(BaseModel):
    user_id: str | None = None
    start_at: datetime
    end_at: datetime
    pause_min: int = Field(default=0, ge=0, le=8 * 60)
    arbeitsbereich_id: str | None = None
    property_id: str | None = None
    vorlage_id: str | None = None
    notiz: str | None = Field(default=None, max_length=2000)
    # Konflikte der Schwere „warnung" trotzdem speichern.
    warnungen_akzeptieren: bool = False

    @model_validator(mode="after")
    def _ende_nach_start(self) -> SchichtCreate:
        if self.end_at <= self.start_at:
            msg = "Ende muss nach dem Start liegen."
            raise ValueError(msg)
        if (self.end_at - self.start_at).total_seconds() > 24 * 3600:
            msg = "Eine Schicht ist höchstens 24 Stunden lang."
            raise ValueError(msg)
        return self


class SchichtUpdate(BaseModel):
    user_id: str | None = None
    user_id_leeren: bool = False
    start_at: datetime | None = None
    end_at: datetime | None = None
    pause_min: int | None = Field(default=None, ge=0, le=8 * 60)
    arbeitsbereich_id: str | None = None
    property_id: str | None = None
    notiz: str | None = Field(default=None, max_length=2000)
    warnungen_akzeptieren: bool = False


class Schicht(BaseModel):
    id: str
    user_id: str | None
    datum: date
    start_at: datetime
    end_at: datetime
    pause_min: int
    arbeitsbereich_id: str | None = None
    property_id: str | None = None
    property_title: str | None = None
    vorlage_id: str | None = None
    status: SchichtStatus
    quelle: SchichtQuelle
    task_id: str | None = None
    abwesenheit_id: str | None = None
    bestaetigt_am: datetime | None = None
    notiz: str | None = None
    netto_minuten: int
    konflikte: list[Konflikt] = Field(default_factory=list)
    bewerbungen: int = 0
    # Nur für den eigenen Plan: hat DIESE Person sich beworben?
    eigene_bewerbung: BewerbungStatus | None = None
    # Offene Tauschanfrage auf DIESER Schicht (0544), sonst None.
    tausch_status: Literal["angefragt", "angenommen"] | None = None


class Verdienstgrenze(BaseModel):
    """Verdienstgrenze der Person mit Verbrauch — NUR für die Leitung (§4.3)."""

    minor: int
    zeitraum: Literal["monat", "jahr"]
    currency: str
    verbraucht_minor: int
    geplant_minor: int


class PlanPerson(BaseModel):
    user_id: str
    full_name: str | None
    role: str
    avatar_url: str | None = None
    beschaeftigungsart: Beschaeftigungsart | None = None
    wochenstunden_soll: float | None = None
    arbeitsbereiche: list[str] = Field(default_factory=list)
    # --- 0544: Kopf- und Summenspalte des Plans ----------------------------
    # Geburtstag IM Fenster (Tag/Monat auf das Jahr des Fensters gelegt).
    geburtstag_am: date | None = None
    ist_schichtleitung: bool = False
    azk_minuten: int | None = None
    guttage: float | None = None
    # Nur Leitung (admin/co_admin): Geld je Person ist kein Teamblick (§4.3).
    verdienstgrenze: Verdienstgrenze | None = None
    zuschlaege_minor: int | None = None


class Abwesenheit(BaseModel):
    id: str
    user_id: str
    art: AbwesenheitArt
    von: date
    bis: date
    halbtag_start: bool
    halbtag_ende: bool
    tage_berechnet: float
    status: AbwesenheitStatus
    grund: str | None = None
    kommentar_entscheidung: str | None = None
    entschieden_von: str | None = None
    entschieden_am: datetime | None = None
    attest_dokument_id: str | None = None
    created_at: datetime | None = None
    # Konflikte für die Entscheidung: geplante Schichten im Zeitraum, Sperre.
    schichten_im_zeitraum: int = 0
    urlaubssperre: bool = False
    # Erste Stufe der zweistufigen Genehmigung (0544).
    vorentschieden_von: str | None = None
    vorentschieden_am: datetime | None = None


class WetterTag(BaseModel):
    temp_min: float | None = None
    temp_max: float | None = None
    # WMO-Wettercode (Open-Meteo `weathercode`).
    code: int | None = None
    niederschlag_mm: float | None = None


class VerfuegbarkeitTag(BaseModel):
    """Eine Verfügbarkeitsregel, auf EINEN Tag des Fensters aufgelöst."""

    user_id: str
    art: VerfuegbarkeitArt
    datum: date
    # 'HH:MM' in der Betriebszone; None bei ganztags.
    zeit_von: str | None = None
    zeit_bis: str | None = None
    ganztags: bool


class TauschSchicht(BaseModel):
    datum: date
    start_at: datetime
    end_at: datetime
    arbeitsbereich_id: str | None = None
    property_title: str | None = None


class Tausch(BaseModel):
    id: str
    schicht_id: str
    von_user_id: str
    von_name: str | None = None
    an_user_id: str
    an_name: str | None = None
    gegen_schicht_id: str | None = None
    status: TauschStatus
    grund: str | None = None
    kommentar: str | None = None
    angenommen_am: datetime | None = None
    entschieden_von: str | None = None
    entschieden_am: datetime | None = None
    created_at: datetime | None = None
    schicht: TauschSchicht | None = None
    # Beim direkten Tausch die Gegenschicht der annehmenden Person. Nur die ID
    # zu liefern reicht der Oberfläche nicht: sie benennt den Tausch mit der
    # Zeit der Gegenschicht („Tausch gegen Fr 14–22"), und ohne diese Zeit
    # bleibt der Platzhalter leer (Wurzel 4).
    gegen_schicht: TauschSchicht | None = None


class WochenplanResponse(BaseModel):
    woche_start: date
    # Letzter Tag des Fensters (0544): eine Woche endet am Sonntag, ein freies
    # Fenster (`/dienstplan/zeitraum`) an `bis`.
    bis: date
    zeitzone: str
    personen: list[PlanPerson]
    schichten: list[Schicht]
    abwesenheiten: list[Abwesenheit]
    feiertage: dict[str, str] = Field(default_factory=dict)
    # Offene Schichten (Bedarf) stehen in `schichten` mit user_id=None.
    veroeffentlicht_am: datetime | None = None
    lesebestaetigungen: dict[str, datetime] = Field(default_factory=dict)
    # Soll/Ist je Person für die Fußzeile (Minuten).
    minuten_je_person: dict[str, int] = Field(default_factory=dict)
    regeln_bestaetigt: bool
    # --- 0544 ---------------------------------------------------------------
    verfuegbarkeiten: list[VerfuegbarkeitTag] = Field(default_factory=list)
    # Datum (ISO) → Vorhersage; {} wenn abgeschaltet oder keine Koordinate.
    wetter: dict[str, WetterTag] = Field(default_factory=dict)
    tausch: list[Tausch] = Field(default_factory=list)


class WocheKopieren(BaseModel):
    quelle_woche_start: date
    ziel_woche_start: date
    # Personen mit übernehmen oder nur die Zeiten (offene Schichten)?
    mit_personen: bool = True


class VeroeffentlichenResponse(BaseModel):
    woche_start: date
    anzahl: int
    benachrichtigt: int


class BedarfResponse(BaseModel):
    woche_start: date
    angelegt: int
    vorhanden: int


class BewerbungEntscheiden(BaseModel):
    user_id: str
    annehmen: bool


# --- Abwesenheit ------------------------------------------------------------


class AbwesenheitCreate(BaseModel):
    # Leitung darf für andere beantragen (z. B. Krankmeldung per Telefon).
    user_id: str | None = None
    art: AbwesenheitArt
    von: date
    bis: date
    halbtag_start: bool = False
    halbtag_ende: bool = False
    grund: str | None = Field(default=None, max_length=2000)
    attest_dokument_id: str | None = None

    @model_validator(mode="after")
    def _bis_nach_von(self) -> AbwesenheitCreate:
        if self.bis < self.von:
            msg = "Ende liegt vor dem Beginn."
            raise ValueError(msg)
        if (self.bis - self.von).days > MAX_ZEITRAUM_TAGE:
            msg = "Zeitraum zu lang."
            raise ValueError(msg)
        return self


class AbwesenheitEntscheiden(BaseModel):
    genehmigen: bool
    kommentar: str | None = Field(default=None, max_length=2000)


class Urlaubskonto(BaseModel):
    user_id: str
    jahr: int
    anspruch: float
    uebertrag: float
    korrektur: float
    korrektur_grund: str | None = None
    verfall_am: date | None = None
    genommen: float
    geplant: float
    rest: float
    # Anteilig gerechnet (Ein-/Austritt im Jahr)?
    anteilig: bool = False
    konto_vorhanden: bool


class UrlaubskontoSet(BaseModel):
    anspruch: float = Field(ge=0, le=365)
    uebertrag: float = Field(default=0, ge=0, le=365)
    verfall_am: date | None = None
    korrektur: float = Field(default=0, ge=-365, le=365)
    korrektur_grund: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _korrektur_mit_grund(self) -> UrlaubskontoSet:
        if self.korrektur != 0 and not (self.korrektur_grund or "").strip():
            msg = "Eine Korrektur braucht einen Grund."
            raise ValueError(msg)
        return self


class UrlaubssperreCreate(BaseModel):
    von: date
    bis: date
    grund: str = Field(min_length=1, max_length=500)
    arbeitsbereich_id: str | None = None

    @model_validator(mode="after")
    def _bis_nach_von(self) -> UrlaubssperreCreate:
        if self.bis < self.von:
            msg = "Ende liegt vor dem Beginn."
            raise ValueError(msg)
        return self


class Urlaubssperre(UrlaubssperreCreate):
    id: str


class VerfuegbarkeitCreate(BaseModel):
    user_id: str | None = None
    art: VerfuegbarkeitArt
    wiederkehrend_wochentag: int | None = Field(default=None, ge=0, le=6)
    datum_von: date | None = None
    datum_bis: date | None = None
    zeit_von: time | None = None
    zeit_bis: time | None = None
    ganztags: bool = True
    notiz: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _form(self) -> VerfuegbarkeitCreate:
        wiederkehrend = self.wiederkehrend_wochentag is not None
        bereich = self.datum_von is not None and self.datum_bis is not None
        if wiederkehrend == bereich:
            msg = "Entweder Wochentag ODER Datumsbereich."
            raise ValueError(msg)
        if bereich and self.datum_bis < self.datum_von:  # type: ignore[operator]
            msg = "Ende liegt vor dem Beginn."
            raise ValueError(msg)
        if not self.ganztags and (self.zeit_von is None or self.zeit_bis is None):
            msg = "Ohne ganztags sind Von- und Bis-Zeit Pflicht."
            raise ValueError(msg)
        return self


class Verfuegbarkeit(BaseModel):
    id: str
    user_id: str
    art: VerfuegbarkeitArt
    wiederkehrend_wochentag: int | None = None
    datum_von: date | None = None
    datum_bis: date | None = None
    zeit_von: time | None = None
    zeit_bis: time | None = None
    ganztags: bool
    notiz: str | None = None
    aktiv: bool


class AbwesenheitListResponse(BaseModel):
    items: list[Abwesenheit]
    personen: list[PlanPerson]


class Krankenstand(BaseModel):
    user_id: str
    full_name: str | None
    tage_krank: float
    faelle: int


# --- Zeiterfassung ----------------------------------------------------------


class Standort(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    genauigkeit_m: float | None = Field(default=None, ge=0)


class StempelStart(BaseModel):
    schicht_id: str | None = None
    task_id: str | None = None
    property_id: str | None = None
    standort: Standort | None = None
    # Zeitpunkt vom Gerät (Offline-Warteschlange der App); fehlt er, gilt jetzt.
    zeitpunkt: datetime | None = None
    idempotenz_key: str | None = Field(default=None, max_length=80)
    notiz: str | None = Field(default=None, max_length=1000)


class StempelEnde(BaseModel):
    standort: Standort | None = None
    zeitpunkt: datetime | None = None
    notiz: str | None = Field(default=None, max_length=1000)


class PausenEintrag(BaseModel):
    start: datetime
    end: datetime | None = None


class Zeiterfassung(BaseModel):
    id: str
    user_id: str
    start_at: datetime
    end_at: datetime | None
    pausen: list[PausenEintrag]
    quelle: ZeitQuelle
    schicht_id: str | None = None
    task_id: str | None = None
    property_id: str | None = None
    property_title: str | None = None
    standort_start: dict[str, float] | None = None
    standort_ende: dict[str, float] | None = None
    status: ZeitStatus
    bestaetigt_von: str | None = None
    bestaetigt_am: datetime | None = None
    notiz: str | None = None
    netto_minuten: int
    pause_minuten: int
    # Abweichung zur Schicht (Minuten), wenn eine verknüpft ist.
    plan_abweichung_min: int | None = None
    # Terminal (0544): welches Gerät gestempelt hat und wie viele Minuten nach
    # dem geplanten Schichtbeginn (None = keine Schicht oder pünktlich).
    terminal_id: str | None = None
    verspaetung_min: int | None = None
    korrekturen: int = 0
    # in_pause | laeuft | beendet
    zustand: str


class ZeitKorrektur(BaseModel):
    start_at: datetime | None = None
    end_at: datetime | None = None
    pausen: list[PausenEintrag] | None = None
    property_id: str | None = None
    grund: str = Field(min_length=3, max_length=1000)


class ZeitManuell(BaseModel):
    """Nachtrag einer vergessenen Stempelung durch die Leitung."""

    user_id: str
    start_at: datetime
    end_at: datetime
    pausen: list[PausenEintrag] = Field(default_factory=list)
    schicht_id: str | None = None
    property_id: str | None = None
    grund: str = Field(min_length=3, max_length=1000)

    @model_validator(mode="after")
    def _ende_nach_start(self) -> ZeitManuell:
        if self.end_at <= self.start_at:
            msg = "Ende muss nach dem Start liegen."
            raise ValueError(msg)
        return self


class ZeitListResponse(BaseModel):
    items: list[Zeiterfassung]
    personen: list[PlanPerson]


class AzkBuchung(BaseModel):
    id: str
    user_id: str
    datum: date
    minuten: int
    grund: AzkGrund
    notiz: str | None = None
    created_at: datetime | None = None


class AzkBuchungCreate(BaseModel):
    user_id: str
    datum: date
    minuten: int
    grund: Literal["abbau", "auszahlung", "korrektur"]
    notiz: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _pruefen(self) -> AzkBuchungCreate:
        if self.minuten == 0:
            msg = "Buchung ohne Minuten."
            raise ValueError(msg)
        if self.grund == "korrektur" and not (self.notiz or "").strip():
            msg = "Eine Korrektur braucht eine Notiz."
            raise ValueError(msg)
        return self


class Arbeitszeitkonto(BaseModel):
    user_id: str
    saldo_minuten: int
    buchungen: list[AzkBuchung]


class Monatsabschluss(BaseModel):
    user_id: str
    jahr: int
    monat: int
    soll_minuten: int
    ist_minuten: int
    saldo_minuten: int
    zuschlaege: dict[str, object]
    freigegeben_am: datetime | None = None
    freigegeben: bool


class MonatsabschlussRequest(BaseModel):
    user_ids: list[str] = Field(min_length=1, max_length=MAX_LISTE)
    jahr: int = Field(ge=2000, le=2100)
    monat: int = Field(ge=1, le=12)


# --- Auswertung -------------------------------------------------------------


class PersonAuswertung(BaseModel):
    user_id: str
    full_name: str | None
    beschaeftigungsart: Beschaeftigungsart | None = None
    firma_name: str | None = None
    soll_minuten: int
    plan_minuten: int
    ist_minuten: int
    nacht_minuten: int
    sonntag_minuten: int
    feiertag_minuten: int
    ueberstunden_minuten: int
    abwesenheit_tage: dict[str, float]
    kosten_minor: int | None = None
    currency: str | None = None


class ObjektKosten(BaseModel):
    property_id: str | None
    property_title: str | None
    minuten: int
    kosten_minor: int
    currency: str | None
    # Kosten aus Fremdfirmen darunter (Teilmenge).
    fremd_minor: int


class AuswertungResponse(BaseModel):
    von: date
    bis: date
    personen: list[PersonAuswertung]
    objekte: list[ObjektKosten]
    # Fehlende Voraussetzungen, LAUT benannt statt still 0 (Wurzel 4/5):
    # z. B. „3 Personen ohne Stundenlohn", „Regeln nicht bestätigt".
    hinweise: list[str] = Field(default_factory=list)


class LohnExportRequest(BaseModel):
    jahr: int = Field(ge=2000, le=2100)
    monat: int = Field(ge=1, le=12)
    format: Literal["datev_lodas", "csv"] = "datev_lodas"


class FeiertagsImportResponse(BaseModel):
    land: str
    jahre: list[int]
    eingefuegt: int
    vorhanden: int


# --- Kartei (0543): Verträge, Disziplin, Gespräche, Nachweise, Schulungen ---

VertragArt = Literal[
    "arbeitsvertrag",
    "aenderung",
    "verschwiegenheit",
    "wettbewerbsverbot",
    "bonus",
    "zielvereinbarung",
    "sonstiges",
]
VertragStatus = Literal["entwurf", "aktiv", "abgelaufen", "beendet"]
MassnahmeArt = Literal["ermahnung", "abmahnung", "letzte_abmahnung", "freistellung", "kuendigung"]
VorfallArt = Literal["unfall", "fehlverhalten", "regelverstoss", "leistung", "sonstiges"]
VorfallSchwere = Literal["gering", "mittel", "hoch", "kritisch"]
GespraechArt = Literal["feedback", "jahresgespraech", "probezeit", "zielgespraech", "sonstiges"]
NachweisArt = Literal["ausbildung", "zertifikat", "sprache", "faehigkeit", "erfahrung"]
EinladungStand = Literal["keine", "offen", "abgelaufen", "angenommen"]


class Aenderung(BaseModel):
    feld: str = Field(min_length=1, max_length=120)
    alt: str = Field(default="", max_length=500)
    neu: str = Field(default="", max_length=500)


class VertragCreate(BaseModel):
    art: VertragArt
    titel: str = Field(min_length=1, max_length=200)
    beschreibung: str | None = Field(default=None, max_length=4000)
    status: VertragStatus = "aktiv"
    version: str | None = Field(default=None, max_length=40)
    unterzeichnet_am: date | None = None
    gueltig_ab: date | None = None
    gueltig_bis: date | None = None
    unterzeichner: list[str] = Field(default_factory=list, max_length=20)
    bedingungen: list[Paar] = Field(default_factory=list, max_length=60)
    verlaengerung: str | None = Field(default=None, max_length=2000)
    kuendigung: str | None = Field(default=None, max_length=2000)
    dokument_id: str | None = None

    @model_validator(mode="after")
    def _bis_nach_ab(self) -> VertragCreate:
        if self.gueltig_ab and self.gueltig_bis and self.gueltig_bis < self.gueltig_ab:
            msg = "Ende liegt vor dem Beginn."
            raise ValueError(msg)
        return self


class VertragUpdate(BaseModel):
    art: VertragArt | None = None
    titel: str | None = Field(default=None, min_length=1, max_length=200)
    beschreibung: str | None = Field(default=None, max_length=4000)
    status: VertragStatus | None = None
    version: str | None = Field(default=None, max_length=40)
    unterzeichnet_am: date | None = None
    gueltig_ab: date | None = None
    gueltig_bis: date | None = None
    unterzeichner: list[str] | None = Field(default=None, max_length=20)
    bedingungen: list[Paar] | None = Field(default=None, max_length=60)
    verlaengerung: str | None = Field(default=None, max_length=2000)
    kuendigung: str | None = Field(default=None, max_length=2000)
    dokument_id: str | None = None
    geleert: list[str] = Field(default_factory=list, max_length=20)


class Nachtrag(BaseModel):
    id: str
    vertrag_id: str
    datum: date
    beschreibung: str
    grund: str | None = None
    aenderungen: list[Aenderung] = Field(default_factory=list)
    autorisiert_von: str | None = None
    autorisiert_von_name: str | None = None
    created_at: datetime | None = None


class NachtragCreate(BaseModel):
    datum: date
    beschreibung: str = Field(min_length=1, max_length=2000)
    grund: str | None = Field(default=None, max_length=1000)
    aenderungen: list[Aenderung] = Field(default_factory=list, max_length=40)


class Vertrag(BaseModel):
    id: str
    user_id: str
    art: VertragArt
    titel: str
    beschreibung: str | None = None
    status: VertragStatus
    version: str | None = None
    unterzeichnet_am: date | None = None
    gueltig_ab: date | None = None
    gueltig_bis: date | None = None
    unterzeichner: list[str] = Field(default_factory=list)
    bedingungen: list[Paar] = Field(default_factory=list)
    verlaengerung: str | None = None
    kuendigung: str | None = None
    dokument_id: str | None = None
    dokument_titel: str | None = None
    nachtraege: list[Nachtrag] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class MassnahmeCreate(BaseModel):
    art: MassnahmeArt
    datum: date
    grund: str = Field(min_length=1, max_length=1000)
    beschreibung: str | None = Field(default=None, max_length=4000)
    zeuge: str | None = Field(default=None, max_length=200)
    stellungnahme: str | None = Field(default=None, max_length=4000)
    folgetermin: date | None = None
    dokument_id: str | None = None


class MassnahmeUpdate(BaseModel):
    art: MassnahmeArt | None = None
    datum: date | None = None
    grund: str | None = Field(default=None, min_length=1, max_length=1000)
    beschreibung: str | None = Field(default=None, max_length=4000)
    zeuge: str | None = Field(default=None, max_length=200)
    stellungnahme: str | None = Field(default=None, max_length=4000)
    folgetermin: date | None = None
    geloest: bool | None = None
    geloest_am: date | None = None
    loesung: str | None = Field(default=None, max_length=2000)
    dokument_id: str | None = None
    geleert: list[str] = Field(default_factory=list, max_length=20)


class Massnahme(BaseModel):
    id: str
    user_id: str
    art: MassnahmeArt
    datum: date
    grund: str
    beschreibung: str | None = None
    ausgestellt_von: str | None = None
    ausgestellt_von_name: str | None = None
    zeuge: str | None = None
    stellungnahme: str | None = None
    folgetermin: date | None = None
    geloest: bool
    geloest_am: date | None = None
    loesung: str | None = None
    dokument_id: str | None = None
    dokument_titel: str | None = None
    created_at: datetime | None = None


class VorfallCreate(BaseModel):
    datum: date
    art: VorfallArt
    schwere: VorfallSchwere = "gering"
    ort: str | None = Field(default=None, max_length=200)
    beschreibung: str = Field(min_length=1, max_length=4000)
    zeugen: list[str] = Field(default_factory=list, max_length=20)
    massnahmen: str | None = Field(default=None, max_length=2000)
    praevention: str | None = Field(default=None, max_length=2000)
    folge_noetig: bool = False


class VorfallUpdate(BaseModel):
    datum: date | None = None
    art: VorfallArt | None = None
    schwere: VorfallSchwere | None = None
    ort: str | None = Field(default=None, max_length=200)
    beschreibung: str | None = Field(default=None, min_length=1, max_length=4000)
    zeugen: list[str] | None = Field(default=None, max_length=20)
    massnahmen: str | None = Field(default=None, max_length=2000)
    praevention: str | None = Field(default=None, max_length=2000)
    folge_noetig: bool | None = None
    geleert: list[str] = Field(default_factory=list, max_length=20)


class Vorfall(BaseModel):
    id: str
    user_id: str
    datum: date
    art: VorfallArt
    schwere: VorfallSchwere
    ort: str | None = None
    beschreibung: str
    zeugen: list[str] = Field(default_factory=list)
    massnahmen: str | None = None
    praevention: str | None = None
    gemeldet_von: str | None = None
    gemeldet_von_name: str | None = None
    folge_noetig: bool
    created_at: datetime | None = None


class GespraechCreate(BaseModel):
    datum: date
    art: GespraechArt = "feedback"
    bewertung: int | None = Field(default=None, ge=1, le=5)
    notizen: str | None = Field(default=None, max_length=6000)
    ziele: list[str] = Field(default_factory=list, max_length=20)
    erfolge: list[str] = Field(default_factory=list, max_length=20)
    entwicklung: list[str] = Field(default_factory=list, max_length=20)
    naechstes_am: date | None = None


class GespraechUpdate(BaseModel):
    datum: date | None = None
    art: GespraechArt | None = None
    bewertung: int | None = Field(default=None, ge=1, le=5)
    notizen: str | None = Field(default=None, max_length=6000)
    ziele: list[str] | None = Field(default=None, max_length=20)
    erfolge: list[str] | None = Field(default=None, max_length=20)
    entwicklung: list[str] | None = Field(default=None, max_length=20)
    naechstes_am: date | None = None
    geleert: list[str] = Field(default_factory=list, max_length=20)


class Gespraech(BaseModel):
    id: str
    user_id: str
    datum: date
    art: GespraechArt
    bewertung: int | None = None
    notizen: str | None = None
    ziele: list[str] = Field(default_factory=list)
    erfolge: list[str] = Field(default_factory=list)
    entwicklung: list[str] = Field(default_factory=list)
    gefuehrt_von: str | None = None
    gefuehrt_von_name: str | None = None
    naechstes_am: date | None = None
    created_at: datetime | None = None


class NachweisCreate(BaseModel):
    art: NachweisArt
    titel: str = Field(min_length=1, max_length=200)
    stelle: str | None = Field(default=None, max_length=200)
    stufe: str | None = Field(default=None, max_length=60)
    von: date | None = None
    bis: date | None = None
    ablauf_am: date | None = None
    kennung: str | None = Field(default=None, max_length=120)
    notiz: str | None = Field(default=None, max_length=2000)
    dokument_id: str | None = None

    @model_validator(mode="after")
    def _bis_nach_von(self) -> NachweisCreate:
        if self.von and self.bis and self.bis < self.von:
            msg = "Ende liegt vor dem Beginn."
            raise ValueError(msg)
        return self


class NachweisUpdate(BaseModel):
    art: NachweisArt | None = None
    titel: str | None = Field(default=None, min_length=1, max_length=200)
    stelle: str | None = Field(default=None, max_length=200)
    stufe: str | None = Field(default=None, max_length=60)
    von: date | None = None
    bis: date | None = None
    ablauf_am: date | None = None
    kennung: str | None = Field(default=None, max_length=120)
    notiz: str | None = Field(default=None, max_length=2000)
    dokument_id: str | None = None
    geleert: list[str] = Field(default_factory=list, max_length=20)


class Nachweis(BaseModel):
    id: str
    user_id: str
    art: NachweisArt
    titel: str
    stelle: str | None = None
    stufe: str | None = None
    von: date | None = None
    bis: date | None = None
    ablauf_am: date | None = None
    kennung: str | None = None
    notiz: str | None = None
    dokument_id: str | None = None
    dokument_titel: str | None = None
    # gueltig | laeuft_ab | abgelaufen | ohne_ablauf
    zustand: str
    created_at: datetime | None = None


class SchulungCreate(BaseModel):
    titel: str = Field(min_length=1, max_length=200)
    trainer: str | None = Field(default=None, max_length=200)
    abgeschlossen_am: date
    gueltig_bis: date | None = None
    notiz: str | None = Field(default=None, max_length=2000)
    dokument_id: str | None = None


class SchulungUpdate(BaseModel):
    titel: str | None = Field(default=None, min_length=1, max_length=200)
    trainer: str | None = Field(default=None, max_length=200)
    abgeschlossen_am: date | None = None
    gueltig_bis: date | None = None
    notiz: str | None = Field(default=None, max_length=2000)
    dokument_id: str | None = None
    geleert: list[str] = Field(default_factory=list, max_length=20)


class Schulung(BaseModel):
    id: str
    user_id: str
    titel: str
    trainer: str | None = None
    abgeschlossen_am: date
    gueltig_bis: date | None = None
    notiz: str | None = None
    dokument_id: str | None = None
    dokument_titel: str | None = None
    zustand: str
    created_at: datetime | None = None


class KommendeSchicht(BaseModel):
    id: str
    datum: date
    start_at: datetime
    end_at: datetime
    property_title: str | None = None
    arbeitsbereich_id: str | None = None
    status: SchichtStatus


class PersonUebersicht(BaseModel):
    """Kopf und Kurzinfo-Karten der Akte — eine Abfrage statt zehn.

    Felder, die nur die Leitung sehen darf (Kontakt, Einladung, Login), sind
    für die Schichtleitung `None` (§4.3)."""

    user_id: str
    full_name: str | None
    email: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    role: str
    is_active: bool
    letzter_login: datetime | None = None
    einladung: EinladungStand | None = None
    einladung_am: datetime | None = None
    eingeladen_von_name: str | None = None
    konto_seit: datetime | None = None
    # Zähler für die Reiter
    vertraege: int = 0
    massnahmen_offen: int = 0
    vorfaelle: int = 0
    gespraeche: int = 0
    nachweise: int = 0
    schulungen: int = 0
    faellig: int = 0
    # Laufender Monat (Minuten) — Soll aus der Akte, Plan aus Schichten, Ist aus Zeiten.
    monat_soll_minuten: int | None = None
    monat_plan_minuten: int = 0
    monat_ist_minuten: int = 0
    kommende_schichten: list[KommendeSchicht] = Field(default_factory=list)
    offene_antraege: int = 0
    azk_saldo_minuten: int | None = None
    urlaub_rest: float | None = None
    urlaub_anspruch: float | None = None
    # Monatliche Kosten (Lohn × Aufschlag) — nur Leitung, nur wenn Akte vollständig.
    kosten_monat_minor: int | None = None
    kosten_currency: str | None = None
    kosten_hinweis: str | None = None
