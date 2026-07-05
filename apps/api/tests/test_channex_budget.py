"""Tests fürs Channex-Token-Budget (src/jobs/channex_budget.py).

Fake-Redis, der die eval(_WINDOW_LUA)-Semantik nachbildet (INCR + TTL). Prüft die
echte Zähl-/Ablehn-Logik der beiden Ebenen — nicht ein Schein-Verhalten.
"""
from __future__ import annotations

import redis
from src.core.config import Settings
from src.jobs.channex_budget import ChannexBudget


class _FakeRedis:
    """Bildet nur das eine genutzte eval(_WINDOW_LUA, 1, key, window) nach:
    INCR je key, TTL = window (konstant für den Test). Optional wirft es."""

    def __init__(self, *, fail: bool = False) -> None:
        self._counts: dict[str, int] = {}
        self._fail = fail

    def eval(self, _script, _nkeys, key, window):  # noqa: ANN001, ANN201
        if self._fail:
            raise redis.RedisError("down")
        self._counts[key] = self._counts.get(key, 0) + 1
        return [self._counts[key], int(window)]


def _budget(fake: _FakeRedis, *, account: str = "3/60", prop: str = "2/60") -> ChannexBudget:
    settings = Settings(channex_account_budget=account, channex_property_budget=prop)
    return ChannexBudget(settings, client=fake)


def test_allows_until_account_limit() -> None:
    b = _budget(_FakeRedis(), account="3/60", prop="99/60")
    # 3 erlaubt, der 4. reißt das Konto-Limit.
    assert b.try_consume("p1").allowed
    assert b.try_consume("p2").allowed
    assert b.try_consume("p3").allowed
    d = b.try_consume("p4")
    assert not d.allowed
    assert d.retry_after == 60


def test_per_property_limit_independent() -> None:
    # Konto großzügig, aber je Property nur 2 → drittes Property-Token wird abgelehnt.
    b = _budget(_FakeRedis(), account="99/60", prop="2/60")
    assert b.try_consume("p1").allowed
    assert b.try_consume("p1").allowed
    assert not b.try_consume("p1").allowed  # p1 erschöpft
    assert b.try_consume("p2").allowed       # p2 hat eigenes Budget


def test_no_property_id_only_account_level() -> None:
    b = _budget(_FakeRedis(), account="2/60", prop="1/60")
    # Ohne property_id greift nur die Konto-Ebene (prop-Limit 1 wird NICHT geprüft).
    assert b.try_consume(None).allowed
    assert b.try_consume(None).allowed
    assert not b.try_consume(None).allowed  # Konto (2) erschöpft


def test_redis_down_denies_not_allows() -> None:
    # KEIN Fallback auf „unbegrenzt": Redis weg → Push verweigern (Job wartet).
    b = _budget(_FakeRedis(fail=True))
    d = b.try_consume("p1")
    assert not d.allowed
    assert d.retry_after > 0
