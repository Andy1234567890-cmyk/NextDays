"""Pydantic-Schemas für den owner_reporting-Slice.

Drei Ebenen, in der Reihenfolge, in der der Betrieb sie benutzt:

1. **Bericht** (`owner_reports`) — Zeitraum × Objektauswahl × Währung. Seine
   Aufschlüsselungen (Mieten je Objekt, Gebühren je Art, Portal-Provisionen je
   Kanal, Zahlungsarten, Nettoeinkommen je Kanal) werden bei jedem Abruf frisch
   gerechnet und deshalb NICHT gespeichert.
2. **Zahlung** (`owner_report_payments`) — die Auszahlung an EINEN Empfänger
   aus einem Bericht. Sie ist ein Snapshot: einmal erzeugt, ändert sie sich
   nicht mehr, weil jemand später eine Gebühr am Objekt korrigiert.
3. **Geplanter Bericht** (`owner_report_schedules`) — der Rhythmus, in dem
   Berichte automatisch entstehen.

Beträge sind ``float`` an der API-Grenze (JSON kennt kein Decimal); gerechnet
wird durchgehend in ``Decimal`` (``owner_statements.common``). Währungen kommen
IMMER aus den Daten und haben nirgends einen Default — ein ``"EUR"`` wäre der
erfundene Wert aus Wurzel 4.
"""
from __future__ import annotations

from datetime import date as date_
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator, model_validator

# Eine Auswertung über mehr als drei Jahre ist keine Abrechnung mehr, sondern
# ein Vollscan über den gesamten Buchungsbestand. Harte Obergrenze statt eines
# offenen Zeitraums (Wurzel 8) — der Aufrufer bekommt 422 statt eines Timeouts.
MAX_ZEITRAUM_TAGE = 1100


class ReportBasis(StrEnum):
    """Welches Datum der Buchung über die Zugehörigkeit zum Zeitraum entscheidet.

    ``booked`` ist der Buchungszeitpunkt aus der QUELLE (``reservations.booked_at``
    bzw. der Portal-Zeitstempel, Wurzel 5b) — nie unser ``created_at``. Fehlt er,
    fällt die Buchung aus dem Bericht heraus, statt mit unserem Eingangsdatum
    hineingerechnet zu werden.
    """

    check_in = "check_in"
    check_out = "check_out"
    booked = "booked"


class Abschnitt(StrEnum):
    """Die fünf Abschnitte einer Zahlung.

    ``ausgaben`` ist der einzige mit negativen Beträgen — er MINDERT die
    Auszahlung. Alle anderen sind positiv.
    """

    unterkunftspreis = "unterkunftspreis"
    gebuehren = "gebuehren"
    steuern = "steuern"
    ausgaben = "ausgaben"
    andere = "andere"


class Rhythmus(StrEnum):
    woche = "woche"
    monat = "monat"
    quartal = "quartal"
    jahr = "jahr"


class AmTag(StrEnum):
    erste = "erste"
    letzte = "letzte"


class PlanZeitraum(StrEnum):
    vergangener = "vergangener"
    laufender = "laufender"


class RecurringModus(StrEnum):
    je_buchung = "je_buchung"
    je_nacht = "je_nacht"
    je_zeitraum = "je_zeitraum"


def _waehrung(value: str) -> str:
    norm = (value or "").strip().upper()
    if len(norm) != 3 or not norm.isalpha():
        raise ValueError("Währung muss ein ISO-4217-Code sein (z. B. DKK).")
    return norm


# ---------------------------------------------------------------------------
# Bericht
# ---------------------------------------------------------------------------


class ReportBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    currency: str
    period_from: date_
    period_to: date_
    basis: ReportBasis = ReportBasis.check_in
    # Leer = alle Status. Nicht als Default ``["confirmed"]``: welche Status ein
    # Betrieb abrechnet, ist seine Entscheidung und keine Annahme von uns.
    reservation_statuses: list[str] = Field(default_factory=list)
    property_ids: list[str] = Field(default_factory=list)

    @field_validator("currency")
    @classmethod
    def _cur(cls, value: str) -> str:
        return _waehrung(value)

    @model_validator(mode="after")
    def _zeitraum(self) -> ReportBase:
        if self.period_to < self.period_from:
            raise ValueError("„Bis“ darf nicht vor „Von“ liegen.")
        if (self.period_to - self.period_from).days > MAX_ZEITRAUM_TAGE:
            raise ValueError(
                f"Der Zeitraum darf höchstens {MAX_ZEITRAUM_TAGE} Tage umfassen."
            )
        if not self.property_ids:
            raise ValueError("Mindestens ein Objekt auswählen.")
        return self


class ReportCreate(ReportBase):
    pass


class ReportUpdate(BaseModel):
    """Kopf und Scope ändern. Alles optional — nur Gesendetes wirkt.

    ``property_ids`` als ``None`` heißt „nicht ändern"; eine LEERE Liste wäre
    „keine Objekte" und damit ein Bericht ohne Gegenstand — der Service lehnt
    sie mit 422 ab, statt still die alte Auswahl zu behalten.
    """

    name: str | None = Field(default=None, min_length=1, max_length=200)
    currency: str | None = None
    period_from: date_ | None = None
    period_to: date_ | None = None
    basis: ReportBasis | None = None
    reservation_statuses: list[str] | None = None
    property_ids: list[str] | None = None

    @field_validator("currency")
    @classmethod
    def _cur(cls, value: str | None) -> str | None:
        return None if value is None else _waehrung(value)


class ReportListItem(BaseModel):
    id: str
    name: str
    currency: str
    period_from: date_
    period_to: date_
    property_count: int
    # Lodgify-Spalte „Automatisch generiert": kam der Bericht aus einem Plan?
    auto_generated: bool
    schedule_id: str | None = None
    payment_count: int
    created_at: str | None = None


class ReportListResponse(BaseModel):
    items: list[ReportListItem]
    total: int


# --- Aufschlüsselungen -------------------------------------------------------


class MietZeile(BaseModel):
    """Eine Zeile der „Aufschlüsselung der Mieten" (je Objekt)."""

    property_id: str
    property_name: str | None = None
    bookings: int
    nights: int
    guests: int
    rent: float
    fees: float
    addons: float
    taxes: float
    # Was das PORTAL einbehält (Provision + ggf. Zahlungsgebühr). ``None``,
    # solange für einen Kanal dieser Zeile kein Provisionssatz hinterlegt ist —
    # eine 0 behauptete, das Portal habe nichts einbehalten.
    channel: float | None = None
    # Was nach dem Portal-Abzug beim Betrieb ankommt. ``None``, wenn der Abzug
    # unbekannt ist (siehe ``channel``).
    income: float | None = None


class GebuehrZeile(BaseModel):
    """Eine Zeile der „Aufschlüsselung der Gebühren" (je Gebührenart)."""

    fee_type: str
    label: str
    count: int
    # Summe / Anzahl. Vom Server gerechnet, damit die Anzeige nicht dividiert
    # und dabei durch 0 fällt.
    average: float
    total: float


class KanalZeile(BaseModel):
    """Eine Zeile je Vertriebskanal (Provisionen bzw. Nettoeinkommen)."""

    channel: str
    ota_name: str | None = None
    # ``None``, wenn für diesen Kanal kein Provisionssatz hinterlegt ist.
    commission: float | None = None
    income: float | None = None
    # Was der Gast noch schuldet (total_amount − paid_amount) — Lodgifys
    # „Ausstehender betrag".
    outstanding: float


class ZahlungsartZeile(BaseModel):
    """Was der Gast über welchen Weg bezahlt hat."""

    method: str
    total: float


class BuchungPosten(BaseModel):
    """Eine Zeile der Buchungsaufschlüsselung (Konzept · Beschreibung · Summe)."""

    kind: str
    label: str
    amount: float


