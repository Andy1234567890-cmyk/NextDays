"""Auth-Hülle: verifiziert Supabase-JWT und stellt AuthContext bereit.

Modernes Supabase signiert Access-Tokens mit **ES256** (asymmetrisch, JWKS).
Ältere Projekte nutzen **HS256** mit einem Shared Secret. Dieser Code unterstützt
beide: zuerst JWKS/ES256 (anhand des `kid` im Token-Header), sonst HS256-Fallback.

Die Rollen-/Tenant-Auflösung erfolgt aus den JWT-Claims (`app_metadata`) — keine
Platzhalter-Akzeptanz beliebiger Tokens.
"""
import contextlib
import secrets
from functools import lru_cache
from typing import Annotated

import jwt
import structlog
from fastapi import Depends, Header, HTTPException, Request, status
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError
from pydantic import BaseModel

from .config import Settings, get_settings

# Erlaubte Signatur-Algorithmen (fail-closed). ES256/RS256 = modernes Supabase via
# JWKS, HS256 = Legacy-Shared-Secret. "none" ist bewusst NICHT enthalten.
_ALLOWED_ALGS = frozenset({"HS256", "ES256", "RS256"})

# Toleranz für Uhrendrift zwischen GoTrue-Container (stellt aus) und API-Container
# (prüft). Ohne sie lehnt `exp`/`iat`/`nbf` ein frisch ausgestelltes bzw. ein
# gerade noch gültiges Token wegen Sekundenbruchteilen ab — für den Nutzer eine
# grundlose Abmeldung. 30 s ist klein genug, um die Lebensdauer eines Tokens
# nicht nennenswert zu verlängern.
_CLOCK_SKEW_SEKUNDEN = 30


class AuthContext(BaseModel):
    user_id: str
    tenant_id: str | None = None
    role: str | None = None
    # Die GoTrue-Session-ID dieses Access-Tokens (Claim session_id). Erlaubt es
    # Endpunkten, die AKTUELLE Sitzung zu erkennen (z. B. „auf allen anderen
    # Geräten abmelden" ohne sich selbst auszusperren). Bei API-Client-Tokens None.
    session_id: str | None = None
    # Authenticator Assurance Level dieses Tokens, direkt aus dem GoTrue-Claim
    # `aal` (aal1 = nur Passwort/OAuth, aal2 = zweiter Faktor geloest). Fehlt
    # der Claim, steht hier "aal1" — die restriktivere Annahme, nie "aal2"
    # (Wurzel 4/5: kein Fallback auf den bequemen Wert).
    aal: str = "aal1"
    # Nur gesetzt, wenn der Request über einen Entwickler-API-Token kommt
    # (Client-Credentials), nicht über ein Supabase-Login-Token. Erlaubt den
    # Endpunkten, Scope + Objekt-Beschränkung des API-Clients durchzusetzen
    # (Wurzel 3/9). Bei normalem Login bleiben diese Felder None.
    api_scopes: list[str] | None = None
    api_property_ids: list[str] | None = None
    api_is_test: bool | None = None


@lru_cache
def _jwk_client(jwks_url: str) -> PyJWKClient:
    """Cacht die öffentlichen Schlüssel pro JWKS-URL (kein Fetch je Request).

    `lifespan` bewusst lang und `cache_keys=True`: mit den PyJWT-Defaults
    (300 s, kein Key-Cache) muss der Prozess alle fünf Minuten frisch gegen das
    interne Kong holen. Genau dort reißt bekanntermaßen die Keep-Alive-
    Verbindung ab (siehe `core.supabase`) — und ein Fehlschlag in diesem Moment
    lässt JEDEN gleichzeitigen Request fehlschlagen. Signierschlüssel rotieren
    selten; ein längeres Fenster senkt die Zahl der Fetches drastisch.
    """
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)


