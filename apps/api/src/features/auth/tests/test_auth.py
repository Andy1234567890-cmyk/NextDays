"""Tests für den auth-Slice.

Unit/Contract (immer): Health, Schema-Validierung, require_role, register-Rollback.
Integration (Marker): echter register->login->me-Durchlauf gegen Supabase.
"""
from unittest.mock import MagicMock
from uuid import uuid4

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
from src.features.auth.schemas import (
    AccommodationTypeUpdate,
    InviteRequest,
    RefreshRequest,
    RegisterRequest,
    UserRole,
)
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


def test_register_request_rejects_unsupported_country() -> None:
    # 2 Zeichen, aber kein unterstütztes Land (EU27+CH/GB) → 422, kein Durchlass.
    for bad in ("zz", "!!", "BR"):
        with pytest.raises(ValidationError):
            RegisterRequest(
                email="a@b.de",
                password="longenough",
                full_name="A",
                tenant_name="T",
                country=bad,
                currency="EUR",
            )


def test_register_request_rejects_unsupported_currency() -> None:
    for bad in ("FOO", "BRL", "xxx"):
        with pytest.raises(ValidationError):
            RegisterRequest(
                email="a@b.de",
                password="longenough",
                full_name="A",
                tenant_name="T",
                country="DE",
                currency=bad,
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


# --- Lastenheft §4: explizite Anforderungen pro Rolle ---

def test_co_admin_receives_alerts_and_assigns_staff() -> None:
    # §4.1: Co-Admin erhält System-Warnungen und kann Mitarbeiter zuweisen.
    assert has_capability(UserRole.co_admin, Capability.RECEIVE_SYSTEM_ALERTS)
    assert has_capability(UserRole.co_admin, Capability.ASSIGN_STAFF_TO_PROPERTY)


def test_owner_manages_notification_prefs() -> None:
    # §4.2: Eigentümer hat selbstverwaltetes Benachrichtigungsmenü.
    assert has_capability(UserRole.owner, Capability.MANAGE_NOTIFICATION_PREFS)
    # aber weiterhin KEINE Mitarbeiter-Zuweisung/System-Alerts.
    assert not has_capability(UserRole.owner, Capability.ASSIGN_STAFF_TO_PROPERTY)


def test_staff_availability_and_substitute() -> None:
    # §4.3: Mitarbeiter verwaltet eigene Verfügbarkeiten + Vertretung anfragen.
    assert has_capability(UserRole.staff, Capability.MANAGE_OWN_AVAILABILITY)
    assert has_capability(UserRole.staff, Capability.REQUEST_SUBSTITUTE)


def test_admin_still_has_everything() -> None:
    # admin muss auch nach Erweiterung der Matrix ALLE Capabilities haben.
    assert set(capabilities_for(UserRole.admin)) == set(Capability)


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

def _invite(role: UserRole, permissions: list[str] | None = None) -> InviteRequest:
    return InviteRequest(
        email="staff@example.de",
        password="longenough",
        full_name="Mitarbeiter",
        role=role,
        permissions=permissions,
    )


def _mock_granter(service: MagicMock, row: dict) -> None:
    """Granter-Row (der Einladende) für _effective_perms_of mocken."""
    chain = service.table.return_value.select.return_value.eq.return_value
    chain.limit.return_value.execute.return_value.data = [row]


def _grant_admin(service: MagicMock) -> None:
    """Einladender als Admin → alle Rechte, klemmt nichts weg."""
    _mock_granter(service, {"role": "admin", "permissions": []})


def test_invite_creates_user_with_role_in_existing_tenant() -> None:
    svc, _anon, service = _service_with_mocks()
    _grant_admin(service)
    created = MagicMock()
    created.user.id = "user-789"
    service.auth.admin.create_user.return_value = created

    res = svc.invite(_invite(UserRole.staff), tenant_id="tenant-abc", granter_id="admin-1")

    assert res.user_id == "user-789"
    assert res.role == UserRole.staff
    assert res.tenant_id == "tenant-abc"
    # Staff-Defaults durch (Admin-Granter klemmt nichts weg).
    assert "access_pm_features" in res.permissions
    # app_metadata enthält tenant + rolle des Eingeladenen
    meta = service.auth.admin.create_user.call_args.args[0]["app_metadata"]
    assert meta == {"tenant_id": "tenant-abc", "role": "staff"}


def test_invite_clamps_permissions_to_granter_rights() -> None:
    # Ein Co-Admin OHNE ein bestimmtes Recht kann es nicht weitergeben (Wurzel 3).
    svc, _anon, service = _service_with_mocks()
    _mock_granter(
        service,
        {"role": "co_admin", "permissions": ["pm_chat", "access_pm_features"]},
    )
    created = MagicMock()
    created.user.id = "user-clamp"
    service.auth.admin.create_user.return_value = created
    res = svc.invite(
        _invite(UserRole.staff, permissions=["pm_chat", "inbox_manage_config"]),
        tenant_id="tenant-abc",
        granter_id="coadmin-1",
    )
    # inbox_manage_config besitzt der Granter nicht → weggeklemmt; pm_chat bleibt.
    assert res.permissions == ["pm_chat"]


def test_invite_rejects_admin_role() -> None:
    # Admin entsteht nur bei register; per invite ablehnen.
    svc, _anon, _service = _service_with_mocks()
    with pytest.raises(AuthError) as exc:
        svc.invite(_invite(UserRole.admin), tenant_id="tenant-abc", granter_id="admin-1")
    assert exc.value.status_code == 400


def test_invite_allows_owner_role() -> None:
    # Hauseigentümer (owner) wird per invite angelegt (Daten-Split-Rolle).
    svc, _anon, service = _service_with_mocks()
    _grant_admin(service)
    created = MagicMock()
    created.user.id = "user-owner"
    service.auth.admin.create_user.return_value = created
    res = svc.invite(_invite(UserRole.owner), tenant_id="tenant-abc", granter_id="admin-1")
    assert res.role == UserRole.owner


def test_invite_rolls_back_auth_user_when_row_fails() -> None:
    svc, _anon, service = _service_with_mocks()
    _grant_admin(service)
    created = MagicMock()
    created.user.id = "user-789"
    service.auth.admin.create_user.return_value = created
    service.table.return_value.insert.return_value.execute.side_effect = RuntimeError(
        "users insert failed"
    )
    with pytest.raises(RuntimeError):
        svc.invite(_invite(UserRole.cleaner), tenant_id="tenant-abc", granter_id="admin-1")
    service.auth.admin.delete_user.assert_called_with("user-789")


# --- Integration (nur mit laufendem Supabase-Stack) ---

def _cleanup_tenant(tenant_id: str) -> None:
    """Räumt einen im Test registrierten Tenant restlos ab (Gegenzustand,
    Wurzel 1): Channex-Gruppe löschen (sonst Waise), dann Auth-User + Tenant.

    Direkt über den Service-Client/Channex-Client, NICHT über die API — das
    vermeidet den geteilten 10/60-Auth-Bucket (sonst 429). Best-effort: jeder
    Schritt wird einzeln versucht, damit ein Fehler die anderen nicht blockiert.
    """
    import contextlib

    from src.core.supabase import get_service_client
    from src.features.channel_manager.channex_client import ChannexClient

    svc = get_service_client()
    # Channex-Gruppe zuerst (idempotent, 404 = ok) — Mapping liefert die Group-ID.
    grp = (
        svc.table("channex_group_map")
        .select("channex_group_id")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if grp.data:
        with contextlib.suppress(Exception):  # Test-Teardown, best effort
            ChannexClient().delete_group(grp.data[0]["channex_group_id"])
    # Auth-User des Tenants entfernen.
    with contextlib.suppress(Exception):  # Test-Teardown, best effort
        users = svc.auth.admin.list_users()
        for user in users:
            meta = getattr(user, "app_metadata", None) or {}
            if meta.get("tenant_id") == tenant_id:
                svc.auth.admin.delete_user(user.id)
    # Tenant löschen (channex_group_map + users kaskadieren).
    with contextlib.suppress(Exception):  # Test-Teardown, best effort
        svc.table("tenants").delete().eq("id", tenant_id).execute()


@pytest.mark.integration
def test_register_login_me_roundtrip() -> None:
    marker = uuid4().hex[:8]
    email = f"it-{marker}@example.de"
    body = {
        "email": email,
        "password": "supersecret123",
        "full_name": "IT Owner",
        "tenant_name": f"IT-Test {marker}",
        "country": "DE",
        "currency": "EUR",
    }
    reg = client.post("/api/v1/auth/register", json=body)
    assert reg.status_code == 201, reg.text
    token = reg.json()["access_token"]

    tenant_id = None
    try:
        me = client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
        assert me.status_code == 200, me.text
        data = me.json()
        assert data["role"] == "admin"  # Tenant-Gründer = admin
        assert data["tenant_id"]
        tenant_id = data["tenant_id"]
    finally:
        if tenant_id:
            _cleanup_tenant(tenant_id)


@pytest.mark.integration
def test_login_totp_end_to_end() -> None:
    """Voller 2FA-Login-Flow gegen echtes Supabase: 2FA aktivieren, dann
    Login-Schritt 1 (Passwort → mfa_required) + Schritt 2 (TOTP → Session).

    Prüft insbesondere _session_for_verified_user (Magiclink-Session-Trick) —
    der einzige Weg zu beweisen, dass der zweite Login-Schritt echt eine
    nutzbare Session liefert, statt es nur zu behaupten."""
    import pyotp

    marker = uuid4().hex[:8]
    email = f"it-2fa-{marker}@example.de"
    password = "supersecret123"  # noqa: S105 — Test-Passwort
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "IT 2FA",
            "tenant_name": f"IT-Test {marker}",
            "country": "DE",
            "currency": "EUR",
        },
    )
    assert reg.status_code == 201, reg.text
    token = reg.json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    tenant_id = None
    try:
        me0 = client.get("/api/v1/auth/me", headers=auth)
        assert me0.status_code == 200, me0.text
        tenant_id = me0.json()["tenant_id"]

        # 2FA aktivieren (enroll → verify mit echtem Code).
        enroll = client.post("/api/v1/auth/totp/enroll", headers=auth)
        assert enroll.status_code == 200, enroll.text
        secret = enroll.json()["secret"]
        verify = client.post(
            "/api/v1/auth/totp/verify",
            headers=auth,
            json={"code": pyotp.TOTP(secret).now()},
        )
        assert verify.status_code == 200, verify.text

        # Login-Schritt 1: Passwort → KEINE Session, nur mfa_required + mfa_token.
        step1 = client.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )
        assert step1.status_code == 200, step1.text
        body1 = step1.json()
        assert body1["mfa_required"] is True
        assert body1["session"] is None  # fail-closed: noch keine Session
        assert body1["mfa_token"]

        # Falscher Code → 401, weiterhin keine Session.
        bad = client.post(
            "/api/v1/auth/login/totp",
            json={"mfa_token": body1["mfa_token"], "code": "000000"},
        )
        assert bad.status_code == 401, bad.text

        # Login-Schritt 2: richtiger TOTP-Code → echte, nutzbare Session.
        step2 = client.post(
            "/api/v1/auth/login/totp",
            json={"mfa_token": body1["mfa_token"], "code": pyotp.TOTP(secret).now()},
        )
        assert step2.status_code == 200, step2.text
        session = step2.json()["session"]
        assert session and session["access_token"]

        # Die Session muss echt funktionieren (nicht nur „vorhanden").
        me = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {session['access_token']}"},
        )
        assert me.status_code == 200, me.text
        assert me.json()["role"] == "admin"

        # Der mfa_token darf KEIN Access-Token sein (fail-closed): API lehnt ihn ab.
        reject = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {body1['mfa_token']}"},
        )
        assert reject.status_code == 401, reject.text
    finally:
        if tenant_id:
            _cleanup_tenant(tenant_id)


