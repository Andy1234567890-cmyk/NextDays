"""Service-Schicht für auth.

Registrierung legt atomar Tenant + Owner-User an und schreibt tenant_id/role
ins JWT app_metadata (Quelle der Wahrheit für RLS). Bricht ein Schritt ab,
werden bereits angelegte Artefakte zurückgerollt — kein verwaister Tenant,
kein stilles Schlucken von Fehlern (PROJECT.md).
"""
from datetime import UTC, datetime, timedelta

import jwt
import pyotp
from pydantic import SecretStr
from supabase import Client
from supabase_auth import AuthResponse
from supabase_auth.errors import AuthError as GoTrueAuthError

from src.core.config import get_settings
from src.core.logging import get_logger, mask_email
from src.core.security import AuthContext

from .granular_permissions import (
    Permission,
    default_permissions_for,
    effective_permissions,
    normalize_permissions,
)
from .permissions import effective_capabilities
from .schemas import (
    InviteRequest,
    InviteResponse,
    LoginRequest,
    LoginResponse,
    MeResponse,
    RefreshRequest,
    RegisterRequest,
    SessionResponse,
    SliceHealth,
    TotpLoginRequest,
    UserRole,
)

# Kurzlebiges Pending-Token zwischen Passwort- und TOTP-Schritt. Signiert mit
# demselben HS256-Secret wie die Supabase-Access-Tokens, aber mit eigenem
# `typ`-Claim und OHNE `aud="authenticated"` — dadurch lehnt der API-Guard
# (verlangt audience="authenticated") es als Access-Token ab. Es taugt damit
# ausschließlich zum Einlösen des TOTP-Codes, nie für einen API-Zugriff.
_MFA_PENDING_TYP = "mfa_pending"  # noqa: S105 — Claim-Wert, kein Secret
_MFA_PENDING_TTL_SECONDS = 300

log = get_logger("nextdays.auth")


