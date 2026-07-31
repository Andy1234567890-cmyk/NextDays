"""ASGI-Middleware, die das gestaffelte Rate-Limiting durchsetzt.

Gestaffelt nach Sensitivität (default-deny-Geist: streng dort, wo es weh tut):
  * Auth (Login/Register)  — Brute-Force-Schutz, optional fail-closed.
  * Payments               — teuer/sensibel, optional fail-closed.
  * Listings/Such/Kalender — Scraper-/Lastschutz (der frühere N+1-Endpunkt).
  * globaler Default       — großzügig pro IP.
  * pro Tenant             — Fairness (ein Tenant leert den Pool nicht).

Health-Endpunkte sind ausgenommen (sonst kippt der Coolify-Healthcheck).

Schlüssel: pro echter Client-IP (hinter Traefik via X-Forwarded-For) und — bei
eingeloggten Requests — zusätzlich pro Tenant. IP-Limit ist die Sicherheitsgrenze;
das Tenant-Limit ist reine Fairness, daher genügt ein best-effort-Tenant-Read aus
dem (hier NICHT erneut signatur-geprüften) JWT — die echte Auth macht die Route.
"""
from __future__ import annotations

import asyncio
import json
from base64 import urlsafe_b64decode
from collections.abc import Callable

from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from .config import Settings
from .logging import get_logger
from .ratelimit import (
    Limit,
    RateDecision,
    RateLimiter,
    build_redis,
    client_ip_from_xff,
    parse_limit,
)

log = get_logger("nextdays.ratelimit")

# Von JEDEM Limit ausgenommen (volle request.url.path geprüft): Health/Root müssen
# immer durchgehen, sonst kippt der Coolify-Healthcheck. Slice-Health (*/health)
# zusätzlich über _is_exempt().
_EXEMPT_EXACT = frozenset({"/", "/health", "/docs", "/openapi.json", "/redoc"})


class _Buckets:
    """Geparste Limits, einmal pro App aufgelöst (keine Parse-Kosten je Request)."""

    def __init__(self, settings: Settings) -> None:
        self.default = parse_limit(settings.rate_limit_default)
        self.auth = parse_limit(settings.rate_limit_auth)
        self.payments = parse_limit(settings.rate_limit_payments)
        self.listings = parse_limit(settings.rate_limit_listings)
        self.listings_tenant = parse_limit(settings.rate_limit_listings_tenant)
        self.tenant = parse_limit(settings.rate_limit_tenant)
        self.ai = parse_limit(settings.rate_limit_ai)
        self.public_support = parse_limit(settings.rate_limit_public_support)


def _is_exempt(path: str) -> bool:
    if path in _EXEMPT_EXACT:
        return True
    # Slice-Health-Endpunkte (z. B. /api/v1/auth/health) ebenfalls ausnehmen.
    return path.endswith("/health")


# Credential-Endpunkte → strenger auth-Bucket (Brute-Force-/Stuffing-Schutz,
# Wurzel 2/7). Die Gast-Auth der Demand-Seite (/plattform) zählt genauso wie der
# Vermieter-Login; password-reset zusätzlich gegen E-Mail-Enumeration.
# /oauth/token ist der Client-Credentials-Tausch der Entwickler-API.
_AUTH_PATHS = (
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/oauth/token",
    "/guest-auth/login",
    "/guest-auth/register",
    "/guest-auth/refresh",
    "/guest-auth/password-reset",
    # Einladung ins Backoffice annehmen: öffentlich (die eingeladene Person hat
    # noch keine Sitzung) und setzt ein Passwort — also derselbe strenge Bucket
    # wie ein Login, sonst wäre der Token-Raum durchprobierbar.
    "/platform/team/accept",
)

# Endpunkte, die eine KOSTENPFLICHTIGE Fremd-API anstoßen (Groq bzw. Google
# Translate). Im Default-Bucket könnte ein einzelner eingeloggter Nutzer
# erhebliche Kosten verursachen — eigener strenger Bucket (Wurzel 8).
_AI_PATHS = ("/dashboard/voice", "/content/translate")

