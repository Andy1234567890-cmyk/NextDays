"""Kontoweites Channex-Anfrage-Budget (Phase 1b der Skalierung).

Der Worker (src/worker.py) verbraucht VOR jedem Channex-Push ein Token aus einem
Redis-Token-Bucket. Grund: EIN Channex-API-Key fürs ganze Konto → alle Betriebe
teilen sich Channex' Rate-Limit. Bei vielen gleichzeitig sync'enden Betrieben
würde der Worker Channex sonst überfahren (429/Sperre über das ganze Konto).

Zwei Ebenen, beide müssen ein Token hergeben:
  - ``channex:account``           — kontoweit (alle Betriebe zusammen)
  - ``channex:prop:{channex_id}`` — je Channex-Property (Fairness zwischen Objekten)

Synchron mit Absicht: der Worker ruft dies im Thread (asyncio.to_thread) direkt
vor dem blockierenden Channex-Call. Wir verwenden dasselbe atomare Lua-Fenster wie
der HTTP-Limiter (ratelimit._WINDOW_LUA) — kein zweiter Zähl-Algorithmus, nur ein
synchroner Redis-Client statt des async-Clients.

Kein Fallback auf „unbegrenzt": ist Redis nicht erreichbar, wird der Push NICHT
zugelassen (Budget-Verweigerung → Job bleibt queued und wird später erneut
versucht). Lieber verzögern als Channex überfahren.
"""
from __future__ import annotations

from dataclasses import dataclass

import redis

from src.core.config import Settings
from src.core.logging import get_logger
from src.core.ratelimit import _WINDOW_LUA as WINDOW_LUA
from src.core.ratelimit import Limit, parse_limit

log = get_logger("nextdays.channex.budget")


@dataclass(frozen=True)
class BudgetDecision:
    """Ergebnis der Token-Prüfung vor einem Channex-Call."""

    allowed: bool
    retry_after: int  # Sekunden bis frühestens ein Token frei wird (bei Ablehnung)


class ChannexBudget:
    """Synchroner Zwei-Ebenen-Token-Bucket vor Channex-Calls.

    Eine Instanz je Worker-Prozess (hält einen synchronen Redis-Client). Nicht
    thread-safe für parallele *Konfig*-Änderung, aber die eval-Calls selbst sind
    atomar in Redis — mehrere Worker-Threads/Instanzen zählen race-frei auf
    denselben Schlüssel.
    """

    def __init__(self, settings: Settings, client: redis.Redis | None = None) -> None:
        self._account: Limit = parse_limit(settings.channex_account_budget)
        self._property: Limit = parse_limit(settings.channex_property_budget)
        self._redis = client or _build_sync_redis(settings.redis_url)

    def try_consume(self, channex_property_id: str | None) -> BudgetDecision:
        """Ein Token je Ebene verbrauchen. Erlaubt nur, wenn BEIDE hergeben.

        channex_property_id=None → nur die Konto-Ebene (globaler/objektloser Push).
        Bei Redis-Fehler: NICHT erlaubt (Push verzögern statt Channex überfahren).
        """
        acc = self._hit("channex:account", self._account)
        if acc is None:  # Redis weg → Budget verweigern
            return BudgetDecision(allowed=False, retry_after=self._account.window_seconds)
        acc_current, acc_ttl = acc
        if acc_current > self._account.max:
            return BudgetDecision(allowed=False, retry_after=_retry(acc_ttl, self._account))

        if channex_property_id:
            prop = self._hit(f"channex:prop:{channex_property_id}", self._property)
            if prop is None:
                return BudgetDecision(
                    allowed=False, retry_after=self._property.window_seconds
                )
            prop_current, prop_ttl = prop
            if prop_current > self._property.max:
                return BudgetDecision(
                    allowed=False, retry_after=_retry(prop_ttl, self._property)
                )
        return BudgetDecision(allowed=True, retry_after=0)

    def _hit(self, key: str, limit: Limit) -> tuple[int, int] | None:
        """Atomarer INCR+EXPIRE. Gibt (current, ttl) zurück, None bei Redis-Fehler."""
        try:
            current, ttl = self._redis.eval(
                WINDOW_LUA, 1, f"rl:{key}", limit.window_seconds
            )
        except (redis.RedisError, OSError) as exc:
            log.warning("channex_budget_redis_unavailable", error=type(exc).__name__)
            return None
        return int(current), int(ttl)


def _retry(ttl: int, limit: Limit) -> int:
    return ttl if ttl and ttl > 0 else limit.window_seconds


def _build_sync_redis(redis_url: str) -> redis.Redis:
    """Synchroner Redis-Client fürs Worker-Budget. Kurze Timeouts, damit ein
    hängendes Redis den Worker nicht blockiert."""
    return redis.from_url(
        redis_url,
        socket_connect_timeout=0.25,
        socket_timeout=0.25,
        decode_responses=True,
    )
