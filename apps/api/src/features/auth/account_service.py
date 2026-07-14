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
        # Eine Identität: der Registrierende IST der Super-Admin — sein Konto
        # zeigt Name/Telefon aus den /konto-Kontaktdaten der Agentur.
        agency = (
            self._agency_person(row.get("tenant_id") or ctx.tenant_id)
            if row.get("role") == UserRole.admin.value
            else None
        ) or {}
        return AccountResponse(
            tenant_country=self._tenant_country(
                row.get("tenant_id") or ctx.tenant_id
            ),
            user_id=ctx.user_id,
            email=row.get("email") or self._auth_email(auth_user),
            full_name=agency.get("full_name") or row.get("full_name"),
            has_password=has_password,
            totp_enabled=bool(mfa and mfa.get("totp_enabled")),
            role=row.get("role"),
            phone=agency.get("phone") or row.get("phone"),
            additional_phone=row.get("additional_phone"),
            hide_phones=bool(row.get("hide_phones")),
            preferred_language=row.get("preferred_language"),
            spoken_languages=row.get("spoken_languages") or [],
            website=agency.get("website") or row.get("website"),
            description=row.get("description"),
            avatar_url=row.get("avatar_url"),
            permissions=self._effective_perm_ids(row),
        )

    def _tenant_country(self, tenant_id: str | None) -> str | None:
        """Land des Unternehmens (ISO-2) — Vorbelegung z. B. der Telefon-
        Ländervorwahl im Frontend. Kein Fallback-Wert (Wurzel 4)."""
        if not tenant_id:
            return None
        res = (
            self._service.table("tenants")
            .select("country")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
        rows = res.data if isinstance(res.data, list) else []
        country = rows[0].get("country") if rows else None
        return country if isinstance(country, str) and country else None

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
            .select("id, email, full_name, role, tenant_id, permissions")
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        )
        users = [self._to_tenant_user(u) for u in (res.data or [])]
        # Account-Inhaber (admin/owner/co_admin) nach vorne sortieren.
        rank = {UserRole.admin: 0, UserRole.owner: 1, UserRole.co_admin: 2}
        users.sort(key=lambda u: rank.get(u.role, 9))
        return users

    def list_property_contacts(
        self, ctx: AuthContext, property_id: str
    ) -> list[TenantUser]:
        """Für ein Objekt als Hauptkontakt wählbare Nutzer (Soll-Modell §4.2/§4.3).

        NICHT pauschal alle Tenant-Nutzer, sondern die dem Objekt zugeordneten/
        berechtigten: admin/co_admin des Tenants (immer verantwortlich) + die dem
        Objekt zugewiesenen Eigentümer-Logins (owner_property_assignments) + die
        dem Objekt freigegebenen Stamm-Mitarbeiter (staff_property_assignments).
        """
        row = self._ensure_user_row(ctx)
        tenant_id = row.get("tenant_id") or ctx.tenant_id
        if not tenant_id:
            return []
        # Objekt muss zum eigenen Tenant gehören (Wurzel 3: Scope erzwingen).
        prop = (
            self._service.table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not prop:
            raise AuthError("Objekt nicht gefunden.", status_code=404)

        # Dem Objekt zugeordnete Nutzer-IDs (Owner-Portal + Stamm-Mitarbeiter).
        assigned_ids: set[str] = set()
        for table in ("owner_property_assignments", "staff_property_assignments"):
            rows = (
                self._service.table(table)
                .select("user_id")
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .execute()
            ).data or []
            assigned_ids.update(r["user_id"] for r in rows)

        res = (
            self._service.table("users")
            .select("id, email, full_name, role, tenant_id, permissions")
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        )
        contacts = [
            u
            for u in (res.data or [])
            # admin/co_admin sind tenant-weit verantwortlich → immer wählbar;
            # alle anderen nur, wenn dem Objekt zugeordnet/freigegeben.
            if u.get("role") in ("admin", "co_admin") or u["id"] in assigned_ids
        ]
        users = [self._to_tenant_user(u) for u in contacts]
        rank = {UserRole.admin: 0, UserRole.owner: 1, UserRole.co_admin: 2}
        users.sort(key=lambda u: rank.get(u.role, 9))
        return self._merge_agency_into_admin(users, tenant_id)

    def _agency_person(self, tenant_id: str | None) -> dict | None:
        """Agentur-/Inhaber-Kontakt aus dem /konto-Profil des Tenants.

        Der Registrierende IST der Super-Admin (eine Identität): sein
        Admin-Login wird in Kontakt-/Nutzerlisten mit Name und Telefon aus
        den /konto-Kontaktdaten angezeigt — nicht als zweite Person."""
        if not tenant_id:
            return None
        res = (
            self._service.table("tenant_billing_profile")
            .select(
                "managing_director_first_name, "
                "managing_director_last_name, phone_number, website"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        rows = res.data if isinstance(res.data, list) else []
        if not rows:
            return None
        p = rows[0]

        def _s(key: str) -> str:
            val = p.get(key)
            return val.strip() if isinstance(val, str) else ""

        name = " ".join(
            x
            for x in (
                _s("managing_director_first_name"),
                _s("managing_director_last_name"),
            )
            if x
        )
        phone = _s("phone_number")
        website = _s("website")
        if not name and not phone and not website:
            return None
        return {
            "full_name": name or None,
            "phone": phone or None,
            "website": website or None,
        }

    def _merge_agency_into_admin(
        self, users: list[TenantUser], tenant_id: str | None
    ) -> list[TenantUser]:
        """Admin-Einträge des EIGENEN Tenants mit den Agentur-Daten aus /konto
        anreichern (Anzeige-Wahrheit, keine Daten-Doppelung)."""
        agency = self._agency_person(tenant_id)
        if not agency:
            return users
        for u in users:
            if u.role is UserRole.admin and u.tenant_id == tenant_id:
                u.full_name = agency["full_name"] or u.full_name
                u.phone = agency["phone"] or u.phone
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
            .select("id, email, full_name, role, tenant_id, permissions")
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
        return self._merge_agency_into_admin(
            users, row.get("tenant_id") or ctx.tenant_id
        )

    # Schreibende Nutzerverwaltung (Bearbeiten/Löschen): nur die Konto-Führung.
    # Eigentümer sehen die Liste (read-only, §4.2), verwalten aber nicht.
    _USER_WRITE_ROLES = frozenset({UserRole.admin, UserRole.co_admin})

    def _require_user_write(self, ctx: AuthContext) -> tuple[dict, str]:
        """Guard für Bearbeiten/Löschen: Rolle prüfen und (eigene Row,
        tenant_id) zurückgeben. Wurzel 3: alles bleibt tenant-gescopt."""
        row = self._ensure_user_row(ctx)
        try:
            role = UserRole(row.get("role") or ctx.role or "")
        except ValueError:
            role = None
        if role not in self._USER_WRITE_ROLES:
            raise AuthError(
                "Keine Berechtigung für die Nutzerverwaltung.", status_code=403
            )
        tenant_id = row.get("tenant_id") or ctx.tenant_id
        if not tenant_id:
            raise AuthError("Kein Unternehmen zugeordnet.", status_code=403)
        return row, tenant_id

    def _own_managed_user(self, tenant_id: str, user_id: str) -> dict:
        """Ziel-Nutzer NUR im eigenen Tenant laden (Load+Scope in einem)."""
        res = (
            self._service.table("users")
            .select("id, email, full_name, role, tenant_id, permissions")
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise AuthError("Nutzer nicht gefunden.", status_code=404)
        return res.data[0]

    def update_managed_user(
        self,
        ctx: AuthContext,
        user_id: str,
        *,
        full_name: str | None = None,
        role: UserRole | None = None,
    ) -> TenantUser:
        """Nutzer im eigenen Tenant bearbeiten (Konto → Benutzer): Name und
        Rolle. Der Konto-Admin (Gründer) ist nicht umstufbar, und niemand kann
        zur Rolle admin befördert werden (entsteht nur bei register — wie beim
        Einladen)."""
        _, tenant_id = self._require_user_write(ctx)
        target = self._own_managed_user(tenant_id, user_id)
        patch: dict = {}
        if full_name is not None and full_name.strip():
            patch["full_name"] = full_name.strip()
        if role is not None and role != target.get("role"):
            if target.get("role") == UserRole.admin.value:
                raise AuthError(
                    "Der Kontoinhaber (Admin) kann nicht umgestuft werden.",
                    status_code=400,
                )
            if role is UserRole.admin:
                raise AuthError(
                    "Die Rolle Admin kann nicht vergeben werden.", status_code=400
                )
            patch["role"] = role.value
        if not patch:
            return self._to_tenant_user(target)
        res = (
            self._service.table("users")
            .update(patch)
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        updated = res.data[0] if res.data else {**target, **patch}
        log.info(
            "managed_user_updated",
            tenant_id=tenant_id, user_id=user_id, fields=sorted(patch),
        )
        return self._to_tenant_user(updated)

    def delete_managed_user(self, ctx: AuthContext, user_id: str) -> None:
        """Nutzer aus dem eigenen Tenant löschen (Konto → Benutzer).

        Nicht löschbar: das eigene Login (Aussperr-Schutz) und der Konto-Admin.
        Entfernt die users-Row (FKs räumen per cascade/set null auf) und den
        Auth-Login. Reihenfolge: erst Auth (verhindert weitere Logins), dann
        Row — schlägt die Row fehl, bleibt der Nutzer sichtbar und der Vorgang
        ist wiederholbar (kein Halbzustand mit funktionierendem Login)."""
        row, tenant_id = self._require_user_write(ctx)
        if user_id == row.get("id"):
            raise AuthError(
                "Das eigene Login kann nicht gelöscht werden.", status_code=400
            )
        target = self._own_managed_user(tenant_id, user_id)
        if target.get("role") == UserRole.admin.value:
            raise AuthError(
                "Der Kontoinhaber (Admin) kann nicht gelöscht werden.",
                status_code=400,
            )
        try:
            self._service.auth.admin.delete_user(user_id)
        except Exception as exc:  # noqa: BLE001 — SDK-Fehler einheitlich melden
            log.warning(
                "managed_user_auth_delete_failed",
                user_id=user_id, error=str(exc)[:200],
            )
            raise AuthError(
                "Login konnte nicht gelöscht werden.", status_code=502
            ) from exc
        self._service.table("users").delete().eq("id", user_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("managed_user_deleted", tenant_id=tenant_id, user_id=user_id)

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
        row = self._ensure_user_row(ctx)
        patch = req.model_dump(exclude_unset=True)
        # Eine Identität, EIN Speicherort: beim Super-Admin gehören Name/
        # Telefon/Website der Agentur (/konto, tenant_billing_profile) — dort
        # zurückschreiben, users trägt nur den Anzeigenamen (keine Doppel-
        # Spalten in users).
        if patch and row.get("role") == UserRole.admin.value:
            tenant_id = row.get("tenant_id") or ctx.tenant_id
            self._mirror_admin_profile(tenant_id, patch)
            patch = {k: v for k, v in patch.items() if k == "full_name"}
        if patch:
            self._service.table("users").update(patch).eq("id", ctx.user_id).execute()
        log.info("profile_updated", user_id=ctx.user_id, fields=sorted(patch.keys()))
        return self.get_account(ctx)

    def _mirror_admin_profile(
        self, tenant_id: str | None, patch: dict
    ) -> None:
        """Agentur-Kontaktdaten des Super-Admins nach /konto
        (tenant_billing_profile) schreiben: Vor-/Nachname aus full_name,
        Telefon, Website. Nur gesendete Felder."""
        if not tenant_id:
            return
        profile_patch: dict = {}
        full_name = (patch.get("full_name") or "").strip()
        if full_name:
            parts = full_name.split()
            profile_patch["managing_director_first_name"] = (
                " ".join(parts[:-1]) if len(parts) > 1 else parts[0]
            )
            profile_patch["managing_director_last_name"] = (
                parts[-1] if len(parts) > 1 else ""
            )
        if "phone" in patch:
            profile_patch["phone_number"] = patch["phone"]
        if "website" in patch:
            profile_patch["website"] = patch["website"]
        if not profile_patch:
            return
        profile_patch["tenant_id"] = tenant_id
        self._service.table("tenant_billing_profile").upsert(
            profile_patch, on_conflict="tenant_id"
        ).execute()

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
