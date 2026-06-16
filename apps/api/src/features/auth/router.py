"""Router für auth. Gemountet unter /api/v1/auth."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import AuthContext, CurrentUser

from .dependencies import AuthServiceDep, require_permission
from .permissions import Capability
from .schemas import (
    InviteRequest,
    InviteResponse,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    SessionResponse,
    SliceHealth,
)
from .service import AuthError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    # Health hängt bewusst nicht an Supabase-Clients (kein Key nötig).
    return SliceHealth(slice="auth")


@router.post(
    "/register",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(req: RegisterRequest, service: AuthServiceDep) -> SessionResponse:
    try:
        return service.register(req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/login", response_model=SessionResponse)
def login(req: LoginRequest, service: AuthServiceDep) -> SessionResponse:
    try:
        return service.login(req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/me", response_model=MeResponse)
def me(ctx: CurrentUser, service: AuthServiceDep) -> MeResponse:
    return service.me(ctx)


@router.post(
    "/invite",
    response_model=InviteResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite(
    req: InviteRequest,
    service: AuthServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_STAFF))
    ],
) -> InviteResponse:
    """Mitarbeiter/weiteren Nutzer in den eigenen Tenant einladen.

    Erfordert MANAGE_STAFF (admin/co_admin). Die Rolle des neuen Nutzers kommt
    aus dem Request; der Tenant aus dem eingeloggten Nutzer.
    """
    if not ctx.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Einladender Nutzer hat keinen Tenant.",
        )
    try:
        return service.invite(req, tenant_id=ctx.tenant_id)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
