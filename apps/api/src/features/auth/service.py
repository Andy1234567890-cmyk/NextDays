"""Service-Schicht für auth.

Registrierung legt atomar Tenant + Owner-User an und schreibt tenant_id/role
ins JWT app_metadata (Quelle der Wahrheit für RLS). Bricht ein Schritt ab,
werden bereits angelegte Artefakte zurückgerollt — kein verwaister Tenant,
kein stilles Schlucken von Fehlern (PROJECT.md).
"""
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import (
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
        tenant_id = self._create_tenant(req)
        try:
            user_id = self._create_owner_user(req, tenant_id)
        except Exception:
            self._rollback_tenant(tenant_id)
            raise
        try:
            self._create_user_row(req, tenant_id, user_id)
        except Exception:
            self._rollback_user(user_id)
            self._rollback_tenant(tenant_id)
            raise
        return self.login(LoginRequest(email=req.email, password=req.password))

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
        role = UserRole(ctx.role) if ctx.role in UserRole.__members__ else None
        return MeResponse(
            user_id=ctx.user_id,
            tenant_id=ctx.tenant_id,
            role=role,
        )

    # --- interne Schritte (alle über Service-Role) ---

    def _create_tenant(self, req: RegisterRequest) -> str:
        res = (
            self._service.table("tenants")
            .insert(
                {
                    "name": req.tenant_name,
                    "country": req.country,
                    "currency": req.currency,
                }
            )
            .execute()
        )
        if not res.data:
            raise AuthError("Tenant konnte nicht angelegt werden.", status_code=500)
        return res.data[0]["id"]

    def _create_owner_user(self, req: RegisterRequest, tenant_id: str) -> str:
        try:
            res = self._service.auth.admin.create_user(
                {
                    "email": req.email,
                    "password": req.password.get_secret_value(),
                    "email_confirm": True,
                    "app_metadata": {
                        "tenant_id": tenant_id,
                        "role": UserRole.owner.value,
                    },
                }
            )
        except Exception as exc:
            log.warning("create_user_failed", email=req.email, error=str(exc))
            raise AuthError(
                "Benutzer konnte nicht angelegt werden (E-Mail evtl. vergeben).",
                status_code=409,
            ) from exc
        if res.user is None:
            raise AuthError("Benutzer konnte nicht angelegt werden.", status_code=500)
        return res.user.id

    def _create_user_row(
        self, req: RegisterRequest, tenant_id: str, user_id: str
    ) -> None:
        self._service.table("users").insert(
            {
                "id": user_id,
                "tenant_id": tenant_id,
                "role": UserRole.owner.value,
                "email": req.email,
                "full_name": req.full_name,
            }
        ).execute()

    def _rollback_tenant(self, tenant_id: str) -> None:
        try:
            self._service.table("tenants").delete().eq("id", tenant_id).execute()
        except Exception as exc:
            log.error("rollback_tenant_failed", tenant_id=tenant_id, error=str(exc))

    def _rollback_user(self, user_id: str) -> None:
        try:
            self._service.auth.admin.delete_user(user_id)
        except Exception as exc:
            log.error("rollback_user_failed", user_id=user_id, error=str(exc))
