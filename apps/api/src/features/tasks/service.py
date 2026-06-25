"""Service-Schicht für tasks (Lastenheft §2.5 + §4.3).

Aufgaben-CRUD, auto-Generierung bei Buchung (Anreise-Check + Endreinigung),
Checklisten mit Foto-Nachweisen, Vertretungs-Feature, Inventar (auch
unterkunftslos). Supabase-Client injiziert → mockbar.
"""
from supabase import Client

from src.core.logging import get_logger

from .schemas import (
    BookingTasksRequest,
    ChecklistItem,
    ChecklistItemCreate,
    ChecklistPhotoCreate,
    InventoryItem,
    InventoryItemCreate,
    SliceHealth,
    Substitution,
    SubstitutionRequest,
    SubstitutionStatus,
    Task,
    TaskCreate,
    TaskStatus,
)

log = get_logger("nextdays.tasks")


class TaskError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class TasksService:
    slice_name = "tasks"

    def __init__(self, client: Client | None = None) -> None:
        self._client = client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise TaskError("Aufgaben-DB nicht verfügbar.", status_code=500)
        return self._client

    # --- Aufgaben ---

    def create_task(self, tenant_id: str, req: TaskCreate) -> Task:
        row = self._insert(
            "tasks",
            {
                "tenant_id": tenant_id,
                "property_id": req.property_id,
                "assignee_id": req.assignee_id,
                "title": req.title,
                "status": TaskStatus.open.value,
                "due_at": req.due_at.isoformat() if req.due_at else None,
            },
        )
        return self._to_task(row)

    def list_tasks(self, tenant_id: str, assignee_id: str | None = None) -> list[Task]:
        q = self._db().table("tasks").select("*").eq("tenant_id", tenant_id)
        if assignee_id is not None:
            q = q.eq("assignee_id", assignee_id)
        res = q.execute()
        return [self._to_task(r) for r in (res.data or [])]

    def set_status(self, tenant_id: str, task_id: str, status: TaskStatus) -> Task:
        res = (
            self._db()
            .table("tasks")
            .update({"status": status.value})
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        return self._to_task(res.data[0])

    # --- Auto-Generierung bei Buchung (§2.5) ---

    def generate_for_booking(
        self, tenant_id: str, req: BookingTasksRequest
    ) -> list[Task]:
        """Anreise-Check am Anreisetag, Endreinigung am Abreisetag."""
        payload = [
            {
                "tenant_id": tenant_id,
                "property_id": req.property_id,
                "reservation_id": req.reservation_id,
                "title": "Anreise-Check/Inspektion",
                "status": TaskStatus.open.value,
                "due_at": req.check_in.isoformat(),
            },
            {
                "tenant_id": tenant_id,
                "property_id": req.property_id,
                "reservation_id": req.reservation_id,
                "title": "Endreinigung",
                "status": TaskStatus.open.value,
                "due_at": req.check_out.isoformat(),
            },
        ]
        res = self._db().table("tasks").insert(payload).execute()
        log.info("tasks_generated_for_booking", reservation_id=req.reservation_id)
        return [self._to_task(r) for r in (res.data or [])]

    def generate_for_addon(
        self,
        tenant_id: str,
        property_id: str,
        reservation_id: str,
        addon_label: str,
        due_at: str,
    ) -> Task | None:
        """Vorbereitungs-Aufgabe bei Kauf einer Zusatzleistung (Trigger
        ``addon_purchased``). Fällig am Anreisetag; ein Task je gekauftem Item.
        Best-effort: Fehler werden geloggt, nicht propagiert (kein Kauf-Abbruch)."""
        try:
            res = (
                self._db()
                .table("tasks")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "reservation_id": reservation_id,
                        "title": f"Zusatzleistung vorbereiten: {addon_label}",
                        "status": TaskStatus.open.value,
                        "due_at": due_at,
                    }
                )
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — Task-Fehler darf Kauf nicht killen
            log.warning("addon_task_failed", reservation_id=reservation_id, error=str(exc))
            return None
        log.info("task_generated_for_addon", reservation_id=reservation_id)
        return self._to_task(res.data[0]) if res.data else None

    # --- Checklisten + Foto-Nachweise (§2.5) ---

    def add_checklist_item(self, req: ChecklistItemCreate) -> ChecklistItem:
        row = self._insert(
            "checklist_items",
            {
                "task_id": req.task_id,
                "label": req.label,
                "room": req.room,
                "sort_order": req.sort_order,
            },
        )
        return ChecklistItem(**{k: row.get(k) for k in ChecklistItem.model_fields})

    def add_checklist_photo(self, req: ChecklistPhotoCreate) -> str:
        """Bildnachweis (unbegrenzt pro Raum) referenzieren. Gibt Foto-ID zurück."""
        row = self._insert(
            "checklist_photos",
            {"item_id": req.item_id, "storage_path": req.storage_path},
        )
        return row["id"]

    # --- Vertretungs-Feature (§4.3) ---

    def request_substitution(
        self, tenant_id: str, user_id: str, req: SubstitutionRequest
    ) -> Substitution:
        """Zugewiesener Mitarbeiter fragt Vertretung für eine Aufgabe an."""
        row = self._insert(
            "task_substitutions",
            {
                "tenant_id": tenant_id,
                "task_id": req.task_id,
                "requested_by": user_id,
                "status": SubstitutionStatus.requested.value,
                "note": req.note,
            },
        )
        log.info("substitution_requested", task_id=req.task_id, by=user_id)
        return Substitution(**{k: row.get(k) for k in Substitution.model_fields})

    def accept_substitution(
        self, tenant_id: str, substitution_id: str, accepted_by: str
    ) -> Substitution:
        res = (
            self._db()
            .table("task_substitutions")
            .update(
                {
                    "status": SubstitutionStatus.accepted.value,
                    "accepted_by": accepted_by,
                }
            )
            .eq("id", substitution_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Vertretungsanfrage nicht gefunden.", status_code=404)
        return Substitution(
            **{k: res.data[0].get(k) for k in Substitution.model_fields}
        )

    # --- Inventar (§2.5) ---

    def add_inventory(self, tenant_id: str, req: InventoryItemCreate) -> InventoryItem:
        row = self._insert(
            "inventory_items",
            {
                "tenant_id": tenant_id,
                "property_id": req.property_id,  # None = zentraler Pool
                "name": req.name,
                "quantity": req.quantity,
            },
        )
        return InventoryItem(**{k: row.get(k) for k in InventoryItem.model_fields})

    # --- intern ---

    def _insert(self, table: str, data: dict[str, object]) -> dict[str, object]:
        res = self._db().table(table).insert(data).execute()
        if not res.data:
            raise TaskError(f"{table}: Anlegen fehlgeschlagen.", status_code=500)
        return res.data[0]

    def _to_task(self, row: dict[str, object]) -> Task:
        return Task(
            id=row["id"],
            tenant_id=row["tenant_id"],
            property_id=row.get("property_id"),
            assignee_id=row.get("assignee_id"),
            title=row["title"],
            status=TaskStatus(row["status"]),
            due_at=row.get("due_at"),
        )
