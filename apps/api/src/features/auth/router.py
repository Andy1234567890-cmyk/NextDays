"""Router für auth. Gemountet unter /api/v1/auth."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.core.config import Settings, get_settings
from src.core.ratelimit import client_ip_from_xff
from src.core.security import (
    AuthContext,
    CurrentPlatformAdmin,
    CurrentUser,
    decode_token,
    require_platform_write,
)
from src.core.uploads import read_upload
from src.features.account_deletion.dependencies import InAppLoeschungDep
from src.features.account_deletion.schemas import (
    InAppLoeschRequest,
    InAppLoeschResponse,
    LoeschStatusResponse,
)
from src.features.account_deletion.service import LoeschantragError
from src.features.login_devices.dependencies import LoginDeviceServiceDep
from src.features.login_devices.service import LoginDeviceService

from . import demo_zugang as demo
from .dependencies import (
    AccountServiceDep,
    AuthServiceDep,
    EinladungServiceDep,
    MfaServiceDep,
    OtpServiceDep,
    OwnerAssignmentServiceDep,
    StaffAssignmentServiceDep,
    require_permission,
)
from .einladung_service import ZWECK_INVITE, ZWECK_RESET, EinladungError
from .mfa_service import MfaError
from .otp_service import OtpError
from .permissions import Capability
from .schemas import (
    AccommodationTypeUpdate,
    AccountResponse,
    DefaultLanguageUpdate,
    EinladungAnnehmenRequest,
    InviteRequest,
    InviteResponse,
    LoginRequest,
    LoginResponse,
    ManagedUserDeactivateResponse,
    MeResponse,
    MfaAdminResetRequest,
    MfaAdminResetResponse,
    MfaFactor,
    MfaReauth,
    MfaRecoveryCodesResponse,
    MfaRecoveryRedeemRequest,
    MfaStatusResponse,
    NeutraleAntwort,
    OwnerAssignmentResponse,
    OwnerAssignmentUpdate,
    PasswortNeuRequest,
    PasswortVergessenRequest,
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
    TokenPruefungResponse,
    TotpDisableRequest,
    TotpLoginRequest,
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


@router.post("/demo", response_model=LoginResponse)
def demo_zugang(
    request: Request,
    service: AuthServiceDep,
    settings: SettingsDep,
) -> LoginResponse:
    """Eine Session fuer den Vorfuehr-Mandanten — ohne Anmeldung des Besuchers.

    Fuer den Knopf „Demo ansehen" auf der Marketing-Seite: der Besucher landet
    in der ECHTEN Anwendung statt in einem eingefrorenen Schnappschuss (siehe
    docs/ANALYSE-storylane-technik.md — kein Anbieter kann das, weil keiner ein
    eigenes Backend hat).

    OEFFENTLICH, absichtlich: es gibt nichts zu authentifizieren, das ist der
    Zweck. Die Zugangsdaten kennt nur der Server (`DEMO_LOGIN`/
    `DEMO_PASSWORT`); der Besucher bekommt ausschliesslich die fertige Session.
    Stuenden sie auf der Seite, waeren sie in jedem Screenshot und in jeder
    Suchmaschine — und dauerhaft gueltig.

    Die Session ist echt und traegt Rolle `admin`, kann aber nichts aendern:
    `demo_gate` (0407) lehnt fuer Nutzer eines Demo-Mandanten jede nicht-lesende
    Methode ab, auch auf den 76 Routen ohne Rollen-Guard.

    Rate-Limit: eigener Bucket `auth_public` (ratelimit_middleware), damit der
    Endpunkt nicht als kostenloser Token-Automat dient.

    2FA: der Vorfuehr-Zugang hat bewusst keine — sonst waere die Demo nicht
    ohne Zutun erreichbar. Kommt trotzdem eine MFA-Aufforderung zurueck, ist am
    Konto etwas verstellt, und der Endpunkt gibt nichts heraus (fail-closed).
    """
    try:
        login, passwort, erwarteter_tenant = demo.demo_zugangsdaten()
        resp = service.login(
            LoginRequest(email=login, password=passwort),
            _client_user_agent(request),
        )
        demo.session_pruefen(
            mfa_required=resp.mfa_required, hat_session=resp.session is not None
        )
        # Der Mandant steht im TOKEN, nicht in der Antwort: `LoginResponse`
        # traegt bewusst keine Nutzerdaten. Die Claims sind ohnehin die
        # verlaesslichere Quelle — sie sind es, die der API-Guard spaeter liest.
        claims = _claims(resp.session.access_token, settings) or {}
        meta = claims.get("app_metadata")
        demo.tenant_pruefen(
            erwarteter_tenant,
            (meta or {}).get("tenant_id") if isinstance(meta, dict) else None,
            user_id=str(claims.get("sub") or "(unbekannt)"),
        )
    except demo.DemoZugangFehler as exc:
        raise demo.als_http_fehler(exc) from exc
    except AuthError as exc:
        # Der Vorfuehr-Zugang ist Betriebssache, kein Nutzerfehler: ein falsches
        # Passwort in der Umgebung ist eine Stoerung (503), keine Ablehnung
        # (401) — sonst suchte man den Fehler beim Besucher.
        demo.login_fehler_melden(exc.message)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Die Vorfuehrung ist gerade nicht erreichbar.",
        ) from exc
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
    serverseitig in der RPC (nur ctx.user_id) — kein Client-Parameter.

    NICHT im Vorfuehr-Mandanten (0407): dort teilen ALLE Besucher denselben
    Zugang, und der Verlauf traegt IP-Adressen. Jeder Besucher saehe die IPs
    aller anderen — personenbezogene Daten Dritter, ausgeloest durch nichts als
    einen Klick auf „Demo ansehen". Gemessen am 18.08.2026: die Liste enthielt
    die Adressen aller vorherigen Aufrufe.

    Leere Liste statt 403: der Geraeteverlauf ist eine Anzeige, keine Aktion.
    Ein Fehler an dieser Stelle liesse die Kontoseite der Vorfuehrung kaputt
    aussehen — leer ist die wahre Aussage („keine Sitzungen, die dich
    betreffen").
    """
    if demo.ist_vorfuehrung(ctx.tenant_id):
        return []
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


