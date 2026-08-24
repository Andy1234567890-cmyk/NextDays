"""Router für subscriptions. Gemountet unter /api/v1/subscriptions.

Abo-Billing Tenant → myNextDays (Grundgebühr + Objekt-Staffel + Module). Alle
Endpunkte sind tenant-geschützt (MANAGE_BILLING). Der Stripe-Webhook, der den
Abo-Status pflegt, hängt weiterhin am payments-Webhook (eine Signatur, ein
Endpunkt) — hier keine zweite Webhook-Route.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    BillCommissionsResult,
    BillingAddress,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CommissionEntry,
    CommissionMonth,
    CommissionSummary,
    InvoiceRow,
    ModuleEntitlement,
    ModuleToggleRequest,
    PortalSessionResponse,
    PricingResponse,
    PublicPricingResponse,
    QuantityChangeRequest,
    QuantityChangeResponse,
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


# ÖFFENTLICH (kein Login): die Preisliste für die Marketing-Preisseite.
#
# Warum ohne Auth: die Seite muss die echten Beträge zeigen, BEVOR jemand ein
# Konto hat — der geschützte `/pricing` oben verlangt MANAGE_BILLING und wäre
# dort nicht aufrufbar. Die Alternative (Beträge in den 24 Sprachdateien
# hinschreiben) ist genau der Hardcode, den Wurzel 4 verbietet.
#
# Was ihn trägt: die Antwort enthält AUSSCHLIESSLICH unsere eigene Preisliste —
# keine Tenant-Daten, keine IDs, nichts, was ein Scope schützen müsste. Der
# Verstärkungs-Aspekt (jeder Aufruf = sechs Stripe-Abfragen) ist im Service
# durch den TTL-Cache geschlossen, der Scraper-Aspekt durch den
# `listings`-Bucket des Rate-Limiters (240/60 pro IP, core/ratelimit_middleware).
@router.get("/public/pricing", response_model=PublicPricingResponse)
def get_public_pricing(
    service: ServiceDep,
    currency: Annotated[
        str | None,
        Query(
            min_length=3,
            max_length=3,
            pattern="^[A-Za-z]{3}$",
            description=(
                "Gewünschte Anzeigewährung als ISO-4217-Code. Nur ein WUNSCH: "
                "hat Stripe für sie keine Beträge, antwortet die Liste in der "
                "Standardwährung. Das Feld `currency` der Antwort sagt immer, "
                "welche Währung tatsächlich drinsteht."
            ),
        ),
    ] = None,
) -> PublicPricingResponse:
    """Preisliste + Provisionskonditionen für die öffentliche Preisseite.

    Die Längen-/Musterprüfung steht schon hier, damit unsinniger Input mit 422
    endet, bevor er den Service erreicht — der Endpunkt ist öffentlich
    (Wurzel 8). Der Service prüft denselben Code nochmals, weil er auch von der
    eingeloggten Billing-UI aus aufgerufen wird.
    """
    try:
        return service.get_public_pricing(currency)
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
            property_count=body.property_count,
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


@router.post("/quantity", response_model=QuantityChangeResponse)
def change_quantity(
    body: QuantityChangeRequest, ctx: _billing, service: ServiceDep
) -> QuantityChangeResponse:
    """Gebuchte Objektzahl ändern. Erhöhen wirkt sofort (anteilige Berechnung),
    Verkleinern nur, wenn nicht mehr Objekte veröffentlicht sind (422)."""
    try:
        count = service.change_quantity(ctx, property_count=body.property_count)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc
    return QuantityChangeResponse(property_count=count)


@router.post("/modules", response_model=ModuleEntitlement)
def add_module(
    body: ModuleToggleRequest, ctx: _billing, service: ServiceDep
) -> ModuleEntitlement:
    """Zusatzmodul zum laufenden Abo hinzufügen (anteilig sofort berechnet).

    Kein zweiter Checkout — das würde eine zweite Subscription mit doppelter
    Grundgebühr anlegen. Ohne laufendes Abo: 422.
    """
    try:
        return service.add_module(ctx, module_key=body.module_key)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc


@router.delete("/modules/{module_key}", response_model=ModuleEntitlement)
def remove_module(
    module_key: str, ctx: _billing, service: ServiceDep
) -> ModuleEntitlement:
    """Zusatzmodul kündigen. Der Zugang bleibt bis zum Ende der bezahlten
    Periode bestehen (keine Gutschrift, dafür kein sofortiger Entzug)."""
    try:
        return service.remove_module(ctx, module_key=module_key)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc


@router.get("/billing-address", response_model=BillingAddress)
def get_billing_address(ctx: _billing, service: ServiceDep) -> BillingAddress:
    """Rechnungsadresse des Betriebs (liegt am Stripe-Customer)."""
    try:
        return service.get_billing_address(ctx)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc


@router.put("/billing-address", response_model=BillingAddress)
def update_billing_address(
    ctx: _billing, service: ServiceDep, addr: BillingAddress
) -> BillingAddress:
    """Rechnungsadresse setzen. Gilt nur für ZUKÜNFTIGE Rechnungen — bereits
    ausgestellte bleiben unverändert (steuerlich bindend)."""
    try:
        return service.update_billing_address(ctx, addr)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc


@router.get("/invoices", response_model=list[InvoiceRow])
def list_invoices(
    ctx: _billing,
    service: ServiceDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 24,
) -> list[InvoiceRow]:
    """Rechnungsverlauf aus Stripe (neueste zuerst)."""
    try:
        return service.list_invoices(ctx, limit=limit)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc


@router.get("/commission-months", response_model=list[CommissionMonth])
def list_commission_months(
    ctx: _billing,
    service: ServiceDep,
    limit: Annotated[int, Query(ge=1, le=60)] = 24,
) -> list[CommissionMonth]:
    """Provisionen je Abrechnungsmonat (neueste zuerst) mit Einzugsdatum."""
    try:
        return service.get_commission_months(ctx, limit=limit)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc


@router.get(
    "/commission-months/{period}/entries",
    response_model=list[CommissionEntry],
)
def list_commission_entries(
    ctx: _billing,
    service: ServiceDep,
    period: Annotated[str, Path(pattern=r"^\d{4}-\d{2}$")],
) -> list[CommissionEntry]:
    """Die Einzelbuchungen EINES Monats — vorläufige Aufstellung zur Monatszeile.

    Derselbe Guard wie die Monatsliste (`_billing`): die Aufstellung zeigt
    dieselben Daten feiner aufgelöst, samt Gastname und Objekt. Eine schwächere
    Autorisierung als beim Listen-Endpunkt wäre hier ein IDOR-in-role
    (Wurzel 9).

    `period` ist auf YYYY-MM gemustert — ein freier String ginge sonst
    ungeprüft in die Filterrechnung.
    """
    try:
        return service.get_commission_entries(ctx, period)
    except SubscriptionsError as exc:
        raise _handle(exc) from exc


@router.get("/commissions", response_model=CommissionSummary)
def get_commissions(ctx: _billing, service: ServiceDep) -> CommissionSummary:
    """Übersicht der offenen externen OTA-Provisionen (0,5 %) + Satz."""
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
