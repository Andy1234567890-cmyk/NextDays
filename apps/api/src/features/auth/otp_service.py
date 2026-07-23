"""OTP-Service: Einmal-Codes für SMS-Nummern-Verifizierung (Airbnb-„Confirm
account"-Muster).

Sicherheit:
- Code 6-stellig, nur als SHA-256-HASH gespeichert (nie Klartext, wie Passwörter).
- Kurzlebig (10 min), einmal verwendbar (consumed_at), max. Fehlversuche (5) →
  Brute-Force-Schutz.
- Idempotenz (Wurzel 2): ein frischer, noch gültiger pending-Code wird
  wiederverwendet statt einer zweiten SMS (Doppelklick/Retry) — spart Kosten und
  verhindert SMS-Pumping über Retry.
- Rate-Limit pro Nutzer: nicht mehr als N Sendevorgänge je Zeitfenster.
- Byteweiser Vergleich (secrets_match, Wurzel 5).
- Nur service_role schreibt/liest otp_challenge (Wurzel 6).
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext, secrets_match

from .sms import SmsError, send_sms

log = get_logger("nextdays.auth.otp")

_CODE_TTL = timedelta(minutes=10)
_MAX_ATTEMPTS = 5
# Ein frischer Code gilt für Idempotenz als „noch nutzbar", wenn er jünger als
# das ist — dann keine zweite SMS bei Doppelklick.
_REUSE_WINDOW = timedelta(seconds=60)
# Rate-Limit: max. so viele Sendevorgänge je Nutzer im Fenster.
_SEND_LIMIT = 5
_SEND_WINDOW = timedelta(minutes=15)


class OtpError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _now() -> datetime:
    return datetime.now(UTC)


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _gen_code() -> str:
    """6-stelliger Code, gleichverteilt (secrets, nicht random)."""
    return f"{secrets.randbelow(1_000_000):06d}"


class OtpService:
    def __init__(self, db: Client) -> None:
        self._db = db

    # -- Senden ------------------------------------------------------------

    def send_phone_code(self, ctx: AuthContext, phone_e164: str) -> None:
        """Einen SMS-Code zur Nummern-Verifizierung senden.

        Idempotent: existiert ein frischer, ungenutzter Code (< _REUSE_WINDOW),
        wird KEINE zweite SMS gesendet. Rate-Limit pro Nutzer greift davor.
        """
        self._enforce_send_rate(ctx.user_id)

        # Frischen, noch nicht eingelösten Code für dieselbe Nummer suchen.
        existing = (
            self._db.table("otp_challenge")
            .select("id, created_at")
            .eq("user_id", ctx.user_id)
            .eq("purpose", "phone_verify")
            .eq("destination", phone_e164)
            .is_("consumed_at", "null")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if existing.data:
            created = datetime.fromisoformat(existing.data[0]["created_at"])
            if _now() - created < _REUSE_WINDOW:
                # Doppelklick/Retry → nichts Neues senden (Wurzel 2).
                log.info("otp_reuse_pending", user_id=ctx.user_id)
                return

        code = _gen_code()
        self._db.table("otp_challenge").insert(
            {
                "user_id": ctx.user_id,
                "tenant_id": ctx.tenant_id,
                "purpose": "phone_verify",
                "destination": phone_e164,
                "code_hash": _hash_code(code),
                "expires_at": (_now() + _CODE_TTL).isoformat(),
            }
        ).execute()

        # SMS senden — schlägt der Versand fehl, ist die Challenge trotzdem da,
        # aber der Nutzer bekam nichts → als Fehler melden (kein stiller Erfolg).
        try:
            send_sms(
                phone_e164,
                f"Dein myNextDays-Bestätigungscode: {code}. "
                "Gültig für 10 Minuten.",
            )
        except SmsError as exc:
            raise OtpError(exc.message, status_code=exc.status_code) from exc
        log.info("otp_sent", user_id=ctx.user_id, purpose="phone_verify")

    # -- Prüfen ------------------------------------------------------------

    def verify_phone_code(
        self, ctx: AuthContext, phone_e164: str, code: str
    ) -> None:
        """Code prüfen. Erfolg → Challenge einlösen + users.phone/
        phone_verified_at setzen. Fehlversuche zählen; Ablauf/Limit → Fehler.
        """
        row = (
            self._db.table("otp_challenge")
            .select("*")
            .eq("user_id", ctx.user_id)
            .eq("purpose", "phone_verify")
            .eq("destination", phone_e164)
            .is_("consumed_at", "null")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not row.data:
            raise OtpError("Kein aktiver Code. Bitte neu anfordern.", status_code=404)
        ch = row.data[0]

        if ch["attempts"] >= _MAX_ATTEMPTS:
            raise OtpError(
                "Zu viele Fehlversuche. Bitte neuen Code anfordern.",
                status_code=429,
            )
        if datetime.fromisoformat(ch["expires_at"]) < _now():
            raise OtpError("Code abgelaufen. Bitte neu anfordern.", status_code=410)

        if not secrets_match(_hash_code(code), ch["code_hash"]):
            # Fehlversuch zählen (Brute-Force-Schutz).
            self._db.table("otp_challenge").update(
                {"attempts": ch["attempts"] + 1}
            ).eq("id", ch["id"]).execute()
            raise OtpError("Code ist falsch.", status_code=401)

        # Erfolg: ZUERST die Nummer verifizieren, DANN die Challenge einlösen.
        # Reihenfolge wichtig — schlägt der users-Update fehl, bleibt der Code
        # nutzbar (kein „verbrauchter" Code ohne Wirkung, Wurzel 5).
        now_iso = _now().isoformat()
        self._db.table("users").update(
            {"phone": phone_e164, "phone_verified_at": now_iso}
        ).eq("id", ctx.user_id).execute()
        self._db.table("otp_challenge").update({"consumed_at": now_iso}).eq(
            "id", ch["id"]
        ).execute()
        log.info("phone_verified", user_id=ctx.user_id)

    # -- Login-2FA (purpose='2fa_login') -----------------------------------

    def send_login_code(self, user_id: str, phone_e164: str) -> None:
        """Login-OTP an die (bereits verifizierte) Nummer senden. Wie
        send_phone_code, aber purpose='2fa_login'. Idempotent + rate-limited."""
        self._enforce_send_rate(user_id, "2fa_login")
        existing = (
            self._db.table("otp_challenge")
            .select("id, created_at")
            .eq("user_id", user_id)
            .eq("purpose", "2fa_login")
            .is_("consumed_at", "null")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if existing.data:
            created = datetime.fromisoformat(existing.data[0]["created_at"])
            if _now() - created < _REUSE_WINDOW:
                log.info("otp_login_reuse_pending", user_id=user_id)
                return

        code = _gen_code()
        self._db.table("otp_challenge").insert(
            {
                "user_id": user_id,
                "purpose": "2fa_login",
                "destination": phone_e164,
                "code_hash": _hash_code(code),
                "expires_at": (_now() + _CODE_TTL).isoformat(),
            }
        ).execute()
        try:
            send_sms(
                phone_e164,
                f"Dein myNextDays-Anmeldecode: {code}. Gültig für 10 Minuten.",
            )
        except SmsError as exc:
            raise OtpError(exc.message, status_code=exc.status_code) from exc
        log.info("otp_sent", user_id=user_id, purpose="2fa_login")

    def verify_login_code(self, user_id: str, phone_e164: str, code: str) -> None:
        """Login-OTP prüfen. Erfolg → Challenge einlösen (KEIN users-Update,
        die Nummer ist schon verifiziert). Fehlversuche/Ablauf wie sonst."""
        row = (
            self._db.table("otp_challenge")
            .select("*")
            .eq("user_id", user_id)
            .eq("purpose", "2fa_login")
            .eq("destination", phone_e164)
            .is_("consumed_at", "null")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not row.data:
            raise OtpError("Kein aktiver Code. Bitte neu anfordern.", status_code=404)
        ch = row.data[0]
        if ch["attempts"] >= _MAX_ATTEMPTS:
            raise OtpError(
                "Zu viele Fehlversuche. Bitte neuen Code anfordern.", status_code=429
            )
        if datetime.fromisoformat(ch["expires_at"]) < _now():
            raise OtpError("Code abgelaufen. Bitte neu anfordern.", status_code=410)
        if not secrets_match(_hash_code(code), ch["code_hash"]):
            self._db.table("otp_challenge").update(
                {"attempts": ch["attempts"] + 1}
            ).eq("id", ch["id"]).execute()
            raise OtpError("Code ist falsch.", status_code=401)
        self._db.table("otp_challenge").update(
            {"consumed_at": _now().isoformat()}
        ).eq("id", ch["id"]).execute()
        log.info("login_code_verified", user_id=user_id)

    # -- Rate-Limit --------------------------------------------------------

    def _enforce_send_rate(self, user_id: str, purpose: str = "phone_verify") -> None:
        since = (_now() - _SEND_WINDOW).isoformat()
        recent = (
            self._db.table("otp_challenge")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("purpose", purpose)
            .gte("created_at", since)
            .execute()
        )
        if (recent.count or 0) >= _SEND_LIMIT:
            raise OtpError(
                "Zu viele Anfragen. Bitte später erneut versuchen.",
                status_code=429,
            )
