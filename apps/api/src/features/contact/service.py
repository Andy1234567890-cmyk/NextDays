"""Kontaktformular: prüfen, zuordnen, an das zuständige Postfach senden.

Der Slice hat KEINE Tabelle. Er nimmt eine Nachricht an, bewertet sie und
schickt sie über den eigenen Mailserver an uns — nichts wird gespeichert. Das ist
eine bewusste Entscheidung: eine Kontaktanfrage ist eine Mail, und eine zweite
Ablage, die niemand liest, wäre nur ein weiterer Ort mit personenbezogenen Daten.
Der Nachweis der Zustellung ist die Message-ID im Log.

Drei Stufen Spamschutz, von billig nach teuer:
  1. **Honigtopf** — ein Feld, das kein Mensch sieht. Gefüllt → freundliche
     Antwort, keine Mail, kein Google-Aufruf.
  2. **reCAPTCHA Enterprise** — serverseitige Bewertung des Tokens
     (`core.captcha`), fail-closed.
  3. **Rate-Limit** — Bucket `public_support` (20/60/IP) in der Middleware.

WOHIN DIE MAIL GEHT, entscheidet ausschließlich `themen.empfaenger_fuer`. Der
Absender kann kein Ziel angeben (Wurzel 3) — sonst wäre das Formular ein offenes
Relay über unsere DKIM-signierte Domain.

WARUM ES KEINE EINGANGSBESTÄTIGUNG AN DEN ABSENDER GIBT: Sie ginge an eine frei
eingetippte Adresse. Wer fremde Adressen einträgt, ließe unseren Mailserver damit
beliebige Postfächer anschreiben — dieselbe Überlegung, aus der Voranmeldung und
Löschantrag ein Double-Opt-in haben. Die Bestätigung steht deshalb auf der Seite,
nicht im fremden Postfach.
"""
from __future__ import annotations

from src.core.captcha import CaptchaError, CaptchaService
from src.core.config import Settings, get_settings
from src.core.logging import get_logger, mask_email
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.mail_layout import Aktion, MailInhalt, mail_rendern

from .schemas import KontaktAnfrage, KontaktThema
from .themen import BEZEICHNUNG, EmpfaengerFehlt, empfaenger_fuer

log = get_logger("nextdays.contact")

# Aktionsname des Captcha-Tokens. MUSS mit dem String im Formular
# (`lib/kontakt.ts`) übereinstimmen — Google prüft ihn gegen.
CAPTCHA_AKTION = "kontakt"

# Dieselbe Antwort für jeden Ausgang, den ein Absender nicht unterscheiden
# können soll: echte Zustellung und Honigtopf-Treffer.
NEUTRAL = (
    "Danke für die Nachricht. Wir haben sie erhalten und melden uns an "
    "die angegebene Adresse zurück."
)

# Sprache der INTERNEN Mail. Sie landet in unserem eigenen Postfach und ist keine
# Nachricht an den Besucher — deshalb bewusst eine feste Sprache und kein Gang
# über den 24-Sprachen-Katalog (`core.mail_texte`). Die Sprache, in der der
# Besucher geschrieben hat, steht IM Text.
INTERNE_SPRACHE = "de"