# --- Betriebsart (accommodation_type, 0090) ---

def test_accommodation_type_update_rejects_unknown_value() -> None:
    with pytest.raises(ValidationError):
        AccommodationTypeUpdate(accommodation_type="hostel")


def test_set_accommodation_type_requires_tenant() -> None:
    svc, _anon, _service = _service_with_mocks()
    ctx = AuthContext(user_id="u1", tenant_id=None, role="admin")
    with pytest.raises(AuthError):
        svc.set_accommodation_type(ctx, "hotel")


def test_set_accommodation_type_scopes_update_to_own_tenant() -> None:
    svc, _anon, service = _service_with_mocks()
    ctx = AuthContext(user_id="u1", tenant_id="t1", role="admin")
    table = service.table.return_value
    table.update.return_value.eq.return_value.execute.return_value.data = [
        {"id": "t1"}
    ]
    # me()-Folge-Reads (users + tenants).
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {
            "role": "admin",
            "permissions": None,
            "email": "a@b.de",
            "accommodation_type": "hotel",
        }
    ]

    res = svc.set_accommodation_type(ctx, "hotel")

    service.table.assert_any_call("tenants")
    table.update.assert_called_with({"accommodation_type": "hotel"})
    table.update.return_value.eq.assert_called_with("id", "t1")
    assert res.accommodation_type == "hotel"


