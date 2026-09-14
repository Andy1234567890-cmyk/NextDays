"""Dependencies des Bereichs »kontakte«: Service-Factory."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import KontakteService


def get_kontakte_service() -> KontakteService:
    return KontakteService(get_service_client())


KontakteServiceDep = Annotated[KontakteService, Depends(get_kontakte_service)]
