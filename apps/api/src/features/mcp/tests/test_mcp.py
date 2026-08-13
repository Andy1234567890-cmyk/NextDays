"""Tests für den MCP-Connector: OAuth-Flow, Discovery und Werkzeuge."""
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from src.core.config import Settings
from src.features.mcp.oauth_service import (
    McpOAuthService,
    OAuthError,
    _pkce_challenge,
)

# Die API-Domain — bewusst NICHT die Dashboard-Domain: die Trennung der beiden
# ist genau der Fehler, den die Discovery sonst macht (falscher Host in
# `resource`/`issuer`).
_BASIS = "https://api.mynextdays.com"


def _settings() -> Settings:
    s = MagicMock(spec=Settings)
    s.app_base_url = "https://app.mynextdays.com"
    s.public_api_url = _BASIS
    s.api_token_secret = MagicMock()
    # ≥32 Byte: kürzer warnt PyJWT (RFC 7518 §3.2), und eine Dauerwarnung im
    # Testlauf verdeckt irgendwann eine echte.
    s.api_token_secret.get_secret_value.return_value = "t" * 48
    return s


class _Query:
    """Query-Stub mit echtem Speicher — Insert/Update wirken wirklich.

    Nötig, weil die Einmal-Einlösung eines Codes NUR beweisbar ist, wenn der
    zweite Versuch den veränderten Zustand sieht (Wurzel 2).
    """

    def __init__(self, store: dict, name: str) -> None:
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._is: dict = {}
        self._op = "select"
        self._payload: dict | None = None

    def select(self, *_a, **_k) -> "_Query":
        return self

    def eq(self, spalte, wert) -> "_Query":  # noqa: ANN001
        self._eq[spalte] = wert
        return self

    def is_(self, spalte, _wert) -> "_Query":  # noqa: ANN001
        self._is[spalte] = None
        return self

    def limit(self, *_a, **_k) -> "_Query":
        return self

    def order(self, *_a, **_k) -> "_Query":
        return self

    def insert(self, payload) -> "_Query":  # noqa: ANN001
        self._op, self._payload = "insert", payload
        return self

    def upsert(self, payload, **_k) -> "_Query":  # noqa: ANN001
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload) -> "_Query":  # noqa: ANN001
        self._op, self._payload = "update", payload
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    def _treffer(self) -> list[dict]:
        zeilen = self._store.setdefault(self._name, [])
        out = []
        for z in zeilen:
            if any(str(z.get(k)) != str(v) for k, v in self._eq.items()):
                continue
            if any(z.get(k) is not None for k in self._is):
                continue
            out.append(z)
        return out

    def execute(self) -> MagicMock:
        res = MagicMock()
        if self._op == "insert":
            self._store.setdefault(self._name, []).append(dict(self._payload))
            res.data = [self._payload]
            return res
        treffer = self._treffer()
        if self._op == "update":
            for z in treffer:
                z.update(self._payload)
        elif self._op == "delete":
            uebrig = [z for z in self._store[self._name] if z not in treffer]
            self._store[self._name][:] = uebrig
        res.data = treffer
        return res


def _db(store: dict | None = None) -> MagicMock:
    laden = store if store is not None else {}
    db = MagicMock()
    db.table.side_effect = lambda name: _Query(laden, name)
    return db


def _dienst(store: dict | None = None) -> McpOAuthService:
    return McpOAuthService(_db(store), _settings())


# --- PKCE ---------------------------------------------------------------------

def test_pkce_challenge_entspricht_rfc7636() -> None:
    """Testvektor aus RFC 7636 Anhang B."""
    verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    assert _pkce_challenge(verifier) == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"


# --- Code-Einlösung -----------------------------------------------------------

def _code_anlegen(dienst: McpOAuthService, verifier: str) -> str:
    return dienst.code_ausstellen(
        tenant_id="t1", user_id="u1",
        client_id="https://claude.ai/x", redirect_uri="https://claude.ai/cb",
        code_challenge=_pkce_challenge(verifier), scope="mcp:read",
        resource=f"{_BASIS}/api/v1/mcp",
    )


def test_code_einloesen_liefert_token() -> None:
    store: dict = {}
    dienst = _dienst(store)
    verifier = "a" * 64
    code = _code_anlegen(dienst, verifier)
    out = dienst.token_aus_code(
        code=code, client_id="https://claude.ai/x",
        redirect_uri="https://claude.ai/cb", verifier=verifier,
    )
    assert out["token_type"] == "Bearer"
    assert out["refresh_token"]
    # Der Token trägt Tenant und Nutzer — der MCP-Server scopet daran.
    nutzlast = dienst.token_pruefen(
        out["access_token"], resource=f"{_BASIS}/api/v1/mcp"
    )
    assert nutzlast["tenant_id"] == "t1"
    assert nutzlast["sub"] == "u1"


