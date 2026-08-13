"""MCP-Connector: Streamable HTTP + OAuth-Discovery. Gemountet unter /api/v1.

DER 401 IST DAS PROTOKOLL. Ein unauthentifizierter `tools/call` MUSS als echter
HTTP-401 mit `WWW-Authenticate` scheitern — und zwar BEVOR die JSON-RPC-Schicht
ihn sieht. Eine 200-Antwort mit `isError: true` erzeugt in Claude KEINEN
Verbindungs-Dialog, sondern nur Text im Chat („please sign in"), und der Nutzer
kann sich nicht anmelden. Das ist die häufigste Fehlerquelle beim Bau eines
Connectors, deshalb steht die Prüfung ganz oben im POST-Handler.

`initialize` und `tools/list` bleiben offen (Lazy Authentication): so kann
Claude den Server hinzufügen, die Werkzeuge sehen und erst beim ersten echten
Aufruf nach Anmeldung fragen.

SESSIONS SIND KEINE AUTHENTIFIZIERUNG (MCP-Security-Spec): Jeder Request wird
einzeln am Bearer-Token geprüft. Die Session-ID bindet nur den Gesprächsfaden
und trägt die Nutzer-ID in sich (`<user_id>:<zufall>`), damit eine geratene ID
niemanden übernimmt.
"""
from __future__ import annotations

import base64
import json
import secrets
from pathlib import Path
from typing import Annotated
from urllib.parse import quote, urlencode, urlparse

import jwt
from fastapi import APIRouter, Depends, Form, Header, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse

from src.core.config import Settings, get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext, CurrentUser
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .oauth_service import (
    SCOPE_LESEN,
    UNTERSTUETZTE_SCOPES,
    McpOAuthService,
    OAuthError,
)
from .schemas import (
    ConsentRequest,
    ConsentResponse,
    SliceHealth,
    UmfangAenderung,
    Verbindung,
    VerbindungListe,
    Zugriff,
    ZugriffListe,
)
from .tools import McpTools

log = get_logger("nextdays.mcp")

router = APIRouter(tags=["mcp"])

# Discovery MUSS auf der Domain-WURZEL liegen: Clients suchen
# `/.well-known/...`, nicht `/api/v1/.well-known/...`. Eigener Router,
# den main.py ohne das /api/v1-Präfix einhängt.
discovery_router = APIRouter(tags=["mcp"])

# Der MCP-Endpunkt. Die Protected-Resource-Metadata muss GENAU diese URL als
# `resource` führen — inklusive Pfad, so wie der Nutzer sie in Claude einträgt.
MCP_PFAD = "/api/v1/mcp"

# Protokollversion, die dieser Server spricht.
PROTOKOLL_VERSION = "2025-06-18"

# JSON-RPC-Fehlercodes (Spezifikation).
_RPC_METHODE_UNBEKANNT = -32601
_RPC_INTERNER_FEHLER = -32603

# Obergrenze der Protokoll-Abfrage (Wurzel 8) — die Tabelle wächst mit jedem
# Abruf, ein ungedeckeltes `limit` wäre ein Vollabzug.
_ZUGRIFFE_MAX = 500

_MEDIENTYP = "application/json"

_STATIC = Path(__file__).parent / "static"


def _logo_data_uri() -> str | None:
    """Das 48px-Logo als `data:`-URI für `serverInfo.icons`.

    Als Data-URI statt als URL, weil Clients ein Icon ohne Zugangsdaten laden
    und die Herkunft prüfen sollen (Spec) — ein eingebettetes Bild braucht
    beides nicht. Bei 48×48 sind das ~1,7 kB, vertretbar in jeder
    `initialize`-Antwort; ein größeres Format gehörte hinter eine URL.

    Fehlt die Datei, entfällt das Feld — ein Icon ist Beiwerk und darf den
    Verbindungsaufbau nicht kippen.
    """
    pfad = _STATIC / "logo-48.png"
    try:
        roh = pfad.read_bytes()
    except OSError:  # noqa: BLE001 — Beiwerk, nie den Hauptpfad kippen
        log.warning("mcp.logo_fehlt", extra={"pfad": str(pfad)})
        return None
    return "data:image/png;base64," + base64.b64encode(roh).decode("ascii")


