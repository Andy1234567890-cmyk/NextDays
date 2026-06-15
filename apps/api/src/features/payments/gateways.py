"""Zahlungs-Gateway-Adapter (ADR-0003): Revolut primär, Stripe sekundär.

Einheitliches Interface, austauschbare Adapter — analog zum channel_manager.
Die konkreten API-Aufrufe folgen in der Implementierungsphase; hier steht der
typisierte Vertrag, gegen den der payments-Service arbeitet.
"""
from abc import ABC, abstractmethod

from .schemas import ChargeRequest, ChargeResult, PaymentGateway


class PaymentGatewayAdapter(ABC):
    """Vertrag, den jedes Gateway erfüllen muss."""

    gateway: PaymentGateway

    @abstractmethod
    def charge(self, req: ChargeRequest) -> ChargeResult:
        """Belastung/Anzahlung anstoßen, gibt gateway_ref + Status zurück."""
        raise NotImplementedError

    @abstractmethod
    def refund(self, gateway_ref: str, amount: float) -> ChargeResult:
        """Rückerstattung zu einer bestehenden Zahlung."""
        raise NotImplementedError


class RevolutAdapter(PaymentGatewayAdapter):
    gateway = PaymentGateway.revolut

    def charge(self, req: ChargeRequest) -> ChargeResult:
        raise NotImplementedError("Revolut-Integration folgt (Roadmap-Block 8).")

    def refund(self, gateway_ref: str, amount: float) -> ChargeResult:
        raise NotImplementedError("Revolut-Integration folgt (Roadmap-Block 8).")


class StripeAdapter(PaymentGatewayAdapter):
    gateway = PaymentGateway.stripe

    def charge(self, req: ChargeRequest) -> ChargeResult:
        raise NotImplementedError("Stripe-Integration optional (Roadmap-Block 8).")

    def refund(self, gateway_ref: str, amount: float) -> ChargeResult:
        raise NotImplementedError("Stripe-Integration optional (Roadmap-Block 8).")


def get_adapter(gateway: PaymentGateway) -> PaymentGatewayAdapter:
    """Factory: liefert den Adapter zum gewählten Gateway (Default Revolut)."""
    match gateway:
        case PaymentGateway.revolut:
            return RevolutAdapter()
        case PaymentGateway.stripe:
            return StripeAdapter()
