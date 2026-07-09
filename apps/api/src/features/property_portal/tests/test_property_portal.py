"""Tests für den property_portal-Slice (Gastmodul je Objekt)."""
from types import SimpleNamespace

import pytest

from src.core.security import AuthContext
from src.features.property_portal.schemas import GuestPortalSettings
from src.features.property_portal.service import (
    PropertyPortalError,
    PropertyPortalService,
)

CTX = AuthContext(user_id="u1", tenant_id="t1")
PID = "11111111-1111-4111-8111-111111111111"


class _Chain:
    def __init__(self, data: object) -> None:
        self._data = data

    def __getattr__(self, _name: str) -> "_Chain":
        return self

    def __call__(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._data)


class _DB:
    def __init__(self, tables: dict[str, object]) -> None:
        self._tables = tables

    def table(self, name: str) -> _Chain:
        return _Chain(self._tables.get(name, []))


def _svc(portal_rows: object, *, owns: bool = True) -> PropertyPortalService:
    tables = {
        "properties": [{"id": PID}] if owns else [],
        "property_guest_portal": portal_rows,
    }
    return PropertyPortalService(client=_DB(tables))  # type: ignore[arg-type]


def test_get_defaults_when_no_row() -> None:
    svc = _svc([])
    out = svc.get(CTX, PID, can_see_code=True)
    assert out.enabled is False
    assert out.door_code is None


def test_get_returns_code_with_permission() -> None:
    svc = _svc([{"enabled": True, "door_code": "9999", "self_checkin": True}])
    out = svc.get(CTX, PID, can_see_code=True)
    assert out.door_code == "9999"
    assert out.enabled is True
    assert out.self_checkin is True


def test_get_masks_code_without_permission() -> None:
    svc = _svc([{"enabled": True, "door_code": "9999"}])
    out = svc.get(CTX, PID, can_see_code=False)
    # Türcode maskiert (kein Leak an Nur-Leser), Rest sichtbar.
    assert out.door_code is None
    assert out.enabled is True


def test_get_foreign_property_404() -> None:
    svc = _svc([], owns=False)
    with pytest.raises(PropertyPortalError) as exc:
        svc.get(CTX, PID, can_see_code=True)
    assert exc.value.status_code == 404


def test_non_uuid_property_404() -> None:
    svc = _svc([])
    with pytest.raises(PropertyPortalError) as exc:
        svc.get(CTX, "einstellungen", can_see_code=True)
    assert exc.value.status_code == 404


def test_put_foreign_property_404() -> None:
    svc = _svc([], owns=False)
    with pytest.raises(PropertyPortalError) as exc:
        svc.put(CTX, PID, GuestPortalSettings(enabled=True))
    assert exc.value.status_code == 404
