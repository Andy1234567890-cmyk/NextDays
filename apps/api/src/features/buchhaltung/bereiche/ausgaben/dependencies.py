"""Dependencies des Bereichs »ausgaben«: Service-Factory."""

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import AusgabenService


def get_ausgaben_service() -> AusgabenService:
    return AusgabenService(get_service_client())


AusgabenServiceDep = Annotated[AusgabenService, Depends(get_ausgaben_service)]
