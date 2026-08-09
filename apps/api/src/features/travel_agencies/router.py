"""Router für die Reisebüro-/Partner-Kartei. Mount: /api/v1/travel-agencies.

Alle Endpunkte erfordern die Berechtigung MANAGE_PARTNERS (Kartei ist
eine Verwaltungs-Oberfläche für admin/co_admin). Vertragsdateien laufen über
den privaten Bucket agency-contracts (Upload multipart, Download als
signierte, zeitlich begrenzte URL).
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.core.uploads import read_upload_named
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission

from .schemas import (
    AgencyCreate,
    AgencyListResponse,
    AgencyResponse,
    AgencyUpdate,
    ContactCreate,
    ContactResponse,
    ContractCreate,
    ContractListResponse,
    ContractResponse,
    ContractUpdate,
    FileUrlResponse,
    RateCreate,
    RateListResponse,
    RateResponse,
    SliceHealth,
)
from .service import TravelAgenciesError, TravelAgenciesService


def get_travel_agencies_service() -> TravelAgenciesService:
    return TravelAgenciesService(service_client=get_service_client())


ServiceDep = Annotated[TravelAgenciesService, Depends(get_travel_agencies_service)]
_partners = Annotated[
    AuthContext, Depends(require_granular_permission(Permission.MANAGE_PARTNERS))
]

router = APIRouter(prefix="/travel-agencies", tags=["travel-agencies"])


def _tenant(ctx: AuthContext) -> str:
    if not ctx.tenant_id:
        raise HTTPException(status_code=400, detail="Kein Tenant im Token.")
    return ctx.tenant_id


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth()


# -- Agenturen ---------------------------------------------------------------
@router.get("", response_model=AgencyListResponse)
def list_agencies(
    service: ServiceDep,
    ctx: _partners,
    q: Annotated[str | None, Query()] = None,
    include_inactive: Annotated[bool, Query()] = False,
) -> AgencyListResponse:
    try:
        items = service.list_agencies(_tenant(ctx), q, include_inactive)
        return AgencyListResponse(items=items, total=len(items))
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=AgencyResponse, status_code=201)
def create_agency(req: AgencyCreate, service: ServiceDep, ctx: _partners) -> AgencyResponse:
    try:
        return service.create_agency(_tenant(ctx), req)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{agency_id}", response_model=AgencyResponse)
def get_agency(agency_id: str, service: ServiceDep, ctx: _partners) -> AgencyResponse:
    try:
        return service.get_agency(_tenant(ctx), agency_id)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{agency_id}", response_model=AgencyResponse)
def update_agency(
    agency_id: str, req: AgencyUpdate, service: ServiceDep, ctx: _partners
) -> AgencyResponse:
    try:
        return service.update_agency(_tenant(ctx), agency_id, req)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{agency_id}", status_code=204)
def delete_agency(agency_id: str, service: ServiceDep, ctx: _partners) -> None:
    try:
        service.delete_agency(_tenant(ctx), agency_id)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# -- Kontakte ------------------------------------------------------------------
@router.get("/{agency_id}/contacts", response_model=list[ContactResponse])
def list_contacts(agency_id: str, service: ServiceDep, ctx: _partners) -> list[ContactResponse]:
    try:
        return service.list_contacts(_tenant(ctx), agency_id)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{agency_id}/contacts", response_model=ContactResponse, status_code=201)
def add_contact(
    agency_id: str, req: ContactCreate, service: ServiceDep, ctx: _partners
) -> ContactResponse:
    try:
        return service.add_contact(_tenant(ctx), agency_id, req)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{agency_id}/contacts/{contact_id}", status_code=204)
def delete_contact(
    agency_id: str, contact_id: str, service: ServiceDep, ctx: _partners
) -> None:
    try:
        service.delete_contact(_tenant(ctx), agency_id, contact_id)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# -- Verträge --------------------------------------------------------------------
@router.get("/{agency_id}/contracts", response_model=ContractListResponse)
def list_contracts(agency_id: str, service: ServiceDep, ctx: _partners) -> ContractListResponse:
    try:
        items = service.list_contracts(_tenant(ctx), agency_id)
        return ContractListResponse(items=items, total=len(items))
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{agency_id}/contracts", response_model=ContractResponse, status_code=201)
def add_contract(
    agency_id: str, req: ContractCreate, service: ServiceDep, ctx: _partners
) -> ContractResponse:
    try:
        return service.add_contract(_tenant(ctx), agency_id, req)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{agency_id}/contracts/{contract_id}", response_model=ContractResponse)
def update_contract(
    agency_id: str,
    contract_id: str,
    req: ContractUpdate,
    service: ServiceDep,
    ctx: _partners,
) -> ContractResponse:
    try:
        return service.update_contract(_tenant(ctx), agency_id, contract_id, req)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{agency_id}/contracts/{contract_id}", status_code=204)
def delete_contract(
    agency_id: str, contract_id: str, service: ServiceDep, ctx: _partners
) -> None:
    try:
        service.delete_contract(_tenant(ctx), agency_id, contract_id)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{agency_id}/contracts/{contract_id}/file", response_model=ContractResponse)
async def upload_contract_file(
    agency_id: str,
    contract_id: str,
    request: Request,
    service: ServiceDep,
    ctx: _partners,
) -> ContractResponse:
    # Inhalt UND Original-Dateiname in EINEM Durchlauf: nach `read_upload` ist
    # das Formular geschlossen, ein zweites `request.form()` liefert nur noch
    # geschlossene Dateien (siehe `read_upload_named`).
    content, content_type, file_name = await read_upload_named(request)
    try:
        return service.upload_contract_file(
            _tenant(ctx), agency_id, contract_id, content, content_type, file_name
        )
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{agency_id}/contracts/{contract_id}/file-url", response_model=FileUrlResponse)
def contract_file_url(
    agency_id: str, contract_id: str, service: ServiceDep, ctx: _partners
) -> FileUrlResponse:
    try:
        url, ttl = service.contract_file_url(_tenant(ctx), agency_id, contract_id)
        return FileUrlResponse(url=url, expires_in=ttl)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# -- Saison-Preiszeilen ------------------------------------------------------------
@router.get(
    "/{agency_id}/contracts/{contract_id}/rates", response_model=RateListResponse
)
def list_rates(
    agency_id: str, contract_id: str, service: ServiceDep, ctx: _partners
) -> RateListResponse:
    try:
        items = service.list_rates(_tenant(ctx), agency_id, contract_id)
        return RateListResponse(items=items, total=len(items))
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{agency_id}/contracts/{contract_id}/rates",
    response_model=RateResponse,
    status_code=201,
)
def add_rate(
    agency_id: str,
    contract_id: str,
    req: RateCreate,
    service: ServiceDep,
    ctx: _partners,
) -> RateResponse:
    try:
        return service.add_rate(_tenant(ctx), agency_id, contract_id, req)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/{agency_id}/contracts/{contract_id}/rates/{rate_id}", status_code=204
)
def delete_rate(
    agency_id: str,
    contract_id: str,
    rate_id: str,
    service: ServiceDep,
    ctx: _partners,
) -> None:
    try:
        service.delete_rate(_tenant(ctx), agency_id, contract_id, rate_id)
    except TravelAgenciesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