def test_code_nur_einmal_einloesbar() -> None:
    """Wurzel 2: Retry/Doppelklick sind real. Der zweite Versuch scheitert."""
    store: dict = {}
    dienst = _dienst(store)
    verifier = "b" * 64
    code = _code_anlegen(dienst, verifier)
    dienst.token_aus_code(
        code=code, client_id="https://claude.ai/x",
        redirect_uri="https://claude.ai/cb", verifier=verifier,
    )
    with pytest.raises(OAuthError) as exc:
        dienst.token_aus_code(
            code=code, client_id="https://claude.ai/x",
            redirect_uri="https://claude.ai/cb", verifier=verifier,
        )
    assert exc.value.code == "invalid_grant"


def test_falscher_verifier_wird_abgelehnt() -> None:
    """PKCE: ohne den passenden Verifier ist ein abgefangener Code wertlos."""
    dienst = _dienst()
    code = _code_anlegen(dienst, "c" * 64)
    with pytest.raises(OAuthError) as exc:
        dienst.token_aus_code(
            code=code, client_id="https://claude.ai/x",
            redirect_uri="https://claude.ai/cb", verifier="falsch" * 10,
        )
    assert exc.value.code == "invalid_grant"


def test_fremde_redirect_uri_wird_abgelehnt() -> None:
    """Die redirect_uri beim Einlösen muss der beim Autorisieren entsprechen."""
    dienst = _dienst()
    verifier = "d" * 64
    code = _code_anlegen(dienst, verifier)
    with pytest.raises(OAuthError):
        dienst.token_aus_code(
            code=code, client_id="https://claude.ai/x",
            redirect_uri="https://angreifer.example/cb", verifier=verifier,
        )


def test_abgelaufener_code_wird_abgelehnt() -> None:
    store: dict = {}
    dienst = _dienst(store)
    verifier = "e" * 64
    code = _code_anlegen(dienst, verifier)
    for zeile in store["mcp_auth_codes"]:
        zeile["expires_at"] = (
            datetime.now(UTC) - timedelta(minutes=5)
        ).isoformat()
    with pytest.raises(OAuthError):
        dienst.token_aus_code(
            code=code, client_id="https://claude.ai/x",
            redirect_uri="https://claude.ai/cb", verifier=verifier,
        )


def test_unlesbares_ablaufdatum_gilt_als_abgelaufen() -> None:
    """Fail-closed: ein unbekannter Ablauf darf nie als gültig durchgehen."""
    store: dict = {}
    dienst = _dienst(store)
    verifier = "f" * 64
    code = _code_anlegen(dienst, verifier)
    for zeile in store["mcp_auth_codes"]:
        zeile["expires_at"] = "kaputt"
    with pytest.raises(OAuthError):
        dienst.token_aus_code(
            code=code, client_id="https://claude.ai/x",
            redirect_uri="https://claude.ai/cb", verifier=verifier,
        )


# --- Refresh-Rotation ---------------------------------------------------------

def test_refresh_rotiert_und_alter_token_stirbt() -> None:
    store: dict = {}
    dienst = _dienst(store)
    verifier = "g" * 64
    code = _code_anlegen(dienst, verifier)
    erst = dienst.token_aus_code(
        code=code, client_id="https://claude.ai/x",
        redirect_uri="https://claude.ai/cb", verifier=verifier,
    )
    zweit = dienst.token_aus_refresh(
        refresh_token=erst["refresh_token"], client_id="https://claude.ai/x"
    )
    assert zweit["refresh_token"] != erst["refresh_token"]
    # Der alte Token ist verbraucht.
    with pytest.raises(OAuthError):
        dienst.token_aus_refresh(
            refresh_token=erst["refresh_token"], client_id="https://claude.ai/x"
        )