def _server_info() -> dict:
    """`serverInfo` für `initialize`.

    `title` ist der Anzeigename, `name` bleibt die programmatische Kennung
    (Spec: `BaseMetadata`). `icons`/`websiteUrl` sind erst ab Revision
    2025-11-25 im Schema und werden von claude.ai derzeit nicht ausgewertet —
    sie stehen hier, weil andere MCP-Clients sie schon heute rendern und es
    ohne sie nie ein Logo geben kann.
    """
    info: dict = {
        "name": "myNextDays",
        "title": "myNextDays",
        "version": "1.0.0",
        "websiteUrl": "https://mynextdays.com",
    }
    logo = _logo_data_uri()
    if logo:
        info["icons"] = [
            {"src": logo, "mimeType": "image/png", "sizes": ["48x48"]}
        ]
    return info


_SERVER_INFO = _server_info()


def _service(settings: Settings) -> McpOAuthService:
    return McpOAuthService(get_service_client(), settings)


def _api_basis(settings: Settings) -> str:
    """Öffentliche Adresse DIESER API — Grundlage aller Discovery-Angaben.

    `public_api_url` ist die bestehende Einstellung dafür (sie speist bereits den
    Channex-Webhook-Callback und die TrustedHost-Liste) — bewusst KEINE eigene
    MCP-Variable: zwei Einstellungen für dieselbe Adresse laufen irgendwann
    auseinander, und dann zeigt die Discovery woanders hin als der Webhook.

    NICHT `app_base_url`: das ist das Dashboard (app.mynextdays.com), die API
    läuft unter api.mynextdays.com. Nur die Weiterleitung zum Zustimmungsdialog
    nutzt bewusst die Dashboard-Adresse.
    """
    return (settings.public_api_url or "").rstrip("/")


def _ressource(settings: Settings) -> str:
    return f"{_api_basis(settings)}{MCP_PFAD}"


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

