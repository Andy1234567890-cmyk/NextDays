"""Ist die Datenbank nicht erreichbar, ist das ein 503 — kein 500.

Ein 500 sagt dem Nutzer „da ist etwas kaputt" und jedem Client „nicht erneut
versuchen". Beides ist falsch, wenn nur die Verbindung zu Kong/PostgREST
gestört war. Live am 16.08.2026: der TCP-Connect lief in einen Timeout, und
weil das Auth-Gate auf JEDER geschützten Route eine DB-Runde macht, kippten
`/auth/me` und `/dashboard/onboarding` gleichzeitig mit 500.
"""
import httpx
import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

from src.main import create_app

# `raise_server_exceptions=False`: sonst reicht der TestClient die Exception
# durch, statt die Antwort des Handlers zu prüfen — und genau die ist hier die
# Aussage des Tests.
_router = APIRouter()


@_router.get("/_test/db-weg")
def _db_weg() -> None:
    raise httpx.ConnectTimeout(
        "timed out", request=httpx.Request("GET", "http://kong/rest/v1/x")
    )


@_router.get("/_test/echter-fehler")
def _echter_fehler() -> None:
    raise ValueError("kaputt")


@pytest.fixture(name="client")
def _client() -> TestClient:
    app = create_app()
    app.include_router(_router)
    return TestClient(app, raise_server_exceptions=False)


def test_transportfehler_wird_503_mit_retry_after(client: TestClient) -> None:
    antwort = client.get("/_test/db-weg")
    assert antwort.status_code == 503
    assert antwort.json()["detail"] == "service_unavailable"
    # Ohne `Retry-After` weiß ein Client nicht, dass und wann er es erneut
    # versuchen darf — dann ist der 503 nur ein höflicheres Scheitern.
    assert int(antwort.headers["Retry-After"]) > 0
    # Die Request-ID bleibt, damit der Fall im Support auffindbar ist.
    assert antwort.headers["X-Request-Id"]


def test_echter_programmfehler_bleibt_500(client: TestClient) -> None:
    """Die Abgrenzung ist der Punkt: nur Transportfehler werden zum 503.

    Würde der Handler breiter fangen, verschwände jeder echte Programmfehler
    hinter „Dienst nicht erreichbar" — niemand suchte mehr danach (Wurzel 5).
    """
    antwort = client.get("/_test/echter-fehler")
    assert antwort.status_code == 500
    assert antwort.json()["detail"] == "internal_error"
    assert "Retry-After" not in antwort.headers
