"""Router für reservations. Gemountet unter /api/v1/reservations."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from src.core.security import CurrentUser
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    ReservationCreate,
    ReservationListResponse,
    ReservationResponse,
    SliceHealth,
)
from .service import ReservationError, ReservationsService

router = APIRouter(prefix="/reservations", tags=["reservations"])


def get_reservations_service() -> ReservationsService:
    return ReservationsService(service_client=get_service_client())


ReservationsServiceDep = Annotated[
    ReservationsService, Depends(get_reservations_service)
]


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="reservations")


@router.get("", response_model=ReservationListResponse)
def list_reservations(
    service: ReservationsServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_id: Annotated[str | None, Query()] = None,
) -> ReservationListResponse:
    try:
        return service.list(ctx, property_id)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=ReservationResponse)
def create_reservation(
    req: ReservationCreate,
    service: ReservationsServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> ReservationResponse:
    try:
        return service.create(ctx, req)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
