"""Router für crm. Gemountet unter /api/v1/crm.

Alle fachlichen Endpunkte verlangen die Capability MANAGE_CRM (admin, co_admin).
Leads sind Vertriebsdaten mit Personenbezug, Deals tragen Rabattcodes — staff/
cleaner/owner bekommen hier 403 (§4.3). Uploads laufen als multipart über
`read_upload` (Transport-Limit 25 MB, fachliches Limit 5 MB im Service).
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from src.core.security import AuthContext
from src.core.uploads import read_upload
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .common import LEADS_LIMIT_DEFAULT, LEADS_LIMIT_MAX, CrmError, LeadSource, LeadStatus
from .dependencies import CrmServiceDep
from .schemas import (
    DealCreate,
    DealListResponse,
    DealResponse,
    DealUpdate,
    FileUrlResponse,
    LeadConvertRequest,
    LeadConvertResponse,
    LeadCreate,
    LeadListResponse,
    LeadNoteCreate,
    LeadNoteResponse,
    LeadResponse,
    LeadUpdate,
    PartnerCreate,
    PartnerListResponse,
    PartnerResponse,
    PartnerUpdate,
    SliceHealth,
)
from .service import CrmService

router = APIRouter(prefix="/crm", tags=["crm"])

_crm = Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_CRM))]


def _tenant(ctx: AuthContext) -> str:
    if not ctx.tenant_id:
        raise HTTPException(status_code=400, detail="Kein Tenant im Token.")
    return ctx.tenant_id


def _fehler(exc: CrmError) -> HTTPException:
    """CrmError → HTTPException. Strukturierte `details` wandern in das
    `detail`-Objekt (message + Felder), sonst bleibt `detail` ein String."""
    if exc.details:
        return HTTPException(
            status_code=exc.status_code, detail={"message": exc.message, **exc.details}
        )
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return CrmService().health()


# -- Leads -------------------------------------------------------------------------
@router.get("/leads", response_model=LeadListResponse)
def list_leads(  # pylint: disable=too-many-arguments
    service: CrmServiceDep,
    ctx: _crm,
    status_filter: Annotated[LeadStatus | None, Query(alias="status")] = None,
    lead_source: Annotated[LeadSource | None, Query()] = None,
    assigned_user_id: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=120)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=LEADS_LIMIT_MAX)] = LEADS_LIMIT_DEFAULT,
) -> LeadListResponse:
    try:
        return service.list_leads(
            _tenant(ctx), status=status_filter, lead_source=lead_source,
            assigned_user_id=assigned_user_id, q=q, offset=offset, limit=limit,
        )
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(req: LeadCreate, service: CrmServiceDep, ctx: _crm) -> LeadResponse:
    try:
        return service.create_lead(ctx, _tenant(ctx), req)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.get("/leads/{lead_id}", response_model=LeadResponse)
def get_lead(lead_id: str, service: CrmServiceDep, ctx: _crm) -> LeadResponse:
    try:
        return service.get_lead(_tenant(ctx), lead_id)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.patch("/leads/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: str, req: LeadUpdate, service: CrmServiceDep, ctx: _crm
) -> LeadResponse:
    try:
        return service.update_lead(ctx, _tenant(ctx), lead_id, req)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: str, service: CrmServiceDep, ctx: _crm) -> Response:
    try:
        service.delete_lead(ctx, _tenant(ctx), lead_id)
    except CrmError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/leads/{lead_id}/notes", response_model=list[LeadNoteResponse])
def list_lead_notes(
    lead_id: str, service: CrmServiceDep, ctx: _crm
) -> list[LeadNoteResponse]:
    try:
        return service.list_notes(_tenant(ctx), lead_id)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.post(
    "/leads/{lead_id}/notes",
    response_model=LeadNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_lead_note(
    lead_id: str, req: LeadNoteCreate, service: CrmServiceDep, ctx: _crm
) -> LeadNoteResponse:
    try:
        return service.add_note(ctx, _tenant(ctx), lead_id, req)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.post("/leads/{lead_id}/convert", response_model=LeadConvertResponse)
def convert_lead(
    lead_id: str, req: LeadConvertRequest, service: CrmServiceDep, ctx: _crm
) -> LeadConvertResponse:
    try:
        return service.convert_lead(ctx, _tenant(ctx), lead_id, req)
    except CrmError as exc:
        raise _fehler(exc) from exc


# -- Partner -------------------------------------------------------------------------
@router.get("/partners", response_model=PartnerListResponse)
def list_partners(
    service: CrmServiceDep,
    ctx: _crm,
    q: Annotated[str | None, Query(max_length=120)] = None,
) -> PartnerListResponse:
    try:
        items = service.list_partners(_tenant(ctx), q)
    except CrmError as exc:
        raise _fehler(exc) from exc
    return PartnerListResponse(items=items, total=len(items))


@router.post("/partners", response_model=PartnerResponse, status_code=status.HTTP_201_CREATED)
def create_partner(req: PartnerCreate, service: CrmServiceDep, ctx: _crm) -> PartnerResponse:
    try:
        return service.create_partner(_tenant(ctx), req, by=ctx.user_id)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.get("/partners/{partner_id}", response_model=PartnerResponse)
def get_partner(partner_id: str, service: CrmServiceDep, ctx: _crm) -> PartnerResponse:
    try:
        return service.get_partner(_tenant(ctx), partner_id)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.patch("/partners/{partner_id}", response_model=PartnerResponse)
def update_partner(
    partner_id: str, req: PartnerUpdate, service: CrmServiceDep, ctx: _crm
) -> PartnerResponse:
    try:
        return service.update_partner(_tenant(ctx), partner_id, req, by=ctx.user_id)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.delete("/partners/{partner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_partner(partner_id: str, service: CrmServiceDep, ctx: _crm) -> Response:
    try:
        service.delete_partner(_tenant(ctx), partner_id, by=ctx.user_id)
    except CrmError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -- Deals ---------------------------------------------------------------------------
@router.get("/partners/{partner_id}/deals", response_model=DealListResponse)
def list_deals(partner_id: str, service: CrmServiceDep, ctx: _crm) -> DealListResponse:
    try:
        items = service.list_deals(_tenant(ctx), partner_id)
    except CrmError as exc:
        raise _fehler(exc) from exc
    return DealListResponse(items=items, total=len(items))


@router.post(
    "/partners/{partner_id}/deals",
    response_model=DealResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_deal(
    partner_id: str, req: DealCreate, service: CrmServiceDep, ctx: _crm
) -> DealResponse:
    try:
        return service.create_deal(_tenant(ctx), partner_id, req, by=ctx.user_id)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.get("/deals/{deal_id}", response_model=DealResponse)
def get_deal(deal_id: str, service: CrmServiceDep, ctx: _crm) -> DealResponse:
    try:
        return service.get_deal(_tenant(ctx), deal_id)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.patch("/deals/{deal_id}", response_model=DealResponse)
def update_deal(
    deal_id: str, req: DealUpdate, service: CrmServiceDep, ctx: _crm
) -> DealResponse:
    try:
        return service.update_deal(_tenant(ctx), deal_id, req, by=ctx.user_id)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.delete("/deals/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deal(deal_id: str, service: CrmServiceDep, ctx: _crm) -> Response:
    try:
        service.delete_deal(_tenant(ctx), deal_id, by=ctx.user_id)
    except CrmError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/deals/{deal_id}/qr", response_model=DealResponse)
async def upload_deal_qr(
    deal_id: str, request: Request, service: CrmServiceDep, ctx: _crm
) -> DealResponse:
    """QR-Bild des Partners hochladen (multipart `file`; PNG/JPEG/SVG/PDF, 5 MB).
    Erkannt am Inhalt (Magic Bytes), SVG wird gesäubert."""
    content, _content_type = await read_upload(request)
    try:
        return service.upload_qr(_tenant(ctx), deal_id, content, by=ctx.user_id)
    except CrmError as exc:
        raise _fehler(exc) from exc


@router.get("/deals/{deal_id}/qr-url", response_model=FileUrlResponse)
def deal_qr_url(deal_id: str, service: CrmServiceDep, ctx: _crm) -> FileUrlResponse:
    """Signierte, kurzlebige URL des hochgeladenen QR-Bilds (privater Bucket)."""
    try:
        url, ttl = service.qr_url(_tenant(ctx), deal_id)
    except CrmError as exc:
        raise _fehler(exc) from exc
    return FileUrlResponse(url=url, expires_in=ttl)


@router.get("/deals/{deal_id}/qr.png", response_class=Response)
def deal_qr_png(deal_id: str, service: CrmServiceDep, ctx: _crm) -> Response:
    """QR-Code aus dem Rabattcode als PNG — für Partner ohne eigenes Bild."""
    try:
        png = service.qr_png(_tenant(ctx), deal_id)
    except CrmError as exc:
        raise _fehler(exc) from exc
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=3600"},
    )