def _jwks_url(settings: Settings) -> str:
    return f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _decode_token(token: str, settings: Settings) -> dict[str, object]:
    """Verifiziert ES256 (JWKS) oder HS256 (Shared Secret) je nach Token-Header."""
    try:
        alg = jwt.get_unverified_header(token).get("alg")
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiges oder abgelaufenes Token.",
        ) from exc

    # Härtung (Security-Audit V2): Der Branch-Zweig unten wird durch den
    # angreiferkontrollierten `alg`-Header ausgewählt. Ein aktiver Algorithm-
    # Confusion-Angriff (Public Key als HMAC-Secret) ist bereits ausgeschlossen,
    # weil HS256 ein SEPARATES Shared Secret nutzt (nicht den JWKS-Public-Key).
    # Zusätzlich lehnen wir hier jeden nicht erwarteten Algorithmus (inkl. "none")
    # explizit VOR dem Verzweigen ab (fail-closed, kein Rückgriff auf Defaults).
    if alg not in _ALLOWED_ALGS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiges oder abgelaufenes Token.",
        )

    try:
        if alg == "HS256":
            secret = settings.supabase_jwt_secret.get_secret_value()
            if not secret:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="JWT-Secret nicht konfiguriert.",
                )
            return jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience="authenticated",
                leeway=_CLOCK_SKEW_SEKUNDEN,
            )
        # Asymmetrisch (ES256/RS256): öffentlichen Schlüssel via JWKS holen.
        try:
            signing_key = _jwk_client(
                _jwks_url(settings)
            ).get_signing_key_from_jwt(token)
        except PyJWKClientConnectionError as exc:
            # Wurzel 5: NICHT als 401 durchreichen. PyJWKClientConnectionError
            # erbt von PyJWTError, landete also im selben `except` wie ein
            # manipuliertes Token — ein Timeout beim JWKS-Abruf meldete damit
            # ALLE gerade aktiven Nutzer gleichzeitig ab. Der Schlüsselserver ist
            # nicht erreichbar; über die Gültigkeit des Tokens sagt das nichts.
            #
            # Bewusst NUR der Verbindungsfehler: der allgemeinere
            # PyJWKClientError deckt auch „Unable to find a signing key that
            # matches: <kid>" ab, und das IST ein ungültiges Token → 401
            # (fällt unten in den PyJWTError-Zweig).
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Anmeldedienst nicht erreichbar.",
            ) from exc
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            leeway=_CLOCK_SKEW_SEKUNDEN,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiges oder abgelaufenes Token.",
        ) from exc


def decode_token(token: str, settings: Settings) -> dict[str, object]:
    """Öffentlicher Zugang zum verifizierten Token-Claim-Set (z. B. um die
    session_id/sub einer frisch ausgestellten Session zu lesen). Wirft dieselbe
    401-HTTPException wie der Guard, wenn das Token ungültig ist."""
    return _decode_token(token, settings)


def get_current_user(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> AuthContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization-Header fehlt.",
        )
    token = authorization.split(" ", 1)[1]
    claims = _decode_token(token, settings)
    sub = claims.get("sub")
    if not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ohne gültige sub-Claim.",
        )
    app_meta = claims.get("app_metadata") or {}
    tenant = app_meta.get("tenant_id") if isinstance(app_meta, dict) else None
    role = app_meta.get("role") if isinstance(app_meta, dict) else None
    session_id = claims.get("session_id")
    # GoTrue setzt `aal` auf aal1/aal2 (live gegen auth.aal_level geprueft).
    # Fehlt der Claim, gilt aal1 — das ist KEIN Fallback auf einen Wunschwert,
    # sondern die restriktivere Annahme (Wurzel 5, fail-closed).
    aal = claims.get("aal")
    ctx = AuthContext(
        user_id=sub,
        tenant_id=tenant if isinstance(tenant, str) else None,
        role=role if isinstance(role, str) else None,
        session_id=session_id if isinstance(session_id, str) else None,
        aal=aal if isinstance(aal, str) else "aal1",
    )
    _mfa_gate(request, ctx)
    _aktiv_gate(ctx)
    _demo_gate(request, ctx)
    _sitzung_protokollieren(request, ctx)
    return ctx


