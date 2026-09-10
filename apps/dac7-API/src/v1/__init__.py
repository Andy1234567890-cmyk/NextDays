"""Die Endpunkte der Versand-API."""
from __future__ import annotations

from fastapi import APIRouter

from .versand import router as versand_router

router = APIRouter(prefix="/v1")
router.include_router(versand_router)
