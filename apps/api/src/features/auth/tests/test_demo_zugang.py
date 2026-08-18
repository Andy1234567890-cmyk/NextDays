"""Tests für den Vorführ-Zugang der Marketing-Seite (0407).

Der Endpunkt stellt OHNE Anmeldung eine echte Session aus. Was ihn tragfähig
macht, ist nicht der Login selbst, sondern was er ablehnt:
  - fehlende Konfiguration → 503, kein hartkodierter Fallback-Zugang,
  - falscher Mandant in der frischen Session → nichts wird ausgeliefert,
  - keine benutzbare Session (2FA am Konto) → 503 statt halber Session.
"""
from unittest.mock import patch

import pytest
from pydantic import SecretStr

from src.features.auth.demo_zugang import (
    DemoZugangFehler,
    demo_zugangsdaten,
    session_pruefen,
    tenant_pruefen,
)

TENANT = "69d24767-2a93-565e-9c0c-b57b35938353"


class _Settings:  # pylint: disable=too-few-public-methods
    def __init__(self, login: str, passwort: str, tenant: str) -> None:
        self.demo_login = login
        self.demo_passwort = SecretStr(passwort)
        self.demo_tenant_id = tenant


def _mit(login: str = "demo@x.de", passwort: str = "geheim", tenant: str = TENANT):
    return patch(
        "src.features.auth.demo_zugang.get_settings",
        return_value=_Settings(login, passwort, tenant),
    )


# --------------------------------------------------------------------------
# Konfiguration
# --------------------------------------------------------------------------


def test_vollstaendige_konfiguration_wird_geliefert() -> None:
    with _mit():
        login, passwort, tenant = demo_zugangsdaten()
    assert login == "demo@x.de"
    assert passwort.get_secret_value() == "geheim"
    assert tenant == TENANT


@pytest.mark.parametrize(
    ("login", "passwort", "tenant"),
    [
        ("", "geheim", TENANT),
        ("demo@x.de", "", TENANT),
        ("demo@x.de", "geheim", ""),
        ("   ", "geheim", TENANT),
    ],
)
def test_unvollstaendige_konfiguration_ist_fail_closed(
    login: str, passwort: str, tenant: str
) -> None:
    """Fehlt ein Teil, gibt es KEINEN Ersatzwert (Wurzel 4).

    Ein Fallback wäre hier besonders schädlich: er wäre ein öffentlich
    bekannter Login in eine echte Anwendung.
    """
    with _mit(login, passwort, tenant):
        with pytest.raises(DemoZugangFehler) as exc:
            demo_zugangsdaten()
    assert exc.value.status_code == 503


# --------------------------------------------------------------------------
# Mandanten-Gegenprobe — der wichtigste Test
# --------------------------------------------------------------------------


def test_richtiger_mandant_kommt_durch() -> None:
    tenant_pruefen(TENANT, TENANT, user_id="u-1")


def test_falscher_mandant_liefert_nichts_aus() -> None:
    """Zeigt die Umgebung auf ein ECHTES Konto, gibt der Endpunkt nichts heraus.

    Das ist der gefährlichste Fall des ganzen Vorhabens: eine Session in einen
    echten Betrieb, ausgestellt an anonyme Besucher. Der `demo_gate`-Riegel
    griffe dort NICHT, weil er am `is_demo`-Flag des Mandanten hängt — der
    Besucher könnte schreiben.
    """
    with pytest.raises(DemoZugangFehler) as exc:
        tenant_pruefen(TENANT, "ein-echter-betrieb", user_id="u-1")
    assert exc.value.status_code == 503


def test_session_ohne_mandant_wird_abgelehnt() -> None:
    with pytest.raises(DemoZugangFehler):
        tenant_pruefen(TENANT, None, user_id="u-1")


# --------------------------------------------------------------------------
# Session-Zustand
# --------------------------------------------------------------------------


def test_benutzbare_session_kommt_durch() -> None:
    session_pruefen(mfa_required=False, hat_session=True)


def test_mfa_aufforderung_wird_abgelehnt() -> None:
    """Der Vorführ-Zugang darf keine 2FA haben — sonst ist die Demo nicht
    ohne Zutun erreichbar. Eine halbe Session wäre wertlos."""
    with pytest.raises(DemoZugangFehler) as exc:
        session_pruefen(mfa_required=True, hat_session=False)
    assert exc.value.status_code == 503


def test_fehlende_session_wird_abgelehnt() -> None:
    with pytest.raises(DemoZugangFehler):
        session_pruefen(mfa_required=False, hat_session=False)
