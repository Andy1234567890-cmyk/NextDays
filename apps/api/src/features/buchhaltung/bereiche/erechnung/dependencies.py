"""Dependencies des Bereichs »erechnung«: Service-Factory.

Der Service bekommt den Service-Role-Client (RLS umgangen) — deshalb scopet
JEDE Operation im Service selbst auf `ctx.tenant_id` (Wurzel 3).
"""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import ERechnungService


def get_erechnung_service() -> ERechnungService:
    return ERechnungService(get_service_client())


ERechnungServiceDep = Annotated[ERechnungService, Depends(get_erechnung_service)]
