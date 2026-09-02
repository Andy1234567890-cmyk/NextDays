"""Router für den Ticket-Eingang. Gemountet unter /api/v1/support.

ZWEI Melder-Welten, strikt getrennt (ADR-0015/0017):
  • /support/*        — Betriebs-Nutzer (CurrentUser, mit tenant_id)
  • /support/guest/*  — Plattform-Gäste (CurrentGuest, ohne tenant_id)

Beide Zweige rufen denselben Service, übergeben aber unterschiedliche
Identitäten. Interne Team-Notizen filtert der Service in JEDEM Fall heraus.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from src.core.security import (
    CurrentAffiliate,
    CurrentGuest,
    CurrentUser,
    require_approved_affiliate,
)

from .dependencies import SupportServiceDep
from .schemas import (
    ChatStart,
    PublicChatStart,
    PublicReply,
    PublicTicket,
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


# --- Anonyme Website-Besucher ------------------------------------------------
#
# OHNE Authentifizierung: ein Interessent auf der Marketing-Seite hat kein
# Konto und soll für eine Frage keines anlegen müssen (Intercom-/Crisp-Muster).
# Der Schutz besteht deshalb aus drei Teilen:
#   1. eigener, strenger Rate-Limit-Bucket (core/ratelimit_middleware),
#   2. Zufallstoken als einziger Schlüssel zum eigenen Verlauf — in der DB liegt
#      nur dessen SHA-256,
#   3. schmales Antwortschema (PublicTicket), das weder Priorität noch interne
#      Felder kennt.


@router.post(
    "/public/chat",
    response_model=PublicTicket,
    status_code=status.HTTP_201_CREATED,
)
def start_public_chat(
    req: PublicChatStart, service: SupportServiceDep
) -> PublicTicket:
    """Eine Anfrage von der Website eröffnen (Name, E-Mail, optional Telefon)."""
    try:
        return service.start_public_chat(req)
    except SupportError as exc:
        raise _map(exc) from exc


@router.get("/public/{token}", response_model=PublicTicket)
def get_public_chat(token: str, service: SupportServiceDep) -> PublicTicket:
    """Den eigenen Verlauf abrufen. Unbekanntes Token → 404."""
    res = service.public_detail(token)
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Konversation nicht gefunden."
        )
    return res


@router.post("/public/{token}/reply", response_model=TicketMessage)
def reply_public_chat(
    token: str, antwort: PublicReply, service: SupportServiceDep
) -> TicketMessage:
    """Im eigenen Verlauf antworten. Unbekanntes Token → 404."""
    res = service.reply_public(
        token, antwort.body, client_msg_id=antwort.client_msg_id
    )
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Konversation nicht gefunden."
        )
    return res


# --- Partner (Affiliate-Programm, 0518) --------------------------------------
#
# Vierte Melder-Welt: der Partner hat ein eigenes Konto (affiliates.id), keinen
# Betrieb. Nur FREIGEGEBENE Partner dürfen Konversationen eröffnen — ein
# Bewerber hat sein Anliegen in der Bewerbung genannt (require_approved_affiliate).
# Jeder Zugriff ist über die eigene affiliate_id gescopet (Wurzel 3/9).


@router.post(
    "/partner/chat", response_model=TicketDetail, status_code=status.HTTP_201_CREATED
)
def start_partner_chat(
    req: ChatStart, ctx: CurrentAffiliate, service: SupportServiceDep
) -> TicketDetail:
    """Konversation mit dem Partnerteam eröffnen (source='partner')."""
    require_approved_affiliate(ctx)
    try:
        return service.start_chat(req, affiliate_id=ctx.affiliate_id)
    except SupportError as exc:
        raise _map(exc) from exc


@router.get("/partner/list", response_model=TicketList)
def list_partner_tickets(
    ctx: CurrentAffiliate,
    service: SupportServiceDep,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> TicketList:
    require_approved_affiliate(ctx)
    try:
        return service.list(affiliate_id=ctx.affiliate_id, limit=limit, offset=offset)
    except SupportError as exc:
        raise _map(exc) from exc


@router.get("/partner/unread", response_model=UnreadSummary)
def partner_unread(ctx: CurrentAffiliate, service: SupportServiceDep) -> UnreadSummary:
    try:
        return service.unread(affiliate_id=ctx.affiliate_id)
    except SupportError as exc:
        raise _map(exc) from exc


@router.get("/partner/{ticket_id}", response_model=TicketDetail)
def get_partner_ticket(
    ticket_id: str, ctx: CurrentAffiliate, service: SupportServiceDep
) -> TicketDetail:
    require_approved_affiliate(ctx)
    res = service.detail(ticket_id, affiliate_id=ctx.affiliate_id)
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Konversation nicht gefunden."
        )
    return res


@router.post("/partner/{ticket_id}/reply", response_model=TicketMessage)
def reply_partner_ticket(
    ticket_id: str,
    antwort: TicketReply,
    ctx: CurrentAffiliate,
    service: SupportServiceDep,
) -> TicketMessage:
    require_approved_affiliate(ctx)
    res = service.reply(
        ticket_id,
        antwort.body,
        affiliate_id=ctx.affiliate_id,
        client_msg_id=antwort.client_msg_id,
    )
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Konversation nicht gefunden."
        )
    return res


@router.post("/partner/{ticket_id}/read", response_model=SupportOk)
def mark_partner_read(
    ticket_id: str, ctx: CurrentAffiliate, service: SupportServiceDep
) -> SupportOk:
    if not service.mark_read(ticket_id, affiliate_id=ctx.affiliate_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Konversation nicht gefunden."
        )
    return SupportOk()
