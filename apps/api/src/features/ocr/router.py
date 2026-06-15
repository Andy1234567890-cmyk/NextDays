"""Router für ocr. Gemountet unter /api/v1/ocr."""
from fastapi import APIRouter

from .schemas import SliceHealth
from .service import OcrService

router = APIRouter(prefix="/ocr", tags=["ocr"])
_service = OcrService()


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()
