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
    RatePlanMinStayListResponse,
    RatePlanMinStaySet,
    RatePlanPriceListResponse,
    RatePlanPriceSet,
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


@router.get("/{rate_plan_id}/prices", response_model=RatePlanPriceListResponse)
def list_rate_prices(
    rate_plan_id: str, service: RatesServiceDep, ctx: _write
) -> RatePlanPriceListResponse:
    """Datumsgenaue Preise eines Rate-Plans (Hotel: Preis pro Kategorie×Rate×Datum)."""
    try:
        return service.list_prices(ctx, rate_plan_id)
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{rate_plan_id}/prices/resync", status_code=status.HTTP_202_ACCEPTED)
def resync_rate_prices(
    rate_plan_id: str, service: RatesServiceDep, ctx: _write
) -> dict[str, str]:
    """'Jetzt übertragen': Desired-State-Reconcile (DB↔Channex) für das Objekt
    anstoßen. Idempotent/coalesced; der 15-min-Tick macht dasselbe automatisch."""
    try:
        service.resync_prices(ctx, rate_plan_id)
        return {"status": "queued"}
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{rate_plan_id}/prices", response_model=RatePlanPriceListResponse)
def set_rate_prices(
    rate_plan_id: str,
    req: RatePlanPriceSet,
    service: RatesServiceDep,
    ctx: _write,
) -> RatePlanPriceListResponse:
    """Datumsgenauen Preis für [start, end) setzen (price=null nimmt ihn zurück).
    Push an GENAU diesen Rate-Plan; gilt auf allen 3 Vertriebswegen gleich."""
    try:
        return service.set_prices(ctx, rate_plan_id, req)
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{rate_plan_id}/prices", response_model=RatePlanPriceListResponse)
def clear_rate_prices(
    rate_plan_id: str, service: RatesServiceDep, ctx: _write
) -> RatePlanPriceListResponse:
    """ALLE Datumspreise eines Rate-Plans zurücknehmen (Basispreis gilt wieder)."""
    try:
        return service.clear_all_prices(ctx, rate_plan_id)
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{rate_plan_id}/min-stays", response_model=RatePlanMinStayListResponse)
def list_rate_min_stays(
    rate_plan_id: str, service: RatesServiceDep, ctx: _write
) -> RatePlanMinStayListResponse:
    """Datumsgenaue Mindestaufenthalte eines Rate-Plans (Hotel)."""
    try:
        return service.list_min_stays(ctx, rate_plan_id)
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{rate_plan_id}/min-stays", response_model=RatePlanMinStayListResponse)
def set_rate_min_stays(
    rate_plan_id: str,
    req: RatePlanMinStaySet,
    service: RatesServiceDep,
    ctx: _write,
) -> RatePlanMinStayListResponse:
    """Datumsgenauen Mindestaufenthalt für [start, end) setzen (min_stay=null nimmt
    ihn zurück). Push an GENAU diesen Rate-Plan; gilt auf allen 3 Vertriebswegen."""
    try:
        return service.set_min_stays(ctx, rate_plan_id, req)
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{rate_plan_id}/min-stays", response_model=RatePlanMinStayListResponse)
def clear_rate_min_stays(
    rate_plan_id: str, service: RatesServiceDep, ctx: _write
) -> RatePlanMinStayListResponse:
    """ALLE datumsgenauen Mindestaufenthalte zurücknehmen (Rate-Plan-Default gilt)."""
    try:
        return service.clear_all_min_stays(ctx, rate_plan_id)
    except RateError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