@discovery_router.get("/.well-known/oauth-protected-resource")
@discovery_router.get("/.well-known/oauth-protected-resource/api/v1/mcp")
def protected_resource_metadata(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    """RFC 9728. Sagt dem Client, WO der Authorization-Server steht.

    Zwei Pfade, weil Clients bei einer Ressource MIT Pfadanteil zuerst die
    pfad-suffigierte Variante probieren (RFC 9728 §3.1) und erst danach die
    Wurzel.
    """
    basis = _api_basis(settings)
    return {
        "resource": _ressource(settings),
        "authorization_servers": [basis],
        "bearer_methods_supported": ["header"],
        "scopes_supported": list(UNTERSTUETZTE_SCOPES),
    }


@discovery_router.get("/.well-known/oauth-authorization-server")
def authorization_server_metadata(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    """RFC 8414. Beschreibt unseren Authorization-Server.

    `client_id_metadata_document_supported` UND `"none"` in
    `token_endpoint_auth_methods_supported` sind BEIDE nötig, damit Claude CIMD
    wählt: sein CIMD-Client meldet sich als öffentlicher Client ohne Secret an.
    Fehlt eines von beiden, fällt Claude auf Dynamic Client Registration zurück
    und sucht einen `registration_endpoint`, den wir bewusst nicht anbieten.
    """
    basis = _api_basis(settings)
    return {
        "issuer": basis,
        "authorization_endpoint": f"{basis}/api/v1/mcp/authorize",
        "token_endpoint": f"{basis}/api/v1/mcp/token",
        "scopes_supported": list(UNTERSTUETZTE_SCOPES),
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_methods_supported": ["none"],
        "code_challenge_methods_supported": ["S256"],
        "client_id_metadata_document_supported": True,
    }


# ---------------------------------------------------------------------------
# Autorisierung (Zustimmungsdialog)
# ---------------------------------------------------------------------------

@router.get("/mcp/authorize")
def authorize(
    settings: Annotated[Settings, Depends(get_settings)],
    client_id: str,
    redirect_uri: str,
    code_challenge: str,
    response_type: str = "code",
    code_challenge_method: str = "S256",
    scope: str = SCOPE_LESEN,
    state: str = "",
    resource: str = "",
) -> RedirectResponse:
    """Einstieg des OAuth-Flows: prüfen, dann ins Dashboard weiterleiten.

    Die Zustimmungsseite liegt im WEB-DASHBOARD, nicht hier. Grund: Die API
    kennt nur den `Authorization`-Header, ein Browser-Formular trägt keinen.
    Eine hier gerenderte Seite könnte den Nutzer also gar nicht identifizieren
    — sie müsste ein eigenes Login bauen, das neben dem echten steht.

    Was hier passiert, ist die SICHERHEITSPRÜFUNG, bevor der Nutzer überhaupt
    etwas sieht: PKCE-Pflicht, CIMD-Dokument holen, `redirect_uri` exakt gegen
    die registrierten prüfen. Erst danach wird weitergeleitet — eine nicht
    registrierte URI erreicht nie den Zustimmungsdialog.
    """
    if response_type != "code":
        raise HTTPException(400, "response_type muss 'code' sein.")
    if code_challenge_method != "S256":
        # `plain` ist unsicher und von der MCP-Spec ausgeschlossen.
        raise HTTPException(400, "code_challenge_method muss 'S256' sein.")
    if not code_challenge:
        raise HTTPException(400, "code_challenge fehlt (PKCE ist Pflicht).")

    dienst = _service(settings)
    try:
        metadaten = dienst.client_metadaten(client_id)
    except OAuthError as exc:
        raise HTTPException(exc.status_code, exc.beschreibung) from exc
    if not dienst.redirect_erlaubt(metadaten, redirect_uri):
        # NIE auf eine nicht registrierte URI weiterleiten — das wäre der
        # offene Redirect, über den der Code abfließt.
        raise HTTPException(400, "redirect_uri ist für diesen Client nicht registriert.")

    unbekannt = set(scope.split()) - set(UNTERSTUETZTE_SCOPES)
    if unbekannt:
        raise HTTPException(400, f"Unbekannte Scopes: {' '.join(sorted(unbekannt))}")

    # HIER bewusst `app_base_url`: der Zustimmungsdialog liegt im DASHBOARD,
    # nicht in dieser API. Alle Discovery-Angaben nutzen dagegen `_api_basis`.
    dashboard = (settings.app_base_url or "").rstrip("/")
    if not dashboard:
        raise HTTPException(503, "app_base_url nicht gesetzt.")
    frage = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code_challenge": code_challenge,
        "scope": scope,
        "state": state,
        "resource": resource or _ressource(settings),
        # Der angezeigte Antragsteller: der HOST der client_id-URL, nicht der
        # `client_name` aus dem Dokument — das Dokument ist selbst-behauptet,
        # der Host ist die einzige geprüfte Identität (MCP-Security-Spec).
        "host": _host(client_id),
    })
    return RedirectResponse(
        f"{dashboard}/konto/verbindungen/erlauben?{frage}", 302
    )


