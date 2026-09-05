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
    # Caps ausschalten, um die rohe Sensitivity-Wirkung zu prüfen.
    s = _settings(
        weekend_uplift_pct=0,
        occupancy_discount_cap_pct=0,
        occupancy_premium_cap_pct=0,
    )
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
    """Konservativ dämpft, aggressiv verstärkt die Auslastungs-Abweichung.
    Premium-Cap ausgeschaltet, um die reine Aggressivitäts-Skalierung zu prüfen."""
    sig = DaySignals(day=date(2026, 7, 1), occupancy=1.0, days_before=200)
    nocap = {"weekend_uplift_pct": 0, "occupancy_premium_cap_pct": 0}
    cons = compute_day(_BASE, _settings(base_rate_mode="conservative", **nocap), sig)
    rec = compute_day(_BASE, _settings(base_rate_mode="recommended", **nocap), sig)
    aggr = compute_day(_BASE, _settings(base_rate_mode="aggressive", **nocap), sig)
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


# --- Roadmap-Phase 1: Anti-Über-Rabattierung, asymmetrische Caps, Buckets ----


def test_anti_over_discounting_only_strongest_discount() -> None:
    """Mehrere Rabatte kumulieren NICHT — nur der stärkste gilt (PriceLabs-Regel).
    Last-Minute 25 % (×0,75) + Orphan 15 % (×0,85): stärkster = 0,75 → 75 €,
    NICHT 0,75×0,85 = 63,75 €."""
    s = _settings(weekend_uplift_pct=0, min_price=10)
    r = compute_day(
        _BASE,
        s,
        DaySignals(day=date(2026, 7, 1), days_before=2, is_orphan_gap=True),
    )
    assert r.factors["last_minute"] == 0.75
    assert r.factors["orphan"] == 0.85
    assert r.price == 75.0  # nur der stärkste Rabatt


def test_premiums_stack_but_discount_capped() -> None:
    """Aufschläge stapeln (alle gelten), Rabatte nur der stärkste.
    Saison +50 % × Wochenende +20 % = ×1,8; dazu Last-Minute-Rabatt 25 % → ×0,75.
    Ergebnis 100 × 1,8 × 0,75 = 135 €."""
    s = _settings(min_price=10, max_price=1000)
    # 2026-07-04 = Samstag, 2 Tage vorher → Last-Minute 25 %.
    r = compute_day(
        _BASE,
        s,
        DaySignals(day=date(2026, 7, 4), season_pct=50, days_before=2),
    )
    assert r.price == 135.0


def test_occupancy_discount_cap_asymmetric() -> None:
    """Rabatt-Cap (−20 %) greift, obwohl sensitivity −30 % ergäbe."""
    s = _settings(weekend_uplift_pct=0, min_price=10)
    lo = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=0.0, days_before=200)
    )
    # roh −30 %, gedeckelt auf −20 % → 80 €.
    assert lo.price == 80.0
    assert round(lo.factors["occupancy"], 4) == 0.8


def test_occupancy_lead_buckets_dampen_far_out() -> None:
    """Vorlauf-Buckets: ferne Termine reagieren schwächer auf die Auslastung.
    Bucket 0-15 Tage Gewicht 1,0, darüber 0,5. Bei voller Belegung +30 % roh:
    nah (Tag 5) → +15 % (Cap), fern (Tag 100) → +15 %×0,5-gewichtet, hier durch
    Cap noch +15 %? Nein: Gewicht wirkt VOR dem Cap."""
    buckets = [
        {"max_days_before": 15, "weight": 1.0},
        {"max_days_before": 365, "weight": 0.5},
    ]
    s = _settings(
        weekend_uplift_pct=0,
        occupancy_premium_cap_pct=0,  # Cap aus, um Gewicht isoliert zu sehen
        occupancy_lead_buckets=buckets,
        last_minute=[],  # keine Last-Minute-Überlagerung im nahen Bucket
    )
    near = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=1.0, days_before=10)
    )
    far = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=1.0, days_before=100)
    )
    assert near.price == 130.0  # voller Faktor (+30 %), Bucket 0-15 Gewicht 1,0
    assert far.price == 115.0   # halbes Gewicht (+15 %)


def test_pickup_velocity_factor() -> None:
    """Schnellerer Pickup als normal → Aufschlag (antizipativ); langsamer → Rabatt.
    velocity +1 → +sensitivity (30 %, gedeckelt auf Premium-Cap +15 %)."""
    s = _settings(weekend_uplift_pct=0, min_price=10)
    fast = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, pickup_velocity=1.0)
    )
    assert fast.price == 115.0  # +15 % (Premium-Cap)
    slow = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, pickup_velocity=-1.0)
    )
    assert slow.price == 80.0  # −20 % (Discount-Cap)
    none = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, pickup_velocity=None)
    )
    assert none.factors["pickup"] == 1.0


