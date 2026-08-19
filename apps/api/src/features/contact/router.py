"""Router des Kontaktformulars. Gemountet unter /api/v1/contact.

Der Endpunkt ist öffentlich und MUSS es sein: wer uns schreiben will, hat kein
Konto. Der Schutz liegt deshalb woanders:
  • eigener, strenger Rate-Limit-Bucket (`public_support`, 20/60/IP, fail-closed)
  • reCAPTCHA Enterprise, SERVERSEITIG bewertet (`core.captcha`)
  • Honigtopf-Feld gegen einfache Bots
  • harte Längengrenzen auf jedem Freitextfeld (Wurzel 8)
  • kein Zielfeld: das Postfach bestimmt der Server (Wurzel 3)
  • immer dieselbe Antwort, auch beim Honigtopf-Treffer
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from src.core.ratelimit import client_ip_from_xff

from .dependencies import ContactServiceDep
from .schemas import KontaktAnfrage, KontaktAntwort
from .service import KontaktError

router = APIRouter(prefix="/contact", tags=["contact"])


@router.post("/message", response_model=KontaktAntwort)
def kontakt_senden(
    req: KontaktAnfrage,
    request: Request,
    service: ContactServiceDep,
) -> KontaktAntwort:
    """Nachricht an das zuständige Postfach schicken.

    IP und User-Agent werden gelesen und an die Captcha-Bewertung weitergegeben
    (Google bewertet damit genauer) — sie werden NICHT gespeichert, weil dieser
    Slice nichts speichert.
    """
    from src.core.config import get_settings

    ip = client_ip_from_xff(
        request.headers.get("x-forwarded-for"),
        request.client.host if request.client else None,
        get_settings().rate_limit_trusted_proxy_hops,
    )
    try:
        detail = service.senden(
            req, ip=ip, user_agent=request.headers.get("user-agent")
        )
    except KontaktError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return KontaktAntwort(detail=detail)
