"""Provider-Auswahl per Env (MARKET_DATA_PROVIDER).

unset / "null"  → NullProvider (kein externes Signal, Markt-Faktor neutral).
"airdna"        → AirDnaProvider, ABER nur wenn airdna_api_key gesetzt ist;
                  ohne Key fällt es bewusst auf NullProvider zurück (kein
                  halb-aktiver Provider, der ins Leere läuft).
"""
from __future__ import annotations

from src.core.config import get_settings
from src.core.logging import get_logger

from .base import MarketSignalProvider, NullProvider

log = get_logger("nextdays.pricing.market")


def get_market_provider() -> MarketSignalProvider:
    settings = get_settings()
    choice = (settings.market_data_provider or "").strip().lower()
    if choice == "airdna":
        key = settings.airdna_api_key.get_secret_value()
        if not key:
            log.warning("market_provider_airdna_without_key_fallback_null")
            return NullProvider()
        from .airdna import AirDnaProvider

        return AirDnaProvider(api_key=key, base_url=settings.airdna_base_url)
    return NullProvider()