@router.post("/mcp/consent")
def consent(
    settings: Annotated[Settings, Depends(get_settings)],
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_CONNECTIONS))],
    req: ConsentRequest,
) -> ConsentResponse:
    """Zustimmung speichern und Code ausstellen; liefert das Rückleitungsziel.

    Der Nutzer wird über sein PMS-JWT identifiziert — der Code hängt damit an
    einem echten Konto samt Tenant, nicht an etwas, das der Client behauptet
    (Wurzel 3). Das Dashboard leitet danach auf `weiter_zu`.

    AUTORISIERUNG, NICHT NUR AUTHENTIFIZIERUNG (Wurzel 9): Der Guard ist
    `MANAGE_CONNECTIONS`, nicht `CurrentUser`. Eine Verbindung gibt Gastnamen
    und komplette Nachrichtenverläufe an einen Dienst ausserhalb unserer
    Systeme heraus — das ist die Weisung des Verantwortlichen zur Übermittlung
    in ein Drittland (Art. 28 Abs. 3 lit. a DSGVO), und die kann nur erteilen,
    wer den Betrieb vertritt. Ohne diese Prüfung könnte eine Reinigungskraft
    ihr PRIVATES Konto verbinden; mangels Weisung wären wir für diese
    Übermittlung nach Art. 28 Abs. 10 selbst verantwortlich.

    Die Rolle kommt dabei aus der DB, nicht aus dem JWT (Wurzel 7): Die
    erteilte Verbindung überlebt das Token um 30 Tage, ein entzogenes Recht
    muss also sofort wirken.
    """
    if not ctx.tenant_id:
        raise HTTPException(400, "Kein Tenant im Konto.")
    dienst = _service(settings)
    try:
        metadaten = dienst.client_metadaten(req.client_id)
    except OAuthError as exc:
        raise HTTPException(exc.status_code, exc.beschreibung) from exc
    # Erneut prüfen, nicht auf die authorize-Prüfung vertrauen: dieser Aufruf
    # ist eigenständig erreichbar (Wurzel 3 — der Anfrage nicht vertrauen).
    if not dienst.redirect_erlaubt(metadaten, req.redirect_uri):
        raise HTTPException(400, "redirect_uri ist für diesen Client nicht registriert.")
    unbekannt = set(req.scope.split()) - set(UNTERSTUETZTE_SCOPES)
    if unbekannt:
        raise HTTPException(400, f"Unbekannte Scopes: {' '.join(sorted(unbekannt))}")

    dienst.zustimmen(
        tenant_id=ctx.tenant_id, user_id=ctx.user_id,
        client_id=req.client_id, scope=req.scope,
    )
    code = dienst.code_ausstellen(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        client_id=req.client_id,
        redirect_uri=req.redirect_uri,
        code_challenge=req.code_challenge,
        scope=req.scope,
        resource=req.resource or _ressource(settings),
    )
    trenner = "&" if "?" in req.redirect_uri else "?"
    ziel = f"{req.redirect_uri}{trenner}code={code}"
    if req.state:
        ziel = f"{ziel}&state={quote(req.state, safe='')}"
    return ConsentResponse(weiter_zu=ziel)


@router.get("/mcp/verbindungen", response_model=VerbindungListe)
def verbindungen(ctx: CurrentUser) -> VerbindungListe:
    """Erteilte Zustimmungen des angemeldeten Nutzers (Konto → Verbindungen)."""
    zeilen = (
        get_service_client()
        .table("mcp_consents")
        .select("client_id, scope, created_at")
        .eq("user_id", ctx.user_id)
        .is_("revoked_at", "null")
        .order("created_at", desc=True)
        .execute()
    ).data or []
    return VerbindungListe(items=[
        Verbindung(
            client_id=str(z["client_id"]),
            host=_host(str(z["client_id"])),
            scope=str(z.get("scope") or ""),
            erteilt_am=str(z.get("created_at") or ""),
        )
        for z in zeilen
    ])


@router.get("/mcp/zugriffe", response_model=ZugriffListe)
def zugriffe(
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_CONNECTIONS))],
    limit: int = 100,
) -> ZugriffListe:
    """Protokollierte Abrufe über Verbindungen dieses Betriebs (0388).

    Tenant-weit, nicht nur die eigenen: Der Betrieb muss sehen können, was ALLE
    Verbindungen abgerufen haben — sonst kann er eine Auskunft nach Art. 15
    DSGVO nicht erteilen. Deshalb dieselbe Fähigkeit wie beim Erteilen; wer
    keine Verbindung erlauben darf, sieht auch das Protokoll nicht.
    """
    obergrenze = min(max(limit, 1), _ZUGRIFFE_MAX)
    zeilen = (
        get_service_client()
        .table("mcp_access_log")
        .select("client_id, werkzeug, ziel_id, anzahl, scopes, erfolg, created_at")
        .eq("tenant_id", ctx.tenant_id)
        .order("created_at", desc=True)
        .limit(obergrenze)
        .execute()
    ).data or []
    return ZugriffListe(items=[
        Zugriff(
            host=_host(str(z.get("client_id") or "")),
            werkzeug=str(z.get("werkzeug") or ""),
            ziel_id=str(z["ziel_id"]) if z.get("ziel_id") else None,
            anzahl=int(z.get("anzahl") or 0),
            scopes=str(z.get("scopes") or ""),
            erfolg=bool(z.get("erfolg")),
            zeitpunkt=str(z.get("created_at") or ""),
        )
        for z in zeilen
    ])


