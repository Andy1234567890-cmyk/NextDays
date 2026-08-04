"""Kontoweites Channex-Anfrage-Budget (Phase 1b der Skalierung).

Der Worker (src/worker.py) verbraucht VOR jedem Channex-Push ein Token aus einem
Redis-Token-Bucket. Grund: EIN Channex-API-Key fürs ganze Konto → alle Betriebe
teilen sich Channex' Rate-Limit. Bei vielen gleichzeitig sync'enden Betrieben
würde der Worker Channex sonst überfahren (429/Sperre über das ganze Konto).

Zwei Ebenen, beide müssen ein Token hergeben:
  - ``channex:account``           — kontoweit (alle Betriebe zusammen)
  - ``channex:prop:{channex_id}`` — je Channex-Property (Fairness zwischen Objekten)

Und ZWEI Topf-Sorten, weil Channex ARI getrennt zählt (Acceptable Use Policy,
vertraglich verbindlich): je Property 10 Availability/Minute UND 10
Restrictions&Preise/Minute, kontoweit 20 ARI/Minute. Ein gemeinsamer Topf mit
20 je Property würde die Grenze verletzen, sobald alle 20 Calls dieselbe Sorte
sind. Deshalb wählt ``kind`` die Schlüssel und die Limits:
  - ``"availability"`` → ``channex:ari:account`` + ``channex:avail:{id}``
  - ``"rates"``        → ``channex:ari:account`` + ``channex:rates:{id}``
  - ``"other"``        → ``channex:account``     + ``channex:prop:{id}``
Beide ARI-Sorten teilen sich absichtlich DENSELBEN Konto-Topf — kontoweit gilt
die Summe (20), nicht 20 je Sorte.

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
from src.core.ratelimit import Limit, parse_limit

log = get_logger("nextdays.channex.budget")

# Atomarer Zwei-Ebenen-Verbrauch (Account + optional Property): ALL-OR-NOTHING.
# Zuerst BEIDE Zähler nur LESEN; nur wenn beide Ebenen noch Platz haben, BEIDE
# per INCR verbrauchen. So wird nie ein Account-Token verbrannt, wenn die
# Property-Ebene ablehnt (sonst leerte ein einzelnes überlastetes Objekt über
# seine Retries das kontoweite Budget aller anderen Objekte).
# Rückgabe: {allowed(0|1), account_ttl, prop_ttl}. Bei Ablehnung trägt NUR die
# tatsächlich BLOCKIERENDE Ebene ihre echte TTL; die nicht-blockierende Ebene
# gibt -2 zurück (= „nicht relevant"). So kann der Aufrufer retry_after aus der
# richtigen Ebene bestimmen (früher nahm min() fälschlich die kürzere Property-
# TTL, auch wenn nur das Account-Budget voll war → vorzeitiges Aufwachen +
# Re-Defer-Churn). KEYS[1]=account, KEYS[2]=prop(optional). ARGV: 1=acc_max
# 2=acc_window 3=prop_max 4=prop_window 5=has_prop(0|1).
_TWO_LEVEL_LUA = """
local has_prop = tonumber(ARGV[5])
local acc = tonumber(redis.call('GET', KEYS[1]) or '0')
local prop = 0
if has_prop == 1 then
  prop = tonumber(redis.call('GET', KEYS[2]) or '0')
end
-- Würde das Verbrauchen eine Ebene über ihr Maximum heben? Dann ablehnen,
-- OHNE zu inkrementieren — und NUR die blockierende Ebene mit echter TTL melden.
if acc + 1 > tonumber(ARGV[1]) then
  return {0, redis.call('TTL', KEYS[1]), -2}
end
if has_prop == 1 and prop + 1 > tonumber(ARGV[3]) then
  return {0, -2, redis.call('TTL', KEYS[2])}
end
-- Beide Ebenen haben Platz → beide atomar verbrauchen.
local acc_new = redis.call('INCR', KEYS[1])
if acc_new == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
if has_prop == 1 then
  local prop_new = redis.call('INCR', KEYS[2])
  if prop_new == 1 then redis.call('EXPIRE', KEYS[2], ARGV[4]) end
end
return {1, redis.call('TTL', KEYS[1]),
        has_prop == 1 and redis.call('TTL', KEYS[2]) or -2}
