"""Dependencies des owner_reporting-Slice: Service-Factory."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import OwnerReportingService


def get_owner_reporting_service() -> OwnerReportingService:
    return OwnerReportingService(service_client=get_service_client())


OwnerReportingServiceDep = Annotated[
    OwnerReportingService, Depends(get_owner_reporting_service)
]
