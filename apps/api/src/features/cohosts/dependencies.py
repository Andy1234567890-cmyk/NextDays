"""Dependencies des cohosts-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .payout_service import PayoutService
from .service import CohostService
from .stripe_service import CohostStripeService


def get_cohost_stripe_service() -> CohostStripeService:
    # service_role: cohost_stripe_accounts ist für Clients schreibgesperrt
    # (wer dort schreiben könnte, würde Auszahlungen umleiten). Der Scope ist
    # ctx.user_id — jeder sieht nur sein eigenes Konto.
    return CohostStripeService(db=get_service_client())


def get_payout_service() -> PayoutService:
    # service_role: cohost_payouts ist Finanzdaten und für Clients
    # schreibgesperrt.
    return PayoutService(db=get_service_client())


CohostStripeServiceDep = Annotated[
    CohostStripeService, Depends(get_cohost_stripe_service)
]
PayoutServiceDep = Annotated[PayoutService, Depends(get_payout_service)]


def get_cohost_service() -> CohostService:
    # service_role: property_cohosts/cohost_invitations sind per RLS für
    # anon/authenticated schreibgesperrt, Einladungen auch lesegesperrt. Der
    # Scope wird im Service erzwungen — _require_own_property für die Sicht des
    # Eigentümers, user_id-Filter für die des Eingeladenen (Wurzel 3).
    return CohostService(db=get_service_client())


CohostServiceDep = Annotated[CohostService, Depends(get_cohost_service)]
