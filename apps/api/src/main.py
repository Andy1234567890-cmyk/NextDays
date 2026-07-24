"""FastAPI App-Einstieg. App-Factory; registriert alle Vertical Slices.

Startet keinen Server beim Import (PROJECT.md). Lokaler Start via uvicorn:
    uvicorn src.main:app --reload
"""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .core.config import get_settings
from .core.logging import configure_logging, get_logger
from .core.ratelimit_middleware import RateLimitMiddleware
from .features.addons.router import router as addons_router
from .features.api_clients.router import router as api_clients_router
from .features.auth.router import router as auth_router
from .features.booking_conditions.router import router as booking_conditions_router
from .features.booking_engine.router import router as booking_engine_router
from .features.buchhaltung.router import router as buchhaltung_router
from .features.calendar.router import router as calendar_router
from .features.channel_manager.router import router as channel_manager_router
from .features.channel_manager.sandbox_ota import router as sandbox_ota_router
from .features.content.router import router as content_router
from .features.crm.router import router as crm_router
from .features.dashboard.router import router as dashboard_router
from .features.external_calendar.router import router as external_calendar_router
from .features.guest_auth.router import router as guest_auth_router
from .features.guest_blocks.router import router as guest_blocks_router
from .features.guest_bookings.router import router as guest_bookings_router
from .features.guest_messages.router import router as guest_messages_router
from .features.guest_reviews.router import router as guest_reviews_router
from .features.guest_stay.router import router as guest_stay_router
from .features.guest_wishlist.router import router as guest_wishlist_router
from .features.guests.router import router as guests_router
from .features.host_messages.router import router as host_messages_router
from .features.inbox import scheduler as inbox_scheduler
from .features.inbox.router import router as inbox_router
from .features.login_devices.router import router as login_devices_router
from .features.media.router import router as media_router
from .features.ocr.router import router as ocr_router
from .features.owner_statements.router import router as owner_statements_router
from .features.owners.router import router as owners_router
from .features.payments.router import router as payments_router
from .features.pricing.router import router as pricing_router
from .features.privacy_settings.router import router as privacy_settings_router
from .features.properties.router import router as properties_router
from .features.property_discounts.router import router as property_discounts_router
from .features.property_dossier.router import router as property_dossier_router
from .features.property_portal.router import router as property_portal_router
from .features.public_portal.router import router as public_portal_router
from .features.rates.router import router as rates_router
from .features.reservations.router import router as reservations_router
from .features.site_config.router import manage_router as site_config_manage_router
from .features.site_config.router import public_router as site_config_public_router
from .features.subscriptions.router import router as subscriptions_router
from .features.tasks.router import router as tasks_router
from .features.travel_agencies.router import router as travel_agencies_router
from .features.whatsapp.router import router as whatsapp_router

