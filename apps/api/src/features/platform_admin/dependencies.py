"""Dependencies des platform_admin-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import PlatformAdminService
from .team_service import TeamService


def get_platform_admin_service() -> PlatformAdminService:
    # service_role: platform_admins/platform_audit_log sind für anon und
    # authenticated hart gesperrt (Wurzel 6). Die Autorisierung erzwingt der
    # Guard CurrentPlatformAdmin, nicht die DB-Rolle.
    return PlatformAdminService(db=get_service_client())


PlatformAdminServiceDep = Annotated[
    PlatformAdminService, Depends(get_platform_admin_service)
]


def get_team_service() -> TeamService:
    # Ebenfalls service_role: die Tabelle platform_admins ist für anon und
    # authenticated hart gesperrt, und die GoTrue-Admin-API (Konto anlegen,
    # Passwort setzen) gibt es nur mit dem Service-Client.
    return TeamService(db=get_service_client())


TeamServiceDep = Annotated[TeamService, Depends(get_team_service)]
