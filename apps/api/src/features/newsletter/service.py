"""Voranmeldungen der Marketing-Seite (Newsletter) mit Double-Opt-in.

Ablauf, bewusst in dieser Reihenfolge:

  1. Popup → `subscribe`: Adresse + Einwilligungs-Nachweis (Zeitpunkt, IP,
     User-Agent, Wortlaut) landen bei UNS in `newsletter_subscribers`, Status
     `pending`. Brevo sieht davon noch nichts — ein unbestätigter Kontakt gehört
     in keine Marketing-Liste.
  2. Bestätigungsmail über den eigenen Mailserver (`core.mail`) mit einem
     Einmal-Token; in der DB liegt nur dessen SHA-256.
  3. Klick auf den Link → `confirm`: Status `confirmed`, DANN erst wird der
     Kontakt an Brevo übergeben.
  4. Abmeldung über einen dauerhaften Token → `unsubscribe`: Status
     `unsubscribed` und bei Brevo auf die Sperrliste.

Warum eigenes Double-Opt-in statt Brevos DOI-Endpunkt: der bräuchte ein eigenes
Template je Sprache (wir haben 24) und würde den Einwilligungs-Nachweis nur bei
Brevo ablegen. Nachweispflichtig sind aber wir.

Antworten sind IMMER neutral formuliert: ob eine Adresse bereits eingetragen
ist, darf das Formular nicht verraten (E-Mail-Enumeration).
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

from postgrest.exceptions import APIError
from supabase import Client

from src.core.config import Settings, get_settings
from src.core.logging import get_logger, mask_email
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.mail_layout import Aktion, MailInhalt, mail_rendern
from src.core.mail_sprache import aufloesen
from src.core.mail_texte import text

from .brevo_client import BrevoClient, BrevoError, BrevoNotConfigured
from .schemas import ConfirmResponse, SubscribeRequest, SubscribeResponse

log = get_logger("nextdays.newsletter")

# Gültigkeit des Bestätigungslinks. Danach ist eine erneute Anmeldung nötig —
# das ist zumutbar und hält unbestätigte Adressen kurz.
_CONFIRM_TTL = timedelta(days=7)

# Frühestens nach dieser Zeit wird eine zweite Bestätigungsmail verschickt.
# Ohne Sperre könnte jemand über das öffentliche Formular fremde Postfächer
# fluten (jede Anfrage erzeugt sonst eine Mail).
_RESEND_COOLDOWN = timedelta(minutes=10)

# Wie viele offene Kontakte ein Nachlauf höchstens überträgt (Wurzel 8).
_RESYNC_MAX = 100

# Neutrale Antwort — bei JEDEM Ausgang von subscribe dieselbe.
_NEUTRAL = (
    "Wenn die Adresse gültig ist, liegt gleich eine Bestätigungsmail im "
    "Postfach. Bitte den Link darin anklicken."
)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class NewsletterError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NewsletterService:
    def __init__(
        self,
        db: Client,
        settings: Settings | None = None,
        mail: MailService | None = None,
        brevo: BrevoClient | None = None,
    ) -> None:
        self._db = db
        self._settings = settings or get_settings()
        self._mail = mail or MailService(self._settings)
        self._brevo = brevo or BrevoClient(self._settings)

    # -- Eintragen ------------------------------------------------------------

    def subscribe(
        self,
        req: SubscribeRequest,
        *,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> SubscribeResponse:
        """Adresse vormerken und Bestätigungsmail auslösen (idempotent)."""
        email = str(req.email).strip().lower()
        basis = self._marketing_basis()  # früh prüfen: ohne Ziel kein Link
        jetzt = datetime.now(UTC)

        zeile = self._by_email(email)
        if zeile and zeile.get("status") == "confirmed":
            # Bereits bestätigt: nichts tun, nichts verraten.
            log.info("newsletter_subscribe_known", email=mask_email(email))
            return SubscribeResponse(detail=_NEUTRAL)

        if zeile and self._zu_frueh(zeile.get("confirm_sent_at"), jetzt):
            # Wiederholte Anfragen innerhalb der Sperrzeit: keine zweite Mail.
            return SubscribeResponse(detail=_NEUTRAL)

        token = secrets.token_urlsafe(32)
        felder: dict[str, Any] = {
            "email": email,
            "status": "pending",
            "locale": (req.locale or "").strip()[:10] or None,
            "source": (req.source or "").strip()[:50] or None,
            "consent_text": req.consent_text,
            "consent_ip": ip,
            "consent_user_agent": (user_agent or "")[:500] or None,
            "consent_at": jetzt.isoformat(),
            "confirm_token_hash": _hash(token),
            "confirm_expires_at": (jetzt + _CONFIRM_TTL).isoformat(),
            "confirm_sent_at": jetzt.isoformat(),
            # Re-Opt-in nach einer Abmeldung: die alten Endzeitpunkte gehören
            # zurückgesetzt, sonst steht die Zeile widersprüchlich da (Wurzel 1).
            "unsubscribed_at": None,
            "confirmed_at": None,
        }
        try:
            self._db.table("newsletter_subscribers").upsert(
                felder, on_conflict="email"
            ).execute()
        except APIError as exc:
            log.warning(
                "newsletter_subscribe_failed",
                email=mask_email(email),
                error=str(exc)[:200],
            )
            raise NewsletterError(
                "Anmeldung konnte nicht gespeichert werden.", status_code=502
            ) from exc

        self._sende_bestaetigung(email, token, req.locale, basis)
        log.info("newsletter_subscribe_pending", email=mask_email(email))
        return SubscribeResponse(detail=_NEUTRAL)

    # -- Bestätigen -----------------------------------------------------------

    def confirm(self, token: str) -> ConfirmResponse:
        """Double-Opt-in abschließen und den Kontakt an Brevo übergeben."""
        rows = (
            self._db.table("newsletter_subscribers")
            .select("id, email, status, locale, source, confirm_expires_at")
            .eq("confirm_token_hash", _hash(token))
            .limit(1)
            .execute()
        ).data or []
        zeile = rows[0] if rows else None
        if zeile is None or not self._gueltig(zeile.get("confirm_expires_at")):
            # Auch hier keine Unterscheidung: unbekannt, abgelaufen und schon
            # verbraucht sehen für den Aufrufer gleich aus.
            return ConfirmResponse(
                ok=False,
                detail="Dieser Bestätigungslink ist ungültig oder abgelaufen.",
            )

        jetzt = datetime.now(UTC)
        abmelde_token = secrets.token_urlsafe(32)
        self._db.table("newsletter_subscribers").update(
            {
                "status": "confirmed",
                "confirmed_at": jetzt.isoformat(),
                # Einmal-Token verbrauchen (Wurzel 2: ein zweiter Klick auf
                # denselben Link findet nichts mehr).
                "confirm_token_hash": None,
                "confirm_expires_at": None,
                "unsubscribe_token_hash": _hash(abmelde_token),
            }
        ).eq("id", zeile["id"]).execute()

        self._an_brevo(zeile["id"], zeile["email"], zeile.get("locale"), zeile.get("source"))
        log.info("newsletter_confirmed", email=mask_email(zeile["email"]))
        return ConfirmResponse(
            ok=True, detail="Danke — deine Anmeldung ist bestätigt."
        )

    # -- Abmelden -------------------------------------------------------------

    def unsubscribe(self, token: str) -> ConfirmResponse:
        """Abmelden. Der Token bleibt gültig (Link steht in jeder Mail)."""
        rows = (
            self._db.table("newsletter_subscribers")
            .select("id, email, status")
            .eq("unsubscribe_token_hash", _hash(token))
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return ConfirmResponse(
                ok=False, detail="Dieser Abmeldelink ist ungültig."
            )
        zeile = rows[0]
        if zeile.get("status") != "unsubscribed":
            self._db.table("newsletter_subscribers").update(
                {
                    "status": "unsubscribed",
                    "unsubscribed_at": datetime.now(UTC).isoformat(),
                }
            ).eq("id", zeile["id"]).execute()
            self._brevo_abmelden(zeile["id"], zeile["email"])
        log.info("newsletter_unsubscribed", email=mask_email(zeile["email"]))
        return ConfirmResponse(ok=True, detail="Du bist abgemeldet.")

    # -- Nachlauf (Cron) ------------------------------------------------------

    def resync_pending(self) -> dict[str, int]:
        """Bestätigte Kontakte nachtragen, die Brevo noch nicht kennt.

        Nötig, weil der Abgleich beim Bestätigen best-effort ist: fehlte der
        API-Schlüssel oder war die Server-IP bei Brevo nicht freigegeben, steht
        die Zeile mit `brevo_synced_at IS NULL` da — sichtbar, nicht verloren.
        """
        rows = (
            self._db.table("newsletter_subscribers")
            .select("id, email, locale, source")
            .eq("status", "confirmed")
            .is_("brevo_synced_at", "null")
            .limit(_RESYNC_MAX)
            .execute()
        ).data or []
        erfolgreich = 0
        for zeile in rows:
            if self._an_brevo(
                zeile["id"], zeile["email"], zeile.get("locale"), zeile.get("source")
            ):
                erfolgreich += 1
        return {"betrachtet": len(rows), "uebertragen": erfolgreich}

    # -- intern ---------------------------------------------------------------

    def _by_email(self, email: str) -> dict[str, Any] | None:
        rows = (
            self._db.table("newsletter_subscribers")
            .select("id, email, status, confirm_sent_at")
            .eq("email", email)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _marketing_basis(self) -> str:
        """Öffentliche Adresse der Marketing-Seite (Ziel der Links).

        Ohne sie gibt es keinen sinnvollen Bestätigungslink — das ist ein
        Konfigurationsfehler und wird als solcher gemeldet, statt eine URL zu
        raten (Wurzel 4).
        """
        basis = (self._settings.marketing_base_url or "").rstrip("/")
        if not basis:
            raise NewsletterError(
                "MARKETING_BASE_URL ist nicht konfiguriert.", status_code=500
            )
        return basis

    def _sende_bestaetigung(
        self, email: str, token: str, locale: str | None, basis: str
    ) -> None:
        """Bestätigungsmail über den eigenen Mailserver verschicken.

        Scheitert der Versand, ist die Anmeldung NICHT gültig zustande gekommen —
        deshalb ein echter Fehler (502) statt einer stillen Erfolgsmeldung
        (Wurzel 5). Die Zeile bleibt `pending`; ein erneuter Versuch nach der
        Sperrzeit erzeugt einen frischen Token.
        """
        # Die Sprache kommt aus dem Anmelde-Popup. `aufloesen` kappt die
        # Regionsvariante (`de-AT` → `de`) und endet bei Englisch — NICHT bei
        # Deutsch: das alte `(locale or "de")` behauptete von jedem Anmelder
        # ohne Sprachangabe, er sei deutschsprachig (Wurzel 4). Eine zweite
        # Kettenstufe gibt es hier nicht: der Anmelder ist noch niemandes
        # Nutzer, es gibt keinen Betrieb, dessen Sprache greifen könnte.
        sprache = aufloesen(locale)
        betreff = text("newsletter.bestaetigung.betreff", sprache)
        link = f"{basis}/newsletter/bestaetigen?token={quote(token, safe='')}"
        # Die Absaetze stehen einzeln im gemeinsamen Katalog (`mail_texte`).
        # Vorher lagen sie als zweiter, eigener 24-Sprachen-Katalog in diesem
        # Modul, aus dem der Fliesstext per `split("\n\n")` wieder zerlegt
        # wurde — eine Formatierungsregel, die bei jeder Katalogpflege bricht.
        absaetze = [
            text(f"newsletter.bestaetigung.absatz_{i}", sprache)
            for i in (1, 2, 3)
        ]
        mail = mail_rendern(
            MailInhalt(
                titel=betreff,
                absaetze=absaetze,
                aktion=Aktion(text=betreff, url=link),
                sprache=sprache,
                # KEIN Abmeldelink: dies ist die BESTAETIGUNGSMAIL des
                # Double-Opt-in. Zu diesem Zeitpunkt gibt es noch gar keine
                # Anmeldung, von der man sich abmelden koennte — der
                # Abmelde-Token entsteht erst beim Bestaetigen (`confirm`).
                # Wer nicht bestaetigt, ist automatisch nicht angemeldet; ein
                # Abmeldelink hier waere ein Weg ins Leere. Er gehoert an die
                # spaeteren Kampagnenmails, die ueber Brevo laufen.
                abmelde_url=None,
            ),
            settings=self._settings,
        )
        try:
            self._mail.send(
                OutboundMessage(
                    to=email,
                    subject=betreff,
                    text=mail.text,
                    html=mail.html,
                    inline_bilder=mail.inline_bilder,
                )
            )
        except MailError as exc:
            log.error(
                "newsletter_confirm_mail_failed",
                email=mask_email(email),
                error=exc.message,
            )
            raise NewsletterError(
                "Bestätigungsmail konnte nicht versendet werden.", status_code=502
            ) from exc

    def _an_brevo(
        self, row_id: str, email: str, locale: str | None, source: str | None
    ) -> bool:
        """Kontakt an Brevo übergeben und das Ergebnis EHRLICH festhalten.

        Der Rückgabewert sagt, ob der Abgleich geklappt hat. Fehler kippen die
        Bestätigung nicht (die Einwilligung liegt bei uns), werden aber in
        `brevo_last_error` sichtbar abgelegt — nie stillschweigend geschluckt.
        """
        try:
            contact_id = self._brevo.upsert_contact(
                email,
                attributes={
                    "QUELLE": source,
                    "SPRACHE": (locale or "").split("-")[0] or None,
                },
            )
        except (BrevoNotConfigured, BrevoError) as exc:
            self._db.table("newsletter_subscribers").update(
                {"brevo_last_error": exc.message[:500]}
            ).eq("id", row_id).execute()
            log.warning(
                "newsletter_brevo_sync_failed",
                email=mask_email(email),
                error=exc.message[:200],
            )
            return False

        self._db.table("newsletter_subscribers").update(
            {
                "brevo_contact_id": contact_id,
                "brevo_synced_at": datetime.now(UTC).isoformat(),
                "brevo_last_error": None,
            }
        ).eq("id", row_id).execute()
        return True

    def _brevo_abmelden(self, row_id: str, email: str) -> None:
        """Abmeldung an Brevo weitergeben (best effort, Ergebnis festhalten)."""
        try:
            self._brevo.blacklist_contact(email)
        except (BrevoNotConfigured, BrevoError) as exc:
            self._db.table("newsletter_subscribers").update(
                {"brevo_last_error": exc.message[:500]}
            ).eq("id", row_id).execute()
            log.warning(
                "newsletter_brevo_unsubscribe_failed",
                email=mask_email(email),
                error=exc.message[:200],
            )

    @staticmethod
    def _zu_frueh(gesendet_am: str | None, jetzt: datetime) -> bool:
        """True, solange die Wiederholsperre für die Bestätigungsmail läuft."""
        if not gesendet_am:
            return False
        try:
            zeitpunkt = datetime.fromisoformat(gesendet_am)
        except ValueError:
            return False
        if zeitpunkt.tzinfo is None:
            zeitpunkt = zeitpunkt.replace(tzinfo=UTC)
        return jetzt - zeitpunkt < _RESEND_COOLDOWN

    @staticmethod
    def _gueltig(ablauf: str | None) -> bool:
        """True, solange der Bestätigungslink gilt (fail-closed)."""
        if not ablauf:
            return False
        try:
            ende = datetime.fromisoformat(ablauf)
        except ValueError:
            return False
        if ende.tzinfo is None:
            ende = ende.replace(tzinfo=UTC)
        return ende > datetime.now(UTC)
