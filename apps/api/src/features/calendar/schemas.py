"""Pydantic-Schemas für den calendar-Slice.

Bildet die availability-Tabelle ab (Migration 0004): eine Zeile pro
(property_id, date) = die eine Wahrheit gegen Double-Bookings.
"""
from datetime import date
from enum import StrEnum
from typing import ClassVar

from pydantic import BaseModel, Field, model_validator


class AvailabilityStatus(StrEnum):
    open = "open"
    booked = "booked"
    blocked = "blocked"


class AvailabilitySource(StrEnum):
    direct = "direct"
    # Eigene Website des Betriebs (0380). `writes.py` reicht den Kanal der
    # Buchung unverändert als availability_source durch — fehlte der Wert hier,
    # zerlegte die erste Website-Buchung die Kalender-Antwort an der
    # Validierung (dieselbe Falle wie 'ical', siehe unten).
    website = "website"
    portal = "portal"
    booking = "booking"
    airbnb = "airbnb"
    vrbo = "vrbo"
    # Sonstige OTA (Expedia, Agoda, Namensvarianten). Externer Kanal:
    # 0,5 % monatlich, kein Charge über uns (Preisliste §2).
    ota_other = "ota_other"
    manual = "manual"
    # Sperre aus einem abonnierten Fremdkalender (external_calendar/service.py
    # schreibt status='blocked', source='ical'; DB-Enum seit 0119). Kein
    # Vertriebskanal, sondern eine Herkunft wie 'manual' — fehlte hier, womit
    # jede Antwort mit einer iCal-Sperre an der Validierung gescheitert wäre.
    ical = "ical"
    # Sperre, weil der Vermarktungsvertrag zu diesem Objekt endet (0355,
    # properties.vertragsende). Wie 'ical'/'manual' kein Vertriebskanal,
    # sondern eine Herkunft — und wie dort gilt: fehlte der Wert hier, würde
    # jede Board-Antwort mit einer Vertragssperre an der Validierung scheitern.
    # Eigener Wert und nicht 'manual', damit `_unblock` sie nicht aufhebt.
    contract_end = "contract_end"


class DateRange(BaseModel):
    start: date
    end: date  # exklusiv (Check-out-Tag ist wieder frei)

    # Harte Obergrenze (Wurzel 8): Jeder Aufrufer materialisiert `nights()` und
    # expandiert es je Rate-Plan zu Upsert- und Channex-Zeilen. Ohne Deckel baut
    # ein `end=2226-01-01` ~73.000 Tage × n Rate-Plans auf — ein Selbst-DoS über
    # einen ganz normalen Request. 5 Jahre liegen weit über jedem echten
    # Planungshorizont (Full-Sync pusht 500 Tage).
    MAX_NIGHTS: ClassVar[int] = 1830

    @model_validator(mode="after")
    def _check_order(self) -> "DateRange":
        if self.end <= self.start:
            raise ValueError("end muss nach start liegen")
        if (self.end - self.start).days > self.MAX_NIGHTS:
            raise ValueError(
                f"Zeitraum zu groß (max. {self.MAX_NIGHTS} Nächte)"
            )
        return self

    def nights(self) -> list[date]:
        """Alle Übernachtungstage (start inklusive, end exklusiv)."""
        from datetime import timedelta

        days: list[date] = []
        cur = self.start
        while cur < self.end:
            days.append(cur)
            cur += timedelta(days=1)
        return days


class DayAvailability(BaseModel):
    date: date
    status: AvailabilityStatus
    source: AvailabilitySource
    # Tagespreis (Resolver): override > dynamic > weekday > base.
    # None, wenn das Objekt keinen Rate-Plan/Override hat (kein Fallback-Wert).
    price: float | None = None
    # Herkunft des Tagespreises: override | dynamic | weekday | base | none.
    # „dynamic" = von der Dynamic-Pricing-Engine → UI zeigt „auto"-Badge.
    price_source: str = "none"
    # Faktor-Aufschlüsselung bei dynamischem Preis ({faktor: multiplikator}) für
    # den „Warum dieser Preis?"-Tooltip. None außer bei price_source=dynamic.
    price_factors: dict[str, float] | None = None
    # Mindestaufenthalt aus dem Rate-Plan des Objekts (per-Tag-Restriktionen v2).
    min_stay: int | None = None
    # CTA/CTD-Restriktionen je Tag (Default false bei fehlender availability-Zeile).
    closed_to_arrival: bool = False
    closed_to_departure: bool = False


