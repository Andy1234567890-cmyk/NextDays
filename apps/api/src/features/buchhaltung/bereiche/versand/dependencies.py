"""Dependencies des Bereichs »versand«: Service-Factory.

Der Service bekommt den Service-Role-Client (RLS umgangen) — deshalb scopet
JEDE Operation im Service selbst auf `ctx.tenant_id` (Wurzel 3).
"""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import VersandService


def get_versand_service() -> VersandService:
    return VersandService(get_service_client())


VersandServiceDep = Annotated[VersandService, Depends(get_versand_service)]