class BuchungZeile(BaseModel):
    """Eine Buchung in der Detailansicht „Aufschlüsselung nach Buchung"."""

    reservation_id: str
    property_id: str
    property_name: str | None = None
    check_in: date_
    check_out: date_
    nights: int
    guests: int
    guest_name: str | None = None
    reference: str | None = None
    channel: str
    ota_name: str | None = None
    currency: str
    items: list[BuchungPosten] = Field(default_factory=list)
    gross: float
    # ``None``, wenn für den Kanal dieser Buchung kein Provisionssatz
    # hinterlegt ist und das Portal keinen Betrag gemeldet hat.
    channel_commission: float | None = None
    income: float | None = None


class ReportSummary(BaseModel):
    """Die KPI-Zeile des Berichts, alles in der Berichtswährung."""

    currency: str
    # ``None``, sobald für eine Buchung des Zeitraums der Portal-Abzug fehlt.
    income: float | None = None
    rent: float = 0
    fees: float = 0
    addons: float = 0
    taxes: float = 0
    channel_commission: float | None = None
    bookings: int = 0
    nights: int = 0
    guests: int = 0


class ZahlungsUebersicht(BaseModel):
    """„Zusammenfassung der Zahlungen" — die bereits erzeugten Auszahlungen."""

    currency: str
    payout: float
    rent: float
    fees: float
    taxes: float
    expenses: float
    other: float
    payment_count: int


class ReportDetail(BaseModel):
    id: str
    tenant_id: str
    name: str
    currency: str
    period_from: date_
    period_to: date_
    basis: ReportBasis
    reservation_statuses: list[str]
    property_ids: list[str]
    auto_generated: bool
    schedule_id: str | None = None
    summary: ReportSummary
    payments_summary: ZahlungsUebersicht
    rent_rows: list[MietZeile] = Field(default_factory=list)
    fee_rows: list[GebuehrZeile] = Field(default_factory=list)
    commission_rows: list[KanalZeile] = Field(default_factory=list)
    payment_method_rows: list[ZahlungsartZeile] = Field(default_factory=list)
    net_income_rows: list[KanalZeile] = Field(default_factory=list)
    # Was der Gast insgesamt noch schuldet — Lodgifys „Geld noch nicht erhalten".
    outstanding_total: float = 0
    # Objekte im Scope, für die im Zeitraum KEINE Buchung vorlag. Lodgify zeigt
    # sie als Zeile mit „—". Ohne diese Liste sähe der Bericht so aus, als wären
    # sie nie ausgewählt worden.
    empty_property_ids: list[str] = Field(default_factory=list)
    # Warum eine Zeile nicht gerechnet werden konnte (fehlender Provisionssatz,
    # nicht zugeordnete Gebühr, fehlender Kurs). Kein stiller Ausschluss und
    # keine erfundene Null (Wurzel 4/5).
    warnungen: list[str] = Field(default_factory=list)
    # Kanäle ohne hinterlegten Provisionssatz — die UI verlinkt damit direkt in
    # die erweiterten Einstellungen, statt den Betrieb suchen zu lassen.
    channels_without_commission: list[str] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class BuchungsAufschluesselung(BaseModel):
    report_id: str
    currency: str
    rows: list[BuchungZeile] = Field(default_factory=list)
    warnungen: list[str] = Field(default_factory=list)
    channels_without_commission: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Zahlung
# ---------------------------------------------------------------------------


class PaymentItem(BaseModel):
    id: str
    abschnitt: Abschnitt
    label: str
    reservation_id: str | None = None
    property_id: str | None = None
    betrag: float
    currency: str
    position: int


class PaymentPart(BaseModel):
    id: str
    betrag: float
    currency: str
    bezahlt_am: date_
    notiz: str | None = None
    created_at: str | None = None


class PaymentPartCreate(BaseModel):
    betrag: float = Field(gt=0)
    bezahlt_am: date_
    notiz: str | None = Field(default=None, max_length=500)


class PaymentCreate(BaseModel):
    """Eine Zahlung aus einem Bericht erzeugen — für GENAU einen Empfänger."""

    owner_id: str