# --- RateBoard-Bausteine: Wetter, Rate Rules, Autopilot ---------------------


def test_weather_factor_good_and_bad() -> None:
    """Gutes Wetter → Aufschlag, schlechtes → Rabatt, symmetrisch gedeckelt."""
    # days_before=200 → keine Last-Minute-Überlagerung, Wetter isoliert.
    s = _settings(weekend_uplift_pct=0, weather_enabled=True, weather_max_adjust_pct=10)
    good = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, weather_score=1.0)
    )
    assert good.price == 110.0  # +10 %
    bad = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, weather_score=-1.0)
    )
    assert bad.price == 90.0  # −10 %


def test_weather_neutral_when_disabled_or_no_signal() -> None:
    # Aus → neutral trotz Signal.
    off = _settings(weekend_uplift_pct=0, weather_enabled=False)
    r = compute_day(
        _BASE, off, DaySignals(day=date(2026, 7, 1), days_before=5, weather_score=1.0)
    )
    assert r.factors["weather"] == 1.0
    # An, aber kein Signal (fernes Datum) → neutral.
    on = _settings(weekend_uplift_pct=0, weather_enabled=True)
    r2 = compute_day(
        _BASE, on, DaySignals(day=date(2026, 7, 1), days_before=200, weather_score=None)
    )
    assert r2.factors["weather"] == 1.0


def test_rate_rules_apply_on_top() -> None:
    """Manuelle Regel greift zusätzlich, auch wenn ein Auto-Rabatt aktiv ist
    (Rate Rules sind bewusster Override, nicht von Anti-Über-Rabattierung erfasst)."""
    # Regel: an Sonntagen (weekday 6) +20 %.
    rules = [{"match": {"weekday": 6}, "adjust_pct": 20}]
    s = _settings(weekend_uplift_pct=0, rate_rules=rules, min_price=10)
    # 2026-07-05 = Sonntag.
    r = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 5), days_before=200))
    assert r.factors["rate_rules"] == 1.2
    assert r.price == 120.0
    # Montag (kein Match) → Regel neutral.
    r2 = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 6), days_before=200))
    assert r2.factors["rate_rules"] == 1.0
    assert r2.price == 100.0


def test_rate_rules_match_window() -> None:
    """Vorlauf-Fenster im match: nur innerhalb min/max_days_before."""
    rules = [{"match": {"max_days_before": 7}, "adjust_pct": -15}]
    s = _settings(weekend_uplift_pct=0, rate_rules=rules, min_price=10)
    near = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 1), days_before=3))
    assert near.factors["rate_rules"] == 0.85
    far = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 1), days_before=30))
    assert far.factors["rate_rules"] == 1.0


def test_autopilot_spalte_wird_ignoriert() -> None:
    # EIN Schalter, EINE Wahrheit: enabled heißt „gilt überall". Die alte
    # DB-Spalte autopilot_enabled existiert noch, hat aber keine Bedeutung
    # mehr — from_row darf an ihr nicht scheitern und kein Feld erzeugen.
    s = DpSettings.from_row({"enabled": True, "autopilot_enabled": True})
    assert s.enabled is True
    assert not hasattr(s, "autopilot_enabled")


# --- Auslastungs-STUFEN (0550): ablesbare Leiter statt stufenloser Kurve ------

_STUFEN = [
    {"ab_pct": 50, "adjust_pct": 5},
    {"ab_pct": 75, "adjust_pct": 12},
    {"ab_pct": 90, "adjust_pct": 25},
]


def test_stufen_hoechste_erreichte_gilt() -> None:
    # 82 % erreicht die 75er-Stufe (+12 %), NICHT 5+12 addiert und auch keinen
    # interpolierten Zwischenwert. Genau das macht die Leiter ablesbar.
    s = _settings(occupancy_steps=_STUFEN, weekend_uplift_pct=0)
    res = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=0.82, days_before=200)
    )
    assert res.price == 112.0
    assert res.factors["occupancy"] == 1.12


def test_stufen_unterhalb_der_niedrigsten_neutral() -> None:
    # 40 % erreicht keine Stufe → kein Auf- und kein Abschlag.
    s = _settings(occupancy_steps=_STUFEN, weekend_uplift_pct=0)
    res = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=0.40, days_before=200)
    )
    assert res.price == 100.0
    assert res.factors["occupancy"] == 1.0


def test_stufen_ersetzen_die_kurve() -> None:
    # Sind Stufen gepflegt, gilt NUR die Leiter — die Empfindlichkeits-Kurve und
    # ihre Deckel treten zurück. Sonst stünden zwei Auslastungs-Einträge in der
    # Aufschlüsselung, die sich überlagern.
    s = _settings(
        occupancy_steps=[{"ab_pct": 50, "adjust_pct": 5}],
        occupancy_sensitivity=90.0,   # würde ohne Stufen weit mehr bewegen
        occupancy_premium_cap_pct=80.0,
        weekend_uplift_pct=0,
    )
    res = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=1.0, days_before=200)
    )
    assert res.price == 105.0


