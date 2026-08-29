"""Router für whatsapp. Gemountet unter /api/v1/whatsapp.

- Geschützte Endpoints (JWT, view_guest_full): Konversationen/Nachrichten, senden, Status.
- Webhook (kein JWT): GET = Verify-Handshake (hub.challenge), POST = eingehende
  Nachrichten/Status von Meta. Abgesichert über den verify_token.
"""
import hashlib
import hmac
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext, secrets_match
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    OnboardingRequest,
    OnboardingResult,
    OnboardingStartLink,
    OnboardingStatus,
    SendWhatsAppRequest,
    SendWhatsAppTemplateRequest,
    SliceHealth,
    TemplateCreate,
    TemplateUpdate,
    WhatsAppConversationList,
    WhatsAppMessage,
    WhatsAppMessageList,
    WhatsAppStatus,
)
from .service import WhatsAppService, WhatsAppServiceError

log = get_logger("nextdays.whatsapp.router")


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


@router.post("/send-template", response_model=WhatsAppMessage)
def send_template(
    req: SendWhatsAppTemplateRequest, service: WhatsAppServiceDep, ctx: _guest
) -> WhatsAppMessage:
    """Template-Nachricht senden — auch außerhalb des 24-h-Servicefensters."""
    try:
        return service.send_template(
            ctx,
            conversation_id=req.conversation_id,
            to_phone=req.to_phone,
            template_name=req.template_name,
            language_code=req.language_code,
            variables=req.variables,
        )
    except WhatsAppServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/onboarding/startlink", response_model=OnboardingStartLink)
def onboarding_startlink(service: WhatsAppServiceDep, ctx: _guest) -> OnboardingStartLink:
    """Adresse von Metas gehosteter Signup-Seite. App-/Konfigurations-ID bleiben
    serverseitig, damit sie nicht im Frontend-Bundle landen."""
    return service.onboarding_startlink()


@router.post("/onboarding/verbinden", response_model=OnboardingResult)
def onboarding_verbinden(
    req: OnboardingRequest, service: WhatsAppServiceDep, ctx: _guest
) -> OnboardingResult:
    """Embedded-Signup abschließen: Code eintauschen, Kanal des Betriebs anlegen.

    Der Code kommt aus Metas Signup-Fenster und lebt nur ~30 Sekunden, deshalb
    ruft das Frontend diese Route unmittelbar auf. Der Tenant kommt aus dem JWT,
    NICHT aus dem Body — sonst könnte ein Betrieb den Kanal eines anderen
    überschreiben (Wurzel 3).
    """
    try:
        return service.onboarding_verbinden(ctx, code=req.code)
    except WhatsAppServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/onboarding/status", response_model=OnboardingStatus)
def onboarding_status(service: WhatsAppServiceDep, ctx: _guest) -> OnboardingStatus:
    """Kanal-Zustand des Betriebs: verbundene Nummer, Sendebereitschaft, Sperrgrund.

    Das Zugangstoken wird NICHT ausgeliefert — es verlässt den Server nie.
    """
    try:
        return service.onboarding_status(ctx)
    except WhatsAppServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/templates")
def list_templates(service: WhatsAppServiceDep, ctx: _guest) -> dict:
    """Vorlagen der WABA DIESES Betriebs mit Prüfstatus (PENDING/APPROVED/REJECTED)."""
    try:
        return {"items": service.list_templates(ctx)}
    except WhatsAppServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/templates/neu")
def create_template(
    payload: TemplateCreate, service: WhatsAppServiceDep, ctx: _guest
) -> dict:
    """Eine eigene Vorlage in der WABA des Betriebs anlegen (Meta prüft sie)."""
    try:
        return service.create_template(
            ctx,
            name=payload.name,
            language=payload.language,
            category=payload.category,
            body=payload.body,
            examples=payload.examples,
            footer=payload.footer,
        )
    except WhatsAppServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/templates/{template_id}")
def update_template(
    template_id: str,
    payload: TemplateUpdate,
    service: WhatsAppServiceDep,
    ctx: _guest,
) -> dict:
    """Text einer Vorlage ändern. Name und Sprache sind bei Meta unveränderlich."""
    try:
        return service.update_template(
            ctx,
            template_id=template_id,
            body=payload.body,
            examples=payload.examples,
            footer=payload.footer,
        )
    except WhatsAppServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/templates")
