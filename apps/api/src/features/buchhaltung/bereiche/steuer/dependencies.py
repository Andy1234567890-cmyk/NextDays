"""Dependencies des Bereichs »steuer«: Service-Factory."""

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import SteuerService


def get_steuer_service() -> SteuerService:
    return SteuerService(service_client=get_service_client())


SteuerServiceDep = Annotated[SteuerService, Depends(get_steuer_service)]
