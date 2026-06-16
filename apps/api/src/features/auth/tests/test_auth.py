"""Tests für den auth-Slice.

Unit/Contract (immer): Health, Schema-Validierung, require_role, register-Rollback.
Integration (Marker): echter register->login->me-Durchlauf gegen Supabase.
"""
import os
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission, require_role
from src.features.auth.permissions import (
    Capability,
    capabilities_for,
    has_capability,
)
from src.features.auth.schemas import InviteRequest, RegisterRequest, UserRole
from src.features.auth.service import AuthError, AuthService
from src.main import create_app

client = TestClient(create_app())


# --- Health (Smoke) ---

def test_auth_health() -> None:
    resp = client.get("/api/v1/auth/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "auth", "status": "ok"}


# --- Schema-Validierung ---

def test_register_request_rejects_short_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="a@b.de",
            password="short",
            full_name="A",
            tenant_name="T",
            country="DE",
            currency="EUR",
        )


def test_register_request_rejects_bad_country_length() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="a@b.de",
            password="longenough",
            full_name="A",
            tenant_name="T",
            country="DEU",  # 3 statt 2
            currency="EUR",
        )


# --- require_role ---

def test_require_role_allows_matching_role() -> None:
    guard = require_role(UserRole.owner)
    ctx = AuthContext(user_id="u1", tenant_id="t1", role="owner")
    assert guard(ctx) is ctx


def test_require_role_blocks_other_role() -> None:
    guard = require_role(UserRole.owner)
    ctx = AuthContext(user_id="u1", tenant_id="t1", role="cleaner")
    with pytest.raises(HTTPException) as exc:
        guard(ctx)
    assert exc.value.status_code == 403


# --- Berechtigungs-Matrix (Lastenheft §4) ---

def test_admin_has_all_capabilities() -> None:
    caps = capabilities_for(UserRole.admin)
    assert set(caps) == set(Capability)


def test_owner_data_split_no_finances() -> None:
    # Eigentümer sieht nur Vorname (limited), KEINE Finanzen, KEINEN vollen Gast.
    assert has_capability(UserRole.owner, Capability.VIEW_GUEST_LIMITED)
    assert not has_capability(UserRole.owner, Capability.VIEW_GUEST_FULL)
    assert not has_capability(UserRole.owner, Capability.VIEW_FINANCES)


def test_owner_can_only_request_not_approve_block() -> None:
    assert has_capability(UserRole.owner, Capability.REQUEST_BLOCK)
    assert not has_capability(UserRole.owner, Capability.APPROVE_BLOCK)
    assert has_capability(UserRole.co_admin, Capability.APPROVE_BLOCK)


def test_staff_no_finances_no_full_guest() -> None:
    for cap in (Capability.VIEW_FINANCES, Capability.VIEW_GUEST_FULL,
                Capability.VIEW_OWNER_REPORTS):
        assert not has_capability(UserRole.staff, cap)
    assert has_capability(UserRole.staff, Capability.VIEW_OWN_TASKS)


def test_cleaner_matches_staff() -> None:
    assert capabilities_for(UserRole.cleaner) == capabilities_for(UserRole.staff)


def test_unknown_role_has_no_capabilities() -> None:
    assert capabilities_for(None) == frozenset()
    assert capabilities_for("nonsense") == frozenset()


def test_require_permission_blocks_without_capability() -> None:
    guard = require_permission(Capability.VIEW_FINANCES)
    ctx = AuthContext(user_id="u1", tenant_id="t1", role="staff")
    with pytest.raises(HTTPException) as exc:
        guard(ctx)
    assert exc.value.status_code == 403


def test_require_permission_allows_with_capability() -> None:
    guard = require_permission(Capability.VIEW_FINANCES)
    ctx = AuthContext(user_id="u1", tenant_id="t1", role="admin")
    assert guard(ctx) is ctx


# --- register-Rollback ---

def _service_with_mocks() -> tuple[AuthService, MagicMock, MagicMock]:
    anon = MagicMock(name="anon")
    service = MagicMock(name="service")
    # Tenant-Insert liefert eine ID.
    service.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "tenant-123"}
    ]
    return AuthService(anon_client=anon, service_client=service), anon, service


