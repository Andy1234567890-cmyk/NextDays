"""Router für inbox. Gemountet unter /api/v1/inbox."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import InboxService

router = APIRouter(prefix="/inbox", tags=["inbox"])
_service = InboxService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