@router.delete("/mcp/verbindungen", status_code=204)
def verbindung_trennen(
    settings: Annotated[Settings, Depends(get_settings)],
    ctx: CurrentUser,
    client_id: str,
) -> None:
    """Verbindung trennen. Bestehende Token laufen aus, neue gibt es nicht mehr.

    Zusätzlich werden die Refresh-Token dieses Clients gelöscht — sonst könnte
    der Client sich nach dem Trennen noch bis zu 30 Tage neue Access-Token
    holen, und „getrennt" wäre eine Falschaussage.
    """
    dienst = _service(settings)
    dienst.zustimmung_widerrufen(ctx.user_id, client_id)
    get_service_client().table("mcp_refresh_tokens").delete().eq(
        "user_id", ctx.user_id
    ).eq("client_id", client_id).execute()


# ---------------------------------------------------------------------------
# Token
# ---------------------------------------------------------------------------

@router.patch("/mcp/verbindungen", response_model=Verbindung)
def verbindung_umfang(
    settings: Annotated[Settings, Depends(get_settings)],
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CONNECTIONS))
    ],
    req: UmfangAenderung,
) -> Verbindung:
    """Freitexte einer bestehenden Verbindung zu- oder abschalten.

    Bisher war der Umfang nur beim Verbinden wählbar; wer die Freitexte später
    brauchte, musste trennen und neu verbinden. Der Hinweis in den Werkzeugen
    versprach zugleich eine Freigabe „unter Konto → Verbindungen", die es dort
    nicht gab — dieser Endpunkt löst das ein.

    DERSELBE GUARD wie beim Verbinden (`MANAGE_CONNECTIONS`, Wurzel 9):
    Freitexte sind Nachrichteninhalte und Notizen; sie zuzuschalten ist
    dieselbe Entscheidung wie das Verbinden selbst, nur später getroffen.

    Beim ABSCHALTEN werden zusätzlich die Refresh-Token gelöscht, damit die
    Rücknahme sofort wirkt und nicht erst nach Ablauf des Access-Tokens.
    """
    dienst = _service(settings)
    try:
        neuer_scope = dienst.umfang_aendern(
            user_id=ctx.user_id,
            client_id=req.client_id,
            freitexte=req.freitexte,
        )
    except OAuthError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.beschreibung
        ) from exc
    log.info(
        "mcp.umfang_geaendert",
        extra={"client_id": req.client_id, "freitexte": req.freitexte},
    )
    return Verbindung(
        client_id=req.client_id,
        host=_host(req.client_id),
        scope=neuer_scope,
        erteilt_am="",
    )


