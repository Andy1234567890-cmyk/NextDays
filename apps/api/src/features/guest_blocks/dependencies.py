"""Dependencies des guest_blocks-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import GuestBlockService


def get_guest_block_service() -> GuestBlockService:
    # service_role: blocked_guests ist per RLS für Nicht-service_role gesperrt;
    # der Scope wird im Service über ctx.tenant_id erzwungen (Wurzel 3).
    return GuestBlockService(db=get_service_client())


GuestBlockServiceDep = Annotated[
    GuestBlockService, Depends(get_guest_block_service)
]
