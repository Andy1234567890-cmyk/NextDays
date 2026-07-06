"""Service-Schicht für tasks (Lastenheft §2.5 + §4.3).

Aufgaben-CRUD, auto-Generierung bei Buchung (Anreise-Check + Endreinigung),
Checklisten mit Foto-Nachweisen, Vertretungs-Feature, Inventar (auch
unterkunftslos). Supabase-Client injiziert → mockbar.
"""
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.auth.staff_scope import is_staff, staff_property_ids

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

    def list_tasks(
        self,
        tenant_id: str,
        assignee_id: str | None = None,
        ctx: AuthContext | None = None,
    ) -> list[Task]:
        q = self._db().table("tasks").select("*").eq("tenant_id", tenant_id)
        if assignee_id is not None:
            q = q.eq("assignee_id", assignee_id)
        res = q.execute()
        tasks = [self._to_task(r) for r in (res.data or [])]
        # Defense-in-depth (§4.3): ein Mitarbeiter sieht objektgebundene Aufgaben
        # nur an seinen freigegebenen Objekten (staff_property_assignments), selbst
        # wenn ihm versehentlich eine Aufgabe an einem nicht freigegebenen Objekt
        # zugewiesen wurde. Pool-Aufgaben ohne Objektbezug (property_id=None,
        # z. B. Lager/Büro) bleiben sichtbar. Fail-closed bei objektgebundenen.
        if ctx is not None and is_staff(ctx):
            allowed = staff_property_ids(self._db(), ctx)
            tasks = [
                t
                for t in tasks
                if t.property_id is None or t.property_id in allowed
            ]
        return tasks

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

    def _require_own_task(self, tenant_id: str, task_id: str) -> None:
        """Die Aufgabe MUSS dem Tenant gehören. checklist_items/-photos tragen
        keine tenant_id (Migration 0012) — der Service läuft mit service_role
        (RLS umgangen), also ist dieser explizite Check der EINZIGE Cross-Tenant-
        Schutz: sonst könnte ein Mitarbeiter mit einer erratenen fremden task_id
        Einträge an fremde Aufgaben schreiben (IDOR)."""
        owned = (
            self._db()
            .table("tasks")
            .select("id")
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not owned:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)

    def _require_own_checklist_item(self, tenant_id: str, item_id: str) -> None:
        """Das Checklist-Item MUSS über seine Aufgabe zum Tenant gehören."""
        item = (
            self._db()
            .table("checklist_items")
            .select("task_id")
            .eq("id", item_id)
            .limit(1)
            .execute()
        ).data
        if not item:
            raise TaskError("Checklisten-Eintrag nicht gefunden.", status_code=404)
        self._require_own_task(tenant_id, str(item[0]["task_id"]))

    def add_checklist_item(
        self, tenant_id: str, req: ChecklistItemCreate
    ) -> ChecklistItem:
        self._require_own_task(tenant_id, req.task_id)
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

    def add_checklist_photo(self, tenant_id: str, req: ChecklistPhotoCreate) -> str:
        """Bildnachweis (unbegrenzt pro Raum) referenzieren. Gibt Foto-ID zurück."""
        self._require_own_checklist_item(tenant_id, req.item_id)
        row = self._insert(
            "checklist_photos",
            {"item_id": req.item_id, "storage_path": req.storage_path},
        )
        return row["id"]

    # --- Vertretungs-Feature (§4.3) ---

    def request_substitution(
        self, tenant_id: str, user_id: str, req: SubstitutionRequest
    ) -> Substitution:
        """Zugewiesener Mitarbeiter fragt Vertretung für eine Aufgabe an.

        §4.3: NUR der zugewiesene Mitarbeiter darf eine Vertretung anfragen. Ohne
        diesen Check könnte ein Mitarbeiter Vertretung für fremde/nicht zugewiesene
        Aufgaben erzeugen, die ein Kollege dann übernimmt (Umgehung der Zuweisung).
        Der Service läuft mit service_role (RLS umgangen) → Check hier zwingend."""
        task = (
            self._db()
            .table("tasks")
            .select("id, assignee_id")
            .eq("id", req.task_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not task:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        if str(task[0].get("assignee_id") or "") != user_id:
            raise TaskError(
                "Nur der zugewiesene Mitarbeiter kann eine Vertretung anfragen.",
                status_code=403,
            )
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
