"""Router für den öffentlichen Löschantrag. Gemountet unter /api/v1/account-deletion.

BEIDE Endpunkte sind öffentlich und MÜSSEN es sein: Google Play verlangt einen
Löschweg, der ohne installierte App und ohne Login funktioniert. Ein
`require_permission` hier würde die Anforderung verfehlen — wer sein Konto nicht
mehr erreicht, ist genau der Fall, für den die Seite existiert.

Der Schutz liegt deshalb woanders:
  • eigener, strenger Rate-Limit-Bucket (`public_support`, 20/60/IP, fail-closed)
  • Double-Opt-in: der Antrag wirkt erst nach Klick auf den Mail-Link
  • neutrale Antwort — nie die Auskunft, ob zu einer Adresse ein Konto besteht
  • Einmal-Token, in der DB nur als SHA-256
  • Wiederholsperre gegen Mail-Fluten fremder Postfächer
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from src.core.ratelimit import client_ip_from_xff

from .dependencies import AccountDeletionServiceDep
from .schemas import (
    BestaetigungResponse,
    LoeschantragRequest,
    LoeschantragResponse,
)
from .service import LoeschantragError

router = APIRouter(prefix="/account-deletion", tags=["account-deletion"])


def _map(exc: LoeschantragError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.post("/request", response_model=LoeschantragResponse)
def loeschantrag_stellen(
    req: LoeschantragRequest,
    request: Request,
    service: AccountDeletionServiceDep,
) -> LoeschantragResponse:
    """Löschantrag entgegennehmen und Bestätigungsmail auslösen.

    Legt NICHTS Wirksames an: bis zum Klick auf den Mail-Link ist der Antrag
    `pending` und ohne Folge. IP und User-Agent werden als Nachweis der
    Einreichung gespeichert, nicht zur Analyse.
    """
    from src.core.config import get_settings

    ip = client_ip_from_xff(
        request.headers.get("x-forwarded-for"),
        request.client.host if request.client else None,
        get_settings().rate_limit_trusted_proxy_hops,
    )
    try:
        return service.beantragen(
            req, ip=ip, user_agent=request.headers.get("user-agent")
        )
    except LoeschantragError as exc:
        raise _map(exc) from exc


@router.post("/confirm", response_model=BestaetigungResponse)
def loeschantrag_bestaetigen(
    service: AccountDeletionServiceDep,
    token: str = Query(min_length=16, max_length=200),
) -> BestaetigungResponse:
    """Postfach-Besitz nachweisen; der Antrag geht damit ins Backoffice.

    Der Token steht in der Query, weil er aus einem Mail-Link kommt. Die
    Längengrenzen sind eine harte Obergrenze für angreiferkontrollierten Input
    (Wurzel 8) — ein 10-MB-„Token" darf hier nicht bis zur DB durchlaufen.
    """
    try:
        return service.bestaetigen(token)
    except LoeschantragError as exc:
        raise _map(exc) from exc
