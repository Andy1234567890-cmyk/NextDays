"""Service-Factory des Bereichs »zahlungen«."""

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import ZahlungenService


def get_zahlungen_service() -> ZahlungenService:
    return ZahlungenService(get_service_client())


ZahlungenServiceDep = Annotated[ZahlungenService, Depends(get_zahlungen_service)]
