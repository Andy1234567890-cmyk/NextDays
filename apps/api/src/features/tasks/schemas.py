"""Pydantic-Schemas für den tasks-Slice (Lastenheft §2.5 + §4.3).

Bildet das Datenmodell aus Migration 0012 (tasks, checklist, inventory) und 0019
(task_substitutions, staff_property_assignments) ab.
"""
from datetime import date, datetime, time
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field


class TaskStatus(StrEnum):
    """Die Arbeitszustände einer Aufgabe, in der Reihenfolge der Arbeit.

    ``accepted`` (0360, Hostaway-Gleichzug) füllt die Lücke zwischen „liegt da"
    und „ich bin dran": jemand hat die Aufgabe ANGENOMMEN, aber noch nicht
    angefangen. Ohne ihn kann der Betrieb nicht unterscheiden, ob sich schon
    jemand gekümmert hat — die Aufgabe stünde entweder unberührt da oder als
    „in Arbeit", obwohl niemand vor Ort ist.
    """

    open = "open"
    accepted = "accepted"
    in_progress = "in_progress"
    done = "done"
    cancelled = "cancelled"


class InspectionState(StrEnum):
    to_review = "to_review"
    reviewed = "reviewed"


class TaskSource(StrEnum):
    manual = "manual"
    auto = "auto"
    recurring = "recurring"


class TaskRuleKind(StrEnum):
    template = "template"
    auto = "auto"
    recurring = "recurring"


class SubstitutionStatus(StrEnum):
    requested = "requested"
    accepted = "accepted"
    declined = "declined"


# --- Aufgaben ---

class TaskCreate(BaseModel):
    property_id: str | None = None
    assignee_id: str | None = None
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    due_at: datetime | None = None
    # Zeitfenster für die Kalender-Timeline (Balken). Optional; wenn gesetzt,
    # bestimmt start_at die Spalte im Kalender.
    start_at: datetime | None = None
    end_at: datetime | None = None
    reservation_id: str | None = None
    priority: int = 0
    needs_inspection: bool = False


class Task(BaseModel):
    id: str
    tenant_id: str
    property_id: str | None = None
    reservation_id: str | None = None
    assignee_id: str | None = None
    title: str
    status: TaskStatus
    due_at: datetime | None = None
    needs_inspection: bool = False
    inspection_state: InspectionState | None = None
    source: TaskSource = TaskSource.manual
    priority: int = 0
    start_at: datetime | None = None
    end_at: datetime | None = None


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskZeitfensterUpdate(BaseModel):
    """Start- und Endzeitpunkt einer BESTEHENDEN Aufgabe.

    Beide Felder sind Pflicht-Angaben im Sinne von „ausdrücklich gesetzt oder
    ausdrücklich leer": `null` löscht den jeweiligen Zeitpunkt. Ein
    weggelassenes Feld als „unverändert" zu deuten wäre hier die schlechtere
    Wahl — der Aufrufer bearbeitet immer beide Enden zugleich, und ein
    stillschweigend behaltener alter Wert erzeugt genau die Paare, die dieser
    Endpunkt verhindern soll (Ende vor Start).
    """

    start_at: datetime | None = None
    end_at: datetime | None = None


class TaskAssigneeUpdate(BaseModel):
    """Zuständigen einer BESTEHENDEN Aufgabe setzen oder abziehen.

    Bewusst nullable: „niemand zuständig" ist ein gültiger Zielzustand, kein
    fehlender Wert. Wer eine Fehlzuweisung zurücknehmen will, braucht dafür
    einen Weg — sonst bliebe nur, die Aufgabe zu löschen und neu anzulegen.
    """

    assignee_id: str | None = None


class BulkTaskRequest(BaseModel):
    """Auswahl für die Massenaktionen (Abschließen/Löschen). Die Obergrenze
    steht im Service (`TasksService.BULK_MAX`) — Wurzel 8."""

    ids: list[str] = Field(min_length=1, max_length=200)


class TaskAssigneeOption(BaseModel):
    """Ein möglicher Zuständiger für die Auswahlliste.

    Bewusst KEIN `permissions`-Feld: eine Auswahlliste braucht Name, Mail und
    Rolle — die Rechte fremder Konten auszuliefern wäre Aufklärung für eine
    Rechteausweitung (Wurzel 9).

    `email` ist drin, weil Namen sich doppeln: im Beta-Betrieb tragen zwei
    Konten „Torsten Ågaard". Ohne Unterscheidungsmerkmal wählt man blind.
    """

    user_id: str
    full_name: str | None = None
    email: str | None = None
    role: str


