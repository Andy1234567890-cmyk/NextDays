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


# --- update_managed_user: Rollen-/Rechte-Bearbeitung (Wurzel 3) -------------

def _svc_for_update(
    editor: dict, target: dict
) -> tuple[AccountService, dict]:
    """AccountService, dessen users-Table den Editor (per select '*') und den
    Ziel-Nutzer (per select+limit) liefert. Gibt den zuletzt geschriebenen
    update-patch in ``captured`` zurück."""
    service_client = MagicMock()
    captured: dict = {}

    def table(name: str) -> MagicMock:
        tbl = MagicMock()
        # _ensure_user_row: .select('*').eq(...).execute() -> Editor-Row
        tbl.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[editor]
        )
        # _own_managed_user: .select(cols).eq().eq().limit().execute() -> Target
        (
            tbl.select.return_value.eq.return_value.eq.return_value.limit
            .return_value.execute.return_value
        ) = MagicMock(data=[target])

        def do_update(patch: dict) -> MagicMock:
            captured.update(patch)
            upd = MagicMock()
            upd.eq.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{**target, **patch}]
            )
            return upd

        tbl.update.side_effect = do_update
        return tbl

    service_client.table.side_effect = table
    svc = AccountService(anon_client=MagicMock(), service_client=service_client)
    return svc, captured


def _admin_ctx() -> AuthContext:
    return AuthContext(user_id="admin-1", tenant_id="t-1", role="admin")


def test_update_managed_user_explicit_permissions_win_and_clamp() -> None:
    # Admin-Editor (alle Rechte) setzt explizite Rechte für einen staff-Nutzer.
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "staff", "permissions": ["access_pm_features"],
              "tenant_id": "t-1", "email": "s@x.de", "full_name": "S"}
    svc, captured = _svc_for_update(editor, target)
    svc.update_managed_user(
        _admin_ctx(), "u-2", permissions=["pm_chat", "pm_property_area"]
    )
    assert captured["permissions"] == ["pm_chat", "pm_property_area"]
    assert "role" not in captured  # Rolle unverändert


def test_update_managed_user_clamps_to_editor_rights() -> None:
    # Co-Admin-Editor ohne inbox_manage_config kann es nicht vergeben.
    editor = {"id": "ca-1", "role": "co_admin",
              "permissions": ["pm_chat", "access_pm_features"], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "staff", "permissions": [],
              "tenant_id": "t-1", "email": "s@x.de", "full_name": "S"}
    svc, captured = _svc_for_update(editor, target)
    ctx = AuthContext(user_id="ca-1", tenant_id="t-1", role="co_admin")
    svc.update_managed_user(ctx, "u-2", permissions=["pm_chat", "inbox_manage_config"])
    assert captured["permissions"] == ["pm_chat"]  # inbox_manage_config geklemmt


def test_update_managed_user_role_change_sets_defaults() -> None:
    # Rollenwechsel OHNE explizite Rechte -> Default-Rechte der neuen Rolle.
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "staff", "permissions": ["access_pm_features"],
              "tenant_id": "t-1", "email": "s@x.de", "full_name": "S"}
    svc, captured = _svc_for_update(editor, target)
    from src.features.auth.schemas import UserRole
    svc.update_managed_user(_admin_ctx(), "u-2", role=UserRole.owner)
    assert captured["role"] == "owner"
    assert "owner_reporting" in captured["permissions"]


def test_update_managed_user_cannot_demote_admin() -> None:
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "admin-1", "role": "admin", "permissions": [],
              "tenant_id": "t-1", "email": "a@x.de", "full_name": "A"}
    svc, _captured = _svc_for_update(editor, target)
    from src.features.auth.schemas import UserRole
    with pytest.raises(AuthError) as exc:
        svc.update_managed_user(_admin_ctx(), "admin-1", role=UserRole.staff)
    assert exc.value.status_code == 400


def test_update_managed_user_staff_editor_forbidden() -> None:
    # staff/cleaner dürfen die Nutzerverwaltung nicht schreiben (403).
    editor = {"id": "st-1", "role": "staff", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "cleaner", "permissions": [], "tenant_id": "t-1"}
    svc, _captured = _svc_for_update(editor, target)
    ctx = AuthContext(user_id="st-1", tenant_id="t-1", role="staff")
    with pytest.raises(AuthError) as exc:
        svc.update_managed_user(ctx, "u-2", full_name="X")
    assert exc.value.status_code == 403


# --- Kontaktfelder der Detailseite (0356) ---------------------------------