def _sitzung_protokollieren(request: Request, ctx: AuthContext) -> None:
    """Haengt Betrieb + Nutzer an JEDE weitere Logzeile dieses Requests.

    ANLASS (29.08.2026): Im Onboarding eines frischen Betriebs erschienen die
    18 Objekte eines FREMDEN Betriebs. Das Backend war korrekt — gemessen
    lieferte ein Token mit `tenant_id=AirSmil` genau 18, eines mit dem
    Test-Tenant genau 1. Der Browser schickte schlicht ein fremdes Token. Nur
    war das aus dem Serverlog NICHT abzulesen: dort stand `GET /properties 200`
    und sonst nichts. Vier Erklaerungen wurden gebaut und verworfen, bevor
    jemand den Tenant mass.

    Der Betrieb gehoert deshalb in den Kontext und nicht an eine einzelne
    Logstelle: `merge_contextvars` traegt ihn ab hier in jede Zeile, auch in
    die von Services, die von diesem Request nichts wissen. Damit beantwortet
    schon das blosse Mitlesen der Konsole die Frage „welcher Betrieb war das?".

    Ausschliesslich IDs, gekuerzt auf acht Zeichen — keine E-Mail, kein Name.
    Acht Zeichen unterscheiden zwei Betriebe zuverlaessig; mehr braucht eine
    Diagnose nicht, und Personenbezug gehoert nicht ungefragt ins Log.
    """
    # `suppress` statt try/except/pass: hier gibt es NICHTS sinnvoll zu
    # protokollieren — faellt ausgerechnet das Logging aus, kann man den
    # Ausfall nicht loggen. Der Request laeuft weiter, nur ohne Betriebs-Angabe
    # in seinen Zeilen (Wurzel 5: best-effort-Zweig, Hauptpfad unberuehrt).
    with contextlib.suppress(Exception):
        # ZWEI Wege, und beide werden gebraucht:
        #
        # (a) `request.state` — daraus liest die Zugriffszeile in `main.py`.
        #     NICHT ueber contextvars: FastAPI fuehrt Dependencies in einem
        #     EIGENEN Task-Kontext aus, dessen Bindungen die aeussere
        #     Middleware nicht mehr sieht. Genau daran lief der erste Einbau
        #     vorbei — die Zeile stand da, nur ohne `tenant`, und ein Log, das
        #     die entscheidende Angabe still weglaesst, ist schlimmer als
        #     keines (es sieht vollstaendig aus).
        #
        # (b) `contextvars` — daraus erben alle Zeilen, die WAEHREND des
        #     Handlers entstehen (Services, channex_call, Fehler). Dort wirkt
        #     die Bindung sehr wohl, weil sie im selben Kontext geschrieben
        #     werden.
        request.state.log_tenant = (ctx.tenant_id or "KEIN-TENANT")[:8]
        request.state.log_user = (ctx.user_id or "?")[:8]
        request.state.log_rolle = ctx.role or "?"
        request.state.log_aal = ctx.aal
        structlog.contextvars.bind_contextvars(
            tenant=request.state.log_tenant,
            user=request.state.log_user,
            rolle=request.state.log_rolle,
            aal=ctx.aal,
        )


def _aktiv_gate(ctx: AuthContext) -> None:
    """Der Riegel für DEAKTIVIERTE Zugänge (0356).

    Sitzt hier und nicht im Login: der GoTrue-Bann, den das Deaktivieren
    zusätzlich setzt, stoppt neue Anmeldungen und das Erneuern des Tokens — ein
    bereits ausgestelltes Access-Token bliebe aber bis zu einer Stunde gültig.
    Genau in dieser Stunde will man den Zugang zu haben. Geprüft wird deshalb
    das TOKEN, an jedem geschützten Endpunkt.

    NACH dem MFA-Riegel: die Reihenfolge ist gleichgültig (beide werfen 401),
    aber so bleibt der bestehende Pfad unverändert. Import in der Funktion,
    weil `features.auth` seinerseits `core.security` importiert.
    """
    from src.features.auth.aktiv_gate import aktiv_zugang_pruefen  # noqa: PLC0415

    aktiv_zugang_pruefen(ctx)


