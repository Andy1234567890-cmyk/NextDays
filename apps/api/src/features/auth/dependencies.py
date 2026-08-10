"""Dependencies des auth-Slice: Service-Factory und Rollen-Guard."""
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status

from src.core.security import AuthContext, get_current_user
from src.core.supabase import get_anon_client, get_service_client

from .account_service import AccountService
from .einladung_service import EinladungService
from .granular_permissions import Permission, has_permission, has_pm_access
from .mfa_service import MfaService
from .otp_service import OtpService
from .owner_assignment_service import OwnerAssignmentService
from .permissions import (
    Capability,
    has_capability,
    is_pm_capability,
    pm_umbrella_applies,
)
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


def get_otp_service() -> OtpService:
    return OtpService(db=get_service_client())


def get_mfa_service() -> MfaService:
    # Nur service_role: mfa_recovery_code/mfa_enforcement/mfa_reset_audit sind
    # fuer anon/authenticated hart gesperrt (Wurzel 6, 0341).
    return MfaService(db=get_service_client())


def get_einladung_service() -> EinladungService:
    # Nur service_role: `user_auth_tokens` ist für anon/authenticated hart
    # gesperrt (Wurzel 6, 0334).
    return EinladungService(service_client=get_service_client())


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
AccountServiceDep = Annotated[AccountService, Depends(get_account_service)]
OtpServiceDep = Annotated[OtpService, Depends(get_otp_service)]
MfaServiceDep = Annotated[MfaService, Depends(get_mfa_service)]
EinladungServiceDep = Annotated[EinladungService, Depends(get_einladung_service)]
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


def require_permission(cap: Capability) -> Callable[..., AuthContext]:
    """Dependency-Factory: 403, wenn die Rolle die Fähigkeit nicht besitzt.

    Feingranularer als require_role — schützt Endpoints anhand der
    Berechtigungs-Matrix (Lastenheft §4).

    Brücke zum feingranularen System (Wurzel): Ist ``cap`` eine PM-Capability,
    muss der Nutzer ZUSÄTZLICH das PM-Dach (ACCESS_PM_FEATURES aus
    users.permissions) haben. So wirkt der Entzug des PM-Zugriffs im
    Rechte-Dialog auch auf Bereiche, die nur an der Rolle hängen (Kontrollzentrum,
    Buchungen, Aufgaben). Nicht-PM-Capabilities bleiben rein rollenbasiert (kein
    DB-Zugriff nötig).

    Das Dach gilt nur für die PMS-Rollen (``pm_umbrella_applies``). Ein ``owner``
    kann ACCESS_PM_FEATURES konstruktiv nie haben und würde sonst seine einzige
    PM-Capability (VIEW_CALENDAR) verlieren — das Eigentümer-Portal wäre dicht.
    Er behält exakt sein Rollen-Set, ohne Zuwachs.
    """

    if not is_pm_capability(cap):
        def _guard_role_only(
            ctx: Annotated[AuthContext, Depends(get_current_user)],
        ) -> AuthContext:
            if not has_capability(ctx.role, cap):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Unzureichende Berechtigung.",
                )
            return ctx

        return _guard_role_only

    def _guard_pm(
        ctx: Annotated[AuthContext, Depends(get_current_user)],
        service: AccountServiceDep,
    ) -> AuthContext:
        # Rolle aus der DB (Quelle der Wahrheit, Wurzel 7) — nicht ctx.role aus
        # dem JWT, das eine entzogene Rolle bis Token-Ablauf weiterträgt. Sie
        # entscheidet auch, ob das Dach überhaupt gilt: dieselbe Regel wie in
        # /auth/me (effective_capabilities → pm_umbrella_applies), keine
        # zweite Kopie.
        role, stored = service.role_and_permissions(ctx)
        if not has_capability(role, cap):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unzureichende Berechtigung.",
            )
        if pm_umbrella_applies(role) and not has_pm_access(role, stored):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Kein Zugriff auf das PM-Modul.",
            )
        return ctx

    return _guard_pm


def require_granular_permission(
    perm: Permission,
) -> Callable[[AuthContext], AuthContext]:
    """Dependency-Factory für die feingranularen Berechtigungen.

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
