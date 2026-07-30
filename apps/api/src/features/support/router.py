"""Router für den Ticket-Eingang. Gemountet unter /api/v1/support.

ZWEI Melder-Welten, strikt getrennt (ADR-0015/0017):
  • /support/*        — Betriebs-Nutzer (CurrentUser, mit tenant_id)
  • /support/guest/*  — Plattform-Gäste (CurrentGuest, ohne tenant_id)

Beide Zweige rufen denselben Service, übergeben aber unterschiedliche
Identitäten. Interne Team-Notizen filtert der Service in JEDEM Fall heraus.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from src.core.security import CurrentGuest, CurrentUser

from .dependencies import SupportServiceDep
from .schemas import (
    ChatStart,
    SupportOk,
    TicketCreate,
    TicketDetail,
    TicketList,
    TicketMessage,
    TicketRating,
    TicketReply,
    UnreadSummary,
)
from .service import SupportError

router = APIRouter(prefix="/support", tags=["support"])


def _map(exc: SupportError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Betriebs-Nutzer ---------------------------------------------------------


@router.post("", response_model=TicketDetail, status_code=status.HTTP_201_CREATED)
def create_ticket(
    req: TicketCreate, ctx: CurrentUser, service: SupportServiceDep
) -> TicketDetail:
    """Ein Ticket als Betriebs-Nutzer eröffnen."""
    try:
        return service.create(req, user_id=ctx.user_id, tenant_id=ctx.tenant_id)
    except SupportError as exc:
        raise _map(exc) from exc


@router.get("", response_model=TicketList)
def list_tickets(
    ctx: CurrentUser,
    service: SupportServiceDep,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> TicketList:
    """Die eigenen Tickets."""
    try:
        return service.list(user_id=ctx.user_id, limit=limit, offset=offset)
    except SupportError as exc:
        raise _map(exc) from exc


@router.post(
    "/chat", response_model=TicketDetail, status_code=status.HTTP_201_CREATED
)
def start_chat(
    req: ChatStart, ctx: CurrentUser, service: SupportServiceDep
) -> TicketDetail:
    """Eine Chat-Konversation aus dem Widget eröffnen (ohne Betreff)."""
    try:
        return service.start_chat(
            req, user_id=ctx.user_id, tenant_id=ctx.tenant_id
        )
    except SupportError as exc:
        raise _map(exc) from exc


@router.get("/unread", response_model=UnreadSummary)
def unread(ctx: CurrentUser, service: SupportServiceDep) -> UnreadSummary:
    """Ungelesene Team-Antworten (Badge am Hilfe-Eintrag)."""
    try:
        return service.unread(user_id=ctx.user_id)
    except SupportError as exc:
        raise _map(exc) from exc


@router.get("/{ticket_id}", response_model=TicketDetail)
def get_ticket(
    ticket_id: str, ctx: CurrentUser, service: SupportServiceDep
) -> TicketDetail:
    """Ein eigenes Ticket mit Verlauf (ohne interne Notizen)."""
    res = service.detail(ticket_id, user_id=ctx.user_id)
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket nicht gefunden."
        )
    return res


@router.post("/{ticket_id}/reply", response_model=TicketMessage)
def reply_ticket(
    ticket_id: str,
    antwort: TicketReply,
    ctx: CurrentUser,
    service: SupportServiceDep,
) -> TicketMessage:
    """Auf das eigene Ticket antworten."""
    res = service.reply(
        ticket_id,
        antwort.body,
        user_id=ctx.user_id,
        client_msg_id=antwort.client_msg_id,
    )
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket nicht gefunden."
        )
    return res


@router.post("/{ticket_id}/read", response_model=SupportOk)
def mark_read(
    ticket_id: str, ctx: CurrentUser, service: SupportServiceDep
) -> SupportOk:
    """Lese-Cursor setzen (Verlauf geöffnet)."""
    if not service.mark_read(ticket_id, user_id=ctx.user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket nicht gefunden."
        )
    return SupportOk()


@router.post("/{ticket_id}/rating", response_model=SupportOk)
def rate_ticket(
    ticket_id: str,
    bewertung: TicketRating,
    ctx: CurrentUser,
    service: SupportServiceDep,
) -> SupportOk:
    """Abgeschlossene Konversation bewerten."""
    try:
        ok = service.rate(
            ticket_id,
            rating=bewertung.rating,
            comment=bewertung.comment,
            user_id=ctx.user_id,
        )
    except SupportError as exc:
        raise _map(exc) from exc
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket nicht gefunden."
        )
    return SupportOk()


# --- Plattform-Gäste ---------------------------------------------------------


@router.post(
    "/guest", response_model=TicketDetail, status_code=status.HTTP_201_CREATED
)
def create_guest_ticket(
    req: TicketCreate, ctx: CurrentGuest, service: SupportServiceDep
) -> TicketDetail:
    """Ein Ticket als Plattform-Gast eröffnen (ohne Tenant-Bezug)."""
    try:
        return service.create(req, guest_id=ctx.guest_id)
    except SupportError as exc:
        raise _map(exc) from exc


@router.get("/guest/list", response_model=TicketList)
def list_guest_tickets(
    ctx: CurrentGuest,
    service: SupportServiceDep,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> TicketList:
    """Die eigenen Tickets eines Plattform-Gasts."""
    try:
        return service.list(guest_id=ctx.guest_id, limit=limit, offset=offset)
    except SupportError as exc:
        raise _map(exc) from exc


@router.get("/guest/{ticket_id}", response_model=TicketDetail)
def get_guest_ticket(
    ticket_id: str, ctx: CurrentGuest, service: SupportServiceDep
) -> TicketDetail:
    """Ein eigenes Gast-Ticket mit Verlauf (ohne interne Notizen)."""
    res = service.detail(ticket_id, guest_id=ctx.guest_id)
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket nicht gefunden."
        )
    return res


@router.post("/guest/{ticket_id}/reply", response_model=TicketMessage)
def reply_guest_ticket(
    ticket_id: str,
    antwort: TicketReply,
    ctx: CurrentGuest,
    service: SupportServiceDep,
) -> TicketMessage:
    """Auf das eigene Gast-Ticket antworten."""
    res = service.reply(
        ticket_id,
        antwort.body,
        guest_id=ctx.guest_id,
        client_msg_id=antwort.client_msg_id,
    )
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket nicht gefunden."
        )
    return res
