"""Router für calendar. Gemountet unter /api/v1/calendar."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from src.core.security import CurrentUser
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    AvailabilityCheck,
    BlockRequest,
    DateRange,
    DayAvailability,
    PriceOverrideRequest,
    SliceHealth,
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


@router.post("/block")
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


@router.post("/price-override")
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
