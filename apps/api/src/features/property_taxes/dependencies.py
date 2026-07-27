"""Dependencies des property_taxes-Slice."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import PropertyTaxService


def get_property_tax_service() -> PropertyTaxService:
    # service_role: property_taxes ist per revoke fuer anon/authenticated
    # gesperrt (Wurzel 6). Der Tenant-Scope kommt aus ctx.tenant_id im
    # Service, nicht aus der DB-Rolle (Wurzel 3).
    return PropertyTaxService(db=get_service_client())


PropertyTaxServiceDep = Annotated[
    PropertyTaxService, Depends(get_property_tax_service)
]
