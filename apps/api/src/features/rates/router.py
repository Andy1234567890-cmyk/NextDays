"""Router für rates. Gemountet unter /api/v1/rates."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import RatesService

router = APIRouter(prefix="/rates", tags=["rates"])
_service = RatesService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
