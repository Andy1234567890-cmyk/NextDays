"""Router für booking_conditions. Gemountet unter /api/v1/booking-conditions.

Buchungs-Konditionen (Zahlungsplan/Storno/Kaution) sind sensible Finanzdaten →
JEDE Route verlangt AUTORISIERUNG (manage_property_conditions), nicht nur
Authentifizierung (Wurzel 9). Tenant-Scope erzwingt der Service.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import AuthContext
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission

from .dependencies import BookingConditionServiceDep
from .schemas import (
    BookingConditionCreate,
    BookingConditionResponse,
    BookingConditionUpdate,
    SliceHealth,
)
from .service import BookingConditionError

router = APIRouter(prefix="/booking-conditions", tags=["booking_conditions"])

# Konditionen = Finanzbedingungen → dieselbe Berechtigung für alle Routen.
_ctx = Annotated[  # noqa: N816  pylint: disable=invalid-name
    AuthContext,
    Depends(require_granular_permission(Permission.MANAGE_PROPERTY_CONDITIONS)),
]


@router.get("/health", response_model=SliceHealth)
def health(service: BookingConditionServiceDep) -> SliceHealth:
    return service.health()


@router.get("", response_model=list[BookingConditionResponse])
def list_conditions(
    ctx: _ctx, service: BookingConditionServiceDep
) -> list[BookingConditionResponse]:
    try:
        return service.list(ctx)
    except BookingConditionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "", response_model=BookingConditionResponse, status_code=status.HTTP_201_CREATED
)
def create_condition(
    req: BookingConditionCreate, ctx: _ctx, service: BookingConditionServiceDep
) -> BookingConditionResponse:
    try:
        return service.create(ctx, req)
    except BookingConditionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{condition_id}", response_model=BookingConditionResponse)
def get_condition(
    condition_id: str, ctx: _ctx, service: BookingConditionServiceDep
) -> BookingConditionResponse:
    try:
        return service.get(ctx, condition_id)
    except BookingConditionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{condition_id}", response_model=BookingConditionResponse)
def update_condition(
    condition_id: str,
    req: BookingConditionUpdate,
    ctx: _ctx,
    service: BookingConditionServiceDep,
) -> BookingConditionResponse:
    try:
        return service.update(ctx, condition_id, req)
    except BookingConditionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{condition_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_condition(
    condition_id: str, ctx: _ctx, service: BookingConditionServiceDep
) -> None:
    try:
        service.delete(ctx, condition_id)
    except BookingConditionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{condition_id}/default", response_model=BookingConditionResponse)
def set_default_condition(
    condition_id: str, ctx: _ctx, service: BookingConditionServiceDep
) -> BookingConditionResponse:
    try:
        return service.set_default(ctx, condition_id)
    except BookingConditionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
