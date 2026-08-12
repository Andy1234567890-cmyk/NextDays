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


def test_get_returns_wifi_with_permission() -> None:
    """WLAN-Zugang kommt durch. Die Spalten gab es seit 0296, aber kein Feld im
    Schema — `{{wifi_ssid}}`/`{{wifi_password}}` konnten deshalb nie gefüllt
    werden und ließen jede Anreise-Automail an „Feld ohne Wert" scheitern."""
    svc = _svc([{"wifi_ssid": "Bastlund_24GHz", "wifi_password": "QIvervej13"}])
    out = svc.get(CTX, PID, can_see_code=True)
    assert out.wifi_ssid == "Bastlund_24GHz"
    assert out.wifi_password == "QIvervej13"


def test_get_masks_wifi_password_without_permission() -> None:
    """Das WLAN-Passwort ist ein Geheimnis wie der Türcode (0314) — der Netzname
    bleibt sichtbar, das Passwort nicht."""
    svc = _svc([{"wifi_ssid": "Netz", "wifi_password": "geheim"}])
    out = svc.get(CTX, PID, can_see_code=False)
    assert out.wifi_ssid == "Netz"
    assert out.wifi_password is None


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


# --- Rollen-Scope: §4.2 owner / §4.3 staff ---------------------------------
#
# Angriff: Das Lesen hängt an VIEW_CALENDAR, das auch die owner-Rolle besitzt.
# Ein Eigentümer konnte damit die Gastmodul-Einstellungen (Kontakt,
# Notfall-Telefon, Selbst-Check-in, Sichtbarkeitsregeln des Türcodes) eines
# FREMDEN Objekts desselben Betriebs abrufen — der Tenant-Filter trennt nur
# Betriebe, nicht die Rollen darin.

OTHER_PID = "99999999-9999-4999-8999-999999999999"


def _scoped_portal_svc(role: str, assigned: list[str]) -> PropertyPortalService:
    return PropertyPortalService(  # type: ignore[arg-type]
        client=_DB(
            {
                "properties": [{"id": PID}],
                "property_guest_portal": [
                    {"enabled": True, "door_code": "1234", "contact_phone": "+45"}
                ],
                "owner_property_assignments": [
                    {"property_id": p, "tenant_id": "t1", "user_id": "u1"}
                    for p in assigned
                ],
                "staff_property_assignments": [
                    {"property_id": p, "tenant_id": "t1", "user_id": "u1"}
                    for p in assigned
                ],
            }
        )
    )


def _ctx(role: str) -> AuthContext:
    return AuthContext(user_id="u1", tenant_id="t1", role=role)


def test_owner_foreign_property_guest_portal_is_404() -> None:
    svc = _scoped_portal_svc("owner", assigned=[OTHER_PID])
    with pytest.raises(PropertyPortalError) as exc:
        svc.get(_ctx("owner"), PID, can_see_code=False)
    assert exc.value.status_code == 404


def test_owner_without_assignment_is_404() -> None:
    """Fail-closed: leere Zuordnung sieht nichts."""
    svc = _scoped_portal_svc("owner", assigned=[])
    with pytest.raises(PropertyPortalError) as exc:
        svc.get(_ctx("owner"), PID, can_see_code=False)
    assert exc.value.status_code == 404


def test_staff_foreign_property_is_404() -> None:
    svc = _scoped_portal_svc("cleaner", assigned=[OTHER_PID])
    with pytest.raises(PropertyPortalError) as exc:
        svc.get(_ctx("cleaner"), PID, can_see_code=False)
    assert exc.value.status_code == 404


def test_owner_own_property_passes_scope() -> None:
    """Gegenprobe: das zugeordnete Objekt bleibt lesbar."""
    svc = _scoped_portal_svc("owner", assigned=[PID])
    assert svc.get(_ctx("owner"), PID, can_see_code=False).enabled is True


def test_admin_not_restricted_by_assignments() -> None:
    svc = _scoped_portal_svc("admin", assigned=[])
    assert svc.get(_ctx("admin"), PID, can_see_code=True).door_code == "1234"


def test_put_also_scoped() -> None:
    """Der Schreibpfad läuft über denselben Guard."""
    svc = _scoped_portal_svc("owner", assigned=[OTHER_PID])
    with pytest.raises(PropertyPortalError) as exc:
        svc.put(_ctx("owner"), PID, GuestPortalSettings())
    assert exc.value.status_code == 404