"""


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
        self._ari_account: Limit = parse_limit(settings.channex_ari_account_budget)
        self._availability: Limit = parse_limit(settings.channex_availability_budget)
        self._rates: Limit = parse_limit(settings.channex_rates_budget)
        self._redis = client or _build_sync_redis(settings.redis_url)

    def _toepfe(self, kind: str) -> tuple[str, Limit, str, Limit]:
        """Konto-Schlüssel/-Limit und Property-Präfix/-Limit für diese Sorte.

        Unbekannte Sorte fällt auf den ARI-Rates-Topf, NICHT auf den weiten
        "other"-Topf: eine neue ARI-Sorte, die hier vergessen wird, läuft dann
        in das strenge Limit statt Channex' Grenze zu reißen (fail-closed,
        Wurzel 5).
        """
        if kind == "other":
            return ("rl:channex:account", self._account,
                    "rl:channex:prop", self._property)
        if kind == "availability":
            return ("rl:channex:ari:account", self._ari_account,
                    "rl:channex:avail", self._availability)
        return ("rl:channex:ari:account", self._ari_account,
                "rl:channex:rates", self._rates)

    def try_consume(
        self, channex_property_id: str | None, kind: str = "other"
    ) -> BudgetDecision:
        """Ein Token je Ebene verbrauchen — ATOMAR all-or-nothing. Erlaubt nur,
        wenn BEIDE hergeben; lehnt die Property-Ebene ab, wird KEIN Account-Token
        verbraucht (kein Leck über abgelehnte, retryte Jobs).

        channex_property_id=None → nur die Konto-Ebene (globaler/objektloser Push).
        kind wählt den Topf ("availability"/"rates"/"other", siehe Modul-Kopf).
        Bei Redis-Fehler: NICHT erlaubt (Push verzögern statt Channex überfahren).
        """
        acc_key, acc_limit, prop_praefix, prop_limit = self._toepfe(kind)
        has_prop = 1 if channex_property_id else 0
        keys = [acc_key]
        keys.append(
            f"{prop_praefix}:{channex_property_id}" if channex_property_id
            else f"{prop_praefix}:_none"  # ungenutzt (has_prop=0), nur Platzhalter
        )
        try:
            allowed, acc_ttl, prop_ttl = self._redis.eval(
                _TWO_LEVEL_LUA, 2, keys[0], keys[1],
                acc_limit.max, acc_limit.window_seconds,
                prop_limit.max, prop_limit.window_seconds,
                has_prop,
            )
        except (redis.RedisError, OSError) as exc:
            log.warning("channex_budget_redis_unavailable", error=type(exc).__name__)
            return BudgetDecision(
                allowed=False, retry_after=acc_limit.window_seconds
            )
        if int(allowed) == 1:
            return BudgetDecision(allowed=True, retry_after=0)
        # Abgelehnt: NUR die tatsächlich blockierende Ebene meldet ihre echte TTL
        # (die andere gibt -2). Aus der blockierenden Ebene die Wartezeit ableiten,
        # sonst wacht der Job zu früh auf (wenn nur Account voll ist, aber die
        # kürzere Property-TTL genommen würde) → Re-Defer-Churn.
        acc_ttl, prop_ttl = int(acc_ttl), int(prop_ttl)
        if acc_ttl >= 0:
            return BudgetDecision(
                allowed=False, retry_after=_retry(acc_ttl, acc_limit)
            )
        if prop_ttl >= 0:
            return BudgetDecision(
                allowed=False, retry_after=_retry(prop_ttl, prop_limit)
            )
        # Beide -2 (sollte nicht vorkommen) → konservativ das Account-Fenster.
        return BudgetDecision(
            allowed=False, retry_after=acc_limit.window_seconds
        )


def _retry(ttl: int, limit: Limit) -> int:
    # ttl>0: exakt bis das Fenster frei wird. ttl==0: der Schlüssel läuft in <1 s
    # ab (Redis-TTL rundet auf ganze Sekunden ab) → ~1 s warten, NICHT das volle
    # Fenster (sonst schläft der Job unnötig eine ganze Minute). ttl<0 (kein
    # Schlüssel/TTL unbekannt) → konservativ das volle Fenster.
    if ttl > 0:
        return ttl
    if ttl == 0:
        return 1
    return limit.window_seconds


def _build_sync_redis(redis_url: str) -> redis.Redis:
    """Synchroner Redis-Client fürs Worker-Budget. Kurze Timeouts, damit ein
    hängendes Redis den Worker nicht blockiert."""
    return redis.from_url(
        redis_url,
        socket_connect_timeout=0.25,
        socket_timeout=0.25,
        decode_responses=True,
    )
