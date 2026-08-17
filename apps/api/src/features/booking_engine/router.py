"""Router für booking_engine. Gemountet unter /api/v1/booking-engine.

Öffentliche Buchungsstrecke der eigenen Plattform (/plattform). KEIN JWT — die
Endpunkte sind bewusst public (Gäste buchen). tenant_id wird serverseitig aus der
Property abgeleitet; Double-Booking-Schutz + Channex-Push laufen im Service.
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from src.core.supabase import get_service_client

from .schemas import (
    PostBookingAddonRequest,
    PublicAvailabilityResponse,
    PublicBookingRequest,
    PublicBookingResponse,
    PublicDestinationListResponse,
    PublicListingDetail,
    PublicListingListResponse,
    PublicQuoteRequest,
    PublicQuoteResponse,
    ReservationAddonsView,
    SitemapEntry,
    SitemapResponse,
    SliceHealth,
)
from .service import BookingEngineError, BookingEngineService


def get_booking_engine_service() -> BookingEngineService:
    return BookingEngineService(service_client=get_service_client())


BookingEngineServiceDep = Annotated[
    BookingEngineService, Depends(get_booking_engine_service)
]

router = APIRouter(prefix="/booking-engine", tags=["booking_engine"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return BookingEngineService().health()


@router.get("/listings", response_model=PublicListingListResponse)
def listings(
    service: BookingEngineServiceDep,
    q: Annotated[str | None, Query()] = None,
    guests: Annotated[int | None, Query(ge=1)] = None,
    start: Annotated[date | None, Query()] = None,
    end: Annotated[date | None, Query()] = None,
    tenant: Annotated[str | None, Query()] = None,
    property_ids: Annotated[list[str] | None, Query()] = None,
    lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    lng: Annotated[float | None, Query(ge=-180, le=180)] = None,
    radius_km: Annotated[float | None, Query(gt=0, le=500)] = None,
) -> PublicListingListResponse:
    """Öffentliche Liste buchbarer (active) Objekte. Optional q/guests/start/end/
    tenant. ``property_ids`` schränkt auf konkrete Objekte ein (Featured-Block der
    white-label Sites). ``lat``/``lng`` (+ optional ``radius_km``) filtern und
    sortieren nach Entfernung (Standortsuche der App). Default: alle active
    tenant-übergreifend (Marktplatz)."""
    try:
        return service.list_listings(
            q=q,
            guests=guests,
            start=start,
            end=end,
            tenant=tenant,
            property_ids=property_ids,
            lat=lat,
            lng=lng,
            radius_km=radius_km,
        )
    except BookingEngineError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/destinations", response_model=PublicDestinationListResponse)
def destinations(
    service: BookingEngineServiceDep,
    q: Annotated[str | None, Query(max_length=100)] = None,
    tenant: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 8,
) -> PublicDestinationListResponse:
    """Echte Reiseziele (Städte/Länder mit buchbaren Objekten) für die Vorschläge
    im Suchfeld. `q` filtert Stadt- und Landesname. Dieselbe Sichtbarkeit wie
    ``/listings`` — es wird nichts vorgeschlagen, was die Suche leer lässt."""
    try:
        return service.list_destinations(q=q, tenant=tenant, limit=limit)
    except BookingEngineError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/listings/{listing_id}", response_model=PublicListingDetail)
def listing_detail(
    listing_id: str,
    service: BookingEngineServiceDep,
    start: Annotated[date | None, Query()] = None,
    end: Annotated[date | None, Query()] = None,
) -> PublicListingDetail:
    """Detail eines active Objekts (404, wenn nicht active)."""
    try:
        return service.listing_detail(listing_id, start=start, end=end)
    except BookingEngineError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/sitemap", response_model=SitemapResponse)
def sitemap(service: BookingEngineServiceDep) -> SitemapResponse:
    """Aktive, suchmaschinen-indexierbare Objekte (id + updated_at) für die
    Sitemap der Plattform. noindex-Objekte tauchen hier NICHT auf."""
    return SitemapResponse(
        items=[SitemapEntry(**e) for e in service.sitemap_entries()]
    )


@router.get("/availability", response_model=PublicAvailabilityResponse)
def availability(
    service: BookingEngineServiceDep,
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> PublicAvailabilityResponse:
    try:
        return service.public_availability(property_id, start, end)
    except BookingEngineError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/quote", response_model=PublicQuoteResponse)
def public_quote(
    req: PublicQuoteRequest,
    service: BookingEngineServiceDep,
) -> PublicQuoteResponse:
    """Preisaufschlüsselung vor der Buchung (Gebühren + Abgaben inbegriffen).

    Ohne diesen Endpunkt müsste das Gast-Widget selbst rechnen — es zeigte
    Nächte × Grundpreis und verschwiege Reinigung, Haustiergebühr und Kurtaxe,
    die der Server anschließend berechnet.
    """
    try:
        return service.public_quote(req)
    except BookingEngineError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/reservations", response_model=PublicBookingResponse)
def create_booking(
    req: PublicBookingRequest,
    service: BookingEngineServiceDep,
) -> PublicBookingResponse:
    try:
        return service.create_public_booking(req)
    except BookingEngineError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/reservations/{reservation_id}/addons", response_model=ReservationAddonsView
)
def reservation_addons(
    reservation_id: str,
    service: BookingEngineServiceDep,
    email: Annotated[str, Query()],
) -> ReservationAddonsView:
    """Nach-Buchung-Sicht des Gasts: buchbare guest_portal-Add-ons + gekaufte.
    Verifikation über die Buchungs-E-Mail (Gäste haben keinen Login)."""
    try:
        return service.reservation_addons_view(
            reservation_id, email, today=date.today()
        )
    except BookingEngineError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservations/{reservation_id}/addons", response_model=ReservationAddonsView
)
def buy_reservation_addons(
    reservation_id: str,
    req: PostBookingAddonRequest,
    service: BookingEngineServiceDep,
) -> ReservationAddonsView:
    """Nachträglicher Add-on-Kauf durch den Gast (Verkaufsfläche guest_portal)."""
    try:
        return service.purchase_post_booking_addons(
            reservation_id, req, today=date.today()
        )
    except BookingEngineError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
