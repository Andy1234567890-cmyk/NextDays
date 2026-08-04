"""Tests für das Channex-Budget (all-or-nothing Zwei-Ebenen-Token-Bucket).

Kernregel des Fixes: lehnt die PROPERTY-Ebene ab, darf KEIN Account-Token
verbraucht werden — sonst leert ein einzelnes überlastetes Objekt über seine
Retries das kontoweite Budget aller anderen Objekte.

Der Fake führt genau die Semantik des Lua-Skripts aus (GET/peek → nur bei Platz
auf BEIDEN Ebenen INCR beider Zähler), damit der Test die Atomarität prüft, ohne
echtes Redis/Lua.
"""
from __future__ import annotations

from unittest.mock import MagicMock

from src.jobs.channex_budget import ChannexBudget


class _FakeRedis:
    """Führt _TWO_LEVEL_LUA-Semantik nach: all-or-nothing über beide Zähler."""

    def __init__(self, acc_ttl: int = 55, prop_ttl: int = 9) -> None:
        self.store: dict[str, int] = {}
        self.acc_ttl = acc_ttl
        self.prop_ttl = prop_ttl

    def eval(self, _script: str, numkeys: int, *args: object) -> list[int]:
        acc_key = str(args[0])
        prop_key = str(args[1])
        acc_max = int(args[2])  # type: ignore[arg-type]
        prop_max = int(args[4])  # type: ignore[arg-type]
        has_prop = int(args[6])  # type: ignore[arg-type]

        acc = self.store.get(acc_key, 0)
        prop = self.store.get(prop_key, 0)
        # Peek: würde Verbrauch eine Ebene übersteigen? → ablehnen, NICHT zählen.
        # NUR die blockierende Ebene meldet ihre TTL, die andere -2 (wie das Lua).
        if acc + 1 > acc_max:
            return [0, self.acc_ttl, -2]
        if has_prop == 1 and prop + 1 > prop_max:
            return [0, -2, self.prop_ttl]
        # Beide Ebenen haben Platz → beide verbrauchen.
        self.store[acc_key] = acc + 1
        if has_prop == 1:
            self.store[prop_key] = prop + 1
        return [1, self.acc_ttl, self.prop_ttl if has_prop else -2]


def _settings(
    account: str = "5/60",
    prop: str = "2/60",
    *,
    ari_account: str = "20/60",
    availability: str = "10/60",
    rates: str = "10/60",
) -> MagicMock:
    settings = MagicMock()
    settings.channex_account_budget = account
    settings.channex_property_budget = prop
    settings.channex_ari_account_budget = ari_account
    settings.channex_availability_budget = availability
    settings.channex_rates_budget = rates
    return settings


def _budget(account: str = "5/60", prop: str = "2/60") -> tuple[ChannexBudget, _FakeRedis]:
    fake = _FakeRedis()
    return ChannexBudget(_settings(account, prop), client=fake), fake


def test_allows_until_property_limit() -> None:
    budget, _ = _budget(account="5/60", prop="2/60")
    assert budget.try_consume("p1").allowed is True
    assert budget.try_consume("p1").allowed is True
    # 3. Push für p1 überschreitet das Property-Limit (2/60).
    assert budget.try_consume("p1").allowed is False


def test_property_rejection_does_not_consume_account_token() -> None:
    # DAS ist der Fix: p1 sättigt sein 2/60-Property-Budget. Weitere abgelehnte
    # p1-Pushes dürfen das Account-Budget (5/60) NICHT anknabbern.
    budget, fake = _budget(account="5/60", prop="2/60")
    budget.try_consume("p1")  # acc=1, p1=1
    budget.try_consume("p1")  # acc=2, p1=2
    for _ in range(10):
        assert budget.try_consume("p1").allowed is False  # jeweils ohne acc-INCR
    # Account-Zähler blieb bei 2 → andere Objekte haben weiter Restbudget.
    assert fake.store["rl:channex:account"] == 2
    # Drei weitere Objekte (je unter ihrem 2/60-Property-Budget) füllen das
    # verbleibende Account-Budget (5 - 2 = 3) auf.
    assert budget.try_consume("p2").allowed is True   # acc=3
    assert budget.try_consume("p3").allowed is True   # acc=4
    assert budget.try_consume("p4").allowed is True   # acc=5
    assert budget.try_consume("p5").allowed is False  # Account erschöpft


