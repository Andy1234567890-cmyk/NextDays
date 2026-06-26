"""Router für channel_manager. Gemountet unter /api/v1/channel-manager.

Channel-Manager-Anbindung über Channex (OTA-Distribution). Verwaltende Endpoints
sind tenant-scoped (tenant_id aus dem JWT) und erfordern MANAGE_PROPERTY_SETTINGS.
Der Webhook-Endpoint ist bewusst ohne JWT (Channex ruft ihn auf) und wird über
ein geteiltes Secret im Header abgesichert.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from src.core.config import get_settings
from src.core.security import AuthContext, CurrentUser
from src.features.auth.dependencies import require_lodgify_permission
from src.features.auth.lodgify_permissions import Permission

from .dependencies import ChannelManagerServiceDep
from .schemas import (
    AriPushRequest,
    AriPushResponse,
    BookingListResponse,
    BookingSyncResponse,
    ChannelConnectionListResponse,
    ChannelConnectionResponse,
    ChannelListResponse,
    ChannelResponse,
    ConnectChannelRequest,
    ConnectionToggleRequest,
    PrepareChannelRequest,
    PrepareChannelResponse,
    PropertyConnectRequest,
    PropertyMapListResponse,
    PropertyMapResponse,
    SliceHealth,
    SupportedPortal,
)
from .service import ChannelManagerError

router = APIRouter(prefix="/channel-manager", tags=["channel_manager"])

# Schreibrechte für die Channel-Manager-Verwaltung.
_write = Annotated[
    AuthContext, Depends(require_lodgify_permission(Permission.MANAGE_PROPERTY_SETTINGS))
]


@router.get("/health", response_model=SliceHealth)
def health(service: ChannelManagerServiceDep) -> SliceHealth:
    return service.health()


# --- Property-Mapping --------------------------------------------------------
@router.get("/properties", response_model=PropertyMapListResponse)
def list_property_maps(
    ctx: CurrentUser, service: ChannelManagerServiceDep
) -> PropertyMapListResponse:
    try:
        return service.list_property_maps(ctx)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/properties",
    response_model=PropertyMapResponse,
    status_code=status.HTTP_201_CREATED,
)
def connect_property(
    req: PropertyConnectRequest, service: ChannelManagerServiceDep, ctx: _write
) -> PropertyMapResponse:
    try:
        return service.connect_property(ctx, req)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/properties/{map_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_property(
    map_id: str, service: ChannelManagerServiceDep, ctx: _write
) -> None:
    try:
        service.disconnect_property(ctx, map_id)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- ARI-Push ----------------------------------------------------------------
@router.post("/ari", response_model=AriPushResponse)
def push_ari(
    req: AriPushRequest, service: ChannelManagerServiceDep, ctx: _write
) -> AriPushResponse:
    """Verfügbarkeit + Preise/Restriktionen gebündelt an die Kanäle pushen."""
    try:
        return service.push_ari(ctx, req)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Bookings ----------------------------------------------------------------
@router.get("/bookings", response_model=BookingListResponse)
def list_bookings(
    ctx: CurrentUser, service: ChannelManagerServiceDep
) -> BookingListResponse:
    try:
        return service.list_bookings(ctx)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bookings/sync", response_model=BookingSyncResponse)
def sync_bookings(
    service: ChannelManagerServiceDep, ctx: _write
) -> BookingSyncResponse:
    """Eingehende Kanal-Buchungen abrufen, speichern und bestätigen."""
    try:
        return service.sync_bookings(ctx)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Kanäle (OTA) inhouse: Katalog, Liste, Verbinden, Trennen ----------------
@router.get("/portals", response_model=list[SupportedPortal])
def list_portals(
    ctx: CurrentUser, service: ChannelManagerServiceDep
) -> list[SupportedPortal]:
    """Unterstützte Portale + Felder für die eigene Verbinden-Maske."""
    return [SupportedPortal(**p) for p in service.list_supported_portals()]


@router.get("/channels", response_model=ChannelListResponse)
def list_channels(
    ctx: CurrentUser, service: ChannelManagerServiceDep
) -> ChannelListResponse:
    try:
        items = service.list_channels(ctx)
        return ChannelListResponse(
            items=[ChannelResponse(**c) for c in items], total=len(items)
        )
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/channels/prepare", response_model=PrepareChannelResponse)
def prepare_channel(
    req: PrepareChannelRequest, service: ChannelManagerServiceDep, ctx: _write
) -> PrepareChannelResponse:
    """Schritt 1+2: Zugangsdaten prüfen + OTA-Zimmer/Raten holen (legt nichts an)."""
    try:
        data = service.prepare_channel(
            ctx,
            property_id=req.property_id,
            portal_code=req.portal_code,
            settings=req.settings,
        )
        return PrepareChannelResponse(**data)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/channels", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
def connect_channel(
    req: ConnectChannelRequest, service: ChannelManagerServiceDep, ctx: _write
) -> ChannelResponse:
    """Schritt 3+4: Kanal mit Zimmer/Raten-Zuordnung anlegen und aktivieren."""
    try:
        c = service.connect_channel(
            ctx,
            property_id=req.property_id,
            portal_code=req.portal_code,
            title=req.title,
            settings=req.settings,
            mappings=[m.model_dump() for m in req.mappings],
        )
        return ChannelResponse(**c)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_channel(
    channel_id: str, service: ChannelManagerServiceDep, ctx: _write
) -> None:
    try:
        service.disconnect_channel(ctx, channel_id)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/properties/{property_id}/connections",
    response_model=ChannelConnectionListResponse,
)
def list_channel_connections(
    property_id: str, ctx: CurrentUser, service: ChannelManagerServiceDep
) -> ChannelConnectionListResponse:
    """Gespeicherte OTA-Verbindungen eines Objekts (Hotel-ID + Status pro Portal)."""
    try:
        items = service.list_channel_connections(ctx, property_id)
        return ChannelConnectionListResponse(
            items=[ChannelConnectionResponse(**c) for c in items],
            total=len(items),
        )
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch(
    "/properties/{property_id}/connections/{portal_code}",
    response_model=ChannelConnectionResponse,
)
def set_connection_active(
    property_id: str,
    portal_code: str,
    req: ConnectionToggleRequest,
    service: ChannelManagerServiceDep,
    ctx: _write,
) -> ChannelConnectionResponse:
    """Kanal pro (Objekt × Portal) an-/abschalten (selektiver Verkaufsstopp).
    „Aus" stoppt ARI/Preis-Push und deaktiviert den Channex-Channel; eingehende
    Buchungen werden weiter importiert."""
    try:
        result = service.set_connection_active(
            ctx,
            property_id=property_id,
            portal_code=portal_code,
            is_active=req.is_active,
        )
        return ChannelConnectionResponse(**result)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Webhook-Registrierung bei Channex (Admin) -------------------------------
@router.get("/webhooks")
def list_webhooks(service: ChannelManagerServiceDep, ctx: _write) -> list[dict]:
    """Registrierte Kanal-Webhooks anzeigen (Admin/Diagnose)."""
    try:
        return service.list_registered_webhooks()
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/webhooks/register")
def register_webhook(service: ChannelManagerServiceDep, ctx: _write) -> dict:
    """Globalen Webhook bei Channex registrieren (idempotent). Callback-URL wird
    aus PUBLIC_API_URL abgeleitet (muss von außen per HTTPS erreichbar sein)."""
    base = get_settings().public_api_url.rstrip("/")
    if not base:
        raise HTTPException(
            status_code=400,
            detail="PUBLIC_API_URL ist nicht gesetzt (öffentliche HTTPS-URL nötig).",
        )
    callback_url = f"{base}/api/v1/channel-manager/webhook"
    try:
        wh = service.register_global_webhook(callback_url=callback_url)
        return {"callback_url": callback_url, "webhook": wh}
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Webhook (ohne JWT; via geteiltes Secret abgesichert) --------------------
@router.get("/webhook", include_in_schema=False)
@router.head("/webhook", include_in_schema=False)
async def channex_webhook_health() -> dict[str, str]:
    """Health-/Erreichbarkeits-Ping. Channex (und Monitore) prüfen die URL per
    GET/HEAD — wir antworten freundlich mit 200, sonst wertet Channex das
    Anlegen als 'Operation failed'."""
    return {"status": "ok"}


@router.post("/webhook", include_in_schema=False)
async def channex_webhook(
    request: Request,
    service: ChannelManagerServiceDep,
    x_channex_webhook_secret: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    """Empfängt Channex-Webhooks.

    Channex sendet beim Einrichten/Validieren einen Test-Ping OHNE unseren
    geheimen Header → solche leeren Pings beantworten wir mit 200 (sonst
    'Operation failed' im Dashboard). ECHTE Events (mit 'event'-Feld) müssen
    das geteilte Secret tragen (Channex signiert nicht via HMAC)."""
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # Leerer Test-Ping (kein Event) → freundlich bestätigen, kein Secret nötig.
    if not isinstance(payload, dict) or not payload.get("event"):
        return {"status": "ok"}

    # Echtes Event → Secret zwingend.
    expected = get_settings().channex_webhook_secret.get_secret_value()
    if not expected or x_channex_webhook_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiges Webhook-Secret."
        )
    return service.ingest_webhook(payload)


@router.post("/internal/reconcile", include_in_schema=False)
async def internal_reconcile(
    service: ChannelManagerServiceDep,
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict:
    """Interner Cron-Trigger: spiegelt Channex→DB für ALLE Tenants (Channex =
    Quelle der Wahrheit). Kein JWT — via geteiltes Secret abgesichert, getriggert
    durch einen Coolify-Scheduled-Task / Host-crontab (curl). Wiederverwendet das
    CHANNEX_WEBHOOK_SECRET, damit kein neuer Env-Wert nötig ist."""
    expected = get_settings().channex_webhook_secret.get_secret_value()
    if not expected or x_internal_cron_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiges Secret."
        )
    try:
        return service.reconcile_all_tenants()
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
