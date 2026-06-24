"""Markt-/Wettbewerbs-Signal-Provider für Dynamic Pricing (Phase 2).

Pluggable: der Recompute-Service holt ein optionales Markt-Signal je Objekt über
einen Provider, der per Env (MARKET_DATA_PROVIDER) gewählt wird. Default ist der
NullProvider — kein externes Signal, der Markt-Faktor bleibt neutral (1.0), die
Engine verhält sich exakt wie Phase 1.
"""
from .base import MarketDay, MarketSignalProvider, NullProvider
from .factory import get_market_provider

__all__ = [
    "MarketDay",
    "MarketSignalProvider",
    "NullProvider",
    "get_market_provider",
]
