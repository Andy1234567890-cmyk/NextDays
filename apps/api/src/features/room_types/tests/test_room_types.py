"""Tests für den room_types-Slice (Zimmerkategorien-CRUD + Scope + Validierung)."""
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.room_types.schemas import RoomTypeCreate, RoomTypeUpdate
from src.features.room_types.service import RoomTypeError, RoomTypesService
from src.main import create_app

client = TestClient(create_app())


def test_room_types_health() -> None:
    resp = client.get("/api/v1/room-types/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "room_types", "status": "ok"}


# --- Schema-Validierung (Channex-Regeln) ---

def test_create_rejects_default_occupancy_above_adults() -> None:
    with pytest.raises(ValidationError):
        RoomTypeCreate(
            property_id="p-1",
            title="Twin",
            count_of_rooms=5,
            occ_adults=2,
            default_occupancy=3,  # > occ_adults
        )


def test_create_rejects_zero_rooms() -> None:
    with pytest.raises(ValidationError):
        RoomTypeCreate(
            property_id="p-1", title="Twin", count_of_rooms=0,
            occ_adults=2, default_occupancy=2,
        )


def test_create_rejects_empty_title() -> None:
    with pytest.raises(ValidationError):
        RoomTypeCreate(
            property_id="p-1", title="", count_of_rooms=1,
            occ_adults=2, default_occupancy=2,
        )


def test_create_accepts_valid() -> None:
    rt = RoomTypeCreate(
        property_id="p-1", title="Double Room", count_of_rooms=5,
        occ_adults=2, occ_children=1, occ_infants=1, default_occupancy=2,
    )
    assert rt.default_occupancy == 2
    assert rt.occ_children == 1


def test_update_partial_ok() -> None:
    patch = RoomTypeUpdate(count_of_rooms=8)
    assert patch.count_of_rooms == 8
    assert patch.title is None


# --- Scope (Wurzel 3): ohne Tenant kein Zugriff ---

def _ctx(tenant: str | None = "t-1") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="admin")


def test_list_without_tenant_raises() -> None:
    svc = RoomTypesService(service_client=object())  # DB nie erreicht
    with pytest.raises(RoomTypeError) as exc:
        svc.list(_ctx(tenant=None), "p-1")
    assert exc.value.status_code == 400


def test_service_without_db_raises() -> None:
    svc = RoomTypesService(service_client=None)
    with pytest.raises(RoomTypeError) as exc:
        svc._db()
    assert exc.value.status_code == 500
