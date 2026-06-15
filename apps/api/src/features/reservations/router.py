"""Router für reservations. Gemountet unter /api/v1/reservations."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import ReservationsService

router = APIRouter(prefix="/reservations", tags=["reservations"])
_service = ReservationsService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