class PaymentUpdate(BaseModel):
    notiz: str | None = Field(default=None, max_length=2000)


class PaymentListItem(BaseModel):
    id: str
    report_id: str
    report_name: str
    owner_id: str
    owner_name: str | None = None
    betrag: float
    currency: str
    # Summe der Teilzahlungen / Betrag × 100. Gerechnet, nie gespeichert.
    bezahlt_pct: float
    bezahlt_am: date_ | None = None
    has_invoice: bool
    statement_id: str | None = None
    created_at: str | None = None


class PaymentListResponse(BaseModel):
    items: list[PaymentListItem]
    total: int


class PaymentDetail(BaseModel):
    id: str
    tenant_id: str
    report_id: str
    report_name: str
    period_from: date_
    period_to: date_
    owner_id: str
    owner_name: str | None = None
    owner_email: str | None = None
    # Die drei Textblöcke, die Lodgify auf der Zahlung zeigt. Sie kommen aus den
    # Eigentümer-Stammdaten und werden hier NUR gelesen — die Pflege bleibt an
    # einer Stelle (/eigentuemer).
    rechtliche_information: str | None = None
    empfaenger_information: str | None = None
    rechnungs_fusszeile: str | None = None
    currency: str
    summe_unterkunftspreis: float
    summe_gebuehren: float
    summe_steuern: float
    summe_ausgaben: float
    summe_andere: float
    betrag: float
    bezahlt_pct: float
    bezahlt_am: date_ | None = None
    notiz: str | None = None
    statement_id: str | None = None
    items: list[PaymentItem] = Field(default_factory=list)
    parts: list[PaymentPart] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


# ---------------------------------------------------------------------------
# Empfänger-Übersicht (Lodgify „Empfänger")
# ---------------------------------------------------------------------------


class WaehrungsBetrag(BaseModel):
    currency: str
    amount: float


class EmpfaengerZeile(BaseModel):
    owner_id: str
    name: str
    email: str | None = None
    payment_count: int
    # Je Währung getrennt: Beträge verschiedener Währungen werden NICHT addiert
    # (Wurzel 4). Eine Mischsumme wäre eine Zahl, die es nicht gibt.
    payment_total: list[WaehrungsBetrag] = Field(default_factory=list)
    property_count: int
    # Gilt heute ein Abrechnungsvertrag? Ohne ihn ist keine Zahlung berechenbar
    # — die Liste sagt das, statt eine leere Zelle zu zeigen.
    hat_vertrag: bool


class EmpfaengerListResponse(BaseModel):
    items: list[EmpfaengerZeile]
    total: int


# ---------------------------------------------------------------------------
# Wiederkehrende Posten
# ---------------------------------------------------------------------------