_SLICE_ROUTERS = [
    auth_router,
    buchhaltung_router,
    properties_router,
    property_portal_router,
    property_dossier_router,
    owners_router,
    owner_statements_router,
    addons_router,
    rates_router,
    pricing_router,
    property_discounts_router,
    calendar_router,
    reservations_router,
    guests_router,
    # Gast-/Kunden-Dashboard der Plattform-Demand-Seite (/plattform).
    guest_auth_router,
    guest_blocks_router,
    guest_bookings_router,
    guest_stay_router,
    guest_messages_router,
    guest_wishlist_router,
    guest_reviews_router,
    host_messages_router,
    inbox_router,
    login_devices_router,
    privacy_settings_router,
    payments_router,
    subscriptions_router,
    external_calendar_router,
    api_clients_router,
    channel_manager_router,
    sandbox_ota_router,
    booking_engine_router,
    booking_conditions_router,
    site_config_manage_router,
    site_config_public_router,
    ocr_router,
    public_portal_router,
    tasks_router,
    media_router,
    travel_agencies_router,
    crm_router,
    dashboard_router,
    content_router,
    whatsapp_router,
]


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Sekundengenauer Scheduler für geplante Posteingang-Nachrichten:
    # beim Start offene pending-Nachrichten (neu) timern, beim Stop abbrechen.
    await inbox_scheduler.start()
    try:
        yield
    finally:
        await inbox_scheduler.stop()
        limiter_mw = getattr(app.state, "rate_limit_middleware", None)
        if limiter_mw is not None:
            await limiter_mw.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level, json_logs=not settings.is_local)
    log = get_logger("nextdays.api")

    # Schema-Disclosure (OWASP A8): /docs, /redoc, /openapi.json nur lokal. In
    # Prod exponiert das sonst die gesamte API-Struktur (kein Datenleck, aber
    # Angreifer-Aufklärung) — die Endpunkte selbst bleiben ohnehin auth-geschützt.
    _docs = {} if settings.is_local else {
        "docs_url": None, "redoc_url": None, "openapi_url": None,
    }
    app = FastAPI(
        title="NextDays API", version="0.1.0", lifespan=_lifespan, **_docs
    )

    # CORS default-deny: mit allow_credentials=True würde Starlettes allow_methods=["*"]
    # die Request-Methode reflektieren und damit JEDE Methode (inkl. neuer wie QUERY,
    # RFC 10008) für credential-tragende Browser-Requests freigeben. Stattdessen eine
    # explizite Allowlist der real genutzten Methoden + OPTIONS (Preflight). Eine
    # unbekannte Methode fällt so durch den Preflight, statt automatisch erlaubt zu sein.
    # (CORS ist Browser-Schutz, keine Server-Autorisierung — die erzwingt der Auth-
    #  Dependency pro Route; diese Allowlist hält das Prinzip dennoch konsistent.)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
        allow_headers=["*"],
    )

    # Host-Header-Injection (Cache-Poisoning, Password-Reset-Poisoning): nur die
    # deklarierten Hosts akzeptieren. Lokal offen (localhost/127.0.0.1 wechseln).
    if not settings.is_local and settings.trusted_host_list:
        app.add_middleware(
            TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list
        )

    # Security-Header auf JEDE Antwort. Die API rendert kein HTML (reines JSON),
    # deshalb default-src 'none' + frame-ancestors 'none' (nie einbettbar). HSTS
    # setzt der TLS-terminierende Proxy (Traefik), NICHT hier — sonst Duplikat.
    @app.middleware("http")
    async def _security_headers(request: Request, call_next):  # noqa: ANN001,ANN202
        resp = await call_next(request)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.setdefault(
            "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
        )
        return resp

    # Fail-closed & kein Stacktrace-Leak (Wurzel 5): unerwartete Exceptions werden
    # serverseitig geloggt (der Handler-Stack im Log), der Client bekommt nur einen
    # generischen 500 ohne interne Details. HTTPException/Validation bleiben davon
    # unberührt (FastAPI behandelt sie eigenständig mit klaren Statuscodes).
    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):  # noqa: ANN202
        log.exception(
            "unhandled_error", path=request.url.path, error=type(exc).__name__
        )
        return JSONResponse(status_code=500, content={"detail": "internal_error"})

    # Redis-backed Rate-Limiting (Infra-Runbook Punkt 8): schützt vor Brute-Force
    # (Login), Scrapern und Lastspitzen, sodass ein einzelner missbrauchter/teurer
    # Endpunkt nicht den ganzen Server mitreißt. Redis-backed, weil bei mehreren
    # Uvicorn-Workern ein In-Memory-Limiter pro Worker getrennt zählen würde. Die
    # Middleware baut ihren Redis-Client lazy pro Event-Loop (loop-sicher).
    app.add_middleware(RateLimitMiddleware, settings=settings)

    api_v1 = APIRouter(prefix="/api/v1")
    for r in _SLICE_ROUTERS:
        api_v1.include_router(r)
    app.include_router(api_v1)

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "nextdays-api"}

    @app.get("/", tags=["meta"])
    def root() -> dict[str, str]:
        return {"service": "nextdays-api", "docs": "/docs"}

    log.info("app_created", slices=len(_SLICE_ROUTERS), env=settings.app_env)
    return app


app = create_app()