def test_account_limit_blocks_all() -> None:
    budget, _ = _budget(account="2/60", prop="10/60")
    assert budget.try_consume("p1").allowed is True
    assert budget.try_consume("p2").allowed is True
    # Account (2/60) erschöpft → auch ein frisches Objekt wird abgelehnt.
    assert budget.try_consume("p3").allowed is False


def test_redis_error_denies() -> None:
    import redis

    budget, fake = _budget()
    fake.eval = MagicMock(side_effect=redis.RedisError("down"))  # type: ignore[method-assign]
    decision = budget.try_consume("p1")
    assert decision.allowed is False
    assert decision.retry_after > 0


def test_retry_after_uses_blocking_level_only() -> None:
    # Fix: nur das Account-Budget ist voll (acc_ttl=55), die Property-Ebene hat
    # noch Platz. retry_after MUSS die Account-TTL sein, nicht die kürzere
    # (nicht-blockierende) Property-TTL — sonst wacht der Job zu früh auf.
    fake = _FakeRedis(acc_ttl=55, prop_ttl=9)
    # 1/60 kontoweit = sofort voll nach 1 Push, 20/60 je Property = viel Platz.
    budget = ChannexBudget(_settings("1/60", "20/60"), client=fake)
    budget.try_consume("p1")  # acc=1 (voll)
    decision = budget.try_consume("p2")  # Account blockiert, Property frei
    assert decision.allowed is False
    assert decision.retry_after == 55  # Account-TTL, NICHT prop_ttl=9


def test_retry_after_property_block_uses_property_ttl() -> None:
    fake = _FakeRedis(acc_ttl=55, prop_ttl=9)
    budget = ChannexBudget(_settings("100/60", "1/60"), client=fake)
    budget.try_consume("p1")  # p1=1 (Property voll)
    decision = budget.try_consume("p1")  # Property blockiert
    assert decision.allowed is False
    assert decision.retry_after == 9  # Property-TTL


def test_ari_toepfe_sind_getrennt_und_teilen_das_konto() -> None:
    """Channex' Grenzen: je Property 10 Availability UND 10 Rates, kontoweit 20
    ARI zusammen. Der Availability-Topf darf den Rates-Topf nicht auffressen —
    aber der KONTO-Topf ist für beide derselbe."""
    fake = _FakeRedis()
    budget = ChannexBudget(
        _settings(ari_account="3/60", availability="2/60", rates="2/60"),
        client=fake,
    )
    assert budget.try_consume("p1", "availability").allowed is True
    assert budget.try_consume("p1", "availability").allowed is True
    # 3. Availability-Push überschreitet den eigenen Topf (2/60) …
    assert budget.try_consume("p1", "availability").allowed is False
    # … der Rates-Topf desselben Objekts ist davon unberührt.
    assert budget.try_consume("p1", "rates").allowed is True
    # Kontoweit (3/60) sind damit alle ARI-Token weg — auch für ein anderes Objekt.
    assert budget.try_consume("p2", "rates").allowed is False
    # Der "other"-Topf (Content-Sync) hat sein eigenes Konto-Budget.
    assert budget.try_consume("p2", "other").allowed is True
    assert fake.store["rl:channex:ari:account"] == 3
    assert fake.store["rl:channex:avail:p1"] == 2
    assert fake.store["rl:channex:rates:p1"] == 1


def test_unbekannte_sorte_faellt_in_den_engen_ari_topf() -> None:
    """Fail-closed: eine hier vergessene ARI-Sorte darf nicht im weiten
    "other"-Topf landen und Channex' ARI-Grenze reißen."""
    fake = _FakeRedis()
    budget = ChannexBudget(
        _settings(account="99/60", prop="99/60", ari_account="1/60", rates="1/60"),
        client=fake,
    )
    assert budget.try_consume("p1", "was_neues").allowed is True
    assert budget.try_consume("p1", "was_neues").allowed is False
    assert fake.store["rl:channex:ari:account"] == 1
