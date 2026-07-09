"""Tests für die reine Objekt-Statistik-Aggregation (property_stats.py)."""
from datetime import date, timedelta

from src.features.reservations.property_stats import compute_property_stats


def _res(**over: object) -> dict:
    base = {
        "status": "confirmed",
        "channel": "booking",
        "ota_name": "Booking.com",
        "check_in": "2026-07-01",
        "check_out": "2026-07-04",  # 3 Nächte
        "total_amount": 300.0,
        "paid_amount": 150.0,
        "num_guests": 2,
        "currency": "EUR",
    }
    base.update(over)
    return base


def test_basic_aggregation_with_amounts() -> None:
    stats = compute_property_stats(
        property_id="p1",
        property_title="Haus A",
        rows=[_res()],
        date_from=date(2026, 7, 1),
        date_to=date(2026, 7, 31),
        show_amounts=True,
    )
    assert stats.currency == "EUR"
    assert stats.revenue is not None and stats.revenue.value == 300.0
    assert stats.payments_received is not None
    assert stats.payments_received.value == 150.0
    assert stats.hosted_guests.value == 2
    assert stats.booked_nights.value == 3
    assert stats.avg_stay_length.value == 3
    # Ø-Preis/Nacht = 300 / 3
    assert stats.avg_price_per_night is not None
    assert stats.avg_price_per_night.value == 100.0
    # Ein Kanal (Booking.com) mit 3 Nächten.
    assert len(stats.by_channel) == 1
    assert stats.by_channel[0].nights == 3
    assert stats.by_channel[0].amount == 300.0


def test_amounts_masked_when_not_visible() -> None:
    stats = compute_property_stats(
        property_id="p1",
        property_title="Haus A",
        rows=[_res()],
        date_from=date(2026, 7, 1),
        date_to=date(2026, 7, 31),
        show_amounts=False,
    )
    # Betrags-KPIs None (Daten-Split); Zähl-KPIs bleiben sichtbar.
    assert stats.revenue is None
    assert stats.payments_received is None
    assert stats.avg_booking_value is None
    assert stats.currency == ""
    assert stats.hosted_guests.value == 2
    assert stats.booked_nights.value == 3
    # Kanal-Nächte bleiben, Betrag maskiert.
    assert stats.by_channel[0].nights == 3
    assert stats.by_channel[0].amount is None


def test_mixed_currencies_suppress_amount_kpis() -> None:
    rows = [_res(currency="EUR"), _res(currency="DKK", total_amount=2000.0)]
    stats = compute_property_stats(
        property_id="p1",
        property_title="Haus A",
        rows=rows,
        date_from=date(2026, 7, 1),
        date_to=date(2026, 7, 31),
        show_amounts=True,
    )
    # Gemischte Währungen → keine Mischsumme (Betrags-KPIs None), aber Zählungen ok.
    assert stats.revenue is None
    assert stats.currency == ""
    assert stats.hosted_guests.value == 4  # 2 Buchungen × 2 Gäste
    assert stats.booked_nights.value == 6


def test_cancelled_counted_separately() -> None:
    rows = [_res(), _res(status="cancelled")]
    stats = compute_property_stats(
        property_id="p1",
        property_title="Haus A",
        rows=rows,
        date_from=date(2026, 7, 1),
        date_to=date(2026, 7, 31),
        show_amounts=True,
    )
    # Nur die aktive Buchung zählt für Umsatz/Nächte; die Storno separat.
    assert stats.created_reservations.value == 1
    assert stats.cancelled_reservations.value == 1
    assert stats.cancelled_nights.value == 3
    assert stats.booked_nights.value == 3


def test_occupancy_rate_percent() -> None:
    # 3 belegte Nächte in einer 3-Tage-Periode → 100 %.
    stats = compute_property_stats(
        property_id="p1",
        property_title="Haus A",
        rows=[_res()],
        date_from=date(2026, 7, 1),
        date_to=date(2026, 7, 3),
        show_amounts=True,
    )
    assert stats.occupancy_rate.value == 100.0


def test_days_booked_ahead_uses_future_arrival() -> None:
    today = date.today()
    future = today + timedelta(days=10)
    stats = compute_property_stats(
        property_id="p1",
        property_title="Haus A",
        rows=[_res(check_in=future.isoformat(),
                   check_out=(future + timedelta(days=2)).isoformat())],
        date_from=today,
        date_to=today + timedelta(days=30),
        show_amounts=True,
    )
    assert stats.days_booked_ahead.value == 10
