"""Tests für die Dynamic-Pricing-Engine (reine Faktor-Funktionen, deterministisch)."""
from datetime import date

from src.features.pricing.engine import DaySignals, DpSettings, compute_day

_BASE = 100.0


def _settings(**kw: object) -> DpSettings:
    base = {
        "enabled": True,
        "min_price": 50.0,
        "max_price": 300.0,
        "weekend_uplift_pct": 20.0,
        "last_minute": [
            {"days_before": 7, "discount_pct": 10},
            {"days_before": 3, "discount_pct": 25},
        ],
        "orphan_gap_discount_pct": 15.0,
        "occupancy_sensitivity": 30.0,
        "min_stay_min": 1,
        "min_stay_max": 5,
    }
    base.update(kw)
    return DpSettings(**base)  # type: ignore[arg-type]


def test_neutral_when_no_signals() -> None:
    # Werktag (Mi 2026-07-01), keine Auslastung/Lead-Time/Saison → Basispreis.
    s = _settings(weekend_uplift_pct=0)
    r = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200))
    assert r.price == 100.0


def test_weekend_uplift() -> None:
    s = _settings()
    # 2026-07-04 = Samstag.
    r = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 4), days_before=200))
    assert r.price == 120.0  # +20 %
    # Mittwoch bleibt neutral.
    r2 = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200))
    assert r2.price == 100.0


def test_season_and_event_uplift() -> None:
    s = _settings(weekend_uplift_pct=0)
    r = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), season_pct=50, days_before=200)
    )
    assert r.price == 150.0
    r2 = compute_day(
        _BASE,
        s,
        DaySignals(day=date(2026, 7, 1), season_pct=50, event_pct=20, days_before=200),
    )
    assert r2.price == 180.0  # 100 * 1.5 * 1.2


def test_occupancy_factor_up_and_down() -> None:
    s = _settings(weekend_uplift_pct=0)
    hi = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=1.0, days_before=200)
    )
    assert hi.price == 130.0  # +sensitivity (30 %)
    lo = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=0.0, days_before=200)
    )
    assert lo.price == 70.0  # −30 %
    mid = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=0.5, days_before=200)
    )
    assert mid.price == 100.0  # Pivot = neutral


def test_last_minute_picks_tightest_rule() -> None:
    s = _settings(weekend_uplift_pct=0)
    # 2 Tage vorher → die 3-Tage-Regel (25 %) gewinnt über die 7-Tage-Regel.
    r = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 1), days_before=2))
    assert r.price == 75.0
    # 5 Tage vorher → nur die 7-Tage-Regel (10 %).
    r2 = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 1), days_before=5))
    assert r2.price == 90.0
    # 30 Tage vorher → keine Last-Minute-Regel.
    r3 = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 1), days_before=30))
    assert r3.price == 100.0


def test_orphan_gap_discount() -> None:
    s = _settings(weekend_uplift_pct=0)
    r = compute_day(
        _BASE,
        s,
        DaySignals(day=date(2026, 7, 1), days_before=200, is_orphan_gap=True),
    )
    assert r.price == 85.0  # −15 %


def test_clamp_min_and_max() -> None:
    s = _settings(min_price=80, max_price=150, weekend_uplift_pct=0)
    # Saison +200 % → 300, auf max 150 geklammert.
    hi = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), season_pct=200, days_before=200)
    )
    assert hi.price == 150.0
    # Last-Minute 25 % + occ 0 → 100*0.75*0.7 = 52.5, auf min 80 geklammert.
    lo = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=0.0, days_before=2)
    )
    assert lo.price == 80.0


def test_dynamic_min_stay_scales_with_occupancy() -> None:
    s = _settings(min_stay_min=2, min_stay_max=6)
    full = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=1.0, days_before=200)
    )
    assert full.min_stay == 6  # max bei Vollauslastung
    empty = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=0.0, days_before=200)
    )
    assert empty.min_stay == 2  # min bei leer
    none = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=None, days_before=200)
    )
    assert none.min_stay == 2  # ohne Signal = min


def test_deterministic() -> None:
    s = _settings()
    sig = DaySignals(day=date(2026, 7, 4), occupancy=0.7, days_before=5, season_pct=10)
    a = compute_day(_BASE, s, sig)
    b = compute_day(_BASE, s, sig)
    assert a.price == b.price and a.min_stay == b.min_stay


