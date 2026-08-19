"""Kontaktformular (0414) — geprüft wird der Schutz, nicht das Formular.

Der Endpunkt ist öffentlich und löst mit jedem Aufruf einen Seiteneffekt aus
(Mail an uns, Bewertung bei Google). Deshalb stehen hier die Angriffe:

  • Thema bestimmt das Postfach — der Absender darf KEIN Ziel wählen können.
  • Captcha durchgefallen / abgelaufen / nicht prüfbar → keine Mail.
  • Honigtopf gefüllt → keine Mail, aber dieselbe Antwort wie im Erfolgsfall.
  • Mailversand scheitert → NICHT als „erhalten" melden.
  • Postfach nicht konfiguriert → 503, kein Rückfall auf das andere Postfach.
  • Freitext mit HTML → escaped in der Mail, keine Injektion.
"""
from __future__ import annotations

from typing import Any

import pytest

from src.core.captcha import CaptchaError
from src.core.config import Settings
from src.core.mail import MailError, OutboundMessage
from src.features.contact.schemas import KontaktAnfrage, KontaktThema
from src.features.contact.service import NEUTRAL, ContactService, KontaktError
from src.features.contact.themen import (
    BEZEICHNUNG,
    EMPFAENGERART,
    Empfaengerart,
    EmpfaengerFehlt,
    empfaenger_fuer,
)

_INFO = "info@mynextdays.dk"
_DEV = "developer@mynextdays.dk"


class _MailStub:
    """Merkt sich die versandten Nachrichten; wirft auf Wunsch."""

    def __init__(self, fehler: MailError | None = None) -> None:
        self.gesendet: list[OutboundMessage] = []
        self._fehler = fehler

    def send(self, msg: OutboundMessage) -> str:
        if self._fehler:
            raise self._fehler
        self.gesendet.append(msg)
        return "<id@mynextdays.dk>"


