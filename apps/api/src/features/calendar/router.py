"""Router für calendar. Gemountet unter /api/v1/calendar."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import CalendarService

router = APIRouter(prefix="/calendar", tags=["calendar"])
_service = CalendarService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