def test_set_accommodation_type_404_when_tenant_missing() -> None:
    svc, _anon, service = _service_with_mocks()
    ctx = AuthContext(user_id="u1", tenant_id="t1", role="admin")
    service.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []
    with pytest.raises(AuthError):
        svc.set_accommodation_type(ctx, "vacation_rental")


# --- Token-Refresh (P1: Silent-Refresh für Mobile) ---

def test_refresh_request_rejects_missing_token() -> None:
    with pytest.raises(ValidationError):
        RefreshRequest()  # type: ignore[call-arg]


def test_refresh_returns_fresh_session_on_success() -> None:
    svc, anon, _service = _service_with_mocks()
    session = MagicMock()
    session.access_token = "new-access"
    session.refresh_token = "new-refresh"
    session.expires_in = 3600
    anon.auth.refresh_session.return_value = MagicMock(session=session)

    res = svc.refresh(RefreshRequest(refresh_token="old-refresh"))

    anon.auth.refresh_session.assert_called_once_with("old-refresh")
    assert res.access_token == "new-access"
    assert res.refresh_token == "new-refresh"
    assert res.expires_in == 3600


def test_refresh_maps_gotrue_error_to_401() -> None:
    from supabase_auth.errors import AuthApiError

    svc, anon, _service = _service_with_mocks()
    anon.auth.refresh_session.side_effect = AuthApiError(
        "invalid refresh token", 400, "invalid_grant"
    )

    with pytest.raises(AuthError) as exc:
        svc.refresh(RefreshRequest(refresh_token="revoked"))
    assert exc.value.status_code == 401


def test_refresh_401_when_session_missing() -> None:
    svc, anon, _service = _service_with_mocks()
    anon.auth.refresh_session.return_value = MagicMock(session=None)

    with pytest.raises(AuthError) as exc:
        svc.refresh(RefreshRequest(refresh_token="x"))
    assert exc.value.status_code == 401


# Hinweis: Route-Level-Tests für /auth/refresh laufen bewusst NICHT hier — echte
# TestClient-Requests gegen /api/v1/auth/* teilen den Auth-Rate-Limit-Bucket
# (10/60/IP) und würden nachfolgende Auth-Tests (z. B. register_login_me) ins
# Limit treiben. Das 401-Mapping ist über die Service-Unit-Tests oben
# deterministisch abgedeckt; die Schema-Validierung über
# test_refresh_request_rejects_missing_token.
