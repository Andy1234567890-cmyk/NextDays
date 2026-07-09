"""Router für property_portal. Gemountet unter /api/v1/property-portal."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import CurrentUser
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability, has_capability

from .schemas import GuestPortalSettings, SliceHealth
from .service import PropertyPortalError, PropertyPortalService

router = APIRouter(prefix="/property-portal", tags=["property_portal"])


def get_service() -> PropertyPortalService:
    return PropertyPortalService(client=get_service_client())


ServiceDep = Annotated[PropertyPortalService, Depends(get_service)]


@router.get("/health", response_model=SliceHealth)
def health(service: ServiceDep) -> SliceHealth:
    return service.health()


@router.get("/{property_id}/guest-portal", response_model=GuestPortalSettings)
def get_guest_portal(
    property_id: str,
    service: ServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
) -> GuestPortalSettings:
    """Gastmodul-Einstellungen des Objekts. Der Türcode ist nur mit
    MANAGE_PROPERTIES befüllt (sonst None — kein Leak an Nur-Leser)."""
    can_see_code = has_capability(ctx.role, Capability.MANAGE_PROPERTIES)
    try:
        return service.get(ctx, property_id, can_see_code=can_see_code)
    except PropertyPortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{property_id}/guest-portal", response_model=GuestPortalSettings)
def put_guest_portal(
    property_id: str,
    req: GuestPortalSettings,
    service: ServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_PROPERTIES))
    ],
) -> GuestPortalSettings:
    try:
        return service.put(ctx, property_id, req)
    except PropertyPortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
