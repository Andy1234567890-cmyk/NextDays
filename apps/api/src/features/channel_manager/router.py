"""Router für channel_manager. Gemountet unter /api/v1/channel-manager.

Channel-Manager-Anbindung über Channex (OTA-Distribution). Verwaltende Endpoints
sind tenant-scoped (tenant_id aus dem JWT) und erfordern MANAGE_PROPERTY_SETTINGS.
Der Webhook-Endpoint ist bewusst ohne JWT (Channex ruft ihn auf) und wird über
ein geteiltes Secret im Header abgesichert.
"""
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Header,
    HTTPException,
    Request,
    status,
)

from src.core.config import get_settings
from src.core.security import (
    AuthContext,
    CurrentUser,
    require_internal_cron_secret,
    secrets_match,
)
from src.features.auth.dependencies import require_lodgify_permission
from src.features.auth.lodgify_permissions import Permission

from .dependencies import ChannelManagerServiceDep
from .schemas import (
    AriPushRequest,
    AriPushResponse,
    AvailabilityRuleRequest,
    BookingListResponse,
    BookingSyncResponse,
    ChannelConnectionListResponse,
    ChannelConnectionResponse,
    ChannelListResponse,
    ChannelResponse,
    ChannexDebugResponse,
    ConnectChannelRequest,
    ConnectionToggleRequest,
    CrsBookingRequest,
    GuestReviewRequest,
    NoShowReportRequest,
    OAuthBeginRequest,
    OAuthBeginResponse,
    OAuthFinalizeRequest,
    OAuthStatusResponse,
    PrepareChannelRequest,
    PrepareChannelResponse,
    PropertyConnectRequest,
    PropertyMapListResponse,
    PropertyMapResponse,
    ReviewReplyRequest,
    SliceHealth,
    SupportedPortal,
    ThreadMessageRequest,
    WebhookEventEntry,
)
from .service import ChannelManagerError

router = APIRouter(prefix="/channel-manager", tags=["channel_manager"])

# Schreibrechte für die Channel-Manager-Verwaltung.
_write = Annotated[
    AuthContext, Depends(require_lodgify_permission(Permission.MANAGE_PROPERTY_SETTINGS))
]
# Lesen der Kanal-/Vertriebstopologie (welche Objekte an welche OTAs, Kanal-
# Verbindungsstatus) ist eine Management-Information — dieselbe Capability wie
# das Schreiben. Vorher nur CurrentUser: jeder staff/cleaner/owner konnte die
# komplette Kanal-Topologie des Mandanten einsehen.
_read = _write


@router.get("/health", response_model=SliceHealth)
def health(service: ChannelManagerServiceDep) -> SliceHealth:
    return service.health()


# --- Property-Mapping --------------------------------------------------------
@router.get("/properties", response_model=PropertyMapListResponse)
def list_property_maps(
    ctx: _read, service: ChannelManagerServiceDep
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


# --- Flow-Debugging (channex_debug_log) --------------------------------------
@router.get("/debug/trace", response_model=ChannexDebugResponse)
def list_debug_trace(
    ctx: _read,
    service: ChannelManagerServiceDep,
    property_id: str | None = None,
    limit: int = 100,
) -> ChannexDebugResponse:
    """Letzte Channex-Call-Traces (sichtbares Flow-Debugging), neueste zuerst."""
    try:
        return service.list_debug_trace(ctx, property_id=property_id, limit=limit)
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
    ctx: _read, service: ChannelManagerServiceDep
) -> BookingListResponse:
    # _read (MANAGE_PROPERTY_SETTINGS) wie list_channels — sonst liest jeder
    # staff/cleaner/owner tenant-weite OTA-Buchungen (Zeiträume, Status, Buchungs-
    # IDs), auch für nicht zugeordnete Objekte (§4.3, Vertriebs-/Belegungsschutz).
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
    ctx: _read, service: ChannelManagerServiceDep
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


