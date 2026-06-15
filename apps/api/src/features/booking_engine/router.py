"""Router für booking_engine. Gemountet unter /api/v1/booking-engine."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import BookingEngineService

router = APIRouter(prefix="/booking-engine", tags=["booking_engine"])
_service = BookingEngineService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
