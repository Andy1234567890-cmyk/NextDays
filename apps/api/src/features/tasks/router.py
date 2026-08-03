"""Router für tasks. Gemountet unter /api/v1/tasks (Lastenheft §2.5 + §4.3)."""
from datetime import UTC, datetime
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    UploadFile,
)

from src.core.security import AuthContext, require_internal_cron_secret
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    BulkTaskRequest,
    ChecklistItemCreate,
    ChecklistPhotoCreate,
    InspectionDecision,
    InspectionItem,
    InventoryItemCreate,
    RuleCreate,
    RuleDetail,
    RuleListItem,
    RuleUpdate,
    SliceHealth,
    SubstitutionRequest,
    Task,
    TaskCalendarResponse,
    TaskCreate,
    TaskDetail,
    TaskListItem,
    TaskRuleKind,
    TaskStatusUpdate,
)
from .service import TaskError, TasksService

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_tasks_service() -> TasksService:
    return TasksService(client=get_service_client())


TasksServiceDep = Annotated[TasksService, Depends(get_tasks_service)]


def _tenant(ctx: AuthContext) -> str:
    if not ctx.tenant_id:
        raise HTTPException(status_code=400, detail="Kein Tenant im Token.")
    return ctx.tenant_id


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="tasks")


@router.post("", response_model=Task, status_code=201)
def create_task(
    req: TaskCreate,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))],
) -> Task:
    try:
        return service.create_task(_tenant(ctx), req)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/mine", response_model=list[TaskListItem])
def my_tasks(
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
    status_bucket: str | None = None,
    property_id: Annotated[list[str] | None, Query()] = None,
) -> list[TaskListItem]:
    """Dieselbe Tabelle wie Teamaufgaben, hart auf den angemeldeten Nutzer
    gescopt (Wurzel 9). Liefert Objekt, Buchungsreferenz und Checklisten-Stand —
    ohne die ist die Liste für eine Reinigungskraft nicht arbeitsfähig."""
    return service.list_own_tasks(
        _tenant(ctx),
        ctx.user_id,
        status_bucket=status_bucket,
        property_ids=property_id,
        ctx=ctx,
    )


@router.get("/by-reservation/{reservation_id}", response_model=list[Task])
def tasks_by_reservation(
    reservation_id: str,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_CALENDAR))
    ],
) -> list[Task]:
    """Aufgaben zu einer Buchung (PM-Detailseite). Wer die Buchung sieht
    (VIEW_CALENDAR), sieht ihre Aufgaben; tenant-scoped im Service."""
    return service.list_by_reservation(_tenant(ctx), reservation_id)


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))],
) -> None:
    try:
        service.delete_task(_tenant(ctx), task_id)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{task_id}/status", response_model=Task)
def update_task_status(
    task_id: str,
    req: TaskStatusUpdate,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))],
) -> Task:
    try:
        return service.set_status(_tenant(ctx), task_id, req.status)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/sync-reservation/{reservation_id}")
def sync_reservation(
    reservation_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))],
) -> dict[str, int]:
    """Planmäßige Regeln für eine Reservierung nachziehen.

    Der Normalfall läuft automatisch im Reservierungs-Schreibpfad; das hier ist
    der Nachzügler-Knopf für Buchungen, die vor dem Anlegen einer Regel bestanden.
    """
    try:
        return {"touched": service.sync_reservation_tasks(_tenant(ctx), reservation_id)}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/internal/tick", include_in_schema=False)
