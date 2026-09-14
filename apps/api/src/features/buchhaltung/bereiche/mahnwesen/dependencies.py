"""Dependencies des Bereichs »mahnwesen«: Service-Factory.

Der Service bekommt den Service-Role-Client (RLS umgangen) — deshalb scopet
JEDE Operation im Service selbst auf `ctx.tenant_id` (Wurzel 3).
"""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import MahnwesenService


def get_mahnwesen_service() -> MahnwesenService:
    return MahnwesenService(get_service_client())


MahnwesenServiceDep = Annotated[MahnwesenService, Depends(get_mahnwesen_service)]
