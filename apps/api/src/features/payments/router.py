"""Router für payments. Gemountet unter /api/v1/payments.

- Connect (Custom, white-label): Account anlegen/aktualisieren, KYC-Status, IBAN.
  Tenant-geschützt (Admin/Billing).
- Gast-Zahlung: ``POST /payments/booking/{reservation_id}/intent`` (public — Gäste
  zahlen ohne Login; Tenant serverseitig aus der Reservierung).
- Kaution/Refund: tenant-geschützt (MANAGE_BILLING).
- Webhook (kein JWT, via Stripe-Signatur): account.updated + payment_intent.*/charge.refunded.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    BookingPaymentResult,
    ConnectAccountCreate,
    ConnectAccountResponse,
    ConnectAccountStatus,
    ConnectAccountUpdate,
    DepositCaptureRequest,
    ExternalAccountRequest,
    PaymentsDiagnostics,
    RefundRequest,
    SliceHealth,
)
from .service import PaymentsError, PaymentsService
from .webhook import handle_stripe_event

router = APIRouter(prefix="/payments", tags=["payments"])
log = get_logger("nextdays.payments")


def get_payments_service() -> PaymentsService:
    return PaymentsService(service_client=get_service_client())


PaymentsServiceDep = Annotated[PaymentsService, Depends(get_payments_service)]
_billing = Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_BILLING))]


@router.get("/health", response_model=SliceHealth)
def health(service: PaymentsServiceDep) -> SliceHealth:
    return service.health()


@router.get("/diagnostics", response_model=PaymentsDiagnostics)
def diagnostics(
    service: PaymentsServiceDep, ctx: _billing
) -> PaymentsDiagnostics:
    """Sichtbares System-/Stripe-Debugging: Redis/DB/Stripe-Erreichbarkeit +
    roher Stripe-Connect-Status (was Stripe wirklich verlangt)."""
    try:
        return service.diagnostics(ctx)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Stripe Connect (Custom, white-label) -------------------------------------

@router.post("/connect/accounts", response_model=ConnectAccountResponse)
def create_connect_account(
    req: ConnectAccountCreate, service: PaymentsServiceDep, ctx: _billing
) -> ConnectAccountResponse:
    """Custom-Account für den Gastgeber anlegen (kein Stripe-Branding). Die KYC-
    Erfassung läuft danach über die eigene UI (update/external-account)."""
    try:
        # tenant_id AUSSCHLIESSLICH aus dem Token (Wurzel 3), nie aus dem Body.
        return service.create_connect_account(ctx.tenant_id, req)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/connect/accounts/{stripe_account_id}", response_model=ConnectAccountStatus)
def get_connect_account_status(
    stripe_account_id: str, service: PaymentsServiceDep, ctx: _billing
) -> ConnectAccountStatus:
    """KYC-/Aktivierungsstatus + offene Requirements (für die eigene Onboarding-UI)."""
    try:
        return service.get_connect_account_status(ctx.tenant_id, stripe_account_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/connect/accounts/{stripe_account_id}", response_model=ConnectAccountStatus)
def update_connect_account(
    stripe_account_id: str,
    req: ConnectAccountUpdate,
    service: PaymentsServiceDep,
    ctx: _billing,
) -> ConnectAccountStatus:
    """Geschäfts-/Inhaberdaten an den Custom-Account senden (eigene UI)."""
    try:
        return service.update_connect_account(ctx.tenant_id, stripe_account_id, req.fields)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/connect/accounts/{stripe_account_id}/accept-tos",
    response_model=ConnectAccountStatus,
)
def accept_tos(
    stripe_account_id: str,
    request: Request,
    service: PaymentsServiceDep,
    ctx: _billing,
) -> ConnectAccountStatus:
    """Stripe-Services-Vereinbarung akzeptieren — mit der ECHTEN Nutzer-IP
    (Compliance-Nachweis). Schließt das KYC ab, sodass der Account aktiviert
    werden kann."""
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else ""
    )
    try:
        return service.accept_tos(
            ctx.tenant_id, stripe_account_id, ip=ip,
            when=int(datetime.now(UTC).timestamp()),
        )
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/connect/accounts/{stripe_account_id}/bank", response_model=ConnectAccountStatus)
def set_external_account(
    stripe_account_id: str,
    req: ExternalAccountRequest,
    service: PaymentsServiceDep,
    ctx: _billing,
) -> ConnectAccountStatus:
    """Auszahlungs-Bankkonto (IBAN) am Custom-Account hinterlegen."""
    try:
        return service.set_external_account(
            ctx.tenant_id,
            stripe_account_id,
            iban=req.iban,
            account_holder=req.account_holder,
            country=req.country,
        )
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Gast-Zahlung (public — Gäste zahlen ohne Login) --------------------------

@router.post("/booking/{reservation_id}/intent", response_model=BookingPaymentResult)
def create_booking_intent(
    reservation_id: str, service: PaymentsServiceDep
) -> BookingPaymentResult:
    """PaymentIntent für eine Gastbuchung — Tenant kommt aus der Reservierung."""
    try:
        return service.create_booking_payment(reservation_id=reservation_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Kaution (tenant-geschützt) -----------------------------------------------

@router.post("/deposit/{reservation_id}/hold")
def create_deposit_hold(
    reservation_id: str, service: PaymentsServiceDep, ctx: _billing
) -> dict:
    """Kaution vorautorisieren (manual-capture PaymentIntent)."""
    try:
        return service.create_deposit_hold(ctx, reservation_id=reservation_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/deposit/{payment_id}/capture")
def capture_deposit(
    payment_id: str,
    req: DepositCaptureRequest,
    service: PaymentsServiceDep,
    ctx: _billing,
) -> dict:
    """Kaution (teilweise) einziehen — bei Schaden."""
    try:
        return service.capture_deposit(ctx, payment_id, req.amount)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/deposit/{payment_id}/release")
def release_deposit(
    payment_id: str, service: PaymentsServiceDep, ctx: _billing
) -> dict:
    """Kaution freigeben (Vorautorisierung stornieren)."""
    try:
        return service.release_deposit(ctx, payment_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Refund (tenant-geschützt) ------------------------------------------------

@router.post("/{payment_id}/refund")
def refund_payment(
    payment_id: str,
    req: RefundRequest,
    service: PaymentsServiceDep,
    ctx: _billing,
) -> dict:
    """Zahlung (teilweise) erstatten."""
    try:
        return service.refund_payment(ctx, payment_id, req.amount)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Stripe Webhook (kein JWT — via Stripe-Signatur gesichert) ----------------

@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="stripe-signature"),
) -> dict[str, str]:
    """Empfängt Stripe-Webhook-Events (signaturgeprüft) und verarbeitet relevante
    Events: ``account.updated`` (KYC-Spiegel) + ``payment_intent.*`` /
    ``charge.refunded`` (Zahlstatus). Idempotent über die Event-ID."""
    import stripe  # noqa: PLC0415

    payload = await request.body()
    webhook_secret = get_settings().stripe_webhook_secret.get_secret_value()

    if not webhook_secret:
        log.warning("stripe_webhook_secret_not_configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe Webhook Secret nicht konfiguriert.",
        )
    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fehlender Stripe-Signature Header.",
        )

    try:
        event = stripe.Webhook.construct_event(
            payload=payload, sig_header=stripe_signature, secret=webhook_secret
        )
    except stripe.SignatureVerificationError as exc:
        log.warning("stripe_webhook_invalid_signature", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültige Stripe-Signatur.",
        ) from exc

    db = get_service_client()
    handle_stripe_event(db, event, now_iso=datetime.now(UTC).isoformat())
    return {"received": "ok"}
