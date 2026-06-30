"""Redis-basiertes Rate-Limiting (Infra-Runbook Punkt 8).

Schlanker, eigener Limiter statt einer unmaintained Drittbibliothek: ein atomares
Redis-Lua-Skript implementiert ein **Fixed-Window-Counter** je Schlüssel
(IP/Tenant × Bucket). Atomar = kein Race zwischen den 2 Uvicorn-Workern; der
Zustand liegt in Redis, also zählen beide Worker auf denselben Zähler.

Warum kein In-Memory-Limiter: bei ``UVICORN_WORKERS=2`` zählt jeder Worker eigen
→ effektives Limit verdoppelt sich und ist nicht vorhersehbar. Redis ist die
gemeinsame Wahrheit.

Resilienz: Redis nicht erreichbar → :func:`RateLimiter.check` meldet das über
``RateDecision.degraded``; die Middleware entscheidet dann fail-open/closed.
"""
from __future__ import annotations

from dataclasses import dataclass

import redis.asyncio as aioredis

from .logging import get_logger

log = get_logger("nextdays.ratelimit")

# Atomares Fixed-Window: INCR + (beim ersten Treffer) EXPIRE. Gibt den aktuellen
# Zählerstand und die Rest-TTL zurück. Ein einziger Redis-Roundtrip, race-frei.
_WINDOW_LUA = """
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
"""


@dataclass(frozen=True)
class Limit:
    """Ein geparstes Limit ``max`` Anfragen pro ``window_seconds``."""

    max: int
    window_seconds: int


def parse_limit(spec: str) -> Limit:
    """``"300/60"`` → ``Limit(300, 60)``. Wirft bei ungültiger Angabe (kein
    stiller Default — Fehlkonfiguration soll laut auffallen)."""
    try:
        max_str, window_str = spec.split("/", 1)
        limit = Limit(int(max_str), int(window_str))
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"Ungültige Rate-Limit-Angabe: {spec!r}") from exc
    if limit.max <= 0 or limit.window_seconds <= 0:
        raise ValueError(f"Rate-Limit muss positiv sein: {spec!r}")
    return limit


@dataclass(frozen=True)
class RateDecision:
    """Ergebnis einer Limit-Prüfung."""

    allowed: bool
    limit: Limit
    remaining: int
    retry_after: int
    degraded: bool = False  # True, wenn Redis nicht erreichbar war


def client_ip_from_xff(
    forwarded_for: str | None, peer_ip: str | None, trusted_hops: int
) -> str | None:
    """Echte Client-IP hinter vertrauenswürdigen Proxys (Traefik/Coolify).

    ``X-Forwarded-For`` ist eine von links (Client) nach rechts (letzter Proxy)
    gewachsene Liste. Wir vertrauen ``trusted_hops`` Proxys von RECHTS und nehmen
    das nächste Element links davon als echte Client-IP. Das erste Element blind
    zu nehmen wäre spoofbar (Angreifer setzt den Header selbst).
    """
    if not forwarded_for:
        return peer_ip
    parts = [p.strip() for p in forwarded_for.split(",") if p.strip()]
    if not parts:
        return peer_ip
    # Weniger Einträge als erwartete Proxy-Hops → Kette kürzer als gedacht; dann
    # das am weitesten links stehende (ursprünglichste) Element nehmen.
    idx = max(len(parts) - 1 - trusted_hops, 0)
    return parts[idx]


class RateLimiter:
    """Redis-gestützter Fixed-Window-Limiter. Eine Instanz pro App (in app.state)."""

    def __init__(self, redis_client: aioredis.Redis) -> None:
        self._redis = redis_client

    async def aclose(self) -> None:
        """Redis-Verbindung schließen (Shutdown)."""
        await self._redis.aclose()

    async def check(self, key: str, limit: Limit) -> RateDecision:
        """Verbucht eine Anfrage unter ``key`` und entscheidet, ob sie erlaubt ist.

        Bei Redis-Fehler: ``degraded=True``, ``allowed=True`` (die Middleware
        wertet ``degraded`` aus und entscheidet fail-open/closed je Endpunkt).
        """
        redis_key = f"rl:{key}"
        try:
            current, ttl = await self._redis.eval(
                _WINDOW_LUA, 1, redis_key, limit.window_seconds
            )
        except (aioredis.RedisError, OSError) as exc:
            log.warning("rate_limit_redis_unavailable", error=type(exc).__name__)
            return RateDecision(
                allowed=True,
                limit=limit,
                remaining=limit.max,
                retry_after=0,
                degraded=True,
            )
        retry_after = ttl if ttl and ttl > 0 else limit.window_seconds
        if current > limit.max:
            return RateDecision(
                allowed=False,
                limit=limit,
                remaining=0,
                retry_after=retry_after,
            )
        return RateDecision(
            allowed=True,
            limit=limit,
            remaining=max(0, limit.max - current),
            retry_after=retry_after,
        )


def build_redis(redis_url: str) -> aioredis.Redis:
    """Async-Redis-Client für den Limiter. Kurze Timeouts, damit ein hängendes
    Redis den Request-Pfad nicht blockiert (Backpressure-Geist)."""
    return aioredis.from_url(
        redis_url,
        socket_connect_timeout=0.25,
        socket_timeout=0.25,
        decode_responses=True,
    )
