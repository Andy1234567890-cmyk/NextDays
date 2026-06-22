"""Tests für den properties-Slice.

Unit/Contract (immer): Health, Schema-Validierung, Service-CRUD mit gemocktem
Supabase-Client (tenant-Scope wird im Code erzwungen).
"""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.properties.schemas import (
    PropertyCreate,
    PropertyType,
    PropertyUpdate,
)
from src.features.properties.service import PropertiesService, PropertyError
from src.main import create_app

client = TestClient(create_app())


def _ctx(tenant: str | None = "t-1") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="owner")


def _row(**over: object) -> dict:
    base = {
        "id": "p-1",
        "tenant_id": "t-1",
        "title": "Villa",
        "description": None,
        "property_type": "ferienhaus",
        "status": "draft",
        "max_guests": 4,
        "street": None,
        "house_number": None,
        "postal_code": None,
        "city": None,
        "country": None,
        "lat": None,
        "lng": None,
        "amenities": [],
        "photos": [],
        "type_attributes": {},
        "created_at": "2026-06-17T00:00:00Z",
        "updated_at": "2026-06-17T00:00:00Z",
    }
    base.update(over)
    return base


def _svc(result_data: list[dict]) -> PropertiesService:
    db = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=result_data)
    # alle Builder-Methoden geben die Kette zurück
    for m in ("select", "eq", "order", "insert", "update", "delete"):
        getattr(chain, m).return_value = chain
    db.table.return_value = chain
    return PropertiesService(service_client=db)


# --- Health ---

def test_properties_health() -> None:
    resp = client.get("/api/v1/properties/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "properties", "status": "ok"}


# --- Schema-Validierung ---

def test_property_create_requires_title() -> None:
    with pytest.raises(ValidationError):
        PropertyCreate(title="")


def test_property_create_rejects_bad_guest_count() -> None:
    with pytest.raises(ValidationError):
        PropertyCreate(title="X", max_guests=0)


def test_property_update_is_all_optional() -> None:
    upd = PropertyUpdate()
    assert upd.model_dump(exclude_unset=True) == {}


# --- Service-CRUD ---

def test_create_sets_tenant_from_context() -> None:
    svc = _svc([_row()])
    res = svc.create(_ctx(), PropertyCreate(title="Villa", property_type=PropertyType.ferienhaus))
    assert res.tenant_id == "t-1"
    assert res.title == "Villa"


def test_create_without_tenant_fails() -> None:
    svc = _svc([_row()])
    with pytest.raises(PropertyError) as exc:
        svc.create(_ctx(tenant=None), PropertyCreate(title="Villa"))
    assert exc.value.status_code == 400


def test_get_missing_raises_404() -> None:
    svc = _svc([])
    with pytest.raises(PropertyError) as exc:
        svc.get(_ctx(), "p-x")
    assert exc.value.status_code == 404


def test_list_returns_items() -> None:
    svc = _svc([_row(), _row(id="p-2", title="Chalet")])
    res = svc.list(_ctx())
    assert res.total == 2
    assert {i.title for i in res.items} == {"Villa", "Chalet"}


# --- Bild-Upload ---

def test_upload_image_rejects_bad_mime() -> None:
    svc = _svc([_row()])  # Objekt existiert (get → ok)
    with pytest.raises(PropertyError) as exc:
        svc.upload_image(_ctx(), "p-1", b"data", "application/pdf")
    assert exc.value.status_code == 415


def test_upload_image_rejects_too_large() -> None:
    svc = _svc([_row()])
    big = b"x" * (PropertiesService.IMAGE_MAX_BYTES + 1)
    with pytest.raises(PropertyError) as exc:
        svc.upload_image(_ctx(), "p-1", big, "image/png")
    assert exc.value.status_code == 413


def test_upload_image_unknown_property_raises_404() -> None:
    svc = _svc([])  # get findet nichts
    with pytest.raises(PropertyError) as exc:
        svc.upload_image(_ctx(), "p-x", b"data", "image/png")
    assert exc.value.status_code == 404


def test_upload_image_returns_public_url() -> None:
    # DB-Mock mit Storage: get() liefert ein Objekt, Storage gibt Public-URL.
    db = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[_row()])
    for m in ("select", "eq", "order", "insert", "update", "delete"):
        getattr(chain, m).return_value = chain
    db.table.return_value = chain

    storage = MagicMock()
    storage.get_public_url.return_value = (
        "https://x.supabase.co/storage/v1/object/public/property-images/t-1/p-1/custom-map.png"
    )
    db.storage.from_.return_value = storage

    svc = PropertiesService(service_client=db)
    url = svc.upload_image(_ctx(), "p-1", b"img", "image/png", slot="custom-map")

    db.storage.from_.assert_called_once_with("property-images")
    # Pfad enthält tenant/property/slot, Upload wurde aufgerufen.
    assert storage.upload.called
    assert "custom-map.png" in storage.upload.call_args[0][0]
    assert url.startswith("https://x.supabase.co/")
    assert "?v=" in url  # Cache-Buster


# --- publish (draft→active): ohne Preis 422 ---------------------------------
class _PublishQuery:
    def __init__(self, db, name):  # noqa: ANN001
        self._db = db
        self._name = name

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def eq(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        class _R:
            pass

        r = _R()
        r.data = self._db.canned.get(self._name, [])
        return r


class _PublishDB:
    def __init__(self, canned):  # noqa: ANN001
        self.canned = canned

    def table(self, name):  # noqa: ANN001, ANN201
        return _PublishQuery(self, name)


def test_publish_without_rate_plan_is_422() -> None:
    # Property existiert, aber KEIN rate_plan → Veröffentlichen abgelehnt (kein Fallback).
    db = _PublishDB({"properties": [_row()], "rate_plans": []})
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.publish(_ctx(), "p-1")
    assert exc.value.status_code == 422


def test_publish_missing_property_404() -> None:
    db = _PublishDB({"properties": [], "rate_plans": []})
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.publish(_ctx(), "p-x")
    assert exc.value.status_code == 404
