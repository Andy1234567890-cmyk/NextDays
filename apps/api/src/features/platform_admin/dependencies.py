"""Dependencies des platform_admin-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from supabase import Client

from src.core.supabase import get_service_client

from .deploy_service import DeployService
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


def get_deploy_service() -> DeployService:
    # Der Service selbst hält keinen Client: die teuren Wege sprechen Coolify,
    # der Lesepfad bekommt den Client als Argument (get_deploy_db).
    return DeployService()


DeployServiceDep = Annotated[DeployService, Depends(get_deploy_service)]


def get_deploy_db() -> Client:
    """service_role für den Lese-Zugriff auf `public.deploy_spiegel`.

    Wurzel 6: die Tabelle ist für anon/authenticated auf `select` beschränkt
    und die Policy verlangt `is_platform_admin()`. Der Request-Pfad läuft
    trotzdem über service_role, weil die API mit dem Service-Client arbeitet —
    die Autorisierung erzwingt der Guard `CurrentPlatformAdmin` am Endpunkt,
    genau wie beim übrigen Backoffice.
    """
    return get_service_client()


DeployDbDep = Annotated[Client, Depends(get_deploy_db)]