class BulkAssignRequest(BulkTaskRequest):
    """Mehrere Aufgaben auf einmal zuweisen (Team-Liste, Mehrfachauswahl)."""

    assignee_id: str | None = None


# --- angereicherte Sichten (Team/Kalender) ---
# Objekt-/Assignee-Namen für Team- und Kalender-Ansicht. KEINE Gast-PII/Beträge
# (Housekeeping-Masking, CLAUDE.md Wurzel 3 / §4.3): der cleaner sieht nur Objekt
# und Zeitfenster, nie Gastname/Kontakt/Betrag.

class TaskListItem(Task):
    property_title: str | None = None
    assignee_name: str | None = None
    # Anzeige-Referenz der Buchung (Portal-Referenz, sonst Kurz-ID). Kein
    # Gastname, kein Betrag — die Spalte sieht auch die Reinigungskraft (§4.3).
    reservation_ref: str | None = None
    checklist_total: int = 0
    checklist_done: int = 0


class CalendarBooking(BaseModel):
    """Ein Buchungs-Balken der Kalender-Timeline (progress-booking-bar).
    KEINE Beträge/Gast-PII — nur Kanal, Gästezahl und Zeitraum (§4.3)."""

    id: str
    property_id: str
    channel: str
    ota_name: str | None = None
    guests: int = 1
    adults: int = 1
    children: int = 0
    check_in: str  # ISO-Datum
    check_out: str
    status: str


class TaskCalendarRow(BaseModel):
    """Eine Objektzeile der Kalender-Timeline mit Aufgaben- und Buchungs-Balken."""

    property_id: str | None = None
    property_title: str
    # Die Zeitzone des OBJEKTS. Sie muss mitgehen, weil `start_at`/`due_at`
    # UTC-Zeitstempel sind, deren Kalendertag in der Objekt-Zone definiert ist
    # (`engine.py::_at`). Ohne sie müsste die Oberfläche den Tag aus der Zone
    # des BEDIENERS ableiten — eine Agentur in Kopenhagen sähe die Aufgaben
    # eines Objekts auf Teneriffa dann eine Spalte verschoben. `None` = keine
    # gepflegte Zone, dann gilt UTC (dieselbe Auskunft wie in `_at`).
    timezone: str | None = None
    tasks: list[TaskListItem] = Field(default_factory=list)
    bookings: list[CalendarBooking] = Field(default_factory=list)


class TaskCalendarResponse(BaseModel):
    rows: list[TaskCalendarRow] = Field(default_factory=list)


# --- Inspektion (§ QA-Workflow) ---

class InspectionItem(TaskListItem):
    photos: list[str] = Field(default_factory=list)  # Storage-Pfade der Nachweise


class InspectionDecision(BaseModel):
    approved: bool
    note: str | None = None


# --- Checklisten + Foto-Nachweise (§2.5) ---

class ChecklistItemCreate(BaseModel):
    task_id: str
    label: str = Field(min_length=1, max_length=300)
    room: str | None = None
    sort_order: int = 0


class ChecklistItem(BaseModel):
    id: str
    task_id: str
    label: str
    room: str | None = None
    done: bool = False
    requires_photo: bool = False
    sort_order: int = 0
    # Storage-PFADE (die Wahrheit im privaten Bucket) …
    photos: list[str] = Field(default_factory=list)
    # … und dieselben Bilder als kurzlebig SIGNIERTE URLs. Zwei Felder, weil
    # beides gebraucht wird: der Pfad ist der stabile Verweis (Abschluss-Prüfung,
    # Löschen), die URL ist das, was eine Oberfläche anzeigen kann. Ohne sie sah
    # die ausführende Person ihren eigenen Nachweis nie — nur einen Zähler.
    photo_urls: list[str] = Field(default_factory=list)
    # Spur hinter dem Haken (0360): WANN und von WEM. Beim Reinigungsnachweis
    # ist genau das die Frage — vor Ort abgehakt oder nachträglich im Büro.
    # Altbestand trägt beides `None`: vor 0360 gab es keinen Weg zum Abhaken.
    done_at: datetime | None = None
    done_by: str | None = None
    done_by_name: str | None = None