class AvailabilityCheck(BaseModel):
    property_id: str
    available: bool
    conflicting_days: list[date] = []


class FreieEinheitenSpanne(BaseModel):
    """Ein zusammenhängender Zeitraum mit gleichbleibender freier Stückzahl."""

    von: date
    bis: date  # INKLUSIV (anders als DateRange.end) — es ist eine Belegtspanne
    frei: int
    gesamt: int


class FreieEinheitenResponse(BaseModel):
    """Verfügbarkeit als ZAHL freier Einheiten, nicht als 0/1.

    Ein Objekt ist ein Einheiten-TYP mit n ≥ 1 Einheiten (0265); die Portale
    erwarten eine Stückzahl. Die Tagesreihe des Kalenders faltet das bewusst auf
    einen Status je Tag zusammen (Anzeige), hier steht die echte Zahl.
    """

    property_id: str
    gesamt: int
    spannen: list[FreieEinheitenSpanne] = []


class BoardProperty(BaseModel):
    """Ein Objekt im Batch-Kalender: Tagesdaten + Stop-Sells in einem Rutsch.

    Ersetzt die N+1-Einzelabrufe (früher 2 HTTP-Calls je Objekt) durch EINE
    gebündelte Antwort für alle Objekte des Tenants — der Board-Endpunkt lädt die
    zugrundeliegenden Tabellen mit wenigen `.in_(property_ids)`-Queries statt mit
    6 Queries pro Objekt."""
    property_id: str
    # Objekt-Währung (aus dem Rate-Plan) für die Tagespreis-Anzeige — damit das
    # Frontend die Währung nicht mehr behelfsweise aus Reservierungen ableitet
    # (Objekte ohne Buchung hätten sonst keine Währung).
    currency: str | None = None
    days: list[DayAvailability] = []
    stop_sell: list["StopSellDay"] = []


class BoardResponse(BaseModel):
    items: list[BoardProperty] = []


class BlockRequest(BaseModel):
    property_id: str
    range: DateRange
    # Einheit, die gesperrt werden soll (property_units, 0265/0353). None = der
    # ganze Einheiten-TYP, also alle Einheiten des Objekts — der Normalfall bei
    # einem Objekt mit einer Einheit und das bisherige Verhalten. Bei einem Typ
    # mit fünf gleichen Studios nimmt eine Sperre mit `unit_id` nur dieses eine
    # aus dem Verkauf. Der Service prüft die Zugehörigkeit zu property_id UND
    # Mandant serverseitig (Wurzel 3) — der Wert kommt aus dem Request und ist
    # ungeprüft nichts wert.
    unit_id: str | None = None


class PriceOverrideRequest(BaseModel):
    property_id: str
    date: date
    price: float | None  # None = Überschreibung zurücknehmen (Lastenheft §2.2)


class StopSellSource(StrEnum):
    manual = "manual"
    channex = "channex"


class StopSellScope(StrEnum):
    # all: sperrt alle Vertriebskanäle (Default, wie bisher). channels: nur die
    # in channels[] genannten Kanäle (z. B. ["ota:BookingCom"], ["platform"]).
    all = "all"
    channels = "channels"


class StopSellDay(BaseModel):
    id: str
    property_id: str
    date: date
    reason: str | None = None
    source: StopSellSource
    # Hotel: Stopp gilt NUR für diesen Rate-Plan (Zeile im Stop-Sell-Kalender).
    # None = Objekt-Ebene (Ferienwohnung/Altdaten) → gilt für alle Pläne.
    rate_plan_id: str | None = None
    # Kanal-Dimension: all = alle Kanäle (Default), channels = nur channels[].
    scope: StopSellScope = StopSellScope.all
    channels: list[str] = []
    # Reisebüro/Veranstalter, an den sich der Stopp richtet (None = alle).
    agency_id: str | None = None
    # Name des Reisebüros (Join travel_agencies) — fürs Kalender-Balken-Label.
    agency_name: str | None = None


class StopSellListResponse(BaseModel):
    items: list[StopSellDay] = []
    total: int = 0