def test_stufen_negativ_senken_den_preis() -> None:
    # Schwache Zeiträume: eine Stufe darf auch nach unten wirken.
    s = _settings(
        occupancy_steps=[{"ab_pct": 0, "adjust_pct": -10}],
        weekend_uplift_pct=0,
    )
    res = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), occupancy=0.10, days_before=200)
    )
    assert res.price == 90.0


# --------------------------------------------------------------------------
# Far-Future-Aufschlag (0555) — Gegenstück zum Last-Minute-Rabatt
# --------------------------------------------------------------------------

_FERN = [
    {"days_before": 180, "uplift_pct": 10},
    {"days_before": 240, "uplift_pct": 15},
    {"days_before": 330, "uplift_pct": 25},
]


def test_far_future_weiteste_stufe_gewinnt() -> None:
    """Anders als beim Last-Minute-Rabatt gilt die WEITESTE erreichte Stufe.

    Gälte wie dort die engste, überschriebe „ab 180 Tagen +10 %" den höheren
    Aufschlag bei 350 Tagen — die Leiter liefe verkehrt herum.
    """
    s = _settings(far_future=_FERN, weekend_uplift_pct=0)
    fuer = {
        t: compute_day(200.0, s, DaySignals(day=date(2026, 6, 1), days_before=t))
        for t in (30, 179, 180, 250, 350)
    }
    assert fuer[30].factors["far_future"] == 1.0
    assert fuer[179].factors["far_future"] == 1.0
    assert round(fuer[180].factors["far_future"], 4) == 1.10
    assert round(fuer[250].factors["far_future"], 4) == 1.15
    assert round(fuer[350].factors["far_future"], 4) == 1.25


def test_far_future_leer_ist_neutral() -> None:
    """Ein Aufschlag, den niemand eingestellt hat, darf nicht gelten."""
    # Basispreis unter dem Höchstpreis des Test-Helfers (300), sonst misst der
    # Test den Deckel statt den Faktor.
    s = _settings(far_future=[], weekend_uplift_pct=0)
    r = compute_day(200.0, s, DaySignals(day=date(2026, 6, 1), days_before=400))
    assert r.factors["far_future"] == 1.0
    assert round(r.price, 2) == 200.0


def test_far_future_und_last_minute_schliessen_sich_aus() -> None:
    """Beide Regeln greifen nie am selben Tag: der eine wirkt nah, der andere
    fern. Ein Tag mit beiden Faktoren wäre ein Rechenfehler."""
    s = _settings(
        far_future=_FERN,
        last_minute=[{"days_before": 7, "discount_pct": 20}],
        weekend_uplift_pct=0,
    )
    nah = compute_day(200.0, s, DaySignals(day=date(2026, 6, 1), days_before=5))
    fern = compute_day(200.0, s, DaySignals(day=date(2026, 6, 1), days_before=350))
    assert nah.factors["last_minute"] < 1.0
    assert nah.factors["far_future"] == 1.0
    assert fern.factors["far_future"] > 1.0
    assert fern.factors["last_minute"] == 1.0


# --- 0562: Marktbasis, Vorjahresanker, Feiertage, Tagesgrenzen -----------------


def test_marktbasis_ersetzt_den_grundpreis_und_ist_sichtbar() -> None:
    """Hostaway „Market-driven base price": der Median der Umgebung ist die
    Basis. Ohne Marktwert am Tag gilt der Grundpreis — und der Faktor sagt es."""
    s = _settings(weekend_uplift_pct=0, base_mode="market", min_price=None, max_price=None)
    mit = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, comp_price=150.0)
    )
    assert mit.price == 150.0
    assert mit.factors["marktbasis"] == 1.5
    ohne = compute_day(_BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200))
    assert ohne.price == 100.0
    assert ohne.factors["marktbasis"] == 1.0


def test_marktbasis_wirkt_nicht_ohne_den_modus() -> None:
    s = _settings(weekend_uplift_pct=0, market_enabled=False, min_price=None, max_price=None)
    r = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, comp_price=150.0)
    )
    assert r.price == 100.0
    assert r.factors["marktbasis"] == 1.0


