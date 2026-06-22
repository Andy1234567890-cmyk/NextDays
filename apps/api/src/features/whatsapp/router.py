"""Router für whatsapp. Gemountet unter /api/v1/whatsapp.

- Geschützte Endpoints (JWT, view_guest_full): Konversationen/Nachrichten, senden, Status.
- Webhook (kein JWT): GET = Verify-Handshake (hub.challenge), POST = eingehende
  Nachrichten/Status von Meta. Abgesichert über den verify_token.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from src.core.config import get_settings
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    SendWhatsAppRequest,
    SliceHealth,
    WhatsAppConversationList,
    WhatsAppMessage,
    WhatsAppMessageList,
    WhatsAppStatus,
)
from .service import WhatsAppService, WhatsAppServiceError


def get_whatsapp_service() -> WhatsAppService:
    return WhatsAppService(service_client=get_service_client())


WhatsAppServiceDep = Annotated[WhatsAppService, Depends(get_whatsapp_service)]
_guest = Annotated[AuthContext, Depends(require_permission(Capability.VIEW_GUEST_FULL))]

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return WhatsAppService().health()


@router.get("/status", response_model=WhatsAppStatus)
def status(service: WhatsAppServiceDep, ctx: _guest) -> WhatsAppStatus:
    return service.status()


@router.get("/conversations", response_model=WhatsAppConversationList)
def list_conversations(
    service: WhatsAppServiceDep, ctx: _guest
) -> WhatsAppConversationList:
    try:
        return service.list_conversations(ctx)
    except WhatsAppServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/conversations/{conversation_id}/messages", response_model=WhatsAppMessageList)
def list_messages(
    conversation_id: str, service: WhatsAppServiceDep, ctx: _guest
) -> WhatsAppMessageList:
    try:
        return service.list_messages(ctx, conversation_id)
    except WhatsAppServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/send", response_model=WhatsAppMessage)
def send(
    req: SendWhatsAppRequest, service: WhatsAppServiceDep, ctx: _guest
) -> WhatsAppMessage:
    try:
        return service.send(
            ctx,
            conversation_id=req.conversation_id,
            to_phone=req.to_phone,
            body=req.body,
        )
    except WhatsAppServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Meta-Webhook (kein JWT) -----------------------------------------------
@router.get("/webhook", include_in_schema=False)
def webhook_verify(
    hub_mode: Annotated[str | None, Query(alias="hub.mode")] = None,
    hub_challenge: Annotated[str | None, Query(alias="hub.challenge")] = None,
    hub_verify_token: Annotated[str | None, Query(alias="hub.verify_token")] = None,
) -> Response:
    """Meta-Verify-Handshake: bei korrektem verify_token den Challenge zurückgeben."""
    expected = get_settings().whatsapp_verify_token.get_secret_value()
    if hub_mode == "subscribe" and expected and hub_verify_token == expected:
        return Response(content=hub_challenge or "", media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verifizierung fehlgeschlagen.")


@router.post("/webhook", include_in_schema=False)
async def webhook_receive(
    request: Request, service: WhatsAppServiceDep
) -> dict:
    """Eingehende Nachrichten/Status von Meta. Antwortet immer 200 (Meta erwartet
    schnelle Bestätigung); Fehler werden geloggt, nicht nach außen gegeben."""
    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001 — defektes JSON → trotzdem 200
        return {"received": 0}
    try:
        return service.ingest_webhook(payload)
    except WhatsAppServiceError:
        return {"received": 0}
