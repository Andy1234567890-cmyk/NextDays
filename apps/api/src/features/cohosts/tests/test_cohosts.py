"""Tests für den cohosts-Slice (Co-Gastgeber, Plattform-Marktplatz).

Der Slice vergibt Zugriff auf FREMDE Objekte — die Tests decken deshalb vor
allem ab, was schiefgehen darf und was nicht:

  1. Rechteweitergabe: Ein Co-Gastgeber darf keinen Vollzugriff vergeben.
  2. Objekt-Scope: Ein fremdes Objekt ist nicht erreichbar.
  3. Einladung: nur für die adressierte E-Mail, nur mit geprüfter Identität,
     nicht nach Ablauf, und die Annahme ist idempotent.
  4. Obergrenze: höchstens 10 je Objekt.
"""
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from src.core.security import AuthContext
from src.features.auth.permissions import (
    Capability,
    cohost_capabilities_for,
    cohost_has_capability,
)
from src.features.cohosts.schemas import CohostAccess, CohostInvite
from src.features.cohosts.service import CohostError, CohostService


def _ctx(user_id: str = "u-owner", tenant_id: str = "t1") -> AuthContext:
    return AuthContext(
        user_id=user_id, tenant_id=tenant_id, role="admin", permissions=[]
    )


def _db() -> MagicMock:
    return MagicMock(name="supabase")


def _tabellen(db: MagicMock, **tabellen: MagicMock) -> None:
    """table('x') auf die jeweilige Mock-Tabelle abbilden."""
    db.table.side_effect = lambda n: tabellen.get(n, MagicMock())


def _kette(mock: MagicMock, *schritte: str) -> MagicMock:
    """Eine PostgREST-Aufrufkette auf dem Mock nachbilden.

    Ohne diesen Helfer werden die Ketten (select→eq→eq→limit→execute) so lang,
    dass sie unlesbar umbrechen.
    """
    aktuell = mock
    for s in schritte:
        aktuell = getattr(aktuell, s).return_value
    return aktuell


def _eigenes_objekt(titel: str = "Haus") -> MagicMock:
    """properties-Mock, der das Objekt als eigenes liefert."""
    props = MagicMock()
    _kette(props, "select", "eq", "eq", "limit").execute.return_value.data = [
        {"id": "p1", "tenant_id": "t1", "title": titel}
    ]
    return props


# --- Capability-Matrix -------------------------------------------------------


def test_stufen_haben_die_dokumentierten_rechte() -> None:
    """Die drei Stufen bilden airbnb.com/help/article/1534 ab."""
    voll = cohost_capabilities_for("full")
    assert Capability.MANAGE_PROPERTIES in voll
    assert Capability.MANAGE_CALENDAR in voll
    # Vollzugriff sieht Einnahmen, richtet aber KEINE Auszahlungen ein.
    assert Capability.VIEW_FINANCES in voll
    assert Capability.MANAGE_BILLING not in voll

    kal_msg = cohost_capabilities_for("calendar_messaging")
    assert Capability.VIEW_CALENDAR in kal_msg
    # Kalender SEHEN, nicht ändern.
    assert Capability.MANAGE_CALENDAR not in kal_msg

    nur_kal = cohost_capabilities_for("calendar")
    assert Capability.VIEW_CALENDAR in nur_kal
    # Ohne Nachrichten kein voller Gast-Einblick.
    assert Capability.VIEW_GUEST_FULL not in nur_kal


def test_unbekannte_stufe_gibt_keine_rechte() -> None:
    """Fail-closed: Ein Tippfehler darf nie Rechte vergeben (Wurzel 5)."""
    assert cohost_capabilities_for("vollzugriff") == frozenset()
    assert cohost_capabilities_for(None) == frozenset()
    assert not cohost_has_capability("", Capability.VIEW_CALENDAR)


# --- Objekt-Scope ------------------------------------------------------------


def test_fremdes_objekt_ist_nicht_erreichbar() -> None:
    """Ein Objekt aus einem anderen Tenant liefert 404, nicht 403.

    404 statt 403, weil ein 403 die Existenz bestätigen würde.
    """
    db = _db()
    props = MagicMock()
    _kette(props, "select", "eq", "eq", "limit").execute.return_value.data = []
    _tabellen(db, properties=props)

    with pytest.raises(CohostError) as exc:
        CohostService(db=db).list_for_property(_ctx(), "fremd")
    assert exc.value.status_code == 404