def test_update_managed_user_writes_contact_fields() -> None:
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "staff", "permissions": [], "tenant_id": "t-1",
              "email": "s@x.de", "full_name": "S"}
    svc, captured = _svc_for_update(editor, target)
    svc.update_managed_user(
        _admin_ctx(),
        "u-2",
        kontakt={
            "phone": " +4520304050 ",
            "hide_phones": True,
            "spoken_languages": ["Dänisch", "Englisch"],
            "notes": "Schlüssel liegt im Büro",
        },
    )
    assert captured["phone"] == "+4520304050"          # getrimmt
    assert captured["hide_phones"] is True
    assert captured["spoken_languages"] == ["Dänisch", "Englisch"]
    assert captured["notes"] == "Schlüssel liegt im Büro"
    assert "additional_phone" not in captured           # nicht gesendet = unverändert


def test_update_managed_user_empty_string_clears_field() -> None:
    # Leerstring heißt LÖSCHEN → NULL, damit eine falsche Nummer wieder weg kann.
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "staff", "permissions": [], "tenant_id": "t-1",
              "email": "s@x.de", "full_name": "S", "additional_phone": "+4511"}
    svc, captured = _svc_for_update(editor, target)
    svc.update_managed_user(_admin_ctx(), "u-2", kontakt={"additional_phone": ""})
    assert captured["additional_phone"] is None


def test_invite_request_limits_spoken_languages() -> None:
    from src.features.auth.schemas import InviteRequest
    with pytest.raises(ValidationError):
        InviteRequest(
            email="a@b.de", full_name="A", role="staff",
            spoken_languages=[f"S{i}" for i in range(41)],
        )


def test_invite_request_dedupes_and_trims_spoken_languages() -> None:
    from src.features.auth.schemas import InviteRequest
    req = InviteRequest(
        email="a@b.de", full_name="A", role="staff",
        spoken_languages=[" Dänisch ", "Dänisch", "", "Englisch"],
    )
    assert req.spoken_languages == ["Dänisch", "Englisch"]


# --- Deaktivieren / Aktivieren (0356) -------------------------------------


def _svc_for_status(
    editor: dict, target: dict, *, ban_ok: bool = True
) -> tuple[AccountService, dict, list]:
    """Wie _svc_for_update, plus Aufzeichnung der GoTrue-Admin-Aufrufe."""
    svc, captured = _svc_for_update(editor, target)
    calls: list = []

    def update_user_by_id(user_id: str, attrs: dict) -> MagicMock:
        calls.append((user_id, attrs))
        if not ban_ok:
            raise RuntimeError("GoTrue weg")
        return MagicMock()

    svc._service.auth.admin.update_user_by_id.side_effect = update_user_by_id
    return svc, captured, calls


def test_deactivate_sets_timestamp_and_bans_login() -> None:
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "staff", "permissions": [], "tenant_id": "t-1",
              "email": "s@x.de", "full_name": "S", "deactivated_at": None}
    svc, captured, calls = _svc_for_status(editor, target)
    nutzer, gesperrt = svc.deactivate_managed_user(_admin_ctx(), "u-2")
    assert captured["deactivated_at"]                       # Zeitstempel gesetzt
    assert captured["deactivated_by"] == "admin-1"
    assert calls == [("u-2", {"ban_duration": AccountService.LOGIN_SPERRE_DAUER})]
    assert gesperrt is True
    assert nutzer.is_active is False


def test_deactivate_reports_partial_success_when_gotrue_fails() -> None:
    # Feld steht, Bann nicht → login_gesperrt=False, KEIN stilles „done".
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "staff", "permissions": [], "tenant_id": "t-1",
              "email": "s@x.de", "full_name": "S", "deactivated_at": None}
    svc, captured, _calls = _svc_for_status(editor, target, ban_ok=False)
    _nutzer, gesperrt = svc.deactivate_managed_user(_admin_ctx(), "u-2")
    assert captured["deactivated_at"]
    assert gesperrt is False


def test_deactivate_is_idempotent() -> None:
    # Doppelklick/Retry: der erste Zeitstempel bleibt stehen (Wurzel 2).
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "staff", "permissions": [], "tenant_id": "t-1",
              "email": "s@x.de", "full_name": "S",
              "deactivated_at": "2026-08-01T10:00:00+00:00"}
    svc, captured, _calls = _svc_for_status(editor, target)
    nutzer, _gesperrt = svc.deactivate_managed_user(_admin_ctx(), "u-2")
    assert "deactivated_at" not in captured
    assert nutzer.deactivated_at == "2026-08-01T10:00:00+00:00"


