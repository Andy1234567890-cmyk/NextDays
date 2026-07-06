"""Tests für Mitarbeiter-Objekt-Freigabe (§4.3) und objekt-basierte Kontakt-
Auswahl (§4.2/§4.3).

Unit/Contract mit gemocktem Supabase-Client: StaffAssignmentService (Rollen-/
Tenant-Guard, Replace-Semantik), staff_scope-Helfer (fail-closed) und
AccountService.list_property_contacts (nur berechtigte Nutzer je Objekt).
"""
from unittest.mock import MagicMock

import pytest

from src.core.security import AuthContext
from src.features.auth.account_service import AccountService
from src.features.auth.schemas import StaffAssignmentUpdate
from src.features.auth.service import AuthError
from src.features.auth.staff_assignment_service import StaffAssignmentService
from src.features.auth.staff_scope import (
    filter_to_assigned,
    is_staff,
    staff_property_ids,
)


def _admin_ctx() -> AuthContext:
    return AuthContext(user_id="admin-1", tenant_id="t-1", role="admin")


def _staff_ctx() -> AuthContext:
    return AuthContext(user_id="staff-1", tenant_id="t-1", role="staff")


# --- staff_scope-Helfer ----------------------------------------------------


def test_is_staff_true_for_staff_and_cleaner() -> None:
    assert is_staff(AuthContext(user_id="u", tenant_id="t", role="staff"))
    assert is_staff(AuthContext(user_id="u", tenant_id="t", role="cleaner"))
    assert not is_staff(AuthContext(user_id="u", tenant_id="t", role="owner"))
    assert not is_staff(AuthContext(user_id="u", tenant_id="t", role="admin"))


def test_staff_property_ids_empty_without_tenant() -> None:
    ctx = AuthContext(user_id="u", tenant_id=None, role="staff")
    assert staff_property_ids(MagicMock(), ctx) == set()


def test_staff_property_ids_reads_assignments() -> None:
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"property_id": "p-1"}, {"property_id": "p-2"}]
    )
    assert staff_property_ids(db, _staff_ctx()) == {"p-1", "p-2"}


def test_filter_to_assigned_leaves_non_staff_untouched() -> None:
    ctx = AuthContext(user_id="u", tenant_id="t", role="admin")
    assert filter_to_assigned(MagicMock(), ctx, ["p-1", "p-2"]) == ["p-1", "p-2"]


def test_filter_to_assigned_restricts_staff() -> None:
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"property_id": "p-1"}]
    )
    assert filter_to_assigned(db, _staff_ctx(), ["p-1", "p-2"]) == ["p-1"]


# --- StaffAssignmentService ------------------------------------------------


def _staff_assign_service(
    *, target_role: str = "staff", tenant_props: list[str] | None = None
) -> tuple[StaffAssignmentService, MagicMock]:
    """Service mit gemocktem DB-Client: users liefert Zielnutzer mit target_role,
    properties liefert tenant_props (Default p-1/p-2)."""
    props = tenant_props if tenant_props is not None else ["p-1", "p-2"]
    db = MagicMock()

    def table(name: str) -> MagicMock:
        tbl = MagicMock()
        if name == "users":
            tbl.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[{"id": "staff-1", "role": target_role}] if target_role else []
            )
        elif name == "properties":
            tbl.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{"id": p} for p in props]
            )
        else:  # staff_property_assignments
            tbl.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[]
            )
            tbl.delete.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()
            tbl.insert.return_value.execute.return_value = MagicMock()
        return tbl

    db.table.side_effect = table
    return StaffAssignmentService(service_client=db), db


def test_staff_assign_rejects_non_staff_target() -> None:
    svc, _ = _staff_assign_service(target_role="owner")
    with pytest.raises(AuthError) as exc:
        svc.set(_admin_ctx(), "staff-1", StaffAssignmentUpdate(property_ids=["p-1"]))
    assert exc.value.status_code == 400


def test_staff_assign_rejects_unknown_user() -> None:
    svc, _ = _staff_assign_service(target_role="")
    with pytest.raises(AuthError) as exc:
        svc.get(_admin_ctx(), "staff-1")
    assert exc.value.status_code == 404


