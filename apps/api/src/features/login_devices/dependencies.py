"""Dependencies des login_devices-Slice: Service-Factories."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .geo import GeoRangeService
from .service import LoginDeviceService


def get_login_device_service() -> LoginDeviceService:
    # service_role: login_devices/ip_geo_ranges sind per RLS für Nicht-service_role
    # gesperrt; der Scope wird im Service über ctx.user_id erzwungen (Wurzel 3).
    return LoginDeviceService(db=get_service_client())


def get_geo_range_service() -> GeoRangeService:
    return GeoRangeService(db=get_service_client())


LoginDeviceServiceDep = Annotated[
    LoginDeviceService, Depends(get_login_device_service)
]
GeoRangeServiceDep = Annotated[GeoRangeService, Depends(get_geo_range_service)]
