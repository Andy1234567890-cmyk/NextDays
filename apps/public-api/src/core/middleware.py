"""Middleware der öffentlichen API: Request-ID und Rate-Limits.

**Request-ID.** Jede Antwort trägt `X-Request-Id`. Sie steht auch in jedem
problem+json-Fehler und in jeder Logzeile. Ohne sie ist „gestern kam ein 500"
keine beantwortbare Supportanfrage. Schickt der Client selbst eine (`X-Request-Id`),
wird sie übernommen — dann passt seine Ablaufverfolgung zu unserer.

**Rate-Limits.** Begrenzt wird primär je ZUGANG, nicht je IP: eine Agentur, die
zwanzig Betriebe betreut, sitzt hinter einer IP, und ein IP-Limit würde alle
zwanzig gemeinsam ausbremsen. Hostaway macht genau das (15 Anfragen/10 s pro IP)
und trifft damit die falsche Einheit. Fehlt ein gültiges Token, greift die IP als
Notbehelf — sonst wäre der Token-Endpunkt selbst unbegrenzt.

Drei getrennte Eimer, weil die Lasten verschieden sind:

    Eimer     Standard   Für
    ───────────────────────────────────────────────────────────────────
    token     10/60      POST /v1/oauth/token — Brute-Force-Fläche
    write     120/60     POST/PUT/PATCH/DELETE — greift in den Verkauf ein
    read      600/60     GET — der Alltag einer Integration

Zum Vergleich (Recherche 20.08.2026): Lodgify begrenzt absolut 600/min (v1) bzw.
750/min (v2) ohne Unterscheidung nach Methode; Hostaway 20/10 s je Konto. Ein
gemeinsamer Eimer für Lesen und Schreiben hat den Nachteil, dass ein Client, der
den Kalender abfragt, sich selbst die Möglichkeit nimmt, einen Preis zu setzen.

**Header.** `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (die
Namen des IETF-Entwurfs, den auch RFC-9331-Implementierungen verwenden), bei 429
zusätzlich `Retry-After`. Bewusst NUR ein Namensschema: zwei Sets (`X-RateLimit-*`
daneben) sind zwei Wahrheiten, sobald eines davon irgendwann anders berechnet wird.

**Redis weg.** Der Limiter meldet das als `degraded`. Dann gilt:
  * Token-Endpunkt → fail-CLOSED (503). Sein Zweck IST der Brute-Force-Schutz;
    ohne Zähler gibt es ihn nicht (Wurzel 5/7).
  * Lesen und Schreiben → fail-open, aber protokolliert. Ein Betrieb muss seine
    Preise auch dann noch an die Portale bringen können, wenn unser Zähler
    ausfällt; die Alternative wäre, den Verkauf wegen einer Nebenkomponente
    anzuhalten.
"""
from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from . import errors
from .config import Settings
from .logging import get_logger
from .ratelimit import Limit, RateLimiter, client_ip_from_xff, parse_limit

log = get_logger("publicapi.middleware")

