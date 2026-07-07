"""Router für subscriptions. Gemountet unter /api/v1/subscriptions.

Abo-Billing Tenant → myNextDays (Grundgebühr + Objekt-Staffel + Module). Alle
Endpunkte sind tenant-geschützt (MANAGE_BILLING). Der Stripe-Webhook, der den
Abo-Status pflegt, hängt weiterhin am payments-Webhook (eine Signatur, ein
Endpunkt) — hier keine zweite Webhook-Route.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    BillCommissionsResult,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CommissionSummary,
    PortalSessionResponse,
    PricingResponse,
    SliceHealth,
    SubscriptionStatusResponse,
)
from .service import SubscriptionsError, SubscriptionsService

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
log = get_logger("nextdays.subscriptions")


def get_subscriptions_service() -> SubscriptionsService:
    return SubscriptionsService(service_client=get_service_client())


ServiceDep = Annotated[SubscriptionsService, Depends(get_subscriptions_service)]
_billing = Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_BILLING))]


def _handle(exc: SubscriptionsError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/health", response_model=SliceHealth)
def health(service: ServiceDep) -> SliceHealth:
    return service.health()


@router.get("/pricing", response_model=PricingResponse)
def get_pricing(ctx: _billing, service: ServiceDep) -> PricingResponse:
    """Echte Stripe-Beträge für die Billing-UI (kein Frontend-Hardcode)."""
    try:
        return service.get_pricing()
    except SubscriptionsError as exc:
        raise _handle(exc) from exc


@router.get("/status", response_model=SubscriptionStatusResponse)
def get_status(ctx: _billing, service: ServiceDep) -> SubscriptionStatusResponse:
    try:
        return service.get_status(ctx)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc


@router.post("/checkout", response_model=CheckoutSessionResponse)
def create_checkout(
    body: CheckoutSessionRequest, ctx: _billing, service: ServiceDep
) -> CheckoutSessionResponse:
    try:
        url = service.create_checkout(
            ctx,
            module_keys=body.module_keys,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
    except SubscriptionsError as exc:
        raise _handle(exc) from exc
    return CheckoutSessionResponse(checkout_url=url)


@router.post("/portal", response_model=PortalSessionResponse)
def create_portal(
    ctx: _billing, service: ServiceDep, return_url: str
) -> PortalSessionResponse:
    try:
        url = service.create_portal(ctx, return_url=return_url)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc
    return PortalSessionResponse(portal_url=url)


@router.post("/sync-quantity")
def sync_quantity(ctx: _billing, service: ServiceDep) -> dict[str, int]:
    """Objektzahl → Stripe-quantity nachziehen (idempotent). Wird nach
    Property-Änderungen aufgerufen."""
    try:
        count = service.sync_property_quantity(ctx)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc
    return {"property_count": count}


@router.get("/commissions", response_model=CommissionSummary)
def get_commissions(ctx: _billing, service: ServiceDep) -> CommissionSummary:
    """Übersicht der offenen externen OTA-Provisionen (1 %/0,5 %) + Satz."""
    try:
        return service.get_commission_summary(ctx)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc


@router.post("/bill-commissions", response_model=BillCommissionsResult)
def bill_commissions(
    ctx: _billing, service: ServiceDep, period: str
) -> BillCommissionsResult:
    """Offene externe Provisionen als Stripe-Invoice-Item aufs Abo buchen
    (period = YYYY-MM). Idempotent — fakturierte Zeilen werden nicht erneut
    berechnet."""
    try:
        count = service.bill_commissions_for_ctx(ctx, period=period)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc
    return BillCommissionsResult(billed_count=count, period=period)