def internal_tick(
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict[str, int]:
    """Interner Cron-Trigger: rollt wiederkehrende Regeln über ALLE Tenants aus.

    Kein JWT — über INTERNAL_CRON_SECRET abgesichert (Wurzel 5: fehlt das
    Secret, wird fail-closed abgewiesen). Derselbe Lauf steckt im Worker-Tick;
    dieser Endpunkt ist die Handkurbel bzw. der Scheduled-Task.
    """
    require_internal_cron_secret(x_internal_cron_secret)
    db = get_service_client()
    service = TasksService(client=db)
    today = datetime.now(UTC).date()
    tenants = (db.table("tenants").select("id").execute()).data or []
    created = sum(
        service.materialize_recurring(str(t["id"]), today) for t in tenants
    )
    return {"tenants": len(tenants), "created": created}


@router.post("/checklist/item", status_code=201)
def checklist_item(
    req: ChecklistItemCreate,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
) -> dict[str, str]:
    try:
        return {"id": service.add_checklist_item(_tenant(ctx), req, ctx).id}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/checklist/photo", status_code=201)
def checklist_photo(
    req: ChecklistPhotoCreate,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
) -> dict[str, str]:
    try:
        return {"id": service.add_checklist_photo(_tenant(ctx), req, ctx)}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/checklist/item/{item_id}/photo", status_code=201)
async def upload_checklist_photo(
    item_id: str,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
    file: Annotated[UploadFile, File()],
) -> dict[str, str]:
    """Foto-Nachweis zu einem Checklisten-Punkt hochladen (Multipart → privater
    Bucket task-photos). Der cleaner lädt beim Task-Abschluss das Pflicht-Foto."""
    content = await file.read()
    try:
        photo_id = service.upload_checklist_photo(
            _tenant(ctx), item_id, content, file.content_type or "", ctx
        )
        return {"id": photo_id}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{task_id}/photo", status_code=201)
async def upload_task_photo(
    task_id: str,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
    file: Annotated[UploadFile, File()],
) -> dict[str, str]:
    """Foto direkt an einer Aufgabe hochladen (ohne konkretes Checklisten-Item)
    → erscheint als Buchungsbild im Bilder-Modul."""
    content = await file.read()
    try:
        photo_id = service.upload_task_photo(
            _tenant(ctx), task_id, content, file.content_type or "", ctx
        )
        return {"id": photo_id}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/substitution", status_code=201)
def request_substitution(
    req: SubstitutionRequest,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.REQUEST_SUBSTITUTE))
    ],
) -> dict[str, str]:
    try:
        sub = service.request_substitution(_tenant(ctx), ctx.user_id, req)
        return {"id": sub.id, "status": sub.status.value}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/substitution/{substitution_id}/accept")
def accept_substitution(
    substitution_id: str,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.REQUEST_SUBSTITUTE))
    ],
) -> dict[str, str]:
    """Eine Vertretungsanfrage annehmen.

    Ohne diesen Endpunkt war das Feature eine Sackgasse: eine Vertretung ließ
    sich anfragen, aber von niemandem annehmen. Dieselbe Fähigkeit wie das
    Anfragen — wer vertreten werden darf, darf auch vertreten.
    """
    try:
        sub = service.accept_substitution(_tenant(ctx), substitution_id, ctx.user_id)
        return {"id": sub.id, "status": sub.status.value}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/inventory", status_code=201)
def add_inventory(
    req: InventoryItemCreate,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_INVENTORY))
    ],
) -> dict[str, str]:
    try:
        return {"id": service.add_inventory(_tenant(ctx), req).id}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- PM-Aufgaben-Modul: Team, Kalender, Detail, Abschluss, Inspektion ---


def _manage() -> object:
    """Guard: Aufgaben verwalten (owner/staff/co_admin)."""
    return require_permission(Capability.MANAGE_TASKS)


def _own() -> object:
    """Guard: eigene Aufgaben (cleaner) — abschließen + Detail lesen."""
    return require_permission(Capability.VIEW_OWN_TASKS)


@router.get("/team", response_model=list[TaskListItem])
def team_tasks(
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
    status_bucket: str | None = None,
    property_id: Annotated[list[str] | None, Query()] = None,
    assignee_id: Annotated[list[str] | None, Query()] = None,
    rule_id: Annotated[list[str] | None, Query()] = None,
) -> list[TaskListItem]:
    """Filter sind MEHRFACH wählbar (Lodgify-Dialoge). `assignee_id=none` meint
    „Nicht zugeordnet"."""
    return service.list_team_tasks(
        _tenant(ctx), status_bucket, property_id, assignee_id, rule_id
    )


