"""Router für public_portal. Gemountet unter /api/v1/public-portal."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import PublicPortalService

router = APIRouter(prefix="/public-portal", tags=["public_portal"])
_service = PublicPortalService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
