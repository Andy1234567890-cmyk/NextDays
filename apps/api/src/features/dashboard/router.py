"""Router für dashboard. Gemountet unter /api/v1/dashboard."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
_service = DashboardService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