# UNAUTHENTIFIZIERTE Kontaktaufnahme von der Marketing-Seite. Jeder Aufruf legt
# einen Datensatz an bzw. schreibt in einen fremden Verlauf — im
# Default-Bucket (300/60) wäre das ein bequemer Spam- und Token-Rateweg.
# Deshalb ein eigener, strenger Bucket (Wurzel 8: teure/öffentliche Endpunkte
# bekommen ein eigenes Dach) — und sensibel, also fail-closed: lieber eine
# Anfrage abweisen als bei Redis-Ausfall die Schleusen öffnen.
_PUBLIC_SUPPORT_PATHS = ("/support/public",)

# Öffentliche Newsletter-Endpunkte der Marketing-Seite: jede Anfrage kann eine
# Mail an eine FREMDE Adresse auslösen bzw. probiert einen Token durch — daher
# derselbe strenge Bucket wie beim öffentlichen Support-Chat.
_NEWSLETTER_PATHS = ("/newsletter/subscribe", "/newsletter/confirm",
                     "/newsletter/unsubscribe")

# Öffentliche Such-/Kalender-Endpunkte → Scraper-Schutz pro IP. Der iCal-Export
# ist nicht eingeloggt (ein Kalender-Client schickt kein JWT).
_LISTINGS_PATHS = (
    "/booking-engine/listings",
    "/booking-engine/availability",
    "/calendar",
    "/external-calendar/export/",
)

# EINGEHENDE Provider-Webhooks. Sie werden weiterhin gezählt (Missbrauchsschutz),
# laufen bei Redis-Ausfall aber fail-OPEN statt fail-closed.
#
# Begründung: Jeder dieser Endpunkte prüft selbst eine Signatur bzw. ein
# geteiltes Secret (Stripe `construct_event`, PayPal `verify_webhook`, Channex
# X-Channex-Webhook-Secret, WhatsApp verify_token) — das Rate-Limit ist dort
# NICHT die Zugangskontrolle. Ein 503 wegen nicht erreichbarem Redis wirft
# dagegen echte Ereignisse weg: Stripe wiederholt nur ~3 Tage, danach ist das
# Event verloren. Genau so blieb am 29.07.2026 ein bezahltes Abo dauerhaft auf
# „Kein Abo" stehen — 10 von 10 `customer.subscription.created`-Zustellungen
# wurden mit 503 abgewiesen, weil der Limiter-Client auf einem fremden Redis
# hing. Ein Zahlungsereignis darf nicht an der Verfügbarkeit einer
# Hilfskomponente scheitern (Wurzel 5: Kontroll-Signal nicht verschlucken).
_WEBHOOK_PATHS = (
    "/payments/webhook",
    "/payments/paypal/webhook",
    "/channel-manager/webhook",
    "/whatsapp/webhook",
)


# Reihenfolge ist bedeutungstragend: der ERSTE Treffer gewinnt.
# Die Webhooks stehen VOR dem /payments/-Eintrag, weil der Stripe-Webhook unter
# /payments/ liegt und sonst als sensibel eingestuft und fail-closed abgewiesen
# würde. Tabelle statt Kette von if/return, damit ein weiterer Bucket keine
# weitere Verzweigung bedeutet.
_BUCKET_REGELN: tuple[tuple[str, tuple[str, ...], str, bool], ...] = (
    ("payments", _WEBHOOK_PATHS, "payments", False),
    ("auth", _AUTH_PATHS, "auth", True),
    ("payments", ("/payments/",), "payments", True),
    ("public_support", _PUBLIC_SUPPORT_PATHS, "public_support", True),
    ("public_support", _NEWSLETTER_PATHS, "public_support", True),
    ("ai", _AI_PATHS, "ai", False),
    ("listings", _LISTINGS_PATHS, "listings", False),
)


def _select_bucket(path: str, buckets: _Buckets) -> tuple[str, Limit, bool]:
    """Pfad → (Bucket-Name, Limit, sensibel?). Sensibel = Kandidat für fail-closed."""
    for name, pfade, attribut, sensibel in _BUCKET_REGELN:
        if any(p in path for p in pfade):
            return name, getattr(buckets, attribut), sensibel
    return "default", buckets.default, False


