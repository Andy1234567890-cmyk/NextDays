"""Router für guest_stay. Gemountet unter /api/v1/guest-stay.

Gast-Endpunkte des Kunden-Dashboards (/plattform): der eingeloggte Gast ruft für
SEINE Buchung das Gastmodul ab und checkt selbst ein. Jeder Endpunkt läuft unter
`CurrentGuest` (Gast-Token) und scopet ausschließlich über die Gast-E-Mail; eine
fremde Buchung ist 404 (Wurzel 3/9).
"""
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import CurrentGuest
from src.core.supabase import get_service_client

from .schemas import GuestCheckInResponse, GuestStayResponse, SliceHealth
from .service import GuestStayError, GuestStayService

router = APIRouter(prefix="/guest-stay", tags=["guest_stay"])


def get_service() -> GuestStayService:
    return GuestStayService(client=get_service_client())


ServiceDep = Annotated[GuestStayService, Depends(get_service)]


@router.get("/health", response_model=SliceHealth)
def health(service: ServiceDep) -> SliceHealth:
    return service.health()


@router.get("/{reservation_id}", response_model=GuestStayResponse)
def get_stay(
    reservation_id: str,
    service: ServiceDep,
    ctx: CurrentGuest,
) -> GuestStayResponse:
    """Gastmodul für EINE Buchung des Gasts (E-Mail-Match, sonst 404).

    Der door_code ist nur befüllt, wenn die Freigaberegeln erfüllt sind (sonst
    None + door_code_hidden_reason)."""
    try:
        return service.get_stay(ctx.email, reservation_id)
    except GuestStayError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{reservation_id}/check-in", response_model=GuestCheckInResponse)
def self_check_in(
    reservation_id: str,
    service: ServiceDep,
    ctx: CurrentGuest,
) -> GuestCheckInResponse:
    """Self-Check-in durch den Gast (E-Mail-gescopet, idempotent)."""
    try:
        return service.self_check_in(
            ctx.email, reservation_id, today=datetime.now(UTC).date()
        )
    except GuestStayError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
