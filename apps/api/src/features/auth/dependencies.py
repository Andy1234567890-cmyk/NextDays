"""Dependencies des auth-Slice: Service-Factory und Rollen-Guard."""
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status

from src.core.security import AuthContext, get_current_user
from src.core.supabase import get_anon_client, get_service_client

from .account_service import AccountService
from .lodgify_permissions import Permission, has_permission
from .owner_assignment_service import OwnerAssignmentService
from .permissions import Capability, has_capability
from .schemas import UserRole
from .service import AuthService
from .staff_assignment_service import StaffAssignmentService


def get_auth_service() -> AuthService:
    return AuthService(
        anon_client=get_anon_client(),
        service_client=get_service_client(),
    )


def get_account_service() -> AccountService:
    return AccountService(
        anon_client=get_anon_client(),
        service_client=get_service_client(),
    )


def get_owner_assignment_service() -> OwnerAssignmentService:
    return OwnerAssignmentService(service_client=get_service_client())


def get_staff_assignment_service() -> StaffAssignmentService:
    return StaffAssignmentService(service_client=get_service_client())


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
AccountServiceDep = Annotated[AccountService, Depends(get_account_service)]
OwnerAssignmentServiceDep = Annotated[
    OwnerAssignmentService, Depends(get_owner_assignment_service)
]
StaffAssignmentServiceDep = Annotated[
    StaffAssignmentService, Depends(get_staff_assignment_service)
]


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


def require_permission(cap: Capability) -> Callable[[AuthContext], AuthContext]:
    """Dependency-Factory: 403, wenn die Rolle die Fähigkeit nicht besitzt.

    Feingranularer als require_role — schützt Endpoints anhand der
    Berechtigungs-Matrix (Lastenheft §4).
    """

    def _guard(
        ctx: Annotated[AuthContext, Depends(get_current_user)],
    ) -> AuthContext:
        if not has_capability(ctx.role, cap):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unzureichende Berechtigung.",
            )
        return ctx

    return _guard


def require_lodgify_permission(
    perm: Permission,
) -> Callable[[AuthContext], AuthContext]:
    """Dependency-Factory für die feingranularen Lodgify-Berechtigungen.

    Liest Rolle + permissions aus der DB (Quelle der Wahrheit, JWT kann veraltet
    sein) und gibt 403, wenn der Nutzer die Berechtigung nicht hat. Admin = immer.
    """

    def _guard(
        ctx: Annotated[AuthContext, Depends(get_current_user)],
        service: AccountServiceDep,
    ) -> AuthContext:
        role, stored = service.role_and_permissions(ctx)
        if not has_permission(role, stored, perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unzureichende Berechtigung.",
            )
        return ctx

    return _guard
