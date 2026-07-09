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


class SubstitutionStatus(StrEnum):
    requested = "requested"
    accepted = "accepted"
    declined = "declined"


# --- Aufgaben ---

class TaskCreate(BaseModel):
    property_id: str | None = None
    assignee_id: str | None = None
    title: str = Field(min_length=1, max_length=300)
    due_at: datetime | None = None


class Task(BaseModel):
    id: str
    tenant_id: str
    property_id: str | None = None
    reservation_id: str | None = None
    assignee_id: str | None = None
    title: str
    status: TaskStatus
    due_at: datetime | None = None


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


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
    sort_order: int = 0


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


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
