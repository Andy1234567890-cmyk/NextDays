"""Router für room_types. Gemountet unter /api/v1/room-types.

Zimmerkategorien eines Hotels — tenant-gescoped, MANAGE_PROPERTY_SETTINGS.
Die erste Kategorie schaltet die Property in den Hotel-Modus (0140).
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission

from .schemas import (
    RoomTypeCreate,
    RoomTypeListResponse,
    RoomTypeResponse,
    RoomTypeUpdate,
    SliceHealth,
)
from .service import RoomTypeError, RoomTypesService


def get_room_types_service() -> RoomTypesService:
    return RoomTypesService(service_client=get_service_client())


RoomTypesServiceDep = Annotated[RoomTypesService, Depends(get_room_types_service)]

_write = Annotated[
    AuthContext,
    Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
]

router = APIRouter(prefix="/room-types", tags=["room_types"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return RoomTypesService().health()


@router.get("", response_model=RoomTypeListResponse)
def list_room_types(
    service: RoomTypesServiceDep,
    ctx: _write,
    property_id: Annotated[str, Query()],
) -> RoomTypeListResponse:
    try:
        return service.list(ctx, property_id)
    except RoomTypeError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=RoomTypeResponse, status_code=status.HTTP_201_CREATED)
def create_room_type(
    req: RoomTypeCreate, service: RoomTypesServiceDep, ctx: _write
) -> RoomTypeResponse:
    try:
        return service.create(ctx, req)
    except RoomTypeError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{room_type_id}", response_model=RoomTypeResponse)
def update_room_type(
    room_type_id: str,
    req: RoomTypeUpdate,
    service: RoomTypesServiceDep,
    ctx: _write,
) -> RoomTypeResponse:
    try:
        return service.update(ctx, room_type_id, req)
    except RoomTypeError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{room_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room_type(
    room_type_id: str, service: RoomTypesServiceDep, ctx: _write
) -> None:
    try:
        service.delete(ctx, room_type_id)
    except RoomTypeError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