def _demo_gate(request: Request, ctx: AuthContext) -> None:
    """Die beiden Riegel für den öffentlichen Demo-Mandanten (0407/0408).

    Zwei Fragen, zwei Prüfungen: Ist der BEREICH überhaupt freigegeben (0408,
    gilt auch für Leseanfragen)? Und darf diese METHODE etwas ändern (0407)?

    Sitzt hier und nicht in den Routen: das Demo-Konto ist öffentlich
    anmeldbar, und von 536 schreibenden Routen tragen 76 gar keinen
    Rollen-Guard. Geprüft wird deshalb die METHODE an der einen Stelle, die
    jeder geschützte Endpunkt durchläuft — damit ist auch jede künftige Route
    ohne Guard gedeckt.

    Import in der Funktion, weil `features.auth` seinerseits `core.security`
    importiert.
    """
    from src.features.auth.demo_gate import (  # noqa: PLC0415
        demo_bereich_pruefen,
        demo_schreibzugriff_pruefen,
    )

    # Bereichs-Sperre VOR der Methodenprüfung: ein gesperrter Bereich nennt
    # denselben Grund, egal ob gelesen oder geschrieben wird (0408).
    demo_bereich_pruefen(request.url.path, ctx)
    demo_schreibzugriff_pruefen(request.method, ctx)


def _mfa_gate(request: Request, ctx: AuthContext) -> None:
    """Der AAL2-Riegel — die Stelle, an der Wurzel 7 wirklich greift.

    Diese Pruefung sitzt bewusst HIER und nicht in `/api/v1/auth/login`: Der
    direkte GoTrue-Login (`POST /auth/v1/token` mit dem oeffentlichen anon-Key)
    umgeht jede App-Route und liefert ein voll gueltiges Token. Eine 2FA im
    eigenen Login-Endpunkt haette einen Angreifer nie beruehrt. Geprueft wird
    deshalb das TOKEN — egal wo es herkommt, es muss an dieser Stelle vorbei,
    weil jeder geschuetzte Endpunkt ueber `get_current_user` laeuft.

    Zwei-Faktor ist freiwillig (keine Rollen-Pflicht, s. `mfa_service.py`) —
    dieser Riegel erzwingt nur, was jemand SELBST eingerichtet hat:
      1. `aal2`                        → durch.
      2. `aal1` + verifizierte Faktoren → 401, der Faktor ist zu loesen.
         (Genau der Angriff: Direkt-Login mit Passwort allein.)
      3. `aal1` + kein Faktor           → durch. Nichts zu loesen, keine Pflicht.

    Der Import liegt in der Funktion, weil `features.auth` seinerseits
    `core.security` importiert — ein Modul-Import waere ein Zirkel.
    """
    from src.features.auth.mfa_gate import mfa_zugang_pruefen  # noqa: PLC0415

    mfa_zugang_pruefen(request, ctx)


CurrentUser = Annotated[AuthContext, Depends(get_current_user)]


class GuestContext(BaseModel):
    """Kontext eines eingeloggten Portal-Gasts (Demand-Seite, /plattform).

    Getrennt von AuthContext (Vermieter/Staff): ein Gast hat KEINEN tenant_id
    und KEINE Rolle — er ist über seine auth.uid() (== portal_guests.id) und
    seine E-Mail (E-Mail-Match gegen reservations.guest_email) identifiziert.
    """
    guest_id: str
    email: str


