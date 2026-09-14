"""Dependencies des Bereichs »belege«: Service-Factory."""

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import BelegeService


def get_belege_service() -> BelegeService:
    return BelegeService(get_service_client())


BelegeServiceDep = Annotated[BelegeService, Depends(get_belege_service)]