class ChecklistItemToggle(BaseModel):
    """Einen Checklisten-Punkt abhaken oder das Häkchen zurücknehmen.

    Bewusst mit explizitem `done` statt eines Umschalters: zwei Geräte, die
    denselben Punkt gleichzeitig antippen, würden sich sonst gegenseitig
    zurücksetzen (Wurzel 2). So gewinnt der zuletzt gesendete ZUSTAND, und ein
    Retry desselben Aufrufs ändert nichts.
    """

    done: bool


class ChecklistPhotoCreate(BaseModel):
    item_id: str
    storage_path: str = Field(min_length=1)  # Supabase Storage Key (unbegrenzt/Raum)


# --- Kosten & Abschluss-Rückmeldung (0360, Hostaway-Gleichzug) --------------


class TaskCostCreate(BaseModel):
    """Eine Auslage zu einer Aufgabe.

    KEINE Währung im Request: sie kommt aus den Daten (Objektwährung, sonst
    Betriebswährung). Der Client könnte sie sonst frei setzen und damit eine
    Auslage in einer Währung buchen, die zum Objekt nicht passt — die spätere
    Summe wäre eine Zahl ohne Bedeutung (Wurzel 4).
    """

    amount: Decimal = Field(ge=0, le=Decimal("999999.99"), decimal_places=2)
    note: str | None = Field(default=None, max_length=500)


class TaskCost(BaseModel):
    id: str
    task_id: str
    amount: Decimal
    currency: str
    note: str | None = None
    created_by: str | None = None
    created_by_name: str | None = None
    created_at: datetime | None = None


class TaskResolutionUpsert(BaseModel):
    """Abschluss-Rückmeldung: „wie ist es gelaufen" plus optionale Note.

    Beides optional, aber nicht beides leer — eine Rückmeldung ohne Inhalt
    behauptet, es gäbe eine Einschätzung (die DB hält dagegen ebenfalls einen
    CHECK). Die NOTE darf nur die Konto-Führung setzen: eine Selbstbenotung der
    zuständigen Person wäre wertlos.
    """

    note: str | None = Field(default=None, max_length=2000)
    score: int | None = Field(default=None, ge=1, le=5)


class TaskResolution(BaseModel):
    task_id: str
    note: str | None = None
    score: int | None = None
    created_by: str | None = None
    created_by_name: str | None = None
    updated_at: datetime | None = None


# --- Vertretungs-Feature (§4.3) ---

class SubstitutionRequest(BaseModel):
    task_id: str
    note: str | None = None


class Substitution(BaseModel):
    id: str
    task_id: str
    requested_by: str
    accepted_by: str | None = None
    status: SubstitutionStatus
    note: str | None = None


class SubstitutionListItem(Substitution):
    """Eine offene Anfrage, wie sie ein möglicher Vertreter sieht.

    Ohne Titel und Objekt ist eine Anfrage nicht entscheidbar — „willst du
    Aufgabe 8f3c… übernehmen?" beantwortet niemand. Kein Gast-Name, kein
    Betrag (§4.3).
    """

    title: str
    property_title: str | None = None
    property_id: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    requested_by_name: str | None = None


# --- Inventar (§2.5, auch unterkunftslos) ---

class InventoryItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(ge=0, default=0)
    property_id: str | None = None  # None = zentraler Pool (Lager/Büro)


class InventoryItem(BaseModel):
    id: str
    tenant_id: str
    property_id: str | None = None
    name: str
    quantity: int


# --- Aufgabenvorlagen / Regeln (task_rules, kind=template|auto|recurring) ---
# recurrence bleibt jsonb (Bestand 0012): frei strukturiertes Zeitplan-Regelwerk.
# Der Service liefert zusätzlich ein menschenlesbares schedule_label.

class RuleItem(BaseModel):
    """Checklist-Vorlagen-Item einer Regel (task_rule_items)."""

    id: str | None = None
    label: str = Field(min_length=1, max_length=300)
    description: str | None = None
    room: str | None = None
    requires_photo: bool = False
    sort_order: int = 0