def test_refresh_wiederverwendung_verwirft_die_ganze_kette() -> None:
    """OAuth-2.1-Reuse-Detection: ein wiederverwendeter Token heißt Diebstahl —
    dann verlieren Angreifer UND echter Client den Zugang."""
    store: dict = {}
    dienst = _dienst(store)
    verifier = "h" * 64
    code = _code_anlegen(dienst, verifier)
    erst = dienst.token_aus_code(
        code=code, client_id="https://claude.ai/x",
        redirect_uri="https://claude.ai/cb", verifier=verifier,
    )
    zweit = dienst.token_aus_refresh(
        refresh_token=erst["refresh_token"], client_id="https://claude.ai/x"
    )
    with pytest.raises(OAuthError):
        dienst.token_aus_refresh(
            refresh_token=erst["refresh_token"], client_id="https://claude.ai/x"
        )
    # Auch der gültige Nachfolger ist jetzt weg.
    with pytest.raises(OAuthError):
        dienst.token_aus_refresh(
            refresh_token=zweit["refresh_token"], client_id="https://claude.ai/x"
        )


# --- Token-Audience (RFC 8707) ------------------------------------------------

def test_token_fuer_fremde_ressource_wird_abgelehnt() -> None:
    """Token-Passthrough ist verboten: ein Token für einen anderen Dienst darf
    hier nichts öffnen."""
    dienst = _dienst()
    verifier = "i" * 64
    code = _code_anlegen(dienst, verifier)
    out = dienst.token_aus_code(
        code=code, client_id="https://claude.ai/x",
        redirect_uri="https://claude.ai/cb", verifier=verifier,
    )
    import jwt

    with pytest.raises(jwt.InvalidAudienceError):
        dienst.token_pruefen(
            out["access_token"], resource="https://fremd.example/mcp"
        )


# --- CIMD ---------------------------------------------------------------------

def test_redirect_muss_registriert_sein() -> None:
    metadaten = {
        "client_id": "https://claude.ai/x",
        "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
    }
    assert McpOAuthService.redirect_erlaubt(
        metadaten, "https://claude.ai/api/mcp/auth_callback"
    )
    assert not McpOAuthService.redirect_erlaubt(
        metadaten, "https://angreifer.example/cb"
    )


def test_loopback_redirect_ignoriert_den_port() -> None:
    """RFC 8252 §7.3: native Clients binden zur Laufzeit einen freien Port."""
    metadaten = {
        "client_id": "https://claude.ai/code",
        "redirect_uris": ["http://127.0.0.1/callback"],
    }
    assert McpOAuthService.redirect_erlaubt(
        metadaten, "http://127.0.0.1:53127/callback"
    )
    # Ein anderer PFAD bleibt verboten — nur der Port ist frei.
    assert not McpOAuthService.redirect_erlaubt(
        metadaten, "http://127.0.0.1:53127/anders"
    )


def test_interne_client_id_wird_abgelehnt() -> None:
    """SSRF (Wurzel 8): die client_id-URL holt UNSER Server."""
    dienst = _dienst()
    for url in (
        "http://claude.ai/x",              # kein HTTPS
        "https://localhost/x",
        "https://127.0.0.1/x",
    ):
        with pytest.raises(OAuthError) as exc:
            dienst.client_metadaten(url)
        assert exc.value.code == "invalid_client"


# --- Zustimmung ---------------------------------------------------------------

def test_zustimmung_speichern_und_widerrufen() -> None:
    store: dict = {}
    dienst = _dienst(store)
    assert not dienst.hat_zugestimmt("u1", "https://claude.ai/x")
    dienst.zustimmen(
        tenant_id="t1", user_id="u1",
        client_id="https://claude.ai/x", scope="mcp:read",
    )
    assert dienst.hat_zugestimmt("u1", "https://claude.ai/x")
    dienst.zustimmung_widerrufen("u1", "https://claude.ai/x")
    assert not dienst.hat_zugestimmt("u1", "https://claude.ai/x")


# --- Endpunkte ----------------------------------------------------------------

from fastapi.testclient import TestClient  # noqa: E402

from src.main import create_app  # noqa: E402

client = TestClient(create_app())


def _rpc(methode: str, **params) -> dict:  # noqa: ANN003
    körper: dict = {"jsonrpc": "2.0", "id": 1, "method": methode}
    if params:
        körper["params"] = params
    return körper


def test_initialize_ohne_anmeldung_moeglich() -> None:
    """Lazy Auth: der Server muss ohne Token hinzufügbar sein."""
    antwort = client.post("/api/v1/mcp", json=_rpc("initialize"))
    assert antwort.status_code == 200
    assert antwort.json()["result"]["protocolVersion"]
    # Sitzungs-ID wird vergeben und trägt Zufall.
    assert antwort.headers.get("Mcp-Session-Id")


