"""Dependency-Factory für den dashboard-Slice."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import DashboardService


def get_dashboard_service() -> DashboardService:
    return DashboardService(service_client=get_service_client())


DashboardServiceDep = Annotated[DashboardService, Depends(get_dashboard_service)]
