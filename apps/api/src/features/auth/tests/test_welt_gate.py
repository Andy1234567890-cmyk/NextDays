"""Tests für den Riegel zwischen den Auth-Welten (12.09.2026).

Eine Partnerin meldete sich im PMS an und bekam eine Session ohne Betrieb;
jede Seite antwortete 403 „Unzureichende Berechtigung." Der Riegel weist
fremde Welten am Login UND am Token ab — mit einer Meldung, die den Weg nennt.
"""
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from src.core.config import Settings
from src.features.auth.service import AuthError, AuthService
from src.features.auth.welt_gate import (
    pms_abweisung,
    pms_zugang_pruefen,
    welt_bestimmen,
)


@pytest.mark.parametrize(
    ("meta", "welt"),
    [
        ({"tenant_id": "t-1", "role": "staff"}, "betrieb"),
        # Eigentümer MIT Partner-Bewerbung bleibt im PMS ein Betriebskonto.
        ({"tenant_id": "t-1", "role": "owner", "affiliate": True}, "betrieb"),
        ({"platform_backoffice": True}, "backoffice"),
        ({"affiliate": True, "provider": "email"}, "partner"),
        ({"portal_guest": True}, "gast"),
        ({}, "unbekannt"),
        ({"tenant_id": ""}, "unbekannt"),
        (None, "unbekannt"),
        (MagicMock(), "unbekannt"),
    ],
)
def test_welt_bestimmen(meta: object, welt: str) -> None:
    assert welt_bestimmen(meta) == welt


def test_betrieb_und_backoffice_kommen_durch() -> None:
    assert pms_abweisung({"tenant_id": "t-1"}) is None
    assert pms_abweisung({"platform_backoffice": True}) is None
    pms_zugang_pruefen("u-1", {"tenant_id": "t-1"})


def test_partner_wird_mit_weg_abgewiesen() -> None:
    s = Settings(partner_base_url="https://partner.example.test/")
    meldung = pms_abweisung({"affiliate": True}, s)
    assert meldung is not None
    assert "Partner-Konto" in meldung
    assert "https://partner.example.test/" in meldung
    assert "//" not in meldung.split("https://", 1)[1]  # kein doppelter Slash


def test_partner_ohne_konfigurierte_adresse_bleibt_wahr_ohne_link() -> None:
    meldung = pms_abweisung({"affiliate": True}, Settings(partner_base_url=""))
    assert meldung is not None
    assert "Partner-Konto" in meldung
    assert "http" not in meldung


def test_gast_und_leeres_konto_bekommen_403_am_token() -> None:
    for meta in ({"portal_guest": True}, {}, None):
        with pytest.raises(HTTPException) as exc:
            pms_zugang_pruefen("u-1", meta)
        assert exc.value.status_code == 403


def _service() -> tuple[AuthService, MagicMock]:
    anon = MagicMock(name="anon")
    service = MagicMock(name="service")
    return AuthService(anon_client=anon, service_client=service), anon


def _login_ergebnis(app_meta: dict) -> MagicMock:
    user = MagicMock()
    user.id = "u-1"
    user.app_metadata = app_meta
    return MagicMock(session=MagicMock(), user=user)


def test_login_weist_partnerkonto_ab_ohne_session() -> None:
    from src.features.auth.schemas import LoginRequest

    svc, anon = _service()
    anon.auth.sign_in_with_password.return_value = _login_ergebnis({"affiliate": True})

    with pytest.raises(AuthError) as exc:
        svc.login(LoginRequest(email="p@example.de", password="longenough"))
    assert exc.value.status_code == 403
    assert "Partner-Konto" in exc.value.message


def test_login_weist_gastkonto_ab() -> None:
    from src.features.auth.schemas import LoginRequest

    svc, anon = _service()
    anon.auth.sign_in_with_password.return_value = _login_ergebnis(
        {"portal_guest": True}
    )

    with pytest.raises(AuthError) as exc:
        svc.login(LoginRequest(email="g@example.de", password="longenough"))
    assert exc.value.status_code == 403
    assert "myBestDays" in exc.value.message
