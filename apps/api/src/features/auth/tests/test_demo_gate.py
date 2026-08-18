"""Tests für den Nur-Lese-Riegel des öffentlichen Demo-Mandanten (0407).

Der Riegel ist die einzige Schicht zwischen einem öffentlich bekannten Login
und 536 schreibenden Routen — davon 76 ohne jeden Rollen-Guard. Geprüft wird
deshalb genau das, was ihn tragfähig macht:
  - schreibende Methoden werden abgelehnt, LESENDE nicht,
  - der Vorflug (OPTIONS) kommt durch, sonst wäre die Oberfläche im Browser tot,
  - ein normaler Mandant ist unberührt,
  - ein Datenbankfehler führt zu fail-CLOSED (503), nicht zu „darf schreiben".
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from src.core.security import AuthContext
from src.features.auth.demo_gate import demo_schreibzugriff_pruefen

SCHREIBEND = ("POST", "PUT", "PATCH", "DELETE")
LESEND = ("GET", "HEAD", "OPTIONS")


def _client(rows: list | Exception) -> MagicMock:
    client = MagicMock()
    kette = (
        client.table.return_value.select.return_value.eq.return_value
        .limit.return_value.execute
    )
    if isinstance(rows, Exception):
        kette.side_effect = rows
    else:
        kette.return_value = MagicMock(data=rows)
    return client


def _ctx(tenant: str | None = "t-demo") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="admin")


@pytest.mark.parametrize("methode", SCHREIBEND)
def test_demo_darf_nicht_schreiben(methode: str) -> None:
    """Jede schreibende Methode wird abgelehnt — unabhängig von der Rolle.

    Der Kontext trägt hier bewusst `admin`: genau das ist der Fall im Bestand
    (der Demo-Nutzer wurde vom Seed als admin angelegt), und genau deshalb
    reicht eine Rollenprüfung nicht.
    """
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": True}]),
    ):
        with pytest.raises(HTTPException) as exc:
            demo_schreibzugriff_pruefen(methode, _ctx())
    assert exc.value.status_code == 405


@pytest.mark.parametrize("methode", LESEND)
def test_demo_darf_lesen(methode: str) -> None:
    """Lesen ist der Zweck der Demo — und kostet keine DB-Abfrage.

    Der Client wirft, wenn er doch befragt würde: die Methodenprüfung muss VOR
    der Abfrage greifen, sonst zahlt jeder Seitenaufruf eine DB-Runde.
    """
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client(RuntimeError("darf nicht abgefragt werden")),
    ):
        demo_schreibzugriff_pruefen(methode, _ctx())


@pytest.mark.parametrize("methode", SCHREIBEND)
def test_normaler_mandant_darf_schreiben(methode: str) -> None:
    """Ein zahlender Betrieb ist unberührt."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": False}]),
    ):
        demo_schreibzugriff_pruefen(methode, _ctx("t-echt"))


def test_lesefehler_ist_fail_closed() -> None:
    """DB-Ausfall → 503 für den Schreibversuch, nicht stillschweigend erlaubt.

    Andere Richtung als beim aktiv_gate (dort ist ein Ausfall eine Störung,
    die NICHT als Sperre ausgegeben werden darf): hier wäre fail-open die
    Erlaubnis zu schreiben. Lesen bleibt unberührt, die Demo läuft weiter.
    """
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client(RuntimeError("DB weg")),
    ):
        with pytest.raises(HTTPException) as exc:
            demo_schreibzugriff_pruefen("POST", _ctx())
    assert exc.value.status_code == 503


def test_ohne_mandant_kein_riegel() -> None:
    """Plattform-Zugänge tragen keine tenant_id — es gibt nichts zu prüfen."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client(RuntimeError("darf nicht abgefragt werden")),
    ):
        demo_schreibzugriff_pruefen("POST", _ctx(None))


def test_api_client_token_wird_uebersprungen() -> None:
    """Hinter einem Client-Credentials-Token steht kein Demo-Besucher, sondern
    eine Integration mit eigenem Secret und eigenen Scopes."""
    ctx = AuthContext(
        user_id="c-1", tenant_id="t-demo", role=None, api_scopes=frozenset({"x"})
    )
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client(RuntimeError("darf nicht abgefragt werden")),
    ):
        demo_schreibzugriff_pruefen("POST", ctx)


def test_methode_wird_gross_geschrieben_verglichen() -> None:
    """Ein klein geschriebenes „post" darf den Riegel nicht umgehen."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": True}]),
    ):
        with pytest.raises(HTTPException) as exc:
            demo_schreibzugriff_pruefen("post", _ctx())
    assert exc.value.status_code == 405
