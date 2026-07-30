"""Tests für die Backoffice-Team-Verwaltung.

Der Schwerpunkt liegt auf den Regeln, die verhindern, dass sich der Betreiber
selbst aussperrt oder ein Zugang unbemerkt weiterlebt:
  • niemand ändert die eigene Rolle / den eigenen Zugang,
  • der letzte aktive Vollzugang bleibt bestehen,
  • ein Einladungstoken ist einmalig, zeitlich begrenzt und nur als Hash da.
"""
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from src.core.security import PlatformContext
from src.features.platform_admin.schemas import (
    TeamInvite,
    TeamInviteAccept,
    TeamUpdate,
)
from src.features.platform_admin.team_service import TeamError, TeamService, _hash


def _ctx(user_id: str = "admin-1", role: str = "platform_admin") -> PlatformContext:
    return PlatformContext(
        user_id=user_id, email="chef@mynextdays.dk", platform_role=role
    )


def _settings(admin_url: str = "https://admin.example") -> MagicMock:
    s = MagicMock(name="settings")
    s.admin_base_url = admin_url
    return s


def _zeile(**over: object) -> dict:
    basis = {
        "user_id": "u-2",
        "role": "platform_support",
        "active": True,
        "note": None,
        "created_at": "2026-07-30T10:00:00+00:00",
        "granted_by": "admin-1",
        "invite_token_hash": None,
        "invite_expires_at": None,
        "accepted_at": None,
    }
    basis.update(over)
    return basis


def _db(zeile: dict | None = None, *, admin_count: int = 2) -> MagicMock:
    """Supabase-Mock: eine platform_admins-Zeile + Zähler aktiver Vollzugänge."""
    db = MagicMock(name="supabase")
    tabelle = MagicMock()
    tabelle.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = (
        [zeile] if zeile else []
    )
    zaehler = tabelle.select.return_value.eq.return_value.eq.return_value.execute
    zaehler.return_value.count = admin_count
    tabelle.update.return_value.eq.return_value.execute.return_value.data = [
        {**(zeile or _zeile())}
    ]
    tabelle.upsert.return_value.execute.return_value.data = [zeile or _zeile()]
    db.table.return_value = tabelle
    # GoTrue-Identität (E-Mail/letzter Login) ist reine Anzeige.
    db.auth.admin.get_user_by_id.return_value.user.email = "kollege@mynextdays.dk"
    db.auth.admin.get_user_by_id.return_value.user.last_sign_in_at = None
    return db


# --- Aussperr-Schutz ---------------------------------------------------------


def test_eigene_rolle_nicht_aenderbar() -> None:
    """Sonst könnte sich jemand versehentlich selbst herabstufen."""
    db = _db(_zeile(user_id="admin-1", role="platform_admin"))
    svc = TeamService(db=db, settings=_settings(), mail=MagicMock())
    with pytest.raises(TeamError) as exc:
        svc.update("admin-1", TeamUpdate(platform_role="platform_support"), actor=_ctx())
    assert exc.value.status_code == 409


def test_letzter_vollzugang_bleibt() -> None:
    """Der letzte aktive platform_admin darf nicht deaktiviert werden."""
    db = _db(_zeile(user_id="u-2", role="platform_admin"), admin_count=1)
    svc = TeamService(db=db, settings=_settings(), mail=MagicMock())
    with pytest.raises(TeamError) as exc:
        svc.update("u-2", TeamUpdate(active=False), actor=_ctx())
    assert exc.value.status_code == 409


def test_notiz_aendern_ist_erlaubt() -> None:
    """Eine reine Notiz ist keine Rechteänderung — auch an sich selbst."""
    db = _db(_zeile(user_id="admin-1", role="platform_admin"))
    svc = TeamService(db=db, settings=_settings(), mail=MagicMock())
    assert svc.update("admin-1", TeamUpdate(note="Chef"), actor=_ctx()) is not None


# --- Einladung ---------------------------------------------------------------


def test_bestehendes_konto_wird_freigeschaltet_ohne_link() -> None:
    """Wer schon ein Konto hat, braucht keinen Passwort-Link."""
    db = _db(_zeile())
    db.rpc.return_value.execute.return_value.data = "u-2"
    mail = MagicMock()
    svc = TeamService(db=db, settings=_settings(), mail=mail)

    res = svc.invite(
        TeamInvite(email="Kollege@mynextdays.dk", platform_role="platform_support"),
        actor=_ctx(),
    )
    assert res.ergebnis == "freigeschaltet"
    assert res.invite_link is None
    mail.send.assert_not_called()
    db.auth.admin.create_user.assert_not_called()


