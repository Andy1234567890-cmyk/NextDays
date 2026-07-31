"""Router für Voranmeldungen/Newsletter. Gemountet unter /api/v1/newsletter.

ALLE Endpunkte sind öffentlich — der Besucher der Marketing-Seite hat kein
Konto. Der Schutz besteht deshalb aus:
  • eigenem, strengem Rate-Limit-Bucket (core/ratelimit_middleware),
  • neutralen Antworten (keine Auskunft, ob eine Adresse eingetragen ist),
  • Einmal-Token als einzigem Schlüssel, in der DB nur als SHA-256,
  • Wiederholsperre für Bestätigungsmails (kein Mail-Fluten fremder Postfächer).

Der Nachlauf-Endpunkt ist NICHT öffentlich: er hängt am INTERNAL_CRON_SECRET.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, Request

from src.core.ratelimit import client_ip_from_xff
from src.core.security import require_internal_cron_secret

from .dependencies import NewsletterServiceDep
from .schemas import (
    ConfirmResponse,
    SubscribeRequest,
    SubscribeResponse,
)
from .service import NewsletterError

router = APIRouter(prefix="/newsletter", tags=["newsletter"])


def _map(exc: NewsletterError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post("/subscribe", response_model=SubscribeResponse)
def subscribe(
    req: SubscribeRequest, request: Request, service: NewsletterServiceDep
) -> SubscribeResponse:
    """Adresse vormerken und Bestätigungsmail auslösen.

    IP und User-Agent werden hier gelesen und als Einwilligungs-Nachweis
    gespeichert (DSGVO Art. 7 Abs. 1) — nicht zur Analyse.
    """
    from src.core.config import get_settings

    ip = client_ip_from_xff(
        request.headers.get("x-forwarded-for"),
        request.client.host if request.client else None,
        get_settings().rate_limit_trusted_proxy_hops,
    )
    try:
        return service.subscribe(
            req, ip=ip, user_agent=request.headers.get("user-agent")
        )
    except NewsletterError as exc:
        raise _map(exc) from exc


@router.post("/confirm", response_model=ConfirmResponse)
def confirm(
    token: Annotated[str, Query(min_length=20, max_length=200)],
    service: NewsletterServiceDep,
) -> ConfirmResponse:
    """Bestätigungslink einlösen (Double-Opt-in abschließen).

    Bewusst POST: ein GET würde von Mail-Clients und Link-Scannern beim reinen
    Vorschauen ausgelöst — die Bestätigung wäre dann keine Handlung des
    Menschen mehr. Die Marketing-Seite ruft diesen Endpunkt beim Öffnen der
    Bestätigungsseite auf.
    """
    try:
        return service.confirm(token)
    except NewsletterError as exc:
        raise _map(exc) from exc


@router.post("/unsubscribe", response_model=ConfirmResponse)
def unsubscribe(
    token: Annotated[str, Query(min_length=20, max_length=200)],
    service: NewsletterServiceDep,
) -> ConfirmResponse:
    """Abmeldelink einlösen."""
    try:
        return service.unsubscribe(token)
    except NewsletterError as exc:
        raise _map(exc) from exc


@router.post("/internal/resync", include_in_schema=False)
def resync(
    service: NewsletterServiceDep,
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict[str, int]:
    """Bestätigte Kontakte nachtragen, die Brevo noch nicht kennt.

    Kein JWT — über das INTERNAL_CRON_SECRET abgesichert (gleiches Muster wie
    die übrigen Cron-Endpunkte).
    """
    require_internal_cron_secret(x_internal_cron_secret)
    return service.resync_pending()
