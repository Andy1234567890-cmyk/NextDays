"""Service-Schicht für tasks (Lastenheft §2.5 + §4.3).

Aufgaben-CRUD, auto-Generierung bei Buchung (Anreise-Check + Endreinigung),
Checklisten mit Foto-Nachweisen, Vertretungs-Feature, Inventar (auch
unterkunftslos). Supabase-Client injiziert → mockbar.
"""
import secrets

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.auth.staff_scope import is_staff, staff_property_ids

from .schedule_label import schedule_label
from .schemas import (
    BookingTasksRequest,
    CalendarBooking,
    ChecklistItem,
    ChecklistItemCreate,
    ChecklistPhotoCreate,
    InspectionDecision,
    InspectionItem,
    InspectionState,
    InventoryItem,
    InventoryItemCreate,
    RuleCreate,
    RuleDetail,
    RuleItem,
    RuleListItem,
    RuleUpdate,
    SliceHealth,
    Substitution,
    SubstitutionRequest,
    SubstitutionStatus,
    Task,
    TaskCalendarResponse,
    TaskCalendarRow,
    TaskCreate,
    TaskDetail,
    TaskListItem,
    TaskRuleKind,
    TaskSource,
    TaskStatus,
)

log = get_logger("nextdays.tasks")

# Foto-Upload (Checklisten-Nachweise → privater Bucket task-photos).
_TASK_PHOTO_BUCKET = "task-photos"
_PHOTO_MAX_BYTES = 20 * 1024 * 1024
_PHOTO_MIME = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


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
        # FK-Ziele müssen dem Tenant gehören (Wurzel 3).
        if req.property_id:
            self._require_own_properties(tenant_id, [req.property_id])
        self._require_own_assignee(tenant_id, req.assignee_id)
        row = self._insert(
            "tasks",
            {
                "tenant_id": tenant_id,
                "property_id": req.property_id,
                "assignee_id": req.assignee_id,
                "reservation_id": req.reservation_id,
                "title": req.title,
                "description": req.description,
                "status": TaskStatus.open.value,
                "due_at": req.due_at.isoformat() if req.due_at else None,
                "start_at": req.start_at.isoformat() if req.start_at else None,
                "end_at": req.end_at.isoformat() if req.end_at else None,
                "priority": req.priority,
                "needs_inspection": req.needs_inspection,
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

    def list_by_reservation(
        self, tenant_id: str, reservation_id: str
    ) -> list[Task]:
        """Aufgaben zu einer Buchung (PM-Detailseite). Tenant-scoped: der
        Service läuft mit service_role (RLS umgangen), also filtert der explizite
        tenant_id-Filter fremde Aufgaben aus (Wurzel 3). Die reservation_id ist
        zusätzlich gebunden — keine ungescopte Roh-Abfrage per ID."""
        res = (
            self._db()
            .table("tasks")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .order("due_at")
            .execute()
        )
        return [self._to_task(r) for r in (res.data or [])]

    def delete_task(self, tenant_id: str, task_id: str) -> None:
        """Aufgabe löschen (Kalender-Popup). Tenant-scoped (Wurzel 3)."""
        res = (
            self._db()
            .table("tasks")
            .delete()
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)

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

    def upload_task_photo(
        self, tenant_id: str, task_id: str, content: bytes, content_type: str
    ) -> str:
        """Foto direkt an einer Aufgabe (ohne konkretes Checklisten-Item).
        Housekeeping-Nachweis („Foto vom sauberen Zimmer"). Legt bei Bedarf EIN
        Sammel-Item ('Fotos') an und hängt das Foto dort ein — so erscheint es
        im Bilder-Modul als Buchungsbild. IDOR-Guard über tenant."""
        self._require_own_task(tenant_id, task_id)
        item_id = self._ensure_photo_item(task_id)
        return self.upload_checklist_photo(tenant_id, item_id, content, content_type)

    def _ensure_photo_item(self, task_id: str) -> str:
        """Sammel-Item 'Fotos' der Aufgabe — vorhandenes wiederverwenden
        (Idempotenz, Wurzel 2), sonst anlegen."""
        existing = (
            self._db()
            .table("checklist_items")
            .select("id")
            .eq("task_id", task_id)
            .eq("label", "Fotos")
            .limit(1)
            .execute()
        ).data
        if existing:
            return existing[0]["id"]
        row = self._insert(
            "checklist_items",
            {"task_id": task_id, "label": "Fotos", "requires_photo": True},
        )
        return row["id"]

    def upload_checklist_photo(
        self, tenant_id: str, item_id: str, content: bytes, content_type: str
    ) -> str:
        """Foto-Datei zu einem Checklisten-Punkt hochladen (privater Bucket
        task-photos) und in checklist_photos referenzieren. IDOR-Guard über die
        Item→Task→Tenant-Kette (Wurzel 3). Typ/Größe serverseitig prüfen."""
        self._require_own_checklist_item(tenant_id, item_id)
        ext = _PHOTO_MIME.get(content_type)
        if not ext:
            raise TaskError("Nur JPEG/PNG/WebP erlaubt.", status_code=415)
        if not content:
            raise TaskError("Bild ist leer.", status_code=413)
        if len(content) > _PHOTO_MAX_BYTES:
            raise TaskError("Bild ist zu groß (max. 20 MB).", status_code=413)
        name = secrets.token_hex(8)
        path = f"{tenant_id}/{item_id}/{name}.{ext}"
        try:
            self._db().storage.from_(_TASK_PHOTO_BUCKET).upload(
                path, content, {"content-type": content_type}
            )
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich als 502
            log.warning("checklist_photo_upload_failed", item_id=item_id, error=str(exc))
            raise TaskError("Upload fehlgeschlagen.", status_code=502) from exc
        row = self._insert(
            "checklist_photos",
            {"item_id": item_id, "storage_path": path},
        )
        log.info("checklist_photo_uploaded", tenant_id=tenant_id, item_id=item_id)
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

    # --- angereicherte Sichten: Team, Kalender, Detail ---

    def _property_titles(self, tenant_id: str, ids: set[str]) -> dict[str, str]:
        """Objekt-Titel im Batch. Tenant-scoped (Service-Role umgeht RLS)."""
        clean = {i for i in ids if i}
        if not clean:
            return {}
        res = (
            self._db()
            .table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .in_("id", list(clean))
            .execute()
        )
        return {r["id"]: r.get("title") or "" for r in (res.data or [])}

    def _user_names(self, tenant_id: str, ids: set[str]) -> dict[str, str]:
        """Anzeigenamen der Assignees im Batch. Nur Name — keine PII/Kontakt."""
        clean = {i for i in ids if i}
        if not clean:
            return {}
        res = (
            self._db()
            .table("users")
            .select("id, full_name")
            .eq("tenant_id", tenant_id)
            .in_("id", list(clean))
            .execute()
        )
        return {r["id"]: r.get("full_name") or "" for r in (res.data or [])}

    def _checklist_counts(self, task_ids: set[str]) -> dict[str, tuple[int, int]]:
        """(total, done) je Task. checklist_items trägt keine tenant_id — die
        task_ids sind bereits tenant-gefiltert übergeben (Wurzel 3)."""
        clean = {i for i in task_ids if i}
        if not clean:
            return {}
        res = (
            self._db()
            .table("checklist_items")
            .select("task_id, done")
            .in_("task_id", list(clean))
            .execute()
        )
        counts: dict[str, tuple[int, int]] = {}
        for r in res.data or []:
            tid = r["task_id"]
            total, done = counts.get(tid, (0, 0))
            counts[tid] = (total + 1, done + (1 if r.get("done") else 0))
        return counts

    def _enrich(
        self, tenant_id: str, tasks: list[Task]
    ) -> list[TaskListItem]:
        """Reichert Tasks um Objekt-/Assignee-Namen + Checklist-Zähler an.
        KEINE Gast-PII/Beträge (Housekeeping-Masking, §4.3)."""
        pids = {t.property_id for t in tasks if t.property_id}
        aids = {t.assignee_id for t in tasks if t.assignee_id}
        titles = self._property_titles(tenant_id, pids)
        names = self._user_names(tenant_id, aids)
        counts = self._checklist_counts({t.id for t in tasks})
        items: list[TaskListItem] = []
        for t in tasks:
            total, done = counts.get(t.id, (0, 0))
            items.append(
                TaskListItem(
                    **t.model_dump(),
                    property_title=titles.get(t.property_id or ""),
                    assignee_name=names.get(t.assignee_id or ""),
                    checklist_total=total,
                    checklist_done=done,
                )
            )
        return items

    def list_team_tasks(
        self,
        tenant_id: str,
        status_bucket: str | None = None,
        property_id: str | None = None,
        assignee_id: str | None = None,
    ) -> list[TaskListItem]:
        """Alle Aufgaben des Tenants mit Assignee (MANAGE_TASKS)."""
        q = self._db().table("tasks").select("*").eq("tenant_id", tenant_id)
        if property_id:
            q = q.eq("property_id", property_id)
        if assignee_id:
            q = q.eq("assignee_id", assignee_id)
        rows = [self._to_task(r) for r in (q.order("start_at").execute().data or [])]
        rows = self._filter_bucket(rows, status_bucket)
        return self._enrich(tenant_id, rows)

    @staticmethod
    def _filter_bucket(tasks: list[Task], bucket: str | None) -> list[Task]:
        """current|upcoming|done → Statusfilter für die Meine/Team-Tabs."""
        if bucket == "done":
            return [t for t in tasks if t.status == TaskStatus.done]
        if bucket == "current":
            return [t for t in tasks if t.status == TaskStatus.in_progress]
        if bucket == "upcoming":
            return [t for t in tasks if t.status == TaskStatus.open]
        return tasks

    def calendar(
        self,
        tenant_id: str,
        month_from: str,
        month_to: str,
        assignee_id: str | None = None,
    ) -> TaskCalendarResponse:
        """Kalender-Timeline: ALLE Objekte als Zeilen (auch leere)
        plus eine 'Verschiedene'-Zeile für objektlose Aufgaben. Je Zeile die
        Aufgaben- und Buchungs-Balken im Zeitraum."""
        tasks = self._calendar_tasks(tenant_id, month_from, month_to, assignee_id)
        bookings = self._calendar_bookings(tenant_id, month_from, month_to)
        # Alle Objekte des Tenants als Grundgerüst (sortiert nach Titel), damit
        # auch Objekte ohne Aufgaben/Buchungen eine Zeile bekommen.
        props = (
            self._db()
            .table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .order("title")
            .execute()
        ).data or []

        rows: list[TaskCalendarRow] = []
        # 'Verschiedene' (objektlose Aufgaben) immer zuerst.
        misc_tasks = [t for t in tasks if not t.property_id]
        rows.append(
            TaskCalendarRow(
                property_id=None, property_title="Verschiedene", tasks=misc_tasks
            )
        )
        for p in props:
            pid = p["id"]
            rows.append(
                TaskCalendarRow(
                    property_id=pid,
                    property_title=p.get("title") or "",
                    tasks=[t for t in tasks if t.property_id == pid],
                    bookings=[b for b in bookings if b.property_id == pid],
                )
            )
        return TaskCalendarResponse(rows=rows)

    def _calendar_tasks(
        self,
        tenant_id: str,
        month_from: str,
        month_to: str,
        assignee_id: str | None,
    ) -> list[TaskListItem]:
        """Aufgaben, deren Anzeige-Zeitpunkt (start_at ODER Fälligkeit due_at)
        im Monat liegt. PostgREST kann kein coalesce im Filter → breit laden,
        dann in Python auf das effektive Datum filtern (Altdaten haben nur
        due_at, kein start_at — sonst fielen sie aus der Timeline)."""
        q = self._db().table("tasks").select("*").eq("tenant_id", tenant_id)
        if assignee_id:
            q = q.eq("assignee_id", assignee_id)
        rows = [self._to_task(r) for r in (q.execute().data or [])]
        picked = [
            t
            for t in rows
            if (t.start_at or t.due_at)
            and month_from <= (t.start_at or t.due_at).isoformat() <= month_to
        ]
        picked.sort(key=lambda t: (t.start_at or t.due_at))
        return self._enrich(tenant_id, picked)

    def _calendar_bookings(
        self, tenant_id: str, month_from: str, month_to: str
    ) -> list[CalendarBooking]:
        """Buchungen, die den Zeitraum überlappen (check_in < to AND
        check_out > from). Tenant-scoped; keine Beträge/Gast-PII (§4.3)."""
        rows = (
            self._db()
            .table("reservations")
            .select(
                "id, property_id, channel, ota_name, adults, children, "
                "check_in, check_out, status"
            )
            .eq("tenant_id", tenant_id)
            .neq("status", "cancelled")
            .lt("check_in", month_to)
            .gt("check_out", month_from)
            .execute()
        ).data or []
        out: list[CalendarBooking] = []
        for r in rows:
            out.append(
                CalendarBooking(
                    id=r["id"],
                    property_id=r["property_id"],
                    channel=r["channel"],
                    ota_name=r.get("ota_name"),
                    guests=int(r.get("adults") or 1) + int(r.get("children") or 0),
                    adults=int(r.get("adults") or 1),
                    children=int(r.get("children") or 0),
                    check_in=r["check_in"],
                    check_out=r["check_out"],
                    status=r["status"],
                )
            )
        return out

    def get_detail(self, tenant_id: str, task_id: str) -> TaskDetail:
        row = (
            self._db()
            .table("tasks")
            .select("*")
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        task = self._to_task(row[0])
        enriched = self._enrich(tenant_id, [task])[0]
        checklist = self._load_checklist(task_id)
        return TaskDetail(
            **enriched.model_dump(),
            checklist=checklist,
        )

    def _load_checklist(self, task_id: str) -> list[ChecklistItem]:
        items = (
            self._db()
            .table("checklist_items")
            .select("*")
            .eq("task_id", task_id)
            .order("sort_order")
            .execute()
        ).data or []
        photos = self._photos_by_item({r["id"] for r in items})
        return [
            ChecklistItem(
                id=r["id"],
                task_id=r["task_id"],
                label=r["label"],
                room=r.get("room"),
                done=bool(r.get("done")),
                requires_photo=bool(r.get("requires_photo")),
                sort_order=int(r.get("sort_order") or 0),
                photos=photos.get(r["id"], []),
            )
            for r in items
        ]

    def _photos_by_item(self, item_ids: set[str]) -> dict[str, list[str]]:
        clean = {i for i in item_ids if i}
        if not clean:
            return {}
        res = (
            self._db()
            .table("checklist_photos")
            .select("item_id, storage_path")
            .in_("item_id", list(clean))
            .execute()
        )
        out: dict[str, list[str]] = {}
        for r in res.data or []:
            out.setdefault(r["item_id"], []).append(r["storage_path"])
        return out

    # --- Abschluss mit Foto-Pflicht + Inspektion ---

    def complete_task(self, tenant_id: str, task_id: str, user_id: str) -> TaskDetail:
        """Aufgabe abschließen. Alle requires_photo-Items MÜSSEN ein Foto haben
        (sonst 422). Bei needs_inspection → inspection_state='to_review'."""
        detail = self.get_detail(tenant_id, task_id)
        missing = [
            i for i in detail.checklist if i.requires_photo and not i.photos
        ]
        if missing:
            raise TaskError(
                "Foto-Pflicht: Für jeden markierten Punkt ist ein Foto nötig.",
                status_code=422,
            )
        update: dict[str, object] = {
            "status": TaskStatus.done.value,
            "completed_at": "now()",
            "completed_by": user_id,
        }
        if detail.needs_inspection:
            update["inspection_state"] = InspectionState.to_review.value
        res = (
            self._db()
            .table("tasks")
            .update(update)
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        return self.get_detail(tenant_id, task_id)

    def list_inspection(
        self, tenant_id: str, tab: str
    ) -> list[InspectionItem]:
        """Inspektions-Tabs: to_review | reviewed | upcoming (needs_inspection,
        noch nicht abgeschlossen)."""
        q = self._db().table("tasks").select("*").eq("tenant_id", tenant_id)
        if tab == "reviewed":
            q = q.eq("inspection_state", "reviewed")
        elif tab == "upcoming":
            q = q.eq("needs_inspection", True).neq("status", TaskStatus.done.value)
        else:  # to_review
            q = q.eq("inspection_state", "to_review")
        rows = [self._to_task(r) for r in (q.order("end_at").execute().data or [])]
        enriched = self._enrich(tenant_id, rows)
        # Fotos je Aufgabe für die Freigabe-Ansicht.
        out: list[InspectionItem] = []
        for item in enriched:
            checklist = self._load_checklist(item.id)
            photos = [p for c in checklist for p in c.photos]
            out.append(InspectionItem(**item.model_dump(), photos=photos))
        return out

    def inspect(
        self, tenant_id: str, task_id: str, decision: InspectionDecision
    ) -> TaskDetail:
        """Freigeben (reviewed) oder zurückweisen (zurück auf to_review +
        Status offen zur Nachbearbeitung)."""
        if decision.approved:
            update: dict[str, object] = {
                "inspection_state": InspectionState.reviewed.value
            }
        else:
            update = {
                "inspection_state": InspectionState.to_review.value,
                "status": TaskStatus.open.value,
            }
        res = (
            self._db()
            .table("tasks")
            .update(update)
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        return self.get_detail(tenant_id, task_id)

    # --- Regeln / Vorlagen (task_rules kind=template|auto|recurring) ---

    def list_rules(self, tenant_id: str, kind: TaskRuleKind) -> list[RuleListItem]:
        rows = (
            self._db()
            .table("task_rules")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("kind", kind.value)
            .order("updated_at", desc=True)
            .execute()
        ).data or []
        ids = [r["id"] for r in rows]
        counts = self._rule_item_counts(tenant_id, set(ids))
        prop_map = self._rule_property_ids(set(ids))
        names = self._user_names(
            tenant_id, {r.get("assignee_id") for r in rows if r.get("assignee_id")}
        )
        return [self._to_rule_list(r, counts, prop_map, names) for r in rows]

    def _to_rule_list(
        self,
        r: dict[str, object],
        counts: dict[str, int],
        prop_map: dict[str, list[str]],
        names: dict[str, str],
    ) -> RuleListItem:
        aid = r.get("assignee_id")
        return RuleListItem(
            id=r["id"],
            kind=TaskRuleKind(r["kind"]),
            name=r["name"],
            active=bool(r.get("active")),
            priority=int(r.get("priority") or 0),
            assignee_id=aid,
            assignee_name=names.get(aid or ""),
            needs_inspection=bool(r.get("needs_inspection")),
            item_count=counts.get(r["id"], 0),
            property_ids=prop_map.get(r["id"], []),
            schedule_label=schedule_label(r.get("recurrence") or {}),
            updated_at=r.get("updated_at"),
        )

    def _rule_item_counts(
        self, tenant_id: str, rule_ids: set[str]
    ) -> dict[str, int]:
        if not rule_ids:
            return {}
        res = (
            self._db()
            .table("task_rule_items")
            .select("rule_id")
            .eq("tenant_id", tenant_id)
            .in_("rule_id", list(rule_ids))
            .execute()
        )
        out: dict[str, int] = {}
        for r in res.data or []:
            out[r["rule_id"]] = out.get(r["rule_id"], 0) + 1
        return out

    def _rule_property_ids(self, rule_ids: set[str]) -> dict[str, list[str]]:
        """Objekt-Zuordnung je Regel (task_rule_assignments). Keine tenant_id auf
        der Join-Tabelle — rule_ids sind bereits tenant-gefiltert (Wurzel 3)."""
        if not rule_ids:
            return {}
        res = (
            self._db()
            .table("task_rule_assignments")
            .select("rule_id, property_id")
            .in_("rule_id", list(rule_ids))
            .execute()
        )
        out: dict[str, list[str]] = {}
        for r in res.data or []:
            out.setdefault(r["rule_id"], []).append(r["property_id"])
        return out

    def get_rule(self, tenant_id: str, rule_id: str) -> RuleDetail:
        rows = (
            self._db()
            .table("task_rules")
            .select("*")
            .eq("id", rule_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise TaskError("Regel nicht gefunden.", status_code=404)
        r = rows[0]
        counts = self._rule_item_counts(tenant_id, {rule_id})
        prop_map = self._rule_property_ids({rule_id})
        names = self._user_names(
            tenant_id, {r.get("assignee_id")} if r.get("assignee_id") else set()
        )
        base = self._to_rule_list(r, counts, prop_map, names)
        return RuleDetail(
            **base.model_dump(),
            description=r.get("description"),
            remove_on_cancellation=bool(r.get("remove_on_cancellation")),
            recurrence=r.get("recurrence") or {},
            items=self._load_rule_items(tenant_id, rule_id),
        )

    def _load_rule_items(self, tenant_id: str, rule_id: str) -> list[RuleItem]:
        rows = (
            self._db()
            .table("task_rule_items")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("rule_id", rule_id)
            .order("sort_order")
            .execute()
        ).data or []
        return [
            RuleItem(
                id=r["id"],
                label=r["label"],
                description=r.get("description"),
                room=r.get("room"),
                requires_photo=bool(r.get("requires_photo")),
                sort_order=int(r.get("sort_order") or 0),
            )
            for r in rows
        ]

    def create_rule(self, tenant_id: str, req: RuleCreate) -> RuleDetail:
        self._require_own_properties(tenant_id, req.property_ids)
        self._require_own_assignee(tenant_id, req.assignee_id)
        row = self._insert("task_rules", self._rule_payload(tenant_id, req))
        self._replace_rule_children(tenant_id, row["id"], req)
        return self.get_rule(tenant_id, row["id"])

    def update_rule(
        self, tenant_id: str, rule_id: str, req: RuleUpdate
    ) -> RuleDetail:
        self._require_own_properties(tenant_id, req.property_ids)
        self._require_own_assignee(tenant_id, req.assignee_id)
        res = (
            self._db()
            .table("task_rules")
            .update(self._rule_payload(tenant_id, req))
            .eq("id", rule_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Regel nicht gefunden.", status_code=404)
        self._replace_rule_children(tenant_id, rule_id, req)
        return self.get_rule(tenant_id, rule_id)

    def delete_rule(self, tenant_id: str, rule_id: str) -> None:
        res = (
            self._db()
            .table("task_rules")
            .delete()
            .eq("id", rule_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Regel nicht gefunden.", status_code=404)

    @staticmethod
    def _rule_payload(tenant_id: str, req: RuleCreate) -> dict[str, object]:
        return {
            "tenant_id": tenant_id,
            "kind": req.kind.value,
            "name": req.name,
            "description": req.description,
            "active": req.active,
            "priority": req.priority,
            "assignee_id": req.assignee_id,
            "needs_inspection": req.needs_inspection,
            "remove_on_cancellation": req.remove_on_cancellation,
            "recurrence": req.recurrence,
        }

    def _replace_rule_children(
        self, tenant_id: str, rule_id: str, req: RuleCreate
    ) -> None:
        """Objekt-Zuordnungen + Vorlagen-Items neu setzen (Alt/Neu-Diff, Wurzel 1:
        alte Zuordnungen werden gelöscht, bevor die neuen gesetzt werden)."""
        db = self._db()
        db.table("task_rule_assignments").delete().eq("rule_id", rule_id).execute()
        if req.property_ids:
            db.table("task_rule_assignments").insert(
                [{"rule_id": rule_id, "property_id": p} for p in req.property_ids]
            ).execute()
        db.table("task_rule_items").delete().eq("rule_id", rule_id).eq(
            "tenant_id", tenant_id
        ).execute()
        if req.items:
            db.table("task_rule_items").insert(
                [
                    {
                        "tenant_id": tenant_id,
                        "rule_id": rule_id,
                        "label": it.label,
                        "description": it.description,
                        "room": it.room,
                        "requires_photo": it.requires_photo,
                        "sort_order": idx,
                    }
                    for idx, it in enumerate(req.items)
                ]
            ).execute()

    def _require_own_properties(self, tenant_id: str, ids: list[str]) -> None:
        """Alle referenzierten Objekte MÜSSEN dem Tenant gehören (Wurzel 3)."""
        clean = {i for i in ids if i}
        if not clean:
            return
        owned = (
            self._db()
            .table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("id", list(clean))
            .execute()
        ).data or []
        if len(owned) != len(clean):
            raise TaskError("Unbekanntes Objekt referenziert.", status_code=422)

    def _require_own_assignee(self, tenant_id: str, assignee_id: str | None) -> None:
        if not assignee_id:
            return
        owned = (
            self._db()
            .table("users")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("id", assignee_id)
            .limit(1)
            .execute()
        ).data
        if not owned:
            raise TaskError("Unbekannter Mitarbeiter referenziert.", status_code=422)

    # --- intern ---

    def _insert(self, table: str, data: dict[str, object]) -> dict[str, object]:
        res = self._db().table(table).insert(data).execute()
        if not res.data:
            raise TaskError(f"{table}: Anlegen fehlgeschlagen.", status_code=500)
        return res.data[0]

    def _to_task(self, row: dict[str, object]) -> Task:
        insp = row.get("inspection_state")
        return Task(
            id=row["id"],
            tenant_id=row["tenant_id"],
            property_id=row.get("property_id"),
            reservation_id=row.get("reservation_id"),
            assignee_id=row.get("assignee_id"),
            title=row["title"],
            status=TaskStatus(row["status"]),
            due_at=row.get("due_at"),
            needs_inspection=bool(row.get("needs_inspection")),
            inspection_state=InspectionState(insp) if insp else None,
            source=TaskSource(row.get("source") or "manual"),
            priority=int(row.get("priority") or 0),
            start_at=row.get("start_at"),
            end_at=row.get("end_at"),
        )
