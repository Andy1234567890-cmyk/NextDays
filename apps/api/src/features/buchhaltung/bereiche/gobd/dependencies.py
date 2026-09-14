"""Dependencies des Bereichs »gobd«: Service-Factory.

Der Service bekommt den Service-Role-Client (RLS umgangen) — deshalb scopet
JEDE Operation im Service selbst auf `ctx.tenant_id` (Wurzel 3).
"""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import GobdService


def get_gobd_service() -> GobdService:
    return GobdService(get_service_client())


GobdServiceDep = Annotated[GobdService, Depends(get_gobd_service)]