def get_current_guest(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> GuestContext:
    """Verifiziert ein Portal-Gast-Token (reguläres Supabase-JWT).

    Ein Gast-Token ist ein normales GoTrue-Access-Token (aud=authenticated),
    trägt aber KEINE app_metadata.tenant_id. Die Zugehörigkeit zu portal_guests
    prüft der jeweilige Service beim ersten DB-Zugriff (E-Mail-Match); der Guard
    liefert nur die identifizierenden Claims (sub + email), fail-closed bei
    fehlender E-Mail. Ob ein Tenant-Nutzer-Token hier durchkäme, ist unkritisch:
    jeder Gast-Endpunkt scoped ausschließlich über guest_id/email, sodass ein
    Tenant-Token nur seine EIGENEN (per E-Mail gematchten) Buchungen sähe.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization-Header fehlt.",
        )
    token = authorization.split(" ", 1)[1]
    claims = _decode_token(token, settings)
    sub = claims.get("sub")
    email = claims.get("email")
    if not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ohne gültige sub-Claim.",
        )
    if not isinstance(email, str) or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ohne E-Mail-Claim.",
        )
    return GuestContext(guest_id=sub, email=email.lower())


CurrentGuest = Annotated[GuestContext, Depends(get_current_guest)]


class PlatformContext(BaseModel):
    """Kontext eines eingeloggten PLATTFORM-Betreibers (Backoffice/Admin).

    Streng getrennt von AuthContext (Betriebs-Nutzer) und GuestContext (Gast).
    Ein Plattform-Admin darf als EINZIGER mandantenübergreifend lesen/handeln —
    deshalb stammt diese Berechtigung NICHT aus dem JWT, sondern wird bei jedem
    Request frisch gegen public.platform_admins geprüft (Wurzel 7: eine entzogene
    Rolle darf nicht bis zum Token-Ablauf weitergelten).

    platform_role: 'platform_admin' (voll, inkl. schreibender Aktionen) oder
    'platform_support' (lesend + Support-Tickets, keine Freigaben/Sperren).
    """

    user_id: str
    email: str | None = None
    platform_role: str
    session_id: str | None = None

    @property
    def is_admin(self) -> bool:
        """True nur für die volle Betreiber-Rolle (nicht für Support)."""
        return self.platform_role == "platform_admin"


def get_current_platform_admin(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> PlatformContext:
    """Verifiziert ein Backoffice-Token und prüft die Betreiber-Rolle in der DB.

    Zweistufig und fail-closed:
      1. Reguläre JWT-Verifikation (dieselbe wie für Betriebs-Nutzer).
      2. Nachschlagen in public.platform_admins mit active = true. Steht der
         Nutzer dort NICHT, gibt es 403 — unabhängig davon, was im Token steht.

    Bewusst KEIN app_metadata-Flag: ein Token bleibt nach Rechte-Entzug bis zu
    einer Stunde gültig; über die DB-Prüfung wirkt ein Entzug sofort. Der
    Lookup läuft über den service_role-Client, weil platform_admins für
    anon/authenticated hart gesperrt ist (Wurzel 6).
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization-Header fehlt.",
        )
    token = authorization.split(" ", 1)[1]
    claims = _decode_token(token, settings)
    sub = claims.get("sub")
    if not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ohne gültige sub-Claim.",
        )

    # Import lokal, um einen Zyklus core.security <-> core.supabase zu vermeiden.
    from .supabase import get_service_client  # noqa: PLC0415

    rows = (
        get_service_client()
        .table("platform_admins")
        .select("role, active")
        .eq("user_id", sub)
        .eq("active", True)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        # Bewusst dieselbe Meldung wie bei falscher Rolle: kein Hinweis darauf,
        # ob der Account existiert (keine Aufklärung für Angreifer).
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Zugriff auf das Plattform-Backoffice.",
        )
    role = rows[0].get("role")
    if role not in ("platform_admin", "platform_support"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Zugriff auf das Plattform-Backoffice.",
        )

    email = claims.get("email")
    session_id = claims.get("session_id")

    # AAL2 auch hier — und zwar NACH der platform_admins-Prüfung, damit ein
    # Fremder aus der Antwort nicht ablesen kann, wer Backoffice-Zugang hat.
    #
    # Dieser Guard ist ein EIGENER Einstieg, der `get_current_user` nicht
    # aufruft: ohne diesen Aufruf wäre ausgerechnet das mächtigste Konto der
    # Plattform (mandantenübergreifender Lesezugriff, Freigaben, Sperren) das
    # einzige ohne Zweitfaktor-Zwang gewesen. Ein per Direkt-Login erbeutetes
    # aal1-Token hätte das komplette Backoffice geöffnet.
    #
    # Bewusst über denselben Riegel wie alle anderen: die Rolle für die
    # PFLICHT kommt aus public.users (ein Plattform-Admin ist dort in aller
    # Regel admin) — hier wird nichts dupliziert, nur derselbe Guard erneut
    # angewandt (Wurzel 7).
    _mfa_gate(
        request,
        AuthContext(
            user_id=sub,
            role=None,
            session_id=session_id if isinstance(session_id, str) else None,
            aal=claims.get("aal") if isinstance(claims.get("aal"), str) else "aal1",
        ),
    )

    return PlatformContext(
        user_id=sub,
        email=email.lower() if isinstance(email, str) and email else None,
        platform_role=role,
        session_id=session_id if isinstance(session_id, str) else None,
    )


