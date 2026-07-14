"""Router für rates. Gemountet unter /api/v1/rates.

Preispläne (rate_plans) pro Objekt — tenant-gescoped, MANAGE_PROPERTY_SETTINGS.
Anlegen/Ändern löst den Channex-Sync der Property aus.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission

from .schemas import (
    RatePlanCreate,
    RatePlanListResponse,
    RatePlanResponse,
    RatePlanUpdate,
    SliceHealth,
)
from .service import RateError, RatesService


def get_rates_service() -> RatesService:
    return RatesService(service_client=get_service_client())


RatesServiceDep = Annotated[RatesService, Depends(get_rates_service)]

_write = Annotated[
    AuthContext, Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS))
]

router = APIRouter(prefix="/rates", tags=["rates"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return RatesService().health()


@router.get("", response_model=RatePlanListResponse)
def list_rates(
    service: RatesServiceDep,
    ctx: _write,
    property_id: Annotated[str, Query()],
) -> RatePlanListResponse:
    try:
        return service.list(ctx, property_id)
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=RatePlanResponse, status_code=status.HTTP_201_CREATED)
def create_rate(
    req: RatePlanCreate, service: RatesServiceDep, ctx: _write
) -> RatePlanResponse:
    try:
        return service.create(ctx, req)
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/base-price", response_model=RatePlanResponse)
def set_base_price(
    req: RatePlanCreate, service: RatesServiceDep, ctx: _write
) -> RatePlanResponse:
    """Basispreis setzen (Upsert: ersten Plan ändern oder anlegen). Idempotent."""
    try:
        return service.set_base_price(ctx, req)
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{rate_plan_id}", response_model=RatePlanResponse)
def update_rate(
    rate_plan_id: str, req: RatePlanUpdate, service: RatesServiceDep, ctx: _write
) -> RatePlanResponse:
    try:
        return service.update(ctx, rate_plan_id, req)
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{rate_plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rate(rate_plan_id: str, service: RatesServiceDep, ctx: _write) -> None:
    try:
        service.delete(ctx, rate_plan_id)
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