def test_scope_filtert_auf_den_eigenen_tenant() -> None:
    """Die Objekt-Abfrage MUSS auf tenant_id einschränken (Wurzel 3)."""
    db = _db()
    props = _eigenes_objekt()
    cohosts = MagicMock()
    _kette(cohosts, "select", "eq", "in_", "order").execute.return_value.data = []
    _tabellen(db, properties=props, property_cohosts=cohosts)

    CohostService(db=db).list_for_property(_ctx(), "p1")

    # Zweite eq()-Bedingung ist der Tenant-Scope.
    assert props.select.return_value.eq.return_value.eq.call_args[0] == (
        "tenant_id",
        "t1",
    )


# --- Rechteweitergabe --------------------------------------------------------


def test_cohost_darf_keinen_vollzugriff_vergeben() -> None:
    """Airbnb-Regel: Vollzugriff-Co-Gastgeber vergeben nur eingeschränkt.

    Ohne diese Sperre könnte ein Co-Gastgeber eine Kette gleichberechtigter
    Zugriffe aufbauen, die der Eigentümer nicht überblickt.
    """
    db = _db()
    props = _eigenes_objekt()
    cohosts = MagicMock()
    # Obergrenze: unkritisch
    _kette(cohosts, "select", "eq", "in_").execute.return_value.count = 1
    # Der Einladende ist selbst Co-Gastgeber mit Vollzugriff.
    _kette(
        cohosts, "select", "eq", "eq", "eq", "limit"
    ).execute.return_value.data = [{"access": "full"}]
    invites = MagicMock()
    _kette(
        invites, "select", "eq", "is_", "is_", "gt"
    ).execute.return_value.count = 0
    _tabellen(
        db, properties=props, property_cohosts=cohosts, cohost_invitations=invites
    )

    with pytest.raises(CohostError) as exc:
        CohostService(db=db).invite(
            _ctx(user_id="u-cohost"),
            "p1",
            CohostInvite(email="neu@example.com", access=CohostAccess.full),
        )
    assert exc.value.status_code == 403


# --- Obergrenze --------------------------------------------------------------


def test_obergrenze_zehn_je_objekt() -> None:
    """Max. 10 Co-Gastgeber je Objekt — offene Einladungen zählen mit."""
    db = _db()
    props = _eigenes_objekt()
    cohosts = MagicMock()
    _kette(cohosts, "select", "eq", "in_").execute.return_value.count = 8
    invites = MagicMock()
    _kette(
        invites, "select", "eq", "is_", "is_", "gt"
    ).execute.return_value.count = 2
    _tabellen(
        db, properties=props, property_cohosts=cohosts, cohost_invitations=invites
    )

    with pytest.raises(CohostError) as exc:
        CohostService(db=db).invite(
            _ctx(), "p1", CohostInvite(email="elf@example.com", access=CohostAccess.calendar)
        )
    assert exc.value.status_code == 409


# --- Einladung annehmen ------------------------------------------------------


def _einladung(**over: object) -> dict:
    basis = {
        "id": "i1",
        "property_id": "p1",
        "owner_tenant_id": "t1",
        "email": "gast@example.com",
        "access": "calendar",
        "note": None,
        "invited_by": "u-owner",
        "expires_at": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
        "accepted_at": None,
        "declined_at": None,
    }
    return {**basis, **over}


def _accept_mocks(db: MagicMock, inv: dict, nutzer: dict) -> MagicMock:
    invites = MagicMock()
    _kette(invites, "select", "eq", "limit").execute.return_value.data = [inv]
    users = MagicMock()
    _kette(users, "select", "eq", "limit").execute.return_value.data = [nutzer]
    cohosts = MagicMock()
    _kette(cohosts, "select", "eq", "eq", "limit").execute.return_value.data = []
    cohosts.insert.return_value.execute.return_value.data = [
        {
            "id": "c1", "property_id": "p1", "access": "calendar",
            "accepted_at": datetime.now(UTC).isoformat(),
        }
    ]
    props = MagicMock()
    _kette(props, "select", "in_").execute.return_value.data = [
        {"id": "p1", "title": "Haus"}
    ]
    _tabellen(
        db, cohost_invitations=invites, users=users,
        property_cohosts=cohosts, properties=props,
    )
    return cohosts