CurrentPlatformAdmin = Annotated[
    PlatformContext, Depends(get_current_platform_admin)
]


def require_platform_write(ctx: PlatformContext) -> None:
    """Guard für SCHREIBENDE Backoffice-Aktionen (Freigaben, Sperren, Rollen).

    'platform_support' darf lesen und Tickets bearbeiten, aber nichts freigeben
    oder sperren — diese Trennung wird hier durchgesetzt (fail-closed: alles
    außer der vollen Rolle wird abgelehnt).
    """
    if not ctx.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Diese Aktion erfordert volle Backoffice-Rechte.",
        )


def secrets_match(provided: str | None, expected: str | None) -> bool:
    """Zeitkonstanter Vergleich zweier Secret-Strings, robust gegen nicht-ASCII.

    secrets.compare_digest wirft bei einem str mit Zeichen > 127 einen TypeError
    ('comparing strings with non-ASCII characters is not supported'). Der Wert
    kommt bei Webhook-/Cron-Guards aus einem angreiferkontrollierten Header —
    ein nicht-ASCII-Zeichen darf keinen 500 (unbehandelte Exception, Log-Flooding)
    auslösen, sondern muss schlicht als 'passt nicht' gelten. Byteweiser Vergleich
    (.encode()) umgeht das und bleibt zeitkonstant."""
    if not provided or not expected:
        return False
    return secrets.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))


def require_internal_cron_secret(provided: str | None) -> None:
    """Guard für interne Cron-Endpunkte (tenant-übergreifend, service_role).

    Eigenes INTERNAL_CRON_SECRET, das den Server NIE verlässt. Bewusst NICHT
    das CHANNEX_WEBHOOK_SECRET: das geht bei register_global_webhook OUTBOUND
    an Channex — wer es dort sieht, könnte sonst destruktive projektweite
    Aktionen (Massen-Mailversand, Preis-Push, Owner-Abrechnungen) auslösen.

    Kein Fallback: ohne konfiguriertes Secret sind die Cron-Endpunkte hart
    deaktiviert (503) statt still offen oder still auf ein Fremd-Secret
    zurückzufallen. Vergleich zeitkonstant (kein Timing-Seitenkanal).
    """
    expected = get_settings().internal_cron_secret.get_secret_value()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="INTERNAL_CRON_SECRET ist nicht konfiguriert.",
        )
    if not secrets_match(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiges Secret."
        )
