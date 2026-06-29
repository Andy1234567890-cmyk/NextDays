"""Stripe Connect Client — initialisiert den StripeClient einmalig mit dem
Secret Key aus der Config. Alle payments/connect-Features nutzen diese Instanz.
"""
from __future__ import annotations

from functools import lru_cache

try:
    from stripe import StripeClient
except ImportError as exc:
    raise ImportError(
        "stripe-Paket fehlt. Bitte: pip install stripe"
    ) from exc

from src.core.config import get_settings


@lru_cache(maxsize=1)
def get_stripe() -> StripeClient:
    """Gibt einen konfigurierten StripeClient zurück (einmaliges Init via lru_cache)."""
    secret = get_settings().stripe_secret_key.get_secret_value()
    return StripeClient(
        secret,
        max_network_retries=2,  # automatische Retries bei Netzwerkfehlern
    )
