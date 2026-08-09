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

import mimetypes
import smtplib
import ssl
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from pathlib import Path

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
    """Eine zu versendende Nachricht. ``to`` ist eine oder mehrere Adressen.

    ``unsubscribe_url`` schaltet die Ein-Klick-Abmeldung (RFC 8058) frei und
    markiert die Nachricht damit als MARKETING. Transaktionsmails (Einladung,
    Passwort-Reset, Beleg) lassen das Feld leer: von ihnen kann sich niemand
    abmelden, und ein ``List-Unsubscribe`` an einer Passwort-Reset-Mail ist eine
    Zusage, die wir nicht einlösen können. Die beiden Ströme auseinanderzuhalten
    verlangt Apple ausdrücklich — sie teilen sich sonst eine Reputation, und ein
    abgemeldeter Newsletter-Empfänger zöge die Zustellung der Reset-Mails mit
    herunter.
    """

    to: str | list[str]
    subject: str
    text: str
    html: str | None = None
    reply_to: str | None = None
    unsubscribe_url: str | None = None
    # Bilder, die INNERHALB des HTML angezeigt werden (Logo): {cid: pfad}. Sie
    # werden als `inline`-Teile eingebettet, nicht als Dateianhang — der Client
    # zeigt sie im Rumpf und nicht als Büroklammer. Der Schlüssel ist die
    # Content-ID ohne spitze Klammern, auf die `src="cid:…"` verweist.
    inline_bilder: dict[str, Path] = field(default_factory=dict)

    @property
    def recipients(self) -> list[str]:
        addrs = [self.to] if isinstance(self.to, str) else list(self.to)
        cleaned = [a.strip() for a in addrs if a and a.strip()]
        if not cleaned:
            raise MailError("Keine Empfängeradresse angegeben.", status_code=422)
        return cleaned

    @property
    def ist_marketing(self) -> bool:
        """True, wenn ein Abmeldeweg mitgegeben wurde — dann ist es Marketing."""
        return bool(self.unsubscribe_url and self.unsubscribe_url.strip())


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
        # `Date` ist ein PFLICHTFELD nach RFC 5322 §3.6 — und es fehlte hier.
        # Live belegt an einer Testmail an iCloud: rspamd vergab `MISSING_DATE`
        # (+1.00), die Mail landete im Spam. Weder Python noch unser Postfix
        # ergänzen den Header: `EmailMessage` setzt ihn nicht von sich aus
        # (CPython-Issue 28879), und der Postfix läuft mit
        # `always_add_missing_headers = no`. Ohne diese Zeile geht jede Mail
        # ohne Datum raus.
        email["Date"] = formatdate(localtime=True)
        # Eindeutige Message-ID mit unserer Absenderdomain — hilft Zustellbarkeit
        # und macht Threads/Deduplizierung möglich.
        domain = s.smtp_from_address.rsplit("@", 1)[-1] or None
        email["Message-ID"] = make_msgid(domain=domain)
        if msg.reply_to:
            email["Reply-To"] = msg.reply_to
        # Ein fehlender `X-Mailer`/`User-Agent` ist für rspamd ein eigener
        # Verdachtspunkt (`MISSING_XM_UA` an derselben Testmail): Post ohne
        # jeden Absenderhinweis sieht nach Skript aus. Der Name benennt die
        # Software ehrlich — kein getarnter Client-String.
        email["X-Mailer"] = "myNextDays"
        if msg.ist_marketing:
            # MARKETING: Ein-Klick-Abmeldung nach RFC 8058. Gmail und Apple
            # verlangen sie bei Massenversand; ohne sie bleibt dem Empfänger
            # nur der Spam-Knopf, und genau der kostet Reputation.
            email["List-Unsubscribe"] = f"<{msg.unsubscribe_url}>"
            email["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
        else:
            # TRANSAKTIONAL: als automatisch erzeugt kennzeichnen (RFC 3834).
            # Das unterdrückt Abwesenheitsnotizen und Auto-Antworten — eine
            # „Bin im Urlaub"-Antwort auf eine Passwort-Reset-Mail ist Lärm.
            # Bewusst KEIN `List-Unsubscribe`: von einer Reset-Mail kann sich
            # niemand abmelden.
            email["Auto-Submitted"] = "auto-generated"
        email.set_content(msg.text)
        if msg.html:
            email.add_alternative(msg.html, subtype="html")
            self._bilder_einbetten(email, msg)
        return email

    @staticmethod
    def _bilder_einbetten(email: EmailMessage, msg: OutboundMessage) -> None:
        """Inline-Bilder (Logo) an den HTML-Teil hängen.

        Sie müssen an den HTML-TEIL, nicht an die Nachricht: nur dann entsteht
        ein `multipart/related`, in dem der Client die `cid:`-Verweise auflöst.
        Ein Anhang auf oberster Ebene erschiene stattdessen als Dateianhang und
        das Bild im Rumpf bliebe leer.

        Fehlt eine Datei oder ist sie unlesbar, wird sie ÜBERSPRUNGEN und die
        Mail geht ohne Bild raus (der `alt`-Text trägt dann die Marke). Ein
        fehlendes Logo darf keine Einladung und keinen Passwort-Reset
        verhindern — das wäre ein Schönheitsfehler, der einen Zugang blockiert.
        """
        if not msg.inline_bilder:
            return
        teil = email.get_payload()[-1]
        for cid, pfad in msg.inline_bilder.items():
            try:
                daten = Path(pfad).read_bytes()
            except OSError as exc:
                log.warning("mail_inline_bild_fehlt", cid=cid, error=str(exc))
                continue
            typ, _ = mimetypes.guess_type(str(pfad))
            haupt, _, unter = (typ or "image/png").partition("/")
            teil.add_related(
                daten,
                maintype=haupt,
                subtype=unter or "png",
                cid=f"<{cid}>",
                disposition="inline",
                filename=Path(pfad).name,
            )

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
