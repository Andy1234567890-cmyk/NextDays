"""Die Endpunkte der simulierten Empfangsstelle."""
from __future__ import annotations

from fastapi import APIRouter

from .einreichung import router as einreichung_router
from .quittungen import router as quittungen_router
from .schluessel import router as schluessel_router

router = APIRouter(prefix="/v1")
router.include_router(einreichung_router)
router.include_router(quittungen_router)
# Ohne Anmeldung: ein oeffentlicher Schluessel ist oeffentlich, und ein
# neuer Absender soll ihn holen koennen, bevor er ein Geheimnis hat.
router.include_router(schluessel_router)
