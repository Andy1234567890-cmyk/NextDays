"""Router für payments. Gemountet unter /api/v1/payments."""
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_role
from src.features.auth.permissions import UserRole

from .schemas import (
    ConnectAccountCreate,
    ConnectAccountResponse,
    ConnectAccountStatus,
    SliceHealth,
)
from .service import PaymentsService
from .stripe_client import get_stripe

router = APIRouter(prefix="/payments", tags=["payments"])
_service = PaymentsService()
log = get_logger("nextdays.payments")


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return _service.health()


# --- Stripe Connect -----------------------------------------------------------

@router.post("/connect/accounts", response_model=ConnectAccountResponse)
def create_connect_account(
    req: ConnectAccountCreate,
    ctx: AuthContext = Depends(require_role(UserRole.admin)),
) -> ConnectAccountResponse:
    """Erstellt einen Stripe Custom Account für den Gastgeber und gibt den
    White-Label-Onboarding-Link zurück. Nur für Admins."""
    base = get_settings().cors_origins.split(",")[0].strip()
    return _service.create_connect_account(
        req,
        return_url=f"{base}/konto/zahlungen/onboarding/abgeschlossen",
        refresh_url=f"{base}/konto/zahlungen/onboarding/neu",
    )


@router.get("/connect/accounts/{stripe_account_id}", response_model=ConnectAccountStatus)
def get_connect_account_status(
    stripe_account_id: str,
    ctx: AuthContext = Depends(require_role(UserRole.admin)),
) -> ConnectAccountStatus:
    """Liefert KYC-/Aktivierungsstatus eines verbundenen Gastgeber-Accounts."""
    return _service.get_connect_account_status(stripe_account_id)


@router.post("/connect/accounts/{stripe_account_id}/onboarding-link")
def refresh_onboarding_link(
    stripe_account_id: str,
    ctx: AuthContext = Depends(require_role(UserRole.admin)),
) -> dict:
    """Generiert einen neuen Onboarding-Link (z. B. nach Ablauf des alten)."""
    base = get_settings().cors_origins.split(",")[0].strip()
    url = _service.create_onboarding_link(
        stripe_account_id,
        return_url=f"{base}/konto/zahlungen/onboarding/abgeschlossen",
        refresh_url=f"{base}/konto/zahlungen/onboarding/neu",
    )
    return {"onboarding_url": url}


# --- Stripe Webhook (kein JWT — via Stripe-Signatur gesichert) ----------------

@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="stripe-signature"),
) -> dict[str, str]:
    """Empfängt Stripe-Webhook-Events und verarbeitet relevante Events.

    Stripe signiert jeden Request mit HMAC-SHA256 (Stripe-Signature Header).
    Verifizierung via SDK — ungültige Signaturen → 400.
    Relevante Events:
      - account.updated: KYC-Status in tenant_billing_profile spiegeln.
    """
    import stripe  # noqa: PLC0415

    payload = await request.body()
    webhook_secret = get_settings().stripe_webhook_secret.get_secret_value()

    if not webhook_secret or webhook_secret == "changeme":
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

    # Signatur prüfen — schützt vor gefälschten Webhook-Requests.
    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=stripe_signature,
            secret=webhook_secret,
        )
    except stripe.SignatureVerificationError as exc:
        log.warning("stripe_webhook_invalid_signature", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültige Stripe-Signatur.",
        ) from exc

    event_type: str = event["type"]
    log.info("stripe_webhook_received", event_type=event_type, event_id=event["id"])

    # --- account.updated: KYC-Status in DB spiegeln -------------------------
    if event_type == "account.updated":
        account = event["data"]["object"]
        stripe_account_id: str = account.id
        charges_enabled: bool = bool(getattr(account, "charges_enabled", False))
        payouts_enabled: bool = bool(getattr(account, "payouts_enabled", False))
        details_submitted: bool = bool(getattr(account, "details_submitted", False))

        db = get_service_client()
        update: dict = {
            "stripe_charges_enabled": charges_enabled,
            "stripe_payouts_enabled": payouts_enabled,
            "stripe_details_submitted": details_submitted,
        }
        # Onboarding-Abschluss: erstmaliges details_submitted → Timestamp setzen.
        if details_submitted:
            update["stripe_onboarding_at"] = datetime.now(UTC).isoformat()

        result = (
            db.table("tenant_billing_profile")
            .update(update)
            .eq("stripe_account_id", stripe_account_id)
            .execute()
        )

        if result.data:
            log.info(
                "stripe_account_updated",
                stripe_account_id=stripe_account_id,
                charges_enabled=charges_enabled,
                payouts_enabled=payouts_enabled,
                details_submitted=details_submitted,
            )
        else:
            # Account noch nicht in der DB — kann bei Race Condition vorkommen
            # (Webhook kommt vor dem create_connect_account-Response).
            log.warning(
                "stripe_account_not_found_in_db",
                stripe_account_id=stripe_account_id,
            )

    return {"received": "ok"}
