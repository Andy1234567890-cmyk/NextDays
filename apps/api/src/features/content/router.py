"""Router für content. Gemountet unter /api/v1/content."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import ContentService

router = APIRouter(prefix="/content", tags=["content"])
_service = ContentService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
