"""Router für host_messages. Gemountet unter /api/v1/host-messages.

Betrieb-Seite des PLATTFORM-Posteingangs (Airbnb „Messages"). NICHT der
OTA/Channel-Manager-inbox. Zugriff über PM_CHAT; Antworten über INBOX_REPLY;
Vorlagen-Verwaltung über INBOX_MANAGE_CONFIG. Scope serverseitig auf ctx.tenant_id.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from .dependencies import (
    AccessCtx,
    ConfigCtx,
    HostMessagesServiceDep,
    ReplyCtx,
)
from .schemas import (
    HostMessageView,
    HostReservationDetail,
    HostSendMessageRequest,
    HostThreadDetail,
    HostThreadFlagsUpdate,
    HostThreadListResponse,
    QuickReply,
    QuickReplyList,
    QuickReplyUpsert,
    SliceHealth,
)
from .service import HostMessagesError

router = APIRouter(prefix="/host-messages", tags=["host-messages"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth()


# --- Quick Replies (vor {thread_id}, damit /quick-replies nicht als ID matcht) --
@router.get("/quick-replies", response_model=QuickReplyList)
def list_quick_replies(
    ctx: AccessCtx, service: HostMessagesServiceDep
) -> QuickReplyList:
    return service.list_quick_replies(ctx)


@router.post(
    "/quick-replies", response_model=QuickReply, status_code=status.HTTP_201_CREATED
)
def create_quick_reply(
    req: QuickReplyUpsert, ctx: ConfigCtx, service: HostMessagesServiceDep
) -> QuickReply:
    try:
        return service.create_quick_reply(ctx, req)
    except HostMessagesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/quick-replies/{qr_id}", response_model=QuickReply)
def update_quick_reply(
    qr_id: str, req: QuickReplyUpsert, ctx: ConfigCtx, service: HostMessagesServiceDep
) -> QuickReply:
    try:
        return service.update_quick_reply(ctx, qr_id, req)
    except HostMessagesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/quick-replies/{qr_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quick_reply(
    qr_id: str, ctx: ConfigCtx, service: HostMessagesServiceDep
) -> None:
    service.delete_quick_reply(ctx, qr_id)


# --- Threads -----------------------------------------------------------------
@router.get("", response_model=HostThreadListResponse)
def list_threads(
    ctx: AccessCtx,
    service: HostMessagesServiceDep,
    unread: Annotated[bool, Query()] = False,
    archived: Annotated[bool, Query()] = False,
    q: Annotated[str | None, Query(max_length=200)] = None,
) -> HostThreadListResponse:
    """Threads des Betriebs (Filter: unread/archived, Suche q)."""
    return service.list_threads(
        ctx, only_unread=unread, archived=archived, query=q
    )


@router.get("/{thread_id}", response_model=HostThreadDetail)
def get_thread(
    thread_id: str, ctx: AccessCtx, service: HostMessagesServiceDep
) -> HostThreadDetail:
    """Nachrichten eines Threads; markiert ihn als vom Betrieb gelesen."""
    try:
        return service.get_thread(ctx, thread_id)
    except HostMessagesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{thread_id}/reservation", response_model=HostReservationDetail)
def get_reservation(
    thread_id: str, ctx: AccessCtx, service: HostMessagesServiceDep
) -> HostReservationDetail:
    """Rechte Spalte: Objekt- + Reservierungsdetails des Threads."""
    try:
        return service.reservation_detail(ctx, thread_id)
    except HostMessagesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/messages", response_model=HostMessageView)
def send_message(
    thread_id: str,
    req: HostSendMessageRequest,
    ctx: ReplyCtx,
    service: HostMessagesServiceDep,
) -> HostMessageView:
    """Betrieb antwortet (sender='host')."""
    try:
        return service.send_message(ctx, thread_id, req.body)
    except HostMessagesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{thread_id}/flags", status_code=status.HTTP_204_NO_CONTENT)
def update_flags(
    thread_id: str,
    req: HostThreadFlagsUpdate,
    ctx: AccessCtx,
    service: HostMessagesServiceDep,
) -> None:
    """Thread archivieren/reaktivieren."""
    try:
        service.set_flags(ctx, thread_id, is_archived=req.is_archived)
    except HostMessagesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/quick-replies/{qr_id}/render", response_model=HostMessageView)
def render_quick_reply(
    thread_id: str, qr_id: str, ctx: AccessCtx, service: HostMessagesServiceDep
) -> HostMessageView:
    """Vorlagentext mit Thread-Platzhaltern füllen (nur Rendern, kein Senden).
    Rückgabe im HostMessageView (body = gefüllter Text) fürs Einfügen ins Feld."""
    try:
        body = service.render_quick_reply(ctx, qr_id, thread_id)
        return HostMessageView(id="preview", sender="host", body=body)
    except HostMessagesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