class StopSellRequest(BaseModel):
    """Verkaufsstopp für einen Zeitraum setzen (manuell).

    weekdays: optionale Wochentags-Maske (ISO: 0=Montag … 6=Sonntag) — nur
    passende Tage im Zeitraum werden gesperrt (z. B. nur Wochenenden).
    None/leer = alle Tage.
    """
    property_id: str
    range: DateRange
    reason: str | None = None
    weekdays: list[int] | None = None
    # Adressat der Stop-Sale-Meldung (travel_agencies.id); None = alle Kanäle.
    agency_id: str | None = None

    @model_validator(mode="after")
    def _check_weekdays(self) -> "StopSellRequest":
        if self.weekdays is not None and any(w < 0 or w > 6 for w in self.weekdays):
            raise ValueError("weekdays müssen zwischen 0 (Montag) und 6 (Sonntag) liegen")
        return self


class StopSellClearRequest(BaseModel):
    property_id: str
    range: DateRange
    # Wochentags-Maske wie bei StopSellRequest (nur passende Tage aufheben).
    weekdays: list[int] | None = None
    # include_portal: auch Portal-/Channex-Stops aufheben (nicht nur manuelle).
    # Für versehentlich/über einen Test gesetzte Stops. Öffnet die Tage dann auch
    # an den OTAs (stop_sell=false-Push) — bewusst, daher opt-in.
    include_portal: bool = False
    # include_rate_plans: zusätzlich die plan-genauen Stopps desselben Tages
    # aufheben. Der Belegungsplan zeigt eine Zeile je OBJEKT und kennt keine
    # Rate-Pläne — dort MUSS das an, sonst löscht der Klick die Zeile nicht, auf
    # die der Nutzer zeigt. Die plan-genaue Ansicht lässt es aus (Wurzel 1).
    include_rate_plans: bool = False

    @model_validator(mode="after")
    def _check_weekdays(self) -> "StopSellClearRequest":
        if self.weekdays is not None and any(w < 0 or w > 6 for w in self.weekdays):
            raise ValueError("weekdays müssen zwischen 0 (Montag) und 6 (Sonntag) liegen")
        return self


class StopSellResetRequest(BaseModel):
    # property_id=None → alle Objekte des Tenants zurücksetzen.
    property_id: str | None = None


class SeasonPriceRequest(BaseModel):
    """Tagespreis für einen Zeitraum setzen (Saisonpreis). end exklusiv."""
    property_id: str
    range: DateRange
    price: float  # pro Nacht


class SeasonPriceDay(BaseModel):
    date: date
    price: float


class SeasonPriceListResponse(BaseModel):
    items: list[SeasonPriceDay] = []
    total: int = 0


# -- Benannte Saisons (Jahres-Kalender, Drag&Drop) --------------------------
class SeasonMode(StrEnum):
    percent = "percent"  # amount = Aufschlag/Abschlag in % auf den Basispreis
    fixed = "fixed"      # amount = fester Nachtpreis


class SeasonCreate(BaseModel):
    """Benannte Saison-Kategorie eines Objekts (Hochsaison, Event …)."""
    property_id: str
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    mode: SeasonMode
    amount: float

    @model_validator(mode="after")
    def _check_amount(self) -> "SeasonCreate":
        if self.mode == SeasonMode.fixed and self.amount < 0:
            raise ValueError("Fester Preis darf nicht negativ sein")
        return self


class SeasonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    mode: SeasonMode | None = None
    amount: float | None = None


class SeasonAssignRequest(BaseModel):
    """Einen Datumsbereich einer Saison zuweisen. end exklusiv (wie DateRange)."""
    property_id: str
    season_id: str
    range: DateRange


class SeasonClearRequest(BaseModel):
    """Einen Datumsbereich aus ALLEN Saisons lösen (Rechtsklick im Kalender).
    Überlappende Zuweisungen werden gekürzt/gesplittet, die Tage fallen auf den
    Basispreis zurück. end exklusiv (wie DateRange)."""
    property_id: str
    range: DateRange


class SeasonAssignment(BaseModel):
    id: str
    season_id: str
    start_date: date
    end_date: date  # inklusiv (DB speichert inklusiv)


class SeasonResponse(BaseModel):
    id: str
    property_id: str
    name: str
    color: str
    mode: SeasonMode
    amount: float
    assignments: list[SeasonAssignment] = []


