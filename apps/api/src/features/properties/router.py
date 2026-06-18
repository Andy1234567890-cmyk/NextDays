"""Router für properties. Gemountet unter /api/v1/properties."""
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from src.core.security import CurrentUser

from .dependencies import PropertiesServiceDep
from .schemas import (
    ImageUploadResponse,
    PropertyCreate,
    PropertyListResponse,
    PropertyResponse,
    PropertyUpdate,
    SliceHealth,
)
from .service import PropertyError

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("/health", response_model=SliceHealth)
def health(service: PropertiesServiceDep) -> SliceHealth:
    return service.health()


@router.get("", response_model=PropertyListResponse)
def list_properties(
    ctx: CurrentUser, service: PropertiesServiceDep
) -> PropertyListResponse:
    try:
        return service.list(ctx)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
def create_property(
    req: PropertyCreate, ctx: CurrentUser, service: PropertiesServiceDep
) -> PropertyResponse:
    try:
        return service.create(ctx, req)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{property_id}", response_model=PropertyResponse)
def get_property(
    property_id: str, ctx: CurrentUser, service: PropertiesServiceDep
) -> PropertyResponse:
    try:
        return service.get(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{property_id}", response_model=PropertyResponse)
def update_property(
    property_id: str,
    req: PropertyUpdate,
    ctx: CurrentUser,
    service: PropertiesServiceDep,
) -> PropertyResponse:
    try:
        return service.update(ctx, property_id, req)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property(
    property_id: str, ctx: CurrentUser, service: PropertiesServiceDep
) -> None:
    try:
        service.delete(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{property_id}/image", response_model=ImageUploadResponse)
async def upload_property_image(
    property_id: str,
    ctx: CurrentUser,
    service: PropertiesServiceDep,
    file: Annotated[UploadFile, File()],
    slot: str = "image",
) -> ImageUploadResponse:
    """Bild für ein Objekt hochladen (multipart). ``slot`` benennt die
    Verwendung (z. B. „custom-map"); gibt die öffentliche URL zurück. Das
    Speichern der URL ins Objekt erfolgt separat per PATCH."""
    content = await file.read()
    try:
        url = service.upload_image(
            ctx,
            property_id,
            content,
            file.content_type or "application/octet-stream",
            slot=slot,
        )
        return ImageUploadResponse(url=url)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