_SCHREIB_METHODEN = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_TOKEN_PFAD = "/v1/oauth/token"  # noqa: S105 — Pfad, kein Secret
# Immer frei: Betriebsprüfungen und die veröffentlichte Beschreibung der API.
# Sie tragen keine Daten und werden von Monitoring/Doku-Portal getaktet.
_FREIE_PFADE = frozenset({"/health", "/openapi.json", "/docs", "/v1/health"})


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Setzt `request.state.request_id` und den Antwort-Header."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        vom_client = request.headers.get("x-request-id", "").strip()
        # Fremdwert übernehmen, aber gekappt: der Wert landet in Logs und
        # Fehlerkörpern, und ein 10-kB-Header hat dort nichts zu suchen.
        request_id = vom_client[:64] if vom_client else uuid.uuid4().hex
        request.state.request_id = request_id
        antwort = await call_next(request)
        antwort.headers["X-Request-Id"] = request_id
        return antwort


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Zählt Anfragen je Zugang (Notbehelf: je IP) in drei Eimern."""

    def __init__(
        self,
        app: object,
        *,
        limiter_quelle: Callable[[], RateLimiter],
        settings: Settings,
    ) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        # Der Limiter kommt als Quelle, nicht als Wert: seine Redis-Verbindung
        # entsteht erst im Lifespan der App, die Middleware-Kette wird aber
        # vorher gebaut. Ein Modul-Global wäre die Alternative und schlechter —
        # dann hängen in Tests zwei Apps am selben Zustand.
        self._limiter_quelle = limiter_quelle
        self._settings = settings
        # Beim Start geparst, nicht je Anfrage: eine ungültige Angabe soll den
        # Start scheitern lassen, nicht jede einzelne Anfrage (kein stiller
        # Default, Wurzel 4).
        self._limits: dict[str, Limit] = {
            "token": parse_limit(settings.rate_limit_token),
            "write": parse_limit(settings.rate_limit_write),
            "read": parse_limit(settings.rate_limit_read),
        }

    def _eimer(self, request: Request) -> str:
        if request.url.path == _TOKEN_PFAD:
            return "token"
        return "write" if request.method in _SCHREIB_METHODEN else "read"

    def _schluessel(self, request: Request, eimer: str) -> str:
        """Zähl-Schlüssel: der Zugang, wenn feststellbar, sonst die IP.

        Der Zugang kommt aus dem Bearer-Token, und die Signatur wird dabei
        VOLLSTÄNDIG geprüft. Ein ungeprüft gelesener Claim wäre vom Client frei
        wählbar — jeder könnte sich mit einem selbst gebastelten Token einen
        eigenen, leeren Eimer ausdenken und das Limit damit umgehen. Scheitert
        die Prüfung, zählt die IP; die eigentliche 401 folgt am Endpunkt.
        """
        secret = self._settings.api_token_secret.get_secret_value()
        auth = request.headers.get("authorization", "")
        if secret and auth.lower().startswith("bearer "):
            try:
                claims = jwt.decode(
                    auth.split(" ", 1)[1],
                    secret,
                    algorithms=["HS256"],
                    audience="mynextdays-api",
                )
                return f"pub:{eimer}:c:{claims.get('cid')}"
            except jwt.PyJWTError:
                pass  # kein gültiges Token → IP als Einheit
        ip = client_ip_from_xff(
            request.headers.get("x-forwarded-for"),
            request.client.host if request.client else None,
            self._settings.trusted_proxy_hops,
        )
        return f"pub:{eimer}:ip:{ip or 'unbekannt'}"

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.url.path in _FREIE_PFADE:
            return await call_next(request)

        eimer = self._eimer(request)
        limit = self._limits[eimer]
        limiter = self._limiter_quelle()
        entscheidung = await limiter.check(self._schluessel(request, eimer), limit)

        if entscheidung.degraded:
            if eimer == "token":
                log.error("ratelimit_degraded_token_fail_closed")
                return errors.problem_antwort(
                    request,
                    errors.nicht_konfiguriert(
                        "Der Zugangsschutz ist vorübergehend nicht verfügbar. "
                        "Bitte in einer Minute erneut versuchen."
                    ),
                )
            log.warning("ratelimit_degraded_fail_open", eimer=eimer)

        if not entscheidung.allowed:
            antwort = errors.problem_antwort(
                request,
                errors.zu_viele_anfragen(
                    entscheidung.retry_after, limit.max, limit.window_seconds
                ),
            )
            antwort.headers["Retry-After"] = str(entscheidung.retry_after)
            _limit_header(antwort, entscheidung.remaining, limit, entscheidung.retry_after)
            return antwort

        antwort = await call_next(request)
        _limit_header(antwort, entscheidung.remaining, limit, entscheidung.retry_after)
        return antwort


def _limit_header(antwort: Response, rest: int, limit: Limit, reset: int) -> None:
    """Die drei Zähler-Header setzen. Auch im Erfolgsfall — ein Client soll sein
    Tempo anpassen können, BEVOR er in den 429 läuft."""
    antwort.headers["RateLimit-Limit"] = str(limit.max)
    antwort.headers["RateLimit-Remaining"] = str(rest)
    antwort.headers["RateLimit-Reset"] = str(reset)
