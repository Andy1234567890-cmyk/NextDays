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
    PublicListingDetail,
    PublicListingListResponse,
    ReservationAddonsView,
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
) -> PublicListingListResponse:
    """Öffentliche Liste buchbarer (active) Objekte. Optional q/guests/start/end/
    tenant. ``property_ids`` schränkt auf konkrete Objekte ein (Featured-Block der
    white-label Sites). Default: alle active tenant-übergreifend (Marktplatz)."""
    try:
        return service.list_listings(
            q=q,
            guests=guests,
            start=start,
            end=end,
            tenant=tenant,
            property_ids=property_ids,
        )
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
