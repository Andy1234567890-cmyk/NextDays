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

    def sende(  # noqa: PLR0913 — die Glocke braucht Ziel und Objektbezug
        self,
        *,
        user_id: str,
        schluessel: str,
        betreff: str,
        text: str,
        html: str | None = None,
        tenant_id: str | None = None,
        ziel_pfad: str | None = None,
        property_id: str | None = None,
        dedup_key: str | None = None,
        inapp: bool = True,
    ) -> Zustellung:
        """Eine Benachrichtigung ueber alle vom Nutzer erlaubten Kanaele.

        `schluessel` ist eine Kategorie aus dem Katalog (z. B. „listing_activity").
        Unbekannte Kategorien sind ein Programmierfehler → ValueError, nicht
        stillschweigend nichts tun.

        Die GLOCKE (`inapp`) laeuft immer mit, sofern ein `tenant_id` da ist —
        sie ist nicht abwaehlbar (siehe Kanal.INAPP). `inapp=False` schaltet sie
        fuer Meldungen aus, die in der Anwendung keinen Sinn ergeben (etwa eine
        reine Bestaetigungs-Mail an einen Gast ohne Zugang).

        `ziel_pfad` ist der RELATIVE Pfad, auf den der Klick fuehrt; `dedup_key`
        verhindert, dass derselbe Zustand bei jedem Sync erneut meldet (Wurzel 2).
        """
        kategorie = NACH_SCHLUESSEL.get(schluessel)
        if kategorie is None:
            msg = f"Unbekannte Benachrichtigungs-Kategorie: {schluessel}"
            raise ValueError(msg)

        ergebnis = Zustellung()
        empfaenger = self._empfaenger(user_id)

        if inapp and tenant_id:
            self._glocke(
                tenant_id=tenant_id, user_id=user_id, kategorie=schluessel,
                titel=betreff, text=text, ziel_pfad=ziel_pfad,
                property_id=property_id, dedup_key=dedup_key, ergebnis=ergebnis,
            )

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

    def _glocke(  # noqa: PLR0913 — eine Zeile mit ihren Feldern
        self,
        *,
        tenant_id: str,
        user_id: str,
        kategorie: str,
        titel: str,
        text: str,
        ziel_pfad: str | None,
        property_id: str | None,
        dedup_key: str | None,
        ergebnis: Zustellung,
    ) -> None:
        """Eine Zeile in `notifications` — die In-App-Meldung.

        Anders als E-Mail/SMS wird hier nichts versendet, sondern gespeichert:
        die Meldung bleibt, bis der Nutzer sie gesehen hat.

        Doppelmeldungen faengt der partielle UNIQUE-Index
        `notifications_dedup_offen_uq` ab (Wurzel 2): steht dieselbe Meldung
        ungelesen schon da, ist der 23505 der ZIELZUSTAND, kein Fehler. Der
        Index greift bewusst nur fuer UNGELESENE — nach dem Lesen darf derselbe
        Zustand erneut melden.
        """
        zeile = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "kategorie": kategorie,
            "titel": titel,
            "text": text or None,
            "ziel_pfad": ziel_pfad,
            "property_id": property_id,
            "dedup_key": dedup_key,
        }
        try:
            self._db.table("notifications").insert(zeile).execute()
        except Exception as exc:  # noqa: BLE001 — Fremdbibliothek, siehe unten
            # Der Supabase-Client wirft je nach Version verschiedene Typen; der
            # Konflikt ist am Code 23505 erkennbar. Ihn als Erfolg zu werten ist
            # korrekt (die Meldung steht bereits), jeden anderen Fehler aber
            # NICHT zu verschlucken (Wurzel 5) — er landet im Ergebnis.
            if "23505" in str(exc):
                ergebnis.uebersprungen.append(f"{Kanal.INAPP.value} (bereits offen)")
                return
            log.warning(
                "notification_glocke_fehlgeschlagen",
                user_id=user_id, kategorie=kategorie, error=str(exc)[:200],
            )
            ergebnis.fehlgeschlagen[Kanal.INAPP.value] = str(exc)[:200]
            return
        ergebnis.gesendet.append(Kanal.INAPP.value)

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