@router.post("/bulk/complete")
def bulk_complete(
    req: BulkTaskRequest,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_own())],
) -> dict[str, int]:
    """Auswahl abschließen. Jede Aufgabe durchläuft denselben Scope- und
    Foto-Pflicht-Pfad wie der Einzelabschluss (Wurzel 9)."""
    try:
        return service.bulk_complete(_tenant(ctx), req.ids, ctx.user_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bulk/delete")
def bulk_delete(
    req: BulkTaskRequest,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> dict[str, int]:
    try:
        return service.bulk_delete(_tenant(ctx), req.ids, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/calendar", response_model=TaskCalendarResponse)
def task_calendar(
    month_from: str,
    month_to: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
    assignee_id: Annotated[list[str] | None, Query()] = None,
    rule_id: Annotated[list[str] | None, Query()] = None,
) -> TaskCalendarResponse:
    return service.calendar(
        _tenant(ctx), month_from, month_to, assignee_id, rule_id
    )


@router.get("/inspection", response_model=list[InspectionItem])
def inspection_list(
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
    tab: str = "to_review",
    property_id: Annotated[list[str] | None, Query()] = None,
) -> list[InspectionItem]:
    return service.list_inspection(_tenant(ctx), tab, property_id)


@router.get("/detail/{task_id}", response_model=TaskDetail)
def task_detail(
    task_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_own())],
) -> TaskDetail:
    try:
        return service.get_detail(_tenant(ctx), task_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{task_id}/complete", response_model=TaskDetail)
def complete_task(
    task_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_own())],
) -> TaskDetail:
    try:
        return service.complete_task(_tenant(ctx), task_id, ctx.user_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{task_id}/inspect", response_model=TaskDetail)
def inspect_task(
    task_id: str,
    req: InspectionDecision,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> TaskDetail:
    try:
        return service.inspect(_tenant(ctx), task_id, req)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Regeln / Vorlagen (kind=template|auto|recurring) ---


def _rules_list(
    kind: TaskRuleKind, service: TasksService, ctx: AuthContext
) -> list[RuleListItem]:
    return service.list_rules(_tenant(ctx), kind)


@router.get("/templates", response_model=list[RuleListItem])
def list_templates(
    service: TasksServiceDep, ctx: Annotated[AuthContext, Depends(_manage())]
) -> list[RuleListItem]:
    return _rules_list(TaskRuleKind.template, service, ctx)


@router.get("/auto", response_model=list[RuleListItem])
def list_auto(
    service: TasksServiceDep, ctx: Annotated[AuthContext, Depends(_manage())]
) -> list[RuleListItem]:
    return _rules_list(TaskRuleKind.auto, service, ctx)


@router.get("/recurring", response_model=list[RuleListItem])
def list_recurring(
    service: TasksServiceDep, ctx: Annotated[AuthContext, Depends(_manage())]
) -> list[RuleListItem]:
    return _rules_list(TaskRuleKind.recurring, service, ctx)


@router.get("/rules/{rule_id}", response_model=RuleDetail)
def get_rule(
    rule_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> RuleDetail:
    try:
        return service.get_rule(_tenant(ctx), rule_id)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/rules", response_model=RuleDetail, status_code=201)
def create_rule(
    req: RuleCreate,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> RuleDetail:
    try:
        return service.create_rule(_tenant(ctx), req)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/rules/{rule_id}", response_model=RuleDetail)
def update_rule(
    rule_id: str,
    req: RuleUpdate,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> RuleDetail:
    try:
        return service.update_rule(_tenant(ctx), rule_id, req)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> None:
    try:
        service.delete_rule(_tenant(ctx), rule_id)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
