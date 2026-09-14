"""Dependencies des Bereichs »datev«: Service-Factory."""

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import DatevService


def get_datev_service() -> DatevService:
    return DatevService(get_service_client())


DatevServiceDep = Annotated[DatevService, Depends(get_datev_service)]
