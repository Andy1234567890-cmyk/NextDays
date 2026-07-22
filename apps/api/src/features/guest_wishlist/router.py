"""Router für guest_wishlist. Gemountet unter /api/v1/guest-wishlist.

Merkzettel des Kunden-Dashboards (/plattform). JEDE Route verlangt einen
eingeloggten Portal-Gast (``CurrentGuest``) und scopet ausschließlich über
``ctx.guest_id`` (Wurzel 3/9) — auch die ``{wishlist_id}``-/Item-Routen prüfen
denselben Scope wie die Liste (fremde Liste → 404), nicht nur die Existenz.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import CurrentGuest
from src.core.supabase import get_service_client

from .schemas import (
    MessageResponse,
    SliceHealth,
    WishlistCreateRequest,
    WishlistDetailResponse,
    WishlistItemAddRequest,
    WishlistListResponse,
    WishlistSummary,
)
from .service import GuestWishlistService, WishlistError


def get_guest_wishlist_service() -> GuestWishlistService:
    return GuestWishlistService(service_client=get_service_client())


GuestWishlistServiceDep = Annotated[
    GuestWishlistService, Depends(get_guest_wishlist_service)
]

router = APIRouter(prefix="/guest-wishlist", tags=["guest_wishlist"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return GuestWishlistService().health()


@router.get("", response_model=WishlistListResponse)
def list_wishlists(
    ctx: CurrentGuest,
    service: GuestWishlistServiceDep,
) -> WishlistListResponse:
    """Alle Merkzettel des eingeloggten Gasts mit Item-Anzahl."""
    try:
        return service.list_wishlists(ctx.guest_id)
    except WishlistError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=WishlistSummary)
def create_wishlist(
    req: WishlistCreateRequest,
    ctx: CurrentGuest,
    service: GuestWishlistServiceDep,
) -> WishlistSummary:
    """Neuen Merkzettel anlegen (Name aus dem Request)."""
    try:
        return service.create_wishlist(ctx.guest_id, req)
    except WishlistError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{wishlist_id}", response_model=WishlistDetailResponse)
def get_items(
    wishlist_id: str,
    ctx: CurrentGuest,
    service: GuestWishlistServiceDep,
) -> WishlistDetailResponse:
    """Items einer eigenen Liste (Scope-Check, fremde Liste → 404)."""
    try:
        return service.get_items(ctx.guest_id, wishlist_id)
    except WishlistError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{wishlist_id}", response_model=MessageResponse)
def delete_wishlist(
    wishlist_id: str,
    ctx: CurrentGuest,
    service: GuestWishlistServiceDep,
) -> MessageResponse:
    """Merkzettel löschen (Scope-Check, fremde Liste → 404)."""
    try:
        return service.delete_wishlist(ctx.guest_id, wishlist_id)
    except WishlistError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{wishlist_id}/items", response_model=MessageResponse)
def add_item(
    wishlist_id: str,
    req: WishlistItemAddRequest,
    ctx: CurrentGuest,
    service: GuestWishlistServiceDep,
) -> MessageResponse:
    """Objekt (+ optionale Notiz) hinzufügen. Idempotent (schon drin → 200)."""
    try:
        return service.add_item(ctx.guest_id, wishlist_id, req)
    except WishlistError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{wishlist_id}/items/{property_id}", response_model=MessageResponse)
def remove_item(
    wishlist_id: str,
    property_id: str,
    ctx: CurrentGuest,
    service: GuestWishlistServiceDep,
) -> MessageResponse:
    """Objekt aus einer eigenen Liste entfernen (Scope-Check)."""
    try:
        return service.remove_item(ctx.guest_id, wishlist_id, property_id)
    except WishlistError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
