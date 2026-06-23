"""Router für inbox. Gemountet unter /api/v1/inbox."""
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from src.core.config import get_settings
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    AiReplyResponse,
    AiSettings,
    AssignRequest,
    Automation,
    AutomationList,
    AutomationUpsert,
    BulkUpdateRequest,
    BulkUpdateResult,
    InboxListResponse,
    InboxStatusUpdate,
    InboxMessage,
    InboxMessagesResponse,
    MessageTemplate,
    MessageTemplateList,
    NoteCreate,
    ReservationDetail,
    ScheduleCreate,
    ScheduledMessage,
    ScheduledMessageList,
    SendMessageRequest,
    SliceHealth,
    TeamMemberList,
    TemplateUpsert,
    ThreadFlagsUpdate,
)
from .service import InboxError, InboxService


def get_inbox_service() -> InboxService:
    return InboxService(service_client=get_service_client())


InboxServiceDep = Annotated[InboxService, Depends(get_inbox_service)]

# Posteingang erfordert vollen Gast-Zugriff (Namen, Kontakt, Nachrichten).
_guest = Annotated[AuthContext, Depends(require_permission(Capability.VIEW_GUEST_FULL))]

router = APIRouter(prefix="/inbox", tags=["inbox"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return InboxService().health()


@router.get("", response_model=InboxListResponse)
def list_threads(
    service: InboxServiceDep,
    ctx: _guest,
    unassigned: Annotated[bool, Query()] = False,
    status: Annotated[str, Query()] = "active",
) -> InboxListResponse:
    try:
        return service.list_threads(ctx, unassigned=unassigned, status=status)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/team", response_model=TeamMemberList)
def list_team(service: InboxServiceDep, ctx: _guest) -> TeamMemberList:
    try:
        return service.list_team(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/internal/dispatch-scheduled", include_in_schema=False)
def dispatch_scheduled(
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict:
    """Interner Cron-Trigger: versendet fällige geplante Nachrichten über ALLE
    Tenants. Kein JWT — via geteiltem Secret (CHANNEX_WEBHOOK_SECRET) abgesichert,
    getriggert durch einen Coolify-Scheduled-Task / Host-crontab (curl)."""
    expected = get_settings().channex_webhook_secret.get_secret_value()
    if not expected or x_internal_cron_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiges Secret."
        )
    return InboxService(service_client=get_service_client()).dispatch_due_scheduled()


@router.get("/{thread_id}/messages", response_model=InboxMessagesResponse)
def get_messages(
    thread_id: str, service: InboxServiceDep, ctx: _guest
) -> InboxMessagesResponse:
    try:
        return service.get_messages(ctx, thread_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/messages", response_model=InboxMessage)
def send_message(
    thread_id: str, req: SendMessageRequest, service: InboxServiceDep, ctx: _guest
) -> InboxMessage:
    try:
        return service.send_message(ctx, thread_id, req.message)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{thread_id}/reservation", response_model=ReservationDetail)
def get_reservation(
    thread_id: str, service: InboxServiceDep, ctx: _guest
) -> ReservationDetail:
    try:
        return service.get_reservation_detail(ctx, thread_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{thread_id}/flags", status_code=204)
def update_flags(
    thread_id: str, req: ThreadFlagsUpdate, service: InboxServiceDep, ctx: _guest
) -> None:
    try:
        service.update_thread_flags(
            ctx, thread_id,
            is_starred=req.is_starred, note=req.note,
            is_read=req.is_read, is_archived=req.is_archived,
            remind_at=req.remind_at,
        )
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{thread_id}/status", status_code=204)
def set_status(
    thread_id: str, req: InboxStatusUpdate, service: InboxServiceDep, ctx: _guest
) -> None:
    try:
        service.set_inbox_status(ctx, thread_id, req.status)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{thread_id}/assign", status_code=204)
def assign_thread(
    thread_id: str, req: AssignRequest, service: InboxServiceDep, ctx: _guest
) -> None:
    try:
        service.assign_thread(ctx, thread_id, req.user_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/notes", response_model=InboxMessage)
def add_note(
    thread_id: str, req: NoteCreate, service: InboxServiceDep, ctx: _guest
) -> InboxMessage:
    try:
        return service.add_note(ctx, thread_id, req.body)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{thread_id}/scheduled", response_model=ScheduledMessageList)
def list_scheduled(
    thread_id: str, service: InboxServiceDep, ctx: _guest
) -> ScheduledMessageList:
    try:
        return service.list_scheduled(ctx, thread_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/scheduled", response_model=ScheduledMessage)
def schedule_message(
    thread_id: str, req: ScheduleCreate, service: InboxServiceDep, ctx: _guest
) -> ScheduledMessage:
    try:
        return service.schedule_message(ctx, thread_id, req.body, req.send_at)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/scheduled/{scheduled_id}", status_code=204)
def cancel_scheduled(
    scheduled_id: str, service: InboxServiceDep, ctx: _guest
) -> None:
    try:
        service.cancel_scheduled(ctx, scheduled_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bulk-update", response_model=BulkUpdateResult)
def bulk_update(
    req: BulkUpdateRequest, service: InboxServiceDep, ctx: _guest
) -> BulkUpdateResult:
    try:
        return service.bulk_update(ctx, req.action, req.before)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/ai-reply", response_model=AiReplyResponse)
def ai_reply(thread_id: str, service: InboxServiceDep, ctx: _guest) -> AiReplyResponse:
    try:
        return service.ai_reply(ctx, thread_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Vorlagen ---------------------------------------------------------------
@router.get("/templates", response_model=MessageTemplateList)
def list_templates(service: InboxServiceDep, ctx: _guest) -> MessageTemplateList:
    try:
        return service.list_templates(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/templates", response_model=MessageTemplate)
def create_template(
    req: TemplateUpsert, service: InboxServiceDep, ctx: _guest
) -> MessageTemplate:
    try:
        return service.create_template(ctx, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/templates/{template_id}", response_model=MessageTemplate)
def update_template(
    template_id: str, req: TemplateUpsert, service: InboxServiceDep, ctx: _guest
) -> MessageTemplate:
    try:
        return service.update_template(ctx, template_id, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(template_id: str, service: InboxServiceDep, ctx: _guest) -> None:
    try:
        service.delete_template(ctx, template_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- KI-Einstellungen -------------------------------------------------------
@router.get("/ai-settings", response_model=AiSettings)
def get_ai_settings(service: InboxServiceDep, ctx: _guest) -> AiSettings:
    try:
        return service.get_ai_settings(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/ai-settings", response_model=AiSettings)
def save_ai_settings(
    req: AiSettings, service: InboxServiceDep, ctx: _guest
) -> AiSettings:
    try:
        return service.save_ai_settings(ctx, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Automatisierungen ------------------------------------------------------
@router.get("/automations", response_model=AutomationList)
def list_automations(service: InboxServiceDep, ctx: _guest) -> AutomationList:
    try:
        return service.list_automations(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/automations", response_model=Automation)
def create_automation(
    req: AutomationUpsert, service: InboxServiceDep, ctx: _guest
) -> Automation:
    try:
        return service.create_automation(ctx, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/automations/{automation_id}", response_model=Automation)
def update_automation(
    automation_id: str, req: AutomationUpsert, service: InboxServiceDep, ctx: _guest
) -> Automation:
    try:
        return service.update_automation(ctx, automation_id, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/automations/{automation_id}", status_code=204)
def delete_automation(
    automation_id: str, service: InboxServiceDep, ctx: _guest
) -> None:
    try:
        service.delete_automation(ctx, automation_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