class RecurringItemBase(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    abschnitt: Abschnitt
    modus: RecurringModus
    betrag: float = Field(gt=0)
    currency: str
    property_id: str | None = None
    aktiv: bool = True
    notiz: str | None = Field(default=None, max_length=2000)

    @field_validator("currency")
    @classmethod
    def _cur(cls, value: str) -> str:
        return _waehrung(value)

    @field_validator("abschnitt")
    @classmethod
    def _kein_steuerposten(cls, value: Abschnitt) -> Abschnitt:
        """`steuern` ist kein Abschnitt für Dauervereinbarungen.

        Eine Steuer folgt dem Steuerrecht des Objekts (`property_taxes`) und
        nicht einer Absprache zwischen Betrieb und Eigentümer. Sie hier
        zuzulassen erzeugte eine zweite, konkurrierende Steuerquelle — und
        damit zwei verschiedene Steuerbeträge für denselben Aufenthalt.
        """
        if value is Abschnitt.steuern:
            raise ValueError(
                "Steuern sind kein wiederkehrender Posten — sie folgen den "
                "Steuersätzen des Objekts."
            )
        return value


class RecurringItemCreate(RecurringItemBase):
    pass


class RecurringItemUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    abschnitt: Abschnitt | None = None
    modus: RecurringModus | None = None
    betrag: float | None = Field(default=None, gt=0)
    currency: str | None = None
    aktiv: bool | None = None
    notiz: str | None = Field(default=None, max_length=2000)
    # Ausdrücklich „gilt wieder für alle Objekte". Ohne dieses Flag wäre ein
    # weggelassenes `property_id` nicht von „nicht ändern" zu unterscheiden.
    property_id: str | None = None
    fuer_alle_objekte: bool = False

    @field_validator("currency")
    @classmethod
    def _cur(cls, value: str | None) -> str | None:
        return None if value is None else _waehrung(value)


class RecurringItemResponse(RecurringItemBase):
    id: str
    owner_id: str
    created_at: str | None = None
    updated_at: str | None = None


class RecurringItemListResponse(BaseModel):
    items: list[RecurringItemResponse]


# ---------------------------------------------------------------------------
# Geplante Berichte
# ---------------------------------------------------------------------------


class ScheduleBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    name_mit_datum: bool = True
    aktiv: bool = True
    rhythmus: Rhythmus = Rhythmus.monat
    am_tag: AmTag = AmTag.erste
    zeitraum: PlanZeitraum = PlanZeitraum.vergangener
    currency: str
    basis: ReportBasis = ReportBasis.check_in
    property_ids: list[str] = Field(default_factory=list)
    recipient_ids: list[str] = Field(default_factory=list)

    @field_validator("currency")
    @classmethod
    def _cur(cls, value: str) -> str:
        return _waehrung(value)

    @model_validator(mode="after")
    def _objekte(self) -> ScheduleBase:
        if not self.property_ids:
            raise ValueError("Mindestens ein Objekt auswählen.")
        return self


class ScheduleCreate(ScheduleBase):
    pass


class ScheduleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    name_mit_datum: bool | None = None
    aktiv: bool | None = None
    rhythmus: Rhythmus | None = None
    am_tag: AmTag | None = None
    zeitraum: PlanZeitraum | None = None
    currency: str | None = None
    basis: ReportBasis | None = None
    property_ids: list[str] | None = None
    recipient_ids: list[str] | None = None

    @field_validator("currency")
    @classmethod
    def _cur(cls, value: str | None) -> str | None:
        return None if value is None else _waehrung(value)


class ScheduleResponse(ScheduleBase):
    id: str
    zuletzt_erzeugt_fuer: date_ | None = None
    created_at: str | None = None
    updated_at: str | None = None


class ScheduleListItem(BaseModel):
    id: str
    name: str
    rhythmus: Rhythmus
    currency: str
    property_count: int
    recipient_count: int
    aktiv: bool
    zuletzt_erzeugt_fuer: date_ | None = None


class ScheduleListResponse(BaseModel):
    items: list[ScheduleListItem]


class ScheduleRunResponse(BaseModel):
    """Ergebnis des Cron-Laufs."""

    geprueft: int
    erzeugt: int
    zahlungen: int


# ---------------------------------------------------------------------------
# Statistik (Lodgify „Bilanzstatistik")
# ---------------------------------------------------------------------------


class StatPunkt(BaseModel):
    """Ein Monat der Zeitreihe „Im Laufe der Zeit gezahltes Geld"."""

    period: str
    amount: float


class StatKategorie(BaseModel):
    """Ein Segment des Donuts „Aufschlüsselung nach Kategorien"."""

    abschnitt: Abschnitt
    amount: float


class StatistikResponse(BaseModel):
    currency: str
    total: float
    # Veränderung zur gleich langen Vorperiode in Prozent. ``None`` = die
    # Vorperiode war 0; ein „+100 %" wäre dort eine Aussage über nichts.
    change_pct: float | None = None
    points: list[StatPunkt] = Field(default_factory=list)
    categories: list[StatKategorie] = Field(default_factory=list)
    # Je Währung eine eigene Auswertung wäre die Alternative; hier steht,
    # welche Währungen im Zeitraum vorkamen, damit die Maske die Mischung
    # benennen kann statt sie zu addieren.
    other_currencies: list[WaehrungsBetrag] = Field(default_factory=list)


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
