"""Stripe-Client — initialisiert den StripeClient einmalig mit dem Secret Key
aus der Config. Alle payments-Features (Connect, PaymentIntents, Refunds) nutzen
diese Instanz.

Dünne Wrapper kapseln die PaymentIntent-/Refund-Aufrufe, damit der Service
gateway-agnostisch gegen ein schmales Interface arbeitet und Tests den Client
leicht faken können (StripeClient wird injiziert/gepatcht).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

try:
    from stripe import StripeClient
except ImportError as exc:
    raise ImportError(
        "stripe-Paket fehlt. Bitte: pip install stripe"
    ) from exc

from src.core.config import get_settings


class StripeNotConfiguredError(RuntimeError):
    """Stripe-Secret-Key ist nicht gesetzt (in Coolify/Env zu konfigurieren).

    Wird beim ersten Stripe-Zugriff geworfen, statt mit leerem Key einen
    kryptischen Stripe-Auth-Fehler zu erzeugen — so ist die Ursache (fehlende
    Konfiguration) im Frontend klar sichtbar. Keine Fallbacks (Projektregel)."""


@lru_cache(maxsize=1)
def get_stripe() -> StripeClient:
    """Gibt einen konfigurierten StripeClient zurück (einmaliges Init via lru_cache).

    Fehlt der Secret Key, wird klar fehlgeschlagen — nicht mit leerem Key ein
    StripeClient gebaut, der später unverständlich scheitert."""
    secret = get_settings().stripe_secret_key.get_secret_value()
    if not secret:
        raise StripeNotConfiguredError(
            "Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt). "
            "Bitte in der Umgebung (Coolify) setzen."
        )
    return StripeClient(
        secret,
        max_network_retries=2,  # automatische Retries bei Netzwerkfehlern
    )


def create_payment_intent(
    *,
    amount_cents: int,
    currency: str,
    destination_acct: str,
    application_fee_cents: int,
    capture_method: str = "automatic",
    metadata: dict[str, str] | None = None,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Destination-Charge-PaymentIntent: Gast zahlt über den Plattform-Account,
    das Geld geht per transfer_data.destination an den Connected Account des
    Tenants. application_fee_cents = Plattform-Provision (0 = keine).

    capture_method='manual' für Kautionen (Vorautorisierung, späteres capture).
    """
    stripe = client or get_stripe()
    params: dict[str, Any] = {
        "amount": amount_cents,
        "currency": currency.lower(),
        "capture_method": capture_method,
        "on_behalf_of": destination_acct,
        "transfer_data": {"destination": destination_acct},
        # Payment Element (Karten + lokale Methoden), 3DS automatisch.
        "automatic_payment_methods": {"enabled": True},
    }
    if application_fee_cents > 0:
        params["application_fee_amount"] = application_fee_cents
    if metadata:
        params["metadata"] = metadata
    pi = stripe.v1.payment_intents.create(params=params)
    return {"id": pi.id, "client_secret": pi.client_secret, "status": pi.status}


def retrieve_payment_intent(
    intent_id: str,
    *,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Bestehenden PaymentIntent laden (für Idempotenz: einen offenen Intent
    einer Buchung wiederverwenden statt einen zweiten zu erzeugen)."""
    stripe = client or get_stripe()
    pi = stripe.v1.payment_intents.retrieve(intent_id)
    return {"id": pi.id, "client_secret": pi.client_secret, "status": pi.status}


def capture_payment_intent(
    intent_id: str,
    amount_cents: int | None = None,
    *,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Vorautorisierte Zahlung (Kaution) einziehen — voll oder Teilbetrag."""
    stripe = client or get_stripe()
    params: dict[str, Any] = {}
    if amount_cents is not None:
        params["amount_to_capture"] = amount_cents
    pi = stripe.v1.payment_intents.capture(intent_id, params=params)
    return {"id": pi.id, "status": pi.status}


def cancel_payment_intent(
    intent_id: str, *, client: StripeClient | None = None
) -> dict[str, Any]:
    """Vorautorisierung freigeben (Kaution zurückgeben) — kein Geldfluss."""
    stripe = client or get_stripe()
    pi = stripe.v1.payment_intents.cancel(intent_id)
    return {"id": pi.id, "status": pi.status}


def refund(
    payment_intent_id: str,
    amount_cents: int | None = None,
    *,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Rückerstattung zu einem PaymentIntent — voll oder Teilbetrag."""
    stripe = client or get_stripe()
    params: dict[str, Any] = {"payment_intent": payment_intent_id}
    if amount_cents is not None:
        params["amount"] = amount_cents
    ref = stripe.v1.refunds.create(params=params)
    return {"id": ref.id, "status": ref.status}
