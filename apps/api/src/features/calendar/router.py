"""Router für calendar. Gemountet unter /api/v1/calendar."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from src.core.security import CurrentUser
from src.core.supabase import get_service_client
from src.features.auth.dependencies import (
    require_lodgify_permission,
    require_permission,
)
from src.features.auth.lodgify_permissions import Permission
from src.features.auth.permissions import Capability

from .schemas import (
    AvailabilityCheck,
    BlockRequest,
    DateRange,
    DayAvailability,
    PriceOverrideRequest,
    SeasonPriceListResponse,
    SeasonPriceRequest,
    SliceHealth,
    StopSellClearRequest,
    StopSellListResponse,
    StopSellRequest,
)
from .service import CalendarError, CalendarService

router = APIRouter(prefix="/calendar", tags=["calendar"])


def get_calendar_service() -> CalendarService:
    return CalendarService(client=get_service_client())


CalendarServiceDep = Annotated[CalendarService, Depends(get_calendar_service)]


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="calendar")


@router.get("/availability", response_model=list[DayAvailability])
def availability(
    service: CalendarServiceDep,
    _ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> list[DayAvailability]:
    try:
        return service.get_availability(property_id, DateRange(start=start, end=end))
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/check", response_model=AvailabilityCheck)
def check(
    service: CalendarServiceDep,
    _ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> AvailabilityCheck:
    try:
        return service.check_availability(property_id, DateRange(start=start, end=end))
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/block", dependencies=[
    Depends(require_lodgify_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def block(
    req: BlockRequest,
    service: CalendarServiceDep,
    _ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, int]:
    try:
        return {"blocked_days": service.block(req)}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/price-override", dependencies=[
    Depends(require_lodgify_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def price_override(
    req: PriceOverrideRequest,
    service: CalendarServiceDep,
    _ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, str]:
    try:
        service.set_price_override(req)
        return {"status": "ok"}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/stop-sell", response_model=StopSellListResponse)
def list_stop_sell(
    service: CalendarServiceDep,
    _ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> StopSellListResponse:
    try:
        items = service.list_stop_sell(property_id, DateRange(start=start, end=end))
        return StopSellListResponse(items=items, total=len(items))
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/stop-sell", dependencies=[
    Depends(require_lodgify_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def set_stop_sell(
    req: StopSellRequest,
    service: CalendarServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))],
) -> dict[str, int]:
    try:
        days = service.set_stop_sell(ctx.tenant_id, req.property_id, req.range, req.reason)
        return {"stopped_days": days}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/stop-sell/clear", dependencies=[
    Depends(require_lodgify_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def clear_stop_sell(
    req: StopSellClearRequest,
    service: CalendarServiceDep,
    _ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, str]:
    try:
        service.clear_stop_sell(req.property_id, req.range)
        return {"status": "ok"}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/season-price", response_model=SeasonPriceListResponse)
def list_season_price(
    service: CalendarServiceDep,
    _ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> SeasonPriceListResponse:
    try:
        items = service.list_season_prices(property_id, DateRange(start=start, end=end))
        return SeasonPriceListResponse(items=items, total=len(items))
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/season-price", dependencies=[
    Depends(require_lodgify_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def set_season_price(
    req: SeasonPriceRequest,
    service: CalendarServiceDep,
    _ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, int]:
    try:
        return {"days": service.set_season_price(req.property_id, req.range, req.price)}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
