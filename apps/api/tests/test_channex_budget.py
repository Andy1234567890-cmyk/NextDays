"""Tests fürs Channex-Token-Budget (src/jobs/channex_budget.py).

Fake-Redis, der die eval(_WINDOW_LUA)-Semantik nachbildet (INCR + TTL). Prüft die
echte Zähl-/Ablehn-Logik der beiden Ebenen — nicht ein Schein-Verhalten.
"""
from __future__ import annotations

import redis
from src.core.config import Settings
from src.jobs.channex_budget import ChannexBudget


class _FakeRedis:
    """Bildet die genutzte eval(_TWO_LEVEL_LUA, 2, acc_key, prop_key, acc_max,
    acc_win, prop_max, prop_win, has_prop) nach: prüft beide Ebenen all-or-nothing,
    inkrementiert nur bei Erfolg, meldet bei Ablehnung NUR die blockierende Ebene
    mit ihrer TTL (die andere -2). Optional wirft es (Redis-Ausfall)."""

    def __init__(self, *, fail: bool = False) -> None:
        self._counts: dict[str, int] = {}
        self._fail = fail

    def eval(  # noqa: ANN001, ANN201, PLR0913
        self, _script, _nkeys, acc_key, prop_key,
        acc_max, acc_win, prop_max, prop_win, has_prop,
    ):
        if self._fail:
            raise redis.RedisError("down")
        acc = self._counts.get(acc_key, 0)
        prop = self._counts.get(prop_key, 0) if int(has_prop) == 1 else 0
        # Ablehnen ohne Inkrement, wenn eine Ebene über ihr Max ginge.
        if acc + 1 > int(acc_max):
            return [0, int(acc_win), -2]
        if int(has_prop) == 1 and prop + 1 > int(prop_max):
            return [0, -2, int(prop_win)]
        self._counts[acc_key] = acc + 1
        if int(has_prop) == 1:
            self._counts[prop_key] = prop + 1
        return [1, int(acc_win), int(prop_win) if int(has_prop) == 1 else -2]


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
