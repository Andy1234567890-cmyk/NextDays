"""Router für das Bilder-Modul. Gemountet unter /api/v1/media."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import MediaListResponse, SliceHealth
from .service import MediaError, MediaService

router = APIRouter(prefix="/media", tags=["media"])


def get_media_service() -> MediaService:
    return MediaService(client=get_service_client())


MediaServiceDep = Annotated[MediaService, Depends(get_media_service)]


def _tenant(ctx: AuthContext) -> str:
    if not ctx.tenant_id:
        raise HTTPException(status_code=400, detail="Kein Tenant im Token.")
    return ctx.tenant_id


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="media")


@router.get("", response_model=MediaListResponse)
def list_media(
    service: MediaServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_CALENDAR))
    ],
    booking: bool = True,
    property_: bool = True,
    property_id: str | None = None,
) -> MediaListResponse:
    """Bilder-Karten (Buchungs- + Objektfotos), tenant-scoped. Query-Toggles
    `booking`/`property_` steuern die Quellen; `property_id` filtert auf ein
    Objekt."""
    items = service.list_media(
        _tenant(ctx),
        include_booking=booking,
        include_property=property_,
        property_id=property_id,
    )
    return MediaListResponse(items=items)


@router.delete("/{kind}/{media_id}", status_code=204)
def delete_media(
    kind: str,
    media_id: str,
    service: MediaServiceDep,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))],
) -> None:
    try:
        service.delete_media(_tenant(ctx), kind, media_id)
    except MediaError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
