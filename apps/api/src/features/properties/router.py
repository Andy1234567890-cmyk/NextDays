"""Router für properties. Gemountet unter /api/v1/properties."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.core.security import AuthContext, CurrentUser
from src.core.uploads import read_upload
from src.features.auth.dependencies import require_lodgify_permission
from src.features.auth.lodgify_permissions import Permission

from .dependencies import PropertiesServiceDep
from .schemas import (
    ImageUploadResponse,
    PhotoReorderRequest,
    PhotoUpdateRequest,
    PropertyCreate,
    PropertyListResponse,
    PropertyPhoto,
    PropertyPhotoListResponse,
    PropertyResponse,
    PropertyUpdate,
    SliceHealth,
)
from .service import PropertyError

# Wiederverwendete Permission-Dependency für alle Foto-Endpunkte.
_MANAGE_IMAGES = require_lodgify_permission(  # noqa: N816  pylint: disable=invalid-name
    Permission.PM_MANAGE_PROPERTY_IMAGES
)

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
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_lodgify_permission(Permission.EDIT_PROPERTY))
    ],
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


@router.post("/{property_id}/publish", response_model=PropertyResponse)
def publish_property(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_lodgify_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
    ],
) -> PropertyResponse:
    """Objekt veröffentlichen (draft→active), an Channex übertragen und den
    Kalender initialisieren. Erfordert einen hinterlegten Preis."""
    try:
        return service.publish(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{property_id}/resync", response_model=PropertyResponse)
def resync_property(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_lodgify_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
    ],
) -> PropertyResponse:
    """Objekt-Inhalte (inkl. Fotos, Ausstattung, Belegung) erneut an die
    Buchungsportale übertragen — ohne Statuswechsel."""
    try:
        return service.resync_content(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{property_id}/image", response_model=ImageUploadResponse)
async def upload_property_image(
    property_id: str,
    request: Request,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_lodgify_permission(Permission.PM_MANAGE_PROPERTY_IMAGES)),
    ],
    slot: str = "image",
) -> ImageUploadResponse:
    """Bild für ein Objekt hochladen (multipart). ``slot`` benennt die
    Verwendung (z. B. „custom-map"); gibt die öffentliche URL zurück. Das
    Speichern der URL ins Objekt erfolgt separat per PATCH."""
    content, content_type = await read_upload(request)
    try:
        url = service.upload_image(
            ctx,
            property_id,
            content,
            content_type or "application/octet-stream",
            slot=slot,
        )
        return ImageUploadResponse(url=url)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Foto-/Galerieverwaltung (property_photos) -------------------------------


@router.get("/{property_id}/photos", response_model=PropertyPhotoListResponse)
def list_property_photos(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> PropertyPhotoListResponse:
    """Fotos eines Objekts, nach Reihenfolge sortiert."""
    try:
        return service.list_photos(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{property_id}/photos",
    response_model=PropertyPhoto,
    status_code=status.HTTP_201_CREATED,
)
async def add_property_photo(
    property_id: str,
    request: Request,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> PropertyPhoto:
    """Ein Galerie-Foto hochladen (multipart). JPEG/PNG, 50 KB–20 MB. Das Foto
    wird ans Ende einsortiert; das erste Foto wird automatisch zum Cover. Der
    Client lädt mehrere Dateien über wiederholte Aufrufe hoch."""
    content, content_type = await read_upload(request)
    try:
        return service.add_photo(
            ctx,
            property_id,
            content,
            content_type or "application/octet-stream",
        )
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch(
    "/{property_id}/photos/reorder", response_model=PropertyPhotoListResponse
)
def reorder_property_photos(
    property_id: str,
    req: PhotoReorderRequest,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> PropertyPhotoListResponse:
    """Reihenfolge der Fotos setzen (vollständige Liste der Foto-IDs)."""
    try:
        return service.reorder_photos(ctx, property_id, req.photo_ids)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{property_id}/photos/{photo_id}", response_model=PropertyPhoto)
def update_property_photo(
    property_id: str,
    photo_id: str,
    req: PhotoUpdateRequest,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> PropertyPhoto:
    """Bildunterschrift (je Locale) und/oder Cover eines Fotos setzen."""
    try:
        return service.update_photo(ctx, property_id, photo_id, req)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/{property_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_property_photo(
    property_id: str,
    photo_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> None:
    """Foto löschen (Datei + Zeile); war es das Cover, wird neu vergeben."""
    try:
        service.delete_photo(ctx, property_id, photo_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