@router.patch("/tenant/default-language", response_model=MeResponse)
def set_default_language(
    req: DefaultLanguageUpdate,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TENANT))],
    service: AuthServiceDep,
) -> MeResponse:
    """Standardsprache des Betriebs setzen — Stufe 2 der Mail-Sprachkette.

    Ohne diesen Endpunkt war `tenants.default_language` (0335) nur lesbar und
    blieb dauerhaft NULL: jeder Empfänger ohne eigene Sprachwahl bekam
    Englisch, obwohl die Kette genau das verhindern sollte.
    """
    try:
        return service.set_default_language(ctx, req.default_language)
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


@router.post(
    "/invite/{user_id}/resend",
    status_code=status.HTTP_204_NO_CONTENT,
)
def resend_invite(
    user_id: str,
    service: AuthServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_STAFF))
    ],
) -> None:
    """Einladungsmail erneut verschicken (die erste kam nicht an).

    Erfordert MANAGE_STAFF — dieselbe Berechtigung wie das Einladen selbst, und
    der Dienst prüft denselben Tenant-Scope wie die Nutzerliste (Wurzel 9). Der
    zuvor verschickte Link wird dabei entwertet, es gilt immer nur der neueste.
    """
    try:
        service.einladung_erneut_senden(ctx, user_id)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Öffentliche Token-Vorgänge (ohne Session) -----------------------------
#
# Bewusst OHNE Guard: wer eine Einladung annimmt, hat noch nie ein Passwort
# gehabt, und wer seins vergessen hat, kann sich nicht anmelden. Der Einmal-Token
# aus der Mail IST die Berechtigung — er liegt nur als SHA-256 in der DB, ist
# zeitlich begrenzt und danach verbraucht. Ratelimit: eigener strenger Bucket
# `auth_public` (Wurzel 8), zusätzlich eine Sperrfrist je Konto im Dienst.