# --- Airbnb-OAuth (white-label, ohne iFrame) ---------------------------------
@router.post(
    "/properties/{property_id}/channels/{portal_code}/oauth/begin",
    response_model=OAuthBeginResponse,
)
def begin_channel_oauth(
    property_id: str,
    portal_code: str,
    req: OAuthBeginRequest,
    service: ChannelManagerServiceDep,
    ctx: _write,
) -> OAuthBeginResponse:
    """OAuth-Start (Airbnb): inaktiven Kanal anlegen + echte OAuth-URL erzeugen.
    Der Kunde öffnet die URL oder schickt sie dem Eigentümer (Self-Connect)."""
    try:
        result = service.begin_channel_oauth(
            ctx,
            property_id=property_id,
            portal_code=portal_code,
            title=req.title,
            settings=req.settings,
        )
        return OAuthBeginResponse(**result)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/properties/{property_id}/channels/{portal_code}/oauth/status",
    response_model=OAuthStatusResponse,
)
def channel_oauth_status(
    property_id: str,
    portal_code: str,
    service: ChannelManagerServiceDep,
    ctx: _write,
) -> OAuthStatusResponse:
    """Verbindungsstatus pollen (Channex liefert keine Channel-Webhooks). Schreibt
    host_id/Status in die Verbindung → Realtime-Update in offenen Sessions."""
    try:
        result = service.refresh_channel_oauth_status(
            ctx, property_id=property_id, portal_code=portal_code
        )
        return OAuthStatusResponse(**result)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/properties/{property_id}/channels/{portal_code}/oauth/finalize",
    response_model=ChannelResponse,
)
def finalize_oauth_channel(
    property_id: str,
    portal_code: str,
    req: OAuthFinalizeRequest,
    service: ChannelManagerServiceDep,
    ctx: _write,
) -> ChannelResponse:
    """Nach erfolgreicher OAuth-Verbindung: Mapping setzen + Kanal aktivieren."""
    try:
        result = service.finalize_oauth_channel(
            ctx,
            property_id=property_id,
            portal_code=portal_code,
            mappings=[m.model_dump() for m in req.mappings],
        )
        return ChannelResponse(**result)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/properties/{property_id}/connections",
    response_model=ChannelConnectionListResponse,
)
def list_channel_connections(
    property_id: str, ctx: _read, service: ChannelManagerServiceDep
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
    background: BackgroundTasks,
    ctx: _write,
) -> ChannelConnectionResponse:
    """Kanal pro (Objekt × Portal) an-/abschalten (selektiver Verkaufsstopp).
    „Aus" stoppt ARI/Preis-Push und deaktiviert den Channex-Channel; eingehende
    Buchungen werden weiter importiert. Beim Wieder-Anschalten wird im Hintergrund
    frische ARI hergestellt (sonst wäre der OTA-Stand vom Abschaltzeitpunkt)."""
    try:
        result = service.set_connection_active(
            ctx,
            property_id=property_id,
            portal_code=portal_code,
            is_active=req.is_active,
        )
        if req.is_active and ctx.tenant_id:
            background.add_task(
                service.resync_property_ari, ctx.tenant_id, property_id
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

    # Echtes Event → Secret zwingend. Vergleich konstant-zeitig via secrets_match
    # (byteweise, robust gegen nicht-ASCII-Header) — ein einfacher !=-Vergleich
    # wäre ein Timing-Seitenkanal auf das Secret, über das gefälschte Channex-
    # Events (Buchungen/ARI) in fremde Tenants eingespeist werden könnten.
    expected = get_settings().channex_webhook_secret.get_secret_value()
    if not secrets_match(x_channex_webhook_secret, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiges Webhook-Secret."
        )
    return service.ingest_webhook(payload)


# --- Reviews & Scores (Booking.com / Airbnb / Expedia) ------------------------
@router.get("/reviews")
def list_reviews(
    service: ChannelManagerServiceDep, ctx: _read, page: int = 1, limit: int = 50
) -> list[dict]:
    """Gäste-Bewertungen der eigenen Objekte (live von den Portalen)."""
    try:
        return service.list_reviews(ctx, page=page, limit=limit)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/reviews/{review_id}/reply")
def reply_review(
    review_id: str,
    req: ReviewReplyRequest,
    service: ChannelManagerServiceDep,
    ctx: _write,
) -> dict:
    try:
        return service.reply_review(ctx, review_id, req.reply)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/reviews/{review_id}/guest-review")
def send_guest_review(
    review_id: str,
    req: GuestReviewRequest,
    service: ChannelManagerServiceDep,
    ctx: _write,
) -> dict:
    """Gast bewerten (nur Airbnb)."""
    try:
        return service.send_guest_review(ctx, review_id, req.review)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/properties/{map_id}/scores")
def get_property_scores(
    map_id: str,
    service: ChannelManagerServiceDep,
    ctx: _read,
    detailed: bool = False,
) -> dict:
    try:
        return service.get_property_scores(ctx, map_id, detailed=detailed)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Availability Rules (kanal-spezifische Kontingente) ------------------------
@router.get("/properties/{map_id}/availability-rules")
def list_availability_rules(
    map_id: str, service: ChannelManagerServiceDep, ctx: _read
) -> list[dict]:
    try:
        return service.list_availability_rules(ctx, map_id)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/properties/{map_id}/availability-rules",
    status_code=status.HTTP_201_CREATED,
)
def create_availability_rule(
    map_id: str,
    req: AvailabilityRuleRequest,
    service: ChannelManagerServiceDep,
    ctx: _write,
) -> dict:
    try:
        attrs = req.model_dump(exclude_none=True)
        attrs["start_date"] = req.start_date.isoformat()
        if req.end_date is not None:
            attrs["end_date"] = req.end_date.isoformat()
        return service.create_availability_rule(ctx, map_id, attrs)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/availability-rules/{rule_id}")
