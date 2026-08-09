"""Router für public_portal. Gemountet unter /api/v1/public-portal.

Eigentümer-Self-Service-Portal (§4.2): der eingeloggte Eigentümer sieht NUR seine
zugeordneten Objekte, Beträge/Gäste maskiert. Endpunkte sind über die Owner-
Capabilities gated; der Objekt-Scope wird zusätzlich im Service erzwungen.
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import DienstleistungsServiceDep, PublicPortalServiceDep
from .dienstleistungen import DienstleistungError
from .schemas import (
    BlockRequestCreate,
    BlockRequestItem,
    BlockRequestList,
    MeterReadingCreate,
    MeterReadingItem,
    MeterReadingList,
    PortalCalendarResponse,
    PortalEarningsResponse,
    PortalPropertyList,
    PortalStatementList,
    SliceHealth,
)
from .schemas_dienstleistungen import (
    ServiceRequestCreate,
    ServiceRequestItem,
    ServiceRequestList,
    ServiceTypeList,
)
from .service import PortalError

router = APIRouter(prefix="/public-portal", tags=["public_portal"])

# Wiederverwendete Permission-Dependencies (Callables, kein Konstanten-Naming).
_VIEW = require_permission(Capability.VIEW_CALENDAR)  # noqa: N816  pylint: disable=invalid-name
_REPORTS = require_permission(Capability.VIEW_OWNER_REPORTS)  # noqa: N816  pylint: disable=invalid-name
_BLOCK = require_permission(Capability.REQUEST_BLOCK)  # noqa: N816  pylint: disable=invalid-name
_METER = require_permission(Capability.ADD_METER_READING)  # noqa: N816  pylint: disable=invalid-name


@router.get("/health", response_model=SliceHealth)
def health(service: PublicPortalServiceDep) -> SliceHealth:
    return service.health()


@router.get("/properties", response_model=PortalPropertyList)
def my_properties(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_VIEW)],
) -> PortalPropertyList:
    try:
        return service.my_properties(ctx)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/calendar", response_model=PortalCalendarResponse)
def calendar(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_VIEW)],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> PortalCalendarResponse:
    try:
        return service.calendar(ctx, property_id, start, end)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/earnings", response_model=PortalEarningsResponse)
def earnings(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTS)],
    period_from: Annotated[date, Query()],
    period_to: Annotated[date, Query()],
) -> PortalEarningsResponse:
    try:
        return service.earnings(ctx, period_from, period_to)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/statements", response_model=PortalStatementList)
def my_statements(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTS)],
) -> PortalStatementList:
    try:
        return service.my_statements(ctx)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/block-requests",
    response_model=BlockRequestItem,
    status_code=status.HTTP_201_CREATED,
)
def request_block(
    req: BlockRequestCreate,
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> BlockRequestItem:
    try:
        return service.request_block(ctx, req)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/block-requests", response_model=BlockRequestList)
def my_block_requests(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> BlockRequestList:
    try:
        return service.my_block_requests(ctx)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/meter-readings",
    response_model=MeterReadingItem,
    status_code=status.HTTP_201_CREATED,
)
def add_meter_reading(
    req: MeterReadingCreate,
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_METER)],
) -> MeterReadingItem:
    try:
        return service.add_meter_reading(ctx, req)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/meter-readings", response_model=MeterReadingList)
def meter_readings(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_METER)],
    property_id: Annotated[str, Query()],
) -> MeterReadingList:
    try:
        return service.meter_readings(ctx, property_id)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Dienstleistungen beauftragen (Etappe D) --------------------------------
# Eigener Service (`dienstleistungen.py`), weil der Auftrag ein SCHREIBpfad in
# einen fremden Slice (`tasks`) ist und nicht in den Portal-Lesepfad gehoert.

_SERVICES = require_permission(Capability.BOOK_SERVICES)  # noqa: N816  pylint: disable=invalid-name


@router.get("/service-types", response_model=ServiceTypeList)
def service_types(
    service: DienstleistungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_SERVICES)],
) -> ServiceTypeList:
    """Beauftragbare Leistungen: Systemvorgaben + eigene des Betriebs."""
    try:
        return service.catalog(ctx)
    except DienstleistungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/service-requests",
    response_model=ServiceRequestItem,
    status_code=status.HTTP_201_CREATED,
)
def request_service(
    req: ServiceRequestCreate,
    service: DienstleistungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_SERVICES)],
) -> ServiceRequestItem:
    """Eine Dienstleistung beauftragen — landet als Aufgabe beim Betrieb.

    Idempotent (Wurzel 2): derselbe Auftrag am selben Tag liefert den
    BESTEHENDEN zurueck, statt eine zweite Reinigung auszuloesen. Der Status
    bleibt 201 — fuer den Aufrufer ist das Ergebnis dasselbe (der Auftrag steht),
    und ein 200-vs-201-Unterschied wuerde nur verraten, dass er doppelt geklickt
    hat.
    """
    try:
        return service.request_service(ctx, req)
    except DienstleistungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/service-requests", response_model=ServiceRequestList)
def my_service_requests(
    service: DienstleistungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_SERVICES)],
) -> ServiceRequestList:
    """Die vom Eigentuemer SELBST beauftragten Leistungen — keine fremden
    Aufgaben des Betriebs (§4.3)."""
    try:
        return service.my_service_requests(ctx)
    except DienstleistungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