def test_neue_person_bekommt_einmal_token_nur_als_hash() -> None:
    """Der Klartext-Token steht im Link — in der DB liegt nur sein SHA-256."""
    db = _db(_zeile())
    db.rpc.return_value.execute.return_value.data = None
    db.auth.admin.create_user.return_value.user.id = "u-neu"
    mail = MagicMock()
    svc = TeamService(db=db, settings=_settings(), mail=mail)

    res = svc.invite(
        TeamInvite(email="neu@mynextdays.dk", platform_role="platform_support"),
        actor=_ctx(),
    )
    assert res.ergebnis == "eingeladen"
    assert res.mail_versendet is True
    # Der versendete Link enthält den Token …
    gesendet = mail.send.call_args[0][0].text
    token = gesendet.split("token=")[1].split()[0]
    # … gespeichert wurde ausschließlich der Hash.
    gespeichert = db.table.return_value.upsert.call_args[0][0]
    assert gespeichert["invite_token_hash"] == _hash(token)
    assert token not in str(gespeichert)


def test_ohne_admin_base_url_kein_erfundener_link() -> None:
    """Fehlende Konfiguration ist ein Fehler, kein geratener Link (Wurzel 4)."""
    db = _db(_zeile())
    db.rpc.return_value.execute.return_value.data = None
    db.auth.admin.create_user.return_value.user.id = "u-neu"
    svc = TeamService(db=db, settings=_settings(admin_url=""), mail=MagicMock())
    with pytest.raises(TeamError) as exc:
        svc.invite(
            TeamInvite(email="neu@mynextdays.dk", platform_role="platform_support"),
            actor=_ctx(),
        )
    assert exc.value.status_code == 500


# --- Annehmen ----------------------------------------------------------------


def _accept_db(zeile: dict | None) -> MagicMock:
    db = MagicMock(name="supabase")
    tabelle = MagicMock()
    tabelle.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = (
        [zeile] if zeile else []
    )
    db.table.return_value = tabelle
    return db


def test_abgelaufene_einladung_wird_abgelehnt() -> None:
    gestern = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    db = _accept_db(
        _zeile(invite_token_hash=_hash("t" * 30), invite_expires_at=gestern)
    )
    svc = TeamService(db=db, settings=_settings(), mail=MagicMock())
    with pytest.raises(TeamError) as exc:
        svc.accept(TeamInviteAccept(token="t" * 30, password="EinLangesPasswort1"))
    assert exc.value.status_code == 400
    db.auth.admin.update_user_by_id.assert_not_called()


def test_bereits_angenommene_einladung_ist_verbraucht() -> None:
    morgen = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
    db = _accept_db(
        _zeile(
            invite_token_hash=_hash("t" * 30),
            invite_expires_at=morgen,
            accepted_at="2026-07-30T11:00:00+00:00",
        )
    )
    svc = TeamService(db=db, settings=_settings(), mail=MagicMock())
    with pytest.raises(TeamError):
        svc.accept(TeamInviteAccept(token="t" * 30, password="EinLangesPasswort1"))
    db.auth.admin.update_user_by_id.assert_not_called()


def test_gueltige_einladung_setzt_passwort_und_verbraucht_token() -> None:
    morgen = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
    db = _accept_db(
        _zeile(invite_token_hash=_hash("t" * 30), invite_expires_at=morgen)
    )
    svc = TeamService(db=db, settings=_settings(), mail=MagicMock())
    svc.accept(TeamInviteAccept(token="t" * 30, password="EinLangesPasswort1"))

    db.auth.admin.update_user_by_id.assert_called_once()
    geleert = db.table.return_value.update.call_args[0][0]
    assert geleert["invite_token_hash"] is None
    assert geleert["accepted_at"]


def test_unbekannter_token_wird_abgelehnt() -> None:
    db = _accept_db(None)
    svc = TeamService(db=db, settings=_settings(), mail=MagicMock())
    with pytest.raises(TeamError) as exc:
        svc.accept(TeamInviteAccept(token="x" * 30, password="EinLangesPasswort1"))
    assert exc.value.status_code == 400