def test_staff_assign_rejects_foreign_property() -> None:
    svc, _ = _staff_assign_service(tenant_props=["p-1"])
    with pytest.raises(AuthError) as exc:
        svc.set(
            _admin_ctx(),
            "staff-1",
            StaffAssignmentUpdate(property_ids=["p-1", "p-fremd"]),
        )
    assert exc.value.status_code == 400


def test_staff_assign_replace_writes_wanted() -> None:
    svc, db = _staff_assign_service()
    res = svc.set(
        _admin_ctx(), "staff-1", StaffAssignmentUpdate(property_ids=["p-1", "p-1"])
    )
    # dedupe
    assert res.property_ids == ["p-1"]
    # delete + insert liefen (Replace-Semantik)
    assign_tbl = [
        c for c in db.table.call_args_list if c.args[0] == "staff_property_assignments"
    ]
    assert assign_tbl  # Tabelle wurde angefasst


def test_staff_assign_requires_tenant() -> None:
    svc, _ = _staff_assign_service()
    ctx = AuthContext(user_id="admin-1", tenant_id=None, role="admin")
    with pytest.raises(AuthError) as exc:
        svc.get(ctx, "staff-1")
    assert exc.value.status_code == 400


# --- list_property_contacts ------------------------------------------------


def _account_service_for_contacts(
    *, users: list[dict], assigned: dict[str, list[str]], prop_exists: bool = True
) -> AccountService:
    """AccountService mit gemocktem DB-Client für list_property_contacts.

    users: alle Tenant-users-Rows. assigned: {tabelle: [user_id,...]} für die
    Objekt-Zuordnungen. prop_exists: ob das Objekt zum Tenant gehört.
    """
    db = MagicMock()

    def table(name: str) -> MagicMock:
        tbl = MagicMock()
        if name == "users":
            # _ensure_user_row (select by id) UND die Kontakt-Liste (by tenant_id).
            tbl.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{"id": "admin-1", "tenant_id": "t-1", "role": "admin"}]
            )
            tbl.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
                data=users
            )
        elif name == "properties":
            tbl.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[{"id": "p-1"}] if prop_exists else []
            )
        elif name in ("owner_property_assignments", "staff_property_assignments"):
            rows = [{"user_id": uid} for uid in assigned.get(name, [])]
            tbl.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
                data=rows
            )
        return tbl

    db.table.side_effect = table
    return AccountService(anon_client=MagicMock(), service_client=db)


def test_property_contacts_unknown_property_404() -> None:
    svc = _account_service_for_contacts(users=[], assigned={}, prop_exists=False)
    with pytest.raises(AuthError) as exc:
        svc.list_property_contacts(_admin_ctx(), "p-1")
    assert exc.value.status_code == 404


def test_property_contacts_includes_admin_and_assigned_only() -> None:
    users = [
        {"id": "admin-1", "tenant_id": "t-1", "role": "admin", "email": "a@b.de",
         "full_name": "Admin", "permissions": []},
        {"id": "owner-1", "tenant_id": "t-1", "role": "owner", "email": "o@b.de",
         "full_name": "Owner", "permissions": []},
        {"id": "staff-1", "tenant_id": "t-1", "role": "staff", "email": "s@b.de",
         "full_name": "Staff", "permissions": []},
        {"id": "staff-2", "tenant_id": "t-1", "role": "staff", "email": "s2@b.de",
         "full_name": "Staff2", "permissions": []},
    ]
    svc = _account_service_for_contacts(
        users=users,
        assigned={
            "owner_property_assignments": ["owner-1"],
            "staff_property_assignments": ["staff-1"],
        },
    )
    contacts = svc.list_property_contacts(_admin_ctx(), "p-1")
    ids = {c.user_id for c in contacts}
    # admin immer, plus zugewiesener owner + staff; NICHT der nicht zugewiesene staff-2.
    assert ids == {"admin-1", "owner-1", "staff-1"}
