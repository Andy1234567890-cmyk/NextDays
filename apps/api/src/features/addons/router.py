"""Router für addons (Zusatzleistungen/Upsells). Gemountet unter /api/v1/addons.

Katalog-CRUD je Objekt + Medien-Upload sind MANAGE_PROPERTIES-geschützt
(Agentur/Co-Admin) und tenant-gescoped. Verkaufslesen auf den öffentlichen
Flächen läuft über booking_engine bzw. public_portal, nicht hier.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import AddonsServiceDep
from .schemas import (
    AddonCreate,
    AddonListResponse,
    AddonResponse,
    AddonUpdate,
    ReservationAddonAdd,
    ReservationAddonListResponse,
    ReservationAddonResponse,
    SliceHealth,
)
from .service import AddonError

_MANAGE = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_PROPERTIES
)

router = APIRouter(prefix="/addons", tags=["addons"])


@router.get("/health", response_model=SliceHealth)
def health(service: AddonsServiceDep) -> SliceHealth:
    return service.health()


@router.get("/properties/{property_id}", response_model=AddonListResponse)
def list_property_addons(
    property_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonListResponse:
    """Alle Zusatzleistungen eines Objekts (Katalog, inkl. inaktiver)."""
    try:
        return service.list_for_property(ctx, property_id)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/properties/{property_id}",
    response_model=AddonResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_addon(
    property_id: str,
    req: AddonCreate,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonResponse:
    try:
        return service.create(ctx, property_id, req)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{addon_id}", response_model=AddonResponse)
def update_addon(
    addon_id: str,
    req: AddonUpdate,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonResponse:
    try:
        return service.update(ctx, addon_id, req)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{addon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_addon(
    addon_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    try:
        service.delete(ctx, addon_id)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{addon_id}/media", response_model=AddonResponse)
async def add_addon_media(
    addon_id: str,
    service: AddonsServiceDep,
    file: Annotated[UploadFile, File()],
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonResponse:
    """Ein Medium (Foto) hochladen (multipart). JPEG/PNG/WebP, 10 KB–20 MB, max. 5."""
    content = await file.read()
    try:
        return service.add_media(ctx, addon_id, content, file.content_type or "")
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/reservations/{reservation_id}", response_model=ReservationAddonListResponse
)
def list_reservation_addons(
    reservation_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> ReservationAddonListResponse:
    """Gekaufte Zusatzleistungen einer Reservierung (Dashboard-Sicht)."""
    try:
        return service.list_for_reservation(ctx, reservation_id)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/reservations/{reservation_id}/available", response_model=AddonListResponse
)
def available_reservation_addons(
    reservation_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonListResponse:
    """Aktive Katalog-Add-ons des Objekts dieser Reservierung (Schnell-Auswahl)."""
    try:
        return service.available_for_reservation(ctx, reservation_id)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservations/{reservation_id}/addons",
    response_model=ReservationAddonListResponse,
)
def add_reservation_addon(
    reservation_id: str,
    req: ReservationAddonAdd,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> ReservationAddonListResponse:
    """Schnelltaste: Zusatzleistung zu einer bestehenden Buchung hinzufügen."""
    try:
        return service.add_to_reservation(ctx, reservation_id, req.addon_id, req.qty)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservation-addons/{res_addon_id}/mark-paid",
    response_model=ReservationAddonResponse,
)
def mark_addon_paid(
    res_addon_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> ReservationAddonResponse:
    """Manuell als bezahlt markieren (solange kein Payment-Provider live ist)."""
    try:
        return service.mark_paid(ctx, res_addon_id)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
