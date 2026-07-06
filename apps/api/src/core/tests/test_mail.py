"""Tests für core/mail.py (SMTP-Versand über den eigenen Mailcow-Server).

Deckt die Wurzeln ab: W4 (fehlende Konfig → Fehler, kein stiller Erfolg, kein
erfundener Absender), W5 (SMTP-Fehler wird als MailError re-raised, nie als
„gesendet" durchgewunken). Kein echter Netzwerk-Call: _deliver wird gemockt bzw.
der Sandbox-Modus genutzt.
"""
from unittest.mock import MagicMock

import pytest
from pydantic import SecretStr

from src.core.config import Settings
from src.core.mail import MailError, MailService, OutboundMessage


def _settings(**over: object) -> Settings:
    base: dict[str, object] = {
        "smtp_host": "mail.mynextdays.dk",
        "smtp_port": 587,
        "smtp_user": "developer@mynextdays.dk",
        "smtp_password": SecretStr("geheim"),
        "smtp_from_address": "noreply@mynextdays.dk",
        "smtp_from_name": "myNextDays",
        "smtp_starttls": True,
        "mail_sandbox": False,
    }
    base.update(over)
    return Settings(**base)  # type: ignore[arg-type]


def _msg(**over: object) -> OutboundMessage:
    base: dict[str, object] = {
        "to": "gast@example.com",
        "subject": "Ihre Rechnung",
        "text": "Anbei Ihre Rechnung.",
    }
    base.update(over)
    return OutboundMessage(**base)  # type: ignore[arg-type]


# --- W4: keine Fallbacks, fail-closed bei fehlender Konfig ------------------


def test_send_without_host_raises_503() -> None:
    svc = MailService(_settings(smtp_host=""))
    with pytest.raises(MailError) as exc:
        svc.send(_msg())
    assert exc.value.status_code == 503


def test_send_without_from_address_raises_503() -> None:
    svc = MailService(_settings(smtp_from_address=""))
    with pytest.raises(MailError) as exc:
        svc.send(_msg())
    assert exc.value.status_code == 503


def test_mail_configured_needs_host_and_from() -> None:
    assert _settings().mail_configured is True
    assert _settings(smtp_host="").mail_configured is False
    assert _settings(smtp_from_address="").mail_configured is False


def test_empty_recipient_raises_422() -> None:
    svc = MailService(_settings())
    with pytest.raises(MailError) as exc:
        svc.send(_msg(to="   "))
    assert exc.value.status_code == 422


# --- Sandbox: loggt statt sendet -------------------------------------------


def test_sandbox_does_not_call_smtp() -> None:
    svc = MailService(_settings(mail_sandbox=True))
    svc._deliver = MagicMock()  # type: ignore[method-assign]
    mid = svc.send(_msg())
    svc._deliver.assert_not_called()
    assert mid.startswith("<") and "mynextdays.dk" in mid


# --- W5: SMTP-Fehler wird als MailError re-raised, nie verschluckt ----------


def test_smtp_failure_becomes_mailerror() -> None:
    import smtplib

    svc = MailService(_settings())
    svc._deliver = MagicMock(  # type: ignore[method-assign]
        side_effect=smtplib.SMTPAuthenticationError(535, b"bad creds")
    )
    with pytest.raises(MailError):
        svc.send(_msg())


def test_network_error_becomes_mailerror() -> None:
    svc = MailService(_settings())
    svc._deliver = MagicMock(  # type: ignore[method-assign]
        side_effect=OSError("connection refused")
    )
    with pytest.raises(MailError):
        svc.send(_msg())


# --- Erfolg: From/To/Subject korrekt, Message-ID zurück --------------------


def test_successful_send_returns_message_id() -> None:
    svc = MailService(_settings())
    captured: dict[str, object] = {}

    def fake_deliver(email: object, recipients: list[str]) -> None:
        captured["email"] = email
        captured["recipients"] = recipients

    svc._deliver = fake_deliver  # type: ignore[method-assign]
    mid = svc.send(_msg(to=["a@x.de", "b@x.de"]))
    assert mid.startswith("<")
    assert captured["recipients"] == ["a@x.de", "b@x.de"]
    email = captured["email"]
    assert email["Subject"] == "Ihre Rechnung"  # type: ignore[index]
    assert "noreply@mynextdays.dk" in email["From"]  # type: ignore[index]


def test_html_alternative_is_attached() -> None:
    svc = MailService(_settings())
    built = svc._build(_msg(html="<p>Hallo</p>"))
    assert built.is_multipart()


def test_reply_to_header_set() -> None:
    svc = MailService(_settings())
    built = svc._build(_msg(reply_to="support@mynextdays.dk"))
    assert built["Reply-To"] == "support@mynextdays.dk"