class SeasonListResponse(BaseModel):
    items: list[SeasonResponse] = []
    total: int = 0


class SeasonApplyRequest(BaseModel):
    """Eine Prozent-Saison auf weitere eigene Objekte übertragen (Kopie).

    Der Deckel von 200 Zielen ist kein Schönheitswert: die Übertragung
    materialisiert je Ziel die Tagespreise und reiht ARI-Pushes ein — ohne
    Obergrenze wäre eine geratene Riesenliste ein Selbst-DoS (Wurzel 8).
    """
    property_ids: list[str] = Field(min_length=1, max_length=200)
    # Ohne Zeiträume wird nur die Saison-Definition angelegt (leerer Kalender).
    mit_zeitraeumen: bool = True


class SeasonApplySkipped(BaseModel):
    property_id: str
    grund: str


class SeasonApplyResponse(BaseModel):
    uebertragen: int = 0
    # Nicht still weglassen (Wurzel 5): wer keinen Basispreis hat, kann einen
    # Prozentsatz nicht materialisieren und muss in der UI benannt werden.
    uebersprungen: list[SeasonApplySkipped] = []


class BulkEditRequest(BaseModel):
    """Mehrere Objekte × ein Zeitraum in einem Rutsch bearbeiten (wie Hostaway).

    Es wird nur angewendet, was gesetzt ist (None = unverändert):
      - price:             fester Tagespreis je Tag (price_overrides + Channex)
      - price_adjust_pct:  prozentuale Anpassung des effektiven Tagespreises
                           (z. B. +10 / -15); schließt `price` aus
      - min_stay:          Mindestaufenthalt je Objekt (rate_plans + Channex)
      - max_stay:          Maximalaufenthalt je Objekt (Channex-Restriction)
      - block:             True = sperren, False = Sperre aufheben (availability)
      - stop_sell:         True = Verkaufsstopp setzen, False = aufheben
    """

    property_ids: list[str]
    range: DateRange
    price: float | None = None
    price_adjust_pct: float | None = None
    min_stay: int | None = None
    max_stay: int | None = Field(default=None, ge=0)
    block: bool | None = None
    stop_sell: bool | None = None
    closed_to_arrival: bool | None = None
    closed_to_departure: bool | None = None

    @model_validator(mode="after")
    def _at_least_one(self) -> "BulkEditRequest":
        if not self.property_ids:
            raise ValueError("Mindestens ein Objekt erforderlich")
        if self.price is not None and self.price_adjust_pct is not None:
            raise ValueError(
                "Fester Preis und prozentuale Anpassung schließen sich aus"
            )
        changes = (
            self.price,
            self.price_adjust_pct,
            self.min_stay,
            self.max_stay,
            self.block,
            self.stop_sell,
            self.closed_to_arrival,
            self.closed_to_departure,
        )
        if all(c is None for c in changes):
            raise ValueError("Mindestens eine Änderung erforderlich")
        return self


class BulkEditResult(BaseModel):
    properties: int  # Anzahl bearbeiteter Objekte
    days: int        # Tage je Objekt im Zeitraum
    applied: list[str]  # welche Aktionen ausgeführt wurden


class RestrictionRow(BaseModel):
    """Eine Restriktions-Zeile für einen Datumsbereich (end inklusiv über die
    DateRange, hier als von/bis; end exklusiv). Beliebige Kombination gesetzter
    Felder — nur gesetzte werden an Channex gesendet."""
    range: DateRange
    # Hotel: Zeile gilt für GENAU diesen Rate-Plan (Twin/BAR ≠ Double/B&B am
    # selben Tag). None = Objekt-Ebene (Ferienwohnung) → alle Pläne. Der Plan
    # wird serverseitig gegen das Objekt geprüft (Wurzel 3), nie geglaubt.
    rate_plan_id: str | None = None
    price: float | None = Field(default=None, ge=0)  # fester Nachtpreis
    min_stay: int | None = Field(default=None, ge=1)
    max_stay: int | None = Field(default=None, ge=0)
    closed_to_arrival: bool | None = None
    closed_to_departure: bool | None = None
    stop_sell: bool | None = None
    # Grund für den lokalen stop_sell-Spiegel (Guesty-Muster: „Wartung — Notiz").
    # Geht NICHT an Channex (kennt kein reason-Feld), nur in die eigene Tabelle.
    reason: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "RestrictionRow":
        if all(v is None for v in (
            self.price, self.min_stay, self.max_stay,
            self.closed_to_arrival, self.closed_to_departure, self.stop_sell,
        )):
            raise ValueError("Jede Zeile braucht mindestens eine Restriktion")
        return self


