"""Service-Schicht für auth.

Registrierung legt atomar Tenant + Owner-User an und schreibt tenant_id/role
ins JWT app_metadata (Quelle der Wahrheit für RLS). Bricht ein Schritt ab,
werden bereits angelegte Artefakte zurückgerollt — kein verwaister Tenant,
kein stilles Schlucken von Fehlern (PROJECT.md).
"""
from pydantic import SecretStr
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .lodgify_permissions import (
    default_permissions_for,
    effective_permissions,
    normalize_permissions,
)
from .permissions import capabilities_for
from .schemas import (
    InviteRequest,
    InviteResponse,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    SessionResponse,
    SliceHealth,
    UserRole,
)

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
        self._ensure_channel_manager_group(tenant_id, title=req.tenant_name)
        return self.login(LoginRequest(email=req.email, password=req.password))

    def _ensure_channel_manager_group(self, tenant_id: str, *, title: str) -> None:
        """Legt die Channel-Manager-Group des Tenants an. Lazy-Import gegen
        Zyklen; jeder Fehler wird verschluckt (rein additiv)."""
        try:
            from src.features.channel_manager.service import ChannelManagerService

            ChannelManagerService(service_client=self._service).ensure_group(
                tenant_id, title=title or "Hotel"
            )
        except Exception as exc:  # noqa: BLE001 — darf Registrierung nie blockieren
            log.warning("channel_manager_group_failed", tenant_id=tenant_id, error=str(exc))

    def invite(self, req: InviteRequest, tenant_id: str) -> InviteResponse:
        """Weiteren Nutzer (Mitarbeiter, Co-Admin, …) in den Tenant einladen.

        Legt Auth-User mit der gewünschten Rolle im BESTEHENDEN Tenant an —
        kein neuer Tenant. Rollback des Auth-Users, falls die users-Row scheitert.
        """
        if req.role is UserRole.admin:
            # Admin entsteht nur bei register (Tenant-Gründung). Einladbar sind
            # co_admin, owner (Hauseigentümer mit Daten-Split), staff, cleaner.
            raise AuthError(
                "Admin kann nicht eingeladen werden; entsteht bei register.",
                status_code=400,
            )
        # Berechtigungen: explizit gewählte (Wizard) oder Rollen-Defaults.
        # Admin wäre hier ohnehin ausgeschlossen (s.o.); normalize filtert
        # unbekannte IDs heraus.
        if req.permissions is None:
            permissions = default_permissions_for(req.role)
        else:
            permissions = normalize_permissions(req.permissions, req.role)

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

    def login(self, req: LoginRequest) -> SessionResponse:
        try:
            res = self._anon.auth.sign_in_with_password(
                {
                    "email": req.email,
                    "password": req.password.get_secret_value(),
                }
            )
        except Exception as exc:
            log.warning("login_failed", email=req.email, error=str(exc))
            raise AuthError("Login fehlgeschlagen.", status_code=401) from exc

        session = res.session
        if session is None:
            raise AuthError("Login fehlgeschlagen.", status_code=401)
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
        return MeResponse(
            user_id=ctx.user_id,
            email=data.get("email"),
            tenant_id=ctx.tenant_id,
            role=role,
            capabilities=sorted(c.value for c in capabilities_for(role)),
            permissions=sorted(p.value for p in perms),
            accommodation_type=self._accommodation_type(ctx.tenant_id),
        )

    def _accommodation_type(self, tenant_id: str | None) -> str | None:
        # Beherbergungsart des Mandanten (0090) — steuert die Navigation.
        if not tenant_id:
            return None
        row = (
            self._service.table("tenants")
            .select("accommodation_type")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
        return row.data[0]["accommodation_type"] if row.data else None

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
            log.warning("create_user_failed", email=email, error=str(exc))
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