@router.get("/einladung/pruefen", response_model=TokenPruefungResponse)
def einladung_pruefen(
    token: str, service: EinladungServiceDep
) -> TokenPruefungResponse:
    """Vorab prüfen, ob ein Einladungslink noch gilt (öffentlich).

    Damit die Annahmeseite „Link abgelaufen" zeigen kann, BEVOR der Nutzer ein
    Passwort eintippt. Verbraucht den Token nicht. Antwortet immer 200 mit
    `gueltig` — ein 404 für unbekannte Tokens wäre ein Orakel, mit dem man
    geratene Tokens durchprobieren könnte.

    Liefert zusätzlich die Sprache des Eingeladenen, damit die Seite in
    derselben Sprache erscheint wie die Einladungsmail. Mehr gibt der Endpunkt
    über den Token NICHT preis (siehe `TokenPruefungResponse`).

    `bereits_eingeloest` sagt der Seite, dass sie zur ANMELDUNG führen soll:
    Wer ein zweites Mal auf den Link in seiner Mail klickt, hat sein Passwort
    schon angelegt — „Link ungültig" wäre für ihn eine Sackgasse mit
    Warndreieck für einen normalen Vorgang. Nur bei einem Treffer auf den
    echten Token; ein geratener Token erfährt davon nichts.
    """
    gueltig, sprache = service.pruefen_mit_sprache(token, ZWECK_INVITE)
    return TokenPruefungResponse(
        gueltig=gueltig,
        sprache=sprache,
        # Nur nachsehen, wenn der Token nicht (mehr) offen ist — bei einem
        # gültigen Link ist die Frage beantwortet und der Extra-Query unnötig.
        bereits_eingeloest=(
            False if gueltig else service.bereits_eingeloest(token, ZWECK_INVITE)
        ),
    )


@router.post("/einladung/annehmen", status_code=status.HTTP_204_NO_CONTENT)
def einladung_annehmen(
    req: EinladungAnnehmenRequest, service: EinladungServiceDep
) -> None:
    """Einladung annehmen und das eigene erste Passwort setzen (öffentlich).

    Fehlerfälle sind bewusst NICHT unterscheidbar (abgelaufen, verbraucht,
    erfunden) — eine genaue Auskunft würde verraten, ob ein Token existiert.
    """
    try:
        service.passwort_setzen(
            req.token, req.password.get_secret_value(), ZWECK_INVITE
        )
    except EinladungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/passwort-vergessen", response_model=NeutraleAntwort)
def passwort_vergessen(
    req: PasswortVergessenRequest, service: EinladungServiceDep
) -> NeutraleAntwort:
    """Reset-Link anfordern (öffentlich).

    Die Antwort ist IMMER dieselbe — ein unterscheidbarer Fehler (oder Status)
    wäre ein Verzeichnis, welche Adressen ein Konto haben. Deshalb wird hier
    auch keine Ausnahme gemappt: der Dienst beantwortet jeden Abbruch neutral
    und protokolliert ihn.
    """
    return NeutraleAntwort(message=service.passwort_reset_anfordern(req.email))


@router.get("/passwort-neu/pruefen", response_model=TokenPruefungResponse)
def passwort_neu_pruefen(
    token: str, service: EinladungServiceDep
) -> TokenPruefungResponse:
    """Vorab prüfen, ob ein Reset-Link noch gilt (öffentlich, verbraucht nicht).

    Gibt wie der Einladungs-Zwilling die Sprache des Empfängers mit zurück —
    die Reset-Mail ging in dieser Sprache raus, die Seite dahinter muss ihr
    folgen. Ebenso `bereits_eingeloest`: Wer seinen Reset-Link ein zweites Mal
    öffnet, hat sein neues Passwort schon gesetzt und gehört zur Anmeldung.
    """
    gueltig, sprache = service.pruefen_mit_sprache(token, ZWECK_RESET)
    return TokenPruefungResponse(
        gueltig=gueltig,
        sprache=sprache,
        bereits_eingeloest=(
            False if gueltig else service.bereits_eingeloest(token, ZWECK_RESET)
        ),
    )