class RestrictionRowsRequest(BaseModel):
    """Mehrere heterogene Restriktions-Zeilen eines Objekts in EINEM Channex-Call
    (Zertifizierung Test 3-8: verschiedene Preise/Restriktionen, 1 API-Call)."""
    property_id: str
    rows: list[RestrictionRow] = Field(min_length=1)


class MultiRestrictionRow(RestrictionRow):
    """Restriktions-Zeile MIT Objekt-Bezug — für die zimmerübergreifende
    Bulk-Aktion (Hotel: eine Aktion über mehrere Zimmer × Rate-Plans).
    property_id wird serverseitig gegen den Tenant geprüft (Wurzel 3)."""
    property_id: str


class MultiRestrictionRowsRequest(BaseModel):
    """Zimmer-übergreifende Bulk-Restriktionen: eine UI-Aktion über mehrere
    Zimmer × Rate-Plans → EIN gebündelter Channex-Call je Channex-Property
    (Zertifizierung Tests 3-8 über Room-Types hinweg)."""
    rows: list[MultiRestrictionRow] = Field(min_length=1)


# --- Sperr-Anträge der Eigentümer (Agentur-Sicht, 0332) --------------------

class BlockRequestDecision(BaseModel):
    """Entscheidung über einen Sperrantrag. Die Notiz ist optional und geht als
    Begründung an den Eigentümer (bei Ablehnung fachlich erwartet)."""

    note: str | None = Field(default=None, max_length=2000)
    # Die Agentur wertet DIESEN Antrag als Vertragskündigung (0377). Nötig für
    # den Bestand: Anträge von vor diesem Feld tragen `ist_kuendigung=false`,
    # obwohl der Eigentümer im Freitext genau das erklärt hat („Vi er ikke
    # interesseret i udlejning 2027"). Die Agentur akzeptiert das hier, OHNE
    # beim Eigentümer eine zweite Anfrage auszulösen.
    #
    # Bewusst ein Feld an der ENTSCHEIDUNG und nicht am Antrag: es ist die
    # Auslegung der Agentur, nicht die Erklärung des Eigentümers. Trägt der
    # Antrag `ist_kuendigung=true`, ist es überflüssig — dann steht die Absicht
    # schon fest und der Genehmigen-Pfad handelt ohnehin danach.
    als_kuendigung: bool = False
    # Das Vertragsende, das gesetzt werden soll (erster Tag OHNE Vertrag).
    # Leer → der Server nimmt den `start_date` des Antrags: „ab da nicht mehr
    # vermieten" heißt „ab da kein Vertrag". Ein abweichender Wunsch (der
    # Vertrag läuft noch bis Monatsende) wird hier ausdrücklich gesetzt, statt
    # ihn aus dem Antrag zu raten (Wurzel 4).
    vertragsende: date | None = None


class SperrantragItem(BaseModel):
    """Ein Sperrantrag in der Agentur-Warteschlange.

    `start_date`/`end_date` sind INKLUSIV (so hat der Eigentümer sie gestellt);
    die Umrechnung auf den exklusiven `DateRange` des Kalenders passiert im
    Service, nicht hier.
    """

    id: str
    property_id: str
    property_title: str | None = None
    # Die beantragte Einheit (0353). None = der ganze Einheiten-TYP. Die Agentur
    # MUSS das sehen: „Studio 3 vom 1.–5." ist eine andere Entscheidung als
    # „alle fünf Studios vom 1.–5.".
    unit_id: str | None = None
    unit_name: str | None = None
    requested_by: str | None = None
    requested_by_name: str | None = None
    start_date: date
    end_date: date
    status: str  # pending | approved | rejected
    reason: str | None = None
    decided_by: str | None = None
    decided_at: str | None = None
    decision_note: str | None = None
    created_at: str | None = None
    # Vertragskündigung (0377) — drei Felder, drei verschiedene Aussagen:
    # was der EIGENTÜMER erklärt hat, was die AGENTUR daraus gemacht hat, und
    # welches Enddatum daraus wurde. Sie in eines zu falten hieße hinterher
    # behaupten „der Eigentümer hat gekündigt", wo die Agentur ausgelegt hat.
    ist_kuendigung: bool = False
    als_kuendigung_gewertet: bool = False
    vertragsende_gesetzt_auf: date | None = None


