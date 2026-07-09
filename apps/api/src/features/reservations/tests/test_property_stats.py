"""Tests für die reine Objekt-Statistik-Aggregation (property_stats.py)."""
from datetime import date, timedelta

from src.features.reservations.property_stats import (
    compute_metric_detail,
    compute_property_stats,
)


def _res(**over: object) -> dict:
    base = {
        "status": "confirmed",
        "channel": "booking",
        "ota_name": "Booking.com",
        "check_in": "2026-07-01",
        "check_out": "2026-07-04",  # 3 Nächte
        # created_at fehlt bewusst → Zuordnung fällt auf check_in zurück; die
        # Fälle mit Buchungsdatum-Test setzen created_at explizit.
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


def test_occupancy_rate_divides_by_property_count() -> None:
    # Tenant-weit (Kontrollzentrum): 3 belegte Nächte, 3-Tage-Periode, 2 Objekte
    # → 3 / (3×2) = 50 % (sonst würden mehrere Objekte >100 % ergeben).
    stats = compute_property_stats(
        property_id="",
        property_title="",
        rows=[_res()],
        date_from=date(2026, 7, 1),
        date_to=date(2026, 7, 3),
        show_amounts=True,
        property_count=2,
    )
    assert stats.occupancy_rate.value == 50.0
    # Umsatz/Nächte summieren sich unverändert (nicht durch count geteilt).
    assert stats.booked_nights.value == 3
    assert stats.revenue is not None and stats.revenue.value == 300.0


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


def test_period_uses_booking_date_not_checkin() -> None:
    """Zuordnung + Sparkline über created_at (Buchungsdatum), wie Lodgify: eine
    im Juni gebuchte Juli-Anreise zählt in die Juni-Periode, nicht in die Juli."""
    row = _res(
        created_at="2026-06-15T09:00:00+00:00",
        check_in="2026-07-20", check_out="2026-07-23",
    )
    june = compute_property_stats(
        property_id="p1", property_title="Haus A", rows=[row],
        date_from=date(2026, 6, 1), date_to=date(2026, 6, 30), show_amounts=True,
    )
    july = compute_property_stats(
        property_id="p1", property_title="Haus A", rows=[row],
        date_from=date(2026, 7, 1), date_to=date(2026, 7, 31), show_amounts=True,
    )
    # Umsatz fällt in den Juni (Buchungsmonat), NICHT in den Juli (Anreisemonat).
    assert june.revenue is not None and june.revenue.value == 300.0
    assert july.revenue is not None and july.revenue.value == 0.0


def test_sparkline_series_hits_booking_day() -> None:
    """Jede KPI trägt eine Tagesreihe; der Umsatz-Punkt liegt am Buchungstag."""
    row = _res(created_at="2026-06-15T09:00:00+00:00")
    stats = compute_property_stats(
        property_id="p1", property_title="Haus A", rows=[row],
        date_from=date(2026, 6, 1), date_to=date(2026, 6, 30), show_amounts=True,
    )
    by_metric = {s.metric: s for s in stats.series}
    rev = by_metric["revenue"]
    assert rev.visible is True
    assert len(rev.points) == 30  # 30-Tage-Periode, Tagesauflösung
    spike = [p for p in rev.points if p.value > 0]
    assert len(spike) == 1 and spike[0].date == date(2026, 6, 15)
    assert spike[0].value == 300.0


def test_sparkline_money_series_hidden_without_amounts() -> None:
    stats = compute_property_stats(
        property_id="p1", property_title="Haus A", rows=[_res()],
        date_from=date(2026, 7, 1), date_to=date(2026, 7, 31), show_amounts=False,
    )
    by_metric = {s.metric: s for s in stats.series}
    # Geld-Reihen leer + unsichtbar (kein erfundener Wert), Zähl-Reihen sichtbar.
    assert by_metric["revenue"].visible is False
    assert by_metric["revenue"].points == []
    assert by_metric["booked_nights"].visible is True
    assert any(p.value > 0 for p in by_metric["booked_nights"].points)


def test_metric_detail_series_and_compare_periods() -> None:
    """KPI-Detail: aktuelle Tagesreihe + vier Vergleichsperioden davor. Eine
    Buchung in der Vorperiode liefert dort einen Wert + %-Vergleich."""
    rows = [
        _res(created_at="2026-07-05T00:00:00+00:00", total_amount=300.0),
        _res(created_at="2026-06-05T00:00:00+00:00", total_amount=100.0),
    ]
    detail = compute_metric_detail(
        rows=rows, metric="revenue",
        date_from=date(2026, 7, 1), date_to=date(2026, 7, 31), show_amounts=True,
    )
    assert detail.is_money is True and detail.visible is True
    assert len(detail.series) == 31  # Juli hat 31 Tage
    assert sum(p.value for p in detail.series) == 300.0
    assert len(detail.periods) == 4
    # Erste Vergleichsperiode = die 31 Tage direkt vor Juli (Juni-Bereich).
    first = detail.periods[0]
    assert first.date_to == date(2026, 6, 30)
    assert first.value == 100.0
    # Aktuell 300 vs. 100 davor → +200 %.
    assert first.change_pct == 200.0
    # Breakout: aktuelle Periode + vier Vergleichsperioden = 5 Zeilen.
    assert len(detail.breakout) == 5


def test_metric_detail_money_masked() -> None:
    detail = compute_metric_detail(
        rows=[_res()], metric="revenue",
        date_from=date(2026, 7, 1), date_to=date(2026, 7, 31), show_amounts=False,
    )
    # Geldmetrik ohne Sicht → leer + unsichtbar (keine erfundenen Werte).
    assert detail.visible is False
    assert detail.series == []
    assert detail.periods == []
    assert detail.breakout == []


def test_metric_detail_count_metric_always_visible() -> None:
    detail = compute_metric_detail(
        rows=[_res(created_at="2026-07-05T00:00:00+00:00")],
        metric="booked_nights",
        date_from=date(2026, 7, 1), date_to=date(2026, 7, 31), show_amounts=False,
    )
    # Zählmetrik ist auch ohne Betrags-Sicht sichtbar.
    assert detail.is_money is False and detail.visible is True
    assert sum(p.value for p in detail.series) == 3.0