def delete_template(
    name: str,
    service: WhatsAppServiceDep,
    ctx: _guest,
    template_id: str | None = None,
) -> dict:
    """Vorlage löschen. Ohne `template_id` löscht Meta alle Sprachfassungen."""
    try:
        return service.delete_template(ctx, name=name, template_id=template_id)
    except WhatsAppServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/templates/rollout")
def rollout_templates(service: WhatsAppServiceDep, ctx: _guest) -> dict:
    """Den myNextDays-Vorlagensatz in die WABA ausrollen (idempotent).

    Wird beim Onboarding einer neuen Nummer aufgerufen. Meta hat keinen
    Bulk-Push über mehrere WABAs — jede Kunden-WABA braucht den Satz einzeln.
    Bereits vorhandene Vorlagen werden übersprungen, einzelne Ablehnungen
    stehen im Ergebnis statt den Lauf abzubrechen.
    """
    try:
        return service.rollout_templates(ctx)
    except WhatsAppServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Meta-Webhook (kein JWT) -----------------------------------------------
@router.get("/webhook", include_in_schema=False)
def webhook_verify(
    hub_mode: Annotated[str | None, Query(alias="hub.mode")] = None,
    hub_challenge: Annotated[str | None, Query(alias="hub.challenge")] = None,
    hub_verify_token: Annotated[str | None, Query(alias="hub.verify_token")] = None,
) -> Response:
    """Meta-Verify-Handshake: bei korrektem verify_token den Challenge zurückgeben.

    Der Token-Vergleich läuft konstant-zeitig (secrets_match, byteweise und robust
    gegen nicht-ASCII-Header), damit ein Angreifer den erwarteten Token nicht per
    Timing-Seitenkanal erraten kann und ein exotischer Header keinen 500 auslöst.
    Fehlender/leerer Token (Konfig- oder Request-Seite) → sauber abgelehnt."""
    expected = get_settings().whatsapp_verify_token.get_secret_value()
    if hub_mode == "subscribe" and secrets_match(hub_verify_token, expected):
        return Response(content=hub_challenge or "", media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verifizierung fehlgeschlagen.")


def _signature_ok(raw_body: bytes, header: str | None, app_secret: str) -> bool:
    """X-Hub-Signature-256 gegen HMAC-SHA256(app_secret, raw_body) prüfen.

    Meta sendet `sha256=<hex>`. Vergleich konstant-zeitig (compare_digest)."""
    if not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(
        app_secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(header.removeprefix("sha256="), expected)


@router.post("/webhook", include_in_schema=False)
async def webhook_receive(
    request: Request, service: WhatsAppServiceDep
) -> dict:
    """Eingehende Nachrichten/Status von Meta.

    Sicherheit: Der ROHE Body wird gegen die `X-Hub-Signature-256` (HMAC mit dem
    App-Secret) geprüft, BEVOR er geparst/verarbeitet wird. Fehlende/falsche
    Signatur → 403. Ohne konfiguriertes App-Secret wird die Prüfung NUR lokal
    (app_env=local) mit Warn-Log übersprungen; in jeder anderen Umgebung lehnt
    der Endpoint hart mit 503 ab (kein Fallback — sonst wäre der öffentliche,
    JWT-lose Endpoint bei fehlkonfiguriertem Secret ein unauthentifizierter
    Injektionspfad für gefälschte Nachrichten in beliebige Konversationen).

    Bei gültiger Signatur antwortet der Endpoint 200 (Meta erwartet schnelle
    Bestätigung); interne Fehler werden geloggt, nicht nach außen gegeben."""
    raw_body = await request.body()
    settings = get_settings()
    app_secret = settings.whatsapp_app_secret.get_secret_value()
    if app_secret:
        if not _signature_ok(
            raw_body, request.headers.get("X-Hub-Signature-256"), app_secret
        ):
            log.warning("whatsapp_webhook_bad_signature")
            raise HTTPException(status_code=403, detail="Ungültige Signatur.")
    elif settings.is_local:
        log.warning("whatsapp_webhook_signature_skipped_no_secret_local")
    else:
        # Prod/Staging ohne Secret: Endpoint deaktivieren statt still offen.
        log.error("whatsapp_webhook_no_secret_configured")
        raise HTTPException(
            status_code=503,
            detail="WHATSAPP_APP_SECRET ist nicht konfiguriert.",
        )

    try:
        payload = json.loads(raw_body)
    except (ValueError, UnicodeDecodeError):  # defektes JSON → trotzdem 200
        return {"received": 0}
    try:
        return service.ingest_webhook(payload)
    except WhatsAppServiceError:
        return {"received": 0}