@router.post("/passwort-neu", status_code=status.HTTP_204_NO_CONTENT)
def passwort_neu(req: PasswortNeuRequest, service: EinladungServiceDep) -> None:
    """Neues Passwort über den Link aus der Mail setzen (öffentlich).

    Nach dem Wechsel widerruft der Dienst JEDE Sitzung des Kontos: ein Reset ist
    der Weg, den ein Kompromittierter geht — eine überlebende fremde Sitzung
    würde ihn wirkungslos machen.
    """
    try:
        service.passwort_setzen(
            req.token, req.password.get_secret_value(), ZWECK_RESET
        )
    except EinladungError as exc:
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


@router.get("/account/users/{user_id}", response_model=TenantUser)
def get_managed_user(
    user_id: str, ctx: CurrentUser, service: AccountServiceDep
) -> TenantUser:
    """Ein Nutzer der Verwaltung (Konto → Benutzer → Detailseite).

    Gleicher Scope wie der List-Pfad (Wurzel 9): Leserolle + eigener Tenant,
    sonst 403/404. Ohne diese Re-Prüfung wäre die Detailseite eine IDOR auf
    Kontaktdaten, Rechte und interne Anmerkungen fremder Nutzer."""
    try:
        return service.get_managed_user(ctx, user_id)
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
            preferred_language=req.preferred_language,
            # Nur die WIRKLICH gesendeten Kontaktfelder weitergeben: sonst
            # könnte ein Aufruf, der nur die Rolle ändert, gleichzeitig die
            # Telefonnummer leeren (`None` heißt hier „nicht mitgeschickt").
            kontakt=req.model_dump(
                include={
                    "phone",
                    "additional_phone",
                    "hide_phones",
                    "spoken_languages",
                    "notes",
                },
                exclude_unset=True,
            ),
        )
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/account/users/{user_id}/deactivate",
    response_model=ManagedUserDeactivateResponse,
)
def deactivate_managed_user(
    user_id: str, ctx: CurrentUser, service: AccountServiceDep
) -> ManagedUserDeactivateResponse:
    """Zugang sperren, ohne zu löschen (Konto → Benutzer → Deaktivieren).

    Setzt `users.deactivated_at` UND den GoTrue-Bann. `login_gesperrt=false`
    heißt: das Feld steht, der Anmeldedienst hat aber nicht mitgezogen — die
    Oberfläche benennt das, statt einen Teilerfolg als „erledigt" auszugeben."""
    try:
        nutzer, gesperrt = service.deactivate_managed_user(ctx, user_id)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return ManagedUserDeactivateResponse(user=nutzer, login_gesperrt=gesperrt)


@router.post(
    "/account/users/{user_id}/activate",
    response_model=ManagedUserDeactivateResponse,
)
def activate_managed_user(
    user_id: str, ctx: CurrentUser, service: AccountServiceDep
) -> ManagedUserDeactivateResponse:
    """Zugang wieder freischalten (Gegenzustand zu deactivate, Wurzel 1)."""
    try:
        nutzer, entsperrt = service.activate_managed_user(ctx, user_id)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return ManagedUserDeactivateResponse(user=nutzer, login_gesperrt=not entsperrt)


@router.delete("/account/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_managed_user(
    user_id: str, ctx: CurrentUser, service: AccountServiceDep
) -> None:
    """Nutzer aus dem eigenen Tenant löschen (Konto → Benutzer; admin/co_admin)."""
    try:
        service.delete_managed_user(ctx, user_id)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Konto-Löschung durch den Nutzer selbst (Apple 5.1.1(v)) ---------------
# Liegt im auth-Slice, weil es eine Konto-Aktion ist wie /account/email und
# /account/password. Die Fachlogik und die Antragstabelle gehören dem
# account_deletion-Slice — dort liegt auch der öffentliche Web-Weg, und beide
# Wege müssen auf demselben Löschbuch arbeiten.


