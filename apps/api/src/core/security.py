"""Auth-Hülle: verifiziert Supabase-JWT und stellt AuthContext bereit.

Modernes Supabase signiert Access-Tokens mit **ES256** (asymmetrisch, JWKS).
Ältere Projekte nutzen **HS256** mit einem Shared Secret. Dieser Code unterstützt
beide: zuerst JWKS/ES256 (anhand des `kid` im Token-Header), sonst HS256-Fallback.

Die Rollen-/Tenant-Auflösung erfolgt aus den JWT-Claims (`app_metadata`) — keine
Platzhalter-Akzeptanz beliebiger Tokens.
"""
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient
from pydantic import BaseModel

from .config import Settings, get_settings


class AuthContext(BaseModel):
    user_id: str
    tenant_id: str | None = None
    role: str | None = None


@lru_cache
def _jwk_client(jwks_url: str) -> PyJWKClient:
    # Cacht die öffentlichen Schlüssel pro JWKS-URL (kein Fetch je Request).
    return PyJWKClient(jwks_url)


def _jwks_url(settings: Settings) -> str:
    return f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _decode_token(token: str, settings: Settings) -> dict[str, object]:
    """Verifiziert ES256 (JWKS) oder HS256 (Shared Secret) je nach Token-Header."""
    try:
        alg = jwt.get_unverified_header(token).get("alg")
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiges oder abgelaufenes Token.",
        ) from exc

    try:
        if alg == "HS256":
            secret = settings.supabase_jwt_secret.get_secret_value()
            if not secret:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="JWT-Secret nicht konfiguriert.",
                )
            return jwt.decode(
                token, secret, algorithms=["HS256"], audience="authenticated"
            )
        # Asymmetrisch (ES256/RS256): öffentlichen Schlüssel via JWKS holen.
        signing_key = _jwk_client(_jwks_url(settings)).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiges oder abgelaufenes Token.",
        ) from exc


def get_current_user(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> AuthContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization-Header fehlt.",
        )
    token = authorization.split(" ", 1)[1]
    claims = _decode_token(token, settings)
    sub = claims.get("sub")
    if not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ohne gültige sub-Claim.",
        )
    app_meta = claims.get("app_metadata") or {}
    tenant = app_meta.get("tenant_id") if isinstance(app_meta, dict) else None
    role = app_meta.get("role") if isinstance(app_meta, dict) else None
    return AuthContext(
        user_id=sub,
        tenant_id=tenant if isinstance(tenant, str) else None,
        role=role if isinstance(role, str) else None,
    )


CurrentUser = Annotated[AuthContext, Depends(get_current_user)]
