"""Router für content. Gemountet unter /api/v1/content."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import SliceHealth, TranslateRequest, TranslateResponse
from .service import ContentError, ContentService

router = APIRouter(prefix="/content", tags=["content"])
_service = ContentService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()


@router.post("/translate", response_model=TranslateResponse)
def translate(
    req: TranslateRequest,
    _ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_PROPERTIES))
    ],
) -> TranslateResponse:
    """Text übersetzen (Google Cloud Translation).

    MANAGE_PROPERTIES statt bloßer Authentifizierung: der Endpunkt stößt eine
    kostenpflichtige Fremd-API an und wird ausschließlich im Objekt-Texteditor
    genutzt. Zuvor konnte jeder eingeloggte cleaner beliebig übersetzen lassen
    (Wurzel 9). Zusätzlich im strengen `ai`-Rate-Limit-Bucket.
    """
    try:
        return _service.translate(req)
    except ContentError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
