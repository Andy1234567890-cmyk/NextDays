"""Tests für Konto- & TOTP-Service (Sicherheit-Seite).

Unit/Contract (immer): Schema-Validierung + TOTP-Enroll/Verify/Disable-Logik
mit gemocktem Supabase-Client (pyotp echt — deterministisch über das Secret).
"""
from unittest.mock import MagicMock

import pyotp
import pytest
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.auth.account_service import AccountService
from src.features.auth.schemas import (
    TotpDisableRequest,
    TotpVerifyRequest,
    UpdatePasswordRequest,
    UpdateProfileRequest,
)
from src.features.auth.service import AuthError


def _ctx() -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id="t-1", role="owner")


def _service_with_mfa(mfa_row: dict | None) -> tuple[AccountService, MagicMock]:
    """AccountService mit gemocktem service-Client; user_mfa liefert mfa_row."""
    service_client = MagicMock()

    # users-Row existiert (kein Provisioning nötig).
    users_select = MagicMock()
    users_select.execute.return_value = MagicMock(
        data=[{"id": "u-1", "tenant_id": "t-1", "role": "owner", "email": "a@b.de",
               "full_name": "A"}]
    )
    # user_mfa zustandsbehaftet: nach delete liefert ein erneutes select [].
    mfa_state = {"row": mfa_row}

    def mfa_select_execute() -> MagicMock:
        return MagicMock(data=[mfa_state["row"]] if mfa_state["row"] else [])

    def mfa_delete_execute() -> MagicMock:
        mfa_state["row"] = None
        return MagicMock()

    def table(name: str) -> MagicMock:
        tbl = MagicMock()
        chain = MagicMock()
        if name == "users":
            chain.eq.return_value.execute.return_value = users_select.execute.return_value
        else:
            chain.eq.return_value.execute.side_effect = mfa_select_execute
        tbl.select.return_value = chain
        tbl.update.return_value.eq.return_value.execute.return_value = MagicMock()
        if name == "user_mfa":
            tbl.delete.return_value.eq.return_value.execute.side_effect = mfa_delete_execute
        else:
            tbl.delete.return_value.eq.return_value.execute.return_value = MagicMock()
        tbl.upsert.return_value.execute.return_value = MagicMock()
        return tbl

    service_client.table.side_effect = table
    return AccountService(anon_client=MagicMock(), service_client=service_client), service_client


# --- Schema-Validierung ---

def test_password_request_rejects_short_new_password() -> None:
    with pytest.raises(ValidationError):
        UpdatePasswordRequest(new_password="short")


def test_totp_verify_request_rejects_too_short_code() -> None:
    with pytest.raises(ValidationError):
        TotpVerifyRequest(code="123")


def test_profile_update_only_sends_set_fields() -> None:
    # Nur explizit gesetzte Felder landen im Patch (exclude_unset).
    req = UpdateProfileRequest(phone="+4520304050", hide_phones=True)
    patch = req.model_dump(exclude_unset=True)
    assert patch == {"phone": "+4520304050", "hide_phones": True}


def test_profile_update_allows_clearing_via_null() -> None:
    # Explizit None gesendet → Feld wird geleert (im Patch enthalten).
    req = UpdateProfileRequest(website=None)
    patch = req.model_dump(exclude_unset=True)
    assert patch == {"website": None}


def test_profile_update_rejects_overlong_full_name() -> None:
    with pytest.raises(ValidationError):
        UpdateProfileRequest(full_name="x" * 201)


def test_profile_update_service_writes_patch_and_returns_account() -> None:
    # Stabiles users-Table-Mock, um den Update-Aufruf zu erfassen.
    service_client = MagicMock()
    users_tbl = MagicMock()
    users_tbl.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "u-1", "tenant_id": "t-1", "role": "owner",
               "email": "a@b.de", "full_name": "A"}]
    )
    service_client.table.return_value = users_tbl
    service = AccountService(anon_client=MagicMock(), service_client=service_client)

    result = service.update_profile(
        _ctx(),
        UpdateProfileRequest(phone="+4520304050", spoken_languages=["de", "en"]),
    )

    sent = users_tbl.update.call_args[0][0]
    assert sent == {"phone": "+4520304050", "spoken_languages": ["de", "en"]}
    assert result.user_id == "u-1"


# --- TOTP-Verify-Logik ---

def test_totp_verify_accepts_valid_code() -> None:
    secret = pyotp.random_base32()
    svc, _ = _service_with_mfa({"totp_secret": secret, "totp_enabled": False,
                                "recovery_codes": []})
    code = pyotp.TOTP(secret).now()
    res = svc.totp_verify(_ctx(), code)
    assert res.totp_enabled is True
    assert len(res.recovery_codes) == 8


def test_totp_verify_rejects_wrong_code() -> None:
    secret = pyotp.random_base32()
    svc, _ = _service_with_mfa({"totp_secret": secret, "totp_enabled": False,
                                "recovery_codes": []})
    with pytest.raises(AuthError) as exc:
        svc.totp_verify(_ctx(), "000000")
    assert exc.value.status_code == 401


def test_totp_verify_without_enrollment_fails() -> None:
    svc, _ = _service_with_mfa(None)
    with pytest.raises(AuthError) as exc:
        svc.totp_verify(_ctx(), "123456")
    assert exc.value.status_code == 400


def test_totp_disable_requires_valid_code() -> None:
    secret = pyotp.random_base32()
    svc, _ = _service_with_mfa({"totp_secret": secret, "totp_enabled": True,
                                "recovery_codes": []})
    with pytest.raises(AuthError) as exc:
        svc.totp_disable(_ctx(), TotpDisableRequest(code="000000"))
    assert exc.value.status_code == 401


def test_totp_disable_accepts_valid_code() -> None:
    secret = pyotp.random_base32()
    svc, client = _service_with_mfa({"totp_secret": secret, "totp_enabled": True,
                                     "recovery_codes": []})
    # get_account ruft get_user_by_id -> auth-Admin mocken
    client.auth.admin.get_user_by_id.return_value = MagicMock(
        user=MagicMock(email="a@b.de", identities=[], user_metadata={})
    )
    code = pyotp.TOTP(secret).now()
    res = svc.totp_disable(_ctx(), TotpDisableRequest(code=code))
    assert res.totp_enabled is False