def _tenant_from_bearer(auth_header: str | None) -> str | None:
    """Best-effort: ``app_metadata.tenant_id`` aus dem JWT lesen, OHNE Signatur-
    prüfung (nur fürs Fairness-Keying; die echte Auth prüft die Route). Bei jedem
    Fehler → None (dann greift nur das IP-Limit)."""
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        padded = parts[1] + "=" * (-len(parts[1]) % 4)
        claims = json.loads(urlsafe_b64decode(padded))
    except (ValueError, json.JSONDecodeError):
        return None
    meta = claims.get("app_metadata") if isinstance(claims, dict) else None
    tenant = meta.get("tenant_id") if isinstance(meta, dict) else None
    return tenant if isinstance(tenant, str) and tenant else None


class RateLimitMiddleware:
    """Setzt die gestaffelten Limits vor jedem Request durch.

    Der Redis-Client wird LAZY pro Event-Loop gebaut, nicht im Konstruktor:
    ``redis.asyncio`` bindet seinen Connection-Pool an den Loop, in dem er zuerst
    benutzt wird — würde man ihn beim App-Bau (anderer Loop) erzeugen, bricht jeder
    spätere Request im echten Worker-Loop mit „Future attached to a different loop".
    Tests injizieren stattdessen einen fertigen ``limiter`` (Fake-Redis).
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        settings: Settings,
        limiter: RateLimiter | None = None,
    ) -> None:
        self._app = app
        self._settings = settings
        self._buckets = _Buckets(settings)
        self._injected_limiter = limiter
        # Ein Limiter (mit eigenem Redis-Client) pro Event-Loop, lazy aufgebaut.
        self._limiters: dict[int, RateLimiter] = {}

    def _limiter_for_loop(self) -> RateLimiter:
        if self._injected_limiter is not None:
            return self._injected_limiter
        loop_id = id(asyncio.get_running_loop())
        limiter = self._limiters.get(loop_id)
        if limiter is None:
            limiter = RateLimiter(build_redis(self._settings.redis_url))
            self._limiters[loop_id] = limiter
        return limiter

    async def aclose(self) -> None:
        """Alle loop-lokalen Redis-Clients schließen (Lifespan-Shutdown)."""
        for limiter in self._limiters.values():
            await limiter.aclose()
        self._limiters.clear()

    async def __call__(self, scope: dict, receive: Callable, send: Callable) -> None:
        if scope["type"] != "http" or not self._settings.rate_limit_enabled:
            await self._app(scope, receive, send)
            return
        # Einmalig für den Lifespan-Shutdown auffindbar machen.
        app = scope.get("app")
        if app is not None and getattr(app.state, "rate_limit_middleware", None) is None:
            app.state.rate_limit_middleware = self
        request = Request(scope, receive=receive)
        if _is_exempt(request.url.path):
            await self._app(scope, receive, send)
            return

        response = await self._guard(request)
        if response is not None:
            await response(scope, receive, send)
            return
        await self._app(scope, receive, send)

    async def _guard(self, request: Request) -> Response | None:
        """Gibt eine 429/503-Response zurück, wenn blockiert; sonst None."""
        path = request.url.path
        bucket_name, limit, sensitive = _select_bucket(path, self._buckets)
        limiter = self._limiter_for_loop()

        tenant = _tenant_from_bearer(request.headers.get("authorization"))

        ip = client_ip_from_xff(
            request.headers.get("x-forwarded-for"),
            request.client.host if request.client else None,
            self._settings.rate_limit_trusted_proxy_hops,
        )

        # listings/Kalender EINGELOGGT → pro (TENANT, IP) keyen. Das großzügige
        # Tenant-Limit (1200/60) verhindert, dass ein Betrieb sich selbst aussperrt
        # und Büro-NAT (mehrere Mitarbeiter, eine IP) am strengen IP-Limit scheitert.
        # Nicht-eingeloggte listings-Requests (öffentlicher Marktplatz) bleiben pro
        # IP (Scraper-Schutz). Alle anderen Buckets: IP.
        #
        # WICHTIG (Cross-Tenant-DoS): Der Tenant-Schlüssel enthält die IP
        # (`listings:tenant:{tenant}:ip:{ip}`), NICHT nur die tenant_id. Die
        # tenant_id stammt aus einem NICHT signaturgeprüften JWT — ein rein globaler
        # `listings:tenant:{tenant}`-Zähler ließe sich mit der REALEN Opfer-tenant_id
        # von MEHREREN IPs gemeinsam vollschreiben (jede IP unter ihrem IP-Limit,
        # zusammen über dem Tenant-Fenster) und würde so die echten Mitarbeiter des
        # Opfers von IHREN sauberen IPs aussperren. Mit der IP im Schlüssel füllt ein
        # Angreifer nur seinen eigenen (Opfer-Tenant, Angreifer-IP)-Zähler; die echten
        # Mitarbeiter haben andere IPs → eigener Zähler, keine Aussperrung. Analog zum
        # Nicht-listings-Fairness-Bucket unten. Der IP-Scraper-Guard bleibt zusätzlich.
        if bucket_name == "listings" and tenant:
            ip_decision = await limiter.check(
                f"listings:ip:{ip or 'unknown'}", self._buckets.listings
            )
            if ip_decision.degraded:
                return self._handle_degraded(sensitive, path)
            if not ip_decision.allowed:
                return self._reject(ip_decision, "listings", path, scope="ip")

            primary_key = f"listings:tenant:{tenant}:ip:{ip or 'unknown'}"
            limit = self._buckets.listings_tenant
            primary_scope = "listings-tenant"
        else:
            primary_key = f"{bucket_name}:ip:{ip or 'unknown'}"
            primary_scope = "ip"
        decision = await limiter.check(primary_key, limit)

        if decision.degraded:
            return self._handle_degraded(sensitive, path)
        if not decision.allowed:
            return self._reject(decision, bucket_name, path, scope=primary_scope)

        # Zusätzliches Tenant-Fairness-Limit für eingeloggte Requests. Der
        # Schlüssel wird PRO IP gekeyt (tenant:{tenant}:ip:{ip}), NICHT global
        # pro Tenant: die tenant_id stammt aus einem unsignierten JWT
        # (_tenant_from_bearer). Ein globaler tenant:{tenant}-Zähler ließe sich
        # sonst mit einer gefälschten Opfer-tenant_id von außen füllen und würde
        # so echte Nutzer dieses Tenants tenant-weit aussperren (Cross-Tenant-
        # DoS). Pro-IP-Keying begrenzt einen Angreifer auf sein eigenes Fenster
        # und erhält den Fairness-Zweck (Büro-NAT: eine IP, mehrere Mitarbeiter).
        # Beim listings-Bucket ist das Tenant-Keying schon das Primärlimit oben.
        if tenant and bucket_name != "listings":
            t_decision = await limiter.check(
                f"tenant:{tenant}:ip:{ip or 'unknown'}", self._buckets.tenant
            )
            if not t_decision.degraded and not t_decision.allowed:
                return self._reject(t_decision, "tenant", path, scope="tenant")
        return None

    def _handle_degraded(self, sensitive: bool, path: str) -> Response | None:
        """Redis weg: sensible Endpunkte optional fail-CLOSED, sonst fail-OPEN."""
        if sensitive and self._settings.rate_limit_fail_closed_sensitive:
            log.warning("rate_limit_fail_closed", path=path)
            return JSONResponse(
                {"detail": "Dienst vorübergehend nicht verfügbar."},
                status_code=503,
                headers={"Retry-After": "5"},
            )
        log.warning("rate_limit_fail_open", path=path)
        return None

    def _reject(
        self, decision: RateDecision, bucket: str, path: str, *, scope: str
    ) -> JSONResponse:
        log.info(
            "rate_limited",
            bucket=bucket,
            scope=scope,
            path=path,
            limit=decision.limit.max,
            window=decision.limit.window_seconds,
        )
        return JSONResponse(
            {"detail": "Zu viele Anfragen. Bitte später erneut versuchen."},
            status_code=429,
            headers={
                "Retry-After": str(decision.retry_after),
                "X-RateLimit-Limit": str(decision.limit.max),
                "X-RateLimit-Remaining": str(decision.remaining),
            },
        )
