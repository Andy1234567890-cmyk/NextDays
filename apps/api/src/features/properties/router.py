"""Router für properties. Gemountet unter /api/v1/properties."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import PropertiesService

router = APIRouter(prefix="/properties", tags=["properties"])
_service = PropertiesService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
