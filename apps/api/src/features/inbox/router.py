"""Router für inbox. Gemountet unter /api/v1/inbox."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import InboxListResponse, SliceHealth
from .service import InboxError, InboxService


def get_inbox_service() -> InboxService:
    return InboxService(service_client=get_service_client())


InboxServiceDep = Annotated[InboxService, Depends(get_inbox_service)]

router = APIRouter(prefix="/inbox", tags=["inbox"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return InboxService().health()


@router.get("", response_model=InboxListResponse)
def list_threads(
    service: InboxServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_GUEST_FULL))
    ],
) -> InboxListResponse:
    try:
        return service.list_threads(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
