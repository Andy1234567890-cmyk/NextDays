"""Dependencies des owner_billing-Slice: Service-Factory."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import OwnerBillingService


def get_owner_billing_service() -> OwnerBillingService:
    return OwnerBillingService(service_client=get_service_client())


OwnerBillingServiceDep = Annotated[
    OwnerBillingService, Depends(get_owner_billing_service)
]
