"""Router für reviews. Gemountet unter /api/v1/reviews.

Das Bewertungs-Cockpit des Betriebs (myNextDays) über ALLE Kanäle. Lesen
verlangt VIEW_REVIEWS, jede Aktion MANAGE_REVIEWS — Autorisierung, nicht nur
Authentifizierung (Wurzel 9). Der Detailpfad prüft denselben Objekt-Scope wie
die Liste.
"""
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, status

from src.core.security import require_internal_cron_secret

from .dependencies import AutomationDep, ManageCtx, ReviewsServiceDep, ViewCtx
from .schemas import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    AutomationConfig,
    GuestReviewByHost,
    OtaGuestReviewRequest,
    QualityDashboard,
    QueueEntry,
    QueueListResponse,
    QueueStatus,
    QueueUpdateRequest,
    RateGuestRequest,
    ReplyRequest,
    ReviewListResponse,
    ReviewSource,
    ReviewSummary,
    SliceHealth,
    SyncResponse,
    TickResponse,
    UnifiedReview,
)
from .service import ReviewError

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth()


@router.get("", response_model=ReviewListResponse)
def list_reviews(  # noqa: PLR0913 — Filter des Cockpits, jeder optional
    service: ReviewsServiceDep,
    ctx: ViewCtx,
    source: Annotated[ReviewSource | None, Query()] = None,
    property_id: Annotated[str | None, Query()] = None,
    channel_code: Annotated[str | None, Query(max_length=64)] = None,
    unanswered: Annotated[bool, Query()] = False,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ReviewListResponse:
    """Alle Bewertungen des Betriebs, Marktplatz und Portale in EINER Liste."""
    try:
        return service.list_reviews(
            ctx,
            source=source,
            property_id=property_id,
            channel_code=channel_code,
            unanswered=unanswered,
            limit=limit,
            offset=offset,
        )
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/summary", response_model=ReviewSummary)
def summary(service: ReviewsServiceDep, ctx: ViewCtx) -> ReviewSummary:
    """Kennzahlen je Kanal (Durchschnitt auf 5 Sterne normalisiert)."""
    try:
        return service.summary(ctx)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/automation", response_model=AutomationConfig)
def get_automation(service: ReviewsServiceDep, ctx: ViewCtx) -> AutomationConfig:
    try:
        return service.get_automation(ctx)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/automation", response_model=AutomationConfig)
def set_automation(
    cfg: AutomationConfig, service: ReviewsServiceDep, ctx: ManageCtx
) -> AutomationConfig:
    """Automatik einstellen: Gast automatisch bewerten + Erinnerung an den Gast."""
    try:
        return service.set_automation(ctx, cfg)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/sync", response_model=SyncResponse)
def sync(service: ReviewsServiceDep, ctx: ManageCtx) -> SyncResponse:
    """Portal-Bewertungen jetzt abgleichen (der Tick macht das sonst selbst)."""
    try:
        return SyncResponse(mirrored=service.sync(ctx))
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/guest-rating", response_model=GuestReviewByHost)
def rate_guest(
    req: RateGuestRequest, service: ReviewsServiceDep, ctx: ManageCtx
) -> GuestReviewByHost:
    """Betrieb bewertet einen Gast (Zwei-Wege, myBestDays)."""
    try:
        return service.rate_guest(ctx, req)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/guest-rating/{reservation_id}", response_model=GuestReviewByHost)
def get_guest_rating(
    reservation_id: str, service: ReviewsServiceDep, ctx: ViewCtx
) -> GuestReviewByHost:
    try:
        return service.get_guest_rating(ctx, reservation_id)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/ota/{review_id}/guest-review", response_model=UnifiedReview)
def send_ota_guest_review(
    review_id: str,
    req: OtaGuestReviewRequest,
    service: ReviewsServiceDep,
    ctx: ManageCtx,
) -> UnifiedReview:
    """Gast beim Portal bewerten (nur Airbnb)."""
    try:
        return service.send_ota_guest_review(ctx, review_id, req)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/marketplace/{review_id}/reply", status_code=status.HTTP_204_NO_CONTENT
)
def delete_reply(review_id: str, service: ReviewsServiceDep, ctx: ManageCtx) -> None:
    """Eigene Antwort entfernen — nur auf dem Marktplatz möglich."""
    try:
        service.delete_reply(ctx, review_id)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/quality", response_model=QualityDashboard)