# --- Hostaway-Modell: Basispreis-Modus + Aggressivität ----------------------


def test_aggressiveness_scales_occupancy() -> None:
    """Konservativ dämpft, aggressiv verstärkt die Auslastungs-Abweichung."""
    sig = DaySignals(day=date(2026, 7, 1), occupancy=1.0, days_before=200)
    cons = compute_day(_BASE, _settings(weekend_uplift_pct=0, base_rate_mode="conservative"), sig)
    rec = compute_day(_BASE, _settings(weekend_uplift_pct=0, base_rate_mode="recommended"), sig)
    aggr = compute_day(_BASE, _settings(weekend_uplift_pct=0, base_rate_mode="aggressive"), sig)
    # recommended = +30 %, conservative = +15 % (×0,5), aggressive = +45 % (×1,5).
    assert rec.price == 130.0
    assert cons.price == 115.0
    assert aggr.price == 145.0


def test_manual_base_overrides_rate_plan() -> None:
    """base_mode='manual' nutzt manual_base_price als Anker statt des rate_plan-Werts."""
    s = _settings(weekend_uplift_pct=0, base_mode="manual", manual_base_price=200.0)
    # rate_plan-Basis 100 wird ignoriert; Anker = 200.
    r = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200))
    assert r.price == 200.0


def test_manual_base_ignored_without_value() -> None:
    """manual ohne gesetzten Preis fällt auf den rate_plan-Anker zurück (kein Erfinden)."""
    s = _settings(weekend_uplift_pct=0, base_mode="manual", manual_base_price=None)
    r = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200))
    assert r.price == 100.0


def test_from_row_defaults_base_mode() -> None:
    s = DpSettings.from_row({"base_mode": "bogus", "base_rate_mode": "x"})
    assert s.base_mode == "data_driven"
    assert s.base_rate_mode == "recommended"
    assert s.aggressiveness == 1.0


# --- Phase 2: Markt-/Wettbewerbs-Faktor -------------------------------------


def _market_settings(**kw: object) -> DpSettings:
    return _settings(
        weekend_uplift_pct=0,
        market_enabled=True,
        market_sensitivity=20.0,
        market_max_adjust_pct=25.0,
        **kw,
    )


def test_market_neutral_when_disabled() -> None:
    # market_enabled=False → Faktor neutral, selbst mit Signal (Phase-1-Parität).
    s = _settings(weekend_uplift_pct=0)
    r = compute_day(
        _BASE,
        s,
        DaySignals(day=date(2026, 7, 1), days_before=200, comp_price=200, demand_index=1.0),
    )
    assert r.factors["market"] == 1.0
    assert r.price == 100.0


def test_market_neutral_without_signal() -> None:
    s = _market_settings()
    r = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200))
    assert r.factors["market"] == 1.0
    assert r.price == 100.0


def test_market_competition_above_and_below() -> None:
    s = _market_settings()
    # comp 130 über base → +(130-100)/100*0.2 = +6 %.
    up = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, comp_price=130)
    )
    assert up.price == 106.0
    # comp 70 unter base → −6 %.
    down = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, comp_price=70)
    )
    assert down.price == 94.0


def test_market_demand_index() -> None:
    s = _market_settings()
    # demand 1.0 → (1.0−0.5)/0.5 * 0.2 = +20 %.
    hi = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, demand_index=1.0)
    )
    assert hi.price == 120.0


def test_market_cap_enforced() -> None:
    s = _market_settings()  # market_max_adjust_pct = 25 %
    # comp 300 → roh +40 %, gedeckelt auf +25 %.
    r = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, comp_price=300)
    )
    assert r.price == 125.0


def test_market_event_merge_no_double_count() -> None:
    s = _market_settings()
    # event_periods 10 % + Markt-Event 30 % → max 30 % (NICHT 40 %).
    r = compute_day(
        _BASE,
        s,
        DaySignals(
            day=date(2026, 7, 1),
            days_before=200,
            event_pct=10,
            market_event_pct=30,
        ),
    )
    assert round(r.factors["event"], 4) == 1.3
    # Markt-Event niedriger als eigenes Event → eigenes gilt.
    r2 = compute_day(
        _BASE,
        s,
        DaySignals(
            day=date(2026, 7, 1), days_before=200, event_pct=40, market_event_pct=10
        ),
    )
    assert round(r2.factors["event"], 4) == 1.4
