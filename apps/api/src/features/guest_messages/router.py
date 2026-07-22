"""Router für guest_messages. Gemountet unter /api/v1/guest-messages.

Gast↔Host-Chat des Kunden-Dashboards (/plattform). ALLE Endpunkte laufen als
eingeloggter Portal-Gast (CurrentGuest) und scopen server-seitig auf ctx.guest_id
(Wurzel 3/9). health ist bewusst public. Schreiben läuft über service_role, da
der Direkt-Insert per anon/authenticated in der DB gesperrt ist (Wurzel 6).
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import CurrentGuest
from src.core.supabase import get_service_client

from .schemas import (
    CreateThreadRequest,
    GuestMessageView,
    GuestThreadDetail,
    GuestThreadListResponse,
    SendMessageRequest,
    SliceHealth,
)
from .service import GuestMessagesError, GuestMessagesService


def get_guest_messages_service() -> GuestMessagesService:
    return GuestMessagesService(service_client=get_service_client())


GuestMessagesServiceDep = Annotated[
    GuestMessagesService, Depends(get_guest_messages_service)
]

router = APIRouter(prefix="/guest-messages", tags=["guest_messages"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return GuestMessagesService().health()


@router.get("/threads", response_model=GuestThreadListResponse)
def list_threads(
    ctx: CurrentGuest,
    service: GuestMessagesServiceDep,
) -> GuestThreadListResponse:
    """Alle Chat-Threads des eingeloggten Gasts (portal_guest_id=ctx.guest_id)."""
    try:
        return service.list_threads(ctx.guest_id)
    except GuestMessagesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/threads/{thread_id}", response_model=GuestThreadDetail)
def get_thread(
    thread_id: str,
    ctx: CurrentGuest,
    service: GuestMessagesServiceDep,
) -> GuestThreadDetail:
    """Nachrichten eines eigenen Threads; markiert Host-Nachrichten als gelesen."""
    try:
        return service.get_thread(thread_id, ctx.guest_id)
    except GuestMessagesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/threads", response_model=GuestThreadDetail)
def create_thread(
    req: CreateThreadRequest,
    ctx: CurrentGuest,
    service: GuestMessagesServiceDep,
) -> GuestThreadDetail:
    """Legt einen Thread für eine eigene Reservierung an (idempotent) oder gibt
    den bestehenden zurück. E-Mail-Match gegen die Reservierung serverseitig."""
    try:
        return service.create_thread(req, ctx.guest_id, ctx.email)
    except GuestMessagesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/threads/{thread_id}/messages", response_model=GuestMessageView
)
def send_message(
    thread_id: str,
    req: SendMessageRequest,
    ctx: CurrentGuest,
    service: GuestMessagesServiceDep,
) -> GuestMessageView:
    """Gast sendet eine Nachricht in seinen Thread. sender wird serverseitig
    auf 'guest' gesetzt; body wird sanitisiert und in der Länge gecappt."""
    try:
        return service.send_message(thread_id, req, ctx.guest_id)
    except GuestMessagesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
