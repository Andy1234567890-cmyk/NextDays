"""Dependencies des host_profiles-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import HostProfileService


def get_host_profile_service() -> HostProfileService:
    # service_role: host_profiles ist per RLS für Nicht-service_role gesperrt;
    # der Scope wird im Service über ctx.user_id erzwungen (Wurzel 3).
    return HostProfileService(db=get_service_client())


HostProfileServiceDep = Annotated[
    HostProfileService, Depends(get_host_profile_service)
]