@router.get("/account/deletion", response_model=LoeschStatusResponse)
def deletion_status(
    ctx: CurrentUser, loeschung: InAppLoeschungDep
) -> LoeschStatusResponse:
    """Liegt für dieses Konto ein Löschantrag vor?

    Die App fragt das, bevor sie den Löschknopf anbietet: sonst stellt jemand
    denselben Antrag mehrfach und hält ihn für wirkungslos (Wurzel 2).
    """
    try:
        return LoeschStatusResponse(**loeschung.status(ctx))
    except LoeschantragError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/account/deletion", response_model=InAppLoeschResponse)
def deletion_request(
    req: InAppLoeschRequest, ctx: CurrentUser, loeschung: InAppLoeschungDep
) -> InAppLoeschResponse:
    """Eigenes Konto löschen — mit Passwort-Rückfrage (Wurzel 7).

    Mitarbeiter, Eigentümer und Co-Admins sind danach sofort weg. Beim
    Kontoinhaber entsteht ein Antrag, weil am Konto der ganze Betrieb hängt und
    Belege gesetzlich aufzubewahren sind; die Antwort sagt, welcher der beiden
    Fälle eingetreten ist.
    """
    try:
        return InAppLoeschResponse(
            **loeschung.loeschen(
                ctx, passwort=req.current_password, grund=req.grund
            )
        )
    except AuthError as exc:
        # Die Passwort-Rückfrage stammt aus dem AccountService und wirft dessen
        # Fehler — inklusive 503 bei einer GoTrue-Störung. Der darf NICHT als
        # „Passwort falsch" beim Nutzer landen (Wurzel 5).
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except LoeschantragError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.delete("/account/deletion", response_model=LoeschStatusResponse)
def deletion_withdraw(
    ctx: CurrentUser, loeschung: InAppLoeschungDep
) -> LoeschStatusResponse:
    """Eigenen Löschantrag zurückziehen (Gegenzustand, Wurzel 1)."""
    try:
        return LoeschStatusResponse(**loeschung.antrag_zuruecknehmen(ctx))
    except LoeschantragError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


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


# --- ABGELOESTE App-2FA (user_mfa) ------------------------------------------
#
# Diese beiden Endpunkte sind seit Migration 0341 STILLGELEGT (410 Gone).
#
# Sie legten eine 2FA an, die AUSSCHLIESSLICH in `POST /auth/login` geprueft
# wurde. Wer sich direkt gegen GoTrue anmeldet (`POST /auth/v1/token`,
# anon-Key), umging sie vollstaendig — und die Session, die
# `login_totp` danach ausstellte, trug strukturell `aal1`, weil GoTrue von
# dem zweiten Faktor nichts weiss. Zusaetzlich lag das TOTP-Secret im
# KLARTEXT in `public.user_mfa` (Wurzel 6).
#
# Sie hier stehen zu lassen waere schlimmer als sie zu entfernen: es gaebe
# ZWEI Wahrheiten darueber, ob ein Konto einen zweiten Faktor hat. Ein Nutzer,
# der sich hier einschreibt, haette in GoTrue KEINEN Faktor — der neue Guard
# wuerde ihn nach Ablauf der Frist trotz aktiver „2FA" aussperren, waehrend
# sein aal1-Token bis dahin ueberall durchkaeme.
#
# Der Weg ist jetzt GoTrue direkt: `POST /auth/v1/factors` (totp | phone |
# webauthn), dann `/challenge` + `/verify`. Siehe docs/API.md.
#
# `POST /totp/disable` bleibt BEWUSST funktionsfaehig (siehe unten): Wer aus
# dem Altbestand noch eine `user_mfa`-Zeile hat, muss sie loswerden koennen —
# ein Ausschalter ohne Weg zurueck waere eine Sperre (Wurzel 1).


