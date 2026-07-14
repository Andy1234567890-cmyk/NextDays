"""Pydantic-Schemas für den tasks-Slice (Lastenheft §2.5 + §4.3).

Bildet das Datenmodell aus Migration 0012 (tasks, checklist, inventory) und 0019
(task_substitutions, staff_property_assignments) ab.
"""
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class TaskStatus(StrEnum):
    open = "open"
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


# --- angereicherte Sichten (Team/Kalender) ---
# Objekt-/Assignee-Namen für Team- und Kalender-Ansicht. KEINE Gast-PII/Beträge
# (Housekeeping-Masking, CLAUDE.md Wurzel 3 / §4.3): der cleaner sieht nur Objekt
# und Zeitfenster, nie Gastname/Kontakt/Betrag.

class TaskListItem(Task):
    property_title: str | None = None
    assignee_name: str | None = None
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


# --- Auto-Generierung bei Buchung (§2.5) ---

class BookingTasksRequest(BaseModel):
    """Erzeugt aus einer Reservierung die Standard-Aufgaben:
    Anreise-Check am check_in, Endreinigung am check_out."""

    reservation_id: str
    property_id: str
    check_in: datetime
    check_out: datetime


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
    photos: list[str] = Field(default_factory=list)


class ChecklistPhotoCreate(BaseModel):
    item_id: str
    storage_path: str = Field(min_length=1)  # Supabase Storage Key (unbegrenzt/Raum)


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


class TaskDetail(Task):
    property_title: str | None = None
    assignee_name: str | None = None
    checklist: list[ChecklistItem] = Field(default_factory=list)


class RuleCreate(BaseModel):
    kind: TaskRuleKind
    name: str = Field(min_length=1, max_length=300)
    description: str | None = None
    active: bool = True
    priority: int = 0
    assignee_id: str | None = None
    needs_inspection: bool = False
    remove_on_cancellation: bool = True
    # Zeitplan/Trigger-Regelwerk (frei, kind-abhängig ausgewertet).
    recurrence: dict[str, object] = Field(default_factory=dict)
    property_ids: list[str] = Field(default_factory=list)
    items: list[RuleItem] = Field(default_factory=list)


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


class RuleDetail(RuleListItem):
    description: str | None = None
    remove_on_cancellation: bool = True
    recurrence: dict[str, object] = Field(default_factory=dict)
    items: list[RuleItem] = Field(default_factory=list)


class TaskCompletePayload(BaseModel):
    """Abschluss einer Aufgabe. Alle requires_photo-Items MÜSSEN ein Foto haben,
    sonst 422 (Foto-Pflicht). Der Service prüft gegen checklist_items/-photos."""

    note: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
