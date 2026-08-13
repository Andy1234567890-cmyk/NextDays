"""Dependencies des payouts-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import PayoutsService
from .stripe_saldo import StripeSaldoService


def get_payouts_service() -> PayoutsService:
    # service_role: payouts/payout_adjustments/payout_holds sind für Clients
    # schreibgesperrt (0217) — wer dort schreiben könnte, würde sich selbst
    # Auszahlungen bewilligen. Der Scope kommt im Service ausschließlich aus
    # ctx.tenant_id (Wurzel 3).
    return PayoutsService(db=get_service_client())


PayoutsServiceDep = Annotated[PayoutsService, Depends(get_payouts_service)]


def get_stripe_saldo_service() -> StripeSaldoService:
    # service_role: tenant_billing_profile ist für Clients gesperrt (0169).
    # Das verbundene Konto kommt aus dem Profil des Tenants im Token (Wurzel 3).
    return StripeSaldoService(db=get_service_client())


StripeSaldoServiceDep = Annotated[
    StripeSaldoService, Depends(get_stripe_saldo_service)
]
