"""Zahlungs-Gateway-Adapter: **Stripe primär**, Revolut sekundär (Option).

Einheitliches Interface, austauschbare Adapter — analog zum channel_manager.
Stripe ist gesetzt und an ``stripe_client`` angebunden; Revolut bleibt ein
NotImplemented-Adapter (spätere Option). (Reihenfolge gegenüber ADR-0003
gedreht — Stripe ist der produktive Gateway.)
"""
from abc import ABC, abstractmethod

from . import stripe_client as sc
from .schemas import ChargeRequest, ChargeResult, PaymentGateway


def _to_cents(amount: float) -> int:
    return int(round(amount * 100))


class PaymentGatewayAdapter(ABC):
    """Vertrag, den jedes Gateway erfüllen muss."""

    gateway: PaymentGateway

    @abstractmethod
    def charge(self, req: ChargeRequest, *, destination_acct: str) -> ChargeResult:
        """Belastung/Anzahlung anstoßen, gibt gateway_ref + Status zurück."""
        raise NotImplementedError

    @abstractmethod
    def refund(self, gateway_ref: str, amount: float | None = None) -> ChargeResult:
        """Rückerstattung zu einer bestehenden Zahlung."""
        raise NotImplementedError


class RevolutAdapter(PaymentGatewayAdapter):
    gateway = PaymentGateway.revolut

    def charge(self, req: ChargeRequest, *, destination_acct: str) -> ChargeResult:
        raise NotImplementedError("Revolut-Integration folgt (spätere Option).")

    def refund(self, gateway_ref: str, amount: float | None = None) -> ChargeResult:
        raise NotImplementedError("Revolut-Integration folgt (spätere Option).")


class StripeAdapter(PaymentGatewayAdapter):
    """Produktiver Adapter — delegiert an ``stripe_client`` (Destination Charge)."""

    gateway = PaymentGateway.stripe

    def charge(self, req: ChargeRequest, *, destination_acct: str) -> ChargeResult:
        capture = "manual" if req.type.value == "deposit" else "automatic"
        intent = sc.create_payment_intent(
            amount_cents=_to_cents(req.amount),
            currency=req.currency,
            destination_acct=destination_acct,
            application_fee_cents=0,
            capture_method=capture,
            metadata={"reservation_id": req.reservation_id},
        )
        return ChargeResult(
            gateway=self.gateway,
            gateway_ref=intent["id"],
            status=intent["status"],
        )

    def refund(self, gateway_ref: str, amount: float | None = None) -> ChargeResult:
        result = sc.refund(gateway_ref, _to_cents(amount) if amount is not None else None)
        return ChargeResult(
            gateway=self.gateway,
            gateway_ref=result["id"],
            status=result["status"],
        )


def get_adapter(gateway: PaymentGateway = PaymentGateway.stripe) -> PaymentGatewayAdapter:
    """Factory: liefert den Adapter zum gewählten Gateway (Default Stripe)."""
    match gateway:
        case PaymentGateway.revolut:
            return RevolutAdapter()
        case PaymentGateway.stripe:
            return StripeAdapter()
