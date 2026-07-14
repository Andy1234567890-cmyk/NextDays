"""Router für externe iCal-Kalender. Gemountet unter /api/v1/external-calendar.

Der Kunde abonniert pro Objekt externe .ics-Feeds (Airbnb/Booking/…),
der Belegungskalender bleibt synchron. Tenant-geschützt (MANAGE_CALENDAR).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    AddCalendarRequest,
    ExternalCalendar,
    PropertyCalendars,
    SliceHealth,
)
from .service import ExternalCalendarError, ExternalCalendarService

router = APIRouter(prefix="/external-calendar", tags=["external_calendar"])
log = get_logger("nextdays.external_calendar")


def get_service() -> ExternalCalendarService:
    return ExternalCalendarService(service_client=get_service_client())


ServiceDep = Annotated[ExternalCalendarService, Depends(get_service)]
_cal = Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))]


def _handle(exc: ExternalCalendarError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/health", response_model=SliceHealth)
def health(service: ServiceDep) -> SliceHealth:
    return service.health() if hasattr(service, "health") else SliceHealth(status="ok")


@router.get("/overview", response_model=list[PropertyCalendars])
def overview(ctx: _cal, service: ServiceDep) -> list[PropertyCalendars]:
    """Zentrale Umzugs-Übersicht: alle Objekte + ihre externen Kalender."""
    try:
        rows = service.overview(ctx)
    except ExternalCalendarError as exc:
        raise _handle(exc) from exc
    return [PropertyCalendars(**r) for r in rows]


@router.get("/property/{property_id}", response_model=list[ExternalCalendar])
def list_for_property(
    property_id: str, ctx: _cal, service: ServiceDep
) -> list[ExternalCalendar]:
    try:
        rows = service.list_calendars(ctx, property_id)
    except ExternalCalendarError as exc:
        raise _handle(exc) from exc
    return [ExternalCalendar(**r) for r in rows]


@router.post("", response_model=ExternalCalendar)
def add_calendar(
    body: AddCalendarRequest, ctx: _cal, service: ServiceDep
) -> ExternalCalendar:
    try:
        row = service.add_calendar(
            ctx, property_id=body.property_id, name=body.name, ical_url=body.ical_url
        )
    except ExternalCalendarError as exc:
        raise _handle(exc) from exc
    return ExternalCalendar(**row)


@router.post("/{calendar_id}/sync", response_model=ExternalCalendar)
def sync_now(calendar_id: str, ctx: _cal, service: ServiceDep) -> ExternalCalendar:
    try:
        row = service.sync_now(ctx, calendar_id)
    except ExternalCalendarError as exc:
        raise _handle(exc) from exc
    return ExternalCalendar(**row)


@router.delete("/{calendar_id}", status_code=204)
def remove_calendar(calendar_id: str, ctx: _cal, service: ServiceDep) -> None:
    try:
        service.remove_calendar(ctx, calendar_id)
    except ExternalCalendarError as exc:
        raise _handle(exc) from exc