@router.post("/mcp/token")
def token(
    settings: Annotated[Settings, Depends(get_settings)],
    grant_type: Annotated[str, Form()],
    client_id: Annotated[str, Form()],
    code: Annotated[str, Form()] = "",
    redirect_uri: Annotated[str, Form()] = "",
    code_verifier: Annotated[str, Form()] = "",
    refresh_token: Annotated[str, Form()] = "",
) -> JSONResponse:
    """Token-Endpunkt. Nimmt `application/x-www-form-urlencoded` (RFC 6749).

    Claude schickt Code-Tausch UND Refresh in diesem Format — ein JSON-only
    Parser antwortete hier mit 415 und der Flow bräche ohne erkennbaren Grund
    ab.
    """
    dienst = _service(settings)
    try:
        if grant_type == "authorization_code":
            if not code or not redirect_uri or not code_verifier:
                raise OAuthError(
                    "invalid_request",
                    "code, redirect_uri und code_verifier sind Pflicht.",
                )
            daten = dienst.token_aus_code(
                code=code, client_id=client_id,
                redirect_uri=redirect_uri, verifier=code_verifier,
            )
        elif grant_type == "refresh_token":
            if not refresh_token:
                raise OAuthError("invalid_request", "refresh_token fehlt.")
            daten = dienst.token_aus_refresh(
                refresh_token=refresh_token, client_id=client_id
            )
        else:
            raise OAuthError(
                "unsupported_grant_type", f"grant_type '{grant_type}' wird nicht unterstützt."
            )
    except OAuthError as exc:
        # RFC-6749-konforme Fehlercodes: Claude erkennt `invalid_grant` als
        # „neu anmelden" — ein eigener Code oder `invalid_request` an dieser
        # Stelle ließe den Client stattdessen endlos wiederholen.
        return JSONResponse(
            {"error": exc.code, "error_description": exc.beschreibung},
            status_code=exc.status_code if exc.status_code >= 400 else 400,
        )
    return JSONResponse(daten)


# ---------------------------------------------------------------------------
# MCP-Endpunkt (Streamable HTTP)
# ---------------------------------------------------------------------------

def _www_authenticate(settings: Settings) -> str:
    basis = _api_basis(settings)
    return (
        'Bearer error="invalid_token", '
        'error_description="Anmeldung erforderlich", '
        f'resource_metadata="{basis}/.well-known/oauth-protected-resource'
        '/api/v1/mcp", '
        f'scope="{SCOPE_LESEN}"'
    )


