"""Router für reservations. Gemountet unter /api/v1/reservations."""
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
    CheckOutResponse,
    DashboardResponse,
    ReservationCancel,
    ReservationCreate,
    ReservationDetail,
    ReservationListResponse,
    ReservationMove,
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


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    service: ReservationsServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
) -> DashboardResponse:
    try:
        return service.dashboard(ctx)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


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


@router.get("/{reservation_id}", response_model=ReservationDetail)
def reservation_detail(
    reservation_id: str,
    service: ReservationsServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
) -> ReservationDetail:
    """Vollständige Reservierungs-Detailansicht (rechter Slider)."""
    try:
        return service.detail(ctx, reservation_id)
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


@router.patch(
    "/{reservation_id}/move",
    response_model=ReservationResponse,
    dependencies=[
        Depends(require_lodgify_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
    ],
)
def move_reservation(
    reservation_id: str,
    req: ReservationMove,
    service: ReservationsServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> ReservationResponse:
    """Reservierung verschieben (Objekt/Zeitraum) oder resizen (Check-in/out)
    mit erneutem Doppelbuchungs-Schutz (409 bei Konflikt)."""
    try:
        return service.move(ctx, reservation_id, req)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{reservation_id}/cancel",
    response_model=ReservationResponse,
    dependencies=[
        Depends(require_lodgify_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
    ],
)
def cancel_reservation(
    reservation_id: str,
    req: ReservationCancel,
    service: ReservationsServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> ReservationResponse:
    """Reservierung stornieren — Begründung ist Pflicht und wird auditiert.
    Kanal-agnostisch; gibt die belegten Tage frei (auch an Channex zurück)."""
    try:
        return service.cancel(ctx, reservation_id, req.reason)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{reservation_id}/check-in",
    response_model=ReservationResponse,
    dependencies=[
        Depends(require_lodgify_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
    ],
)
def check_in_reservation(
    reservation_id: str,
    service: ReservationsServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> ReservationResponse:
    """Gast einchecken (setzt checked_in_at, 0091). Front-Desk-Aktion —
    gleiche Guards wie move/cancel."""
    try:
        return service.check_in(ctx, reservation_id)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{reservation_id}/check-out",
    response_model=CheckOutResponse,
    dependencies=[
        Depends(require_lodgify_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
    ],
)
def check_out_reservation(
    reservation_id: str,
    service: ReservationsServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> CheckOutResponse:
    """Gast auschecken — erzeugt verpflichtend die finale Rechnung (GoBD-
    Nummer) über den Booking→Invoice-Builder; ohne Rechnung kein Check-out.
    Die Rechnung entsteht serverseitig als System-Nebeneffekt der Front-Desk-
    Aktion (bewusst ohne OWNER_REPORTING-Anforderung)."""
    try:
        return service.check_out(ctx, reservation_id)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
