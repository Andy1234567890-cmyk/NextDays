"""Router für reservations. Gemountet unter /api/v1/reservations."""
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from src.core.security import CurrentUser, require_internal_cron_secret
from src.core.supabase import get_service_client
from src.features.auth.dependencies import (
    require_granular_permission,
    require_permission,
)
from src.features.auth.granular_permissions import Permission
from src.features.auth.permissions import Capability

from .schemas import (
    CheckOutRequest,
    CheckOutResponse,
    DashboardResponse,
    PropertyStats,
    RequestDecline,
    ReservationCancel,
    ReservationCreate,
    ReservationDetail,
    ReservationListResponse,
    ReservationMove,
    ReservationResponse,
    SliceHealth,
    StatMetricDetail,
    StatMetricDetailResponse,
    TimelineResponse,
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


@router.get("/stats", response_model=PropertyStats)
def tenant_stats(
    service: ReservationsServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    property_id: Annotated[list[str] | None, Query()] = None,
) -> PropertyStats:
    """Globale Kontrollzentrum-Kennzahlen: zusammengefasst über ALLE (owner-
    sichtbaren) Objekte des Tenants. `property_id` (wiederholbar) filtert auf
    ausgewählte Objekte („Ausgewählte Unterkünfte"). Ohne Zeitraum: letzte 30
    Tage. Beträge maskiert; Belegungsrate durch die Objektanzahl geteilt."""
    today = date.today()
    end = date_to or today
    start = date_from or (end - timedelta(days=29))
    try:
        return service.tenant_stats(ctx, start, end, property_id)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/stats/{metric}", response_model=StatMetricDetail)
def tenant_metric_detail(
    metric: str,
    service: ReservationsServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    property_id: Annotated[list[str] | None, Query()] = None,
) -> StatMetricDetail:
    """KPI-Detailseite (Kontrollzentrum „ANSEHEN") tenant-weit: Tagesreihe +
    Vergleichsperioden + Breakout für EINE Metrik über alle (gefilterten)
    Objekte. Ohne Zeitraum: letzte 30 Tage."""
    today = date.today()
    end = date_to or today
    start = date_from or (end - timedelta(days=29))
    try:
        return service.tenant_metric_detail(ctx, metric, start, end, property_id)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/property/{property_id}/stats", response_model=PropertyStats)
def property_stats(
    property_id: str,
    service: ReservationsServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
) -> PropertyStats:
    """Objekt-Kennzahlen für den Statistiken-Reiter. Ohne Zeitraum: letzte 30
    Tage (inkl. heute). Owner-scoped; Beträge maskiert."""
    today = date.today()
    end = date_to or today
    start = date_from or (end - timedelta(days=29))
    try:
        return service.property_stats(ctx, property_id, start, end)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/property/{property_id}/stats/{metric}",
    response_model=StatMetricDetailResponse,
)
def property_metric_detail(
    property_id: str,
    metric: str,
    service: ReservationsServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
) -> StatMetricDetailResponse:
    """KPI-Detailseite (Klick auf eine Statistik-Kachel): Tagesreihe + vier
    gleich lange Vergleichsperioden davor + Breakout-Matrix für EINE Kennzahl.
    Ohne Zeitraum: letzte 30 Tage. Owner-scoped; Geldmetriken maskiert."""
    today = date.today()
    end = date_to or today
    start = date_from or (end - timedelta(days=29))
    try:
        title, detail = service.property_metric_detail(
            ctx, property_id, metric, start, end
        )
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return StatMetricDetailResponse(
        property_id=property_id, property_title=title, detail=detail
    )


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


@router.get("/{reservation_id}/timeline", response_model=TimelineResponse)
def reservation_timeline(
    reservation_id: str,
    service: ReservationsServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
) -> TimelineResponse:
    """Ereignis-Zeitleiste einer Buchung (Zeitleiste). Tenant-/owner-
    scoped; kombiniert echte reservation_events mit synthetischen Basis-Events
    aus vorhandenen Zeitstempeln + Aufgaben. Neueste zuerst."""
    try:
        return service.timeline(ctx, reservation_id)
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
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
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
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
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


# --- Anfrage-Modell (Airbnb Request to Book): accept / decline / expire ------

@router.post(
    "/{reservation_id}/accept",
    response_model=ReservationResponse,
    dependencies=[
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
    ],
)
def accept_request(
    reservation_id: str,
    service: ReservationsServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> ReservationResponse:
    """Eine Gast-Anfrage annehmen → confirmed (sperrt die Nächte an den OTAs)."""
    try:
        return service.accept_request(ctx, reservation_id)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{reservation_id}/decline",
    response_model=ReservationResponse,
    dependencies=[
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
    ],
)
def decline_request(
    reservation_id: str,
    req: RequestDecline,
    service: ReservationsServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> ReservationResponse:
    """Eine Gast-Anfrage ablehnen → declined (gibt die belegten Nächte frei)."""
    try:
        return service.decline_request(ctx, reservation_id, req.reason)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/expire-requests")
def expire_requests(
    service: ReservationsServiceDep,
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict[str, int]:
    """Cron: abgelaufene Anfragen (24-h-Frist verstrichen) auf expired setzen und
    die Nächte freigeben. Nur mit gültigem internen Cron-Secret (fail-closed)."""
    require_internal_cron_secret(x_internal_cron_secret)
    return {"expired": service.expire_stale_requests()}


@router.post(
    "/{reservation_id}/check-in",
    response_model=ReservationResponse,
    dependencies=[
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
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
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
    ],
)
def check_out_reservation(
    reservation_id: str,
    service: ReservationsServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
    req: CheckOutRequest | None = None,
) -> CheckOutResponse:
    """Gast auschecken — erzeugt verpflichtend die finale Rechnung (GoBD-
    Nummer) über den Booking→Invoice-Builder; ohne Rechnung kein Check-out.
    Die Zahlart (bar/Karte/auf Rechnung) kommt aus der Rezeptions-Abfrage.
    Die Rechnung entsteht serverseitig als System-Nebeneffekt der Front-Desk-
    Aktion (bewusst ohne OWNER_REPORTING-Anforderung)."""
    try:
        return service.check_out(ctx, reservation_id, req)
    except ReservationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