def quality(
    service: ReviewsServiceDep,
    ctx: ViewCtx,
    von: Annotated[date | None, Query(alias="from")] = None,
    bis: Annotated[date | None, Query(alias="to")] = None,
) -> QualityDashboard:
    """Qualitäts-Kennzahlen über einen Zeitraum: Ø, 5-Sterne-Quote,
    Antwortquote, Kategorien, Tagesverlauf und Rangliste je Objekt.
    Ohne Angabe: die letzten 30 Tage."""
    heute = date.today()
    ende = bis or heute
    start = von or (ende - timedelta(days=30))
    try:
        return service.quality(ctx, von=start, bis=ende)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ---- Warteschlange: geplante Bewertungen des Betriebs über seine Gäste ----
@router.get("/queue", response_model=QueueListResponse)
def list_queue(
    service: ReviewsServiceDep,
    ctx: ViewCtx,
    status_filter: Annotated[QueueStatus | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> QueueListResponse:
    """Geplante Bewertungen, nächste Fälligkeit zuerst — mit Restfrist."""
    try:
        return service.list_queue(
            ctx, status=status_filter, limit=limit, offset=offset
        )
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/queue/{entry_id}", response_model=QueueEntry)
def update_queue_entry(
    entry_id: str,
    req: QueueUpdateRequest,
    service: ReviewsServiceDep,
    ctx: ManageCtx,
) -> QueueEntry:
    """Inhalt einer geplanten Bewertung ändern (nur solange sie geplant ist)."""
    try:
        return service.update_queue_entry(ctx, entry_id, req)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/queue/{entry_id}/skip", response_model=QueueEntry)
def skip_queue_entry(
    entry_id: str, service: ReviewsServiceDep, ctx: ManageCtx
) -> QueueEntry:
    """Diesen Gast nicht bewerten. Der Eintrag bleibt als übersprungen stehen —
    der nächste Tick legt ihn dadurch nicht neu an."""
    try:
        return service.skip_queue_entry(ctx, entry_id)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/queue/{entry_id}/send", response_model=QueueEntry)
def send_queue_entry(
    entry_id: str, service: ReviewsServiceDep, ctx: ManageCtx
) -> QueueEntry:
    """Jetzt abschicken statt auf die Fälligkeit zu warten. Unumkehrbar."""
    try:
        return service.send_queue_entry(ctx, entry_id)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/tick", response_model=TickResponse)
def tick(
    service: ReviewsServiceDep,
    automation: AutomationDep,
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> TickResponse:
    """Externer Auslöser für die zeitgesteuerten Vorgänge (der Worker macht
    dasselbe im eigenen Tick). Nur mit gültigem Cron-Secret (fail-closed)."""
    require_internal_cron_secret(x_internal_cron_secret)
    published, mirrored, queued, rated, expired, reminded = service.run_maintenance(
        automation
    )
    return TickResponse(
        published=published,
        mirrored=mirrored,
        queued=queued,
        guest_rated=rated,
        expired=expired,
        reminders_sent=reminded,
    )


# ---- Detail/Antwort zuletzt: {source} würde sonst /summary & Co. abfangen ----
@router.get("/{source}/{review_id}", response_model=UnifiedReview)
def get_review(
    source: ReviewSource, review_id: str, service: ReviewsServiceDep, ctx: ViewCtx
) -> UnifiedReview:
    """Eine Bewertung — mit demselben Objekt-Scope wie die Liste (Wurzel 9)."""
    try:
        return service.get_review(ctx, source, review_id)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{source}/{review_id}/reply", response_model=UnifiedReview)
def reply(
    source: ReviewSource,
    review_id: str,
    req: ReplyRequest,
    service: ReviewsServiceDep,
    ctx: ManageCtx,
) -> UnifiedReview:
    """Öffentlich antworten. Beim Portal geht die Antwort zuerst dorthin und
    wird erst nach Erfolg im eigenen Bestand gespiegelt (Wurzel 1)."""
    try:
        return service.reply(ctx, source, review_id, req.reply)
    except ReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
