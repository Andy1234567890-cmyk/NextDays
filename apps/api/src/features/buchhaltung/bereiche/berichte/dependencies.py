"""Dependencies des Bereichs »berichte«: Service-Factory."""

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import BerichteService


def get_berichte_service() -> BerichteService:
    return BerichteService(get_service_client())


BerichteServiceDep = Annotated[BerichteService, Depends(get_berichte_service)]
