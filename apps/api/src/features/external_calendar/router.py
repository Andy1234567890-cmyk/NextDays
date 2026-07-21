"""Router für externe iCal-Kalender. Gemountet unter /api/v1/external-calendar.

Der Kunde abonniert pro Objekt externe .ics-Feeds (Airbnb/Booking/…),
der Belegungskalender bleibt synchron. Tenant-geschützt (MANAGE_CALENDAR).
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    AddCalendarRequest,
    ExportToken,
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


# -- Export (öffentlicher .ics-Feed pro Objekt) -----------------------------


@router.post("/export/{property_id}/token", response_model=ExportToken)
def ensure_export_token(
    property_id: str, ctx: _cal, service: ServiceDep
) -> ExportToken:
    """Export-Token des Objekts sicherstellen (für die Feed-URL). Idempotent."""
    try:
        return ExportToken(**service.ensure_export_token(ctx, property_id))
    except ExternalCalendarError as exc:
        raise _handle(exc) from exc


@router.post("/export/{property_id}/rotate", response_model=ExportToken)
def rotate_export_token(
    property_id: str, ctx: _cal, service: ServiceDep
) -> ExportToken:
    """Export-Token neu vergeben — die alte Feed-URL wird sofort ungültig."""
    try:
        return ExportToken(**service.rotate_export_token(ctx, property_id))
    except ExternalCalendarError as exc:
        raise _handle(exc) from exc


@router.get("/export/{token}.ics")
def export_feed(token: str, service: ServiceDep, scope: str = "all") -> Response:
    """Öffentlicher iCal-Feed zu einem Token (KEIN Auth — das Token IST der
    Zugang; eigener Rate-Limit-Bucket in der Middleware). Enthält nur belegte
    Nächte, keine Gast-/Preis-/Stammdaten. `scope=upcoming` blendet Vergangenes
    aus (Lodgify „nur zukünftige Reservierungen"), sonst alle."""
    now = datetime.now(UTC)
    dtstamp = now.strftime("%Y%m%dT%H%M%SZ")
    try:
        body = service.export_feed(
            token,
            dtstamp=dtstamp,
            today=now.date(),
            upcoming_only=(scope == "upcoming"),
        )
    except ExternalCalendarError as exc:
        raise _handle(exc) from exc
    return Response(
        content=body,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'inline; filename="calendar.ics"'},
    )
