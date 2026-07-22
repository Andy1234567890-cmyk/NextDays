"""Router für guest_bookings. Gemountet unter /api/v1/guest-bookings.

Gast-Sicht „Meine Buchungen" des Kunden-Dashboards (/plattform). ALLE Endpunkte
(außer /health) verlangen ein Portal-Gast-Token (``CurrentGuest``) und sind strikt
über den E-Mail-Match (``ctx.email`` == ``reservations.guest_email``) gescopet —
sowohl die Liste als auch die ``{id}``-Pfade (Wurzel 3/9). Eine fremde Buchung
liefert 404 (kein Existenz-Leak).
"""
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from src.core.security import CurrentGuest
from src.core.supabase import get_service_client

from .schemas import (
    GuestBookingDetail,
    GuestBookingListResponse,
    GuestCancelRequest,
    GuestCancelResponse,
    GuestTimelineResponse,
    SliceHealth,
)
from .service import GuestBookingsError, GuestBookingsService

router = APIRouter(prefix="/guest-bookings", tags=["guest_bookings"])


def get_guest_bookings_service() -> GuestBookingsService:
    return GuestBookingsService(service_client=get_service_client())


GuestBookingsServiceDep = Annotated[
    GuestBookingsService, Depends(get_guest_bookings_service)
]


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    # Health hängt bewusst nicht an Supabase-Clients (kein Key nötig).
    return SliceHealth(slice="guest_bookings")


@router.get("", response_model=GuestBookingListResponse)
def list_bookings(
    ctx: CurrentGuest,
    service: GuestBookingsServiceDep,
    status: Annotated[
        Literal["upcoming", "past", "cancelled"] | None, Query()
    ] = None,
) -> GuestBookingListResponse:
    """Alle eigenen Buchungen (E-Mail-Match), optional nach Kategorie gefiltert."""
    try:
        return service.list_bookings(ctx.email, status, today=date.today())
    except GuestBookingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{reservation_id}", response_model=GuestBookingDetail)
def get_booking(
    reservation_id: str,
    ctx: CurrentGuest,
    service: GuestBookingsServiceDep,
) -> GuestBookingDetail:
    """Detail EINER eigenen Buchung (404, wenn nicht die eigene E-Mail)."""
    try:
        return service.get_booking(reservation_id, ctx.email, today=date.today())
    except GuestBookingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{reservation_id}/timeline", response_model=GuestTimelineResponse)
def timeline(
    reservation_id: str,
    ctx: CurrentGuest,
    service: GuestBookingsServiceDep,
) -> GuestTimelineResponse:
    """Maskierte Zeitleiste der eigenen Buchung (kind + Zeit, keine Interna)."""
    try:
        return service.timeline(reservation_id, ctx.email)
    except GuestBookingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{reservation_id}/cancel", response_model=GuestCancelResponse)
def cancel_booking(
    reservation_id: str,
    req: GuestCancelRequest,
    ctx: CurrentGuest,
    service: GuestBookingsServiceDep,
) -> GuestCancelResponse:
    """Eigene Buchung stornieren (nur frei stornierbar, nicht eingecheckt).

    Delegiert an die zentrale Storno-Logik (Nächte-Freigabe + Channex + Refund);
    idempotent (bereits storniert → 409)."""
    try:
        return service.cancel_booking(
            reservation_id, ctx.email, req.reason, today=date.today()
        )
    except GuestBookingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
