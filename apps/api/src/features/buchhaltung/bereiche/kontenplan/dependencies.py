"""Dependencies des Bereichs »kontenplan«: Service-Factory."""

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import KontenplanService


def get_kontenplan_service() -> KontenplanService:
    return KontenplanService(get_service_client())


KontenplanServiceDep = Annotated[KontenplanService, Depends(get_kontenplan_service)]
