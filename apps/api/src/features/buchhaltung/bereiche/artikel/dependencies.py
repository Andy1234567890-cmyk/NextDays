"""Dependencies des Bereichs »artikel«: Service-Factory."""

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import ArtikelService


def get_artikel_service() -> ArtikelService:
    return ArtikelService(get_service_client())


ArtikelServiceDep = Annotated[ArtikelService, Depends(get_artikel_service)]
