"""Router des site_config-Slice.

Zwei Router (beide unter /api/v1 gemountet):
  * ``manage_router`` (/site-config) — Dashboard-CRUD, MANAGE_SITE_CONFIG-geschützt,
    tenant-gescoped. Branding + Custom-Domains.
  * ``public_router`` (/site) — JWT-loser by-domain-Resolver für die öffentliche
    Buchungsplattform (Host → Tenant + öffentliches Branding).

Die REST-Endpunkte sind eine dünne 1:1-Hülle um die Service-Aktionen, damit ein
späterer MCP exakt diese Aktionen spiegeln kann (get_branding/set_branding/
add_domain/sync_domain/remove_domain/resolve_site_by_domain).
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import SiteConfigServiceDep
from .schemas import (
    ApplyTemplateRequest,
    BlockCreate,
    BlockListResponse,
    BlockResponse,
    BlockUpdate,
    BrandingResponse,
    BrandingUpdate,
    CustomDomainListResponse,
    CustomDomainResponse,
    DomainCreate,
    PageCreate,
    PageListResponse,
    PageResponse,
    PageUpdate,
    PublicPageResponse,
    PublicSiteResponse,
    ReorderRequest,
    SliceHealth,
)
from .service import SiteConfigError

_MANAGE = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_SITE_CONFIG
)

manage_router = APIRouter(prefix="/site-config", tags=["site_config"])
public_router = APIRouter(prefix="/site", tags=["site_config"])


@manage_router.get("/health", response_model=SliceHealth)
def health(service: SiteConfigServiceDep) -> SliceHealth:
    return service.health()


# --- Branding ---------------------------------------------------------------
@manage_router.get("", response_model=BrandingResponse)
def get_branding(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BrandingResponse:
    try:
        return service.get_branding(ctx)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.put("", response_model=BrandingResponse)
def set_branding(
    req: BrandingUpdate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BrandingResponse:
    try:
        return service.set_branding(ctx, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Custom-Domains ---------------------------------------------------------
@manage_router.get("/domains", response_model=CustomDomainListResponse)
def list_domains(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> CustomDomainListResponse:
    try:
        return service.list_domains(ctx)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/domains",
    response_model=CustomDomainResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_domain(
    req: DomainCreate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> CustomDomainResponse:
    try:
        return service.add_domain(ctx, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/domains/{domain_id}/sync", response_model=CustomDomainResponse)
def sync_domain(
    domain_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> CustomDomainResponse:
    try:
        return service.sync_domain(ctx, domain_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.delete("/domains/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_domain(
    domain_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    try:
        service.remove_domain(ctx, domain_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Page-Builder: Seiten (Dashboard) ---------------------------------------
@manage_router.get("/pages", response_model=PageListResponse)
def list_pages(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageListResponse:
    try:
        return service.list_pages(ctx)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/pages", response_model=PageResponse, status_code=status.HTTP_201_CREATED
)
def create_page(
    req: PageCreate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageResponse:
    try:
        return service.create_page(ctx, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.put("/pages/{page_id}", response_model=PageResponse)
def update_page(
    page_id: str,
    req: PageUpdate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageResponse:
    try:
        return service.update_page(ctx, page_id, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/pages/{page_id}/home", response_model=PageResponse)
def set_home_page(
    page_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageResponse:
    try:
        return service.set_home_page(ctx, page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/pages/{page_id}/publish", response_model=PageResponse)
def publish_page(
    page_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageResponse:
    try:
        return service.publish_page(ctx, page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/pages/{page_id}/unpublish", response_model=PageResponse)
def unpublish_page(
    page_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageResponse:
    try:
        return service.unpublish_page(ctx, page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.delete(
    "/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_page(
    page_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    try:
        service.delete_page(ctx, page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Page-Builder: Blöcke (Dashboard) ---------------------------------------
@manage_router.get("/pages/{page_id}/blocks", response_model=BlockListResponse)
def list_blocks(
    page_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BlockListResponse:
    try:
        return service.list_blocks(ctx, page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/pages/{page_id}/blocks",
    response_model=BlockResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_block(
    page_id: str,
    req: BlockCreate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BlockResponse:
    try:
        return service.add_block(ctx, page_id, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.put("/blocks/{block_id}", response_model=BlockResponse)
def update_block(
    block_id: str,
    req: BlockUpdate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BlockResponse:
    try:
        return service.update_block(ctx, block_id, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/pages/{page_id}/blocks/reorder", response_model=BlockListResponse
)
def reorder_blocks(
    page_id: str,
    req: ReorderRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BlockListResponse:
    try:
        return service.reorder_blocks(ctx, page_id, req.ordered_ids)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.delete(
    "/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_block(
    block_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    try:
        service.remove_block(ctx, block_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/templates/apply", response_model=PageListResponse)
def apply_template(
    req: ApplyTemplateRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageListResponse:
    try:
        return service.apply_template(ctx, req.template_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Öffentlicher Resolver (KEIN JWT) ---------------------------------------
@public_router.get("/by-domain", response_model=PublicSiteResponse)
def resolve_site_by_domain(
    service: SiteConfigServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
) -> PublicSiteResponse:
    """Host → Tenant + öffentliches Branding (für die plattform-Middleware).

    Bewusst ohne Auth-Guard: die öffentliche Buchungs-Site ist nicht eingeloggt.
    Liefert NUR öffentliche Felder; unbekannte Domain → 404."""
    try:
        return service.resolve_site_by_domain(host)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/page", response_model=PublicPageResponse)
def resolve_page(
    service: SiteConfigServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
    slug: Annotated[str | None, Query(max_length=200)] = None,
) -> PublicPageResponse:
    """Host (+ optional Slug) → veröffentlichte Seite + Blöcke + Branding für den
    builder/-Renderer. KEIN JWT; nur is_published; unbekannt → 404."""
    try:
        return service.resolve_page(host, slug)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
