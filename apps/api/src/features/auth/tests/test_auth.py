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
from src.features.auth.dependencies import require_role
from src.features.auth.schemas import RegisterRequest, UserRole
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
    assert data["role"] == "owner"
    assert data["tenant_id"]
