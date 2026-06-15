"""Router für channel_manager. Gemountet unter /api/v1/channel-manager."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import ChannelManagerService

router = APIRouter(prefix="/channel-manager", tags=["channel_manager"])
_service = ChannelManagerService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
