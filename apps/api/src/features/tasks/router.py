"""Router für tasks. Gemountet unter /api/v1/tasks."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import TasksService

router = APIRouter(prefix="/tasks", tags=["tasks"])
_service = TasksService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
