"""Token-Endpunkt und Selbstauskunft.

Der einzige Endpunkt der v1 ohne Auth ist `POST /oauth/token` — hier ist das
Client-Secret selbst der Nachweis. Er hängt am strengsten Rate-Limit-Eimer
(10/60 je IP), weil er die Brute-Force-Fläche der API ist.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ..core.auth import ApiKontext, scope_erforderlich, token_ausgeben
from .schemas import Selbstauskunft, TokenAnfrage, TokenAntwort

router = APIRouter()


@router.post(
    "/oauth/token",
    response_model=TokenAntwort,
    tags=["Auth"],
    summary="Access-Token holen",
    responses={
        401: {"description": "Client-ID/Secret falsch oder Zugang widerrufen."},
        403: {"description": "Dem Zugang ist kein Scope zugeordnet."},
        429: {"description": "Zu viele Versuche (10 pro Minute)."},
    },
)
def token(body: TokenAnfrage) -> TokenAntwort:
    """Client-ID + Client-Secret gegen ein Access-Token tauschen.

    Das Token gilt **eine Stunde**. Hol es nicht bei jedem Aufruf neu — halte es
    im Speicher und tausche erst, wenn es abläuft oder ein 401 kommt. Ein
    Widerruf im Dashboard verhindert neue Tokens sofort; ein bereits
    ausgegebenes läuft binnen der Stunde ab.
    """
    return TokenAntwort(**token_ausgeben(  # type: ignore[arg-type]
        client_id=body.client_id, client_secret=body.client_secret
    ))


@router.get(
    "/me",
    response_model=Selbstauskunft,
    tags=["Betrieb"],
    summary="Was darf dieser Zugang?",
)
def selbstauskunft(
    # Bewusst an `properties:read` gehängt und nicht scope-frei: auch die
    # Auskunft über einen Zugang ist eine Auskunft. Jeder sinnvolle Zugang hat
    # mindestens einen Lese-Scope.
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("properties:read"))],
) -> Selbstauskunft:
    """Scopes und Objekt-Beschränkung des aktuellen Tokens.

    Der erste Aufruf, den eine Integration machen sollte: er beantwortet, was
    geht, ohne es durch eine Reihe von 403ern herauszufinden.
    """
    return Selbstauskunft(
        tenant_id=ctx.tenant_id,
        client_id=ctx.client_id,
        is_test=ctx.is_test,
        scopes=sorted(ctx.scopes),
        property_ids=ctx.property_ids,
    )


@router.get("/health", tags=["Betrieb"], include_in_schema=False)
def health() -> dict[str, str]:
    """Erreichbarkeit (ohne Auth, ohne DB) — für Monitoring."""
    return {"status": "ok", "version": "1.0.0"}
