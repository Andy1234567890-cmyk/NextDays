"""Router für payments. Gemountet unter /api/v1/payments."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import PaymentsService

router = APIRouter(prefix="/payments", tags=["payments"])
_service = PaymentsService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