class TaskDetail(TaskListItem):
    """Das Detail einer Aufgabe.

    Erbt von `TaskListItem` und nicht von `Task`: `get_detail` baut die Antwort
    ohnehin aus der angereicherten Zeile, aber die schmalere Basis hat
    `reservation_ref` und die Checklisten-Zähler stillschweigend VERWORFEN —
    die Detailansicht wusste deshalb nichts von der Buchung, obwohl die Liste
    daneben ihre Referenz zeigte.
    """

    checklist: list[ChecklistItem] = Field(default_factory=list)
    # Der Zeitraum der Buchung, an der die Aufgabe hängt. NUR Kalendertage —
    # kein Gastname, kein Betrag (§4.3): „der Gast reist am 22. ab" ist genau
    # die Information, wegen der eine Reinigung terminiert wird, und sie fehlte
    # der ausführenden Person komplett.
    reservation_check_in: str | None = None
    reservation_check_out: str | None = None
    # Auslagen (0360). Für staff/cleaner NUR die selbst erfassten: seine eigene
    # Auslage einzutragen ist etwas anderes, als die Auslagen des Betriebs zu
    # lesen (§4.3). Der Dienst filtert, nicht die Oberfläche.
    costs: list[TaskCost] = Field(default_factory=list)
    # Währung, in der eine NEUE Auslage gebucht würde (Objekt-, sonst
    # Betriebswährung). `None` heißt ehrlich „für dieses Objekt ist keine
    # Währung hinterlegt" — die Oberfläche blendet das Kostenfeld dann aus,
    # statt ein Feld anzubieten, dessen Speichern mit 422 endet (Wurzel 4).
    cost_currency: str | None = None
    resolution: TaskResolution | None = None


class TaskTrigger(StrEnum):
    """Zeitanker einer planmäßigen Regel relativ zur Reservierung (0272).

    Die Feinjustierung steckt immer in `start_offset_minutes`/`end_offset_minutes`
    — bei ``days_before_check_in`` trägt sie die ganze Distanz. Bei den beiden
    Tages-Ankern ``arrival_day``/``departure_day`` (0535) traegt stattdessen
    ``start_clock``/``end_clock`` die Uhrzeit.
    """

    booking_confirmed = "booking_confirmed"
    check_in = "check_in"
    after_check_in_24h = "after_check_in_24h"
    check_out = "check_out"
    days_before_check_in = "days_before_check_in"
    days_after_check_out = "days_after_check_out"
    # Die beiden TAGES-Anker (0535). Unterschied zu `check_in`/`check_out`: die
    # haengen an der Uhrzeit der Buchung, diese am Datum — die Uhrzeit kommt
    # dann aus `start_clock`/`end_clock` der Regel.
    arrival_day = "arrival_day"
    departure_day = "departure_day"


class RuleCreate(BaseModel):
    kind: TaskRuleKind
    name: str = Field(min_length=1, max_length=300)
    description: str | None = None
    # In welcher Sprache `name`/`description` verfasst sind (0511). Der
    # Uebersetzungslauf braucht die AUSGANGSSPRACHE; sie aus dem Text zu raten
    # ist bei betriebsinternen Kuerzeln („Reng T", „Velk J") nicht moeglich —
    # und ein Default waere nachweislich falsch: derselbe Betrieb fuehrt live
    # deutsche UND daenische Regelnamen nebeneinander (31.08.2026). `None`
    # heisst ehrlich „unbekannt": die Regel wird nicht uebersetzt, statt eine
    # plausible Falschuebersetzung zu erzeugen (Wurzel 4).
    quellsprache: str | None = Field(default=None, min_length=2, max_length=5)
    active: bool = True
    priority: int = Field(default=0, ge=0, le=5)
    assignee_id: str | None = None
    needs_inspection: bool = False
    remove_on_cancellation: bool = True
    # Zeitplan/Trigger-Regelwerk (frei, kind-abhängig ausgewertet).
    recurrence: dict[str, object] = Field(default_factory=dict)
    property_ids: list[str] = Field(default_factory=list)
    items: list[RuleItem] = Field(default_factory=list)

    # Verweis auf die Aufgabenvorlage, deren Punkte materialisiert werden.
    # None = die Regel trägt ihre Punkte selbst (`items`).
    template_rule_id: str | None = None

    # kind='auto': Anker an der Reservierung.
    start_trigger: TaskTrigger | None = None
    end_trigger: TaskTrigger | None = None
    start_offset_minutes: int = Field(default=0, ge=-525_600, le=525_600)
    end_offset_minutes: int = Field(default=0, ge=-525_600, le=525_600)
    # Uhrzeitfenster der Aufgabe an einem TAGES-Anker (0535). Wirkt nur bei
    # `arrival_day`/`departure_day`; bei den Uhrzeit-Ankern bleibt die Zeit der
    # Buchung massgeblich. None = keine Uhrzeit gepflegt, der Motor setzt dann
    # den Tagesbeginn statt einer erfundenen Standardstunde (Wurzel 4).
    start_clock: time | None = None
    end_clock: time | None = None

    # kind='recurring': Kalenderfenster, Uhrzeit, geschätzte Dauer.
    starts_on: date | None = None
    ends_on: date | None = None
    start_time: time | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=43_200)


