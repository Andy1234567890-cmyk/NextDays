"""Router für guests. Gemountet unter /api/v1/guests."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import GuestsService

router = APIRouter(prefix="/guests", tags=["guests"])
_service = GuestsService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