def _kontext_aus_token(
    authorization: str | None, settings: Settings
) -> tuple[AuthContext, frozenset[str], str] | None:
    """Bearer-Token → (Kontext, Scopes, client_id). `None` ohne gültiges Token.

    Kein Fehler bei ungültig: der Aufrufer entscheidet, ob dieser Request
    überhaupt Auth braucht (Lazy Authentication).
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    roh = authorization.split(" ", 1)[1].strip()
    try:
        nutzlast = _service(settings).token_pruefen(
            roh, resource=_ressource(settings)
        )
    except (jwt.PyJWTError, OAuthError):
        return None
    ctx = AuthContext(
        user_id=str(nutzlast.get("sub") or ""),
        tenant_id=str(nutzlast.get("tenant_id") or "") or None,
        # Die ROLLE kommt bewusst NICHT aus diesem Token: sie wird im Service
        # aus der DB gelesen (Wurzel 7). Ein Token, das eine Rolle mitbrächte,
        # würde eine entzogene Berechtigung bis zum Ablauf weitergelten lassen.
        role=None,
    )
    # Scopes AUS DEM TOKEN, nicht aus der Anfrage (Wurzel 3): sie stehen in der
    # signierten Nutzlast und sind damit das, wozu der Betrieb zugestimmt hat.
    scopes = frozenset(str(nutzlast.get("scope") or "").split())
    return ctx, scopes, str(nutzlast.get("client_id") or "")


@router.post("/mcp")
async def mcp_endpunkt(  # pylint: disable=too-many-return-statements
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> JSONResponse:
    """Der MCP-Endpunkt. Nimmt einzelne JSON-RPC-Nachrichten entgegen.

    Die vielen Rückgabepunkte sind hier die klarere Form: jede JSON-RPC-Methode
    ist ein eigener, kurzer Zweig mit eigener Antwortform. In eine gemeinsame
    Variable gesammelt und am Ende einmal zurückgegeben, wäre der Zusammenhang
    zwischen Methode und Antwort schlechter zu sehen, nicht besser.
    """
    try:
        nachricht = await request.json()
    except (ValueError, json.JSONDecodeError):
        return JSONResponse(
            {"jsonrpc": "2.0", "id": None,
             "error": {"code": _RPC_INTERNER_FEHLER, "message": "Ungültiges JSON"}},
            status_code=400,
        )

    methode = str(nachricht.get("method") or "")
    rpc_id = nachricht.get("id")
    angemeldet = _kontext_aus_token(authorization, settings)
    ctx = angemeldet[0] if angemeldet else None
    scopes = angemeldet[1] if angemeldet else frozenset()
    client_id = angemeldet[2] if angemeldet else ""

    # DER LAZY-AUTH-GATE. Muss VOR jeder Werkzeug-Ausführung stehen und ein
    # echter HTTP-401 sein — nur darauf zeigt Claude den Anmelde-Dialog.
    if methode == "tools/call" and ctx is None:
        return JSONResponse(
            {"error": "invalid_token",
             "error_description": "Anmeldung erforderlich"},
            status_code=401,
            headers={"WWW-Authenticate": _www_authenticate(settings)},
        )

    if methode == "initialize":
        # Session-ID trägt die Nutzer-ID (falls schon angemeldet) plus Zufall:
        # eine geratene ID gehört damit nie zu einem fremden Konto. Sie ist
        # KEINE Authentifizierung — jeder Request prüft weiter sein Token.
        kennung = f"{(ctx.user_id if ctx else 'anon')}:{secrets.token_urlsafe(24)}"
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "id": rpc_id,
                "result": {
                    "protocolVersion": PROTOKOLL_VERSION,
                    "capabilities": {"tools": {}},
                    "serverInfo": _SERVER_INFO,
                },
            },
            headers={"Mcp-Session-Id": kennung},
        )

    if methode == "notifications/initialized":
        # Benachrichtigung ohne Antwortkörper (Spec: 202).
        return JSONResponse(None, status_code=202)

    if methode == "tools/list":
        return JSONResponse({
            "jsonrpc": "2.0", "id": rpc_id,
            "result": {"tools": McpTools.katalog()},
        })

    if methode == "tools/call":
        params = nachricht.get("params") or {}
        name = str(params.get("name") or "")
        argumente = params.get("arguments") or {}
        try:
            ergebnis = McpTools(ctx, scopes, client_id).ausfuehren(name, argumente)
        except ValueError as exc:
            # FACHLICHER Fehler (unbekanntes Werkzeug, fehlendes Argument,
            # fremde ID): als Werkzeug-Fehler zurück, nicht als Transportfehler.
            # Das Modell kann darauf reagieren; ein 4xx bräche die Verbindung.
            return JSONResponse({
                "jsonrpc": "2.0", "id": rpc_id,
                "result": {
                    "content": [{"type": "text", "text": str(exc)}],
                    "isError": True,
                },
            })
        return JSONResponse({
            "jsonrpc": "2.0", "id": rpc_id,
            "result": {
                "content": [{
                    "type": "text",
                    "text": json.dumps(ergebnis, ensure_ascii=False, default=str),
                }],
            },
        })

    return JSONResponse({
        "jsonrpc": "2.0", "id": rpc_id,
        "error": {"code": _RPC_METHODE_UNBEKANNT,
                  "message": f"Unbekannte Methode: {methode}"},
    })


@router.get("/mcp")
def mcp_stream() -> JSONResponse:
    """GET auf den MCP-Endpunkt: wir öffnen keinen Server→Client-Stream.

    Die Spec erlaubt darauf ausdrücklich 405 — der Server schickt von sich aus
    nichts, alle Antworten kommen auf dem POST. Ein leerer SSE-Stream wäre eine
    Attrappe, die Verbindungen offen hält, ohne je etwas zu senden.
    """
    return JSONResponse(
        {"error": "method_not_allowed",
         "error_description": "Dieser Server sendet keine unaufgeforderten Nachrichten."},
        status_code=405,
    )


@router.delete("/mcp")
def mcp_session_beenden() -> JSONResponse:
    """Sitzung beenden.

    Wir halten keinen Sitzungszustand — die Session-ID bindet nur den
    Gesprächsfaden, jeder Request weist sich einzeln per Token aus. Es gibt
    also nichts freizugeben; 204 bestätigt das dem Client.
    """
    return JSONResponse(None, status_code=204)


def _host(url: str) -> str:
    """Host der client_id-URL — die einzige geprüfte Identität eines Clients."""
    return urlparse(url).hostname or url


@router.get("/mcp/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="mcp")