def update_availability_rule(
    rule_id: str,
    req: AvailabilityRuleRequest,
    service: ChannelManagerServiceDep,
    ctx: _write,
) -> dict:
    try:
        attrs = req.model_dump(exclude_none=True)
        attrs["start_date"] = req.start_date.isoformat()
        if req.end_date is not None:
            attrs["end_date"] = req.end_date.isoformat()
        return service.update_availability_rule(ctx, rule_id, attrs)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/availability-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_availability_rule(
    rule_id: str, service: ChannelManagerServiceDep, ctx: _write
) -> None:
    try:
        service.delete_availability_rule(ctx, rule_id)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Reporting API (Booking.com: No-Show / ungültige Karte) --------------------
@router.post("/bookings/{channex_booking_id}/report/no-show")
def report_no_show(
    channex_booking_id: str,
    req: NoShowReportRequest,
    service: ChannelManagerServiceDep,
    ctx: _write,
) -> dict:
    try:
        return service.report_no_show(
            ctx, channex_booking_id, waived_fees=req.waived_fees
        )
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bookings/{channex_booking_id}/report/invalid-card")
def report_invalid_card(
    channex_booking_id: str, service: ChannelManagerServiceDep, ctx: _write
) -> dict:
    try:
        return service.report_invalid_card(ctx, channex_booking_id)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bookings/{channex_booking_id}/report/cancel-invalid-card")
def report_cancel_due_invalid_card(
    channex_booking_id: str, service: ChannelManagerServiceDep, ctx: _write
) -> dict:
    try:
        return service.report_cancel_due_invalid_card(ctx, channex_booking_id)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Message-Threads (inkl. Airbnb-Inquiries ohne Buchung) ---------------------
