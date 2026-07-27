"""Router für auth. Gemountet unter /api/v1/auth."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.core.config import Settings, get_settings
from src.core.ratelimit import client_ip_from_xff
from src.core.security import AuthContext, CurrentUser, decode_token
from src.core.uploads import read_upload
from src.features.login_devices.dependencies import LoginDeviceServiceDep
from src.features.login_devices.service import LoginDeviceService

from .dependencies import (
    AccountServiceDep,
    AuthServiceDep,
    OtpServiceDep,
    OwnerAssignmentServiceDep,
    StaffAssignmentServiceDep,
    require_permission,
)
from .otp_service import OtpError
from .permissions import Capability
from .schemas import (
    AccommodationTypeUpdate,
    AccountResponse,
    InviteRequest,
    InviteResponse,
    LoginRequest,
    LoginResponse,
    MeResponse,
    OwnerAssignmentResponse,
    OwnerAssignmentUpdate,
    PhoneDisableRequest,
    PhoneSendCodeRequest,
    PhoneVerifyRequest,
    RefreshRequest,
    RegisterRequest,
    RevokeOthersResponse,
    SessionInfo,
    SessionResponse,
    SliceHealth,
    SmsLoginRequest,
    StaffAssignmentResponse,
    StaffAssignmentUpdate,
    TenantUser,
    TotpDisableRequest,
    TotpEnrollResponse,
    TotpLoginRequest,
    TotpVerifyRequest,
    TotpVerifyResponse,
    UpdateEmailRequest,
    UpdateManagedUserRequest,
    UpdateNameRequest,
    UpdatePasswordRequest,
    UpdateProfileRequest,
)
from .service import AuthError

SettingsDep = Annotated[Settings, Depends(get_settings)]

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


def _client_user_agent(request: Request) -> str | None:
    """Der ECHTE Browser-User-Agent. Der BFF ruft server-zu-server, sein eigener
    User-Agent-Header ist also node/undici — den echten Browser-UA reicht er in
    X-Client-User-Agent durch. Fällt auf den normalen User-Agent-Header zurück
    (Direktzugriff, z. B. Mobile-App). GoTrue speichert ihn in auth.sessions."""
    return request.headers.get("x-client-user-agent") or request.headers.get(
        "user-agent"
    )


def _client_ip(request: Request, settings: Settings) -> str | None:
    """Die ECHTE Browser-IP. Der BFF reicht sie in X-Client-IP durch (sein eigener
    Peer ist der App-Server). Fällt sonst auf X-Forwarded-For (Traefik) bzw. die
    Peer-IP zurück — spoofing-sicher über trusted hops (wie das Rate-Limiting)."""
    explicit = request.headers.get("x-client-ip")
    if explicit:
        return explicit.strip()
    peer = request.client.host if request.client else None
    return client_ip_from_xff(
        request.headers.get("x-forwarded-for"),
        peer,
        settings.rate_limit_trusted_proxy_hops,
    )


def _record_device(
    resp: LoginResponse,
    request: Request,
    settings: Settings,
    devices: LoginDeviceService,
) -> None:
    """Nach erfolgreichem Login (Session vorhanden) genau EINE Geräte-Zeile mit
    echter IP + UA + Ort schreiben. Bei mfa_required (noch keine Session) passiert
    nichts. Best effort — ein Fehler hier darf den Login nicht kippen."""
    if resp.session is None:
        return
    session_id = _session_id_from_token(resp.session.access_token, settings)
    user_id = _user_id_from_token(resp.session.access_token, settings)
    if not user_id:
        return
    devices.record_login(
        user_id=user_id,
        session_id=session_id,
        ip=_client_ip(request, settings),
        user_agent=_client_user_agent(request),
    )


def _claims(token: str, settings: Settings) -> dict[str, object] | None:
    try:
        return decode_token(token, settings)
    except HTTPException:
        return None


def _session_id_from_token(token: str, settings: Settings) -> str | None:
    claims = _claims(token, settings)
    sid = claims.get("session_id") if claims else None
    return sid if isinstance(sid, str) else None


def _user_id_from_token(token: str, settings: Settings) -> str | None:
    claims = _claims(token, settings)
    sub = claims.get("sub") if claims else None
    return sub if isinstance(sub, str) else None


@router.post("/login", response_model=LoginResponse)
def login(
    req: LoginRequest,
    request: Request,
    service: AuthServiceDep,
    settings: SettingsDep,
    devices: LoginDeviceServiceDep,
) -> LoginResponse:
    """Erster Login-Schritt. Bei aktivem 2FA kommt mfa_required=True + mfa_token
    (KEINE Session) zurück; die Session gibt es erst nach /auth/login/totp."""
    try:
        resp = service.login(req, _client_user_agent(request))
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    _record_device(resp, request, settings, devices)
    return resp


@router.post("/login/totp", response_model=LoginResponse)
def login_totp(
    req: TotpLoginRequest,
    request: Request,
    service: AuthServiceDep,
    settings: SettingsDep,
    devices: LoginDeviceServiceDep,
) -> LoginResponse:
    """Zweiter Login-Schritt bei aktivem 2FA: mfa_token + TOTP-/Recovery-Code
    gegen eine echte Session einlösen."""
    try:
        resp = service.login_totp(req, _client_user_agent(request))
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    _record_device(resp, request, settings, devices)
    return resp


@router.post("/login/sms", response_model=LoginResponse)
def login_sms(
    req: SmsLoginRequest,
    request: Request,
    service: AuthServiceDep,
    settings: SettingsDep,
    devices: LoginDeviceServiceDep,
) -> LoginResponse:
    """Zweiter Login-Schritt bei SMS-2FA: mfa_token + SMS-Code gegen eine echte
    Session einlösen."""
    try:
        resp = service.login_sms(req, _client_user_agent(request))
    except (AuthError, OtpError) as exc:
        # OtpError (falscher/abgelaufener Code, zu viele Versuche) präzise als
        # 401/410/429 durchreichen — nie als 500 (fail-closed, Wurzel 5).
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    _record_device(resp, request, settings, devices)
    return resp


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


@router.get("/sessions", response_model=list[SessionInfo])
def list_sessions(ctx: CurrentUser, service: AuthServiceDep) -> list[SessionInfo]:
    """Aktive Sitzungen des eingeloggten Nutzers (Geräteverlauf). Scope steckt
    serverseitig in der RPC (nur ctx.user_id) — kein Client-Parameter."""
    return service.list_sessions(ctx)


@router.delete("/sessions/others", response_model=RevokeOthersResponse)
def revoke_other_sessions(
    ctx: CurrentUser, service: AuthServiceDep
) -> RevokeOthersResponse:
    """Auf allen anderen Geräten abmelden. Die aktuelle Sitzung bleibt."""
    return RevokeOthersResponse(revoked=service.revoke_other_sessions(ctx))


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(
    session_id: str, ctx: CurrentUser, service: AuthServiceDep
) -> None:
    """Ein einzelnes Gerät abmelden. 404, wenn die Sitzung nicht dem Nutzer
    gehört (Scope in der RPC, Wurzel 9)."""
    try:
        service.revoke_session(ctx, session_id)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


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
        return service.invite(req, tenant_id=ctx.tenant_id, granter_id=ctx.user_id)
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
            ctx,
            user_id,
            full_name=req.full_name,
            role=req.role,
            permissions=req.permissions,
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


# --- Telefonnummer-Verifizierung (SMS-OTP, Airbnb-„Confirm account") ---------


@router.post("/phone/send-code", status_code=status.HTTP_204_NO_CONTENT)
def phone_send_code(
    req: PhoneSendCodeRequest, ctx: CurrentUser, service: OtpServiceDep
) -> None:
    """SMS-Code an die eigene Telefonnummer senden. Nutzer AUSSCHLIESSLICH aus
    dem Token (Wurzel 3). Idempotent + rate-limited im Service."""
    try:
        service.send_phone_code(ctx, req.phone)
    except OtpError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/phone/disable", response_model=AccountResponse)
def phone_disable(
    req: PhoneDisableRequest, ctx: CurrentUser, service: AccountServiceDep
) -> AccountResponse:
    """Bestätigte Nummer als Zweitfaktor entfernen (Gegenzustand zu verify).

    Re-Auth über das Passwort statt über einen SMS-Code: Wer das Telefon
    verloren hat, kann keinen Code empfangen — genau dann braucht man den
    Ausschalter (Wurzel 7).
    """
    try:
        return service.phone_disable(ctx, req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/phone/verify", status_code=status.HTTP_204_NO_CONTENT)
def phone_verify(
    req: PhoneVerifyRequest, ctx: CurrentUser, service: OtpServiceDep
) -> None:
    """Code prüfen → Nummer als verifiziert setzen (users.phone_verified_at)."""
    try:
        service.verify_phone_code(ctx, req.phone, req.code)
    except OtpError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
