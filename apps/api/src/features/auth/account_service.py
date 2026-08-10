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
from datetime import UTC, datetime
from io import BytesIO

import pyotp
import qrcode
from pydantic import SecretStr
from supabase import Client
from supabase_auth.errors import AuthError as GoTrueAuthError

from src.core.gotrue_fehler import (
    STOERUNG_MELDUNG,
    TRANSPORT_FEHLER,
    stoerung_oder_ablehnung,
)
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import public_storage_url

from .granular_permissions import (
    default_permissions_for,
    effective_permissions,
    normalize_permissions,
)
from .schemas import (
    AccountResponse,
    PhoneDisableRequest,
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

# Personengebundene Profilfelder, die IMMER auf users gehören (nie zur Agentur/
# tenant_billing_profile gespiegelt werden) — auch beim Super-Admin. Airbnb
# „Persönliche Informationen": Vorname, Wohn-/Postadresse, Notfallkontakt.
_PERSONAL_USER_FIELDS = frozenset(
    {
        "preferred_first_name",
        "residential_street",
        "residential_postal_code",
        "residential_city",
        "residential_country",
        "mailing_street",
        "mailing_postal_code",
        "mailing_city",
        "mailing_country",
        "emergency_contact_name",
        "emergency_contact_phone",
        # Sprache/Währung/Zeitzone sind ANZEIGE-Einstellungen der Person, nicht
        # Stammdaten des Betriebs: zwei Admins desselben Tenants dürfen die
        # Oberfläche in verschiedenen Sprachen sehen. Ohne diese drei Einträge
        # filtert `update_profile` sie beim Admin heraus — dann speichert die
        # Auswahl still ins Leere.
        "preferred_language",
        "preferred_currency",
        "preferred_timezone",
        # Seit 0356 gibt es diese Spalten wirklich (vorher standen sie nur im
        # Contract). Sie gehören der PERSON, nicht dem Betrieb: die zweite
        # Telefonnummer, ob die Nummern öffentlich stehen, welche Sprachen sie
        # spricht, ihr Profilbild und ihre Selbstbeschreibung. Nur `phone` und
        # `website` bleiben beim Admin die Agenturdaten aus /konto und werden
        # dorthin gespiegelt. Ohne diese Einträge würden sie beim Admin
        # herausgefiltert und die Eingabe verschwände lautlos.
        "additional_phone",
        "hide_phones",
        "spoken_languages",
        "description",
        "avatar_url",
        "notes",
    }
)

# Spalten, die die Nutzerverwaltung (Liste + Detailseite) von `users` liest.
# EINE Stelle, damit Liste und Detail nie auseinanderlaufen — ein Feld, das nur
# die Liste lädt, wäre auf der Detailseite still leer (Wurzel 9 in der Anzeige).
_MANAGED_USER_COLUMNS = (
    "id, email, full_name, role, tenant_id, permissions, preferred_language, "
    "phone, additional_phone, hide_phones, spoken_languages, notes, "
    "avatar_url, deactivated_at, created_at"
)

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
        row = self._email_nachziehen(ctx.user_id, row, auth_user)
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
            preferred_currency=row.get("preferred_currency"),
            preferred_timezone=row.get("preferred_timezone"),
            spoken_languages=row.get("spoken_languages") or [],
            website=agency.get("website") or row.get("website"),
            description=row.get("description"),
            avatar_url=row.get("avatar_url"),
            permissions=self._effective_perm_ids(row),
            # Personengebundene Gastgeber-Felder (immer aus users, nie Agentur).
            preferred_first_name=row.get("preferred_first_name"),
            residential_street=row.get("residential_street"),
            residential_postal_code=row.get("residential_postal_code"),
            residential_city=row.get("residential_city"),
            residential_country=row.get("residential_country"),
            mailing_street=row.get("mailing_street"),
            mailing_postal_code=row.get("mailing_postal_code"),
            mailing_city=row.get("mailing_city"),
            mailing_country=row.get("mailing_country"),
            emergency_contact_name=row.get("emergency_contact_name"),
            emergency_contact_phone=row.get("emergency_contact_phone"),
            # Identitätsprüfung: echter Status aus der DB (Default unverified).
            identity_status=row.get("identity_status") or "unverified",
            identity_verified_at=row.get("identity_verified_at"),
            phone_verified_at=row.get("phone_verified_at"),
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
    def _role_of(row: dict) -> UserRole | None:
        try:
            return UserRole(row.get("role")) if row.get("role") else None
        except ValueError:
            return None

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
        """E-Mail wechseln — mit Re-Auth und Doppel-Opt-in (Wurzel 7).

        Vorher konnte jeder mit einem gültigen Access-Token die Adresse ohne
        jeden Nachweis auf eine fremde umstellen (`email_confirm=True` bestätigte
        sie zusätzlich sofort). Ein anschließender Passwort-Reset auf die neue
        Adresse übernimmt damit das Konto, bei einem `admin` den ganzen Tenant.
        Der Passwortwechsel direkt darunter macht es seit jeher richtig — hier
        fehlte dieselbe Prüfung.

        `email_confirm` wird bewusst NICHT gesetzt: GoTrue verschickt dann die
        Bestätigungsmail an die NEUE Adresse und schaltet erst nach dem Klick um.
        Bis dahin bleibt die alte Adresse gültig — wer sich vertippt oder ein
        fremdes Postfach angibt, sperrt sich nicht aus.
        """
        self._ensure_user_row(ctx)
        auth_user = self._get_auth_user(ctx.user_id)
        # Wie in update_password: nur erzwingen, wenn überhaupt ein Passwort
        # existiert (OAuth-Konten haben keins).
        if self._has_password(auth_user):
            if req.current_password is None:
                raise AuthError("Aktuelles Passwort erforderlich.", status_code=400)
            aktuelle_email = self._auth_email(auth_user)
            if not aktuelle_email or not self._password_ok(
                aktuelle_email, req.current_password.get_secret_value()
            ):
                raise AuthError("Aktuelles Passwort ist falsch.", status_code=401)
        try:
            self._service.auth.admin.update_user_by_id(
                ctx.user_id, {"email": req.new_email}
            )
        except Exception as exc:
            log.warning("update_email_failed", user_id=ctx.user_id, error=str(exc))
            raise AuthError(
                "E-Mail konnte nicht geändert werden (evtl. bereits vergeben).",
                status_code=409,
            ) from exc
        # `public.users.email` NICHT mitziehen: die Adresse gilt erst, wenn der
        # Nutzer den Link in der neuen Mailbox bestätigt hat. Ein sofortiger
        # Schreibvorgang hier würde die Anzeige auf eine Adresse stellen, unter
        # der das Konto (noch) gar nicht erreichbar ist — und liefe bei einem
        # Fehlschlag von GoTrue auseinander (Wurzel 1). Den Spiegel gleicht
        # `_email_nachziehen` beim nächsten Kontoabruf an, sobald GoTrue die
        # neue Adresse führt.
        log.info("email_update_bestaetigung_gesendet", user_id=ctx.user_id)
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
        # `deactivated_at` ist die Wahrheit, `is_active` nur ihre Ableitung —
        # nicht zwei unabhängige Felder, die auseinanderlaufen können.
        gesperrt_am = u.get("deactivated_at")
        return TenantUser(
            user_id=u["id"],
            email=u.get("email"),
            full_name=u.get("full_name"),
            role=u.get("role"),
            phone=u.get("phone"),
            avatar_url=u.get("avatar_url"),
            tenant_id=u.get("tenant_id"),
            permissions=self._effective_perm_ids(u),
            preferred_language=u.get("preferred_language"),
            additional_phone=u.get("additional_phone"),
            hide_phones=bool(u.get("hide_phones")),
            spoken_languages=u.get("spoken_languages") or [],
            notes=u.get("notes"),
            deactivated_at=gesperrt_am,
            is_active=gesperrt_am is None,
            created_at=u.get("created_at"),
        )

    # Rollen, die die Nutzerverwaltung (Konto → Benutzer) sehen dürfen.
    _USER_MGMT_ROLES = frozenset(
        {UserRole.admin, UserRole.owner, UserRole.co_admin}
    )

    def list_managed_users(self, ctx: AuthContext) -> list[TenantUser]:
        """Nutzerliste für die Verwaltung (Konto → Benutzer).

        IMMER nur der eigene Tenant (Wurzel 3) — die Agentur verwaltet ihre
        eigenen Nutzer, nie fremde Konten. Normale Benutzer (staff/cleaner)
        haben keinen Zugriff (403).
        """
        row = self._ensure_user_row(ctx)
        role_raw = row.get("role") or ctx.role
        try:
            role = UserRole(role_raw) if role_raw else None
        except ValueError:
            role = None
        if role not in self._USER_MGMT_ROLES:
            raise AuthError("Keine Berechtigung für die Nutzerverwaltung.", status_code=403)

        tenant_id = row.get("tenant_id") or ctx.tenant_id
        if not tenant_id:
            return []
        res = (
            self._service.table("users")
            # Dieselben Spalten wie die Detailseite (_MANAGED_USER_COLUMNS):
            # u. a. `preferred_language`, weil der Bearbeiten-Dialog den
            # gespeicherten Wert vorbelegen muss — ohne ihn zeigte er „nicht
            # gesetzt" und überschriebe beim Speichern eine erfasste Sprache
            # mit NULL.
            .select(_MANAGED_USER_COLUMNS)
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        )
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
            .select(_MANAGED_USER_COLUMNS)
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise AuthError("Nutzer nicht gefunden.", status_code=404)
        return res.data[0]

    def get_managed_user(self, ctx: AuthContext, user_id: str) -> TenantUser:
        """Ein Nutzer der Verwaltung (Konto → Benutzer → Detailseite).

        Wurzel 9: DERSELBE Scope wie der List-Pfad — Leserolle aus
        ``_USER_MGMT_ROLES`` und Ziel im EIGENEN Tenant, sonst 404. Ein reiner
        `get_current_user` hier wäre eine IDOR: jeder eingeloggte Mitarbeiter
        könnte die Kontaktdaten, Rechte und Anmerkungen jedes Kollegen lesen,
        obwohl ihm die Liste 403 gibt.
        """
        row = self._ensure_user_row(ctx)
        role = self._role_of(row) or self._role_of({"role": ctx.role})
        if role not in self._USER_MGMT_ROLES:
            raise AuthError(
                "Keine Berechtigung für die Nutzerverwaltung.", status_code=403
            )
        tenant_id = row.get("tenant_id") or ctx.tenant_id
        if not tenant_id:
            raise AuthError("Kein Unternehmen zugeordnet.", status_code=403)
        target = self._own_managed_user(tenant_id, user_id)
        nutzer = self._to_tenant_user(target)
        # Der Kontoinhaber wird — wie in der Liste — mit den Agenturdaten aus
        # /konto angezeigt. Keine zweite Anzeige-Wahrheit für dieselbe Person.
        return self._merge_agency_into_admin([nutzer], tenant_id)[0]

    def update_managed_user(
        self,
        ctx: AuthContext,
        user_id: str,
        *,
        full_name: str | None = None,
        role: UserRole | None = None,
        permissions: list[str] | None = None,
        preferred_language: str | None = None,
        kontakt: dict | None = None,
    ) -> TenantUser:
        """Nutzer im eigenen Tenant bearbeiten (Konto → Benutzer): Name, Rolle
        und feingranulare Berechtigungen. Der Konto-Admin (Gründer) ist nicht
        umstufbar, und niemand kann zur Rolle admin befördert werden (entsteht
        nur bei register — wie beim Einladen).

        Rechte-Logik: werden ``permissions`` explizit mitgeschickt, gewinnen sie
        (auf die Rechte des Bearbeitenden geklemmt, Wurzel 3). Wird NUR die Rolle
        gewechselt (ohne explizite Rechte), greifen die Default-Rechte der neuen
        Rolle. Ohne beides bleiben die Rechte unverändert.

        ``kontakt`` sind die gesendeten Kontakt-/Zusatzfelder der Detailseite
        (phone, additional_phone, hide_phones, spoken_languages, notes) —
        bereits auf „gesendet" gefiltert. Ein Leerstring darin heißt LÖSCHEN
        (→ NULL): eine falsch eingetragene Nummer muss auch wieder wegkönnen
        (Wurzel 1)."""
        editor_row, tenant_id = self._require_user_write(ctx)
        target = self._own_managed_user(tenant_id, user_id)
        # Effektive Rechte des Bearbeitenden — klemmen jede Rechtevergabe.
        try:
            editor_role = UserRole(editor_row.get("role")) if editor_row.get("role") else None
        except ValueError:
            editor_role = None
        granter = effective_permissions(editor_role, editor_row.get("permissions"))
        patch: dict = {}
        if full_name is not None and full_name.strip():
            patch["full_name"] = full_name.strip()
        # Sprache: nur schreiben, wenn sie mitgeschickt wurde. Der Wert ist im
        # Schema bereits gegen die 24 Locales geprüft und normalisiert
        # („de-AT" → „de"); hier kommt entweder ein gültiger Code an oder None
        # für „nicht mitgeschickt, also unverändert".
        if preferred_language is not None:
            patch["preferred_language"] = preferred_language
        patch.update(self._kontakt_patch(kontakt))
        role_changed = role is not None and role.value != target.get("role")
        if role_changed:
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
        # Ziel-Rolle für die Rechte-Normalisierung: die neue (falls gewechselt),
        # sonst die bestehende. Admin-Ziel bekäme in normalize immer alle Rechte
        # — hier aber nie erreichbar, da Admin weder Ziel noch vergebbar ist.
        effective_role = role if role_changed else self._role_of(target)
        if permissions is not None:
            # Explizite Rechte gewinnen, auf die eigenen Rechte geklemmt.
            patch["permissions"] = normalize_permissions(
                permissions, effective_role, granter=granter
            )
        elif role_changed:
            # Rollenwechsel ohne explizite Rechte: Default-Rechte der neuen Rolle
            # setzen (ebenfalls geklemmt — ein co_admin darf keinen Nutzer mit
            # mehr Rechten anlegen als er selbst hat).
            patch["permissions"] = normalize_permissions(
                default_permissions_for(role), role, granter=granter
            )
        if not patch:
            return self._to_tenant_user(target)
        res = (
            self._service.table("users")
            .update(patch)
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        # Rollenwechsel auch ins JWT-app_metadata spiegeln (RLS-Quelle): sonst
        # trüge das Token des Nutzers bis zum nächsten Login die alte Rolle und
        # die rollenbasierten RLS-Policies (owner/staff-Scope) blieben falsch.
        if role_changed:
            try:
                # tenant_id explizit mitgeben, damit sie beim Metadata-Update
                # garantiert erhalten bleibt (kein Verlass auf Merge-Semantik).
                self._service.auth.admin.update_user_by_id(
                    user_id,
                    {"app_metadata": {"role": role.value, "tenant_id": tenant_id}},
                )
            except Exception as exc:  # noqa: BLE001 — Spiegelung sichtbar loggen
                log.warning(
                    "managed_user_jwt_role_sync_failed",
                    user_id=user_id, error=str(exc)[:200],
                )
        updated = res.data[0] if res.data else {**target, **patch}
        log.info(
            "managed_user_updated",
            tenant_id=tenant_id, user_id=user_id, fields=sorted(patch),
        )
        return self._to_tenant_user(updated)

    # Kontaktfelder der Detailseite, die als Text ankommen und leer = NULL sind.
    _KONTAKT_TEXTFELDER = ("phone", "additional_phone", "notes")

    @staticmethod
    def _kontakt_patch(kontakt: dict | None) -> dict:
        """Gesendete Kontakt-/Zusatzfelder in einen DB-Patch übersetzen.

        Leerstring → NULL: „nicht erfasst" und „gelöscht" sind derselbe Zustand,
        und ein `""` in der Spalte wäre ein Wert, der aussieht wie eine Angabe.
        Nicht gesendete Felder tauchen hier gar nicht auf und bleiben unverändert.
        """
        if not kontakt:
            return {}
        patch: dict = {}
        for feld in AccountService._KONTAKT_TEXTFELDER:
            if feld in kontakt:
                wert = kontakt[feld]
                text = wert.strip() if isinstance(wert, str) else wert
                patch[feld] = text or None
        if "hide_phones" in kontakt:
            patch["hide_phones"] = bool(kontakt["hide_phones"])
        if "spoken_languages" in kontakt:
            sprachen = kontakt["spoken_languages"]
            patch["spoken_languages"] = sprachen if isinstance(sprachen, list) else []
        return patch

    # Wie lange GoTrue den Login sperrt. Bewusst eine sehr lange, aber ENDLICHE
    # Frist: die Admin-API kennt kein „für immer", und ein `null` würde die
    # Sperre sofort aufheben. 100 Jahre sind operativ endgültig; aufgehoben wird
    # sie ausschließlich über activate_managed_user (Wurzel 1: der Gegenzustand
    # sitzt am selben Schalter).
    LOGIN_SPERRE_DAUER = "876000h"

    def deactivate_managed_user(
        self, ctx: AuthContext, user_id: str
    ) -> tuple[TenantUser, bool]:
        """Zugang sperren, ohne ihn zu löschen (Konto → Benutzer → Deaktivieren).

        Warum es das getrennt vom Löschen gibt: eine Reinigungskraft in
        Elternzeit, ein Eigentümer im Streit, ein Mitarbeiter mit verlorenem
        Handy — in allen drei Fällen soll der Zugang SOFORT dicht sein, die
        Zuordnungen und die Historie aber stehen bleiben. Löschen wäre nicht
        umkehrbar.

        Drei Riegel, weil einer nicht reicht (Wurzel 7):
          1. `users.deactivated_at` — die Wahrheit, die alle Wege lesen.
          2. GoTrue-`ban_duration` — sperrt den DIREKTEN Login gegen
             `/auth/v1/token` mit dem öffentlichen anon-Key und verhindert das
             Erneuern des Refresh-Tokens. Ohne diesen Schritt käme der Zugang am
             FastAPI-Layer vorbei weiter an PostgREST.
          3. `aktiv_gate` in `core.security` — wirft 401 für ein SCHON
             ausgestelltes Token, das sonst bis zu einer Stunde weitergälte.

        Reihenfolge: erst das Feld, dann der Bann. Bricht der Bann ab, steht der
        Nutzer als deaktiviert in der Liste UND das aktiv_gate greift — der
        Vorgang ist wiederholbar und niemand hält ihn für erledigt (der
        Rückgabewert sagt, ob der Anmeldedienst mitgezogen hat).
        """
        row, tenant_id = self._require_user_write(ctx)
        if user_id == row.get("id"):
            raise AuthError(
                "Das eigene Login kann nicht deaktiviert werden.", status_code=400
            )
        target = self._own_managed_user(tenant_id, user_id)
        if target.get("role") == UserRole.admin.value:
            raise AuthError(
                "Der Kontoinhaber (Admin) kann nicht deaktiviert werden.",
                status_code=400,
            )
        if target.get("deactivated_at"):
            # Idempotent (Wurzel 2): Doppelklick/Retry darf keinen Fehler und
            # keinen zweiten Zeitstempel erzeugen — der erste bleibt stehen.
            return self._to_tenant_user(target), self._login_sperren(user_id)

        # Unsere Uhr ist hier die richtige Quelle: das Deaktivieren IST unser
        # Ereignis (Wurzel 5b betrifft FREMDE Ereignisse). Bewusst ISO-8601 mit
        # UTC-Offset und nicht der String "now()" — den würde Postgres als Text
        # für eine timestamptz-Spalte ablehnen.
        res = (
            self._service.table("users")
            .update({
                "deactivated_at": datetime.now(UTC).isoformat(),
                "deactivated_by": row.get("id"),
            })
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        gesperrt = self._login_sperren(user_id)
        updated = res.data[0] if res.data else self._own_managed_user(
            tenant_id, user_id
        )
        log.info(
            "managed_user_deactivated",
            tenant_id=tenant_id, user_id=user_id, login_gesperrt=gesperrt,
        )
        return self._to_tenant_user(updated), gesperrt

    def activate_managed_user(
        self, ctx: AuthContext, user_id: str
    ) -> tuple[TenantUser, bool]:
        """Zugang wieder freischalten (Gegenzustand zu deactivate, Wurzel 1).

        Hebt BEIDES auf: den Zeitstempel und den GoTrue-Bann. Nur eines von
        beiden zurückzunehmen hinterlässt einen Nutzer, der in der Liste aktiv
        aussieht und sich nicht anmelden kann (oder umgekehrt).
        """
        _, tenant_id = self._require_user_write(ctx)
        target = self._own_managed_user(tenant_id, user_id)
        entsperrt = self._login_entsperren(user_id)
        if not target.get("deactivated_at"):
            return self._to_tenant_user(target), entsperrt
        res = (
            self._service.table("users")
            .update({"deactivated_at": None, "deactivated_by": None})
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        updated = res.data[0] if res.data else self._own_managed_user(
            tenant_id, user_id
        )
        log.info(
            "managed_user_activated",
            tenant_id=tenant_id, user_id=user_id, login_entsperrt=entsperrt,
        )
        return self._to_tenant_user(updated), entsperrt

    def _login_sperren(self, user_id: str) -> bool:
        """GoTrue-Bann setzen. True = der Anmeldedienst hat übernommen.

        Kein Weiterwerfen: das Feld steht schon, und das aktiv_gate hält den
        Zugang auch ohne Bann dicht. Ein harter Fehler hier würde einen
        wirksamen Vorgang als gescheitert melden. Der Rückgabewert wird
        durchgereicht und in der Oberfläche benannt — nicht verschluckt
        (Wurzel 5: best-effort ist erlaubt, stilles „done" nicht).
        """
        try:
            self._service.auth.admin.update_user_by_id(
                user_id, {"ban_duration": self.LOGIN_SPERRE_DAUER}
            )
            return True
        except Exception as exc:  # noqa: BLE001 — Teilerfolg melden, nicht kippen
            log.warning(
                "managed_user_login_ban_failed",
                user_id=user_id, error=str(exc)[:200],
            )
            return False

    def _login_entsperren(self, user_id: str) -> bool:
        """GoTrue-Bann aufheben („none" ist der dokumentierte Aus-Wert)."""
        try:
            self._service.auth.admin.update_user_by_id(
                user_id, {"ban_duration": "none"}
            )
            return True
        except Exception as exc:  # noqa: BLE001 — Teilerfolg melden, nicht kippen
            log.warning(
                "managed_user_login_unban_failed",
                user_id=user_id, error=str(exc)[:200],
            )
            return False

    def ist_gesperrt(self, user_id: str) -> bool:
        """Trägt dieser Zugang eine Deaktivierung? (Für das aktiv_gate.)

        Fail-CLOSED wäre hier falsch: ein Ausfall der DB würde JEDEN Nutzer
        aussperren. Ein Lesefehler wird deshalb durchgeworfen, damit der Aufrufer
        entscheidet — er antwortet mit 503 („Anmeldedienst nicht erreichbar"),
        nicht mit 401 („du bist gesperrt"). Beides ist restriktiv, nur eines ist
        wahr.
        """
        res = (
            self._service.table("users")
            .select("deactivated_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return bool(rows and rows[0].get("deactivated_at"))

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

        public_url = public_storage_url(self.AVATAR_BUCKET, path)
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
        """Profil-/Kontaktdaten setzen (Kontaktinformationen).

        Nur gesendete Felder (``exclude_unset``) werden geschrieben — so bleiben
        nicht-bearbeitete Werte erhalten. E-Mail/Passwort laufen weiter über die
        eigenen, abgesicherten Endpunkte.
        """
        row = self._ensure_user_row(ctx)
        patch = req.model_dump(exclude_unset=True)
        # Eine Identität, EIN Speicherort: beim Super-Admin gehören Name/
        # Telefon/Website der Agentur (/konto, tenant_billing_profile) — dort
        # zurückschreiben, users trägt nur den Anzeigenamen. Personengebundene
        # Gastgeber-Felder (Vorname, Wohn-/Postadresse, Notfallkontakt) gehören
        # dagegen IMMER auf users — auch beim Admin, sonst würden sie verworfen.
        if patch and row.get("role") == UserRole.admin.value:
            tenant_id = row.get("tenant_id") or ctx.tenant_id
            self._mirror_admin_profile(tenant_id, patch)
            patch = {
                k: v
                for k, v in patch.items()
                if k == "full_name" or k in _PERSONAL_USER_FIELDS
            }
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

    def phone_disable(
        self, ctx: AuthContext, req: PhoneDisableRequest
    ) -> AccountResponse:
        """SMS-Zweitfaktor entfernen — der Gegenzustand zu `phone/verify`.

        Ohne diesen Weg liesse sich die Nummer bestaetigen, aber nie loesen
        (Wurzel 1): Wer sein Telefon verliert oder die Nummer wechselt, waere
        dauerhaft ausgesperrt.

        Re-Auth ueber das PASSWORT, nicht ueber einen SMS-Code: Wer das Telefon
        nicht mehr hat, kann keinen Code empfangen — eine Code-Abfrage waere
        genau in dem Fall unbenutzbar, fuer den man den Ausschalter braucht
        (Wurzel 7). Ein gekapertes Session-Cookie allein reicht damit nicht.

        Beides zusammen abzuschalten waere falsch: Ist TOTP aktiv, bleibt es
        aktiv — die Nummer ist dann nur ein zweiter Weg, nicht der einzige.
        """
        self._ensure_user_row(ctx)
        auth_user = self._get_auth_user(ctx.user_id)
        email = self._auth_email(auth_user)

        row = (
            self._service.table("users")
            .select("phone, phone_verified_at")
            .eq("id", ctx.user_id)
            .limit(1)
            .execute()
        ).data
        if not row or not row[0].get("phone_verified_at"):
            raise AuthError(
                "Es ist keine bestätigte Nummer hinterlegt.", status_code=400
            )

        # OAuth-Konten ohne Passwort koennen sich nicht per Passwort
        # ausweisen — dort ist der SMS-Code die einzige verbliebene Huerde.
        if self._has_password(auth_user):
            if req.current_password is None:
                raise AuthError("Aktuelles Passwort erforderlich.", status_code=400)
            if not email or not self._password_ok(
                email, req.current_password.get_secret_value()
            ):
                raise AuthError("Aktuelles Passwort ist falsch.", status_code=401)

        # Nummer UND Bestaetigungszeitpunkt zusammen loeschen: bliebe
        # `phone_verified_at` stehen, gaelte eine geloeschte Nummer weiter als
        # bestaetigt (Wurzel 1).
        self._service.table("users").update(
            {"phone": None, "phone_verified_at": None}
        ).eq("id", ctx.user_id).execute()
        log.info("phone_2fa_disabled", user_id=ctx.user_id)
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

    def _email_nachziehen(
        self, user_id: str, row: dict, auth_user: object | None
    ) -> dict:
        """`public.users.email` an GoTrue angleichen, wenn sie auseinanderlaufen.

        GoTrue ist die Wahrheit: dort schaltet die Adresse erst um, wenn der
        Nutzer den Bestätigungslink in der NEUEN Mailbox geklickt hat
        (`update_email` setzt bewusst kein `email_confirm`). Genau dann zieht
        dieser Abgleich die Spiegelspalte nach — sie ist Anzeige- und
        Match-Quelle und stünde sonst dauerhaft auf der alten Adresse.
        `_ensure_user_row` leistet das nicht: es legt nur an, wenn gar keine
        Zeile existiert.

        Best-effort (Wurzel 5): schlägt der Schreibvorgang fehl, ist die
        Anzeige aus GoTrue immer noch korrekt — der Kontoabruf darf daran
        nicht scheitern.
        """
        echte_email = self._auth_email(auth_user)
        # `_auth_email` liest ein beliebiges Attribut vom SDK-Objekt — nur ein
        # echter String darf den Spiegel überschreiben, sonst schreibt ein
        # unerwarteter Rückgabewert Unsinn in die Spalte (Wurzel 4).
        if not isinstance(echte_email, str) or not echte_email.strip():
            return row
        if row.get("email") == echte_email:
            return row
        try:
            self._service.table("users").update({"email": echte_email}).eq(
                "id", user_id
            ).execute()
        except Exception as exc:  # noqa: BLE001 — reiner Spiegel, kein Hauptpfad
            log.warning("email_spiegel_nicht_aktualisiert", user_id=user_id,
                        error=str(exc)[:200])
            return row
        log.info("email_spiegel_aktualisiert", user_id=user_id)
        return {**row, "email": echte_email}

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

    def passwort_pruefen(self, ctx: AuthContext, passwort: SecretStr) -> None:
        """Re-Auth-Huerde: stimmt das aktuelle Passwort dieses Nutzers?

        Fuer sicherheitskritische Selbst-Aenderungen (Wurzel 7) — ein
        gekapertes Session-Cookie allein soll die 2FA nicht umbauen koennen.

        Fail-CLOSED: Ein Konto OHNE Passwort (reines OAuth/Google) kann sich
        hier nicht ausweisen und bekommt 401. Das ist Absicht und kein Mangel:
        fuer diese Konten ist der aal2-Weg der vorgesehene Nachweis. Ein
        „kein Passwort → dann eben durchlassen" waere genau der Fallback, den
        Wurzel 4 verbietet.
        """
        auth_user = self._get_auth_user(ctx.user_id)
        email = self._auth_email(auth_user)
        if not self._has_password(auth_user) or not email:
            raise AuthError(
                "Für dieses Konto ist der gelöste zweite Faktor erforderlich.",
                status_code=401,
            )
        if not self._password_ok(email, passwort.get_secret_value()):
            raise AuthError("Aktuelles Passwort ist falsch.", status_code=401)

    def _password_ok(self, email: str, password: str) -> bool:
        """True = Passwort stimmt, False = GoTrue hat es abgelehnt.

        Eine STÖRUNG ist keins von beidem und darf hier nicht als False
        durchrutschen (Wurzel 5): „Aktuelles Passwort ist falsch." wäre bei einem
        GoTrue-Ausfall eine Falschaussage über das Konto des Nutzers. Solche
        Fälle brechen deshalb mit 503 ab, statt die Re-Auth-Hürde mit einer
        erfundenen Antwort zu bedienen.
        """
        try:
            res = self._anon.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
        except (GoTrueAuthError, *TRANSPORT_FEHLER) as exc:
            if stoerung_oder_ablehnung(exc):
                log.warning("reauth_password_check_stoerung", error=str(exc))
                raise AuthError(STOERUNG_MELDUNG, status_code=503) from exc
            return False
        return res.session is not None


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
