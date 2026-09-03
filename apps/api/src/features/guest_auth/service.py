"""Service-Schicht für guest_auth (Portal-Gast-Konto der Demand-Seite).

Ein Portal-Gast ist ein reines Kundenkonto: ein ``auth.users``-Eintrag OHNE
tenant_id/role im app_metadata (das unterscheidet ihn vom Tenant-Nutzer aus
``features/auth``) plus eine ``portal_guests``-Zeile (id == auth.uid()) mit
Kontaktdaten und Anzeige-Präferenzen.

Muster übernommen aus ``features/auth/service.py``:
- ``_anon`` = RLS-respektierender Client für Login/Refresh/Reset,
- ``_service`` = Service-Role (umgeht RLS) für Admin-User-Anlage und die
  ``portal_guests``-Zeile, die per anon-Key gesperrt ist (Migration 0181,
  Wurzel 6). Jeder per-ID-Zugriff ist über ``guest_id`` gescopet (Wurzel 3/9).

SICHERHEITSAUFLAGEN (offene TODO, bewusst dokumentiert):
- Doppel-Opt-in: ``register`` setzt für Staging ``email_confirm=True`` (siehe
  Kommentar dort), damit der Flow ohne laufenden Mailversand testbar ist. In
  Produktion MUSS die E-Mail-Bestätigung über den Mailcow-Versand nachgezogen
  werden (``email_confirm=False`` + Bestätigungsmail an die NEUE Adresse) —
  nie dauerhaft auto-confirmen (Wurzel 7).
- E-Mail-Wechsel: NICHT über ``update_profile`` — ein E-Mail-Wechsel verlangt
  Re-Auth (aktuelles Passwort) und Doppel-Opt-in an die neue Adresse (Wurzel 7).
  Das ist ein eigener, noch nicht gebauter Flow (siehe ``update_profile``).
"""
from pydantic import SecretStr
from supabase import Client
from supabase_auth.errors import AuthError as GoTrueAuthError

from src.core.gotrue_fehler import (
    STOERUNG_MELDUNG,
    TRANSPORT_FEHLER,
    ist_abgelehnt,
    stoerung_oder_ablehnung,
)
from src.core.logging import get_logger, mask_email
from src.core.security import GuestContext

from .schemas import (
    GuestKontoLoeschenRequest,
    GuestKontoLoeschenResponse,
    GuestLoginRequest,
    GuestMessageResponse,
    GuestPasswordResetRequest,
    GuestPasswortNeuRequest,
    GuestProfileResponse,
    GuestProfileUpdateRequest,
    GuestRefreshRequest,
    GuestRegisterRequest,
    GuestSessionResponse,
    SliceHealth,
)

log = get_logger("nextdays.guest_auth")

# Profilfelder, die der Gast über die API lesen/schreiben darf. E-Mail ist NICHT
# dabei (eigener Re-Auth-Flow, Wurzel 7); id/created_at sind server-verwaltet.
_PROFILE_COLUMNS = "id, email, name, phone, preferred_locale, preferred_currency, marketing_opt_in"


