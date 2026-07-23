"""SMS-Versand über Twilio (dünner Adapter). Nur der OTP-Service ruft das hier.

Fail-closed: fehlt die Twilio-Config, wird KLAR fehlgeschlagen (kein Fake-
„gesendet", Wurzel 4/5). Der Auth-Token liegt als SecretStr in der Config und
wird nie geloggt. Twilio-Fehler werden in eine saubere Meldung übersetzt, nicht
als 500-Stacktrace durchgereicht.
"""
from __future__ import annotations

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from src.core.config import get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.auth.sms")


class SmsError(Exception):
    """SMS-Versand fehlgeschlagen (Config fehlt oder Twilio-Fehler)."""

    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _client() -> tuple[Client, str]:
    """Konfigurierten Twilio-Client + Absendernummer. Fehlt etwas → SmsError
    (503), damit das Frontend „SMS nicht konfiguriert" sieht (kein 500)."""
    s = get_settings()
    sid = s.twilio_account_sid
    token = s.twilio_auth_token.get_secret_value()
    from_number = s.twilio_from_number
    if not (sid and token and from_number):
        raise SmsError(
            "SMS-Versand ist nicht konfiguriert (Twilio-Zugangsdaten fehlen).",
            status_code=503,
        )
    return Client(sid, token), from_number


def send_sms(to_e164: str, body: str) -> str:
    """Eine SMS senden. Gibt die Twilio-Message-SID zurück (für Audit/DLR).

    Wirft SmsError bei Config-/Twilio-Fehlern. Der Empfänger MUSS E.164 sein
    (der Aufrufer validiert das).
    """
    client, from_number = _client()
    try:
        msg = client.messages.create(to=to_e164, from_=from_number, body=body)
    except TwilioRestException as exc:
        # Twilios Fehlermeldung ist nutzerlesbar (z. B. „unverified number" im
        # Trial) → 1:1 weiterreichen, aber ohne Token/Interna zu leaken.
        log.warning("twilio_send_failed", code=exc.code, status=exc.status)
        raise SmsError(exc.msg or "SMS konnte nicht gesendet werden.") from exc
    log.info("sms_sent", message_sid=msg.sid)
    return msg.sid