@router.post("/totp/enroll", status_code=status.HTTP_410_GONE)
def totp_enroll_abgeloest() -> None:
    """Abgeloest durch GoTrue-natives MFA (0341). Immer 410."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "Dieser Weg ist abgelöst. Die Zwei-Faktor-Authentifizierung wird "
            "jetzt direkt über den Anmeldedienst eingerichtet."
        ),
    )


@router.post("/totp/verify", status_code=status.HTTP_410_GONE)
def totp_verify_abgeloest() -> None:
    """Abgeloest durch GoTrue-natives MFA (0341). Immer 410."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "Dieser Weg ist abgelöst. Die Zwei-Faktor-Authentifizierung wird "
            "jetzt direkt über den Anmeldedienst eingerichtet."
        ),
    )


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


# --- Zwei-Faktor-Authentifizierung (AAL2) -----------------------------------
#
# Enrollment, Challenge und Verify der drei echten Faktoren (TOTP, SMS/Phone,
# WebAuthn/Passkey) laufen DIREKT gegen GoTrue (/auth/v1/factors...). Sie sind
# hier bewusst nicht gespiegelt: GoTrue kann sie nativ (live gegen
# auth.factor_type geprueft), und ein zweiter Weg waere eine zweite Wahrheit
# darueber, ob jemand einen zweiten Faktor hat.
#
# Hier liegt nur, was GoTrue NICHT kann: der Pflicht-/Statusblick, die
# Wiederherstellungscodes und der Admin-Reset zur Aussperr-Rettung.


@router.get("/mfa/status", response_model=MfaStatusResponse)
def mfa_status(
    ctx: CurrentUser, service: MfaServiceDep, settings: SettingsDep
) -> MfaStatusResponse:
    """Faktoren, Pflicht-Status und Rest-Wiederherstellungscodes des EIGENEN
    Kontos. Nutzer ausschliesslich aus dem Token (Wurzel 3) — es gibt bewusst
    keinen `user_id`-Parameter, der einen fremden Status ausliefern koennte."""
    try:
        faktoren = service.faktoren(ctx.user_id)
        rolle = service.rolle_aus_db(ctx.user_id)
        pflicht = service.pflicht_pruefen(
            ctx.user_id, rolle=rolle, tenant_id=ctx.tenant_id
        )
        return MfaStatusResponse(
            factors=[
                MfaFactor(
                    id=str(f.get("id")),
                    factor_type=str(f.get("factor_type")),
                    friendly_name=f.get("friendly_name"),
                    status=str(f.get("status")),
                    created_at=f.get("created_at"),
                )
                for f in faktoren
            ],
            aal=ctx.aal,
            mfa_required=pflicht.pflichtig,
            mfa_enrolled=pflicht.hat_faktor,
            mfa_grace_until=(
                pflicht.grace_until.isoformat() if pflicht.grace_until else None
            ),
            recovery_codes_left=service.codes_offen(ctx.user_id),
            sms_available=settings.mfa_sms_available,
        )
    except MfaError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/mfa/recovery-codes", response_model=MfaRecoveryCodesResponse)
def mfa_recovery_codes_neu(
    req: MfaReauth,
    ctx: CurrentUser,
    service: MfaServiceDep,
    account: AccountServiceDep,
) -> MfaRecoveryCodesResponse:
    """Wiederherstellungscodes neu erzeugen — ERSETZT alle bisherigen.

    Sicherheitskritische Selbst-Aenderung → Re-Auth (Wurzel 7): entweder das
    aktuelle Passwort oder ein bereits auf aal2 gehobenes Token. Ohne diese
    Huerde koennte ein gekapertes aal1-Cookie sich selbst einen dauerhaften
    Zweitschluessel ausstellen.

    Die Codes stehen NUR in dieser Antwort — gespeichert wird der Hash.
    """
    _mfa_reauth(ctx, account, req)
    try:
        return MfaRecoveryCodesResponse(codes=service.codes_erzeugen(ctx.user_id))
    except MfaError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/mfa/recovery-codes/redeem", status_code=status.HTTP_204_NO_CONTENT)
