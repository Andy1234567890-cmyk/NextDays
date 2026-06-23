"""Tests für den calendar-Slice (Herzstück: Double-Booking-Schutz)."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from src.features.calendar.schemas import (
    AvailabilityStatus,
    BlockRequest,
    DateRange,
    PriceOverrideRequest,
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


# --- In-Memory-Fake-DB (tabellenbewusst; deckt die genutzten Query-Ketten ab) -

class _Res:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    """Minimaler Supabase-Query-Stub: Filter werden ignoriert, execute liefert
    die für die Tabelle hinterlegten Zeilen (bzw. zeichnet upserts auf)."""

    def __init__(self, store: dict, name: str) -> None:
        self._store = store
        self._name = name

    def select(self, *_a, **_k) -> "_Query":
        return self

    def eq(self, *_a, **_k) -> "_Query":
        return self

    def gte(self, *_a, **_k) -> "_Query":
        return self

    def lt(self, *_a, **_k) -> "_Query":
        return self

    def order(self, *_a, **_k) -> "_Query":
        return self

    def limit(self, *_a, **_k) -> "_Query":
        return self

    @property
    def not_(self) -> "_Query":
        return self

    def is_(self, *_a, **_k) -> "_Query":
        return self

    def upsert(self, payload, **_k) -> "_Query":  # noqa: ANN001
        self._store.setdefault("_upserts", []).append((self._name, payload))
        return self

    def execute(self) -> _Res:
        return _Res(list(self._store.get(self._name, [])))


class _FakeDB:
    def __init__(self, store: dict) -> None:
        self._store = store

    def table(self, name: str) -> _Query:
        return _Query(self._store, name)


def _service(**tables: list[dict]) -> tuple[CalendarService, dict]:
    store: dict = dict(tables)
    return CalendarService(client=_FakeDB(store)), store


# --- get_availability: fehlende Tage = offen ---

def test_missing_days_are_open() -> None:
    svc, _ = _service()
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    days = svc.get_availability("p1", rng)
    assert [d.status for d in days] == [
        AvailabilityStatus.open,
        AvailabilityStatus.open,
    ]


# --- get_availability: Preis (Override > Basispreis) + Min-Stay ---

def test_availability_price_override_beats_base_price() -> None:
    svc, _ = _service(
        rate_plans=[{"base_price": 100.0, "min_stay": 2}],
        price_overrides=[{"date": "2026-05-02", "price": 150.0}],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    days = svc.get_availability("p1", rng)
    # Tag 1 ohne Override → Basispreis; Tag 2 mit Override.
    assert days[0].price == 100.0
    assert days[1].price == 150.0
    assert all(d.min_stay == 2 for d in days)


def test_availability_no_rate_plan_keeps_price_none() -> None:
    svc, _ = _service()  # kein Rate-Plan → kein erfundener Preis
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    days = svc.get_availability("p1", rng)
    assert days[0].price is None
    assert days[0].min_stay is None


# --- check_availability: Double-Booking erkannt ---

def test_check_detects_conflict() -> None:
    svc, _ = _service(
        availability=[{"date": "2026-05-02", "status": "booked", "source": "booking"}]
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    res = svc.check_availability("p1", rng)
    assert res.available is False
    assert res.conflicting_days == [date(2026, 5, 2)]


def test_check_all_open_is_available() -> None:
    svc, _ = _service()
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 5))
    res = svc.check_availability("p1", rng)
    assert res.available is True
    assert res.conflicting_days == []


# --- block: gebuchte Tage NICHT überschreiben ---

def test_block_rejects_when_booked() -> None:
    svc, _ = _service(
        availability=[{"date": "2026-05-02", "status": "booked", "source": "airbnb"}]
    )
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
    )
    with pytest.raises(CalendarError) as exc:
        svc.block(req)
    assert exc.value.status_code == 409


def test_block_open_days_upserts() -> None:
    svc, store = _service()
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4)),
    )
    count = svc.block(req)
    assert count == 3
    upserts = [u for u in store.get("_upserts", []) if u[0] == "availability"]
    assert len(upserts) == 1
    payload = upserts[0][1]
    assert len(payload) == 3
    assert all(p["status"] == "blocked" for p in payload)


# --- price override: setzen und zurücknehmen ---

def test_price_override_set_and_clear() -> None:
    svc, store = _service()
    svc.set_price_override(
        PriceOverrideRequest(property_id="p1", date=date(2026, 5, 1), price=120)
    )
    svc.set_price_override(
        PriceOverrideRequest(property_id="p1", date=date(2026, 5, 1), price=None)
    )
    overrides = [u for u in store.get("_upserts", []) if u[0] == "price_overrides"]
    assert len(overrides) == 2


# --- ohne Client: sauberer Fehler statt Crash ---

def test_db_unavailable_raises_clean_error() -> None:
    svc = CalendarService(client=None)
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    with pytest.raises(CalendarError) as exc:
        svc.get_availability("p1", rng)
    assert exc.value.status_code == 500
