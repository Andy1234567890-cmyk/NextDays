"""Tests fuer die Zwei-Faktor-Authentifizierung (AAL2-Erzwingung).

Schwerpunkt sind die Entscheidungen, die man nicht ansieht:
- Kommt ein aal1-Token durch, obwohl der Nutzer einen Faktor hat? (Wurzel 7)
- Wird ein Wiederherstellungscode wirklich nur EINMAL angenommen? (Wurzel 2)
- Ist der Guard fail-CLOSED, wenn der Faktor-Status nicht lesbar ist? (Wurzel 5)
- Kann sich ein Pflicht-Konto selbst den letzten Schluessel wegnehmen?

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
    PFLICHT_ROLLEN,
    RECOVERY_CODE_ANZAHL,
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


# --- Pflicht fuer admin/co_admin -------------------------------------------


@pytest.mark.parametrize("rolle", sorted(PFLICHT_ROLLEN))
def test_pflichtrollen_ohne_faktor_nach_frist_gesperrt(
    monkeypatch, rolle: str
) -> None:
    from datetime import UTC, datetime, timedelta

    from src.features.auth.mfa_service import MfaPflicht

    service = MagicMock()
    service.faktoren.return_value = []
    service.rolle_aus_db.return_value = rolle
    service.pflicht_pruefen.return_value = MfaPflicht(
        pflichtig=True,
        hat_faktor=False,
        erzwingen=True,
        grace_until=datetime.now(UTC) - timedelta(days=1),
    )
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.MfaService", lambda db: service
    )
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.get_service_client", lambda: MagicMock()
    )

    with pytest.raises(HTTPException) as exc:
        mfa_zugang_pruefen(_request("/api/v1/properties"), _ctx("aal1"))
    assert exc.value.status_code == 401
    assert exc.value.headers["X-MFA-Required"] == "enroll"


def test_gesperrtes_konto_darf_die_2fa_noch_einrichten(monkeypatch) -> None:
    """Aussperr-Schutz: Waere auch /auth/mfa/* gesperrt, koennte das Konto die
    geforderte 2FA nie einrichten — eine Sperre ohne Ausweg."""
    from datetime import UTC, datetime, timedelta

    from src.features.auth.mfa_service import MfaPflicht

    service = MagicMock()
    service.faktoren.return_value = []
    service.rolle_aus_db.return_value = "admin"
    service.pflicht_pruefen.return_value = MfaPflicht(
        pflichtig=True,
        hat_faktor=False,
        erzwingen=True,
        grace_until=datetime.now(UTC) - timedelta(days=1),
    )
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.MfaService", lambda db: service
    )
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.get_service_client", lambda: MagicMock()
    )

    req = _request("/api/v1/auth/mfa/status")
    mfa_zugang_pruefen(req, _ctx("aal1"))  # darf NICHT werfen
    assert req.state.mfa_enrollment_required == "overdue"


def test_frist_laesst_durch_und_fordert_auf(monkeypatch) -> None:
    from datetime import UTC, datetime, timedelta

    from src.features.auth.mfa_service import MfaPflicht

    ende = datetime.now(UTC) + timedelta(days=7)
    service = MagicMock()
    service.faktoren.return_value = []
    service.rolle_aus_db.return_value = "admin"
    service.pflicht_pruefen.return_value = MfaPflicht(
        pflichtig=True, hat_faktor=False, erzwingen=False, grace_until=ende
    )
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.MfaService", lambda db: service
    )
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.get_service_client", lambda: MagicMock()
    )

    req = _request()
    mfa_zugang_pruefen(req, _ctx("aal1"))
    assert req.state.mfa_enrollment_required == ende.isoformat()


def test_normale_rolle_ohne_faktor_kommt_durch(monkeypatch) -> None:
    """2FA ist fuer staff/cleaner/owner optional — kein Faktor, kein Zwang."""
    from src.features.auth.mfa_service import MfaPflicht

    service = MagicMock()
    service.faktoren.return_value = []
    service.rolle_aus_db.return_value = "cleaner"
    service.pflicht_pruefen.return_value = MfaPflicht(
        pflichtig=False, hat_faktor=False, erzwingen=False, grace_until=None
    )
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.MfaService", lambda db: service
    )
    monkeypatch.setattr(
        "src.features.auth.mfa_gate.get_service_client", lambda: MagicMock()
    )
    mfa_zugang_pruefen(_request(), _ctx("aal1"))


# --- Aussperr-Schutz beim Entfernen ----------------------------------------


def test_letzter_faktor_ohne_recovery_codes_wird_abgelehnt() -> None:
    db = MagicMock()
    service = MfaService(db=db)
    service.faktoren = MagicMock(return_value=[{"id": "f-1"}])
    service.rolle_aus_db = MagicMock(return_value="admin")
    service.codes_offen = MagicMock(return_value=0)

    with pytest.raises(MfaError) as exc:
        service.faktor_entfernen_erlaubt("u-1", "f-1")
    assert exc.value.status_code == 409


def test_letzter_faktor_mit_recovery_codes_ist_erlaubt() -> None:
    db = MagicMock()
    service = MfaService(db=db)
    service.faktoren = MagicMock(return_value=[{"id": "f-1"}])
    service.rolle_aus_db = MagicMock(return_value="admin")
    service.codes_offen = MagicMock(return_value=RECOVERY_CODE_ANZAHL)
    service.faktor_entfernen_erlaubt("u-1", "f-1")


def test_fremder_faktor_ist_nicht_entfernbar() -> None:
    """Wurzel 9: die factor_id wird gegen die Liste DIESES Nutzers geprueft."""
    db = MagicMock()
    service = MfaService(db=db)
    service.faktoren = MagicMock(return_value=[{"id": "f-1"}])

    with pytest.raises(MfaError) as exc:
        service.faktor_entfernen_erlaubt("u-1", "fremder-faktor")
    assert exc.value.status_code == 404


# --- Befunde aus der Review-Runde (Regressionsschutz) ----------------------


def test_naiver_zeitstempel_wirft_keinen_typeerror() -> None:
    """Ein Zeitstempel OHNE Offset darf den Guard nicht in einen 500 kippen.

    `_now()` ist aware; ein naiver Wert hätte beim Vergleich einen TypeError
    geworfen — und der ist kein MfaError, wäre also am fail-closed-Zweig
    vorbei in einen 500 gelaufen. Getroffen hätte es ausgerechnet die
    pflichtigen Konten ohne Faktor: auch /auth/mfa/* wäre gestorben, das
    Konto hätte die geforderte 2FA nicht mehr einrichten können.
    """
    from src.features.auth.mfa_service import _now, _zeit

    naiv = _zeit("2026-08-23T05:37:56")
    assert naiv.tzinfo is not None
    assert isinstance(_now() >= naiv, bool)
    assert _zeit("2026-08-23T05:37:56Z") == _zeit("2026-08-23T05:37:56+00:00")


def test_admin_reset_verlaengert_laufende_frist_nicht() -> None:
    """Der Admin-Reset ist ein Rettungsweg, kein Umgehungsschalter.

    Würde er bedingungslos 14 neue Tage vergeben, könnte man die Pflicht
    beliebig oft aussitzen: Faktor anlegen → Reset → 14 neue Tage → wiederholen.
    """
    from datetime import UTC, datetime, timedelta

    laufend = datetime.now(UTC) + timedelta(days=3)
    db = MagicMock()
    kette = db.table.return_value.select.return_value.eq.return_value.limit
    kette.return_value.execute.return_value.data = [
        {"grace_until": laufend.isoformat()}
    ]
    service = MfaService(db=db)
    assert service._reset_frist("u-1") == laufend


def test_admin_reset_gibt_abgelaufener_frist_eine_neue() -> None:
    """Sonst wäre das gerettete Konto sofort wieder gesperrt — der Reset
    hätte keine Wirkung (Aussperr-Schutz)."""
    from datetime import UTC, datetime, timedelta

    from src.features.auth.mfa_service import GRACE_DAUER

    abgelaufen = datetime.now(UTC) - timedelta(days=1)
    db = MagicMock()
    kette = db.table.return_value.select.return_value.eq.return_value.limit
    kette.return_value.execute.return_value.data = [
        {"grace_until": abgelaufen.isoformat()}
    ]
    service = MfaService(db=db)
    neu = service._reset_frist("u-1")
    assert neu > datetime.now(UTC)
    assert neu <= datetime.now(UTC) + GRACE_DAUER


def test_alte_totp_endpunkte_sind_stillgelegt() -> None:
    """Die abgelöste App-2FA darf sich nicht mehr einschreiben lassen.

    Sonst gäbe es ZWEI Wahrheiten darüber, ob ein Konto einen zweiten Faktor
    hat: wer sich dort einschreibt, hätte in GoTrue KEINEN Faktor und würde
    nach Fristablauf trotz aktiver „2FA" ausgesperrt.
    """
    from fastapi.testclient import TestClient

    from src.main import create_app

    client = TestClient(create_app())
    for pfad in ("/api/v1/auth/totp/enroll", "/api/v1/auth/totp/verify"):
        resp = client.post(pfad, json={"code": "123456"})
        assert resp.status_code == 410, (pfad, resp.status_code)


# --- Vorfuehr-Mandant: keine Pflicht (0407) --------------------------------


class _TenantKette:  # pylint: disable=too-few-public-methods
    """Kettenbare Abfrage, die eine `tenants`-Zeile liefert oder wirft."""

    def __init__(self, zeilen: list | Exception) -> None:
        self._zeilen = zeilen

    def select(self, *_a: object, **_k: object) -> "_TenantKette":
        return self

    def eq(self, *_a: object) -> "_TenantKette":
        return self

    def limit(self, _n: int) -> "_TenantKette":
        return self

    def execute(self) -> object:
        if isinstance(self._zeilen, Exception):
            raise self._zeilen
        return SimpleNamespace(data=self._zeilen)


class _TenantDB:  # pylint: disable=too-few-public-methods
    def __init__(self, zeilen: list | Exception) -> None:
        self._zeilen = zeilen
        self.gefragt: list[str] = []

    def table(self, name: str) -> _TenantKette:
        self.gefragt.append(name)
        return _TenantKette(self._zeilen)


def test_demo_mandant_hat_keine_mfa_pflicht() -> None:
    """Der Vorfuehr-Zugang traegt Rolle `admin` und waere damit pflichtig.

    Einrichten KANN ihn niemand — das Enrollment ist ein Schreibvorgang, den
    der Demo-Riegel ablehnt. Ohne diese Ausnahme schaltete sich die
    Vorfuehrung nach Ablauf der Frist selbst ab (gemessen: 23.08.2026).
    """
    from src.features.auth.mfa_service import MfaService

    db = _TenantDB([{"is_demo": True}])
    pflicht = MfaService(db).pflicht_pruefen(  # type: ignore[arg-type]
        "u-1", rolle="admin", tenant_id="t-demo"
    )
    assert pflicht.pflichtig is False
    assert pflicht.erzwingen is False
    assert pflicht.grace_until is None


def test_normaler_mandant_bleibt_pflichtig() -> None:
    """Ein zahlender Betrieb ist unberuehrt — dort gilt die Pflicht weiter."""
    from datetime import UTC, datetime, timedelta

    from src.features.auth.mfa_service import MfaService

    db = _TenantDB([{"is_demo": False}])
    dienst = MfaService(db)  # type: ignore[arg-type]
    dienst.hat_faktor = lambda _u: False  # type: ignore[method-assign]
    dienst._grace_holen_oder_setzen = (  # type: ignore[method-assign]  # noqa: SLF001
        lambda _u: datetime.now(UTC) + timedelta(days=3)
    )
    pflicht = dienst.pflicht_pruefen("u-1", rolle="admin", tenant_id="t-echt")
    assert pflicht.pflichtig is True


def test_lesefehler_laesst_die_pflicht_stehen() -> None:
    """Faellt die Demo-Pruefung aus, gilt die Pflicht weiter (sichere Richtung).

    Andere Richtung als beim demo_gate: dort waere fail-open die Erlaubnis zu
    schreiben, hier waere es das stillschweigende Fallenlassen einer Pflicht.
    """
    from datetime import UTC, datetime, timedelta

    from src.features.auth.mfa_service import MfaService

    db = _TenantDB(RuntimeError("DB weg"))
    dienst = MfaService(db)  # type: ignore[arg-type]
    dienst.hat_faktor = lambda _u: False  # type: ignore[method-assign]
    dienst._grace_holen_oder_setzen = (  # type: ignore[method-assign]  # noqa: SLF001
        lambda _u: datetime.now(UTC) + timedelta(days=3)
    )
    pflicht = dienst.pflicht_pruefen("u-1", rolle="admin", tenant_id="t-demo")
    assert pflicht.pflichtig is True


def test_ohne_tenant_keine_demo_abfrage() -> None:
    """Ohne Mandant gibt es nichts zu pruefen — und keine DB-Runde."""
    from src.features.auth.mfa_service import MfaService

    db = _TenantDB([{"is_demo": True}])
    dienst = MfaService(db)  # type: ignore[arg-type]
    dienst.pflicht_pruefen("u-1", rolle="staff", tenant_id=None)
    assert "tenants" not in db.gefragt