def test_tools_list_ohne_anmeldung_moeglich() -> None:
    antwort = client.post("/api/v1/mcp", json=_rpc("tools/list"))
    assert antwort.status_code == 200
    namen = {t["name"] for t in antwort.json()["result"]["tools"]}
    assert "posteingang_liste" in namen
    assert "kalender_verfuegbarkeit" in namen


def test_tools_call_ohne_token_gibt_echten_401() -> None:
    """DER kritische Test.

    Ein 200 mit `isError: true` erzeugt in Claude KEINEN Anmelde-Dialog,
    sondern nur Text im Chat — der Nutzer könnte sich nie verbinden. Nur ein
    echter HTTP-401 mit `WWW-Authenticate` löst den Verbindungs-Flow aus.
    """
    antwort = client.post(
        "/api/v1/mcp",
        json=_rpc("tools/call", name="buchungen_liste", arguments={}),
    )
    assert antwort.status_code == 401
    kopf = antwort.headers.get("WWW-Authenticate", "")
    assert kopf.startswith("Bearer ")
    assert "resource_metadata=" in kopf
    assert "oauth-protected-resource" in kopf


def test_discovery_liegt_auf_der_wurzel() -> None:
    """Clients suchen `/.well-known/...`, NICHT unter `/api/v1`."""
    for pfad in (
        "/.well-known/oauth-protected-resource",
        "/.well-known/oauth-protected-resource/api/v1/mcp",
    ):
        antwort = client.get(pfad)
        assert antwort.status_code == 200, pfad
        daten = antwort.json()
        # Die Ressource MUSS exakt die URL sein, die der Nutzer einträgt.
        assert daten["resource"].endswith("/api/v1/mcp")
        assert daten["authorization_servers"]


def test_authorization_server_metadata_waehlt_cimd() -> None:
    """Beide Felder sind nötig, sonst fällt Claude auf DCR zurück."""
    daten = client.get("/.well-known/oauth-authorization-server").json()
    assert daten["client_id_metadata_document_supported"] is True
    assert "none" in daten["token_endpoint_auth_methods_supported"]
    assert daten["code_challenge_methods_supported"] == ["S256"]
    assert "registration_endpoint" not in daten


def test_get_auf_mcp_ist_405() -> None:
    """Wir öffnen keinen Server→Client-Stream; die Spec erlaubt 405."""
    assert client.get("/api/v1/mcp").status_code == 405


def test_token_lehnt_unbekannten_grant_ab() -> None:
    antwort = client.post(
        "/api/v1/mcp/token",
        data={"grant_type": "client_credentials", "client_id": "x"},
    )
    assert antwort.status_code == 400
    assert antwort.json()["error"] == "unsupported_grant_type"


def test_authorize_verlangt_pkce() -> None:
    antwort = client.get("/api/v1/mcp/authorize", params={
        "client_id": "https://claude.ai/x",
        "redirect_uri": "https://claude.ai/cb",
        "code_challenge": "",
        "response_type": "code",
    }, follow_redirects=False)
    assert antwort.status_code == 400


def test_authorize_lehnt_plain_pkce_ab() -> None:
    """`plain` ist unsicher und von der MCP-Spec ausgeschlossen."""
    antwort = client.get("/api/v1/mcp/authorize", params={
        "client_id": "https://claude.ai/x",
        "redirect_uri": "https://claude.ai/cb",
        "code_challenge": "abc",
        "code_challenge_method": "plain",
    }, follow_redirects=False)
    assert antwort.status_code == 400


def test_discovery_nutzt_die_api_domain_nicht_das_dashboard() -> None:
    """Regressionsschutz für eine live gefundene Falle.

    `APP_BASE_URL` zeigt aufs DASHBOARD (app.mynextdays.com), die API läuft
    unter api.mynextdays.com. Stünde die Dashboard-Adresse in `resource`/
    `issuer`, zeigte die Discovery auf einen Host ohne MCP-Endpunkt — Claude
    meldete nur „Couldn't reach the MCP server", ohne die Ursache zu nennen.
    """
    dienst = _dienst()
    assert dienst.basis_url() == _BASIS
    assert "app.mynextdays.com" not in dienst.basis_url()


def test_ohne_public_api_url_klarer_fehler_statt_geratener_domain() -> None:
    """Wurzel 4: fehlt die Adresse, wird sie NICHT erfunden."""
    s = _settings()
    s.public_api_url = ""
    with pytest.raises(OAuthError) as exc:
        McpOAuthService(_db(), s).basis_url()
    assert exc.value.status_code == 503
