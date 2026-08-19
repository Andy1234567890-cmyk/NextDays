"""Löschantrag für ein Konto, gestellt über die öffentliche Marketing-Seite.

WARUM ES DIESEN WEG GEBEN MUSS: Google Play verlangt für jede App mit
Kontoanlage ZWEI Löschwege — einen in der App und einen im Web, der OHNE
installierte App und ohne Login funktioniert („Some users may have already
uninstalled your app"). Fehlt der Web-Weg, wird die App nicht veröffentlicht.

DER SCHUTZ IST DER KERN DIESES MODULS. Ein Formular, das auf eine eingetippte
Adresse hin einen Löschantrag anlegt, wäre ein Werkzeug gegen fremde Konten —
und an einem myNextDays-Konto hängt ein ganzer Betrieb (Buchungen, Rechnungen,
OTA-Verbindungen). Deshalb, in dieser Reihenfolge:

  1. `beantragen` speichert einen Antrag im Zustand `pending` und verschickt
     eine Bestätigungsmail an GENAU DIE genannte Adresse. Der Antrag hat in
     diesem Zustand keine Wirkung.
  2. Erst der Klick auf den Einmal-Link (`bestaetigen`) beweist, dass der
     Antragsteller dieses Postfach besitzt → `confirmed`.
  3. Gelöscht wird dann NICHT automatisch. Der bestätigte Antrag liegt dem
     Backoffice zur Prüfung vor (offene Zahlungen, Aufbewahrungsfristen).
     Google fordert ausdrücklich nur die Möglichkeit, die Löschung zu
     VERLANGEN; Lodgify deklariert im Play Store genau das.

Wer eine FREMDE Adresse einträgt, erreicht damit nur eines: der echte Inhaber
bekommt eine Mail und erfährt, dass jemand es versucht hat. Der Angriff wird
zur Warnung an das Opfer.

Die Antwort von `beantragen` ist IMMER dieselbe — ob zu einer Adresse ein Konto
existiert, darf das Formular nicht verraten (E-Mail-Enumeration würde sonst
offenlegen, welche Betriebe unsere Kunden sind).
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

from .schemas import (
    GRUND_MAX,
    BestaetigungResponse,
    LoeschantragRequest,
    LoeschantragResponse,
)

log = get_logger("nextdays.account_deletion")

TABELLE = "account_deletion_requests"

# Gültigkeit des Bestätigungslinks. Kürzer als beim Newsletter (7 Tage): ein
# Löschantrag ist eine folgenschwere Handlung, ein alter Link, der irgendwo im
# Postfach liegt, soll sie nicht Wochen später auslösen können.
CONFIRM_TTL = timedelta(hours=24)

# Frühestens nach dieser Zeit geht eine zweite Bestätigungsmail raus. Ohne diese
# Sperre wäre das öffentliche Formular ein Mailversender gegen fremde Postfächer.
RESEND_COOLDOWN = timedelta(minutes=15)

# Immer dieselbe Antwort, bei JEDEM Ausgang von `beantragen`.
NEUTRAL = (
    "Wenn zu dieser Adresse ein Konto besteht, haben wir eine E-Mail mit "
    "einem Bestätigungslink geschickt. Der Löschantrag wird erst nach dem "
    "Klick auf diesen Link bearbeitet."
)


class LoeschantragError(Exception):
    """Fehler mit HTTP-Status für den Router."""

    def __init__(self, detail: str, status_code: int = 400) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class AccountDeletionService:
    """Anträge annehmen und bestätigen. Löschen tut dieser Service NICHT."""

    def __init__(
        self,
        db: Client,
        mail: MailService | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._db = db
        self._settings = settings or get_settings()
        self._mail = mail or MailService(self._settings)

    # -- Antrag stellen -------------------------------------------------------

    def beantragen(
        self,
        req: LoeschantragRequest,
        *,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> LoeschantragResponse:
        """Antrag vormerken und Bestätigungsmail auslösen.

        Idempotent: mehrfaches Absenden erzeugt keinen zweiten Antrag und —
        innerhalb der Sperrzeit — keine zweite Mail (Wurzel 2).
        """
        email = str(req.email).strip().lower()
        basis = self._marketing_basis()  # früh prüfen: ohne Ziel kein Link
        jetzt = datetime.now(UTC)

        offen = self._offener_antrag(email)
        if offen and offen.get("status") == "confirmed":
            # Liegt schon bestätigt beim Backoffice — kein neuer Antrag, keine
            # Mail, und nach außen dieselbe neutrale Antwort.
            log.info("loeschantrag_bereits_bestaetigt", email=mask_email(email))
            return LoeschantragResponse(detail=NEUTRAL)

        if offen and self._zu_frueh(offen.get("confirm_sent_at"), jetzt):
            return LoeschantragResponse(detail=NEUTRAL)

        token = secrets.token_urlsafe(32)
        felder: dict[str, Any] = {
            "email": email,
            "status": "pending",
            "locale": (req.locale or "").strip()[:10] or None,
            "reason": (req.grund or "").strip()[:GRUND_MAX] or None,
            "requested_ip": ip,
            "requested_user_agent": (user_agent or "")[:500] or None,
            "requested_at": jetzt.isoformat(),
            "confirm_token_hash": _hash(token),
            "confirm_expires_at": (jetzt + CONFIRM_TTL).isoformat(),
            "confirm_sent_at": jetzt.isoformat(),
            # Ein neuer Antrag darf keine Reste eines alten tragen (Wurzel 1).
            "confirmed_at": None,
            "resolved_at": None,
            "resolved_by": None,
            "resolution_note": None,
        }

        try:
            if offen:
                self._db.table(TABELLE).update(felder).eq("id", offen["id"]).execute()
            else:
                self._db.table(TABELLE).insert(felder).execute()
        except APIError as exc:
            # 23505 = zwei Anträge gleichzeitig (Doppelklick). Der Teil-UNIQUE
            # in 0413 hat gegriffen; das ist kein Fehler des Antragstellers,
            # sondern der Beweis, dass genau ein Antrag existiert (Wurzel 2).
            if getattr(exc, "code", None) == "23505":
                log.info("loeschantrag_parallel", email=mask_email(email))
                return LoeschantragResponse(detail=NEUTRAL)
            log.warning(
                "loeschantrag_speichern_fehlgeschlagen",
                email=mask_email(email),
                error=str(exc)[:200],
            )
            raise LoeschantragError(
                "Antrag konnte nicht gespeichert werden.", status_code=502
            ) from exc

        self._sende_bestaetigung(email, token, req.locale, basis)
        log.info("loeschantrag_offen", email=mask_email(email))
        return LoeschantragResponse(detail=NEUTRAL)

    # -- Antrag bestätigen ----------------------------------------------------

    def bestaetigen(self, token: str) -> BestaetigungResponse:
        """Postfach-Besitz nachweisen und den Antrag dem Backoffice vorlegen."""
        rows = (
            self._db.table(TABELLE)
            .select("id, email, status, confirm_expires_at")
            .eq("confirm_token_hash", _hash(token))
            .limit(1)
            .execute()
        ).data or []
        zeile = rows[0] if rows else None

        if zeile is None or not self._gueltig(zeile.get("confirm_expires_at")):
            # Unbekannt, abgelaufen und schon verbraucht sehen für den Aufrufer
            # gleich aus — sonst wird der Link zum Prüfwerkzeug.
            raise LoeschantragError(
                "Dieser Link ist ungültig oder abgelaufen. Bitte stelle den "
                "Antrag erneut.",
                status_code=400,
            )

        if zeile.get("status") == "confirmed":
            # Zweiter Klick auf denselben Link: kein Fehler, aber auch keine
            # zweite Bestätigung (Wurzel 2).
            return BestaetigungResponse(
                detail="Dein Löschantrag liegt uns bereits vor.",
                bestaetigt=False,
            )

        jetzt = datetime.now(UTC)
        email = str(zeile.get("email") or "")
        treffer = self._konto_finden(email)

        try:
            self._db.table(TABELLE).update(
                {
                    "status": "confirmed",
                    "confirmed_at": jetzt.isoformat(),
                    # Token verbrauchen: der Link darf genau einmal wirken.
                    "confirm_token_hash": None,
                    "confirm_expires_at": None,
                    "matched_user_id": treffer.get("user_id"),
                    "matched_tenant_id": treffer.get("tenant_id"),
                }
            ).eq("id", zeile["id"]).eq("status", "pending").execute()
        except APIError as exc:
            log.warning(
                "loeschantrag_bestaetigen_fehlgeschlagen",
                error=str(exc)[:200],
            )
            raise LoeschantragError(
                "Bestätigung konnte nicht gespeichert werden.", status_code=502
            ) from exc

        log.info(
            "loeschantrag_bestaetigt",
            email=mask_email(email),
            konto_gefunden=bool(treffer.get("user_id")),
        )
        return BestaetigungResponse(
            detail=(
                "Danke — dein Löschantrag liegt uns vor. Wir prüfen ihn und "
                "melden uns per E-Mail. Das kann bis zu 30 Tage dauern."
            ),
            bestaetigt=True,
        )

    # -- Hilfen ---------------------------------------------------------------

    def _offener_antrag(self, email: str) -> dict[str, Any] | None:
        rows = (
            self._db.table(TABELLE)
            .select("id, status, confirm_sent_at")
            .eq("email", email)
            .in_("status", ["pending", "confirmed"])
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _konto_finden(self, email: str) -> dict[str, Any]:
        """Zugehöriges Konto suchen. Kein Treffer → beide Werte None.

        Ein fehlender Treffer ist kein Fehler und wird NICHT geraten: der
        Antrag wird dann im Backoffice mit Hinweis abgelehnt, statt still zu
        verschwinden (Wurzel 4).
        """
        try:
            rows = (
                self._db.table("users")
                .select("id, tenant_id")
                .eq("email", email)
                .limit(1)
                .execute()
            ).data or []
        except APIError as exc:  # noqa: BLE001 — Zuordnung ist best effort
            log.warning("loeschantrag_konto_suche_fehler", error=str(exc)[:200])
            return {"user_id": None, "tenant_id": None}
        if not rows:
            return {"user_id": None, "tenant_id": None}
        return {"user_id": rows[0].get("id"), "tenant_id": rows[0].get("tenant_id")}

    def _zu_frueh(self, zuletzt: str | None, jetzt: datetime) -> bool:
        if not zuletzt:
            return False
        try:
            gesendet = datetime.fromisoformat(str(zuletzt).replace("Z", "+00:00"))
        except ValueError:
            return False
        if gesendet.tzinfo is None:
            gesendet = gesendet.replace(tzinfo=UTC)
        return jetzt - gesendet < RESEND_COOLDOWN

    def _gueltig(self, bis: str | None) -> bool:
        if not bis:
            return False
        try:
            frist = datetime.fromisoformat(str(bis).replace("Z", "+00:00"))
        except ValueError:
            return False
        if frist.tzinfo is None:
            frist = frist.replace(tzinfo=UTC)
        return datetime.now(UTC) <= frist

    def _marketing_basis(self) -> str:
        """Basis-URL für den Bestätigungslink.

        Fehlt sie, ist das ein Konfigurationsfehler und kein Grund, eine Mail
        mit kaputtem Link zu verschicken (Wurzel 4/5).
        """
        basis = (getattr(self._settings, "marketing_base_url", "") or "").rstrip("/")
        if not basis:
            raise LoeschantragError(
                "Löschanträge sind gerade nicht möglich.", status_code=503
            )
        return basis

    def _sende_bestaetigung(
        self, email: str, token: str, locale: str | None, basis: str
    ) -> None:
        """Bestätigungsmail verschicken.

        Scheitert der Versand, ist der Antrag NICHT gültig gestellt — echter
        Fehler statt stiller Erfolgsmeldung (Wurzel 5). Die Zeile bleibt
        `pending`; ein neuer Versuch nach der Sperrzeit erzeugt einen frischen
        Token.
        """
        sprache = aufloesen(locale)
        betreff = text("konto_loeschung.bestaetigung.betreff", sprache)
        link = f"{basis}/konto-loeschen/bestaetigen?token={quote(token, safe='')}"
        absaetze = [
            text(f"konto_loeschung.bestaetigung.absatz_{i}", sprache)
            for i in (1, 2, 3)
        ]
        mail = mail_rendern(
            MailInhalt(
                titel=betreff,
                absaetze=absaetze,
                aktion=Aktion(text=text("konto_loeschung.bestaetigung.knopf", sprache), url=link),
                # Der wichtigste Satz der ganzen Mail: er verwandelt einen
                # missbräuchlichen Antrag in eine Warnung an den Inhaber.
                hinweise=[
                    text("konto_loeschung.bestaetigung.hinweis_frist", sprache),
                    text("konto_loeschung.bestaetigung.hinweis_nicht_ich", sprache),
                ],
                sprache=sprache,
            )
        )
        try:
            self._mail.send(
                OutboundMessage(
                    to=email,
                    subject=betreff,
                    text=mail.text,
                    html=mail.html,
                )
            )
        except MailError as exc:
            log.warning(
                "loeschantrag_mail_fehlgeschlagen",
                email=mask_email(email),
                error=str(exc)[:200],
            )
            raise LoeschantragError(
                "Bestätigungsmail konnte nicht verschickt werden. Bitte "
                "versuche es später erneut.",
                status_code=502,
            ) from exc
