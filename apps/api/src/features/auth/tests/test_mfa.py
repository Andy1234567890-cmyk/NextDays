"""Tests fuer die Zwei-Faktor-Authentifizierung (freiwillig, AAL2).

Schwerpunkt sind die Entscheidungen, die man nicht ansieht:
- Kommt ein aal1-Token durch, obwohl der Nutzer einen Faktor hat? (Wurzel 7)
- Kommt ein Nutzer OHNE Faktor durch, unabhaengig von seiner Rolle? (keine
  Pflicht mehr, Entscheidung vom 25.08.2026)
- Wird ein Wiederherstellungscode wirklich nur EINMAL angenommen? (Wurzel 2)
- Ist der Guard fail-CLOSED, wenn der Faktor-Status nicht lesbar ist? (Wurzel 5)

Die DB ist hier ein Fake (kein Netz, kein Testcontainer): geprueft wird die
LOGIK des Guards, nicht PostgREST. Der DB-seitige Riegel (Wurzel 6) ist live
gegen die Server-DB bewiesen und gehoert nicht in einen Unit-Test.
"""
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from src.core.security import AuthContext
from src.features.auth.mfa_gate import mfa_zugang_pruefen
from src.features.auth.mfa_service import (
    MfaError,
    MfaService,
    _hash_code,
    _neuer_code,
)


def _ctx(aal: str = "aal1", **kw) -> AuthContext:
    return AuthContext(user_id=kw.pop("user_id", "u-1"), aal=aal, **kw)


def _request(pfad: str = "/api/v1/properties") -> SimpleNamespace:
    return SimpleNamespace(
        url=SimpleNamespace(path=pfad), state=SimpleNamespace()
    )


# --- Wiederherstellungscodes: Format und Normalisierung ---------------------


def test_code_normalisierung_ist_symmetrisch() -> None:
    """Erzeugen und Einloesen MUESSEN identisch normalisieren — sonst matcht
    kein einziger Code. Genau dieser Fehler war in der alten Implementierung
    nur durch einen Kommentar abgesichert."""
    code = _neuer_code()
    assert _hash_code(code) == _hash_code(code.lower())
    assert _hash_code(code) == _hash_code(code.replace("-", ""))
    assert _hash_code(code) == _hash_code(f"  {code}  ")


def test_code_hat_erwartetes_format() -> None:
    code = _neuer_code()
    assert len(code) == 11 and code[5] == "-"
    # Keine verwechselbaren Zeichen (0/O, 1/I/L) und kein U.
    assert not set(code.replace("-", "")) & set("ILOU")


# --- Der Guard: der Kern von Wurzel 7 --------------------------------------


def test_aal2_kommt_durch() -> None:
    service = MagicMock()
    mfa_zugang_pruefen(_request(), _ctx("aal2"))
    service.faktoren.assert_not_called()


def test_aal1_mit_vorhandenem_faktor_wird_abgewiesen(monkeypatch) -> None:
    """DER Angriff: direkter GoTrue-Login mit blossem Passwort, obwohl das
    Konto einen zweiten Faktor hat. Muss 401 sein, sonst ist die ganze 2FA
    wirkungslos."""
    service = MagicMock()
    service.faktoren.return_value = [{"id": "f-1", "factor_type": "totp"}]
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.MfaService", lambda db: service
    )
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.get_service_client", lambda: MagicMock()
    )

    with pytest.raises(HTTPException) as exc:
        mfa_zugang_pruefen(_request(), _ctx("aal1"))
    assert exc.value.status_code == 401
    assert exc.value.headers["X-MFA-Required"] == "challenge"


def test_faktor_status_unlesbar_ist_fail_closed(monkeypatch) -> None:
    """Wurzel 5: Ist der Status nicht ermittelbar, wird NICHT durchgelassen.
    Ein Ausfall der Statusabfrage darf kein Generalschluessel sein."""
    service = MagicMock()
    service.faktoren.side_effect = MfaError("kaputt", status_code=503)
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.MfaService", lambda db: service
    )
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.get_service_client", lambda: MagicMock()
    )

    with pytest.raises(HTTPException) as exc:
        mfa_zugang_pruefen(_request(), _ctx("aal1"))
    assert exc.value.status_code == 503


def test_api_client_token_ist_ausgenommen(monkeypatch) -> None:
    """Ein Client-Credentials-Token ist eine Maschine — sie kann per
    Definition keinen zweiten Faktor loesen. Der Schutz dort ist das Secret."""
    service = MagicMock()
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.MfaService", lambda db: service
    )
    ctx = AuthContext(user_id="api-1", aal="aal1", api_scopes=["properties:read"])
    mfa_zugang_pruefen(_request(), ctx)
    service.faktoren.assert_not_called()


def test_ohne_faktor_kommt_jede_rolle_durch(monkeypatch) -> None:
    """Keine Pflicht mehr (Entscheidung vom 25.08.2026): ein Konto ohne Faktor
    wird nie blockiert — unabhaengig von admin/co_admin/staff/cleaner/owner."""
    service = MagicMock()
    service.faktoren.return_value = []
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.MfaService", lambda db: service
    )
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.get_service_client", lambda: MagicMock()
    )
    for pfad in ("/api/v1/properties", "/api/v1/auth/me", "/api/v1/payments"):
        mfa_zugang_pruefen(_request(pfad), _ctx("aal1"))  # darf NICHT werfen


# --- Aussperr-Schutz beim Entfernen (nur noch: eigener Faktor) -------------


def test_fremder_faktor_ist_nicht_entfernbar() -> None:
    """Wurzel 9: die factor_id wird gegen die Liste DIESES Nutzers geprueft."""
    db = MagicMock()
    service = MfaService(db=db)
    service.faktoren = MagicMock(return_value=[{"id": "f-1"}])

    with pytest.raises(MfaError) as exc:
        service.faktor_entfernen_erlaubt("u-1", "fremder-faktor")
    assert exc.value.status_code == 404


def test_letzter_eigener_faktor_ist_frei_entfernbar() -> None:
    """Keine Pflicht mehr: der letzte Faktor braucht keine Recovery-Codes als
    Voraussetzung — wer freiwillig eingerichtet hat, darf auch abschalten."""
    db = MagicMock()
    service = MfaService(db=db)
    service.faktoren = MagicMock(return_value=[{"id": "f-1"}])
    service.codes_offen = MagicMock(return_value=0)

    service.faktor_entfernen_erlaubt("u-1", "f-1")  # darf NICHT werfen
    service.codes_offen.assert_not_called()


def test_alte_totp_endpunkte_sind_stillgelegt() -> None:
    """Die abgelöste App-2FA darf sich nicht mehr einschreiben lassen.

    Sonst gäbe es ZWEI Wahrheiten darüber, ob ein Konto einen zweiten Faktor
    hat: wer sich dort einschreibt, hätte in GoTrue KEINEN Faktor.
    """
    from fastapi.testclient import TestClient

    from src.main import create_app

    client = TestClient(create_app())
    for pfad in ("/api/v1/auth/totp/enroll", "/api/v1/auth/totp/verify"):
        resp = client.post(pfad, json={"code": "123456"})
        assert resp.status_code == 410, (pfad, resp.status_code)