class RuleUpdate(RuleCreate):
    pass


class RuleListItem(BaseModel):
    id: str
    kind: TaskRuleKind
    name: str
    active: bool
    priority: int
    assignee_id: str | None = None
    assignee_name: str | None = None
    needs_inspection: bool
    item_count: int = 0
    property_ids: list[str] = Field(default_factory=list)
    schedule_label: str | None = None  # menschenlesbar, nur bei recurring/auto
    updated_at: datetime | None = None


class UngedecktesObjekt(BaseModel):
    """Ein Objekt, für das keine wirksame planmäßige Regel greift."""

    property_id: str
    property_title: str
    ohne_anreise: bool
    ohne_abreise: bool


class RegelDeckung(BaseModel):
    """Wie viele Objekte planmäßige Aufgaben bekommen — und welche nicht.

    Der Grund für diesen Endpunkt: eine Regel gilt für ALLE Objekte, solange
    ihr keins ausdrücklich zugeordnet ist — sobald aber EINES zugeordnet ist,
    gilt sie nur noch für die gelisteten. Ein danach angelegtes Objekt fällt
    still heraus: es bekommt keine Anreise- und keine Reinigungsaufgabe, und
    nichts in der Oberfläche sagt das. Live traf das 2 von 19 Objekten.
    """

    objekte: int
    ohne_anreise: int
    ohne_abreise: int
    betroffen: list[UngedecktesObjekt] = Field(default_factory=list)


class RuleDetail(RuleListItem):
    description: str | None = None
    # In welcher Sprache Name und Beschreibung verfasst sind (0511). None =
    # unbekannt (Altbestand): die Regel wird nicht uebersetzt, und die
    # Oberflaeche kann genau das anzeigen statt es zu verschweigen.
    quellsprache: str | None = None
    remove_on_cancellation: bool = True
    recurrence: dict[str, object] = Field(default_factory=dict)
    items: list[RuleItem] = Field(default_factory=list)
    template_rule_id: str | None = None
    template_name: str | None = None  # Anzeigename der verknüpften Vorlage
    start_trigger: TaskTrigger | None = None
    end_trigger: TaskTrigger | None = None
    start_offset_minutes: int = 0
    end_offset_minutes: int = 0
    start_clock: time | None = None
    end_clock: time | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    start_time: time | None = None
    duration_minutes: int | None = None


class TaskCompletePayload(BaseModel):
    """Abschluss einer Aufgabe. Alle requires_photo-Items MÜSSEN ein Foto haben,
    sonst 422 (Foto-Pflicht). Der Service prüft gegen checklist_items/-photos."""

    note: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"

# --- Preise beauftragbarer Dienstleistungen (0531) --------------------------


class DienstleistungPreis(BaseModel):
    """Ein gepflegter Preis: Betriebsregel (`property_id=None`) oder Ausnahme."""

    id: str
    service_type_id: str
    property_id: str | None = None
    amount: float
    currency: str
    note: str | None = None


class DienstleistungPreisSetzen(BaseModel):
    """Preis anlegen/aendern. Waehrung PFLICHT — nie ein Default (Wurzel 4):
    der Betrieb kann in DKK fuehren und Objekte in EUR haben."""

    service_type_id: str
    # None = Regel fuer alle Objekte; gesetzt = Ausnahme fuer genau eines.
    property_id: str | None = None
    amount: Decimal = Field(ge=0, le=1_000_000)
    currency: str = Field(min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$")
    note: str | None = Field(default=None, max_length=500)


class DienstleistungPreisListe(BaseModel):
    """Die Preise plus der Katalog: ein Typ OHNE Preis muss sichtbar bleiben —
    genau dort bleibt eine ausgefuehrte Leistung unberechnet."""

    preise: list[DienstleistungPreis] = Field(default_factory=list)
    typen: list[dict[str, object]] = Field(default_factory=list)
