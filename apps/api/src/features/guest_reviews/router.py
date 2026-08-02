"""Router für guest_reviews. Gemountet unter /api/v1/guest-reviews.

Bewertungen des myBestDays-Marktplatzes aus GAST-Sicht. Der Lesepfad je Objekt
ist ÖFFENTLICH (kein Guard, wie booking_engine — Bewertungen sind Produktdaten)
und liefert maskiert (kein Name/E-Mail/guest_id, Wurzel 9). Alles Gast-bezogene
(eigene Liste, abgeben, ändern) verlangt ein Portal-Gast-Token (CurrentGuest);
der Scope wird server-seitig über guest_id/E-Mail erzwungen (Wurzel 3/9).

Die Betriebs-Seite (Cockpit, antworten, Gast bewerten, Automatik) liegt unter
/api/v1/reviews — Slice `reviews`.
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from src.core.security import CurrentGuest, require_internal_cron_secret
from src.core.supabase import get_service_client

from .schemas import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    CreateReviewRequest,
    MyReview,
    MyReviewsResponse,
    PublicReviewsResponse,
    SliceHealth,
    UpdateReviewRequest,
)
from .service import GuestReviewError, GuestReviewsService


def get_guest_reviews_service() -> GuestReviewsService:
    return GuestReviewsService(service_client=get_service_client())


GuestReviewsServiceDep = Annotated[
    GuestReviewsService, Depends(get_guest_reviews_service)
]

router = APIRouter(prefix="/guest-reviews", tags=["guest_reviews"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return GuestReviewsService().health()


@router.get("/property/{property_id}", response_model=PublicReviewsResponse)
def public_reviews(
    property_id: str,
    service: GuestReviewsServiceDep,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PublicReviewsResponse:
    """ÖFFENTLICH: maskierte Bewertungen eines Objekts + Durchschnitt/Count.
    Kein Name/E-Mail/guest_id in der Antwort (Wurzel 9); Pagination (Wurzel 8)."""
    try:
        return service.public_reviews(property_id, limit=limit, offset=offset)
    except GuestReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/tenant/{tenant_id}", response_model=PublicReviewsResponse)
def tenant_reviews(
    tenant_id: str,
    service: GuestReviewsServiceDep,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> PublicReviewsResponse:
    """ÖFFENTLICH: maskierte Bewertungen ALLER Objekte eines Betriebs + Aggregat.

    Speist den Bewertungs-Block der white-label Website (builder). Dieselbe
    Maskierung und derselbe Pagination-Deckel wie der Objekt-Pfad; sichtbar ist
    nur, was veröffentlicht ist. Der tenant-gescopte öffentliche Lesepfad ist
    kein neues Zugeständnis — die Objektliste desselben Betriebs ist über
    `booking-engine/listings?tenant=` schon öffentlich."""
    try:
        return service.tenant_reviews(tenant_id, limit=limit)
    except GuestReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/mine", response_model=MyReviewsResponse)
def my_reviews(
    ctx: CurrentGuest,
    service: GuestReviewsServiceDep,
) -> MyReviewsResponse:
    """Eigene Bewertungen des eingeloggten Gasts (portal_guest_id == ctx.guest_id)."""
    try:
        return service.my_reviews(ctx.guest_id)
    except GuestReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=MyReview)
def create_review(
    req: CreateReviewRequest,
    ctx: CurrentGuest,
    service: GuestReviewsServiceDep,
) -> MyReview:
    """Bewertung abgeben. Server prüft echten, abgeschlossenen Gast (E-Mail-Match
    + status/check_out), leitet property_id aus der Reservierung ab (Wurzel 3) und
    ist idempotent über UNIQUE(reservation_id, portal_guest_id) → 409 (Wurzel 2)."""
    try:
        return service.create_review(ctx.guest_id, ctx.email, req, today=date.today())
    except GuestReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{review_id}", response_model=MyReview)
def update_review(
    review_id: str,
    req: UpdateReviewRequest,
    ctx: CurrentGuest,
    service: GuestReviewsServiceDep,
) -> MyReview:
    """Eigene Bewertung ändern (rating/text). Nur wenn portal_guest_id ==
    ctx.guest_id, sonst 404 (Wurzel 9). host_reply ist Betriebs-Seite, hier gesperrt."""
    try:
        return service.update_review(ctx.guest_id, review_id, req)
    except GuestReviewError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/publish-overdue")
def publish_overdue(
    service: GuestReviewsServiceDep,
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict[str, int]:
    """Cron: einseitige Reviews nach der 14-Tage-Frist veröffentlichen (double-
    blind). Nur mit gültigem internen Cron-Secret (fail-closed, Wurzel 5).
    Derselbe Schritt läuft im Worker-Tick des reviews-Slice — dieser Endpunkt
    bleibt als externer Auslöser bestehen."""
    require_internal_cron_secret(x_internal_cron_secret)
    return {"published": service.publish_overdue()}
