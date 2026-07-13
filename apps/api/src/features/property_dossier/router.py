"""Router für property_dossier (8-stufige Objektkartei).

Gemountet unter /api/v1/property-dossier. Lesen: VIEW_CALENDAR. Schreiben:
MANAGE_PROPERTIES (Kartei = Agentur-internes Objekt-Onboarding). Stufe 1
(Eigentümer) ist read-only aus dem owners-Slice.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import CurrentUser
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import DossierServiceDep
from .schemas import (
    AccessData,
    DossierFull,
    EmergencyAuthority,
    HousebookData,
    LinkedOwner,
    MarketingData,
    PlatformLaunchBase,
    PlatformLaunchResponse,
    ProcessData,
    ServiceAgreementBase,
    ServiceAgreementResponse,
    SliceHealth,
    TradespersonBase,
    TradespersonResponse,
)
from .service import DossierError

router = APIRouter(prefix="/property-dossier", tags=["property_dossier"])

# Wiederverwendete Permission-Dependencies (Lesen vs. Kartei pflegen).
_view = require_permission(Capability.VIEW_CALENDAR)
_manage = require_permission(Capability.MANAGE_PROPERTIES)
ViewCtx = Annotated[CurrentUser, Depends(_view)]
ManageCtx = Annotated[CurrentUser, Depends(_manage)]


def _handle(exc: DossierError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/health", response_model=SliceHealth)
def health(service: DossierServiceDep) -> SliceHealth:
    return service.health()


# --- Aggregat + Stufe 1 (Eigentümer read-only) ------------------------------
@router.get("/{property_id}/full", response_model=DossierFull)
def get_full(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> DossierFull:
    try:
        return service.get_full(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.get("/{property_id}/owner", response_model=LinkedOwner | None)
def get_owner(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> LinkedOwner | None:
    try:
        return service.get_owner(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 2: Proces & Kontrakt ---------------------------------------------
@router.get("/{property_id}/process", response_model=ProcessData)
def get_process(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> ProcessData:
    try:
        return service.get_process(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/process", response_model=ProcessData)
def put_process(
    property_id: str, req: ProcessData, service: DossierServiceDep, ctx: ManageCtx
) -> ProcessData:
    try:
        return service.put_process(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 3: Adgang & Teknik -----------------------------------------------
@router.get("/{property_id}/access", response_model=AccessData)
def get_access(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> AccessData:
    try:
        return service.get_access(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/access", response_model=AccessData)
def put_access(
    property_id: str, req: AccessData, service: DossierServiceDep, ctx: ManageCtx
) -> AccessData:
    try:
        return service.put_access(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 4: Serviceaftaler (1:n) ------------------------------------------
@router.get("/{property_id}/service-agreements", response_model=list[ServiceAgreementResponse])
def list_service_agreements(
    property_id: str, service: DossierServiceDep, ctx: ViewCtx
) -> list[ServiceAgreementResponse]:
    try:
        return service.list_service_agreements(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.post(
    "/{property_id}/service-agreements",
    response_model=ServiceAgreementResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_service_agreement(
    property_id: str, req: ServiceAgreementBase, service: DossierServiceDep, ctx: ManageCtx
) -> ServiceAgreementResponse:
    try:
        return service.add_service_agreement(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/service-agreements/{item_id}", response_model=ServiceAgreementResponse)
def update_service_agreement(
    property_id: str,
    item_id: str,
    req: ServiceAgreementBase,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> ServiceAgreementResponse:
    try:
        return service.update_service_agreement(ctx.tenant_id, property_id, item_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.delete(
    "/{property_id}/service-agreements/{item_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_service_agreement(
    property_id: str, item_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> None:
    try:
        service.delete_service_agreement(ctx.tenant_id, property_id, item_id)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 5: Håndværkere (1:n) + Vollmacht (1:1) ---------------------------
@router.get("/{property_id}/tradespeople", response_model=list[TradespersonResponse])
def list_tradespeople(
    property_id: str, service: DossierServiceDep, ctx: ViewCtx
) -> list[TradespersonResponse]:
    try:
        return service.list_tradespeople(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.post(
    "/{property_id}/tradespeople",
    response_model=TradespersonResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_tradesperson(
    property_id: str, req: TradespersonBase, service: DossierServiceDep, ctx: ManageCtx
) -> TradespersonResponse:
    try:
        return service.add_tradesperson(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/tradespeople/{item_id}", response_model=TradespersonResponse)
def update_tradesperson(
    property_id: str,
    item_id: str,
    req: TradespersonBase,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> TradespersonResponse:
    try:
        return service.update_tradesperson(ctx.tenant_id, property_id, item_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.delete("/{property_id}/tradespeople/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tradesperson(
    property_id: str, item_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> None:
    try:
        service.delete_tradesperson(ctx.tenant_id, property_id, item_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.get("/{property_id}/emergency-authority", response_model=EmergencyAuthority)
def get_emergency_authority(
    property_id: str, service: DossierServiceDep, ctx: ViewCtx
) -> EmergencyAuthority:
    try:
        return service.get_emergency_authority(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/emergency-authority", response_model=EmergencyAuthority)
def put_emergency_authority(
    property_id: str, req: EmergencyAuthority, service: DossierServiceDep, ctx: ManageCtx
) -> EmergencyAuthority:
    try:
        return service.put_emergency_authority(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 6: Markedsføring -------------------------------------------------
@router.get("/{property_id}/marketing", response_model=MarketingData)
def get_marketing(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> MarketingData:
    try:
        return service.get_marketing(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/marketing", response_model=MarketingData)
def put_marketing(
    property_id: str, req: MarketingData, service: DossierServiceDep, ctx: ManageCtx
) -> MarketingData:
    try:
        return service.put_marketing(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 7: Husmappe ------------------------------------------------------
@router.get("/{property_id}/housebook", response_model=HousebookData)
def get_housebook(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> HousebookData:
    try:
        return service.get_housebook(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/housebook", response_model=HousebookData)
def put_housebook(
    property_id: str, req: HousebookData, service: DossierServiceDep, ctx: ManageCtx
) -> HousebookData:
    try:
        return service.put_housebook(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 8: Plattform-Launches (1:n) --------------------------------------
@router.get("/{property_id}/platform-launches", response_model=list[PlatformLaunchResponse])
def list_platform_launches(
    property_id: str, service: DossierServiceDep, ctx: ViewCtx
) -> list[PlatformLaunchResponse]:
    try:
        return service.list_platform_launches(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.post(
    "/{property_id}/platform-launches",
    response_model=PlatformLaunchResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_platform_launch(
    property_id: str, req: PlatformLaunchBase, service: DossierServiceDep, ctx: ManageCtx
) -> PlatformLaunchResponse:
    try:
        return service.add_platform_launch(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/platform-launches/{item_id}", response_model=PlatformLaunchResponse)
def update_platform_launch(
    property_id: str,
    item_id: str,
    req: PlatformLaunchBase,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> PlatformLaunchResponse:
    try:
        return service.update_platform_launch(ctx.tenant_id, property_id, item_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.delete("/{property_id}/platform-launches/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_platform_launch(
    property_id: str, item_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> None:
    try:
        service.delete_platform_launch(ctx.tenant_id, property_id, item_id)
    except DossierError as exc:
        raise _handle(exc) from exc
