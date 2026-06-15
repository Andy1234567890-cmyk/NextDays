"""Tests für den calendar-Slice (Herzstück: Double-Booking-Schutz)."""
from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from src.features.calendar.schemas import (
    AvailabilityStatus,
    BlockRequest,
    DateRange,
)
from src.features.calendar.service import CalendarError, CalendarService
from src.main import create_app

client = TestClient(create_app())


# --- Health (Smoke) ---

def test_calendar_health() -> None:
    resp = client.get("/api/v1/calendar/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "calendar", "status": "ok"}


# --- DateRange ---

def test_daterange_rejects_inverted() -> None:
    with pytest.raises(ValueError):
        DateRange(start=date(2026, 5, 10), end=date(2026, 5, 10))


def test_daterange_nights_excludes_checkout() -> None:
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4))
    assert rng.nights() == [date(2026, 5, 1), date(2026, 5, 2), date(2026, 5, 3)]


# --- Hilfen für gemockten Supabase-Client ---

def _service_with_days(rows: list[dict[str, str]]) -> tuple[CalendarService, MagicMock]:
    client_mock = MagicMock(name="supabase")
    chain = (
        client_mock.table.return_value.select.return_value.eq.return_value
        .gte.return_value.lt.return_value
    )
    chain.execute.return_value.data = rows
    return CalendarService(client=client_mock), client_mock


# --- get_availability: fehlende Tage = offen ---

def test_missing_days_are_open() -> None:
    svc, _ = _service_with_days([])
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    days = svc.get_availability("p1", rng)
    assert [d.status for d in days] == [
        AvailabilityStatus.open,
        AvailabilityStatus.open,
    ]


# --- check_availability: Double-Booking erkannt ---

def test_check_detects_conflict() -> None:
    svc, _ = _service_with_days(
        [{"date": "2026-05-02", "status": "booked", "source": "booking"}]
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    res = svc.check_availability("p1", rng)
    assert res.available is False
    assert res.conflicting_days == [date(2026, 5, 2)]


def test_check_all_open_is_available() -> None:
    svc, _ = _service_with_days([])
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 5))
    res = svc.check_availability("p1", rng)
    assert res.available is True
    assert res.conflicting_days == []


# --- block: gebuchte Tage NICHT überschreiben ---

def test_block_rejects_when_booked() -> None:
    svc, _ = _service_with_days(
        [{"date": "2026-05-02", "status": "booked", "source": "airbnb"}]
    )
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
    )
    with pytest.raises(CalendarError) as exc:
        svc.block(req)
    assert exc.value.status_code == 409


def test_block_open_days_upserts() -> None:
    svc, client_mock = _service_with_days([])
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4)),
    )
    count = svc.block(req)
    assert count == 3
    # upsert wurde mit 3 Tagen aufgerufen
    upsert = client_mock.table.return_value.upsert
    upsert.assert_called_once()
    payload = upsert.call_args.args[0]
    assert len(payload) == 3
    assert all(p["status"] == "blocked" for p in payload)


# --- price override: setzen und zurücknehmen ---

def test_price_override_set_and_clear() -> None:
    from src.features.calendar.schemas import PriceOverrideRequest

    svc, client_mock = _service_with_days([])
    svc.set_price_override(
        PriceOverrideRequest(property_id="p1", date=date(2026, 5, 1), price=120)
    )
    svc.set_price_override(
        PriceOverrideRequest(property_id="p1", date=date(2026, 5, 1), price=None)
    )
    assert client_mock.table.return_value.upsert.call_count == 2


# --- ohne Client: sauberer Fehler statt Crash ---

def test_db_unavailable_raises_clean_error() -> None:
    svc = CalendarService(client=None)
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    with pytest.raises(CalendarError) as exc:
        svc.get_availability("p1", rng)
    assert exc.value.status_code == 500