class KontaktError(Exception):
    """Anfrage nicht angenommen. `status_code` geht unverändert an den Router."""

    def __init__(self, message: str, *, status_code: int = 422) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ContactService:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        mail: MailService | None = None,
        captcha: CaptchaService | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._mail = mail or MailService(self._settings)
        self._captcha = captcha or CaptchaService(self._settings)

    def senden(
        self,
        req: KontaktAnfrage,
        *,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> str:
        """Nimmt die Anfrage an und gibt den Antworttext zurück.

        Reihenfolge ist bedeutungstragend: Honigtopf VOR dem Captcha (spart den
        Google-Aufruf), Captcha VOR dem Empfänger-Nachschlag (ein Bot soll nicht
        durch Ausprobieren erfahren, welche Themen konfiguriert sind), und der
        Versand ganz zuletzt — er ist der einzige Schritt mit Außenwirkung.
        """
        if req.website:
            # Treffer: kein Versand, keine Fehlermeldung. Der Bot bekommt genau
            # dieselbe Antwort wie ein Mensch, damit er nichts lernt.
            log.info(
                "kontakt_honigtopf",
                thema=req.thema.value,
                email=mask_email(str(req.email)),
            )
            return NEUTRAL

        try:
            score = self._captcha.pruefen(
                req.captcha_token,
                aktion=CAPTCHA_AKTION,
                ip=ip,
                user_agent=user_agent,
            )
        except CaptchaError as exc:
            # Durchgereicht, nicht umgedeutet: 403 (durchgefallen) und 502/503
            # (wir können nicht prüfen) sind verschiedene Aussagen.
            raise KontaktError(exc.message, status_code=exc.status_code) from exc

        try:
            empfaenger = empfaenger_fuer(req.thema, self._settings)
        except EmpfaengerFehlt as exc:
            log.error("kontakt_empfaenger_fehlt", thema=req.thema.value)
            raise KontaktError(str(exc), status_code=503) from exc

        message_id = self._versenden(req, empfaenger)
        log.info(
            "kontakt_gesendet",
            thema=req.thema.value,
            empfaenger=empfaenger,
            email=mask_email(str(req.email)),
            captcha_score=score,
            message_id=message_id,
        )
        return NEUTRAL

    # --- intern --------------------------------------------------------------

    def _versenden(self, req: KontaktAnfrage, empfaenger: str) -> str:
        """Baut die interne Mail und schickt sie. Scheitert der Versand → 502.

        Kein stiller Erfolg (Wurzel 5): eine Anfrage, die nie ankam, darf dem
        Besucher nicht als „erhalten" gemeldet werden — er wartet sonst auf eine
        Antwort, die niemand schreiben kann.
        """
        betreff = f"[Kontakt] {BEZEICHNUNG[req.thema]} — {req.name}"
        absender = str(req.email)

        mail = mail_rendern(
            MailInhalt(
                titel=betreff,
                # Jeder Absatz ist reiner Text; das Layout escapet ihn (Wurzel 8).
                # Ein Besucher, der `<script>` in die Nachricht tippt, erzeugt
                # hier Text, keine Injektion.
                absaetze=[
                    *self._kopfzeilen(req, absender),
                    *_absaetze(req.nachricht),
                ],
                # „Antworten" als mailto: Ein Klick im Postfach genügt. Das
                # Reply-To unten tut dasselbe für die Antwort-Taste des Clients;
                # beides steht da, weil manche Clients Reply-To ignorieren.
                aktion=Aktion(text="Antworten", url=f"mailto:{absender}"),
                hinweise=[
                    "Diese Nachricht kam über das Kontaktformular auf "
                    "www.mynextdays.com/kontakt. Die Antwort-Taste antwortet "
                    "direkt an die Adresse des Absenders.",
                ],
                sprache=INTERNE_SPRACHE,
                # Transaktionsmail an uns selbst — kein Abmeldeweg.
                abmelde_url=None,
            ),
            settings=self._settings,
        )

        try:
            return self._mail.send(
                OutboundMessage(
                    to=empfaenger,
                    subject=betreff,
                    text=mail.text,
                    html=mail.html,
                    # DAS ist der Kern: die Antwort geht an den Besucher, nicht
                    # an unser eigenes Absender-Postfach.
                    reply_to=absender,
                    inline_bilder=mail.inline_bilder,
                )
            )
        except MailError as exc:
            log.error(
                "kontakt_mail_fehlgeschlagen",
                thema=req.thema.value,
                empfaenger=empfaenger,
                error=exc.message,
            )
            raise KontaktError(
                "Die Nachricht konnte gerade nicht zugestellt werden. Bitte "
                "später erneut versuchen oder direkt eine E-Mail schreiben.",
                status_code=502,
            ) from exc

    @staticmethod
    def _kopfzeilen(req: KontaktAnfrage, absender: str) -> list[str]:
        """Die Absenderangaben, eine Zeile je Absatz.

        Optionale Felder erscheinen nur, wenn sie da sind — keine Zeile
        „Telefon: —", die aussieht wie eine Angabe (Wurzel 4).
        """
        zeilen = [f"Name: {req.name}", f"E-Mail: {absender}"]
        if req.firma:
            zeilen.append(f"Betrieb: {req.firma}")
        if req.telefon:
            zeilen.append(f"Telefon: {req.telefon}")
        zeilen.append(f"Anliegen: {BEZEICHNUNG[req.thema]}")
        if req.locale:
            zeilen.append(f"Sprache der Anfrage: {req.locale}")
        return zeilen


def _absaetze(nachricht: str) -> list[str]:
    """Freitext in Absätze zerlegen — je Zeile einer.

    Nötig, weil `mail_layout` jeden Absatz in ein `<p>` setzt und `\\n` in HTML
    zusammenfällt: eine dreizeilige Nachricht käme sonst als eine Textwurst an,
    während die Text-Fassung dieselbe Mail korrekt umgebrochen zeigt. Ein
    `<br>` einzusetzen ist hier nicht möglich (und wäre falsch) — der Layouter
    escapet bewusst ALLES, was ein Absender liefert.

    Leerzeilen fallen weg, weil das Layout den Abstand zwischen den Absätzen
    selbst setzt. Eine Nachricht, die nach dem Zerlegen leer wäre, kann es nicht
    geben: das Schema verlangt 20 Zeichen ohne Leerraum.
    """
    return [zeile.strip() for zeile in nachricht.splitlines() if zeile.strip()]


def themen_liste() -> list[str]:
    """Alle gültigen Themen — für die Selbstauskunft des Endpunkts."""
    return [t.value for t in KontaktThema]
