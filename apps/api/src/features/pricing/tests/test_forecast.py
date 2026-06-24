"""Tests für das KI-Forecast-Modell (gelernte Pickup-Kurve, deterministisch)."""
from datetime import date

from src.features.pricing.forecast import PickupCurveModel, PickupObservation


def _obs(month: int, days_before: int, booked: bool, n: int) -> list[PickupObservation]:
    """n Beobachtungen für denselben (Monat, Vorlauf)-Bucket."""
    return [
        PickupObservation(stay_date=date(2026, month, 15), days_before=days_before, booked=booked)
        for _ in range(n)
    ]


def test_cold_start_returns_none() -> None:
    """Unter der Mindest-Beobachtungszahl wird nichts gelernt → kein Signal."""
    model = PickupCurveModel(min_observations=8)
    model.train(_obs(7, 10, booked=True, n=3))  # nur 3 < 8
    assert model.is_trained is False
    assert model.forecast_velocity(date(2026, 7, 15), 10, occupied_now=True) is None


def test_learns_expectation_and_signals_above_below() -> None:
    """Gelernte Erwartung: Bucket war historisch zu 0 % belegt. Ist heute belegt →
    schneller als erwartet → positives Signal. Nicht belegt → ~0."""
    model = PickupCurveModel(min_observations=4)
    # 10 Beobachtungen, alle unbelegt → erwartete Belegung 0.0 für diesen Bucket.
    model.train(_obs(7, 10, booked=False, n=10))
    assert model.is_trained is True
    fast = model.forecast_velocity(date(2026, 7, 20), 10, occupied_now=True)
    assert fast == 1.0  # Ist 1 − Erwartung 0 = +1 (viel schneller als normal)
    normal = model.forecast_velocity(date(2026, 7, 20), 10, occupied_now=False)
    assert normal == 0.0  # Ist 0 − Erwartung 0 = neutral


def test_below_expectation_negative() -> None:
    """Bucket war historisch zu 100 % belegt. Heute NICHT belegt → langsamer als
    erwartet → negatives Signal."""
    model = PickupCurveModel(min_observations=4)
    model.train(_obs(8, 5, booked=True, n=10))  # Erwartung 1.0
    slow = model.forecast_velocity(date(2026, 8, 10), 5, occupied_now=False)
    assert slow == -1.0
    on_track = model.forecast_velocity(date(2026, 8, 10), 5, occupied_now=True)
    assert on_track == 0.0


def test_season_buckets_separate() -> None:
    """Verschiedene Anreise-Monate lernen getrennte Kurven."""
    model = PickupCurveModel(min_observations=4)
    obs = _obs(7, 10, booked=True, n=8) + _obs(11, 10, booked=False, n=8)
    model.train(obs)
    # Juli-Bucket: Erwartung 1.0 → unbelegt heute = −1.
    assert model.forecast_velocity(date(2026, 7, 1), 10, occupied_now=False) == -1.0
    # November-Bucket: Erwartung 0.0 → belegt heute = +1.
    assert model.forecast_velocity(date(2026, 11, 1), 10, occupied_now=True) == 1.0