def test_deactivate_refuses_own_login() -> None:
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    svc, _captured, _calls = _svc_for_status(editor, editor)
    with pytest.raises(AuthError) as exc:
        svc.deactivate_managed_user(_admin_ctx(), "admin-1")
    assert exc.value.status_code == 400


def test_deactivate_refuses_account_owner() -> None:
    editor = {"id": "ca-1", "role": "co_admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1",
              "email": "a@x.de", "full_name": "A", "deactivated_at": None}
    svc, _captured, _calls = _svc_for_status(editor, target)
    ctx = AuthContext(user_id="ca-1", tenant_id="t-1", role="co_admin")
    with pytest.raises(AuthError) as exc:
        svc.deactivate_managed_user(ctx, "admin-1")
    assert exc.value.status_code == 400


def test_activate_clears_timestamp_and_unbans() -> None:
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "staff", "permissions": [], "tenant_id": "t-1",
              "email": "s@x.de", "full_name": "S",
              "deactivated_at": "2026-08-01T10:00:00+00:00"}
    svc, captured, calls = _svc_for_status(editor, target)
    nutzer, entsperrt = svc.activate_managed_user(_admin_ctx(), "u-2")
    assert captured["deactivated_at"] is None
    assert captured["deactivated_by"] is None
    assert calls == [("u-2", {"ban_duration": "none"})]
    assert entsperrt is True
    assert nutzer.is_active is True


def test_activate_unbans_even_when_already_active() -> None:
    # Der Bann kann hängen, obwohl das Feld leer ist (Teilerfolg von vorher) —
    # dann muss Aktivieren ihn TROTZDEM lösen, sonst bleibt der Login zu.
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "staff", "permissions": [], "tenant_id": "t-1",
              "email": "s@x.de", "full_name": "S", "deactivated_at": None}
    svc, captured, calls = _svc_for_status(editor, target)
    _nutzer, entsperrt = svc.activate_managed_user(_admin_ctx(), "u-2")
    assert calls == [("u-2", {"ban_duration": "none"})]
    assert "deactivated_at" not in captured
    assert entsperrt is True


def test_get_managed_user_forbidden_for_staff() -> None:
    # Wurzel 9: die Detailseite prüft denselben Scope wie die Liste.
    editor = {"id": "st-1", "role": "staff", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "cleaner", "permissions": [], "tenant_id": "t-1"}
    svc, _captured = _svc_for_update(editor, target)
    ctx = AuthContext(user_id="st-1", tenant_id="t-1", role="staff")
    with pytest.raises(AuthError) as exc:
        svc.get_managed_user(ctx, "u-2")
    assert exc.value.status_code == 403


def test_get_managed_user_returns_contact_fields() -> None:
    editor = {"id": "admin-1", "role": "admin", "permissions": [], "tenant_id": "t-1"}
    target = {"id": "u-2", "role": "staff", "permissions": [], "tenant_id": "t-1",
              "email": "s@x.de", "full_name": "S", "phone": "+45111",
              "additional_phone": "+45222", "hide_phones": True,
              "spoken_languages": ["Dänisch"], "notes": "N",
              "deactivated_at": None, "created_at": "2026-01-02T00:00:00+00:00"}
    svc, _captured = _svc_for_update(editor, target)
    nutzer = svc.get_managed_user(_admin_ctx(), "u-2")
    assert nutzer.additional_phone == "+45222"
    assert nutzer.hide_phones is True
    assert nutzer.spoken_languages == ["Dänisch"]
    assert nutzer.notes == "N"
    assert nutzer.is_active is True
    assert nutzer.created_at == "2026-01-02T00:00:00+00:00"


def test_ist_gesperrt_reads_column() -> None:
    service_client = MagicMock()
    (
        service_client.table.return_value.select.return_value.eq.return_value
        .limit.return_value.execute.return_value
    ) = MagicMock(data=[{"deactivated_at": "2026-08-01T10:00:00+00:00"}])
    svc = AccountService(anon_client=MagicMock(), service_client=service_client)
    assert svc.ist_gesperrt("u-2") is True


def test_ist_gesperrt_false_for_active() -> None:
    service_client = MagicMock()
    (
        service_client.table.return_value.select.return_value.eq.return_value
        .limit.return_value.execute.return_value
    ) = MagicMock(data=[{"deactivated_at": None}])
    svc = AccountService(anon_client=MagicMock(), service_client=service_client)
    assert svc.ist_gesperrt("u-2") is False
