"""Router für tasks. Gemountet unter /api/v1/tasks (Lastenheft §2.5 + §4.3)."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    BookingTasksRequest,
    ChecklistItemCreate,
    ChecklistPhotoCreate,
    InventoryItemCreate,
    SliceHealth,
    SubstitutionRequest,
    Task,
    TaskCreate,
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


@router.get("/mine", response_model=list[Task])
def my_tasks(
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
) -> list[Task]:
    return service.list_tasks(_tenant(ctx), assignee_id=ctx.user_id)


@router.post("/from-booking", response_model=list[Task], status_code=201)
def from_booking(
    req: BookingTasksRequest,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))],
) -> list[Task]:
    try:
        return service.generate_for_booking(_tenant(ctx), req)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/checklist/item", status_code=201)
def checklist_item(
    req: ChecklistItemCreate,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
) -> dict[str, str]:
    try:
        return {"id": service.add_checklist_item(_tenant(ctx), req).id}
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
        return {"id": service.add_checklist_photo(_tenant(ctx), req)}
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
