"""Router für auth. Gemountet unter /api/v1/auth."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.core.security import AuthContext, CurrentUser
from src.core.uploads import read_upload

from .dependencies import (
    AccountServiceDep,
    AuthServiceDep,
    OwnerAssignmentServiceDep,
    StaffAssignmentServiceDep,
    require_permission,
)
from .permissions import Capability
from .schemas import (
    AccommodationTypeUpdate,
    AccountResponse,
    InviteRequest,
    InviteResponse,
    LoginRequest,
    MeResponse,
    OwnerAssignmentResponse,
    OwnerAssignmentUpdate,
    RefreshRequest,
    RegisterRequest,
    SessionResponse,
    SliceHealth,
    StaffAssignmentResponse,
    StaffAssignmentUpdate,
    TenantUser,
    TotpDisableRequest,
    TotpEnrollResponse,
    TotpVerifyRequest,
    TotpVerifyResponse,
    UpdateEmailRequest,
    UpdateManagedUserRequest,
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


@router.post("/refresh", response_model=SessionResponse)
def refresh(req: RefreshRequest, service: AuthServiceDep) -> SessionResponse:
    """Silent-Refresh (Mobile): frische Session aus dem Refresh-Token. KEIN
    CurrentUser-Guard — der Access-Token ist ja gerade abgelaufen. Rate-Limit
    läuft über den Auth-Bucket (siehe _select_bucket im ratelimit-Middleware)."""
    try:
        return service.refresh(req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/me", response_model=MeResponse)
def me(ctx: CurrentUser, service: AuthServiceDep) -> MeResponse:
    return service.me(ctx)


@router.patch("/tenant/accommodation-type", response_model=MeResponse)
def set_accommodation_type(
    req: AccommodationTypeUpdate,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TENANT))],
    service: AuthServiceDep,
) -> MeResponse:
    try:
        return service.set_accommodation_type(ctx, req.accommodation_type)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


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


# --- Eigentümer-Objekt-Zuordnung (Lastenheft §4.2) ------------------------


@router.get(
    "/owners/{user_id}/properties",
    response_model=OwnerAssignmentResponse,
)
def get_owner_properties(
    user_id: str,
    service: OwnerAssignmentServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_OWNERS))
    ],
) -> OwnerAssignmentResponse:
    """Aktuelle Objekt-Zuordnung eines Eigentümers (Agentur-Sicht)."""
    try:
        return service.get(ctx, user_id)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put(
    "/owners/{user_id}/properties",
    response_model=OwnerAssignmentResponse,
)
def set_owner_properties(
    user_id: str,
    req: OwnerAssignmentUpdate,
    service: OwnerAssignmentServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_OWNERS))
    ],
) -> OwnerAssignmentResponse:
    """Objekt-Zuordnung eines Eigentümers setzen (Replace). Nur eigene Objekte."""
    try:
        return service.set(ctx, user_id, req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/staff/{user_id}/properties",
    response_model=StaffAssignmentResponse,
)
def get_staff_properties(
    user_id: str,
    service: StaffAssignmentServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_permission(Capability.ASSIGN_STAFF_TO_PROPERTY)),
    ],
) -> StaffAssignmentResponse:
    """Aktuelle Objekt-Freigabe eines Mitarbeiters (Agentur-Sicht)."""
    try:
        return service.get(ctx, user_id)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put(
    "/staff/{user_id}/properties",
    response_model=StaffAssignmentResponse,
)
def set_staff_properties(
    user_id: str,
    req: StaffAssignmentUpdate,
    service: StaffAssignmentServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_permission(Capability.ASSIGN_STAFF_TO_PROPERTY)),
    ],
) -> StaffAssignmentResponse:
    """Objekt-Freigabe eines Mitarbeiters setzen (Replace). Nur eigene Objekte."""
    try:
        return service.set(ctx, user_id, req)
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


@router.get(
    "/account/properties/{property_id}/contacts",
    response_model=list[TenantUser],
)
def list_property_contacts(
    property_id: str, ctx: CurrentUser, service: AccountServiceDep
) -> list[TenantUser]:
    """Für ein Objekt als Hauptkontakt wählbare Nutzer (§4.2/§4.3): admin/
    co_admin + dem Objekt zugewiesene Eigentümer + freigegebene Mitarbeiter."""
    try:
        return service.list_property_contacts(ctx, property_id)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/account/managed-users", response_model=list[TenantUser])
def list_managed_users(
    ctx: CurrentUser, service: AccountServiceDep
) -> list[TenantUser]:
    """Nutzerverwaltung (Konto → Benutzer): Admins sehen alle, sonst eigener
    Tenant; normale Benutzer (staff/cleaner) erhalten 403."""
    try:
        return service.list_managed_users(ctx)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/account/users/{user_id}", response_model=TenantUser)
def update_managed_user(
    user_id: str,
    req: UpdateManagedUserRequest,
    ctx: CurrentUser,
    service: AccountServiceDep,
) -> TenantUser:
    """Nutzer im eigenen Tenant bearbeiten (Konto → Benutzer; admin/co_admin)."""
    try:
        return service.update_managed_user(
            ctx, user_id, full_name=req.full_name, role=req.role,
        )
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/account/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_managed_user(
    user_id: str, ctx: CurrentUser, service: AccountServiceDep
) -> None:
    """Nutzer aus dem eigenen Tenant löschen (Konto → Benutzer; admin/co_admin)."""
    try:
        service.delete_managed_user(ctx, user_id)
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
    request: Request,
    service: AccountServiceDep,
) -> AccountResponse:
    """Profilbild hochladen (multipart). Speichert in den avatars-Bucket und
    setzt avatar_url im Profil. Funktioniert für beide Login-Wege."""
    content, content_type = await read_upload(request)
    try:
        return service.upload_avatar(
            ctx, content, content_type or "application/octet-stream"
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