def test_annahme_nur_mit_passender_email() -> None:
    """Ein weitergeleiteter Link darf nicht von jedem eingelöst werden."""
    db = _db()
    _accept_mocks(
        db,
        _einladung(),
        {"email": "jemand.anders@example.com", "identity_status": "verified"},
    )
    with pytest.raises(CohostError) as exc:
        CohostService(db=db).accept(_ctx(user_id="u-fremd"), "t" * 40)
    assert exc.value.status_code == 403


def test_annahme_nur_mit_geprüfter_identitaet() -> None:
    """Airbnb verlangt die Identitätsprüfung VOR der Annahme."""
    db = _db()
    _accept_mocks(
        db,
        _einladung(),
        {"email": "gast@example.com", "identity_status": "unverified"},
    )
    with pytest.raises(CohostError) as exc:
        CohostService(db=db).accept(_ctx(user_id="u-gast"), "t" * 40)
    assert exc.value.status_code == 403


def test_abgelaufene_einladung_wird_abgelehnt() -> None:
    db = _db()
    _accept_mocks(
        db,
        _einladung(expires_at=(datetime.now(UTC) - timedelta(days=1)).isoformat()),
        {"email": "gast@example.com", "identity_status": "verified"},
    )
    with pytest.raises(CohostError) as exc:
        CohostService(db=db).accept(_ctx(user_id="u-gast"), "t" * 40)
    assert exc.value.status_code == 410


def test_annahme_ist_idempotent() -> None:
    """Zweiter Aufruf (Doppelklick/Retry) legt keine zweite Zuordnung an.

    Wurzel 2: Real kommt alles doppelt.
    """
    db = _db()
    invites = MagicMock()
    _kette(invites, "select", "eq", "limit").execute.return_value.data = [
        _einladung(accepted_at=datetime.now(UTC).isoformat())
    ]
    cohosts = MagicMock()
    _kette(cohosts, "select", "eq", "eq", "limit").execute.return_value.data = [
        {"id": "c1", "property_id": "p1", "access": "calendar", "accepted_at": None}
    ]
    props = MagicMock()
    _kette(props, "select", "in_").execute.return_value.data = [
        {"id": "p1", "title": "Haus"}
    ]
    _tabellen(
        db, cohost_invitations=invites, property_cohosts=cohosts, properties=props
    )

    ergebnis = CohostService(db=db).accept(_ctx(user_id="u-gast"), "t" * 40)
    assert ergebnis.id == "c1"
    cohosts.insert.assert_not_called()


def test_ungueltiger_token_gibt_404() -> None:
    """Ein zu kurzer Token wird abgewiesen, ohne die DB zu belasten."""
    db = _db()
    with pytest.raises(CohostError) as exc:
        CohostService(db=db).invitation_by_token("kurz")
    assert exc.value.status_code == 404


# --- Entziehen ---------------------------------------------------------------


def test_entziehen_scopt_auf_das_objekt() -> None:
    """Der property_id-Filter verhindert IDOR über eine fremde cohost_id."""
    db = _db()
    props = _eigenes_objekt()
    cohosts = MagicMock()
    _kette(cohosts, "update", "eq", "eq").execute.return_value.data = [{"id": "c1"}]
    _tabellen(db, properties=props, property_cohosts=cohosts)

    CohostService(db=db).remove(_ctx(), "p1", "c1")

    # Zweiter eq()-Filter ist der Objekt-Scope (Wurzel 9).
    assert cohosts.update.return_value.eq.return_value.eq.call_args[0] == (
        "property_id",
        "p1",
    )


def test_austritt_scopt_auf_die_eigene_zuordnung() -> None:
    """leave() darf nur die EIGENE Zuordnung beenden."""
    db = _db()
    cohosts = MagicMock()
    _kette(cohosts, "update", "eq", "eq").execute.return_value.data = [{"id": "c1"}]
    _tabellen(db, property_cohosts=cohosts)

    CohostService(db=db).leave(_ctx(user_id="u-gast"), "c1")

    assert cohosts.update.return_value.eq.return_value.eq.call_args[0] == (
        "user_id",
        "u-gast",
    )
