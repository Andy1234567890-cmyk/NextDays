"""Router für owners (verwaltete Eigentümer). Gemountet unter /api/v1/owners.

Alle Schreib-/Lese-Endpunkte sind MANAGE_OWNERS-geschützt (Agentur-Rolle) und
tenant-gescoped. Eigentümer-Stammdaten + Objekt-Zuordnung mit Anteil/Provision.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import OwnersServiceDep
from .schemas import (
    AvailablePropertiesResponse,
    OwnerCreate,
    OwnerListResponse,
    OwnerPropertyAssign,
    OwnerResponse,
    OwnerUpdate,
    SliceHealth,
)
from .service import OwnerError

router = APIRouter(prefix="/owners", tags=["owners"])

# Wiederverwendete Permission-Dependency für alle Eigentümer-Endpunkte.
_MANAGE = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_OWNERS
)


@router.get("/health", response_model=SliceHealth)
def health(service: OwnersServiceDep) -> SliceHealth:
    return service.health()


@router.get("", response_model=OwnerListResponse)
def list_owners(
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerListResponse:
    try:
        return service.list(ctx)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=OwnerResponse, status_code=status.HTTP_201_CREATED)
def create_owner(
    req: OwnerCreate,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerResponse:
    try:
        return service.create(ctx, req)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{owner_id}", response_model=OwnerResponse)
def get_owner(
    owner_id: str,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerResponse:
    try:
        return service.get(ctx, owner_id)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{owner_id}", response_model=OwnerResponse)
def update_owner(
    owner_id: str,
    req: OwnerUpdate,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerResponse:
    try:
        return service.update(ctx, owner_id, req)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_owner(
    owner_id: str,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    try:
        service.delete(ctx, owner_id)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/{owner_id}/available-properties", response_model=AvailablePropertiesResponse
)
def available_properties(
    owner_id: str,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AvailablePropertiesResponse:
    """Objekte, die diesem Owner zugeordnet werden dürfen (frei oder bereits sein).
    Objekte anderer Eigentümer fehlen — ein Objekt gehört genau einem Owner."""
    try:
        return service.available_properties(ctx, owner_id)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{owner_id}/properties", response_model=OwnerResponse)
def assign_property(
    owner_id: str,
    req: OwnerPropertyAssign,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerResponse:
    """Objekt zuordnen oder Anteil/Provisions-Override aktualisieren."""
    try:
        return service.assign_property(ctx, owner_id, req)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{owner_id}/properties/{property_id}", response_model=OwnerResponse)
def unassign_property(
    owner_id: str,
    property_id: str,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerResponse:
    try:
        return service.unassign_property(ctx, owner_id, property_id)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
