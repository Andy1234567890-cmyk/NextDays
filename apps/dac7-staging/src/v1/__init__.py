"""Die Endpunkte der simulierten Empfangsstelle."""
from __future__ import annotations

from fastapi import APIRouter

from .einreichung import router as einreichung_router
from .quittungen import router as quittungen_router

router = APIRouter(prefix="/v1")
router.include_router(einreichung_router)
router.include_router(quittungen_router)
