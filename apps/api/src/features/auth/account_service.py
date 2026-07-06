"""Konto- & 2FA-Service (Sicherheit-Seite).

Verwaltet E-Mail/Name/Passwort eines eingeloggten Nutzers und die TOTP-2FA
(Authenticator-App, eigenes Backend via pyotp — KEIN externer SMS-Dienst).

Quelle der Wahrheit ist FastAPI: Nutzer aus reinem OAuth-Login (z. B. Google),
die noch keine public.users-Row haben, werden hier lazy provisioniert
(Tenant + users-Row), bevor Konto-Operationen laufen.
"""
import base64
import hashlib
import secrets
from io import BytesIO

import pyotp
import qrcode
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .lodgify_permissions import effective_permissions
from .schemas import (
    AccountResponse,
    TenantUser,
    TotpDisableRequest,
    TotpEnrollResponse,
    TotpVerifyResponse,
    UpdateEmailRequest,
    UpdateNameRequest,
    UpdatePasswordRequest,
    UpdateProfileRequest,
    UserRole,
)
from .service import AuthError

log = get_logger("nextdays.auth.account")

TOTP_ISSUER = "NextDays"
RECOVERY_CODE_COUNT = 8


class AccountService:
    slice_name = "auth.account"

    def __init__(self, anon_client: Client, service_client: Client) -> None:
        # service: Admin-/Service-Role (Auth-Admin-API, RLS-umgehende Tabellen-Calls)
        # anon: User-Calls (z. B. Passwort gegen Login prüfen)
        self._anon = anon_client
        self._service = service_client

    # --- Konto-Übersicht ---------------------------------------------------

    def get_account(self, ctx: AuthContext) -> AccountResponse:
        row = self._ensure_user_row(ctx)
        mfa = self._get_mfa(ctx.user_id)
        auth_user = self._get_auth_user(ctx.user_id)
        has_password = self._has_password(auth_user)
        return AccountResponse(
            user_id=ctx.user_id,
            email=row.get("email") or self._auth_email(auth_user),
            full_name=row.get("full_name"),
            has_password=has_password,
            totp_enabled=bool(mfa and mfa.get("totp_enabled")),
            role=row.get("role"),
            phone=row.get("phone"),
            additional_phone=row.get("additional_phone"),
            hide_phones=bool(row.get("hide_phones")),
            preferred_language=row.get("preferred_language"),
            spoken_languages=row.get("spoken_languages") or [],
            website=row.get("website"),
            description=row.get("description"),
            avatar_url=row.get("avatar_url"),
            permissions=self._effective_perm_ids(row),
        )

    def role_and_permissions(
        self, ctx: AuthContext
    ) -> tuple[UserRole | None, list]:
        """Rolle + gespeicherte Berechtigungs-IDs eines Nutzers (für Guards)."""
        res = (
            self._service.table("users")
            .select("role, permissions")
            .eq("id", ctx.user_id)
            .limit(1)
            .execute()
        )
        data = res.data[0] if res.data else {}
        role_raw = data.get("role") or ctx.role
        try:
            role = UserRole(role_raw) if role_raw else None
        except ValueError:
            role = None
        stored = data.get("permissions")
        return role, stored if isinstance(stored, list) else []

    @staticmethod
    def _effective_perm_ids(row: dict) -> list[str]:
        """Effektive Berechtigungs-IDs einer users-Row (Admin = alle)."""
        try:
            role = UserRole(row.get("role")) if row.get("role") else None
        except ValueError:
            role = None
        perms = effective_permissions(role, row.get("permissions"))
        return sorted(p.value for p in perms)

    # --- E-Mail / Name / Passwort -----------------------------------------

    def update_email(self, ctx: AuthContext, req: UpdateEmailRequest) -> AccountResponse:
        self._ensure_user_row(ctx)
        try:
            self._service.auth.admin.update_user_by_id(
                ctx.user_id, {"email": req.new_email, "email_confirm": True}
            )
        except Exception as exc:
            log.warning("update_email_failed", user_id=ctx.user_id, error=str(exc))
            raise AuthError(
                "E-Mail konnte nicht geändert werden (evtl. bereits vergeben).",
                status_code=409,
            ) from exc
        self._service.table("users").update({"email": req.new_email}).eq(
            "id", ctx.user_id
        ).execute()
        log.info("email_updated", user_id=ctx.user_id)
        return self.get_account(ctx)

    def update_name(self, ctx: AuthContext, req: UpdateNameRequest) -> AccountResponse:
        self._ensure_user_row(ctx)
        self._service.table("users").update({"full_name": req.full_name}).eq(
            "id", ctx.user_id
        ).execute()
        log.info("name_updated", user_id=ctx.user_id)
        return self.get_account(ctx)

    def list_tenant_users(self, ctx: AuthContext) -> list[TenantUser]:
        """Alle Nutzer des eigenen Tenants (für die Objekt-Kontakt-Auswahl).

        Eigentümer/Mitarbeiter, die als Hauptkontakt eines Objekts gewählt
        werden können. Reihenfolge: der Account-Inhaber (owner/admin) zuerst.
        """
        row = self._ensure_user_row(ctx)
        tenant_id = row.get("tenant_id") or ctx.tenant_id
        if not tenant_id:
            return []
        res = (
            self._service.table("users")
            .select("id, email, full_name, role, phone, avatar_url, tenant_id, permissions")
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        )
        users = [self._to_tenant_user(u) for u in (res.data or [])]
        # Account-Inhaber (admin/owner/co_admin) nach vorne sortieren.
        rank = {UserRole.admin: 0, UserRole.owner: 1, UserRole.co_admin: 2}
        users.sort(key=lambda u: rank.get(u.role, 9))
        return users

    def _to_tenant_user(self, u: dict) -> TenantUser:
        return TenantUser(
            user_id=u["id"],
            email=u.get("email"),
            full_name=u.get("full_name"),
            role=u.get("role"),
            phone=u.get("phone"),
            avatar_url=u.get("avatar_url"),
            tenant_id=u.get("tenant_id"),
            permissions=self._effective_perm_ids(u),
        )

    # Rollen, die die Nutzerverwaltung (Konto → Benutzer) sehen dürfen.
    _USER_MGMT_ROLES = frozenset(
        {UserRole.admin, UserRole.owner, UserRole.co_admin}
    )

    def list_managed_users(self, ctx: AuthContext) -> list[TenantUser]:
        """Nutzerliste für die Verwaltung (Konto → Benutzer).

        Admins sehen ALLE Nutzer plattformweit (über alle Tenants), Owner/Co-Admin
        nur ihren eigenen Tenant. Normale Benutzer (staff/cleaner) haben keinen
        Zugriff (403).
        """
        row = self._ensure_user_row(ctx)
        role_raw = row.get("role") or ctx.role
        try:
            role = UserRole(role_raw) if role_raw else None
        except ValueError:
            role = None
        if role not in self._USER_MGMT_ROLES:
            raise AuthError("Keine Berechtigung für die Nutzerverwaltung.", status_code=403)

        query = (
            self._service.table("users")
            .select("id, email, full_name, role, phone, avatar_url, tenant_id, permissions")
            .order("created_at")
        )
        # Nicht-Admins sehen nur den eigenen Tenant.
        if role is not UserRole.admin:
            tenant_id = row.get("tenant_id") or ctx.tenant_id
            if not tenant_id:
                return []
            query = query.eq("tenant_id", tenant_id)

        res = query.execute()
        users = [self._to_tenant_user(u) for u in (res.data or [])]
        rank = {UserRole.admin: 0, UserRole.owner: 1, UserRole.co_admin: 2}
        users.sort(key=lambda u: rank.get(u.role, 9))
        return users

    AVATAR_BUCKET = "avatars"
    AVATAR_MAX_BYTES = 5 * 1024 * 1024
    AVATAR_MIME = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
    }

    def upload_avatar(
        self, ctx: AuthContext, content: bytes, content_type: str
    ) -> AccountResponse:
        """Profilbild in den avatars-Bucket legen und URL im Profil speichern.

        Läuft über den Service-Client (FastAPI ist Quelle der Wahrheit), damit
        es für BEIDE Login-Wege funktioniert — auch reine FastAPI-Cookie-Logins
        ohne Supabase-Browser-Session.
        """
        self._ensure_user_row(ctx)
        ext = self.AVATAR_MIME.get(content_type)
        if not ext:
            raise AuthError("Nur PNG/JPEG/WebP/GIF erlaubt.", status_code=415)
        if len(content) > self.AVATAR_MAX_BYTES:
            raise AuthError("Bild ist zu groß (max. 5 MB).", status_code=413)

        path = f"{ctx.user_id}/avatar.{ext}"
        storage = self._service.storage.from_(self.AVATAR_BUCKET)
        try:
            storage.upload(
                path,
                content,
                {"content-type": content_type, "upsert": "true"},
            )
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich melden
            log.warning("avatar_upload_failed", user_id=ctx.user_id, error=str(exc))
            raise AuthError("Upload fehlgeschlagen.", status_code=502) from exc

        public_url = storage.get_public_url(path)
        # Cache-Buster, damit Clients das neue Bild trotz gleicher URL laden.
        versioned = f"{public_url}?v={secrets.token_hex(4)}"
        self._service.table("users").update({"avatar_url": versioned}).eq(
            "id", ctx.user_id
        ).execute()
        log.info("avatar_uploaded", user_id=ctx.user_id)
        return self.get_account(ctx)

    def update_profile(
        self, ctx: AuthContext, req: UpdateProfileRequest
    ) -> AccountResponse:
        """Profil-/Kontaktdaten setzen (Lodgify „Edit contact information").

        Nur gesendete Felder (``exclude_unset``) werden geschrieben — so bleiben
        nicht-bearbeitete Werte erhalten. E-Mail/Passwort laufen weiter über die
        eigenen, abgesicherten Endpunkte.
        """
        self._ensure_user_row(ctx)
        patch = req.model_dump(exclude_unset=True)
        if patch:
            self._service.table("users").update(patch).eq("id", ctx.user_id).execute()
        log.info("profile_updated", user_id=ctx.user_id, fields=sorted(patch.keys()))
        return self.get_account(ctx)

    def update_password(
        self, ctx: AuthContext, req: UpdatePasswordRequest
    ) -> AccountResponse:
        self._ensure_user_row(ctx)
        auth_user = self._get_auth_user(ctx.user_id)
        email = self._auth_email(auth_user)

        # Wenn ein Passwort existiert, muss das aktuelle stimmen (Selbstschutz).
        if self._has_password(auth_user):
            if req.current_password is None:
                raise AuthError("Aktuelles Passwort erforderlich.", status_code=400)
            if not email or not self._password_ok(
                email, req.current_password.get_secret_value()
            ):
                raise AuthError("Aktuelles Passwort ist falsch.", status_code=401)

        try:
            self._service.auth.admin.update_user_by_id(
                ctx.user_id, {"password": req.new_password.get_secret_value()}
            )
        except Exception as exc:
            log.warning("update_password_failed", user_id=ctx.user_id, error=str(exc))
            raise AuthError("Passwort konnte nicht geändert werden.", status_code=400) from exc
        log.info("password_updated", user_id=ctx.user_id)
        return self.get_account(ctx)

    # --- TOTP-2FA ----------------------------------------------------------

    def totp_enroll(self, ctx: AuthContext) -> TotpEnrollResponse:
        """Neues TOTP-Secret erzeugen und (unbestätigt) speichern.

        Aktiviert wird erst nach erfolgreicher Code-Verifikation (totp_verify).
        """
        self._ensure_user_row(ctx)
        existing = self._get_mfa(ctx.user_id)
        if existing and existing.get("totp_enabled"):
            raise AuthError("2FA ist bereits aktiv.", status_code=409)

        secret = pyotp.random_base32()
        account = self.get_account(ctx)
        label = account.email or ctx.user_id
        otpauth_uri = pyotp.TOTP(secret).provisioning_uri(
            name=label, issuer_name=TOTP_ISSUER
        )

        # Secret unbestätigt ablegen (totp_enabled bleibt false bis verify).
        self._service.table("user_mfa").upsert(
            {
                "user_id": ctx.user_id,
                "totp_secret": secret,
                "totp_enabled": False,
                "recovery_codes": [],
            }
        ).execute()

        return TotpEnrollResponse(
            secret=secret,
            otpauth_uri=otpauth_uri,
            qr_data_url=_qr_data_url(otpauth_uri),
        )

    def totp_verify(self, ctx: AuthContext, code: str) -> TotpVerifyResponse:
        """Enrollment bestätigen: Code prüfen, 2FA aktivieren, Recovery-Codes geben."""
        mfa = self._get_mfa(ctx.user_id)
        if not mfa:
            raise AuthError("Kein 2FA-Enrollment vorhanden.", status_code=400)
        if not pyotp.TOTP(mfa["totp_secret"]).verify(code, valid_window=1):
            raise AuthError("Code ist ungültig.", status_code=401)

        plain_codes = [_recovery_code() for _ in range(RECOVERY_CODE_COUNT)]
        hashed = [_hash_code(c) for c in plain_codes]
        self._service.table("user_mfa").update(
            {"totp_enabled": True, "recovery_codes": hashed}
        ).eq("user_id", ctx.user_id).execute()
        log.info("totp_enabled", user_id=ctx.user_id)
        return TotpVerifyResponse(totp_enabled=True, recovery_codes=plain_codes)

    def totp_disable(self, ctx: AuthContext, req: TotpDisableRequest) -> AccountResponse:
        """2FA deaktivieren — erfordert gültigen aktuellen Code (oder Recovery)."""
        mfa = self._get_mfa(ctx.user_id)
        if not mfa or not mfa.get("totp_enabled"):
            raise AuthError("2FA ist nicht aktiv.", status_code=400)

        valid = pyotp.TOTP(mfa["totp_secret"]).verify(req.code, valid_window=1)
        if not valid:
            valid = _hash_code(req.code) in (mfa.get("recovery_codes") or [])
        if not valid:
            raise AuthError("Code ist ungültig.", status_code=401)

        self._service.table("user_mfa").delete().eq("user_id", ctx.user_id).execute()
        log.info("totp_disabled", user_id=ctx.user_id)
        return self.get_account(ctx)

    # --- interne Helfer ----------------------------------------------------

    def _ensure_user_row(self, ctx: AuthContext) -> dict:
        """public.users-Row sicherstellen (lazy Provisioning für OAuth-Konten).

        Reine OAuth-Logins (Google) haben evtl. noch keinen Tenant/keine Row.
        Wir legen dann minimal einen Eigen-Tenant + Owner-Row an, damit FastAPI
        die alleinige Quelle der Wahrheit bleibt.
        """
        res = (
            self._service.table("users").select("*").eq("id", ctx.user_id).execute()
        )
        if res.data:
            return res.data[0]

        auth_user = self._get_auth_user(ctx.user_id)
        email = self._auth_email(auth_user) or ""
        full_name = self._auth_name(auth_user) or (email.split("@")[0] if email else "Nutzer")

        tenant_id = ctx.tenant_id
        if not tenant_id:
            # Wurzel 4: KEIN erfundenes DE/EUR. Beim reinen OAuth-Login (noch kein
            # Onboarding) ist dies nur ein Platzhalter-Tenant; Land und Währung
            # gehören verbindlich zum Objekt (Property/Hotel) und werden dort beim
            # Anlegen zur Pflicht. country/currency sind NOT NULL → leer anlegen;
            # die Finanzpfade sind fail-closed und verweigern bis dahin jeden
            # Geldvorgang, statt einen falschen Euro/ein falsches Land vorzutäuschen.
            tenant = (
                self._service.table("tenants")
                .insert({"name": full_name, "country": "", "currency": ""})
                .execute()
            )
            if not tenant.data:
                raise AuthError("Konto konnte nicht initialisiert werden.", status_code=500)
            tenant_id = tenant.data[0]["id"]
            # tenant_id/role auch ins JWT-app_metadata spiegeln (RLS-Quelle).
            self._service.auth.admin.update_user_by_id(
                ctx.user_id,
                {"app_metadata": {"tenant_id": tenant_id, "role": UserRole.owner.value}},
            )

        row = {
            "id": ctx.user_id,
            "tenant_id": tenant_id,
            "role": (ctx.role or UserRole.owner.value),
            "email": email,
            "full_name": full_name,
        }
        self._service.table("users").insert(row).execute()
        log.info("user_provisioned", user_id=ctx.user_id, tenant_id=tenant_id)
        return row

    def _get_mfa(self, user_id: str) -> dict | None:
        res = self._service.table("user_mfa").select("*").eq("user_id", user_id).execute()
        return res.data[0] if res.data else None

    def _get_auth_user(self, user_id: str) -> object | None:
        try:
            res = self._service.auth.admin.get_user_by_id(user_id)
            return res.user
        # SDK-Fehler werden geloggt; Aufrufer behandeln None konservativ.
        except Exception as exc:  # noqa: BLE001  pylint: disable=broad-exception-caught
            log.warning("get_auth_user_failed", user_id=user_id, error=str(exc))
            return None

    @staticmethod
    def _auth_email(auth_user: object | None) -> str | None:
        return getattr(auth_user, "email", None) if auth_user else None

    @staticmethod
    def _auth_name(auth_user: object | None) -> str | None:
        meta = getattr(auth_user, "user_metadata", None) if auth_user else None
        if isinstance(meta, dict):
            return meta.get("full_name") or meta.get("name")
        return None

    @staticmethod
    def _has_password(auth_user: object | None) -> bool:
        """Heuristik: hat das Konto Identitäten außer reinem OAuth?"""
        identities = getattr(auth_user, "identities", None) if auth_user else None
        if not identities:
            return True  # konservativ: Passwortprüfung verlangen
        providers = {getattr(i, "provider", None) for i in identities}
        return "email" in providers

    def _password_ok(self, email: str, password: str) -> bool:
        try:
            res = self._anon.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
            return res.session is not None
        # Falsche Zugangsdaten/SDK-Fehler bedeuten schlicht: Passwort nicht ok.
        except Exception:  # noqa: BLE001  pylint: disable=broad-exception-caught
            return False


def _qr_data_url(otpauth_uri: str) -> str:
    img = qrcode.make(otpauth_uri)
    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _recovery_code() -> str:
    # 10 Zeichen, gut lesbar (kein 0/O/1/I).
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(10))


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.strip().upper().encode()).hexdigest()
