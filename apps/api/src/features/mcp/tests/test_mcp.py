"""Tests für den MCP-Connector: OAuth-Flow, Discovery und Werkzeuge."""
from datetime import UTC, date, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from src.core.config import Settings
from src.core.security import AuthContext
from src.features.auth.permissions import Capability
from src.features.mcp.oauth_service import (
    SCOPE_FREITEXT,
    SCOPE_LESEN,
    SCOPE_SCHREIBEN,
    UNTERSTUETZTE_SCOPES,
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

def _code_anlegen(
    dienst: McpOAuthService, verifier: str, scope: str = "mcp:read"
) -> str:
    """Wie im echten Flow: erst zustimmen, dann Code ausstellen.

    Die Zustimmung gehört dazu — `token_pruefen` prüft sie gegen, damit ein
    getrennter Client nicht noch eine Stunde weiterliest. Ein Test, der sie
    überspringt, würde die Trennung stillschweigend wirkungslos machen.

    `scope` ist überschreibbar, damit auch der Freitext-Fall (0389) über
    denselben Weg entsteht statt über eine handgebaute Fake-Zeile.
    """
    dienst.zustimmen(
        tenant_id="t1", user_id="u1",
        client_id="https://claude.ai/x", scope=scope,
    )
    return dienst.code_ausstellen(
        tenant_id="t1", user_id="u1",
        client_id="https://claude.ai/x", redirect_uri="https://claude.ai/cb",
        code_challenge=_pkce_challenge(verifier), scope=scope,
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


def test_getrennte_verbindung_sperrt_das_access_token_sofort() -> None:
    """Trennen wirkt SOFORT, nicht erst nach Ablauf des Tokens.

    Das Access-Token ist ein signiertes JWT mit einer Stunde Laufzeit. Ohne
    Gegenprüfung der Zustimmung könnte ein getrennter Client noch bis zu 60
    Minuten weiterlesen — „getrennt" wäre dann eine Falschaussage in der
    Oberfläche und im AVV.
    """
    store: dict = {}
    dienst = _dienst(store)
    verifier = "c" * 64
    code = _code_anlegen(dienst, verifier)
    out = dienst.token_aus_code(
        code=code, client_id="https://claude.ai/x",
        redirect_uri="https://claude.ai/cb", verifier=verifier,
    )
    ressource = f"{_BASIS}/api/v1/mcp"
    # Vorher: das Token trägt.
    assert dienst.token_pruefen(out["access_token"], resource=ressource)["sub"] == "u1"

    dienst.zustimmung_widerrufen("u1", "https://claude.ai/x")

    # Nachher: dasselbe, unveränderte Token wird abgewiesen.
    with pytest.raises(OAuthError) as fehler:
        dienst.token_pruefen(out["access_token"], resource=ressource)
    assert fehler.value.status_code == 401


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


def _kontext() -> AuthContext:
    """Der Kontext, wie der MCP-Router ihn baut: MIT Tenant, OHNE Rolle.

    Ein echter `AuthContext` und kein Stub — die Werkzeuge leiten daraus per
    `model_copy` den Kontext für die Services ab, und `role=None` ist genau
    der Zustand, dessen Behandlung hier geprüft wird.
    """
    return AuthContext(
        user_id="11111111-1111-1111-1111-111111111111",
        tenant_id="22222222-2222-2222-2222-222222222222",
        role=None,
    )


def _werkzeuge(*scopes: str) -> object:
    """McpTools mit den angegebenen Scopes, ohne DB-Zugriff."""
    from unittest.mock import patch

    from src.features.mcp.tools import McpTools

    with patch("src.features.mcp.tools.get_service_client", return_value=MagicMock()):
        return McpTools(_kontext(), frozenset(scopes), "https://claude.ai/x")


def test_freitext_ist_nicht_teil_des_lese_scopes() -> None:
    """`mcp:read` allein gibt KEINE Notizen und keine Nachrichtentexte frei.

    Freitexte enthalten regelmäßig Gesundheitsangaben („Rollstuhl",
    „Allergie") — nach EuGH C-252/21 Rn. 89 macht ein einziges sensibles
    Element das GESAMTE Feld zu Art.-9-Daten. Deshalb eigener Scope, default
    aus (Art. 25 Abs. 2 DSGVO).
    """
    nur_lesen = _werkzeuge(SCOPE_LESEN)
    assert nur_lesen._darf_freitext() is False  # noqa: SLF001

    mit_freitext = _werkzeuge(SCOPE_LESEN, SCOPE_FREITEXT)
    assert mit_freitext._darf_freitext() is True  # noqa: SLF001


def test_verlauf_und_notizen_ohne_freigabe_gesperrt() -> None:
    """Ohne Freitext-Scope wird gar nicht erst geladen (Art. 25 Abs. 1).

    Und der Fehler MUSS erklären, warum — ein leeres Ergebnis liesse das
    Modell „dazu ist nichts hinterlegt" antworten statt „dafür fehlt die
    Freigabe" (Wurzel 4).
    """
    werkzeuge = _werkzeuge(SCOPE_LESEN)

    for name, args in (
        ("posteingang_verlauf", {"thread_id": "t1"}),
        ("buchung_notizen", {"buchung_id": "b1"}),
    ):
        with pytest.raises(ValueError, match="nicht freigegeben"):
            werkzeuge.ausfuehren(name, args)


def test_freitext_scope_wird_unterstuetzt_und_ist_bekannt() -> None:
    """Der Scope muss in der Liste stehen, sonst lehnt `/consent` ihn ab."""
    assert SCOPE_FREITEXT in UNTERSTUETZTE_SCOPES
    assert SCOPE_LESEN in UNTERSTUETZTE_SCOPES
    # Zwei getrennte Werte — nicht versehentlich derselbe String.
    assert SCOPE_FREITEXT != SCOPE_LESEN


def test_umfang_zaehlt_die_ausgegebenen_datensaetze() -> None:
    """Der Zugriffslog muss einen Massenabruf von einem Einzelabruf trennen."""
    from src.features.mcp.tools import _umfang

    assert _umfang({"anzahl": 3, "buchungen": [1, 2, 3]}) == 3
    assert _umfang({"threads": []}) == 0
    # Einzelabruf ohne Liste (buchung_detail) zählt als 1, nicht als 0.
    assert _umfang({"id": "x", "gast": "y"}) == 1


def test_consent_verlangt_verbindungs_recht() -> None:
    """Nicht jeder eingeloggte Nutzer darf verbinden (Wurzel 9).

    Eine Verbindung gibt Gastdaten an einen Dienst ausserhalb unserer Systeme
    heraus — das ist die Weisung zur Drittlandübermittlung nach
    Art. 28 Abs. 3 lit. a DSGVO. Ohne Recht: 401/403, nie 200.
    """
    antwort = client.post("/api/v1/mcp/consent", json={
        "client_id": "https://claude.ai/oauth/mcp-oauth-client-metadata",
        "redirect_uri": "https://claude.ai/api/mcp/auth_callback",
        "code_challenge": "x" * 43,
        "scope": SCOPE_LESEN,
    })
    # 503 = Ratelimit fail-closed ohne Redis (s. test_authorize_verlangt_pkce).
    # Entscheidend ist: NIE 200 ohne Berechtigung.
    assert antwort.status_code in (401, 403, 503)
    assert antwort.status_code != 200


def test_jedes_werkzeug_hat_anzeigenamen_mit_umlauten() -> None:
    """Ohne `title` formt der Client den `name` um: „Kalender verfuegbarkeit".

    Der `name` bleibt ASCII (er wird programmatisch adressiert), deshalb MUSS
    der Anzeigename ein eigenes Feld sein. Reihenfolge laut Spec:
    `title` → `annotations.title` → `name`; beide werden gesetzt, weil ältere
    Clients nur die Annotation kennen.
    """
    antwort = client.post("/api/v1/mcp", json=_rpc("tools/list"))
    werkzeuge = antwort.json()["result"]["tools"]
    assert werkzeuge

    for w in werkzeuge:
        assert w["title"], f"{w['name']} ohne title"
        assert w["annotations"]["title"] == w["title"]
        # Nur lesende Werkzeuge — der Client darf das anzeigen.
        assert w["annotations"]["readOnlyHint"] is True
        # Der name bleibt maschinenlesbar, nicht der Anzeigetext.
        assert w["name"].isascii()
        assert w["name"] == w["name"].lower()

    titel = {w["name"]: w["title"] for w in werkzeuge}
    assert titel["kalender_verfuegbarkeit"] == "Kalender-Verfügbarkeit"


def test_server_info_traegt_anzeigename_und_logo() -> None:
    """Marke korrekt geschrieben, Icon eingebettet statt verlinkt."""
    ergebnis = client.post("/api/v1/mcp", json=_rpc("initialize")).json()["result"]
    info = ergebnis["serverInfo"]
    assert info["name"] == "myNextDays"
    assert info["title"] == "myNextDays"
    # Data-URI: kein Netzabruf, keine Herkunftsprüfung nötig.
    assert info["icons"][0]["src"].startswith("data:image/png;base64,")
    assert info["icons"][0]["mimeType"] == "image/png"


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
    # 503 ist hier KEIN Fehlschlag: ohne erreichbares Redis sperrt der
    # Ratelimiter sensible Pfade bewusst fail-closed
    # (`rate_limit_fail_closed_sensitive`). Der Test prüft, dass ohne PKCE
    # NIE weitergeleitet wird — die Abweisung selbst darf aus beiden Gründen
    # kommen. Ein hart auf 400 festgenagelter Test wäre abhängig davon, wie
    # viele Tests vorher denselben Bucket benutzt haben.
    assert antwort.status_code in (400, 503)


def test_authorize_lehnt_plain_pkce_ab() -> None:
    """`plain` ist unsicher und von der MCP-Spec ausgeschlossen."""
    antwort = client.get("/api/v1/mcp/authorize", params={
        "client_id": "https://claude.ai/x",
        "redirect_uri": "https://claude.ai/cb",
        "code_challenge": "abc",
        "code_challenge_method": "plain",
    }, follow_redirects=False)
    # 503 = Ratelimit fail-closed ohne Redis, s. test_authorize_verlangt_pkce.
    assert antwort.status_code in (400, 503)


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


# --- Umfang nachträglich ändern (0389) --------------------------------------


def test_umfang_aendern_verlangt_verbindungs_recht() -> None:
    """Freitexte zuzuschalten ist dieselbe Entscheidung wie das Verbinden.

    Nachrichteninhalte und Notizen an einen Dienst ausserhalb unserer Systeme
    zu geben, ist nach Art. 28 Abs. 3 lit. a DSGVO eine Weisung — sie darf
    nicht davon abhängen, ob jemand zufällig eingeloggt ist (Wurzel 9).
    """
    antwort = client.patch("/api/v1/mcp/verbindungen", json={
        "client_id": "https://claude.ai/oauth/mcp-oauth-client-metadata",
        "freitexte": True,
    })
    # 503 = Ratelimit fail-closed ohne Redis (s. test_authorize_verlangt_pkce).
    assert antwort.status_code in (401, 403, 503)
    assert antwort.status_code != 200


def test_umfang_entzug_schneidet_den_token_sofort_zu() -> None:
    """Der ENTZUG der Freitexte muss sofort wirken, nicht in einer Stunde.

    Der Scope steht IM Access-Token und gilt 60 Minuten. Nimmt der Nutzer die
    Freitexte zurück, wäre die Zustimmungszeile sofort schmaler, das bereits
    ausgestellte Token aber weiterhin breit — die Verbindung lieferte eine
    Stunde lang Nachrichteninhalte, die niemand mehr freigegeben hat.

    `token_pruefen` schneidet den Scope deshalb auf das zu, was die DB sagt.
    """
    store: dict = {}
    dienst = _dienst(store)
    verifier = "d" * 64
    code = _code_anlegen(dienst, verifier, scope=f"{SCOPE_LESEN} {SCOPE_FREITEXT}")
    out = dienst.token_aus_code(
        code=code, client_id="https://claude.ai/x",
        redirect_uri="https://claude.ai/cb", verifier=verifier,
    )
    ressource = f"{_BASIS}/api/v1/mcp"

    # Vorher: die Freitexte sind im Token UND in der Zustimmung.
    vorher = dienst.token_pruefen(out["access_token"], resource=ressource)
    assert SCOPE_FREITEXT in vorher["scope"].split()

    dienst.umfang_aendern(
        user_id="u1", client_id="https://claude.ai/x", freitexte=False
    )

    # Nachher: dasselbe, unveraenderte Token traegt sie nicht mehr.
    nachher = dienst.token_pruefen(out["access_token"], resource=ressource)
    assert SCOPE_FREITEXT not in nachher["scope"].split()
    assert SCOPE_LESEN in nachher["scope"].split()


def test_umfang_zuschalten_wirkt_ohne_neu_zu_verbinden() -> None:
    """Der eigentliche Zweck: Freitexte nachtraeglich freigeben.

    Bisher musste man trennen und neu verbinden — waehrend der Werkzeug-Text
    eine Freigabe „unter Konto → Verbindungen" versprach, die es nicht gab.
    """
    store: dict = {}
    dienst = _dienst(store)
    verifier = "e" * 64
    code = _code_anlegen(dienst, verifier, scope=f"{SCOPE_LESEN} {SCOPE_FREITEXT}")
    out = dienst.token_aus_code(
        code=code, client_id="https://claude.ai/x",
        redirect_uri="https://claude.ai/cb", verifier=verifier,
    )
    ressource = f"{_BASIS}/api/v1/mcp"

    dienst.umfang_aendern(
        user_id="u1", client_id="https://claude.ai/x", freitexte=False
    )
    assert SCOPE_FREITEXT not in dienst.token_pruefen(
        out["access_token"], resource=ressource
    )["scope"].split()

    neuer = dienst.umfang_aendern(
        user_id="u1", client_id="https://claude.ai/x", freitexte=True
    )
    assert SCOPE_FREITEXT in neuer.split()


def test_umfang_unbekannter_verbindung_ist_404() -> None:
    """Fail-closed: eine Verbindung, die es nicht gibt, wird nicht angelegt."""
    dienst = _dienst({})
    with pytest.raises(OAuthError) as fehler:
        dienst.umfang_aendern(
            user_id="u1", client_id="https://fremd.example/x", freitexte=True
        )
    assert fehler.value.status_code == 404


# --- Schreib-Werkzeuge und der zentrale Riegel (14.08.2026) --------------------
#
# Diese Tests decken die Stelle ab, an der der MCP-Pfad sich vom Web-Pfad
# unterscheidet: Dort erzwingt die Route die Berechtigung, hier muss es das
# Werkzeug selbst tun. Ein Fehler darin wäre nicht sichtbar — die Aufrufe
# gingen einfach durch.


def test_schreiben_ohne_scope_ist_gesperrt() -> None:
    """`mcp:read` allein darf NICHTS verändern.

    Der wichtigste einzelne Test dieser Datei: Fiele er aus, könnte eine
    Verbindung, der der Betrieb nur das Lesen erlaubt hat, Preise setzen und
    Buchungen stornieren — live auf allen Portalen.
    """
    nur_lesen = _werkzeuge(SCOPE_LESEN)
    with pytest.raises(ValueError, match="nur lesen"):
        nur_lesen.ausfuehren(  # type: ignore[attr-defined]
            "kalender_sperren",
            {"objekt_id": "p1", "start": "2026-09-01", "ende": "2026-09-05"},
        )


def test_katalog_zeigt_nur_erlaubte_werkzeuge() -> None:
    """Ohne Schreib-Scope wird kein Schreibwerkzeug ANGEBOTEN.

    Sonst versuchte das Modell einen Aufruf, der am Riegel scheitert, und der
    Nutzer sähe eine Fehlermeldung statt eines Ergebnisses.
    """
    from src.features.mcp.tools import McpTools

    schreibend = {
        name for name, wz in McpTools._WERKZEUGE.items() if wz.schreibt  # noqa: SLF001
    }
    assert schreibend, "Es muss Schreibwerkzeuge geben"

    ohne = {t["name"] for t in McpTools.katalog(frozenset({SCOPE_LESEN}))}
    assert not (ohne & schreibend), "Schreibwerkzeug ohne Scope angeboten"

    mit = {
        t["name"]
        for t in McpTools.katalog(frozenset({SCOPE_LESEN, SCOPE_SCHREIBEN}))
    }
    assert schreibend <= mit


def test_schreibwerkzeuge_sind_als_veraendernd_markiert() -> None:
    """`readOnlyHint=False` + `destructiveHint` an JEDEM Schreibwerkzeug.

    Daran erkennt der Client, dass er vor der Ausführung fragen soll. Ein
    Schreibwerkzeug, das sich als „nur lesend" ausgibt, würde ohne Rückfrage
    ausgeführt.
    """
    from src.features.mcp.tools import McpTools

    for eintrag in McpTools.katalog(frozenset({SCOPE_LESEN, SCOPE_SCHREIBEN})):
        wz = McpTools._WERKZEUGE[eintrag["name"]]  # noqa: SLF001
        hinweise = eintrag["annotations"]
        assert hinweise["readOnlyHint"] is not wz.schreibt
        if wz.schreibt:
            assert hinweise.get("destructiveHint") is True, eintrag["name"]


def test_jedes_schreibwerkzeug_verlangt_ein_recht() -> None:
    """Kein Schreibwerkzeug ohne Capability oder Permission.

    Fängt den wahrscheinlichsten künftigen Fehler: ein neues Werkzeug wird
    eingetragen, die Rechte werden vergessen, und der Scope allein entscheidet.
    """
    from src.features.mcp.tools import McpTools

    ohne = [
        name
        for name, wz in McpTools._WERKZEUGE.items()  # noqa: SLF001
        if wz.schreibt and not wz.caps and not wz.perms
    ]
    assert not ohne, f"Schreibwerkzeug ohne Rechteprüfung: {ohne}"


def test_registry_und_katalog_bleiben_deckungsgleich() -> None:
    """Jedes beschriebene Werkzeug hat einen Eintrag — und umgekehrt.

    Ein Katalogeintrag ohne Registry-Eintrag wäre ein angebotenes Werkzeug,
    das beim Aufruf „unbekannt" meldet; umgekehrt ein Werkzeug, das existiert,
    aber niemand findet.
    """
    from src.features.mcp.tools import McpTools

    katalog = {e["name"] for e in McpTools._KATALOG}  # noqa: SLF001
    registry = set(McpTools._WERKZEUGE)  # noqa: SLF001
    assert katalog == registry, f"Abweichung: {katalog ^ registry}"

    for name, wz in McpTools._WERKZEUGE.items():  # noqa: SLF001
        assert hasattr(McpTools, wz.handler), f"{name}: Handler {wz.handler} fehlt"


def test_kein_werkzeug_fuer_den_kontobereich() -> None:
    """Der Konto-Bereich hat KEIN Werkzeug — auch kein lesendes.

    Abo, Rechnungen, Nutzerverwaltung, Sicherheit und die MCP-Verbindungen
    selbst bleiben der Oberfläche vorbehalten. Besonders die Verbindungen:
    Könnte der Connector seinen eigenen Scope ändern, wäre jede Begrenzung
    hier nur eine Bitte.
    """
    from src.features.mcp.tools import McpTools

    verboten = (
        "konto", "abo", "rechnung", "nutzer", "billing",
        "verbindung", "sicherheit", "api_zugang", "mitarbeiter",
    )
    treffer = [
        name
        for name in McpTools._WERKZEUGE  # noqa: SLF001
        if any(wort in name for wort in verboten)
    ]
    assert not treffer, f"Konto-Werkzeug gefunden: {treffer}"


def test_schreib_zeitraum_ist_gedeckelt() -> None:
    """Wurzel 8: kein unbegrenzter Zeitraum in einem Schreibaufruf."""
    from src.features.mcp.grenzen import MAX_SCHREIB_TAGE

    wz = _werkzeuge(SCOPE_LESEN, SCOPE_SCHREIBEN)
    with pytest.raises(ValueError, match="Zeitraum zu groß"):
        wz._schreib_zeitraum(  # noqa: SLF001
            {"start": "2026-01-01", "ende": "2030-01-01"}
        )
    # Die Grenze selbst ist erlaubt (kein Off-by-one).
    start = date(2026, 1, 1)
    gerade_noch = wz._schreib_zeitraum(  # noqa: SLF001
        {
            "start": start.isoformat(),
            "ende": (start + timedelta(days=MAX_SCHREIB_TAGE)).isoformat(),
        }
    )
    assert (gerade_noch.end - gerade_noch.start).days == MAX_SCHREIB_TAGE


def test_scope_wird_nie_doppelt_gespeichert() -> None:
    """Der Scope steht normalisiert in der Zustimmung.

    Live stand `mcp:read mcp:freetext mcp:freetext` in der Tabelle, weil der
    Zustimmungsdialog den Wert an einen Scope anhängte, der ihn schon enthielt.
    Wirkungslos, aber ein Wert, dem man nicht ansieht, ob er stimmt.
    """
    from src.features.mcp.oauth_service import scope_bauen, scope_normalisieren

    assert scope_normalisieren(
        f"{SCOPE_LESEN} {SCOPE_FREITEXT} {SCOPE_FREITEXT}"
    ) == f"{SCOPE_LESEN} {SCOPE_FREITEXT}"
    # Unbekanntes fällt heraus, statt mitgeschleppt zu werden.
    assert scope_normalisieren(f"{SCOPE_LESEN} mcp:erfunden") == SCOPE_LESEN
    assert scope_bauen() == SCOPE_LESEN
    assert SCOPE_SCHREIBEN in scope_bauen(schreiben=True)


def test_umfang_aendern_laesst_schreibrecht_unberuehrt() -> None:
    """Freitexte umschalten darf eine Schreibfreigabe nicht stillschweigend
    entziehen — sonst nimmt ein Häkchen ein anderes Recht mit."""
    store: dict = {}
    dienst = _dienst(store)
    dienst.zustimmen(
        tenant_id="t1", user_id="u1", client_id="https://claude.ai/x",
        scope=f"{SCOPE_LESEN} {SCOPE_SCHREIBEN}",
    )
    neu = dienst.umfang_aendern(
        user_id="u1", client_id="https://claude.ai/x", freitexte=True
    )
    assert SCOPE_SCHREIBEN in neu.split(), "Schreibrecht ging verloren"
    assert SCOPE_FREITEXT in neu.split()


def test_service_bekommt_die_rolle_aus_der_db() -> None:
    """`ctx()` trägt die Rolle — sonst greift KEIN Objekt-Scope.

    Der schwerwiegendste Fehler des ersten Baus (Review 14.08.2026): Der
    Router setzt `role=None`, damit ein entzogenes Recht nicht bis zum
    Token-Ablauf weitergilt. Die Objekt-Scopes der Services lesen aber genau
    dieses Feld — `is_owner(ctx)` und `is_staff(ctx)`. Mit `None` sind beide
    `False`, und die Einschränkung „nur meine Objekte" fällt ersatzlos weg:
    ein Eigentümer hätte über MCP alle Buchungen des Mandanten gesehen.
    """
    from src.features.auth.owner_scope import is_owner
    from src.features.auth.staff_scope import is_staff

    wz = _werkzeuge(SCOPE_LESEN)
    wz._rolle_cache = "owner"  # noqa: SLF001
    wz._rechte_cache = None  # noqa: SLF001

    # Der ROHE Kontext würde den Scope abschalten …
    assert is_owner(wz._ctx) is False  # noqa: SLF001
    # … der Kontext für die Services schaltet ihn ein.
    assert is_owner(wz.ctx()) is True  # noqa: SLF001

    wz._rolle_cache = "cleaner"  # noqa: SLF001
    assert is_staff(wz.ctx()) is True  # noqa: SLF001


def test_entzogenes_pm_dach_wirkt_auch_ueber_mcp() -> None:
    """`ACCESS_PM_FEATURES` entzogen → auch der Connector darf nicht mehr.

    `require_permission` prüft im Router zusätzlich zum Rollen-Set das
    PM-Dach. Prüfte der Riegel nur die rohe Rollen-Fähigkeit, wäre der PM-
    Bereich in der Oberfläche dicht, während derselbe Nutzer über MCP weiter
    Preise setzen und sperren könnte.
    """
    from unittest.mock import patch

    from src.features.mcp.tools import McpTools

    werkzeug = McpTools._WERKZEUGE["kalender_sperren"]  # noqa: SLF001

    mit_dach = _werkzeuge(SCOPE_LESEN, SCOPE_SCHREIBEN)
    mit_dach._rolle_cache = "co_admin"  # noqa: SLF001
    mit_dach._rechte_cache = ["access_pm_features"]  # noqa: SLF001

    ohne_dach = _werkzeuge(SCOPE_LESEN, SCOPE_SCHREIBEN)
    ohne_dach._rolle_cache = "co_admin"  # noqa: SLF001
    ohne_dach._rechte_cache = []  # noqa: SLF001

    with patch("src.features.mcp.tools.load_permission", return_value=True):
        mit_dach._rechte_pruefen("kalender_sperren", werkzeug)  # noqa: SLF001
        with pytest.raises(ValueError, match="nicht erlaubt"):
            ohne_dach._rechte_pruefen(  # noqa: SLF001
                "kalender_sperren", werkzeug
            )


def test_kein_service_aufruf_mit_rohem_kontext() -> None:
    """Kein Handler darf `self._ctx` an einen Service geben.

    Statische Absicherung gegen den Rückfall: `self._ctx` ist nur für den
    Zugriffslog, den Mandanten und die Nutzer-ID gedacht. Wer ihn an einen
    Service reicht, nimmt dem Aufruf die Rolle — und damit den Objekt-Scope.
    """
    import ast
    import inspect

    from src.features.mcp import stammdaten, tools

    # Über den Syntaxbaum, NICHT über den Quelltext als Zeichenkette:
    # Kommentare und Docstrings erwähnen `self._ctx` zu Recht, und eine
    # Textsuche würde daran hängenbleiben statt an echten Aufrufen.
    #
    # BEIDE Dateien: die Stammdaten-Werkzeuge (Objekte, Eigentümer) liegen in
    # einem eigenen Modul und rufen dieselben Services — der Schutz muss dort
    # genauso greifen, sonst prüft er nur die Hälfte.
    baum = ast.parse(
        inspect.getsource(tools) + "\n" + inspect.getsource(stammdaten)
    )
    erlaubte_attribute = {"tenant_id", "user_id", "model_copy"}

    def ist_roher_kontext(knoten: ast.AST) -> bool:
        """`self._ctx` als GANZES Objekt — nicht `self._ctx.user_id`."""
        return (
            isinstance(knoten, ast.Attribute)
            and knoten.attr == "_ctx"
            and isinstance(knoten.value, ast.Name)
            and knoten.value.id == "self"
        )

    for knoten in ast.walk(baum):
        # Ein Attributzugriff DARAUF (self._ctx.user_id) ist erlaubt …
        if isinstance(knoten, ast.Attribute) and ist_roher_kontext(knoten.value):
            assert knoten.attr in erlaubte_attribute, (
                f"Unerwarteter Zugriff auf den rohen Kontext: ._{knoten.attr}"
            )
        # … als ARGUMENT eines Aufrufs ist er es nie.
        if isinstance(knoten, ast.Call):
            for arg in [*knoten.args, *(k.value for k in knoten.keywords)]:
                assert not ist_roher_kontext(arg), (
                    "Roher Kontext (self._ctx) an einen Aufruf übergeben — "
                    "das nimmt ihm die Rolle und damit den Objekt-Scope. "
                    "Richtig ist self.ctx()."
                )


# --- Objekt- und Eigentümerverwaltung (14.08.2026) ----------------------------


def test_objektverwaltung_folgt_den_rechten_des_routers() -> None:
    """Anlegen/Löschen und reines Ändern hängen an VERSCHIEDENEN Rechten.

    Der Router trennt das bewusst: `MANAGE_PROPERTY_SETTINGS` fürs Anlegen,
    Löschen und Veröffentlichen, `EDIT_PROPERTY` fürs Pflegen, ein eigenes
    Recht für Bilder. Ein Betrieb kann jemandem also das Pflegen erlauben,
    ohne ihm das Löschen zu geben — würden hier alle unter einem Recht
    stehen, wäre diese Abstufung still verschwunden.
    """
    from src.features.auth.granular_permissions import Permission
    from src.features.mcp.tools import McpTools

    def perms(name: str) -> set:
        return set(McpTools._WERKZEUGE[name].perms)  # noqa: SLF001

    assert perms("objekt_anlegen") == {Permission.MANAGE_PROPERTY_SETTINGS}
    assert perms("objekt_loeschen") == {Permission.MANAGE_PROPERTY_SETTINGS}
    assert perms("objekt_veroeffentlichen") == {
        Permission.MANAGE_PROPERTY_SETTINGS
    }
    assert perms("objekt_aendern") == {Permission.EDIT_PROPERTY}
    assert perms("objekt_foto_loeschen") == {
        Permission.PM_MANAGE_PROPERTY_IMAGES
    }


def test_portalzugang_verlangt_zusaetzlich_benutzerverwaltung() -> None:
    """Einen LOGIN anzulegen ist Nutzerverwaltung, nicht Eigentümerpflege.

    Der Router verlangt für den Portalzugang MANAGE_OWNERS **und**
    MANAGE_STAFF. Ohne die zweite Fähigkeit wäre „Eigentümer verwalten" ein
    Umweg, um sich Zugänge zu verschaffen.
    """
    from src.features.mcp.tools import McpTools

    caps = set(
        McpTools._WERKZEUGE["eigentuemer_portalzugang_einladen"].caps  # noqa: SLF001
    )
    assert caps == {Capability.MANAGE_OWNERS, Capability.MANAGE_STAFF}


def test_eigentuemer_anlegen_mit_portalzugang_braucht_staff() -> None:
    """Die BEDINGTE Prüfung des Routers wirkt auch hier.

    `create` verlangt MANAGE_STAFF nur, wenn `portalzugang=true` gesetzt ist —
    eine statische Rechtetabelle kann das nicht abbilden, deshalb liegt die
    Bedingung im Handler. Ohne sie wäre „lege einen Eigentümer mit
    Portalzugang an" der Umweg zur Nutzerverwaltung.
    """
    # `owner` hat weder MANAGE_OWNERS noch MANAGE_STAFF — die Rollen, die
    # MANAGE_OWNERS tragen (admin, co_admin), haben MANAGE_STAFF ohnehin.
    # Geprüft wird hier die Bedingung selbst, nicht eine Rollenkombination.
    wz = _werkzeuge(SCOPE_LESEN, SCOPE_SCHREIBEN)
    wz._rolle_cache = "owner"  # noqa: SLF001
    wz._rechte_cache = []  # noqa: SLF001

    with pytest.raises(ValueError, match="Benutzer zu verwalten"):
        wz._eigentuemer_anlegen(  # noqa: SLF001
            {"name": "Test", "portalzugang": True}
        )

    # Ein admin darf denselben Aufruf — der Riegel hält ihn nicht auf.
    admin = _werkzeuge(SCOPE_LESEN, SCOPE_SCHREIBEN)
    admin._rolle_cache = "admin"  # noqa: SLF001
    admin._rechte_cache = ["access_pm_features"]  # noqa: SLF001
    admin._require_staff("Test")  # noqa: SLF001 — wirft nicht


def test_email_aendern_braucht_benutzerverwaltung() -> None:
    """Die E-Mail ist die Anmeldung — sie zu ändern greift in den Login ein."""
    wz = _werkzeuge(SCOPE_LESEN, SCOPE_SCHREIBEN)
    wz._rolle_cache = "owner"  # noqa: SLF001
    wz._rechte_cache = []  # noqa: SLF001

    with pytest.raises(ValueError, match="Benutzer zu verwalten"):
        wz._eigentuemer_aendern(  # noqa: SLF001
            {"eigentuemer_id": "o1", "email": "neu@example.com"}
        )


def test_objekt_anlegen_erfindet_keine_waehrung() -> None:
    """Wurzel 4: `currency` hat bewusst keinen Vorgabewert.

    In 27 EU-Ländern wäre ein geratenes „EUR" schlicht falsch. Fehlt die
    Währung, muss sie später bewusst gesetzt werden — nie hier ergänzt.
    """
    from src.features.properties.schemas import PropertyCreate

    assert PropertyCreate.model_fields["currency"].default is None
    # Und im Katalog steht der Grund, damit ein Modell nicht doch rät.
    from src.features.mcp.katalog import SCHREIB_KATALOG

    eintrag = next(
        e for e in SCHREIB_KATALOG if e["name"] == "objekt_anlegen"
    )
    beschreibung = eintrag["inputSchema"]["properties"]["currency"]["description"]
    assert "kein Standardwert" in beschreibung


def test_einheitenzahl_ist_gedeckelt() -> None:
    """Wurzel 8 — und die Zahl deckt sich mit dem Schema (1 bis 200)."""
    from src.features.mcp.grenzen import MAX_EINHEITEN

    wz = _werkzeuge(SCOPE_LESEN, SCOPE_SCHREIBEN)
    for falsch in (0, MAX_EINHEITEN + 1):
        with pytest.raises(ValueError, match="zwischen 1 und"):
            wz._einheiten_setzen(  # noqa: SLF001
                {"objekt_id": "p1", "anzahl": falsch}
            )


def test_abschnitt_aendern_loescht_die_anderen_reiter_nicht() -> None:
    """`type_attributes` trägt NEUN Reiter — einer darf die anderen nie kippen.

    Standort, Kontakt, Compliance, Richtlinien, Nachrichten-Platzhalter,
    Preise, Verfügbarkeit, Belegung und Betten liegen alle in EINEM Feld. Die
    Oberfläche mischt deshalb (`{...alt, neu}`). Wer das Feld naiv
    durchreicht, pflegt einen Reiter und löscht acht — ein Assistent, der die
    Compliance-Angaben setzt, hätte die Adresse mitgenommen (Wurzel 1).
    """
    from unittest.mock import MagicMock

    wz = _werkzeuge(SCOPE_LESEN, SCOPE_SCHREIBEN)
    wz._rolle_cache = "admin"  # noqa: SLF001
    wz._rechte_cache = ["access_pm_features"]  # noqa: SLF001

    bestand = MagicMock()
    bestand.type_attributes = {
        "location": {"anfahrt": "A7 bis Flensburg"},
        "policies": {"haustiere": True},
        "compliance": {"melderecht": "alt", "nummer": "DK-1"},
    }
    dienst = MagicMock()
    dienst.get.return_value = bestand

    gemischt = wz._abschnitt_mischen(  # noqa: SLF001
        dienst, "p1", "compliance", {"melderecht": "neu"}
    )

    # Die fremden Abschnitte stehen unverändert …
    assert gemischt["location"] == {"anfahrt": "A7 bis Flensburg"}
    assert gemischt["policies"] == {"haustiere": True}
    # … der eigene ist gemischt, nicht ersetzt: `nummer` überlebt.
    assert gemischt["compliance"] == {"melderecht": "neu", "nummer": "DK-1"}


def test_unbekannter_abschnitt_wird_abgelehnt() -> None:
    """Fail-closed: ein Tippfehler legt keinen neuen Abschnitt an.

    Sonst entstünde stillschweigend ein `complience`-Zweig, den keine
    Oberfläche je anzeigt — die Angaben wären eingegeben und unsichtbar.
    """
    from unittest.mock import MagicMock

    wz = _werkzeuge(SCOPE_LESEN, SCOPE_SCHREIBEN)
    with pytest.raises(ValueError, match="Unbekannter Abschnitt"):
        wz._abschnitt_mischen(  # noqa: SLF001
            MagicMock(), "p1", "complience", {"x": 1}
        )


def test_mixins_verdecken_die_echten_methoden_nicht() -> None:
    """`ctx()` und `_tenant()` müssen die ECHTEN Implementierungen sein.

    Beide Mixins deklarieren sie mit `NotImplementedError`, damit die
    Prüfwerkzeuge die Rückgabetypen kennen. Stünde `McpTools` in der
    Auflösungsreihenfolge hinter einem Mixin, gewänne der Stub — und jeder
    Werkzeug-Aufruf bräche. Schlimmer noch bei einer stillen Variante: ein
    Stub, der `None` zurückgäbe, nähme jedem Service-Aufruf die Rolle und
    damit den Objekt-Scope.
    """
    from src.features.mcp.stammdaten import StammdatenMixin
    from src.features.mcp.tools import McpTools
    from src.features.mcp.vertrieb import VertriebMixin

    assert McpTools.ctx is not StammdatenMixin.ctx
    assert McpTools.ctx is not VertriebMixin.ctx
    assert McpTools._tenant is not VertriebMixin._tenant  # noqa: SLF001

    wz = _werkzeuge(SCOPE_LESEN)
    wz._rolle_cache = "admin"  # noqa: SLF001
    wz._rechte_cache = []  # noqa: SLF001
    assert wz.ctx().role == "admin"
    assert wz._tenant()  # noqa: SLF001 — kein leerer Mandant


def test_kartei_merge_bewahrt_bestehende_felder() -> None:
    """Die Kartei-PUTs ersetzen den GANZEN Abschnitt — deshalb wird gemischt.

    Ein PUT mit nur einem Feld würde die übrigen auf `None` setzen: Wer das
    Unterschriftsdatum nachträgt, verlöre das Datum des Erstgesprächs. Der
    Weg über `model_dump(mode="json")` muss dabei auch Datumsfelder heil
    lassen — sie werden zu Text und wieder zurück.
    """
    from datetime import date as _date

    from src.features.property_dossier.schemas import ProcessData

    vorher = ProcessData(
        first_meeting_at=_date(2026, 3, 1), contract_sent_at=_date(2026, 3, 5)
    )
    gemischt = ProcessData(
        **{**vorher.model_dump(mode="json"), "contract_signed_at": "2026-03-10"}
    )
    assert gemischt.first_meeting_at == _date(2026, 3, 1)
    assert gemischt.contract_sent_at == _date(2026, 3, 5)
    assert gemischt.contract_signed_at == _date(2026, 3, 10)


def test_saison_modus_wird_geprueft() -> None:
    """Nur `percent` und `fixed` — ein anderer Wert ist ein Fehler.

    Das Schema kennt genau diese beiden. Ein durchgereichter Tippfehler
    schlüge erst im Service auf, mit einer Meldung, die das Modell nicht
    zuordnen kann.
    """
    wz = _werkzeuge(SCOPE_LESEN, SCOPE_SCHREIBEN)
    with pytest.raises(ValueError, match="percent"):
        wz._saison_anlegen(  # noqa: SLF001
            {"objekt_id": "p1", "name": "X", "modus": "quatsch", "betrag": 1}
        )


def test_grundpreis_erfindet_keine_waehrung() -> None:
    """Wurzel 4: fehlt die Objektwährung, wird sie NICHT geraten.

    `RatePlanCreate.currency` ist Pflicht. Ein voreingestelltes „EUR" ginge
    als falscher Preis an die Portale — in Dänemark, Schweden, Polen und
    zwanzig weiteren Ländern schlicht der falsche Betrag.
    """
    from unittest.mock import MagicMock, patch

    from src.features.rates.schemas import RatePlanCreate

    assert RatePlanCreate.model_fields["currency"].is_required()

    leer = MagicMock()
    leer.table.return_value.select.return_value.eq.return_value.eq.return_value\
        .limit.return_value.execute.return_value.data = [{"currency": None}]
    with patch("src.features.mcp.tools.get_service_client", return_value=leer):
        from src.features.mcp.tools import McpTools

        wz = McpTools(_kontext(), frozenset({SCOPE_LESEN}), "c")
        with pytest.raises(ValueError, match="keine Währung"):
            wz._objektwaehrung("p1")  # noqa: SLF001


def test_kartei_merge_kippt_kein_gesetztes_ja_auf_nein() -> None:
    """Der gefährlichste Fall des Merges: ein `True` mit Default `False`.

    `HousebookData.physical_folder_placed` ist `bool = False`. Würde der Merge
    das Feld verlieren, käme nicht `None` heraus, sondern der Default — aus
    „Ordner liegt aus" würde stillschweigend „liegt nicht aus", und niemand
    sähe einen Fehler. Genau diese Sorte Verlust ist der Grund, warum hier
    gemischt statt ersetzt wird.
    """
    from src.features.property_dossier.schemas import (
        EmergencyAuthority,
        HousebookData,
    )

    bestand = HousebookData(
        welcome_text_status="fertig", physical_folder_placed=True
    )
    gemischt = HousebookData(
        **{**bestand.model_dump(mode="json"), "welcome_text_status": "in Arbeit"}
    )
    assert gemischt.physical_folder_placed is True
    assert gemischt.welcome_text_status == "in Arbeit"

    # Ein bewusst gesetztes False bleibt False — kein „nur wahre Werte zählen".
    aus = HousebookData(
        **{**bestand.model_dump(mode="json"), "physical_folder_placed": False}
    )
    assert aus.physical_folder_placed is False

    # Auch Zahl und Währung überleben (Wurzel 4: keine stille Nullung).
    vollmacht = EmergencyAuthority(
        authority_mode="limit", authority_limit=5000.0, currency="DKK"
    )
    neu = EmergencyAuthority(
        **{**vollmacht.model_dump(mode="json"), "authority_mode": "unbegrenzt"}
    )
    assert neu.authority_limit == 5000.0
    assert neu.currency == "DKK"