def test_vorjahresanker_hebt_nur_an_und_ist_gedeckelt() -> None:
    """Hostaway „Historical anchoring … always increases the price"."""
    s = _settings(
        weekend_uplift_pct=0, anker_enabled=True, anker_max_pct=20.0,
        min_price=None, max_price=None,
    )
    sig = DaySignals(day=date(2026, 7, 1), days_before=200)
    # Anker ueber dem Preis, innerhalb des Deckels → genau auf den Anker.
    sig.anker_price = 110.0
    assert compute_day(_BASE, s, sig).price == 110.0
    # Anker weit darueber → nur bis zum Deckel (+20 %).
    sig.anker_price = 200.0
    r = compute_day(_BASE, s, sig)
    assert r.price == 120.0
    assert r.factors["anker"] == 1.2
    # Anker UNTER dem Preis → nichts passiert (nie nach unten).
    sig.anker_price = 80.0
    r = compute_day(_BASE, s, sig)
    assert r.price == 100.0
    assert r.factors["anker"] == 1.0


def test_vorjahresanker_aus_ist_neutral() -> None:
    s = _settings(weekend_uplift_pct=0, anker_enabled=False, min_price=None, max_price=None)
    r = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, anker_price=500.0)
    )
    assert r.price == 100.0


def test_feiertag_und_ferien_stapeln_als_aufschlaege() -> None:
    s = _settings(
        weekend_uplift_pct=0, feiertag_uplift_pct=10.0, ferien_uplift_pct=5.0,
        min_price=None, max_price=None,
    )
    r = compute_day(
        _BASE, s,
        DaySignals(day=date(2026, 7, 1), days_before=200, ist_feiertag=True, ist_ferien=True),
    )
    assert r.price == round(100.0 * 1.10 * 1.05, 2)
    assert r.factors["feiertag"] == 1.1
    assert r.factors["ferien"] == 1.05
    # 0 % = neutral, auch wenn der Tag ein Feiertag ist.
    s0 = _settings(weekend_uplift_pct=0, min_price=None, max_price=None)
    r0 = compute_day(
        _BASE, s0, DaySignals(day=date(2026, 7, 1), days_before=200, ist_feiertag=True)
    )
    assert r0.price == 100.0


def test_tagesgrenze_schlaegt_die_globale_grenze() -> None:
    """SiteMinder „Floor and ceiling overrides": die Grenze des Zeitraums
    gewinnt gegen dp_settings.min/max_price."""
    s = _settings(weekend_uplift_pct=0, min_price=50.0, max_price=300.0)
    # Tages-Mindestpreis 120 hebt den 100er an, obwohl global 50 erlaubt waere.
    r = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, min_price_tag=120.0)
    )
    assert r.price == 120.0
    # Tages-Hoechstpreis 90 kappt, obwohl global 300 erlaubt waere.
    r2 = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, max_price_tag=90.0)
    )
    assert r2.price == 90.0
    # Ohne Tagesgrenze gilt weiter die globale.
    s2 = _settings(weekend_uplift_pct=0, min_price=150.0, max_price=300.0)
    assert compute_day(_BASE, s2, DaySignals(day=date(2026, 7, 1), days_before=200)).price == 150.0


def test_saison_untergrenze_hebt_an_und_kappt_nie() -> None:
    """0565: der Saisonkalender bestimmt den Mindestpreis — nie die Obergrenze
    (Anweisung 05.09.2026). Ersetzt am Saisontag die globale Untergrenze."""
    s = _settings(weekend_uplift_pct=0, min_price=50.0, max_price=300.0, saison_mindestpreis=True)
    tag = DaySignals(day=date(2026, 7, 1), days_before=200, saison_min_price=130.0)
    r = compute_day(_BASE, s, tag)
    assert r.price == 130.0
    assert r.factors["saison_untergrenze"] == 1.3
    # Liegt der berechnete Preis ueber dem Saisonpreis, passiert nichts — der
    # Saisonpreis ist keine Decke.
    hoch = DaySignals(day=date(2026, 7, 1), days_before=200, saison_min_price=80.0)
    r2 = compute_day(_BASE, s, hoch)
    assert r2.price == 100.0
    assert r2.factors["saison_untergrenze"] == 1.0
    # Die Obergrenze bleibt die der Einstellungen: Saison 400 wird bei 300 gekappt.
    r3 = compute_day(
        _BASE, s, DaySignals(day=date(2026, 7, 1), days_before=200, saison_min_price=400.0)
    )
    assert r3.price == 300.0
    # Regel aus: das Signal wirkt nicht.
    aus = _settings(weekend_uplift_pct=0, min_price=50.0, max_price=300.0)
    r4 = compute_day(_BASE, aus, tag)
    assert r4.price == 100.0
    assert "saison_untergrenze" not in r4.factors
    # Kein Saisontag: die globale Untergrenze gilt weiter.
    s5 = _settings(weekend_uplift_pct=0, min_price=150.0, max_price=300.0, saison_mindestpreis=True)
    assert compute_day(_BASE, s5, DaySignals(day=date(2026, 7, 1), days_before=200)).price == 150.0
