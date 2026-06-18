"""Tests für den reservations-Slice (Anlegen + Double-Booking-Schutz)."""
from datetime import date
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
                [{"id": "p1", "currency": "EUR"}] if property_found else []
            )
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
