"""Tests für core/mail.py (SMTP-Versand über den eigenen Mailcow-Server).

Deckt die Wurzeln ab: W4 (fehlende Konfig → Fehler, kein stiller Erfolg, kein
erfundener Absender), W5 (SMTP-Fehler wird als MailError re-raised, nie als
„gesendet" durchgewunken). Kein echter Netzwerk-Call: _deliver wird gemockt bzw.
der Sandbox-Modus genutzt.
"""
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from pydantic import SecretStr

from src.core.config import Settings
from src.core.mail import MailError, MailService, OutboundMessage


def _settings(**over: object) -> Settings:
    base: dict[str, object] = {
        "smtp_host": "mail.mynextdays.dk",
        "smtp_port": 587,
        # Login und sichtbarer Absender sind bewusst DIESELBE Adresse — siehe
        # deploy/mail/README.md, Abschnitt „Absenderadresse": ein `noreply@`
        # sammelt keine Antworten, was den Reputationsaufbau bremst, und zwei
        # verschiedene Absender verteilen ihn auf zwei Identitäten.
        "smtp_user": "info@mynextdays.dk",
        "smtp_password": SecretStr("geheim"),
        "smtp_from_address": "info@mynextdays.dk",
        "smtp_from_name": "myNextDays",
        "smtp_starttls": True,
        # Der Sandbox-Riegel greift lokal von selbst (app_env-Default "local").
        # Die Versand-Tests wollen aber den ECHTEN Pfad prüfen, darum hier
        # ausdrücklich aufheben — der Netzwerk-Call ist per Mock auf _deliver aus.
        "mail_sandbox_override": False,
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
    svc = MailService(_settings(mail_sandbox_override=True))
    svc._deliver = MagicMock()  # type: ignore[method-assign]
    mid = svc.send(_msg())
    svc._deliver.assert_not_called()
    assert mid.startswith("<") and "mynextdays.dk" in mid


def test_sandbox_greift_lokal_ohne_zutun() -> None:
    """Der eigentliche Riegel: auf dem Entwicklerrechner ist die Sandbox an, auch
    wenn niemand `MAIL_SANDBOX_OVERRIDE` setzt und echte SMTP-Daten in der .env
    stehen. Genau diese Lücke hat 70 Mails an Fixture-Adressen real versendet."""
    s = _settings(mail_sandbox_override=None, app_env="local")
    assert s.mail_sandbox is True
    svc = MailService(s)
    svc._deliver = MagicMock()  # type: ignore[method-assign]
    svc.send(_msg())
    svc._deliver.assert_not_called()


def test_produktion_versendet_echt() -> None:
    """Gegenprobe: ausserhalb von `local` bleibt der Versand real — der Riegel
    darf die Produktion nicht stillegen."""
    assert _settings(mail_sandbox_override=None, app_env="production").mail_sandbox is False


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
    assert "info@mynextdays.dk" in email["From"]  # type: ignore[index]


def test_html_alternative_is_attached() -> None:
    svc = MailService(_settings())
    built = svc._build(_msg(html="<p>Hallo</p>"))
    assert built.is_multipart()


def test_reply_to_header_set() -> None:
    svc = MailService(_settings())
    built = svc._build(_msg(reply_to="support@mynextdays.dk"))
    assert built["Reply-To"] == "support@mynextdays.dk"


# --- Zustellbarkeits-Header -------------------------------------------------


def test_date_header_gesetzt() -> None:
    """`Date` ist RFC-5322-Pflicht — es fehlte, rspamd gab dafür MISSING_DATE.

    Weder Python noch unser Postfix (`always_add_missing_headers = no`)
    ergänzen den Header; ohne diese Zeile geht jede Mail ohne Datum raus.
    """
    svc = MailService(_settings())
    built = svc._build(_msg())
    assert built["Date"]
    # Ein RFC-5322-Datum trägt Wochentag und Zeitzonen-Offset.
    assert "," in built["Date"]
    assert "+" in built["Date"] or "-" in built["Date"]


def test_x_mailer_gesetzt() -> None:
    """Ohne Absenderhinweis wertet rspamd die Mail als Skript (MISSING_XM_UA)."""
    svc = MailService(_settings())
    assert svc._build(_msg())["X-Mailer"] == "myNextDays"


def test_transaktionsmail_ist_auto_generated_ohne_abmeldeweg() -> None:
    """Von einer Reset-Mail kann sich niemand abmelden — kein List-Unsubscribe.

    Stattdessen `Auto-Submitted`, das Abwesenheitsnotizen unterdrückt (RFC 3834).
    """
    built = MailService(_settings())._build(_msg())
    assert built["Auto-Submitted"] == "auto-generated"
    assert built["List-Unsubscribe"] is None


def test_inline_bild_wird_als_related_teil_eingebettet() -> None:
    """Das Logo muss IM HTML-Teil haengen, sonst bleibt der Rahmen leer.

    Live belegt am 08.08.2026: eine URL-Einbindung ergab in Apple Mail nur den
    Alt-Text. Ein Anhang auf oberster Ebene waere ebenfalls falsch — er
    erschiene als Dateianhang, und `cid:` im Rumpf liefe weiter ins Leere.
    """
    logo = Path(__file__).resolve().parents[5] / (
        "marketing/public/marketing/brand/mnd_lockup_negativ_mail.png"
    )
    assert logo.is_file(), "Logodatei fehlt — Testvoraussetzung"

    built = MailService(_settings())._build(
        _msg(
            html='<p><img src="cid:nd-logo"></p>',
            inline_bilder={"nd-logo": logo},
        )
    )
    teile = [t.get_content_type() for t in built.walk()]
    assert "multipart/related" in teile
    assert "image/png" in teile
    bild = next(t for t in built.walk() if t.get_content_type() == "image/png")
    assert bild["Content-ID"] == "<nd-logo>"
    assert bild.get_content_disposition() == "inline"
    assert len(bild.get_payload(decode=True)) == logo.stat().st_size


def test_fehlendes_inline_bild_kippt_die_mail_nicht() -> None:
    """Ein fehlendes Logo darf keinen Passwort-Reset blockieren (fail-soft)."""
    built = MailService(_settings())._build(
        _msg(
            html="<p><img src='cid:nd-logo'></p>",
            inline_bilder={"nd-logo": Path("/gibt/es/nicht.png")},
        )
    )
    assert "text/html" in [t.get_content_type() for t in built.walk()]
    assert "image/png" not in [t.get_content_type() for t in built.walk()]


def test_marketingmail_traegt_ein_klick_abmeldung() -> None:
    """Mit Abmeldeweg gilt die Mail als Marketing → RFC 8058."""
    built = MailService(_settings())._build(
        _msg(unsubscribe_url="https://www.mynextdays.com/abmelden?t=x")
    )
    assert built["List-Unsubscribe"] == "<https://www.mynextdays.com/abmelden?t=x>"
    assert built["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    # Marketing ist keine Auto-Antwort auf eine Handlung des Empfängers.
    assert built["Auto-Submitted"] is None
