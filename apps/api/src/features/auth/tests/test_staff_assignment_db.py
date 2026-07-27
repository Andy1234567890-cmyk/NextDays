"""Mitarbeiter-Objekt-Freigabe (§ 4.3) gegen die ECHTE DB.

Warum das hier kein Double verträgt: Diese Datei prüft ZUGRIFFSSCHUTZ. Ein
`MagicMock` gibt auf jede Kette zurück, was man ihm vorher gesagt hat — er
bestätigt also die Erwartung des Testautors, nicht das Verhalten der Datenbank.
Genau die Fehler, die hier zählen, kann er nicht zeigen:

  * ein UNIQUE-Constraint, der eine doppelte Zuweisung ablehnt
    (staff_property_assignments_user_id_property_id_key)
  * ein Fremdschlüssel, der ein fremdes Objekt gar nicht erst zulässt
  * dass `set()` die Replace-Semantik wirklich schreibt statt nur `delete`
    und `insert` aufzurufen

Der Test stuft einen vorhandenen Nutzer für seine Dauer zum Mitarbeiter um
und stellt die alte Rolle danach wieder her. Einen Nutzer neu ANZULEGEN geht
nicht: public.users.id ist ein Fremdschlüssel auf auth.users (GoTrue).
"""
from __future__ import annotations

import contextlib
from collections.abc import Iterator

import pytest

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.schemas import StaffAssignmentUpdate
from src.features.auth.service import AuthError
from src.features.auth.staff_assignment_service import StaffAssignmentService
from src.features.auth.staff_scope import (
    filter_to_assigned,
    is_staff,
    staff_property_ids,
)

pytestmark = pytest.mark.integration


@pytest.fixture
def umgebung() -> Iterator[tuple[AuthContext, AuthContext, list[str]]]:
    """Ein Betrieb mit mindestens zwei Objekten und zwei Nutzern.
    Gibt (admin_ctx, staff_ctx, property_ids) zurück."""
    db = get_service_client()
    ziel = None
    for t in (db.table("tenants").select("id").execute()).data or []:
        props = (
            db.table("properties")
            .select("id")
            .eq("tenant_id", t["id"])
            .limit(2)
            .execute()
        ).data or []
        if len(props) >= 2:
            ziel = (t["id"], [p["id"] for p in props])
            break
    if ziel is None:
        pytest.skip("Kein Betrieb mit mindestens zwei Objekten.")
    tenant_id, property_ids = ziel

    # Zwei Nutzer des Betriebs: einer bleibt Administrator, einer wird für die
    # Dauer des Tests zum Mitarbeiter. Einen neuen Nutzer ANZULEGEN geht nicht
    # — public.users.id ist ein Fremdschlüssel auf auth.users (GoTrue), ein
    # frei erfundenes Konto lehnt die DB zu Recht ab (23503).
    nutzer = (
        db.table("users")
        .select("id, role")
        .eq("tenant_id", tenant_id)
        .in_("role", ["admin", "co_admin", "owner"])
        .limit(2)
        .execute()
    ).data or []
    if len(nutzer) < 2:
        pytest.skip("Betrieb hat weniger als zwei Nutzer.")
    admin_id = next(
        (n["id"] for n in nutzer if n["role"] in ("admin", "co_admin")), None
    )
    if admin_id is None:
        pytest.skip("Betrieb hat keinen Administrator.")
    proband = next(n for n in nutzer if n["id"] != admin_id)
    staff_id, alte_rolle = proband["id"], proband["role"]

    db.table("users").update({"role": "staff"}).eq("id", staff_id).execute()
    try:
        yield (
            AuthContext(user_id=admin_id, tenant_id=tenant_id, role="admin"),
            AuthContext(user_id=staff_id, tenant_id=tenant_id, role="staff"),
            property_ids,
        )
    finally:
        with contextlib.suppress(Exception):  # noqa: BLE001 — Teardown
            db.table("staff_property_assignments").delete().eq(
                "user_id", staff_id
            ).execute()
        with contextlib.suppress(Exception):  # noqa: BLE001 — Teardown
            db.table("users").update({"role": alte_rolle}).eq(
                "id", staff_id
            ).execute()


# -- staff_scope-Helfer -----------------------------------------------------


def test_is_staff_erkennt_die_eingeschraenkten_rollen() -> None:
    """Reine Rollenlogik ohne DB — hier ist kein Double im Spiel."""
    for rolle in ("staff", "cleaner"):
        assert is_staff(AuthContext(user_id="u", tenant_id="t", role=rolle))
    for rolle in ("owner", "admin", "co_admin"):
        assert not is_staff(AuthContext(user_id="u", tenant_id="t", role=rolle))


def test_ohne_tenant_keine_objekte() -> None:
    """Fail-closed: ohne Betrieb im Kontext gibt es keinen Zugriff."""
    ctx = AuthContext(user_id="u", tenant_id=None, role="staff")
    assert staff_property_ids(get_service_client(), ctx) == set()


def test_ohne_zuweisung_sieht_der_mitarbeiter_nichts(
    umgebung: tuple[AuthContext, AuthContext, list[str]],
) -> None:
    """Der wichtigste Fall: ein frischer Mitarbeiter hat KEINEN Zugriff.
    Ein fail-open wäre hier ein Datenleck über den ganzen Betrieb."""
    _, staff, property_ids = umgebung
    db = get_service_client()
    assert staff_property_ids(db, staff) == set()
    assert filter_to_assigned(db, staff, property_ids) == []