class AuthError(Exception):
    """Fachlicher Auth-Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class AuthService:
    slice_name = "auth"

    def __init__(self, anon_client: Client, service_client: Client) -> None:
        # anon: RLS-respektierende User-Calls (Login).
        # service: RLS-umgehende System-Calls (Tenant-/User-Anlage beim Register).
        self._anon = anon_client
        self._service = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def register(self, req: RegisterRequest) -> SessionResponse:
        """Erst-Registrierung: legt Tenant + Admin-User an (atomar mit Rollback).

        Der Gründer eines Tenants wird ADMIN (Betreiber/Agentur, voller Zugriff,
        darf Mitarbeiter/Eigentümer einladen). Die Rolle 'owner' (Hauseigentümer
        mit Daten-Split, Lastenheft §4.2) wird per invite vergeben.
        """
        tenant_id = self._create_tenant(req)
        try:
            user_id = self._create_auth_user(
                email=req.email,
                password=req.password,
                tenant_id=tenant_id,
                role=UserRole.admin,
            )
        except Exception:
            self._rollback_tenant(tenant_id)
            raise
        try:
            self._create_user_row(
                user_id=user_id,
                tenant_id=tenant_id,
                role=UserRole.admin,
                email=req.email,
                full_name=req.full_name,
            )
        except Exception:
            self._rollback_user(user_id)
            self._rollback_tenant(tenant_id)
            raise
        # Channel-Manager: für den neuen Tenant eine Provider-Group anlegen
        # (non-blocking — Registrierung darf daran nie scheitern).
        self._ensure_channel_manager_group(tenant_id)
        # Frisch registriert → 2FA ist noch nie aktiv, login() liefert also immer
        # eine Session (nie mfa_required). Die Session direkt zurückgeben, damit
        # /register weiter SessionResponse ist (der Client meldet sofort an).
        result = self.login(LoginRequest(email=req.email, password=req.password))
        if result.session is None:
            raise AuthError("Login nach Registrierung fehlgeschlagen.", status_code=500)
        return result.session

    def _ensure_channel_manager_group(self, tenant_id: str) -> None:
        """Legt die Channel-Manager-Group des Tenants an. Der Group-Name ist der
        Betriebsname (tenants.name) — ensure_group lädt ihn selbst. Lazy-Import
        gegen Zyklen; jeder Fehler wird verschluckt (rein additiv)."""
        try:
            from src.features.channel_manager.service import ChannelManagerService

            ChannelManagerService(service_client=self._service).ensure_group(
                tenant_id
            )
        except Exception as exc:  # noqa: BLE001 — darf Registrierung nie blockieren
            log.warning("channel_manager_group_failed", tenant_id=tenant_id, error=str(exc))

    def _effective_perms_of(self, user_id: str) -> frozenset:
        """Effektive feingranulare Rechte eines Nutzers (Quelle der Wahrheit: DB).

        Für den Escalation-Clamp (Wurzel 3): der Vergebende kann nur Rechte
        weiterreichen, die er selbst besitzt. Admin = alle."""
        row = (
            self._service.table("users")
            .select("role, permissions")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        data = row.data[0] if row.data else {}
        role_raw = data.get("role")
        role = UserRole(role_raw) if role_raw in UserRole.__members__ else None
        return effective_permissions(role, data.get("permissions"))

    def invite(
        self, req: InviteRequest, tenant_id: str, granter_id: str
    ) -> InviteResponse:
        """Weiteren Nutzer (Mitarbeiter, Co-Admin, …) in den Tenant einladen.

        Legt Auth-User mit der gewünschten Rolle im BESTEHENDEN Tenant an —
        kein neuer Tenant. Rollback des Auth-Users, falls die users-Row scheitert.
        ``granter_id`` ist der einladende Nutzer: seine effektiven Rechte klemmen
        die Vergabe (Wurzel 3, keine Privilege-Escalation)."""
        if req.role is UserRole.admin:
            # Admin entsteht nur bei register (Tenant-Gründung). Einladbar sind
            # co_admin, owner (Hauseigentümer mit Daten-Split), staff, cleaner.
            raise AuthError(
                "Admin kann nicht eingeladen werden; entsteht bei register.",
                status_code=400,
            )
        # Berechtigungen: explizit gewählte (Wizard) oder Rollen-Defaults, in
        # beiden Fällen auf die eigenen Rechte des Vergebenden geklemmt — niemand
        # kann ein Recht weitergeben, das er selbst nicht hat.
        granter = self._effective_perms_of(granter_id)
        if req.permissions is None:
            permissions = normalize_permissions(
                default_permissions_for(req.role), req.role, granter=granter
            )
        else:
            permissions = normalize_permissions(
                req.permissions, req.role, granter=granter
            )

        user_id = self._create_auth_user(
            email=req.email,
            password=req.password,
            tenant_id=tenant_id,
            role=req.role,
        )
        try:
            self._create_user_row(
                user_id=user_id,
                tenant_id=tenant_id,
                role=req.role,
                email=req.email,
                full_name=req.full_name,
                permissions=permissions,
            )
        except Exception:
            self._rollback_user(user_id)
            raise
        log.info(
            "user_invited", tenant_id=tenant_id, role=req.role.value, email=req.email
        )
        return InviteResponse(
            user_id=user_id,
            email=req.email,
            role=req.role,
            tenant_id=tenant_id,
            permissions=permissions,
        )

    def login(self, req: LoginRequest) -> LoginResponse:
        """Erster Login-Schritt: E-Mail + Passwort.

        Hat der Nutzer 2FA aktiv, wird KEINE Session ausgegeben (fail-closed),
        sondern nur ein kurzlebiges Pending-Token (mfa_required=True). Die echte
        Session entsteht erst nach erfolgreichem TOTP-Schritt (login_totp).
        """
        session = self._sign_in(req.email, req.password)
        if self._totp_enabled(session.user.id):
            return LoginResponse(
                mfa_required=True,
                mfa_token=self._issue_mfa_token(session.user.id),
            )
        return LoginResponse(session=self._to_session(session))

    def login_totp(self, req: TotpLoginRequest) -> LoginResponse:
        """Zweiter Login-Schritt: Pending-Token + TOTP-/Recovery-Code einlösen.

        Der Pending-Token beweist, dass der Passwort-Schritt gerade bestanden
        wurde (an genau diesen user_id gebunden, 5 Min gültig). Erst nach
        erfolgreicher Code-Prüfung wird eine frische Session ausgestellt.
        """
        user_id = self._verify_mfa_token(req.mfa_token)
        mfa = self._mfa_row(user_id)
        if not mfa or not mfa.get("totp_enabled"):
            # Kein aktives 2FA → der Pending-Token ist gegenstandslos.
            raise AuthError("2FA ist für dieses Konto nicht aktiv.", status_code=400)

        code = req.code.strip().replace(" ", "")
        valid = pyotp.TOTP(mfa["totp_secret"]).verify(code, valid_window=1)
        if not valid:
            # Recovery-Code (einmalig): Treffer → verbrauchen (Gegenzustand).
            valid = self._consume_recovery_code(user_id, mfa, code)
        if not valid:
            raise AuthError("Code ist ungültig.", status_code=401)

        # Frische Session per Admin-Generate — kein zweiter Passwort-Roundtrip.
        session = self._session_for_verified_user(user_id)
        log.info("login_totp_ok", user_id=user_id)
        return LoginResponse(session=session)

    # --- Login-Bausteine ---------------------------------------------------

    def _sign_in(self, email: str, password: SecretStr) -> AuthResponse:
        try:
            res = self._anon.auth.sign_in_with_password(
                {"email": email, "password": password.get_secret_value()}
            )
        except Exception as exc:
            log.warning("login_failed", email=mask_email(email), error=str(exc))
            raise AuthError("Login fehlgeschlagen.", status_code=401) from exc
        if res.session is None or res.user is None:
            raise AuthError("Login fehlgeschlagen.", status_code=401)
        return res

    @staticmethod
    def _to_session(res: AuthResponse) -> SessionResponse:
        return SessionResponse(
            access_token=res.session.access_token,
            refresh_token=res.session.refresh_token,
            expires_in=res.session.expires_in,
        )

    def _totp_enabled(self, user_id: str) -> bool:
        row = self._mfa_row(user_id)
        return bool(row and row.get("totp_enabled"))

    def _mfa_row(self, user_id: str) -> dict | None:
        res = (
            self._service.table("user_mfa")
            .select("totp_secret, totp_enabled, recovery_codes")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def _consume_recovery_code(self, user_id: str, mfa: dict, code: str) -> bool:
        """Recovery-Code prüfen und bei Treffer verbrauchen (Wurzel 1: der
        eingelöste Code darf nicht ein zweites Mal gelten). Hashing MUSS dem
        Enrollment-Pfad entsprechen (account_service._hash_code: strip+upper),
        sonst matcht kein Code — daher dieselbe Funktion, keine zweite Kopie."""
        from .account_service import _hash_code

        hashed = _hash_code(code)
        codes = list(mfa.get("recovery_codes") or [])
        if hashed not in codes:
            return False
        codes.remove(hashed)
        self._service.table("user_mfa").update(
            {"recovery_codes": codes}
        ).eq("user_id", user_id).execute()
        log.info("recovery_code_used", user_id=user_id)
        return True

    def _issue_mfa_token(self, user_id: str) -> str:
        secret = self._jwt_secret()
        now = datetime.now(UTC)
        return jwt.encode(
            {
                "sub": user_id,
                "typ": _MFA_PENDING_TYP,
                "iat": now,
                "exp": now + timedelta(seconds=_MFA_PENDING_TTL_SECONDS),
            },
            secret,
            algorithm="HS256",
        )

    def _verify_mfa_token(self, token: str) -> str:
        secret = self._jwt_secret()
        try:
            claims = jwt.decode(token, secret, algorithms=["HS256"])
        except jwt.PyJWTError as exc:
            raise AuthError(
                "2FA-Sitzung abgelaufen. Bitte erneut anmelden.", status_code=401
            ) from exc
        if claims.get("typ") != _MFA_PENDING_TYP:
            raise AuthError("Ungültiges 2FA-Token.", status_code=401)
        sub = claims.get("sub")
        if not isinstance(sub, str) or not sub:
            raise AuthError("Ungültiges 2FA-Token.", status_code=401)
        return sub

    @staticmethod
    def _jwt_secret() -> str:
        secret = get_settings().supabase_jwt_secret.get_secret_value()
        if not secret:
            raise AuthError("JWT-Secret nicht konfiguriert.", status_code=500)
        return secret

    def _session_for_verified_user(self, user_id: str) -> SessionResponse:
        """Session für einen bereits (per TOTP) verifizierten User ausstellen.

        GoTrue kennt keinen 'session for user_id'-Aufruf; wir nutzen den
        Admin-Endpoint, der ein Refresh-Token generiert, und tauschen es sofort
        gegen eine Access/Refresh-Session (anon-Client)."""
        try:
            auth_user = self._service.auth.admin.get_user_by_id(user_id)
            email = getattr(auth_user.user, "email", None)
        except Exception as exc:  # noqa: BLE001 — in AuthError übersetzen
            log.warning("mfa_session_user_lookup_failed", user_id=user_id, error=str(exc))
            raise AuthError("Login fehlgeschlagen.", status_code=401) from exc
        if not email:
            raise AuthError("Login fehlgeschlagen.", status_code=401)
        try:
            link = self._service.auth.admin.generate_link(
                {"type": "magiclink", "email": email}
            )
            props = getattr(link, "properties", None)
            token_hash = getattr(props, "hashed_token", None)
            verified = self._anon.auth.verify_otp(
                {"token_hash": token_hash, "type": "magiclink"}
            )
        except Exception as exc:  # noqa: BLE001 — in AuthError übersetzen
            log.warning("mfa_session_issue_failed", user_id=user_id, error=str(exc))
            raise AuthError("Login fehlgeschlagen.", status_code=401) from exc
        if verified.session is None:
            raise AuthError("Login fehlgeschlagen.", status_code=401)
        return SessionResponse(
            access_token=verified.session.access_token,
            refresh_token=verified.session.refresh_token,
            expires_in=verified.session.expires_in,
        )

    def refresh(self, req: RefreshRequest) -> SessionResponse:
        """Tauscht ein Refresh-Token gegen eine frische Session (GoTrue
        grant_type=refresh_token über den anon-Client).

        Fail-closed (Wurzel 5): ein ungültiges/abgelaufenes/widerrufenes Token
        ist ein 401 — spezifisch die GoTrue-AuthError fangen, kein breites
        `except Exception`, das Programmierfehler verschluckt. Der Token-Wert
        wird NICHT geloggt (nur der Fehlertext)."""
        try:
            res = self._anon.auth.refresh_session(
                req.refresh_token.get_secret_value()
            )
        except GoTrueAuthError as exc:
            log.warning("refresh_failed", error=str(exc))
            raise AuthError(
                "Sitzung abgelaufen.", status_code=401
            ) from exc

        session = res.session
        if session is None:
            raise AuthError("Sitzung abgelaufen.", status_code=401)
        return SessionResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            expires_in=session.expires_in,
        )

    def me(self, ctx: AuthContext) -> MeResponse:
        # Rolle + Berechtigungen aus der DB (Quelle der Wahrheit) lesen — das
        # JWT-app_metadata kann veraltet sein.
        row = (
            self._service.table("users")
            .select("role, permissions, email")
            .eq("id", ctx.user_id)
            .limit(1)
            .execute()
        )
        data = row.data[0] if row.data else {}
        role_raw = data.get("role") or ctx.role
        role = UserRole(role_raw) if role_raw in UserRole.__members__ else None
        perms = effective_permissions(role, data.get("permissions"))
        # Effektive Fähigkeiten = Rollen-Capabilities OHNE PM-Bereich, falls das
        # PM-Dach fehlt (dieselbe Brücke wie im Guard). So blendet die Sidebar
        # Kontrollzentrum/Buchungen/Aufgaben automatisch aus, wenn der PM-Zugriff
        # im Rechte-Dialog entzogen wurde.
        pm = Permission.ACCESS_PM_FEATURES in perms
        caps = effective_capabilities(role, has_pm_access=pm)
        tenant_meta = self._tenant_meta(ctx.tenant_id)
        return MeResponse(
            user_id=ctx.user_id,
            email=data.get("email"),
            tenant_id=ctx.tenant_id,
            role=role,
            capabilities=sorted(c.value for c in caps),
            permissions=sorted(p.value for p in perms),
            accommodation_type=tenant_meta.get("accommodation_type"),
            account_type=tenant_meta.get("account_type"),
        )

    def _tenant_meta(self, tenant_id: str | None) -> dict:
        # Mandanten-Metadaten in EINEM Abruf (0090 accommodation_type + 0180
        # account_type) — steuert Navigation und Betriebsmodell/Billing.
        if not tenant_id:
            return {}
        row = (
            self._service.table("tenants")
            .select("accommodation_type, account_type")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
        return row.data[0] if row.data else {}

    def _accommodation_type(self, tenant_id: str | None) -> str | None:
        # Beherbergungsart des Mandanten (0090) — steuert die Navigation.
        return self._tenant_meta(tenant_id).get("accommodation_type")

    def set_accommodation_type(self, ctx: AuthContext, value: str) -> MeResponse:
        # Berechtigung (MANAGE_TENANT) prüft der Router-Guard; hier nur der
        # EIGENE Mandant (Service-Role umgeht RLS → expliziter Tenant-Scope).
        if not ctx.tenant_id:
            raise AuthError("Kein Mandant im Token.", status_code=400)
        res = (
            self._service.table("tenants")
            .update({"accommodation_type": value})
            .eq("id", ctx.tenant_id)
            .execute()
        )
        if not res.data:
            raise AuthError("Mandant nicht gefunden.", status_code=404)
        return self.me(ctx)

    # --- interne Schritte (alle über Service-Role) ---

    def _create_tenant(self, req: RegisterRequest) -> str:
        res = (
            self._service.table("tenants")
            .insert(
                {
                    "name": req.tenant_name,
                    "country": req.country,
                    "currency": req.currency,
                    "business_type": req.business_type,
                    # Betriebsmodell (0180): 'pms' (Abo) oder 'marketplace' (8%-Fee).
                    "account_type": req.account_type,
                }
            )
            .execute()
        )
        if not res.data:
            raise AuthError("Tenant konnte nicht angelegt werden.", status_code=500)
        return res.data[0]["id"]

    def _create_auth_user(
        self,
        *,
        email: str,
        password: SecretStr,
        tenant_id: str,
        role: UserRole,
    ) -> str:
        """Supabase-Auth-User mit tenant_id + role im app_metadata anlegen."""
        try:
            res = self._service.auth.admin.create_user(
                {
                    "email": email,
                    "password": password.get_secret_value(),
                    "email_confirm": True,
                    "app_metadata": {
                        "tenant_id": tenant_id,
                        "role": role.value,
                    },
                }
            )
        except Exception as exc:
            log.warning("create_user_failed", email=mask_email(email), error=str(exc))
            raise AuthError(
                "Benutzer konnte nicht angelegt werden (E-Mail evtl. vergeben).",
                status_code=409,
            ) from exc
        if res.user is None:
            raise AuthError("Benutzer konnte nicht angelegt werden.", status_code=500)
        return res.user.id

    def _create_user_row(
        self,
        *,
        user_id: str,
        tenant_id: str,
        role: UserRole,
        email: str,
        full_name: str,
        permissions: list[str] | None = None,
    ) -> None:
        self._service.table("users").insert(
            {
                "id": user_id,
                "tenant_id": tenant_id,
                "role": role.value,
                "email": email,
                "full_name": full_name,
                "permissions": permissions or [],
            }
        ).execute()

    def _rollback_tenant(self, tenant_id: str) -> None:
        try:
            self._service.table("tenants").delete().eq("id", tenant_id).execute()
        # Best-Effort-Rollback: jeder SDK-Fehler wird geloggt, nie verschluckt.
        except Exception as exc:  # noqa: BLE001  pylint: disable=broad-exception-caught
            log.error("rollback_tenant_failed", tenant_id=tenant_id, error=str(exc))

    def _rollback_user(self, user_id: str) -> None:
        try:
            self._service.auth.admin.delete_user(user_id)
        # Best-Effort-Rollback: jeder SDK-Fehler wird geloggt, nie verschluckt.
        except Exception as exc:  # noqa: BLE001  pylint: disable=broad-exception-caught
            log.error("rollback_user_failed", user_id=user_id, error=str(exc))
