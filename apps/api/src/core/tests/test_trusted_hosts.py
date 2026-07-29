"""Der Callback-Host muss immer im Host-Header-Allowlist landen.

Realer Vorfall 25./26.07.2026: `public_api_url` zeigte auf
nextdays-api.65.21.144.136.sslip.io, `trusted_hosts` kannte den Host nicht.
Die TrustedHostMiddleware antwortete deshalb auf JEDEN Channex-Webhook mit
400 "Invalid host header" — vor jedem Handler, also ohne Log und ohne DB-Spur
("0 ok · 86 failed" im Channex-Dashboard, Antwortzeiten 32-91 ms).
"""
from src.core.config import Settings

_CALLBACK = "https://nextdays-api.65.21.144.136.sslip.io"
_HOST = "nextdays-api.65.21.144.136.sslip.io"


def test_callback_host_wird_ergaenzt_wenn_liste_ihn_vergisst() -> None:
    """KRITISCH: das ist der Vorfall — handgepflegte Liste ohne Callback-Host."""
    s = Settings(
        environment="production",
        trusted_hosts="app.example.com,localhost",
        public_api_url=_CALLBACK,
    )
    assert _HOST in s.trusted_host_list
    # Die explizit gepflegten Hosts bleiben erhalten.
    assert "app.example.com" in s.trusted_host_list
    assert "localhost" in s.trusted_host_list


def test_kein_duplikat_wenn_host_bereits_gepflegt() -> None:
    s = Settings(
        environment="production",
        trusted_hosts=f"{_HOST},localhost",
        public_api_url=_CALLBACK,
    )
    assert s.trusted_host_list.count(_HOST) == 1


def test_port_und_pfad_werden_abgeschnitten() -> None:
    """public_api_url trägt Schema/Port/Pfad — der Host-Header nie."""
    s = Settings(
        environment="production",
        trusted_hosts="localhost",
        public_api_url="https://api.example.com:8443/api/v1",
    )
    assert "api.example.com" in s.trusted_host_list


def test_leere_public_api_url_aendert_nichts() -> None:
    s = Settings(
        environment="production", trusted_hosts="app.example.com", public_api_url=""
    )
    assert s.trusted_host_list == ["app.example.com"]


def test_ableitung_aus_cors_ergaenzt_callback_host() -> None:
    """Ohne explizite trusted_hosts wird aus CORS abgeleitet — der Callback-Host
    muss trotzdem dazukommen, sonst schlägt der Webhook genauso fehl."""
    s = Settings(
        environment="production",
        trusted_hosts="",
        cors_origins="https://app.example.com",
        public_api_url=_CALLBACK,
    )
    assert s.trusted_host_list == ["app.example.com", _HOST]
