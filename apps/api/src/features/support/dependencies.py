"""Dependencies des support-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import SupportService


def get_support_service() -> SupportService:
    # service_role: support_tickets/support_messages sind für anon und
    # authenticated hart gesperrt (Wurzel 6). Den Scope auf die eigene
    # Melder-Identität erzwingt der Service.
    return SupportService(db=get_service_client())


SupportServiceDep = Annotated[SupportService, Depends(get_support_service)]
