"""Service-Schicht für auth.

Registrierung legt atomar Tenant + Owner-User an und schreibt tenant_id/role
ins JWT app_metadata (Quelle der Wahrheit für RLS). Bricht ein Schritt ab,
werden bereits angelegte Artefakte zurückgerollt — kein verwaister Tenant,
kein stilles Schlucken von Fehlern (PROJECT.md).
"""
import secrets
from datetime import UTC, datetime, timedelta

import jwt
import pyotp
from pydantic import SecretStr
from supabase import Client
from supabase_auth import AuthResponse
from supabase_auth.errors import AuthError as GoTrueAuthError

from src.core.config import get_settings
from src.core.gotrue_fehler import (
    STOERUNG_MELDUNG,
    TRANSPORT_FEHLER,
    ist_abgelehnt,
    stoerung_oder_ablehnung,
)
from src.core.logging import get_logger, mask_email
from src.core.security import AuthContext
from src.core.supabase import make_anon_client_with_user_agent

from .einladung_service import EinladungError, EinladungService
from .granular_permissions import (
    Permission,
    default_permissions_for,
    effective_permissions,
    nicht_vergebbar,
    normalize_permissions,
)
from .otp_service import OtpService
from .permissions import effective_capabilities, owner_family_capabilities_for
from .schemas import (
    InviteRequest,
    InviteResponse,
    LoginRequest,
    LoginResponse,
    MeResponse,
    RefreshRequest,
    RegisterRequest,
    SessionInfo,
    SessionResponse,
    SliceHealth,
    SmsLoginRequest,
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


def _mask_phone(phone: str) -> str:
    """Nummer für die Anzeige maskieren („+49 ••• 9026") — nur die letzten 4
    Ziffern sichtbar. Keine Fantasiewerte (Wurzel 4)."""
    tail = phone[-4:]
    return f"{phone[:3]} ••• {tail}" if len(phone) > 7 else "•••• " + tail


class AuthError(Exception):
    """Fachlicher Auth-Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class AuthService:
    slice_name = "auth"

    def __init__(
        self,
        anon_client: Client,
        service_client: Client,
        einladungen: EinladungService | None = None,
    ) -> None:
        # anon: RLS-respektierende User-Calls (Login).
        # service: RLS-umgehende System-Calls (Tenant-/User-Anlage beim Register).
        self._anon = anon_client
        self._service = service_client
        # Token-/Mail-Dienst der Einladung (0334). Injizierbar, damit Tests den
        # Mailweg ersetzen können, ohne echte Mails zu verschicken.
        self._einladung_service = einladungen

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
        # Posteingang: den Standard-Regelsatz als INAKTIVEN Vorschlag anlegen.
        self._standard_automail_regeln(tenant_id)
        # Partnerprogramm (0517): den Betrieb seinem Empfehler zuordnen.
        self._partner_zuordnen(req, tenant_id)
        # Frisch registriert → 2FA ist noch nie aktiv, login() liefert also immer
        # eine Session (nie mfa_required). Die Session direkt zurückgeben, damit
        # /register weiter SessionResponse ist (der Client meldet sofort an).
        result = self.login(LoginRequest(email=req.email, password=req.password))
        if result.session is None:
            raise AuthError("Login nach Registrierung fehlgeschlagen.", status_code=500)
        return result.session

    def _partner_zuordnen(self, req: RegisterRequest, tenant_id: str) -> None:
        """Empfehlungscode aus dem Formular → `affiliate_referrals` (0517).

        Nebenpfad der Registrierung: ein Fehler hier darf den Betrieb nicht
        ohne Konto stehen lassen. Er wird aber LAUT geloggt (ERROR, nicht
        warning) — eine verlorene Zuordnung ist Geld des Partners, und der
        UNIQUE-Backstop macht einen späteren manuellen Nachtrag im Backoffice
        möglich (`method='manual'`)."""
        if not req.referral_code:
            return
        try:
            from src.features.affiliates import attribution  # noqa: PLC0415
            from src.features.affiliates.mails import PartnerMails  # noqa: PLC0415

            attribution.zuordnen(
                self._service,
                tenant_id=tenant_id,
                tenant_email=req.email,
                code=req.referral_code,
                click_token=req.referral_click,
                contact_opt_in=req.referral_contact_opt_in,
                mails=PartnerMails(),
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, darf die Registrierung nie kippen
            log.error(
                "partner_zuordnung_fehlgeschlagen",
                tenant_id=tenant_id,
                code=req.referral_code,
                error=str(exc)[:300],
            )

    def _standard_automail_regeln(self, tenant_id: str) -> None:
        """Vier INAKTIVE Automail-Regeln für den frischen Betrieb (14.09.2026).

        Nebenpfad: der Betrieb muss auch dann entstehen, wenn der Posteingang
        gerade nicht mitspielt — ein Konto ohne Regelvorschläge ist ein
        Schönheitsfehler, ein fehlgeschlagenes Register ein verlorener Kunde.
        Der Fehler wird aber LAUT geloggt (ERROR), weil ihn sonst niemand je
        bemerkt: eine leere Regelliste sieht aus wie „so ist es gedacht".

        Die Sprache kommt aus dem Betrieb (`tenants.default_language`) über
        dieselbe Kette wie jede Mail (`core.mail_sprache`); ist dort nichts
        gepflegt, greift deren `FALLBACK` — kein hier erfundener Wert.
        """
        try:
            from src.core.mail_empfaenger import betriebs_sprache  # noqa: PLC0415
            from src.core.mail_sprache import aufloesen  # noqa: PLC0415
            from src.features.inbox.standard_regeln import (  # noqa: PLC0415
                standard_regeln_anlegen,
            )

            sprache = aufloesen(betriebs_sprache(self._service, tenant_id))
            standard_regeln_anlegen(self._service, tenant_id, sprache)
        except Exception as exc:  # noqa: BLE001 — darf Registrierung nie blockieren
            log.error(
                "standardregeln_fehlgeschlagen", tenant_id=tenant_id, error=str(exc)
            )

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
        kein neuer Tenant. ``granter_id`` ist der einladende Nutzer: seine
        effektiven Rechte klemmen die Vergabe (Wurzel 3, keine
        Privilege-Escalation).

        Das Passwort kommt NICHT mehr vom Client (0334): der Auth-User entsteht
        mit einem serverseitigen Zufallswert, den niemand kennt und der nirgends
        ausgegeben oder geloggt wird. Gesetzt wird das echte Passwort von der
        eingeladenen Person über den Einmal-Link aus der Mail.

        ALLES-ODER-NICHTS (Wurzel 5): scheitert die users-Zeile ODER der
        Mailversand, wird der Auth-User wieder gelöscht. Ein angelegter, aber
        unerreichbarer Nutzer wäre ein stiller Teilerfolg — er belegt die
        E-Mail-Adresse (ein zweiter Versuch liefe in „E-Mail bereits vergeben"),
        taucht in Nutzerlisten auf und hat doch keinen Weg hinein. Lieber ein
        klarer Fehler und ein sauberer zweiter Versuch."""
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
            # Rollen-Standard: was der Vergebende nicht weitergeben kann, fällt
            # still weg — er hat es nicht ausgewählt, also ist es keine
            # unerfüllte Zusage. Der Verlust steht im Protokoll, damit er
            # nachvollziehbar bleibt.
            standard = default_permissions_for(req.role)
            verloren = nicht_vergebbar(standard, granter, req.role)
            if verloren:
                log.info(
                    "rollen_standard_geklemmt",
                    extra={
                        "rolle": req.role.value,
                        "nicht_vergebbar": verloren,
                        "vergeber": granter_id,
                    },
                )
            permissions = normalize_permissions(standard, req.role, granter=granter)
        else:
            # AUSDRÜCKLICH GEWÄHLT: hier wäre stilles Verwerfen eine Lüge. Der
            # Aufrufer hat Häkchen gesetzt und bekäme „gespeichert" zurück,
            # während die Hälfte fehlt. Live legte ein co_admin so
            # Eigentümer-Konten mit einem einzigen wirksamen Recht an.
            verloren = nicht_vergebbar(req.permissions, granter, req.role)
            if verloren:
                raise AuthError(
                    "Diese Berechtigungen können Sie nicht vergeben, weil Sie "
                    "sie selbst nicht haben: " + ", ".join(verloren),
                    status_code=422,
                )
            permissions = normalize_permissions(
                req.permissions, req.role, granter=granter
            )

        # Zufallspasswort, das niemand kennt — auch der einladende Admin nicht.
        # 32 Byte aus dem CSPRNG; es dient nur dazu, das Konto anzulegen, und
        # wird nie zurückgegeben, angezeigt oder geloggt.
        user_id = self._create_auth_user(
            email=req.email,
            password=SecretStr(secrets.token_urlsafe(32)),
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
                language=req.preferred_language,
                # Kontakt-/Zusatzangaben aus dem Wizard. Bis 0356 sammelte die
                # Oberflaeche sie ein und verwarf sie — sie stehen jetzt in
                # derselben Zeile wie Name und Rolle.
                kontakt={
                    "phone": req.phone,
                    "additional_phone": req.additional_phone,
                    "hide_phones": req.hide_phones,
                    "spoken_languages": req.spoken_languages,
                    "notes": req.notes,
                },
            )
        except Exception:
            self._rollback_user(user_id)
            raise

        # Einladungsmail. Schlägt sie fehl, wird die Anlage vollständig
        # zurückgerollt (siehe Docstring) und der Fehler durchgereicht.
        try:
            self._einladungen().einladung_versenden(
                user_id=user_id,
                tenant_id=tenant_id,
                email=req.email,
                full_name=req.full_name,
                eingeladen_von=granter_id,
                betrieb=self._tenant_name(tenant_id),
            )
        except EinladungError as exc:
            self._rollback_user_row(user_id)
            self._rollback_user(user_id)
            raise AuthError(exc.message, status_code=exc.status_code) from exc

        log.info(
            "user_invited",
            tenant_id=tenant_id,
            role=req.role.value,
            # Maskiert (DSGVO/CWE-532): der Klartext gehört nicht ins Log.
            email=mask_email(req.email),
        )
        return InviteResponse(
            user_id=user_id,
            email=req.email,
            role=req.role,
            tenant_id=tenant_id,
            permissions=permissions,
        )

    def einladung_erneut_senden(self, ctx: AuthContext, user_id: str) -> None:
        """Einladung erneut verschicken (die Mail kam nicht an).

        Scope wie der List-Pfad (Wurzel 9): der Nutzer muss im EIGENEN Tenant
        liegen, sonst 404 — ein Admin darf keine Einladung an einen fremden
        Mandanten auslösen. Der alte Link wird dabei entwertet (Wurzel 1)."""
        if not ctx.tenant_id:
            raise AuthError("Kein Mandant im Token.", status_code=400)
        rows = (
            self._service.table("users")
            .select("id, tenant_id, email, full_name")
            .eq("id", user_id)
            .eq("tenant_id", ctx.tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise AuthError("Nutzer nicht gefunden.", status_code=404)
        zeile = rows[0]
        if not zeile.get("email"):
            raise AuthError(
                "Zu diesem Nutzer ist keine E-Mail-Adresse hinterlegt.",
                status_code=422,
            )
        try:
            self._einladungen().einladung_erneut_senden(
                user_id=user_id,
                tenant_id=ctx.tenant_id,
                email=zeile["email"],
                full_name=zeile.get("full_name") or "",
                eingeladen_von=ctx.user_id,
                betrieb=self._tenant_name(ctx.tenant_id),
            )
        except EinladungError as exc:
            raise AuthError(exc.message, status_code=exc.status_code) from exc

    def _einladungen(self) -> EinladungService:
        """Der Token-/Mail-Dienst (0334). Eigene Klasse, eigene Tabelle."""
        if self._einladung_service is None:
            self._einladung_service = EinladungService(service_client=self._service)
        return self._einladung_service

    def _tenant_name(self, tenant_id: str) -> str | None:
        """Betriebsname für die Anrede in der Einladungsmail.

        Fehlt er, bleibt die Mail ohne Betriebsnamen — sie ist dann etwas
        unpersönlicher, aber korrekt. Ein erfundener Name wäre schlimmer
        (Wurzel 4)."""
        rows = (
            self._service.table("tenants")
            .select("name")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0].get("name") if rows else None

    def _rollback_user_row(self, user_id: str) -> None:
        """users-Zeile nach einem gescheiterten Mailversand entfernen."""
        try:
            self._service.table("users").delete().eq("id", user_id).execute()
        # Best-Effort-Rollback: jeder SDK-Fehler wird geloggt, nie verschluckt.
        except Exception as exc:  # noqa: BLE001  pylint: disable=broad-exception-caught
            log.error("rollback_user_row_failed", user_id=user_id, error=str(exc))

    def login(
        self, req: LoginRequest, user_agent: str | None = None
    ) -> LoginResponse:
        """Erster Login-Schritt: E-Mail + Passwort.

        Hat der Nutzer 2FA aktiv (Authenticator-App ODER SMS), wird KEINE Session
        ausgegeben (fail-closed), sondern nur ein kurzlebiges Pending-Token
        (mfa_required=True). Die echte Session entsteht erst nach erfolgreichem
        zweiten Schritt (login_totp / login_sms). Bei SMS wird der Code hier
        direkt gesendet, damit er beim Nutzer ankommt, bevor er den Code eingibt.

        user_agent: der ECHTE Browser-User-Agent (vom BFF durchgereicht). GoTrue
        speichert ihn in auth.sessions → der Geräteverlauf zeigt das echte Gerät,
        nicht den Server-Client.
        """
        session = self._sign_in(req.email, req.password, user_agent)
        user_id = session.user.id
        self._welt_pruefen(user_id, getattr(session.user, "app_metadata", None))

        # Hat der Nutzer einen NATIVEN GoTrue-Faktor (0341), ist dieser Weg
        # nicht mehr zustaendig: Die Session, die wir hier ausstellen wuerden,
        # traegt aal1 und wird vom zentralen Guard ohnehin abgewiesen. Der
        # Client muss die Challenge direkt gegen GoTrue loesen
        # (/auth/v1/factors/{id}/challenge + /verify) und bekommt von dort ein
        # aal2-Token. Wir geben die Session trotzdem zurueck — sie ist gueltig
        # genug, um die Faktor-Challenge zu fahren, und der Guard laesst mit
        # ihr nur /auth/mfa/*, /auth/account und /auth/logout durch.
        if self._hat_gotrue_faktor(user_id):
            return LoginResponse(
                session=self._to_session(session),
                mfa_required=True,
                mfa_methods=self._gotrue_faktor_typen(user_id),
            )

        methods: list[str] = []
        # BEWUSST kein `user_mfa` mehr (Wurzel 7): die alte App-2FA war ueber
        # den GoTrue-Direktlogin umgehbar und erzeugte eine zweite Wahrheit
        # darueber, ob ein Konto einen zweiten Faktor hat. Enrollment dafuer
        # ist seit 0341 abgeschaltet (410); bestehende Zeilen wirken nicht mehr.
        phone = self._sms_2fa_phone(user_id)
        if phone:
            methods.append("sms")

        if not methods:
            return LoginResponse(session=self._to_session(session))

        # SMS-Code sofort senden, falls SMS ein Faktor ist (best effort — schlägt
        # der Versand fehl, bleibt TOTP als Weg, falls vorhanden).
        if "sms" in methods:
            self._send_login_sms(user_id, phone)  # type: ignore[arg-type]

        return LoginResponse(
            mfa_required=True,
            mfa_token=self._issue_mfa_token(user_id),
            mfa_methods=methods,
            mfa_phone_masked=_mask_phone(phone) if phone else None,
        )

    def login_totp(
        self, req: TotpLoginRequest, user_agent: str | None = None
    ) -> LoginResponse:
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
        session = self._session_for_verified_user(user_id, user_agent)
        log.info("login_totp_ok", user_id=user_id)
        return LoginResponse(session=session)

    def login_sms(
        self, req: SmsLoginRequest, user_agent: str | None = None
    ) -> LoginResponse:
        """Zweiter Login-Schritt bei SMS-2FA: Pending-Token + SMS-Code einlösen.

        Der Code wurde in login() an die verifizierte Nummer gesendet. Prüfung,
        Fehlversuch-Zählung und Ablauf laufen über den OTP-Service (gleicher
        Hash-/Brute-Force-Schutz wie bei der Nummern-Verifizierung).
        """
        user_id = self._verify_mfa_token(req.mfa_token)
        phone = self._sms_2fa_phone(user_id)
        if not phone:
            raise AuthError("SMS-2FA ist für dieses Konto nicht aktiv.", status_code=400)
        # Code über den OTP-Service prüfen (purpose='2fa_login').
        self._otp().verify_login_code(user_id, phone, req.code.strip())
        session = self._session_for_verified_user(user_id, user_agent)
        log.info("login_sms_ok", user_id=user_id)
        return LoginResponse(session=session)

    # --- SMS-2FA-Bausteine -------------------------------------------------

    def _sms_2fa_phone(self, user_id: str) -> str | None:
        """Die verifizierte Telefonnummer, wenn SMS-2FA aktiv ist — sonst None.
        SMS-2FA gilt als aktiv, sobald die Nummer per SMS bestätigt wurde
        (phone_verified_at gesetzt)."""
        res = (
            self._service.table("users")
            .select("phone, phone_verified_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        row = res.data[0] if res.data else None
        if row and row.get("phone_verified_at") and row.get("phone"):
            return row["phone"]
        return None

    def _send_login_sms(self, user_id: str, phone: str) -> None:
        """Login-OTP an die verifizierte Nummer senden (best effort — ein
        Versandfehler darf den Login-Step nicht mit 500 killen)."""
        try:
            self._otp().send_login_code(user_id, phone)
        except Exception as exc:  # noqa: BLE001 — Versand best effort
            log.warning("login_sms_send_failed", user_id=user_id, error=str(exc))

    def _otp(self) -> OtpService:
        return OtpService(db=self._service)

    # --- Login-Bausteine ---------------------------------------------------

    def _anon_for_ua(self, user_agent: str | None) -> Client:
        """Der Auth-Client für einen Login/Session-Call. Mit Browser-UA ein
        frischer Client, der diesen UA an GoTrue sendet (→ echter Geräteverlauf);
        ohne UA der globale Client."""
        if user_agent:
            return make_anon_client_with_user_agent(user_agent)
        return self._anon

    def _sign_in(
        self, email: str, password: SecretStr, user_agent: str | None = None
    ) -> AuthResponse:
        """E-Mail + Passwort gegen GoTrue prüfen.

        Fail-closed, aber EHRLICH (Wurzel 5): Ein breites `except Exception`
        machte hier aus JEDEM Fehler ein 401 „Login fehlgeschlagen." — ein
        GoTrue-503, ein Kong-Hänger und ein Verbindungsabbruch waren von einem
        falschen Passwort nicht zu unterscheiden. Live passiert (09.08.2026):
        der Supabase-Stack lag, das Backoffice meldete „Login fehlgeschlagen.",
        und der Betreiber verdächtigte stundenlang sein Passwort und seine 2FA
        statt der Infrastruktur.

        Die Unterscheidung ist dieselbe wie in `refresh()` — sie liegt in
        `stoerung_oder_ablehnung`, damit es keine zweite Auslegung davon gibt,
        was „abgelehnt" heißt. Eine echte Ablehnung bleibt bewusst dieselbe
        neutrale Meldung für „Mail unbekannt" wie für „Passwort falsch" (keine
        Nutzer-Enumeration).
        """
        try:
            res = self._anon_for_ua(user_agent).auth.sign_in_with_password(
                {"email": email, "password": password.get_secret_value()}
            )
        except (GoTrueAuthError, *TRANSPORT_FEHLER) as exc:
            stoerung = stoerung_oder_ablehnung(exc)
            log.warning(
                "login_failed",
                email=mask_email(email),
                error=str(exc),
                stoerung=stoerung,
            )
            if stoerung:
                raise AuthError(STOERUNG_MELDUNG, status_code=503) from exc
            raise AuthError("Login fehlgeschlagen.", status_code=401) from exc
        if res.session is None or res.user is None:
            raise AuthError("Login fehlgeschlagen.", status_code=401)
        return res

    def _welt_pruefen(self, user_id: str, app_meta: object) -> None:
        """Kein Session-Ausstellen für Konten aus einer fremden Auth-Welt.

        Partner (ADR-0020) und Marktplatz-Gäste liegen in derselben
        `auth.users`, ihre Passwörter stimmen also auch hier. Der Login muss
        sie abweisen und den richtigen Weg nennen — sonst landen sie mit einer
        Session ohne Betrieb in einer Oberfläche, die ihnen nur 403 zeigt
        (12.09.2026). Dieselbe Regel wie im Token-Riegel `welt_gate`.
        """
        from .welt_gate import pms_abweisung, welt_bestimmen  # noqa: PLC0415

        meldung = pms_abweisung(app_meta, get_settings())
        if meldung is None:
            return
        log.warning(
            "login_falsche_welt", user_id=user_id, welt=welt_bestimmen(app_meta)
        )
        raise AuthError(meldung, status_code=403)

    @staticmethod
    def _to_session(res: AuthResponse) -> SessionResponse:
        return SessionResponse(
            access_token=res.session.access_token,
            refresh_token=res.session.refresh_token,
            expires_in=res.session.expires_in,
        )

    def _hat_gotrue_faktor(self, user_id: str) -> bool:
        """Hat der Nutzer einen VERIFIZIERTEN nativen Faktor (auth.mfa_factors)?

        Fail-CLOSED (Wurzel 5): Laesst sich das nicht feststellen, gilt „ja" —
        dann fuehrt der Login in den Faktor-Schritt statt eine Session
        auszugeben, die der Guard hinterher ohnehin abweist. Ein „im Zweifel
        nein" waere hier die gefaehrliche Richtung.
        """
        from .mfa_service import MfaError, MfaService

        try:
            return bool(MfaService(db=self._service).faktoren(user_id))
        except MfaError:
            log.warning("gotrue_faktor_status_unlesbar", user_id=user_id)
            return True

    def _gotrue_faktor_typen(self, user_id: str) -> list[str]:
        """Die Typen der verifizierten Faktoren (totp/phone/webauthn) — rein
        informativ fuer die Oberflaeche. Fehler hier duerfen den Login nicht
        kippen, deshalb im Zweifel eine leere Liste."""
        from .mfa_service import MfaError, MfaService

        try:
            faktoren = MfaService(db=self._service).faktoren(user_id)
        except MfaError:
            return []
        return [str(f.get("factor_type")) for f in faktoren if f.get("factor_type")]

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

    def _session_for_verified_user(
        self, user_id: str, user_agent: str | None = None
    ) -> SessionResponse:
        """Session für einen bereits (per TOTP/SMS) verifizierten User ausstellen.

        GoTrue kennt keinen 'session for user_id'-Aufruf; wir nutzen den
        Admin-Endpoint, der ein Refresh-Token generiert, und tauschen es sofort
        gegen eine Access/Refresh-Session. Der verify_otp-Call ERZEUGT die
        Session-Zeile in auth.sessions → er muss den Browser-UA tragen, damit der
        Geräteverlauf das echte Gerät zeigt (nicht den Server-Client).

        Der zweite Faktor ist an dieser Stelle BEREITS bewiesen — ein Fehler hier
        ist deshalb nie ein Urteil über die Anmeldedaten des Nutzers. Eine
        Störung wird 503 (Wurzel 5); ein 401 „Login fehlgeschlagen." sähe für den
        Nutzer aus wie ein falscher Code und schickte ihn den Faktor-Schritt
        endlos wiederholen."""
        try:
            auth_user = self._service.auth.admin.get_user_by_id(user_id)
            email = getattr(auth_user.user, "email", None)
        except (GoTrueAuthError, *TRANSPORT_FEHLER) as exc:
            log.warning("mfa_session_user_lookup_failed", user_id=user_id, error=str(exc))
            raise AuthError(STOERUNG_MELDUNG, status_code=503) from exc
        if not email:
            raise AuthError("Login fehlgeschlagen.", status_code=401)
        try:
            link = self._service.auth.admin.generate_link(
                {"type": "magiclink", "email": email}
            )
            props = getattr(link, "properties", None)
            token_hash = getattr(props, "hashed_token", None)
            verified = self._anon_for_ua(user_agent).auth.verify_otp(
                {"token_hash": token_hash, "type": "magiclink"}
            )
        except (GoTrueAuthError, *TRANSPORT_FEHLER) as exc:
            stoerung = stoerung_oder_ablehnung(exc)
            log.warning(
                "mfa_session_issue_failed",
                user_id=user_id,
                error=str(exc),
                stoerung=stoerung,
            )
            if stoerung:
                raise AuthError(STOERUNG_MELDUNG, status_code=503) from exc
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
        wird NICHT geloggt (nur der Fehlertext).

        401 aber NUR bei echter Ablehnung: `AuthError` ist die Basisklasse auch
        aller technischen GoTrue-Fehler (Timeout, 5xx, 429). Die pauschal als
        „Sitzung abgelaufen" auszuliefern hat eingeloggte Nutzer bei jedem
        GoTrue-Hänger auf /login geworfen — das BFF wertet 401 definitionsgemäß
        als abgemeldet. Technisches wird deshalb 503: die Sitzung gilt weiter,
        der Aufrufer darf es erneut versuchen."""
        try:
            res = self._anon.auth.refresh_session(
                req.refresh_token.get_secret_value()
            )
        except GoTrueAuthError as exc:
            abgelehnt = ist_abgelehnt(exc)
            log.warning("refresh_failed", error=str(exc), abgelehnt=abgelehnt)
            if not abgelehnt:
                raise AuthError(
                    "Anmeldedienst nicht erreichbar.", status_code=503
                ) from exc
            raise AuthError(
                "Sitzung abgelaufen.", status_code=401
            ) from exc
        except TRANSPORT_FEHLER as exc:
            # Verbindungsabbruch/Timeout: das SDK übersetzt ihn nicht, er käme
            # sonst als 500 heraus. Die Sitzung ist davon unberührt.
            log.warning("refresh_transport_error", error=str(exc))
            raise AuthError(
                "Anmeldedienst nicht erreichbar.", status_code=503
            ) from exc

        session = res.session
        if session is None:
            raise AuthError("Sitzung abgelaufen.", status_code=401)
        return SessionResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            expires_in=session.expires_in,
        )

    # --- Geräteverlauf / aktive Sitzungen ----------------------------------

    def list_sessions(self, ctx: AuthContext) -> list[SessionInfo]:
        """Aktive Sitzungen des eingeloggten Nutzers (Airbnb „Geräteverlauf").

        Liest auth.sessions ausschließlich für ctx.user_id über die gescopte
        SECURITY-DEFINER-RPC (Wurzel 3 — der Scope steckt in der Funktion, nie
        eine Client-ID). Die aktuelle Sitzung (session_id aus dem Token) wird
        markiert, damit die UI sie als „Dieses Gerät" zeigen kann."""
        res = self._service.rpc(
            "host_list_own_sessions", {"p_user_id": ctx.user_id}
        ).execute()
        rows = res.data or []
        out: list[SessionInfo] = []
        for r in rows:
            out.append(
                SessionInfo(
                    id=r["id"],
                    user_agent=r.get("user_agent"),
                    ip=r.get("ip"),
                    created_at=r.get("created_at"),
                    last_seen_at=r.get("last_seen_at"),
                    is_current=bool(ctx.session_id and r["id"] == ctx.session_id),
                )
            )
        return out

    def revoke_session(self, ctx: AuthContext, session_id: str) -> None:
        """Eine EIGENE Sitzung widerrufen (Gerät abmelden). Der Scope auf
        ctx.user_id in der RPC verhindert das Löschen fremder Sitzungen (Wurzel
        3/9). 0 gelöschte Zeilen → die Sitzung gehört nicht dem Nutzer → 404."""
        res = self._service.rpc(
            "host_revoke_session",
            {"p_user_id": ctx.user_id, "p_session_id": session_id},
        ).execute()
        deleted = res.data if isinstance(res.data, int) else 0
        if not deleted:
            raise AuthError("Sitzung nicht gefunden.", status_code=404)
        log.info("session_revoked", user_id=ctx.user_id)

    def revoke_other_sessions(self, ctx: AuthContext) -> int:
        """Alle anderen Sitzungen widerrufen („Auf allen anderen Geräten
        abmelden"). Die aktuelle Sitzung bleibt bestehen (ctx.session_id)."""
        res = self._service.rpc(
            "host_revoke_other_sessions",
            {"p_user_id": ctx.user_id, "p_keep_session_id": ctx.session_id},
        ).execute()
        count = res.data if isinstance(res.data, int) else 0
        log.info("other_sessions_revoked", user_id=ctx.user_id, count=count)
        return count

    def _familien_stufe(self, user_id: str) -> str | None:
        """Freigabe-Stufe, wenn dieses Konto ein FAMILIENZUGANG ist (0389).

        `None` = kein Familienzugang, dann gilt die Rolle unverändert. Das ist
        der Normalfall: die Tabelle enthält live drei Zeilen.

        Bei mehreren Objekten mit verschiedenen Stufen gewinnt die NIEDRIGSTE.
        Die Capability-Menge ist hier nicht objektbezogen — eine höhere Stufe
        würde also für alle Objekte gelten, auch die, für die sie nicht erteilt
        wurde. Die objektgenaue Prüfung bleibt Sache der Slices
        (`owner_property_assignments`); diese Deckelung ist die Untergrenze.

        Best-effort im Fehlerfall: schlägt die Abfrage fehl, gilt das Konto
        NICHT als Familienzugang — die Rolle greift dann wie bisher. Ein
        Fehlschlag darf `/auth/me` nicht kippen, sonst kommt niemand mehr in die
        Oberfläche.
        """
        try:
            res = (
                self._service.table("owner_family_members")
                .select("access")
                .eq("user_id", user_id)
                .execute()
            )
        except Exception:  # noqa: BLE001 - Anmeldung darf hieran nicht scheitern
            log.exception("familien_stufe_lesen_fehlgeschlagen")
            return None
        stufen = [str(r.get("access") or "") for r in (res.data or [])]
        stufen = [x for x in stufen if x]
        if not stufen:
            return None
        # Die niedrigste Stufe gewinnt. „Niedrig" heißt: die kleinere
        # Fähigkeiten-Menge — abgeleitet aus dem Katalog, nicht aus einer hier
        # gepflegten Rangliste. Sonst müsste eine dritte Stufe an zwei Stellen
        # eingetragen werden, und die zweite würde vergessen. Eine unbekannte
        # Stufe ergibt die leere Menge und gewinnt damit von selbst
        # (fail-closed, Wurzel 5).
        return min(stufen, key=lambda x: len(owner_family_capabilities_for(x)))

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
        # Rolle NUR aus der DB, kein `or ctx.role` (Wurzel 7): `/auth/me` speist
        # das Gating ALLER Oberflächen. Eine im Token veraltete Rolle hätte dort
        # bis zu einer Stunde Menüpunkte offen gehalten, die der Server längst
        # mit 403 abweist.
        role_raw = data.get("role")
        role = UserRole(role_raw) if role_raw in UserRole.__members__ else None
        perms = effective_permissions(role, data.get("permissions"))
        # Effektive Fähigkeiten = Rollen-Capabilities OHNE PM-Bereich, falls das
        # PM-Dach fehlt (dieselbe Brücke wie im Guard). So blendet die Sidebar
        # Kontrollzentrum/Buchungen/Aufgaben automatisch aus, wenn der PM-Zugriff
        # im Rechte-Dialog entzogen wurde.
        pm = Permission.ACCESS_PM_FEATURES in perms
        caps = effective_capabilities(
            role,
            has_pm_access=pm,
            # Familienzugang (0389) DECKELT das Ergebnis: das Mitglied trägt in
            # `users` die Rolle `owner`, darf aber nur, was seine Stufe hergibt.
            # Ohne diesen Wert bekam es in jeder Oberfläche außer dem Portal die
            # vollen Eigentümer-Fähigkeiten.
            family_access=self._familien_stufe(ctx.user_id),
        )
        tenant_meta = self._tenant_meta(ctx.tenant_id)
        return MeResponse(
            user_id=ctx.user_id,
            email=data.get("email"),
            tenant_id=ctx.tenant_id,
            role=role,
            capabilities=sorted(c.value for c in caps),
            permissions=sorted(p.value for p in perms),
            accommodation_type=tenant_meta.get("accommodation_type"),
            # Der Vorfuehrbetrieb (0630) meldet sich NICHT als Demo: Balken,
            # Sidebar-Schloesser und Nur-Lesen-Hinweise haengen im Frontend
            # an diesem Feld, und fuer ihn gelten die Riegel nicht. Wuerde er
            # `is_demo: true` melden, zeigte die Oberflaeche Sperren, die die
            # API gar nicht mehr durchsetzt — eine Anzeige, die luegt.
            is_demo=bool(tenant_meta.get("is_demo"))
            and not tenant_meta.get("ist_vorfuehrbetrieb"),
            is_internal=bool(tenant_meta.get("is_internal")),
            # Liste, nie None: eine fehlende Spalte oder ein leeres Feld sind
            # beide „kein Modul freigeschaltet" — der Aufrufer soll dafuer
            # keinen Sonderfall brauchen.
            enabled_modules=list(tenant_meta.get("enabled_modules") or []),
            account_type=tenant_meta.get("account_type"),
            default_language=tenant_meta.get("default_language"),
            country=tenant_meta.get("country"),
            tenant_name=tenant_meta.get("name"),
            tenant_logo_url=self._tenant_logo_url(ctx.tenant_id),
        )

    def _tenant_logo_url(self, tenant_id: str | None) -> str | None:
        """Firmenlogo des Betriebs (Konto → Profil).

        Eigener Abruf, weil das Logo nicht an `tenants` haengt, sondern am
        Rechnungsprofil (`tenant_billing_profile.company_logo_url`). Fehlt die
        Zeile oder ist das Feld leer, ist das der Normalfall eines Betriebs
        ohne hochgeladenes Logo — None, kein Ersatzbild (Wurzel 4).
        """
        if not tenant_id:
            return None
        row = (
            self._service.table("tenant_billing_profile")
            .select("company_logo_url")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return (row[0].get("company_logo_url") or None) if row else None

    def _tenant_meta(self, tenant_id: str | None) -> dict:
        # Mandanten-Metadaten in EINEM Abruf (0090 accommodation_type + 0180
        # account_type + 0335 default_language + country) — steuert Navigation,
        # Betriebsmodell/Billing, Mail-Sprachkette und die länderspezifischen
        # Menüpunkte.
        if not tenant_id:
            return {}
        row = (
            self._service.table("tenants")
            .select(
                "name, accommodation_type, account_type, default_language, "
                "country, is_demo, is_internal, ist_vorfuehrbetrieb, "
                "enabled_modules"
            )
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

    def set_default_language(
        self, ctx: AuthContext, value: str | None
    ) -> MeResponse:
        """Standardsprache des Betriebs setzen (`tenants.default_language`).

        Der Wert ist bereits durch `pruefe_sprache` im Schema normalisiert
        („de-AT" → „de") oder auf None gefallen; ein nicht unterstützter Code
        kam gar nicht bis hierher (422).

        Wie `set_accommodation_type`: die Berechtigung (MANAGE_TENANT) prüft
        der Router-Guard, hier wird nur der EIGENE Mandant beschrieben —
        Service-Role umgeht RLS, der Tenant-Scope muss explizit sein (Wurzel 3).
        """
        if not ctx.tenant_id:
            raise AuthError("Kein Mandant im Token.", status_code=400)
        res = (
            self._service.table("tenants")
            .update({"default_language": value})
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
        language: str | None = None,
        kontakt: dict[str, object] | None = None,
    ) -> None:
        zeile: dict[str, object] = {
            "id": user_id,
            "tenant_id": tenant_id,
            "role": role.value,
            "email": email,
            "full_name": full_name,
            "permissions": permissions or [],
        }
        # Kontakt-/Zusatzangaben nur schreiben, wenn wirklich etwas kam. Ein
        # leeres Feld hier zu setzen hiesse dieselbe Verwechslung wie bei der
        # Sprache unten: „nicht erfasst" und „bewusst geleert" wuerden gleich
        # aussehen. `hide_phones` und `spoken_languages` haben in der DB einen
        # Default (false / []) — ohne Angabe greift der, kein erfundener Wert.
        for feld, wert in (kontakt or {}).items():
            if isinstance(wert, str):
                text = wert.strip()
                if text:
                    zeile[feld] = text
            elif isinstance(wert, bool):
                if wert:
                    zeile[feld] = True
            elif wert:
                zeile[feld] = wert
        # NUR schreiben, wenn der Einladende die Sprache wirklich angegeben
        # hat. Ein `"preferred_language": None` wäre zwar dasselbe Ergebnis,
        # aber ein leeres Feld hier zu setzen hieße später, nicht mehr
        # unterscheiden zu können zwischen „nicht erfasst" und „bewusst
        # geleert" — und NULL ist genau die Stufe, an der die Fallback-Kette
        # zur Betriebssprache weitergeht (core.mail_sprache).
        if language:
            zeile["preferred_language"] = language
        self._service.table("users").insert(zeile).execute()

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
