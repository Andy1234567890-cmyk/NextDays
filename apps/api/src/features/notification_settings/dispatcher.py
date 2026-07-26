"""Versand mit Praeferenz-Pruefung — die EINE Stelle, die Benachrichtigungen sendet.

Ohne diese Schicht waeren die Schalter im Konto reine Dekoration: irgendjemand
ruft MailService/send_sms direkt auf, und die Praeferenz wird nie gefragt.
Darum gilt: Benachrichtigungen an Nutzer laufen ausschliesslich hier durch.

Ablauf je Kanal:
  1. Praeferenz fragen (NotificationSettingsService.soll_senden)
  2. Adresse/Nummer beschaffen (users-Zeile, tenant-gescopt)
  3. Senden — E-Mail ueber den eigenen Mailcow (core.mail), SMS ueber Twilio

Fehlerbild (Wurzel 5): Ein fehlgeschlagener Kanal darf den anderen nicht
kippen und den Aufrufer nicht zum Absturz bringen — Benachrichtigungen sind
Nebenpfad. Was NICHT passiert: ein Fehler wird still als „gesendet" gebucht.
Jeder Ausgang steht im Ergebnis, und der Aufrufer kann ihn auswerten.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from supabase import Client

from src.core.logging import get_logger
from src.core.mail import MailError, MailService, OutboundMessage
from src.features.auth.sms import SmsError, send_sms

from .katalog import NACH_SCHLUESSEL, Kanal
from .service import NotificationSettingsService

log = get_logger("nextdays.notification_dispatch")


@dataclass(slots=True)
class Zustellung:
    """Was je Kanal passiert ist. `uebersprungen` = Nutzer will es nicht."""

    gesendet: list[str] = field(default_factory=list)
    uebersprungen: list[str] = field(default_factory=list)
    fehlgeschlagen: dict[str, str] = field(default_factory=dict)

    @property
    def erfolgreich(self) -> bool:
        return bool(self.gesendet)


class NotificationDispatcher:
    def __init__(
        self,
        db: Client,
        *,
        settings_service: NotificationSettingsService | None = None,
        mail: MailService | None = None,
    ) -> None:
        self._db = db
        self._settings = settings_service or NotificationSettingsService(db)
        self._mail = mail or MailService()

    def sende(
        self,
        *,
        user_id: str,
        schluessel: str,
        betreff: str,
        text: str,
        html: str | None = None,
    ) -> Zustellung:
        """Eine Benachrichtigung ueber alle vom Nutzer erlaubten Kanaele.

        `schluessel` ist eine Kategorie aus dem Katalog (z. B. „listing_activity").
        Unbekannte Kategorien sind ein Programmierfehler → ValueError, nicht
        stillschweigend nichts tun.
        """
        kategorie = NACH_SCHLUESSEL.get(schluessel)
        if kategorie is None:
            msg = f"Unbekannte Benachrichtigungs-Kategorie: {schluessel}"
            raise ValueError(msg)

        ergebnis = Zustellung()
        empfaenger = self._empfaenger(user_id)

        for kanal in kategorie.kanaele:
            if kanal is Kanal.PHONE:
                # Telefonanrufe hat noch kein Backend (kein Voice-Anbieter
                # angebunden). Lieber gar nicht anbieten als so tun.
                continue
            if not self._settings.soll_senden(user_id, schluessel, kanal):
                ergebnis.uebersprungen.append(kanal.value)
                continue
            self._sende_kanal(kanal, empfaenger, betreff, text, html, ergebnis)

        log.info(
            "notification_dispatched",
            user_id=user_id,
            kategorie=schluessel,
            gesendet=ergebnis.gesendet,
            uebersprungen=ergebnis.uebersprungen,
            fehlgeschlagen=sorted(ergebnis.fehlgeschlagen),
        )
        return ergebnis

    def _sende_kanal(
        self,
        kanal: Kanal,
        empfaenger: dict[str, str | None],
        betreff: str,
        text: str,
        html: str | None,
        ergebnis: Zustellung,
    ) -> None:
        """Einen Kanal bedienen. Fehler landen im Ergebnis, nie im Aufrufer."""
        ziel = empfaenger.get("email" if kanal is Kanal.EMAIL else "phone")
        if not ziel:
            ergebnis.fehlgeschlagen[kanal.value] = "keine Adresse hinterlegt"
            return
        try:
            if kanal is Kanal.EMAIL:
                self._mail.send(
                    OutboundMessage(to=ziel, subject=betreff, text=text, html=html)
                )
            else:
                send_sms(ziel, f"{betreff}\n\n{text}")
        except (MailError, SmsError) as exc:
            # Spezifisch gefangen (Wurzel 5): der andere Kanal laeuft weiter,
            # der Fehlschlag bleibt aber sichtbar — kein stiller Erfolg.
            ergebnis.fehlgeschlagen[kanal.value] = exc.message
            return
        ergebnis.gesendet.append(kanal.value)

    def _empfaenger(self, user_id: str) -> dict[str, str | None]:
        """E-Mail und Telefonnummer des Nutzers. Scope auf die eigene id."""
        rows = (
            self._db.table("users")
            .select("email, phone")
            .eq("id", user_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return {"email": None, "phone": None}
        return {"email": rows[0].get("email"), "phone": rows[0].get("phone")}