def _valid_register() -> RegisterRequest:
    return RegisterRequest(
        email="owner@example.de",
        password="longenough",
        full_name="Owner",
        tenant_name="Acme",
        country="DE",
        currency="EUR",
    )


def test_register_rolls_back_tenant_when_user_creation_fails() -> None:
    svc, _anon, service = _service_with_mocks()
    # create_user wirft -> Tenant muss gelöscht werden.
    service.auth.admin.create_user.side_effect = RuntimeError("email taken")

    with pytest.raises(AuthError):
        svc.register(_valid_register())

    service.table.assert_any_call("tenants")
    service.table.return_value.delete.return_value.eq.assert_called_with(
        "id", "tenant-123"
    )


def test_register_rolls_back_user_and_tenant_when_user_row_fails() -> None:
    svc, _anon, service = _service_with_mocks()
    created = MagicMock()
    created.user.id = "user-456"
    service.auth.admin.create_user.return_value = created
    # users-Insert wirft -> User UND Tenant zurückrollen.
    service.table.return_value.insert.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "tenant-123"}]),  # tenants-Insert ok
        RuntimeError("users insert failed"),      # users-Insert fehlschlag
    ]

    with pytest.raises(RuntimeError):
        svc.register(_valid_register())

    service.auth.admin.delete_user.assert_called_with("user-456")


# --- invite (Mitarbeiter/weitere Rollen) ---

def _invite(role: UserRole) -> InviteRequest:
    return InviteRequest(
        email="staff@example.de",
        password="longenough",
        full_name="Mitarbeiter",
        role=role,
    )


def test_invite_creates_user_with_role_in_existing_tenant() -> None:
    svc, _anon, service = _service_with_mocks()
    created = MagicMock()
    created.user.id = "user-789"
    service.auth.admin.create_user.return_value = created

    res = svc.invite(_invite(UserRole.staff), tenant_id="tenant-abc")

    assert res.user_id == "user-789"
    assert res.role == UserRole.staff
    assert res.tenant_id == "tenant-abc"
    # app_metadata enthält tenant + rolle des Eingeladenen
    meta = service.auth.admin.create_user.call_args.args[0]["app_metadata"]
    assert meta == {"tenant_id": "tenant-abc", "role": "staff"}


def test_invite_rejects_admin_role() -> None:
    # Admin entsteht nur bei register; per invite ablehnen.
    svc, _anon, _service = _service_with_mocks()
    with pytest.raises(AuthError) as exc:
        svc.invite(_invite(UserRole.admin), tenant_id="tenant-abc")
    assert exc.value.status_code == 400


def test_invite_allows_owner_role() -> None:
    # Hauseigentümer (owner) wird per invite angelegt (Daten-Split-Rolle).
    svc, _anon, service = _service_with_mocks()
    created = MagicMock()
    created.user.id = "user-owner"
    service.auth.admin.create_user.return_value = created
    res = svc.invite(_invite(UserRole.owner), tenant_id="tenant-abc")
    assert res.role == UserRole.owner


def test_invite_rolls_back_auth_user_when_row_fails() -> None:
    svc, _anon, service = _service_with_mocks()
    created = MagicMock()
    created.user.id = "user-789"
    service.auth.admin.create_user.return_value = created
    service.table.return_value.insert.return_value.execute.side_effect = RuntimeError(
        "users insert failed"
    )
    with pytest.raises(RuntimeError):
        svc.invite(_invite(UserRole.cleaner), tenant_id="tenant-abc")
    service.auth.admin.delete_user.assert_called_with("user-789")


# --- Integration (nur mit laufendem Supabase-Stack) ---

@pytest.mark.integration
def test_register_login_me_roundtrip() -> None:
    email = f"it-{os.getpid()}@example.de"
    body = {
        "email": email,
        "password": "supersecret123",
        "full_name": "IT Owner",
        "tenant_name": "IT Tenant",
        "country": "DE",
        "currency": "EUR",
    }
    reg = client.post("/api/v1/auth/register", json=body)
    assert reg.status_code == 201, reg.text
    token = reg.json()["access_token"]

    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200, me.text
    data = me.json()
    assert data["role"] == "admin"  # Tenant-Gründer = admin
    assert data["tenant_id"]
