"""Dependencies des auth-Slice: Service-Factory und Rollen-Guard."""
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status

from src.core.security import AuthContext, get_current_user
from src.core.supabase import get_anon_client, get_service_client

from .schemas import UserRole
from .service import AuthService


def get_auth_service() -> AuthService:
    return AuthService(
        anon_client=get_anon_client(),
        service_client=get_service_client(),
    )


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def require_role(*allowed: UserRole) -> Callable[[AuthContext], AuthContext]:
    """Dependency-Factory: 403, wenn die Rolle nicht erlaubt ist."""
    allowed_values = {r.value for r in allowed}

    def _guard(
        ctx: Annotated[AuthContext, Depends(get_current_user)],
    ) -> AuthContext:
        if ctx.role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unzureichende Berechtigung.",
            )
        return ctx

    return _guard
