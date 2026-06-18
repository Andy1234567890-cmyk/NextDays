"""Router für content. Gemountet unter /api/v1/content."""
from fastapi import APIRouter, HTTPException

from src.core.security import CurrentUser

from .schemas import SliceHealth, TranslateRequest, TranslateResponse
from .service import ContentError, ContentService

router = APIRouter(prefix="/content", tags=["content"])
_service = ContentService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()


@router.post("/translate", response_model=TranslateResponse)
def translate(req: TranslateRequest, _ctx: CurrentUser) -> TranslateResponse:
    """Text übersetzen (Google Cloud Translation). Nur für eingeloggte Nutzer."""
    try:
        return _service.translate(req)
    except ContentError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
