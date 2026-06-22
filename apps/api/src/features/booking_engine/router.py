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
    PublicAvailabilityResponse,
    PublicBookingRequest,
    PublicBookingResponse,
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
