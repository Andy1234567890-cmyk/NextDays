"""Dependencies des taxpayer-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import TaxpayerService


def get_taxpayer_service() -> TaxpayerService:
    # service_role: taxpayer_info ist per RLS + revoke für Nicht-service_role
    # gesperrt; der Tenant-Scope wird im Service erzwungen (Wurzel 3).
    return TaxpayerService(db=get_service_client())


TaxpayerServiceDep = Annotated[TaxpayerService, Depends(get_taxpayer_service)]
