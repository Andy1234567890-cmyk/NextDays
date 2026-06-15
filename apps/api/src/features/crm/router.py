"""Router für crm. Gemountet unter /api/v1/crm."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import CrmService

router = APIRouter(prefix="/crm", tags=["crm"])
_service = CrmService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