class GuestAuthError(Exception):
    """Fachlicher Gast-Auth-Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class GuestAuthService:
    slice_name = "guest_auth"

    def __init__(self, anon_client: Client, service_client: Client) -> None:
        # anon: RLS-respektierende Gast-Calls (Login/Refresh/Passwort-Reset).
        # service: RLS-umgehende System-Calls (Auth-User- und portal_guests-Anlage;
        # portal_guests ist für anon/authenticated per GRANT gesperrt, 0181).
        self._anon = anon_client
        self._service = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    # --- Registrierung -----------------------------------------------------

    def register(self, req: GuestRegisterRequest) -> GuestSessionResponse:
        """Neues Gast-Konto anlegen (Auth-User + portal_guests-Zeile, atomar).

        Der Auth-User erhält KEIN tenant_id/role im app_metadata — das ist der
        Marker, der ihn vom Tenant-Nutzer trennt. Scheitert die Profilzeile,
        wird der Auth-User zurückgerollt (kein verwaister GoTrue-User).

        SICHERHEIT (Wurzel 7): ``email_confirm`` steht für Staging bewusst auf
        ``True``, damit sofort eine Session ausgestellt werden kann und der Flow
        ohne laufenden Mailversand testbar ist. Das ist ein Provisorium — in
        Produktion MUSS auf ``email_confirm=False`` + Doppel-Opt-in (Mailcow)
        umgestellt werden; dann liefert dieser Aufruf statt einer Session eine
        „Bitte E-Mail bestätigen"-Meldung.
        """
        user_id = self._create_guest_auth_user(req)
        try:
            self._create_guest_row(user_id, req)
        except Exception:
            self._rollback_auth_user(user_id)
            raise
        # Frisch registriert, kein 2FA für Gäste → login liefert immer eine Session.
        return self.login(GuestLoginRequest(email=req.email, password=req.password))

    def _create_guest_auth_user(self, req: GuestRegisterRequest) -> str:
        """GoTrue-Auth-User OHNE tenant_id/role anlegen (das ist ein Gast!)."""
        try:
            res = self._service.auth.admin.create_user(
                {
                    "email": req.email,
                    "password": req.password.get_secret_value(),
                    # TODO(Wurzel 7): Produktion → email_confirm=False + Doppel-
                    # Opt-in-Mail (Mailcow) an die NEUE Adresse; NIE dauerhaft
                    # auto-confirmen. Für Staging True, damit der Flow testbar ist.
                    "email_confirm": True,  # noqa: S106 — Staging-Provisorium, s. Docstring
                    # Bewusst LEER: ein Gast trägt kein tenant_id/role — daran
                    # erkennt der Rest des Systems das Kundenkonto.
                    "app_metadata": {},
                }
            )
        except Exception as exc:
            log.warning(
                "guest_create_user_failed", email=mask_email(req.email), error=str(exc)
            )
            raise GuestAuthError(
                "Konto konnte nicht angelegt werden (E-Mail evtl. vergeben).",
                status_code=409,
            ) from exc
        if res.user is None:
            raise GuestAuthError(
                "Konto konnte nicht angelegt werden.", status_code=500
            )
        return res.user.id

    def _create_guest_row(self, user_id: str, req: GuestRegisterRequest) -> None:
        """portal_guests-Zeile anlegen (id == auth.uid(), E-Mail lower-case)."""
        self._service.table("portal_guests").insert(
            {
                "id": user_id,
                "email": req.email.lower(),
                "name": req.name,
                "phone": req.phone,
                "preferred_locale": req.preferred_locale,
                "preferred_currency": (
                    req.preferred_currency.upper()
                    if req.preferred_currency
                    else None
                ),
            }
        ).execute()

    def _rollback_auth_user(self, user_id: str) -> None:
        try:
            self._service.auth.admin.delete_user(user_id)
        # Best-Effort-Rollback: jeder SDK-Fehler wird geloggt, nie verschluckt.
        except Exception as exc:  # noqa: BLE001  pylint: disable=broad-exception-caught
            log.error("guest_rollback_user_failed", user_id=user_id, error=str(exc))

    # --- Login / Refresh ---------------------------------------------------

    def login(self, req: GuestLoginRequest) -> GuestSessionResponse:
        """E-Mail + Passwort → Session. Kein MFA für Gäste (fail-closed 401 bei
        falschen Daten, kein breites except, das Signale verschluckt).

        Wie beim Vermieter-Login (`auth.service._sign_in`) ist ein technischer
        GoTrue-Fehler KEINE Ablehnung der Zugangsdaten: 5xx/429/Timeout werden
        503, damit ein Ausfall nicht wie ein falsches Passwort aussieht. Ein roher
        Transportfehler käme sonst zusätzlich als 500 heraus, weil das SDK ihn
        nicht in eine AuthError übersetzt."""
        try:
            res = self._anon.auth.sign_in_with_password(
                {
                    "email": req.email,
                    "password": req.password.get_secret_value(),
                }
            )
        except (GoTrueAuthError, *TRANSPORT_FEHLER) as exc:
            stoerung = stoerung_oder_ablehnung(exc)
            log.warning(
                "guest_login_failed",
                email=mask_email(req.email),
                error=str(exc),
                stoerung=stoerung,
            )
            if stoerung:
                raise GuestAuthError(STOERUNG_MELDUNG, status_code=503) from exc
            raise GuestAuthError("Login fehlgeschlagen.", status_code=401) from exc
        if res.session is None:
            raise GuestAuthError("Login fehlgeschlagen.", status_code=401)
        return GuestSessionResponse(
            access_token=res.session.access_token,
            refresh_token=res.session.refresh_token,
            expires_in=res.session.expires_in,
        )

    def refresh(self, req: GuestRefreshRequest) -> GuestSessionResponse:
        """Refresh-Token → frische Session. Fail-closed (Wurzel 5): ein
        ungültiges/abgelaufenes/widerrufenes Token ist ein 401 — spezifisch die
        GoTrue-AuthError fangen, kein breites except. Der Token wird nicht
        geloggt (nur der Fehlertext).

        Technische GoTrue-Fehler (Timeout, 5xx, 429) sind KEINE Ablehnung und
        werden 503 — sonst meldet ein Hänger des Auth-Servers eingeloggte Gäste
        ab (dieselbe Ursache wie beim Vermieter-Refresh)."""
        try:
            res = self._anon.auth.refresh_session(
                req.refresh_token.get_secret_value()
            )
        except GoTrueAuthError as exc:
            abgelehnt = ist_abgelehnt(exc)
            log.warning("guest_refresh_failed", error=str(exc), abgelehnt=abgelehnt)
            if not abgelehnt:
                raise GuestAuthError(
                    "Anmeldedienst nicht erreichbar.", status_code=503
                ) from exc
            raise GuestAuthError("Sitzung abgelaufen.", status_code=401) from exc
        except TRANSPORT_FEHLER as exc:
            log.warning("guest_refresh_transport_error", error=str(exc))
            raise GuestAuthError(
                "Anmeldedienst nicht erreichbar.", status_code=503
            ) from exc
        if res.session is None:
            raise GuestAuthError("Sitzung abgelaufen.", status_code=401)
        return GuestSessionResponse(
            access_token=res.session.access_token,
            refresh_token=res.session.refresh_token,
            expires_in=res.session.expires_in,
        )

    # --- Passwort-Reset ----------------------------------------------------

    def password_reset(
        self, req: GuestPasswordResetRequest
    ) -> GuestMessageResponse:
        """Passwort-Reset-Mail anstoßen. Antwortet IMMER neutral (kein
        Existenz-Leak, ob die Adresse ein Konto hat): ein GoTrue-Fehler wird
        geloggt, aber nicht an den Aufrufer durchgereicht (Best-Effort, kippt
        den Hauptpfad nicht — Wurzel 5)."""
        # `redirect_to` zeigt auf die Marktplatz-Seite, die das neue Passwort
        # setzt. Ohne diese Angabe nimmt GoTrue seine eigene
        # `GOTRUE_SITE_URL` — und die zeigt im Stack auf die Supabase-Adresse,
        # die 404 gibt (gemessen 03.09.2026). Der Gast bekam damit eine Mail,
        # die einen „Link zum Zurücksetzen" versprach und ins Nichts führte.
        #
        # Das Ziel MUSS in `GOTRUE_URI_ALLOW_LIST` stehen (Coolify-Variable
        # `ADDITIONAL_REDIRECT_URLS` des Supabase-Stacks), sonst verwirft
        # GoTrue es stillschweigend und fällt auf die Site-URL zurück.
        #
        # Fehlt `marketplace_base_url`, wird KEIN Ziel übergeben statt eines
        # geratenen (Wurzel 4); der Code in der Mail funktioniert weiterhin.
        # Lokal geholt statt im Konstruktor: der Service wird an mehreren
        # Stellen ohne Settings gebaut, und eine neue Pflicht-Abhängigkeit
        # hätte jeden Aufrufer geändert.
        from src.core.config import get_settings  # noqa: PLC0415

        basis = (get_settings().marketplace_base_url or "").strip().rstrip("/")
        optionen = {"redirect_to": f"{basis}/passwort-neu"} if basis else None
        if not basis:
            log.error(
                "marketplace_base_url_fehlt",
                hinweis="MARKETPLACE_BASE_URL setzen — Reset-Mail ohne Ziel.",
            )
        try:
            if optionen:
                self._anon.auth.reset_password_email(req.email, optionen)
            else:
                self._anon.auth.reset_password_email(req.email)
        # noqa: BLE001 — bewusst breit: der Reset ist best-effort und darf die
        # neutrale 200-Antwort nie kippen (sonst leakt der Fehler die Existenz).
        except Exception as exc:  # noqa: BLE001  pylint: disable=broad-exception-caught
            log.warning(
                "guest_password_reset_failed",
                email=mask_email(req.email),
                error=str(exc),
            )
        return GuestMessageResponse(
            message="Falls ein Konto existiert, wurde eine E-Mail versendet."
        )

    def passwort_neu_setzen(
        self, req: GuestPasswortNeuRequest
    ) -> GuestSessionResponse:
        """Neues Passwort mit dem Code aus der Reset-Mail setzen und anmelden.

        WARUM DER CODE UND NICHT DER LINK (03.09.2026): Der Link in der Mail
        zeigte auf ``{API_EXTERNAL_URL}/verify?token=…``. Kong veroeffentlicht
        GoTrue aber unter ``/auth/v1/`` (``strip_path: true``) — gemessen gibt
        ``/auth/v1/verify?token=x&type=recovery`` 303 und ``/verify?…`` 404.
        Der Marktplatz versprach dem Gast einen „Link zum Zuruecksetzen", und
        der fuehrte auf Kongs Fehlerseite. Der Code steht in derselben Mail
        und haengt an keiner URL.

        ZWEI SCHRITTE, und der zweite braucht den ersten: ``verify_otp``
        tauscht Code+Adresse gegen eine Sitzung, und erst MIT dieser Sitzung
        darf ``update_user`` das Passwort setzen. Ein ``update_user`` ohne
        vorangegangenes ``verify_otp`` haette kein Token.

        Kein Existenz-Leak (Wurzel 9): ein falscher Code und eine unbekannte
        Adresse ergeben dieselbe 400er-Meldung.
        """
        try:
            geprueft = self._anon.auth.verify_otp(
                {
                    "email": str(req.email),
                    "token": req.code.strip(),
                    "type": "recovery",
                }
            )
        except (GoTrueAuthError, *TRANSPORT_FEHLER) as exc:
            if stoerung_oder_ablehnung(exc) and not isinstance(exc, GoTrueAuthError):
                raise GuestAuthError(STOERUNG_MELDUNG, status_code=503) from exc
            log.info("guest_reset_code_ungueltig", email=mask_email(str(req.email)))
            raise GuestAuthError(
                "Code ist ungültig oder abgelaufen. Bitte neu anfordern.",
                status_code=400,
            ) from exc
        if geprueft.session is None:
            raise GuestAuthError(
                "Code ist ungültig oder abgelaufen. Bitte neu anfordern.",
                status_code=400,
            )

        try:
            self._anon.auth.set_session(
                geprueft.session.access_token, geprueft.session.refresh_token
            )
            self._anon.auth.update_user({"password": req.password.get_secret_value()})
        except Exception as exc:
            log.warning(
                "guest_passwort_setzen_fehlgeschlagen",
                email=mask_email(str(req.email)),
                error=str(exc),
            )
            raise GuestAuthError(
                "Passwort konnte nicht gesetzt werden.", status_code=502
            ) from exc
        finally:
            # Die Sitzung IMMER abraeumen — auch im Fehlerfall, sonst traegt
            # der geteilte `_anon`-Client fremde Anmeldedaten weiter.
            try:
                self._anon.auth.sign_out()
            except Exception:  # noqa: BLE001 — best effort
                log.debug("guest_signout_nach_reset_fehlgeschlagen")

        log.info("guest_passwort_neu", email=mask_email(str(req.email)))
        return self.login(
            GuestLoginRequest(email=req.email, password=req.password)
        )

    # --- Profil (guest_id-gescopet, Wurzel 3/9) ----------------------------

    def get_profile(self, ctx: GuestContext) -> GuestProfileResponse:
        """Eigenes Profil laden — Load und Scope zusammen (Wurzel 3): der
        Datensatz wird ausschließlich über ``id == guest_id`` selektiert, es gibt
        keinen ungescopten Load mit nachgelagertem Vergleich."""
        row = self._own_guest_row(ctx)
        return self._to_profile(row)

    def update_profile(
        self, ctx: GuestContext, req: GuestProfileUpdateRequest
    ) -> GuestProfileResponse:
        """Eigene Profilfelder aktualisieren (guest_id-gescopet, Wurzel 3/9).

        Die E-Mail wird hier bewusst NICHT geändert: ein E-Mail-Wechsel verlangt
        Re-Auth (aktuelles Passwort) und Doppel-Opt-in an die neue Adresse
        (Wurzel 7) und ist ein eigener, noch nicht gebauter Flow — NICHT halb
        über dieses PATCH mitgebaut.
        TODO(Wurzel 7): dedizierten E-Mail-Wechsel-Endpunkt mit Re-Auth +
        Doppel-Opt-in ergänzen, sobald der Mailversand steht.
        """
        # Sicherstellen, dass der Datensatz existiert (und dem Gast gehört),
        # bevor geschrieben wird — sonst wäre ein Update auf 0 Zeilen still.
        self._own_guest_row(ctx)
        updates = self._build_updates(req)
        if not updates:
            # Nichts zu ändern → aktuellen Stand zurückgeben (idempotent).
            return self.get_profile(ctx)
        res = (
            self._service.table("portal_guests")
            .update(updates)
            .eq("id", ctx.guest_id)
            .execute()
        )
        if not res.data:
            raise GuestAuthError("Profil nicht gefunden.", status_code=404)
        return self._to_profile(res.data[0])

    @staticmethod
    def _build_updates(req: GuestProfileUpdateRequest) -> dict:
        """Nur gesendete Felder ins Update übernehmen (weggelassene bleiben).

        ``exclude_unset`` unterscheidet „Feld weggelassen" von „bewusst auf null
        gesetzt"; die Währung wird normalisiert (upper-case), bleibt aber reine
        Anzeige-Präferenz (Wurzel 4)."""
        data = req.model_dump(exclude_unset=True)
        currency = data.get("preferred_currency")
        if isinstance(currency, str):
            data["preferred_currency"] = currency.upper()
        return data

    # --- Konto löschen (Apple 5.1.1(v)) ------------------------------------

    def konto_loeschen(
        self, ctx: GuestContext, req: GuestKontoLoeschenRequest
    ) -> GuestKontoLoeschenResponse:
        """Eigenes Gast-Konto löschen.

        Apple verlangt diesen Weg IN der App, sobald man dort ein Konto anlegen
        kann (Guideline 5.1.1(v)); Google verlangt zusätzlich den Web-Weg.

        Anders als beim Betriebs-Konto ist hier die SOFORTIGE Löschung richtig:
        am Gast-Login hängt kein Beleg. Was am Gast hängt, gehört dem Gastgeber —
        die Buchung selbst, die Gästekartei des Betriebs, Rechnungen. Das bleibt
        bestehen, und der Gast MUSS das wissen; deshalb trägt die Antwort den
        Hinweis (Wurzel 4: keine stillschweigende Halbwahrheit).

        Reihenfolge: erst der Auth-Login (danach ist keine Anmeldung mehr
        möglich), dann die `portal_guests`-Zeile. Sie hängt per
        `on delete cascade` am Auth-User, wird hier aber ausdrücklich mitgelöscht,
        damit kein Halbzustand entsteht, wenn die Kaskade einmal nicht greift.

        Die Passwort-Rückfrage läuft über einen echten Login-Versuch mit der
        eigenen Adresse — dieselbe Prüfung wie in `login`, mit derselben
        Trennung: eine STÖRUNG ist keine Ablehnung (503, nicht 401), sonst sähe
        ein GoTrue-Ausfall wie ein falsches Passwort aus (Wurzel 5).
        """
        zeile = self._own_guest_row(ctx)
        email = (zeile.get("email") or "").strip()
        if not email:
            raise GuestAuthError("Konto nicht gefunden.", status_code=404)
        self._passwort_pruefen(email, req.password)

        try:
            self._service.auth.admin.delete_user(ctx.guest_id)
        except Exception as exc:  # noqa: BLE001 — SDK-Fehler einheitlich melden
            log.warning(
                "guest_konto_auth_delete_failed",
                guest_id=ctx.guest_id,
                error=str(exc)[:200],
            )
            raise GuestAuthError(
                "Das Konto konnte nicht gelöscht werden. Bitte erneut versuchen.",
                status_code=502,
            ) from exc

        self._service.table("portal_guests").delete().eq("id", ctx.guest_id).execute()
        log.info("guest_konto_geloescht", guest_id=ctx.guest_id)
        return GuestKontoLoeschenResponse(
            geloescht=True,
            detail="Dein Konto wurde gelöscht.",
            hinweis=(
                "Bereits getätigte Buchungen bleiben beim jeweiligen Gastgeber "
                "bestehen — sie sind ein Vertrag und unterliegen gesetzlichen "
                "Aufbewahrungsfristen. Für Fragen dazu wende dich an den "
                "Gastgeber."
            ),
        )

    def _passwort_pruefen(self, email: str, passwort: SecretStr) -> None:
        """Re-Auth über einen Login-Versuch. Falsch → 401, Störung → 503."""
        try:
            res = self._anon.auth.sign_in_with_password(
                {"email": email, "password": passwort.get_secret_value()}
            )
        except (GoTrueAuthError, *TRANSPORT_FEHLER) as exc:
            if stoerung_oder_ablehnung(exc):
                log.warning("guest_reauth_stoerung", error=str(exc))
                raise GuestAuthError(STOERUNG_MELDUNG, status_code=503) from exc
            raise GuestAuthError("Passwort ist falsch.", status_code=401) from exc
        if res.session is None:
            raise GuestAuthError("Passwort ist falsch.", status_code=401)

    def _own_guest_row(self, ctx: GuestContext) -> dict:
        """Die EIGENE portal_guests-Zeile laden (Load+Scope zusammen, Wurzel 3).

        Selektiert strikt über ``id == guest_id`` — kein roher Load per fremder
        ID mit nachträglichem Vergleich. Fehlt die Zeile, ist das ein 404."""
        res = (
            self._service.table("portal_guests")
            .select(_PROFILE_COLUMNS)
            .eq("id", ctx.guest_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise GuestAuthError("Profil nicht gefunden.", status_code=404)
        return res.data[0]

    @staticmethod
    def _to_profile(row: dict) -> GuestProfileResponse:
        return GuestProfileResponse(
            guest_id=row["id"],
            email=row["email"],
            name=row.get("name"),
            phone=row.get("phone"),
            preferred_locale=row.get("preferred_locale"),
            preferred_currency=row.get("preferred_currency"),
            marketing_opt_in=bool(row.get("marketing_opt_in")),
        )