@router.get("/threads")
def list_message_threads(
    service: ChannelManagerServiceDep, ctx: _read, page: int = 1, limit: int = 50
) -> list[dict]:
    try:
        return service.list_message_threads(ctx, page=page, limit=limit)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/threads/{thread_id}/messages")
def get_thread_messages(
    thread_id: str,
    service: ChannelManagerServiceDep,
    ctx: _read,
    page: int = 1,
    limit: int = 50,
) -> list[dict]:
    try:
        return service.get_thread_messages(ctx, thread_id, page=page, limit=limit)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/threads/{thread_id}/messages")
def send_thread_message(
    thread_id: str,
    req: ThreadMessageRequest,
    service: ChannelManagerServiceDep,
    ctx: _write,
) -> dict:
    try:
        return service.send_thread_message(ctx, thread_id, req.message)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/threads/{thread_id}/close")
def close_message_thread(
    thread_id: str, service: ChannelManagerServiceDep, ctx: _write
) -> dict:
    try:
        return service.close_message_thread(ctx, thread_id)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/threads/{thread_id}/no-reply-needed")
def mark_thread_no_reply_needed(
    thread_id: str, service: ChannelManagerServiceDep, ctx: _write
) -> dict:
    """Nur Booking.com: Thread als „keine Antwort nötig" markieren."""
    try:
        return service.mark_thread_no_reply_needed(ctx, thread_id)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Booking CRS (PMS-Änderungen an Channex zurückspiegeln; Beta) --------------
@router.post("/crs/bookings", status_code=status.HTTP_201_CREATED)
def crs_create_booking(
    req: CrsBookingRequest, service: ChannelManagerServiceDep, ctx: _write
) -> dict:
    try:
        return service.crs_create_booking(ctx, req.booking)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/crs/bookings/{channex_booking_id}")
def crs_update_booking(
    channex_booking_id: str,
    req: CrsBookingRequest,
    service: ChannelManagerServiceDep,
    ctx: _write,
) -> dict:
    try:
        return service.crs_update_booking(ctx, channex_booking_id, req.booking)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Webhook-Ereignisliste (Airbnb-Anfragen, Sync-Fehler, Reviews, Kanäle) -----
@router.get("/events", response_model=list[WebhookEventEntry])
def list_webhook_events(
    service: ChannelManagerServiceDep,
    ctx: _read,
    only_unresolved: bool = False,
    limit: int = 100,
) -> list[WebhookEventEntry]:
    try:
        rows = service.list_webhook_events(
            ctx, only_unresolved=only_unresolved, limit=limit
        )
        return [WebhookEventEntry(**r) for r in rows]
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/events/{event_id}/resolve", status_code=status.HTTP_204_NO_CONTENT)
def resolve_webhook_event(
    event_id: str, service: ChannelManagerServiceDep, ctx: _write
) -> None:
    try:
        service.resolve_webhook_event(ctx, event_id)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Full-Sync manuell auslösen -------------------------------------------------
@router.post("/properties/{map_id}/full-sync", status_code=status.HTTP_202_ACCEPTED)
def trigger_full_sync(
    map_id: str, service: ChannelManagerServiceDep, ctx: _write
) -> dict:
    """Voll-Abgleich DB→Channex einreihen (zusätzlich zum nächtlichen Lauf)."""
    try:
        return service.trigger_full_sync(ctx, map_id)
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/internal/reconcile", include_in_schema=False)
async def internal_reconcile(
    service: ChannelManagerServiceDep,
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict:
    """Interner Cron-Trigger: spiegelt Channex→DB für ALLE Tenants (Channex =
    Quelle der Wahrheit). Kein JWT — via eigenem INTERNAL_CRON_SECRET abgesichert
    (nie das outbound geteilte Channex-Webhook-Secret), getriggert durch einen
    Coolify-Scheduled-Task / Host-crontab (curl)."""
    require_internal_cron_secret(x_internal_cron_secret)
    try:
        return service.reconcile_all_tenants()
    except ChannelManagerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
