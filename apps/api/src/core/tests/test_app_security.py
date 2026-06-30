"""App-Level-Security: HTTP-Method-Access-Control & CORS (Infra-Runbook 8b).

Stellt sicher, dass die CORS-Konfiguration default-deny ist: nur die real
genutzten Methoden werden für credential-tragende Cross-Origin-Requests erlaubt;
eine neue/unbekannte Methode (z. B. QUERY, RFC 10008) wird NICHT automatisch
reflektiert. Auth selbst erzwingt der Dependency pro Route — diese Tests sichern
zusätzlich die Konsistenz des Prinzips auf Edge-/CORS-Ebene ab.
"""
from fastapi.testclient import TestClient

from src.main import create_app

client = TestClient(create_app())

_ALLOWED = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
_ORIGIN = "http://localhost:3000"


def _preflight(method: str) -> int:
    """CORS-Preflight für `method` simulieren; gibt den access-control-Status zurück.

    Starlette spiegelt eine erlaubte Methode in `access-control-allow-methods`;
    eine nicht erlaubte führt zu einer 400-Preflight-Antwort ohne diesen Header.
    """
    resp = client.options(
        "/health",
        headers={
            "Origin": _ORIGIN,
            "Access-Control-Request-Method": method,
        },
    )
    return resp.status_code


def test_known_methods_pass_preflight() -> None:
    for method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
        assert _preflight(method) == 200, method


def test_query_method_is_not_reflected() -> None:
    # QUERY (RFC 10008) ist keine genutzte Methode → Preflight muss scheitern,
    # darf NICHT automatisch erlaubt werden (default-deny statt allow_methods=*).
    resp = client.options(
        "/health",
        headers={
            "Origin": _ORIGIN,
            "Access-Control-Request-Method": "QUERY",
        },
    )
    assert resp.status_code == 400
    allowed = resp.headers.get("access-control-allow-methods", "")
    assert "QUERY" not in allowed


def test_invented_method_is_not_reflected() -> None:
    resp = client.options(
        "/health",
        headers={
            "Origin": _ORIGIN,
            "Access-Control-Request-Method": "FOOBAR",
        },
    )
    assert resp.status_code == 400
    assert "FOOBAR" not in resp.headers.get("access-control-allow-methods", "")


def test_cors_allowlist_matches_real_methods() -> None:
    # Hält die Allowlist in main.py mit der Erwartung synchron: GET-Preflight liefert
    # die explizite Liste (kein "*"), und sie deckt sich mit den erlaubten Methoden.
    resp = client.options(
        "/health",
        headers={"Origin": _ORIGIN, "Access-Control-Request-Method": "GET"},
    )
    allowed = {
        m.strip().upper()
        for m in resp.headers.get("access-control-allow-methods", "").split(",")
        if m.strip()
    }
    assert "*" not in allowed
    assert allowed == _ALLOWED
