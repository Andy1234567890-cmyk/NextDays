"""E-Mail-Versand über den eigenen Mailcow-SMTP-Server (deploy/mail/).

Eine schlanke Versand-Schicht auf der Standard-Lib (``smtplib`` + ``email``) —
kein neues Dependency. Der Mailserver läuft separat (Mailcow, eigener Host); hier
wird NUR abgeschickt.

Wurzeln (CLAUDE.md):
- W4 (keine Fallbacks): fehlt Host ODER Absenderadresse → ``MailError``. Es wird
  NIE eine plausible Ersatz-Absenderadresse erfunden und NIE still „Erfolg"
  gemeldet.
- W5 (fail-closed, präzise): SMTP-Fehler werden spezifisch gefangen und als
  ``MailError`` re-raised — nie breit verschluckt und als „gesendet" markiert.
"""
from __future__ import annotations

import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from src.core.config import Settings, get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.mail")


class MailError(Exception):
    """Versand fehlgeschlagen oder nicht konfiguriert. Wird bewusst geworfen statt
    still verschluckt — der Aufrufer entscheidet, ob er es (best-effort) fängt."""

    def __init__(self, message: str, *, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class OutboundMessage:
    """Eine zu versendende Nachricht. ``to`` ist eine oder mehrere Adressen."""

    to: str | list[str]
    subject: str
    text: str
    html: str | None = None
    reply_to: str | None = None

    @property
    def recipients(self) -> list[str]:
        addrs = [self.to] if isinstance(self.to, str) else list(self.to)
        cleaned = [a.strip() for a in addrs if a and a.strip()]
        if not cleaned:
            raise MailError("Keine Empfängeradresse angegeben.", status_code=422)
        return cleaned


class MailService:
    """Versendet Mails über SMTP (Submission/STARTTLS, Port 587). Settings werden
    injiziert → in Tests mockbar, im Sandbox-Modus wird nichts real gesendet."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def _build(self, msg: OutboundMessage) -> EmailMessage:
        s = self._settings
        email = EmailMessage()
        email["From"] = formataddr((s.smtp_from_name or "", s.smtp_from_address))
        email["To"] = ", ".join(msg.recipients)
        email["Subject"] = msg.subject
        # Eindeutige Message-ID mit unserer Absenderdomain — hilft Zustellbarkeit
        # und macht Threads/Deduplizierung möglich.
        domain = s.smtp_from_address.rsplit("@", 1)[-1] or None
        email["Message-ID"] = make_msgid(domain=domain)
        if msg.reply_to:
            email["Reply-To"] = msg.reply_to
        email.set_content(msg.text)
        if msg.html:
            email.add_alternative(msg.html, subtype="html")
        return email

    def send(self, msg: OutboundMessage) -> str:
        """Versendet die Nachricht und gibt die Message-ID zurück.

        Raises MailError, wenn nicht konfiguriert (W4) oder der SMTP-Dialog
        scheitert (W5). Kein stiller Erfolg."""
        s = self._settings

        # W4: ohne Server/Absender NICHT senden — und nichts erfinden.
        if not s.mail_configured:
            raise MailError(
                "E-Mail-Versand ist nicht konfiguriert (SMTP_HOST/SMTP_FROM_ADDRESS "
                "fehlen).",
                status_code=503,
            )

        email = self._build(msg)
        message_id = email["Message-ID"]
        recipients = msg.recipients

        # Sandbox (Dev/Test): kein realer Call, nur protokollieren. Bewusst NACH der
        # Konfig-Prüfung, damit auch der Sandbox-Pfad einen gültigen Absender hat.
        if s.mail_sandbox:
            log.info(
                "mail_sandbox_send",
                to=recipients,
                subject=msg.subject,
                message_id=message_id,
            )
            return message_id

        try:
            self._deliver(email, recipients)
        except (smtplib.SMTPException, OSError) as exc:
            # W5: spezifisch fangen und als MailError re-raisen — nicht als
            # „gesendet" durchwinken. OSError deckt Netzwerk-/TLS-Fehler ab.
            log.warning(
                "mail_send_failed",
                to=recipients,
                subject=msg.subject,
                error=str(exc),
            )
            raise MailError(f"E-Mail-Versand fehlgeschlagen: {exc}") from exc

        log.info(
            "mail_sent", to=recipients, subject=msg.subject, message_id=message_id
        )
        return message_id

    def _deliver(self, email: EmailMessage, recipients: list[str]) -> None:
        """Öffnet die SMTP-Verbindung (STARTTLS oder implizites TLS), authentifiziert
        und schickt. Getrennt, damit send() testbar bleibt (Mock auf _deliver)."""
        s = self._settings
        context = ssl.create_default_context()
        if s.smtp_starttls:
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=30) as server:
                server.starttls(context=context)
                self._authenticate(server)
                server.send_message(email, to_addrs=recipients)
        else:
            with smtplib.SMTP_SSL(
                s.smtp_host, s.smtp_port, timeout=30, context=context
            ) as server:
                self._authenticate(server)
                server.send_message(email, to_addrs=recipients)

    def _authenticate(self, server: smtplib.SMTP) -> None:
        """Login nur, wenn Zugangsdaten hinterlegt sind. Ein leeres Passwort ist
        kein Login (der Mailcow-Server lehnt anonymes Submission ab → SMTPException,
        die send() korrekt als MailError meldet)."""
        s = self._settings
        password = s.smtp_password.get_secret_value()
        if s.smtp_user and password:
            server.login(s.smtp_user, password)


