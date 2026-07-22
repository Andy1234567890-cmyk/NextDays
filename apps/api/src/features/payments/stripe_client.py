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


def get_or_create_customer(
    *,
    email: str | None,
    metadata: dict[str, str] | None = None,
    client: StripeClient | None = None,
) -> str:
    """Stripe-Customer für einen Gast anlegen (für gespeicherte Karten / spätere
    off-session-Restzahlung). Ohne Customer speichert Stripe die PaymentMethod
    nicht dauerhaft. Wir legen pro Buchung/Gast einen Customer an (kein globales
    Gast-Konto) — simpel und ausreichend für Split-Payment."""
    stripe = client or get_stripe()
    params: dict[str, Any] = {}
    if email:
        params["email"] = email
    if metadata:
        params["metadata"] = metadata
    cust = stripe.v1.customers.create(params=params)
    return cust.id


def create_payment_intent(
    *,
    amount_cents: int,
    currency: str,
    destination_acct: str,
    application_fee_cents: int,
    capture_method: str = "automatic",
    metadata: dict[str, str] | None = None,
    customer: str | None = None,
    save_payment_method: bool = False,
    payment_method: str | None = None,
    off_session: bool = False,
    statement_descriptor: str | None = None,
    idempotency_key: str | None = None,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Destination-Charge-PaymentIntent: Gast zahlt über den Plattform-Account,
    das Geld geht per transfer_data.destination an den Connected Account des
    Tenants. application_fee_cents = Plattform-Provision (0 = keine).

    capture_method='manual' für Kautionen (Vorautorisierung, späteres capture).

    Split-Payment:
      * save_payment_method=True + customer → Karte wird für die spätere
        off-session-Restzahlung gespeichert (setup_future_usage='off_session').
      * off_session=True + payment_method + customer → sofortiger, vom Server
        ausgelöster Charge der gespeicherten Karte (Restzahlung). Verlangt
        confirm=True; Stripe kann 'authentication_required' werfen (3DS) → der
        Aufrufer holt den Gast dann on-session zurück (fail-closed, Wurzel 5).
    """
    stripe = client or get_stripe()
    params: dict[str, Any] = {
        "amount": amount_cents,
        "currency": currency.lower(),
        "capture_method": capture_method,
        "on_behalf_of": destination_acct,
        "transfer_data": {"destination": destination_acct},
    }
    if off_session:
        # Server-initiierter Charge der gespeicherten Karte (kein Payment Element).
        params["off_session"] = True
        params["confirm"] = True
        if payment_method:
            params["payment_method"] = payment_method
    else:
        # Gast zahlt interaktiv über das Payment Element (Karten + 3DS automatisch).
        params["automatic_payment_methods"] = {"enabled": True}
        if save_payment_method:
            params["setup_future_usage"] = "off_session"
    if customer:
        params["customer"] = customer
    if application_fee_cents > 0:
        params["application_fee_amount"] = application_fee_cents
    if statement_descriptor:
        # Name des Händlers auf der Kartenabrechnung des Gastes. Stripe erlaubt
        # max. 22 Zeichen und einige verbotene Zeichen (< > \ ' " *) — kappen und
        # säubern, sonst wirft der Charge (angreifer-/nutzergelieferter Text,
        # Wurzel 8). Leerer Rest → weglassen.
        clean = "".join(
            c for c in statement_descriptor if c not in "<>\\'\"*"
        ).strip()[:22]
        if clean:
            params["statement_descriptor"] = clean
    if metadata:
        params["metadata"] = metadata
    options = {"idempotency_key": idempotency_key} if idempotency_key else None
    pi = stripe.v1.payment_intents.create(params=params, options=options)
    return {
        "id": pi.id,
        "client_secret": pi.client_secret,
        "status": pi.status,
        # payment_method-ID nach Bestätigung (für die spätere Restzahlung merken).
        "payment_method": getattr(pi, "payment_method", None),
    }


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
    idempotency_key: str | None = None,
    refund_application_fee: bool = False,
) -> dict[str, Any]:
    """Rückerstattung zu einem PaymentIntent — voll oder Teilbetrag.

    Mit ``idempotency_key`` fängt Stripe selbst eine Doppel-Erstattung durch
    Doppelklick/Retry ab (Wurzel 2): identischer Key → identische Response, kein
    zweites Geldereignis. Der Aufrufer bildet den Key deterministisch aus
    payment_id + Betrag.

    ``refund_application_fee``: bei einem Destination-Charge mit application_fee
    (Marktplatz-Provision) gibt Stripe die Fee NUR zurück, wenn dieses Flag
    gesetzt ist. Bei einer anteiligen Erstattung (``amount_cents`` gesetzt) wird
    die Fee proportional zurückgegeben — Stripe rechnet den Anteil selbst aus.
    """
    stripe = client or get_stripe()
    params: dict[str, Any] = {"payment_intent": payment_intent_id}
    if amount_cents is not None:
        params["amount"] = amount_cents
    if refund_application_fee:
        params["refund_application_fee"] = True
    options = {"idempotency_key": idempotency_key} if idempotency_key else None
    ref = stripe.v1.refunds.create(params=params, options=options)
    return {"id": ref.id, "status": ref.status}
