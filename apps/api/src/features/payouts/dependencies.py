"""Dependencies des payouts-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import PayoutsService


def get_payouts_service() -> PayoutsService:
    # service_role: payouts/payout_adjustments/payout_holds sind für Clients
    # schreibgesperrt (0217) — wer dort schreiben könnte, würde sich selbst
    # Auszahlungen bewilligen. Der Scope kommt im Service ausschließlich aus
    # ctx.tenant_id (Wurzel 3).
    return PayoutsService(db=get_service_client())


PayoutsServiceDep = Annotated[PayoutsService, Depends(get_payouts_service)]
