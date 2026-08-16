"""Dependencies des dashboard_layout-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import DashboardLayoutService


def get_dashboard_layout_service() -> DashboardLayoutService:
    # service_role: beide Tabellen sind per RLS + GRANT-Entzug fuer
    # Nicht-service_role gesperrt (0402); den Scope erzwingt der Service ueber
    # ctx.user_id bzw. ctx.tenant_id (Wurzel 3).
    return DashboardLayoutService(db=get_service_client())


DashboardLayoutServiceDep = Annotated[
    DashboardLayoutService, Depends(get_dashboard_layout_service)
]
