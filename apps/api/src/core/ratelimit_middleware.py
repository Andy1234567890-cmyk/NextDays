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
        self.tenant = parse_limit(settings.rate_limit_tenant)


def _is_exempt(path: str) -> bool:
    if path in _EXEMPT_EXACT:
        return True
    # Slice-Health-Endpunkte (z. B. /api/v1/auth/health) ebenfalls ausnehmen.
    return path.endswith("/health")


def _select_bucket(path: str, buckets: _Buckets) -> tuple[str, Limit, bool]:
    """Pfad → (Bucket-Name, Limit, sensibel?). Sensibel = Kandidat für fail-closed."""
    if "/auth/login" in path or "/auth/register" in path:
        return "auth", buckets.auth, True
    if "/payments/" in path:
        return "payments", buckets.payments, True
    if "/booking-engine/listings" in path or "/booking-engine/availability" in path \
            or "/calendar" in path:
        return "listings", buckets.listings, False
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

        ip = client_ip_from_xff(
            request.headers.get("x-forwarded-for"),
            request.client.host if request.client else None,
            self._settings.rate_limit_trusted_proxy_hops,
        )
        ip_key = f"{bucket_name}:ip:{ip or 'unknown'}"
        decision = await limiter.check(ip_key, limit)

        if decision.degraded:
            return self._handle_degraded(sensitive, path)
        if not decision.allowed:
            return self._reject(decision, bucket_name, path, scope="ip")

        # Zusätzliches Tenant-Limit (Fairness) nur für eingeloggte Requests.
        tenant = _tenant_from_bearer(request.headers.get("authorization"))
        if tenant:
            t_decision = await limiter.check(
                f"tenant:{tenant}", self._buckets.tenant
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
