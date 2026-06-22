"""Tests für den reservations-Slice (Anlegen + Double-Booking-Schutz)."""
from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.reservations.schemas import (
    GuestContact,
    ReservationChannel,
    ReservationCreate,
)
from src.features.reservations.service import ReservationError, ReservationsService
from src.main import create_app

client = TestClient(create_app())


# --- Health (Smoke) ---

def test_reservations_health() -> None:
    resp = client.get("/api/v1/reservations/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "reservations", "status": "ok"}


# --- Schema-Validierung ---

def test_create_rejects_inverted_dates() -> None:
    with pytest.raises(ValueError):
        ReservationCreate(
            property_id="p1",
            check_in=date(2026, 5, 10),
            check_out=date(2026, 5, 10),
        )


# --- Service: Tenant-Pflicht ---

def test_create_requires_tenant() -> None:
    service = ReservationsService(service_client=MagicMock())
    req = ReservationCreate(
        property_id="p1",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id=None), req)
    assert exc.value.status_code == 400


# --- Service: Double-Booking-Schutz ---

def _service_for_create(
    *, property_found: bool, taken_days: list[dict[str, str]]
) -> ReservationsService:
    """Mockt die im create() benutzten Tabellen-Ketten.

    properties.select…limit → {data: [...]}, availability.select…lt → taken_days.
    """
    db = MagicMock(name="supabase")

    def table(name: str) -> MagicMock:
        t = MagicMock(name=f"table:{name}")
        if name == "properties":
            chain = (
                t.select.return_value.eq.return_value.eq.return_value.limit.return_value
            )
            chain.execute.return_value.data = (
                [{"id": "p1"}] if property_found else []
            )
        elif name == "rate_plans":
            chain = t.select.return_value.eq.return_value.limit.return_value
            chain.execute.return_value.data = [{"currency": "EUR"}]
        elif name == "availability":
            chain = (
                t.select.return_value.eq.return_value.gte.return_value.lt.return_value
            )
            chain.execute.return_value.data = taken_days
        return t

    db.table.side_effect = table
    return ReservationsService(service_client=db)


def test_create_rejects_when_days_taken() -> None:
    service = _service_for_create(
        property_found=True,
        taken_days=[{"date": "2026-05-01", "status": "booked"}],
    )
    req = ReservationCreate(
        property_id="p1",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 409


def test_create_rejects_unknown_property() -> None:
    service = _service_for_create(property_found=False, taken_days=[])
    req = ReservationCreate(
        property_id="nope",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 404


def test_guest_contact_defaults_empty() -> None:
    c = GuestContact()
    assert c.first_name == "" and c.email == ""


def test_channel_enum_values() -> None:
    assert ReservationChannel.airbnb.value == "airbnb"


# --- Service: Dashboard ---

def _dashboard_db(reservations: list[dict], properties: list[dict]) -> MagicMock:
    """Mockt die im dashboard() benutzten Ketten (reservations + properties)."""
    db = MagicMock(name="supabase")

    def table(name: str) -> MagicMock:
        t = MagicMock(name=f"table:{name}")
        if name == "reservations":
            chain = t.select.return_value.eq.return_value
            chain.execute.return_value.data = reservations
        elif name == "properties":
            chain = t.select.return_value.eq.return_value.in_.return_value
            chain.execute.return_value.data = properties
        return t

    db.table.side_effect = table
    return ReservationsService(service_client=db)


def test_dashboard_buckets_and_kpis() -> None:
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        # heutiger Check-out
        {"id": "r1", "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=3)), "check_out": iso(today),
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
        # heutiger Check-in
        {"id": "r2", "property_id": "p1", "channel": "airbnb", "status": "confirmed",
         "check_in": iso(today), "check_out": iso(today + timedelta(days=2)),
         "total_amount": 200, "guests": {"name": "Bea"}},
        # anstehend
        {"id": "r3", "property_id": "p2", "channel": "direct", "status": "pending",
         "check_in": iso(today + timedelta(days=5)), "check_out": iso(today + timedelta(days=7)),
         "total_amount": 150, "guests": {"name": "Cem"}},
        # storniert → fällt überall raus
        {"id": "r4", "property_id": "p1", "channel": "booking", "status": "cancelled",
         "check_in": iso(today), "check_out": iso(today + timedelta(days=1)),
         "total_amount": 999, "guests": {"name": "X"}},
    ]
    properties = [
        {"id": "p1", "title": "Strandhaus", "currency": "EUR"},
        {"id": "p2", "title": "City Loft", "currency": "EUR"},
    ]
    svc = _dashboard_db(reservations, properties)
    out = svc.dashboard(AuthContext(user_id="u1", tenant_id="t1"))

    assert [e.reservation_id for e in out.checkouts_today] == ["r1"]
    assert [e.reservation_id for e in out.checkins_today] == ["r2"]
    assert [e.reservation_id for e in out.upcoming] == ["r3"]
    assert out.checkouts_today[0].property_title == "Strandhaus"
    # 3 aktive Check-ins in den letzten 30 Tagen (r1,r2 liegen drin; r3 in Zukunft)
    assert out.checkins_30d.value == 2
    assert out.revenue_30d.value == 500  # r1+r2; storno raus, zukünftiges raus
    assert out.confirmed_30d.value == 2
    # keine Vorperiode → ehrlich None statt erfundener 0 %
    assert out.checkins_30d.change_pct is None
    assert out.currency == "EUR"
