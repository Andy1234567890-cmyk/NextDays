"""Auth-Dependency für den Entwickler-API-Zugang.

`require_api_scope(scope)` akzeptiert einen Entwickler-API-Access-Token (aus dem
Client-Credentials-Tausch), verifiziert ihn (HS256, eigene Audience), und baut
einen AuthContext mit den Scopes + der Objekt-Beschränkung des Clients. Der
Endpunkt erzwingt damit BEIDES: den geforderten Ressourcen-Scope UND — über
`ctx.api_property_ids` — dass nur erlaubte Objekte angefasst werden (Wurzel 3/9).
Fail-closed (Wurzel 5/7): fehlendes/ungültiges Token, fehlender Scope,
fehlendes Signier-Secret → 401/403, nie fail-open.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status

from src.core.config import Settings, get_settings
from src.core.security import AuthContext

from .service import ApiClientsService


def _decode_api_token(token: str, settings: Settings) -> dict:
    secret = settings.api_token_secret.get_secret_value()
    if not secret:
        # Ohne Signier-Secret ist KEIN API-Token gültig (fail-closed).
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API-Zugang nicht konfiguriert.",
        )
    try:
        return ApiClientsService.decode_token(token, api_secret=secret)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiges oder abgelaufenes API-Token.",
        ) from exc


def require_api_scope(scope: str) -> Callable[..., AuthContext]:
    """Erzeugt eine Dependency, die den API-Token prüft und `scope` erzwingt."""

    def _dep(
        settings: Annotated[Settings, Depends(get_settings)],
        authorization: Annotated[str | None, Header()] = None,
    ) -> AuthContext:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization-Header fehlt.",
            )
        token = authorization.split(" ", 1)[1]
        claims = _decode_api_token(token, settings)

        tenant_id = claims.get("tenant_id")
        scopes = claims.get("scopes") or []
        if not isinstance(tenant_id, str) or not isinstance(scopes, list):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API-Token ohne gültige Claims.",
            )
        if scope not in scopes:
            # Der Client hat diesen Ressourcen-Scope nicht (Booking-„Connection
            # Type"-Prinzip): kein Zugriff, auch wenn das Token sonst gültig ist.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Fehlender Scope: {scope}.",
            )
        prop_ids = claims.get("property_ids")
        return AuthContext(
            # Kein menschlicher User — die client-id dient als Subjekt.
            user_id=str(claims.get("sub") or claims.get("cid") or "api-client"),
            tenant_id=tenant_id,
            role=None,
            api_scopes=[str(s) for s in scopes],
            api_property_ids=[str(p) for p in prop_ids] if isinstance(prop_ids, list) else [],
            api_is_test=bool(claims.get("is_test")),
        )

    return _dep


def api_property_allowed(ctx: AuthContext, property_id: str) -> bool:
    """True, wenn der API-Client dieses Objekt anfassen darf. Leere
    property_ids-Liste = alle Objekte des Tenants erlaubt (wie Booking „add
    properties to a machine account"); sonst nur die gelisteten. Fail-closed:
    ist ctx kein API-Kontext, verweigern (diese Prüfung gilt nur für API-Zugriffe)."""
    if ctx.api_property_ids is None:
        return False
    if not ctx.api_property_ids:
        return True
    return property_id in ctx.api_property_ids