class SperrantragListe(BaseModel):
    items: list[SperrantragItem]
    total: int


class SperrantragKollision(BaseModel):
    """Eine Buchung/Eigennutzung, die dem beantragten Zeitraum im Weg steht.

    Trägt alles, was zum Entscheiden nötig ist — und nichts darüber hinaus:
    kein Telefon, keine Adresse (Wurzel 9). `art` unterscheidet die beiden
    Auflösungswege: eine `buchung` wird storniert (Gast, Geld, OTA-Meldung),
    eine `eigennutzung` gehört demselben Eigentümer und wird eher über den
    Widerruf ihres Antrags aufgelöst.
    """

    reservation_id: str
    art: str  # buchung | eigennutzung
    bezeichnung: str
    unit_id: str | None = None
    unit_name: str | None = None
    check_in: date
    check_out: date  # exklusiv (Abreisetag ist wieder frei)
    status: str
    channel: str
    ota_name: str | None = None
    total_amount: float | None = None
    # Währung DIESER Buchung, nie ein €-Ersatz (Wurzel 4). Fehlt sie, rendert
    # das Frontend den Betrag symbollos statt eine falsche Währung zu behaupten.
    currency: str | None = None
    is_owner_stay: bool = False
    owner_id: str | None = None


class SperrantragSperrtag(BaseModel):
    """Eine gesperrte Nacht ohne Buchung dahinter (Handwerker/Agentur/iCal).

    Wird NICHT storniert, sondern im Kalender aufgehoben — darum eine eigene
    Form und nicht in `SperrantragKollision` hineingezwungen.
    """

    datum: date
    unit_id: str | None = None
    unit_name: str | None = None
    source: str


class SperrantragKollisionen(BaseModel):
    """Was der Genehmigung eines Sperrantrags im Weg steht.

    `blockiert` ist die Antwort, an der die Oberfläche den Genehmigen-Knopf
    sperrt — dieselbe Frage, die der Schreibpfad beim Klick erneut stellt (die
    Vorschau ist kein Anspruch: zwischen Anzeige und Klick kann eine Buchung
    eingehen).

    Die `*_gesamt`-Zahlen sind VOLLSTÄNDIG, die Listen können gekürzt sein
    (`gekuerzt`) — ein Jahresantrag über ein Hotel hätte sonst einen Payload,
    den niemand liest (Wurzel 8).
    """

    property_id: str
    # Wurde als VERTRAGSKÜNDIGUNG geprüft (0377)? Dann ist eine bestehende
    # `contract_end`-Sperre der Zielzustand und kein Hindernis, und die
    # Oberfläche zeigt statt „was auflösen" die Buchungen hinter dem Enddatum.
    als_kuendigung: bool = False
    unit_id: str | None = None
    unit_name: str | None = None
    start_date: date
    end_date: date  # INKLUSIV, wie der Antrag gestellt wurde
    naechte: int
    einheiten_gesamt: int
    blockiert: bool
    grund: str | None = None  # belegt | stop_sell
    # Die Einheit, in die die Eigennutzung gehen würde ("*" = Altbestand ohne
    # property_units). None, wenn keine im ganzen Zeitraum frei ist.
    freie_einheit_id: str | None = None
    freie_einheit_name: str | None = None
    min_freie_einheiten: int
    buchungen: list[SperrantragKollision] = []
    buchungen_gesamt: int = 0
    sperrtage: list[SperrantragSperrtag] = []
    sperrtage_gesamt: int = 0
    stop_sell_tage: list[str] = []
    stop_sell_gesamt: int = 0
    gekuerzt: bool = False
    # Der längste durchgehend freie Abschnitt im beantragten Zeitraum — als
    # Vorschlag für die Entscheiderin, nicht als automatische Kürzung.
    frei_von: date | None = None
    frei_bis: date | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
