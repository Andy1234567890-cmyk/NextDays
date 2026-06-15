"""Auth-Hülle: verifiziert Supabase-JWT und stellt AuthContext bereit.

Die Rollen-/Tenant-Auflösung gegen die DB folgt im Slice `auth`. Hier wird
das JWT kryptografisch geprüft und die Claims typisiert herausgereicht —
keine Platzhalter-Akzeptanz beliebiger Tokens.
"""
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel

from .config import Settings, get_settings


class AuthContext(BaseModel):
    user_id: str
    tenant_id: str | None = None
    role: str | None = None


def _decode_token(token: str, secret: str) -> dict[str, object]:
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
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
    secret = settings.supabase_jwt_secret.get_secret_value()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT-Secret nicht konfiguriert.",
        )
    claims = _decode_token(token, secret)
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
