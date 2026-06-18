"""Router für auth. Gemountet unter /api/v1/auth."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from src.core.security import AuthContext, CurrentUser

from .dependencies import AccountServiceDep, AuthServiceDep, require_permission
from .permissions import Capability
from .schemas import (
    AccountResponse,
    InviteRequest,
    InviteResponse,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    SessionResponse,
    SliceHealth,
    TenantUser,
    TotpDisableRequest,
    TotpEnrollResponse,
    TotpVerifyRequest,
    TotpVerifyResponse,
    UpdateEmailRequest,
    UpdateNameRequest,
    UpdatePasswordRequest,
    UpdateProfileRequest,
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


# --- Konto & 2FA (Sicherheit-Seite) ---------------------------------------


@router.get("/account", response_model=AccountResponse)
def get_account(ctx: CurrentUser, service: AccountServiceDep) -> AccountResponse:
    try:
        return service.get_account(ctx)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/account/users", response_model=list[TenantUser])
def list_tenant_users(
    ctx: CurrentUser, service: AccountServiceDep
) -> list[TenantUser]:
    try:
        return service.list_tenant_users(ctx)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/account/email", response_model=AccountResponse)
def update_email(
    req: UpdateEmailRequest, ctx: CurrentUser, service: AccountServiceDep
) -> AccountResponse:
    try:
        return service.update_email(ctx, req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/account/name", response_model=AccountResponse)
def update_name(
    req: UpdateNameRequest, ctx: CurrentUser, service: AccountServiceDep
) -> AccountResponse:
    try:
        return service.update_name(ctx, req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/account/password", response_model=AccountResponse)
def update_password(
    req: UpdatePasswordRequest, ctx: CurrentUser, service: AccountServiceDep
) -> AccountResponse:
    try:
        return service.update_password(ctx, req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/account/profile", response_model=AccountResponse)
def update_profile(
    req: UpdateProfileRequest, ctx: CurrentUser, service: AccountServiceDep
) -> AccountResponse:
    try:
        return service.update_profile(ctx, req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/account/avatar", response_model=AccountResponse)
async def upload_avatar(
    ctx: CurrentUser,
    service: AccountServiceDep,
    file: Annotated[UploadFile, File()],
) -> AccountResponse:
    """Profilbild hochladen (multipart). Speichert in den avatars-Bucket und
    setzt avatar_url im Profil. Funktioniert für beide Login-Wege."""
    content = await file.read()
    try:
        return service.upload_avatar(
            ctx, content, file.content_type or "application/octet-stream"
        )
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/totp/enroll", response_model=TotpEnrollResponse)
def totp_enroll(ctx: CurrentUser, service: AccountServiceDep) -> TotpEnrollResponse:
    try:
        return service.totp_enroll(ctx)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/totp/verify", response_model=TotpVerifyResponse)
def totp_verify(
    req: TotpVerifyRequest, ctx: CurrentUser, service: AccountServiceDep
) -> TotpVerifyResponse:
    try:
        return service.totp_verify(ctx, req.code)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/totp/disable", response_model=AccountResponse)
def totp_disable(
    req: TotpDisableRequest, ctx: CurrentUser, service: AccountServiceDep
) -> AccountResponse:
    try:
        return service.totp_disable(ctx, req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