class _CaptchaStub:
    """Gibt einen festen Score zurück oder wirft."""

    def __init__(self, score: float = 0.9, fehler: CaptchaError | None = None) -> None:
        self.score = score
        self._fehler = fehler
        self.aufrufe: list[dict[str, Any]] = []

    def pruefen(
        self,
        token: str | None,
        *,
        aktion: str,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> float:
        self.aufrufe.append(
            {"token": token, "aktion": aktion, "ip": ip, "user_agent": user_agent}
        )
        if self._fehler:
            raise self._fehler
        return self.score


def _settings(**over: Any) -> Settings:
    werte: dict[str, Any] = {
        "contact_recipient_general": _INFO,
        "contact_recipient_technical": _DEV,
        # Mail muss als konfiguriert gelten, sonst wirft MailService vor dem
        # Stub — hier wird aber nur der Stub benutzt.
        "smtp_host": "mail.example.dk",
        "smtp_from_address": "noreply@example.dk",
        "company_legal_name": "myNextDays ApS",
    }
    werte.update(over)
    return Settings(**werte)


def _anfrage(**over: Any) -> KontaktAnfrage:
    daten: dict[str, Any] = {
        "name": "Anna Absender",
        "email": "anna@example.dk",
        "thema": KontaktThema.ALLGEMEIN,
        "nachricht": "Ich habe eine Frage zu den Kanälen und dem Kalender.",
        "captcha_token": "tok",
    }
    daten.update(over)
    return KontaktAnfrage(**daten)


def _service(
    *,
    settings: Settings | None = None,
    mail: _MailStub | None = None,
    captcha: _CaptchaStub | None = None,
) -> tuple[ContactService, _MailStub, _CaptchaStub]:
    m = mail or _MailStub()
    c = captcha or _CaptchaStub()
    svc = ContactService(
        settings=settings or _settings(),
        mail=m,  # type: ignore[arg-type]
        captcha=c,  # type: ignore[arg-type]
    )
    return svc, m, c


# --- Zuordnung Thema → Postfach --------------------------------------------


def test_jedes_thema_hat_einen_empfaenger() -> None:
    """Kein Thema ohne Zuordnung — sonst KeyError im Live-Betrieb.

    Genau das ist der Grund, warum `EMPFAENGERART` ohne `.get(..., default)`
    gelesen wird: ein neues Thema soll HIER auffallen, nicht still im
    allgemeinen Postfach landen.
    """
    for thema in KontaktThema:
        assert thema in EMPFAENGERART
        assert thema in BEZEICHNUNG


@pytest.mark.parametrize(
    ("thema", "erwartet"),
    [
        (KontaktThema.ALLGEMEIN, _INFO),
        (KontaktThema.VERTRIEB, _INFO),
        (KontaktThema.ABRECHNUNG, _INFO),
        (KontaktThema.PRESSE, _INFO),
        (KontaktThema.PARTNER, _INFO),
        (KontaktThema.DATENSCHUTZ, _INFO),
        (KontaktThema.TECHNIK, _DEV),
        (KontaktThema.API, _DEV),
        (KontaktThema.SICHERHEIT, _DEV),
    ],
)
def test_empfaenger_je_thema(thema: KontaktThema, erwartet: str) -> None:
    """Allgemeines → info@, Technisches → developer@."""
    assert empfaenger_fuer(thema, _settings()) == erwartet


def test_technisches_thema_geht_an_developer() -> None:
    svc, mail, _ = _service()
    svc.senden(_anfrage(thema=KontaktThema.API))
    assert mail.gesendet[0].to == _DEV


def test_fehlendes_postfach_ist_503_ohne_ersatz() -> None:
    """Kein Rückfall auf das andere Postfach (Wurzel 4).

    Eine Sicherheitsmeldung im allgemeinen Posteingang wäre schlimmer als eine
    klar abgewiesene.
    """
    svc, mail, _ = _service(settings=_settings(contact_recipient_technical=""))
    with pytest.raises(KontaktError) as exc:
        svc.senden(_anfrage(thema=KontaktThema.SICHERHEIT))
    assert exc.value.status_code == 503
    assert not mail.gesendet
    # Das allgemeine Postfach steht — es darf trotzdem nicht einspringen.
    assert empfaenger_fuer(KontaktThema.ALLGEMEIN, _settings()) == _INFO


def test_empfaenger_fehlt_nennt_die_variable() -> None:
    """Die Meldung muss sagen, WAS fehlt — sonst sucht niemand den Fehler."""
    with pytest.raises(EmpfaengerFehlt, match="CONTACT_RECIPIENT_GENERAL"):
        empfaenger_fuer(
            KontaktThema.ALLGEMEIN, _settings(contact_recipient_general="")
        )


def test_technik_und_allgemein_sind_verschiedene_arten() -> None:
    assert (
        EMPFAENGERART[KontaktThema.SICHERHEIT] is Empfaengerart.TECHNIK
    )
    assert EMPFAENGERART[KontaktThema.PRESSE] is Empfaengerart.ALLGEMEIN


# --- Spamschutz -------------------------------------------------------------


def test_honigtopf_sendet_nichts_und_antwortet_gleich() -> None:
    """Der Bot darf nicht merken, dass er erkannt wurde.

    Deshalb dieselbe Antwort wie im Erfolgsfall — und kein Captcha-Aufruf, der
    Kontingent kostet.
    """
    svc, mail, captcha = _service()
    antwort = svc.senden(_anfrage(website="https://spam.example"))
    assert antwort == NEUTRAL
    assert not mail.gesendet
    assert not captcha.aufrufe


def test_captcha_wird_mit_aktion_und_ip_geprueft() -> None:
    svc, _, captcha = _service()
    svc.senden(_anfrage(), ip="203.0.113.7", user_agent="Mozilla/5.0")
    assert captcha.aufrufe == [
        {
            "token": "tok",
            "aktion": "kontakt",
            "ip": "203.0.113.7",
            "user_agent": "Mozilla/5.0",
        }
    ]


def test_captcha_durchgefallen_sendet_nichts() -> None:
    svc, mail, _ = _service(
        captcha=_CaptchaStub(fehler=CaptchaError("Bot.", status_code=403))
    )
    with pytest.raises(KontaktError) as exc:
        svc.senden(_anfrage())
    assert exc.value.status_code == 403
    assert not mail.gesendet


def test_captcha_nicht_pruefbar_ist_502_nicht_403() -> None:
    """„Wir können nicht prüfen" ist eine andere Aussage als „durchgefallen".

    Der Statuscode wird deshalb durchgereicht und nicht umgedeutet — sonst sucht
    der Betrieb den Fehler beim Besucher.
    """
    svc, mail, _ = _service(
        captcha=_CaptchaStub(
            fehler=CaptchaError("Nicht erreichbar.", status_code=502)
        )
    )
    with pytest.raises(KontaktError) as exc:
        svc.senden(_anfrage())
    assert exc.value.status_code == 502
    assert not mail.gesendet


def test_captcha_laeuft_vor_dem_empfaenger_nachschlag() -> None:
    """Ein Bot soll nicht durch Ausprobieren erfahren, was konfiguriert ist."""
    svc, mail, _ = _service(
        settings=_settings(contact_recipient_technical=""),
        captcha=_CaptchaStub(fehler=CaptchaError("Bot.", status_code=403)),
    )
    with pytest.raises(KontaktError) as exc:
        svc.senden(_anfrage(thema=KontaktThema.SICHERHEIT))
    # 403 (Captcha), nicht 503 (Konfiguration) — die Reihenfolge stimmt.
    assert exc.value.status_code == 403
    assert not mail.gesendet


# --- Versand ----------------------------------------------------------------


def test_mailfehler_wird_nicht_als_erhalten_gemeldet() -> None:
    """Wurzel 5: kein stiller Erfolg.

    Wer „erhalten" liest, wartet auf eine Antwort. Kam die Mail nie an, wartet
    er vergeblich.
    """
    svc, _, _ = _service(mail=_MailStub(fehler=MailError("SMTP tot")))
    with pytest.raises(KontaktError) as exc:
        svc.senden(_anfrage())
    assert exc.value.status_code == 502


def test_reply_to_ist_der_besucher() -> None:
    """Die Antwort-Taste im Postfach muss beim Besucher landen, nicht bei uns."""
    svc, mail, _ = _service()
    svc.senden(_anfrage(email="gast@example.dk"))
    assert mail.gesendet[0].reply_to == "gast@example.dk"


def test_betreff_nennt_anliegen_und_namen() -> None:
    svc, mail, _ = _service()
    svc.senden(_anfrage(thema=KontaktThema.PRESSE, name="Redaktion Nord"))
    betreff = mail.gesendet[0].subject
    assert betreff.startswith("[Kontakt] ")
    assert BEZEICHNUNG[KontaktThema.PRESSE] in betreff
    assert "Redaktion Nord" in betreff


def test_angaben_stehen_in_der_mail() -> None:
    svc, mail, _ = _service()
    svc.senden(
        _anfrage(
            firma="Nordlicht Ferien",
            telefon="+45 12 34 56 78",
            locale="da",
            nachricht="Erste Zeile.\n\nZweite Zeile mit Frage.",
        )
    )
    text = mail.gesendet[0].text
    for teil in (
        "Anna Absender",
        "anna@example.dk",
        "Nordlicht Ferien",
        "+45 12 34 56 78",
        "da",
        "Erste Zeile.",
        "Zweite Zeile mit Frage.",
    ):
        assert teil in text


def test_leere_optionale_felder_erscheinen_nicht() -> None:
    """Keine Zeile „Telefon:" ohne Nummer — das sähe wie eine Angabe aus."""
    svc, mail, _ = _service()
    svc.senden(_anfrage())
    text = mail.gesendet[0].text
    assert "Telefon:" not in text
    assert "Betrieb:" not in text
    assert "Sprache der Anfrage:" not in text


def test_html_im_freitext_wird_escaped() -> None:
    """Wurzel 8: der Freitext eines Fremden darf kein Markup in die Mail bringen."""
    svc, mail, _ = _service()
    svc.senden(
        _anfrage(
            name="<script>alert(1)</script>",
            nachricht="<img src=x onerror=alert(1)> und noch etwas Text dazu",
        )
    )
    html = mail.gesendet[0].html or ""
    assert "<script>" not in html
    assert "<img src=x" not in html
    assert "&lt;script&gt;" in html


def test_mehrzeilige_nachricht_wird_zu_mehreren_absaetzen() -> None:
    """Sonst fällt der Umbruch im HTML zusammen und alles wird eine Textwurst."""
    svc, mail, _ = _service()
    svc.senden(_anfrage(nachricht="Zeile eins hier.\nZeile zwei hier auch."))
    html = mail.gesendet[0].html or ""
    assert "Zeile eins hier." in html
    assert "Zeile zwei hier auch." in html
    # Beide Zeilen stehen in EIGENEN Absätzen.
    assert html.count("Zeile eins hier.</p>") == 1
    assert html.count("Zeile zwei hier auch.</p>") == 1


# --- Schema -----------------------------------------------------------------


def test_nur_leerraum_ist_keine_nachricht() -> None:
    with pytest.raises(ValueError):
        _anfrage(nachricht=" " * 40)


def test_unbekanntes_thema_wird_abgewiesen() -> None:
    """Kein Default: ein Tippfehler im Thema ist 422, nicht „allgemein"."""
    with pytest.raises(ValueError):
        _anfrage(thema="marketingabteilung")


def test_zu_kurze_nachricht_wird_abgewiesen() -> None:
    with pytest.raises(ValueError):
        _anfrage(nachricht="hi")


def test_leere_optionale_felder_werden_none() -> None:
    """Das HTML-Formular schickt `""`, nicht `null`."""
    req = _anfrage(firma="", telefon="  ", website="")
    assert req.firma is None
    assert req.telefon is None
    assert req.website is None


def test_kein_zielfeld_im_schema() -> None:
    """Wurzel 3: das Formular darf kein Postfach benennen können.

    Gäbe es ein solches Feld, wäre der Endpunkt ein offenes Relay über unsere
    DKIM-signierte Domain.
    """
    felder = set(KontaktAnfrage.model_fields)
    assert not felder & {"to", "empfaenger", "an", "recipient", "mailto"}
