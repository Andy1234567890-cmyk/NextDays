"""FastAPI App-Einstieg. App-Factory; registriert alle Vertical Slices.

Startet keinen Server beim Import (PROJECT.md). Lokaler Start via uvicorn:
    uvicorn src.main:app --reload
"""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .core.logging import configure_logging, get_logger
from .features.auth.router import router as auth_router
from .features.booking_engine.router import router as booking_engine_router
from .features.buchhaltung.router import router as buchhaltung_router
from .features.calendar.router import router as calendar_router
from .features.channel_manager.router import router as channel_manager_router
from .features.channel_manager.sandbox_ota import router as sandbox_ota_router
from .features.content.router import router as content_router
from .features.crm.router import router as crm_router
from .features.dashboard.router import router as dashboard_router
from .features.guests.router import router as guests_router
from .features.inbox import scheduler as inbox_scheduler
from .features.inbox.router import router as inbox_router
from .features.ocr.router import router as ocr_router
from .features.payments.router import router as payments_router
from .features.properties.router import router as properties_router
from .features.public_portal.router import router as public_portal_router
from .features.rates.router import router as rates_router
from .features.reservations.router import router as reservations_router
from .features.tasks.router import router as tasks_router
from .features.whatsapp.router import router as whatsapp_router

_SLICE_ROUTERS = [
    auth_router,
    buchhaltung_router,
    properties_router,
    rates_router,
    calendar_router,
    reservations_router,
    guests_router,
    inbox_router,
    payments_router,
    channel_manager_router,
    sandbox_ota_router,
    booking_engine_router,
    ocr_router,
    public_portal_router,
    tasks_router,
    crm_router,
    dashboard_router,
    content_router,
    whatsapp_router,
]


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:  # noqa: ARG001
    # Sekundengenauer Scheduler für geplante Posteingang-Nachrichten:
    # beim Start offene pending-Nachrichten (neu) timern, beim Stop abbrechen.
    await inbox_scheduler.start()
    try:
        yield
    finally:
        await inbox_scheduler.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level, json_logs=not settings.is_local)
    log = get_logger("nextdays.api")

    app = FastAPI(title="NextDays API", version="0.1.0", lifespan=_lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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
