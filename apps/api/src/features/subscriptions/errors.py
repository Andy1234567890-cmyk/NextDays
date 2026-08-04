"""Fehlertyp der subscriptions-Domäne.

Eigene Datei, damit `service.py` und die ausgelagerten Abrechnungs-Mixins
(z. B. `dynpricing.py`) sie importieren können, ohne dass ein Zirkelbezug
entsteht — das Mixin wird von `service.py` importiert und kann deshalb nicht
selbst aus `service.py` importieren.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def field(obj: Any, key: str, default: Any = None) -> Any:  # noqa: ANN401
    """Feldzugriff robust für Stripe-``StripeObject`` (KEIN ``.get()``) UND Dict.
    StripeObject erlaubt Item-Zugriff, wirft aber bei fehlendem Key — daher
    try/except auf den Default (analog payments/webhook._field).

    Liegt neben dem Fehlertyp, weil service.py UND die Abrechnungs-Mixins ihn
    brauchen — eine Quelle statt einer zweiten Kopie (Wurzel 4).
    """
    if isinstance(obj, Mapping):
        return obj.get(key, default)
    try:
        return obj[key]
    except (KeyError, AttributeError, TypeError):
        return default


class SubscriptionsError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