def test_filter_beschraenkt_auf_zugewiesene_objekte(
    umgebung: tuple[AuthContext, AuthContext, list[str]],
) -> None:
    admin, staff, property_ids = umgebung
    db = get_service_client()
    svc = StaffAssignmentService(service_client=db)
    svc.set(admin, staff.user_id, StaffAssignmentUpdate(property_ids=property_ids[:1]))

    assert staff_property_ids(db, staff) == {property_ids[0]}
    assert filter_to_assigned(db, staff, property_ids) == [property_ids[0]]


def test_admin_wird_nicht_gefiltert(
    umgebung: tuple[AuthContext, AuthContext, list[str]],
) -> None:
    admin, _, property_ids = umgebung
    assert (
        filter_to_assigned(get_service_client(), admin, property_ids)
        == property_ids
    )


# -- StaffAssignmentService -------------------------------------------------


def test_zuweisung_wird_wirklich_geschrieben(
    umgebung: tuple[AuthContext, AuthContext, list[str]],
) -> None:
    """Gegen die DB gegengelesen, nicht gegen einen Aufruf-Zähler."""
    admin, staff, property_ids = umgebung
    db = get_service_client()
    StaffAssignmentService(service_client=db).set(
        admin, staff.user_id, StaffAssignmentUpdate(property_ids=property_ids)
    )
    rows = (
        db.table("staff_property_assignments")
        .select("property_id")
        .eq("user_id", staff.user_id)
        .execute()
    ).data or []
    assert {r["property_id"] for r in rows} == set(property_ids)


def test_replace_entfernt_die_alten_zuweisungen(
    umgebung: tuple[AuthContext, AuthContext, list[str]],
) -> None:
    """Wurzel 1: wer neu setzt, muss den alten Zustand mitpflegen. Bliebe die
    alte Zuweisung stehen, sähe der Mitarbeiter ein Objekt, das ihm gerade
    entzogen wurde."""
    admin, staff, property_ids = umgebung
    db = get_service_client()
    svc = StaffAssignmentService(service_client=db)
    svc.set(admin, staff.user_id, StaffAssignmentUpdate(property_ids=property_ids))
    svc.set(
        admin, staff.user_id, StaffAssignmentUpdate(property_ids=property_ids[1:])
    )
    assert staff_property_ids(db, staff) == set(property_ids[1:])


def test_doppelte_id_wird_entdoppelt(
    umgebung: tuple[AuthContext, AuthContext, list[str]],
) -> None:
    """Der UNIQUE-Index (user_id, property_id) würde sonst 23505 werfen —
    ein Doppelklick darf keinen Fehler erzeugen (Wurzel 2)."""
    admin, staff, property_ids = umgebung
    res = StaffAssignmentService(service_client=get_service_client()).set(
        admin,
        staff.user_id,
        StaffAssignmentUpdate(property_ids=[property_ids[0], property_ids[0]]),
    )
    assert res.property_ids == [property_ids[0]]


def test_zweimal_setzen_ist_idempotent(
    umgebung: tuple[AuthContext, AuthContext, list[str]],
) -> None:
    """Wurzel 2: derselbe Aufruf zweimal darf nichts kaputtmachen."""
    admin, staff, property_ids = umgebung
    db = get_service_client()
    svc = StaffAssignmentService(service_client=db)
    svc.set(admin, staff.user_id, StaffAssignmentUpdate(property_ids=property_ids))
    svc.set(admin, staff.user_id, StaffAssignmentUpdate(property_ids=property_ids))
    assert staff_property_ids(db, staff) == set(property_ids)


def test_fremdes_objekt_wird_abgelehnt(
    umgebung: tuple[AuthContext, AuthContext, list[str]],
) -> None:
    """Wurzel 3: ein Objekt eines anderen Betriebs darf nicht zuweisbar sein."""
    admin, staff, property_ids = umgebung
    db = get_service_client()
    fremd = (
        db.table("properties")
        .select("id")
        .neq("tenant_id", admin.tenant_id)
        .limit(1)
        .execute()
    ).data
    if not fremd:
        pytest.skip("Kein Objekt eines anderen Betriebs vorhanden.")
    with pytest.raises(AuthError) as exc:
        StaffAssignmentService(service_client=db).set(
            admin,
            staff.user_id,
            StaffAssignmentUpdate(property_ids=[property_ids[0], fremd[0]["id"]]),
        )
    assert exc.value.status_code == 400


def test_nicht_staff_kann_keine_objekte_bekommen(
    umgebung: tuple[AuthContext, AuthContext, list[str]],
) -> None:
    """Ein Administrator ist ohnehin überall berechtigt — ihm ein Objekt
    zuzuweisen wäre ein widersprüchlicher Zustand."""
    admin, _, property_ids = umgebung
    with pytest.raises(AuthError) as exc:
        StaffAssignmentService(service_client=get_service_client()).set(
            admin,
            admin.user_id,
            StaffAssignmentUpdate(property_ids=[property_ids[0]]),
        )
    assert exc.value.status_code == 400


def test_unbekannter_nutzer_gibt_404(
    umgebung: tuple[AuthContext, AuthContext, list[str]],
) -> None:
    admin, _, _ = umgebung
    with pytest.raises(AuthError) as exc:
        StaffAssignmentService(service_client=get_service_client()).get(
            admin, "00000000-0000-4000-8000-000000000000"
        )
    assert exc.value.status_code == 404


def test_ohne_tenant_kein_zugriff(
    umgebung: tuple[AuthContext, AuthContext, list[str]],
) -> None:
    _, staff, _ = umgebung
    ctx = AuthContext(user_id="admin-1", tenant_id=None, role="admin")
    with pytest.raises(AuthError) as exc:
        StaffAssignmentService(service_client=get_service_client()).get(
            ctx, staff.user_id
        )
    assert exc.value.status_code == 400