def mfa_recovery_redeem(
    req: MfaRecoveryRedeemRequest,
    request: Request,
    ctx: CurrentUser,
    service: MfaServiceDep,
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    """Einen Wiederherstellungscode einloesen (Telefon verloren).

    Einmalig: der Verbrauch ist ein atomarer DB-Claim, ein zweiter Versuch mit
    demselben Code ist 401 (Wurzel 2). Liegt im strengen `mfa`-Rate-Limit-
    Bucket, damit der Code-Raum nicht durchprobierbar ist (Wurzel 8).
    """
    try:
        service.code_einloesen(
            ctx.user_id, req.code, ip=_client_ip(request, settings)
        )
    except MfaError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/mfa/factors/{factor_id}", status_code=status.HTTP_204_NO_CONTENT)
def mfa_faktor_entfernen(
    factor_id: str,
    req: MfaReauth,
    ctx: CurrentUser,
    service: MfaServiceDep,
    account: AccountServiceDep,
) -> None:
    """Einen eigenen Faktor entfernen.

    Wurzel 9: `factor_id` wird gegen die Faktor-Liste DIESES Nutzers geprueft —
    ein fremder Faktor ist 404, nicht etwa loeschbar.

    Aussperr-Schutz: Der letzte Faktor eines Pflicht-Kontos geht nur, wenn noch
    Wiederherstellungscodes uebrig sind (sonst 409).
    """
    _mfa_reauth(ctx, account, req)
    try:
        service.faktor_entfernen_erlaubt(ctx.user_id, factor_id)
        service.faktor_entfernen(ctx.user_id, factor_id)
    except MfaError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


def _mfa_reauth(
    ctx: AuthContext, account: AccountServiceDep, req: MfaReauth
) -> None:
    """Re-Auth-Huerde fuer sicherheitskritische 2FA-Aenderungen (Wurzel 7).

    Zwei gleichwertige Nachweise:
      - das aktuelle Passwort, oder
      - ein Token, das bereits aal2 traegt (der zweite Faktor wurde in DIESER
        Sitzung geloest).

    Fail-CLOSED: liegt keines von beiden vor, ist es 401 — auch fuer reine
    OAuth-Konten. Fuer die ist der aal2-Weg der vorgesehene, nicht eine
    Ausnahme „ohne Passwort einfach durch" (das waere ein Fallback, Wurzel 4).
    """
    if ctx.aal == "aal2":
        return
    if req.current_password is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Aktuelles Passwort oder gelöster zweiter Faktor erforderlich.",
        )
    try:
        account.passwort_pruefen(ctx, req.current_password)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/mfa/admin/reset", response_model=MfaAdminResetResponse)
def mfa_admin_reset(
    req: MfaAdminResetRequest,
    request: Request,
    platform_ctx: CurrentPlatformAdmin,
    service: MfaServiceDep,
    settings: Annotated[Settings, Depends(get_settings)],
) -> MfaAdminResetResponse:
    """Aussperr-Rettung: alle Faktoren eines FREMDEN Kontos zuruecksetzen.

    Nur der Plattform-Admin (`CurrentPlatformAdmin` prueft bei jedem Request
    frisch gegen public.platform_admins, nicht gegen das JWT). Schreibend →
    require_platform_write, ein reiner Support-Account darf das nicht.

    Der Eingriff ist der maechtigste im System — danach kommt jemand mit
    blossem Passwort in ein fremdes Konto. Er wird deshalb IMMER auditiert
    (`mfa_reset_audit`), und die Begruendung ist Pflicht. Schlaegt das Audit
    fehl, schlaegt der ganze Aufruf fehl: ein Reset ohne Spur waere schlimmer
    als kein Reset.
    """
    require_platform_write(platform_ctx)
    try:
        entfernt = service.faktoren_zuruecksetzen(req.user_id)
        service.reset_auditieren(
            actor_user_id=platform_ctx.user_id,
            actor_email=platform_ctx.email,
            target_user_id=req.user_id,
            target_email=service.email_von(req.user_id),
            entfernt=entfernt,
            reason=req.reason,
            ip=_client_ip(request, settings),
            user_agent=_client_user_agent(request),
        )
    except MfaError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return MfaAdminResetResponse(
        removed_factors=len(entfernt), target_user_id=req.user_id
    )
