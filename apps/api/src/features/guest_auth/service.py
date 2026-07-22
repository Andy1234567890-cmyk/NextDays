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
from supabase import Client
from supabase_auth.errors import AuthError as GoTrueAuthError

from src.core.logging import get_logger, mask_email
from src.core.security import GuestContext

from .schemas import (
    GuestLoginRequest,
    GuestMessageResponse,
    GuestPasswordResetRequest,
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
        falschen Daten, kein breites except, das Signale verschluckt)."""
        try:
            res = self._anon.auth.sign_in_with_password(
                {
                    "email": req.email,
                    "password": req.password.get_secret_value(),
                }
            )
        except GoTrueAuthError as exc:
            log.warning("guest_login_failed", email=mask_email(req.email), error=str(exc))
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
        geloggt (nur der Fehlertext)."""
        try:
            res = self._anon.auth.refresh_session(
                req.refresh_token.get_secret_value()
            )
        except GoTrueAuthError as exc:
            log.warning("guest_refresh_failed", error=str(exc))
            raise GuestAuthError("Sitzung abgelaufen.", status_code=401) from exc
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
        try:
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
