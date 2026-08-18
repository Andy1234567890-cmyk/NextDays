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

from collections.abc import Sequence
from dataclasses import dataclass, field

from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.mail_empfaenger import betriebs_sprache
from src.core.mail_layout import (
    Aktion,
    GerenderteMail,
    MailInhalt,
    mail_rendern,
)
from src.core.mail_sprache import aufloesen
from src.core.mail_texte import text as mail_text
from src.features.auth.sms import SmsError, send_sms
from src.jobs import worker_verlauf

from .katalog import NACH_SCHLUESSEL, Kanal
from .service import NotificationSettingsService

log = get_logger("nextdays.notification_dispatch")

# Der Markenname für die übersetzten Sätze. Benachrichtigungen an den BETRIEB
# sind immer myNextDays — die Glocke und diese Mails gehören zur Verwaltung,
# nicht zum Marktplatz (CLAUDE.md „Zwei Marken").
_MARKE = "myNextDays"

# Marker, den `_glocke` an `uebersprungen` haengt, wenn der partielle
# UNIQUE-Index (`notifications_dedup_offen_uq`) dieselbe Meldung bereits OFFEN
# vorgefunden hat. Als Konstante, weil `sende()` daran erkennt, dass auch
# E-Mail und SMS entfallen muessen — ein hier geaenderter Text wuerde die
# Entdopplung sonst still ausser Kraft setzen.
_GLOCKE_BEREITS_OFFEN = "bereits offen"


def _glocke_entdoppelt(ergebnis: Zustellung) -> bool:
    """Hat die Glocke die Meldung als bereits vorhanden abgewiesen?"""
    return any(
        _GLOCKE_BEREITS_OFFEN in eintrag for eintrag in ergebnis.uebersprungen
    )


@dataclass(frozen=True, slots=True)
class Katalogwert:
    """Ein Platzhalter-Wert, der SELBST uebersetzt werden muss.

    Der Fall dahinter: „Neue Aufgabe: {titel}" ist uebersetzbar, aber `titel`
    ist mal ein Freitext des Nutzers („Poolpumpe pruefen" — bleibt, wie er ist)
    und mal eine Systemvorgabe aus 0330 (`endreinigung` — muss „Slutrengoering"
    heissen, wenn der Empfaenger Daene ist).

    Der Aufrufer kann das nicht selbst aufloesen: die Sprache steht erst HIER
    fest, denn sie haengt am Empfaenger, und derselbe `sende()`-Aufruf bedient
    im Fan-out mehrere Empfaenger mit verschiedenen Sprachen. Ein vom Aufrufer
    fertig uebersetzter Titel waere die Sprache des ERSTEN Empfaengers fuer
    alle — genau der Fehler, den diese Schicht verhindern soll.
    """

    schluessel: str


def _wert_aufloesen(wert: object, sprache: str) -> object:
    """Einen Platzhalterwert in die Empfaengersprache bringen.

    Alles ausser `Katalogwert` geht unveraendert durch: Objektnamen, Vornamen
    und Zeitraeume sind Daten, keine Uebersetzungen.
    """
    if isinstance(wert, Katalogwert):
        return mail_text(wert.schluessel, sprache)
    return wert


def _werte_aufloesen(
    werte: dict[str, object] | None, sprache: str
) -> dict[str, object]:
    if not werte:
        return {}
    return {k: _wert_aufloesen(v, sprache) for k, v in werte.items()}


def _absaetze_rendern(
    schluessel: str | Sequence[str],
    sprache: str,
    werte: dict[str, object] | None,
) -> str:
    """Einen oder mehrere Katalogtexte zu Absaetzen verbinden.

    Ein einzelner Schluessel bleibt ein einzelner Absatz; eine Liste ergibt
    mehrere, durch Leerzeile getrennt — dieselbe Trennung, die das Mail-Layout
    als Absatzgrenze liest.
    """
    keys = [schluessel] if isinstance(schluessel, str) else list(schluessel)
    gefuellt = _werte_aufloesen(werte, sprache)
    return "\n\n".join(mail_text(k, sprache, **gefuellt) for k in keys)


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
        tenant_id: str | None = None,
        ziel_pfad: str | None = None,
        property_id: str | None = None,
        thread_ref: str | None = None,
        dedup_key: str | None = None,
        inapp: bool = True,
        betreff_key: str | None = None,
        betreff_werte: dict[str, object] | None = None,
        text_key: str | Sequence[str] | None = None,
        text_werte: dict[str, object] | None = None,
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

        Das HTML der Mail entsteht HIER aus `betreff`/`text`/`ziel_pfad` — es
        gab dafuer frueher einen `html`-Parameter, den kein einziger Aufrufer je
        gefuellt hat: jede Benachrichtigungsmail ging als nackter Text raus.
        Den Aufrufer eine Mail formatieren zu lassen waere ohnehin die falsche
        Ebene; er kennt das Ereignis, nicht das Layout.

        ZWEI BETREFFE, und das ist Absicht:
        `betreff` ist der Text fuer die GLOCKE. Er bleibt, wie der Aufrufer ihn
        baut — die Glocke wird in der Oberflaeche gelesen, die ihre eigene
        Sprache hat, und dort steht neben der Meldung ohnehin der Objekttitel
        in Originalschreibweise.
        `betreff_key` (+ `betreff_werte`) ist der Katalogschluessel fuer die
        E-MAIL. Sie verlaesst das Haus und erreicht keinen Message-Katalog mehr
        — sie muss in der Sprache des EMPFAENGERS geschrieben sein, nicht in
        der des Servers. Fehlt der Schluessel, geht `betreff` hinaus wie
        bisher; so bleibt jeder Aufrufer lauffaehig, der noch nicht umgestellt
        ist, ohne dass eine Mail leer wird.
        `text_key` (+ `text_werte`) ist dasselbe fuer den RUMPF. Er ist eigens
        noetig, weil Betreff und Rumpf verschiedene Saetze sind: „Sperrantrag
        genehmigt: Haus A" im Betreff, „Dein Sperrantrag fuer Haus A
        (01.–05.) wurde genehmigt." im Rumpf. Ohne diesen Parameter blieb der
        Rumpf deutsch, waehrend der Betreff schon uebersetzt war — eine Mail,
        die in der Mitte die Sprache wechselt.
        `text_key` darf eine LISTE sein: dann wird jeder Schluessel gerendert
        und die Stuecke werden zu Absaetzen verbunden. Das deckt den haeufigen
        Fall „Grundsatz + optionale Anmerkung" ab, ohne dass der Aufrufer den
        zweiten Absatz selbst uebersetzen muesste — er kennt die Sprache des
        Empfaengers gar nicht.

        DIE GLOCKE bleibt bei `betreff`/`text` und wird NICHT uebersetzt: sie
        wird in der Oberflaeche gelesen, die ihre eigene Sprachwahl hat, und
        sie ist eine gespeicherte Zeile — sie in der Sprache des Empfaengers
        einzufrieren waere falsch, sobald er die Oberflaechensprache wechselt.
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
                property_id=property_id, thread_ref=thread_ref,
                dedup_key=dedup_key, ergebnis=ergebnis,
            )
            if _glocke_entdoppelt(ergebnis):
                # DIE ENTDOPPLUNG GILT FUER ALLE KANAELE, nicht nur die Glocke.
                # Der partielle UNIQUE-Index hat dieselbe Meldung als bereits
                # OFFEN erkannt — dann ist sie auch schon verschickt worden.
                # Ohne dieses Return lief die Kanalschleife trotzdem weiter:
                # fuenf Umbuchungen derselben Reservierung ergaben eine Glocke
                # und FUENF Mails plus fuenf SMS, und `owner_booking` ist
                # email_pflicht, also nicht abwaehlbar (Wurzel 2 — der
                # `dedup_key` war nur fuer einen von drei Kanaelen ein Riegel).
                #
                # Der Aufrufer sieht das am Ergebnis: `uebersprungen` traegt
                # den Grund, `gesendet` bleibt leer. Nichts wird still als
                # „zugestellt" gebucht (Wurzel 5).
                for kanal in kategorie.kanaele:
                    if kanal is not Kanal.PHONE:
                        ergebnis.uebersprungen.append(
                            f"{kanal.value} (bereits gemeldet)"
                        )
                log.info(
                    "notification_dedup_uebersprungen",
                    user_id=user_id, kategorie=schluessel, dedup_key=dedup_key,
                )
                return ergebnis

        for kanal in kategorie.kanaele:
            if kanal is Kanal.PHONE:
                # Telefonanrufe hat noch kein Backend (kein Voice-Anbieter
                # angebunden). Lieber gar nicht anbieten als so tun.
                continue
            if not self._settings.soll_senden(user_id, schluessel, kanal):
                ergebnis.uebersprungen.append(kanal.value)
                continue
            self._sende_kanal(
                kanal, empfaenger, betreff, text, ziel_pfad, ergebnis,
                betreff_key=betreff_key, betreff_werte=betreff_werte,
                text_key=text_key, text_werte=text_werte,
                tenant_id=tenant_id,
            )

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
        thread_ref: str | None,
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
            # Bezug auf die Konversation (0406): erlaubt, die Meldung beim
            # Lesen des Threads stillzulegen, ohne `ziel_pfad` zu zerlegen.
            "thread_ref": thread_ref,
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
                ergebnis.uebersprungen.append(
                    f"{Kanal.INAPP.value} ({_GLOCKE_BEREITS_OFFEN})"
                )
                return
            log.warning(
                "notification_glocke_fehlgeschlagen",
                user_id=user_id, kategorie=kategorie, error=str(exc)[:200],
            )
            ergebnis.fehlgeschlagen[Kanal.INAPP.value] = str(exc)[:200]
            return
        ergebnis.gesendet.append(Kanal.INAPP.value)

    def _sende_kanal(  # noqa: PLR0913 — Kanal, Ziel, Inhalt, Ergebnis
        self,
        kanal: Kanal,
        empfaenger: dict[str, str | None],
        betreff: str,
        text: str,
        ziel_pfad: str | None,
        ergebnis: Zustellung,
        *,
        betreff_key: str | None = None,
        betreff_werte: dict[str, object] | None = None,
        text_key: str | Sequence[str] | None = None,
        text_werte: dict[str, object] | None = None,
        tenant_id: str | None = None,
    ) -> None:
        """Einen Kanal bedienen. Fehler landen im Ergebnis, nie im Aufrufer.

        Die SMS bleibt bewusst nackter Text: dort gibt es kein Layout, und
        jedes Zeichen kostet. Sie geht in DERSELBEN Sprache raus wie die Mail —
        eine SMS ist genauso eine Nachricht nach draussen.
        """
        ziel = empfaenger.get("email" if kanal is Kanal.EMAIL else "phone")
        if not ziel:
            ergebnis.fehlgeschlagen[kanal.value] = "keine Adresse hinterlegt"
            return
        sprache = aufloesen(
            empfaenger.get("preferred_language"),
            betriebs_sprache(self._db, tenant_id),
        )
        # Betreff und Rumpf der AUSGEHENDEN Nachricht: aus dem Katalog, wenn
        # der Aufrufer einen Schluessel mitgibt, sonst der Rohtext von oben.
        betreff_aussen = (
            mail_text(
                betreff_key, sprache, **_werte_aufloesen(betreff_werte, sprache)
            )
            if betreff_key
            else betreff
        )
        text_aussen = (
            _absaetze_rendern(text_key, sprache, text_werte)
            if text_key
            else text
        )
        try:
            if kanal is Kanal.EMAIL:
                mail = self._mail_bauen(
                    betreff_aussen, text_aussen, ziel_pfad, sprache
                )
                self._mail.send(
                    OutboundMessage(
                        to=ziel,
                        subject=betreff_aussen,
                        text=mail.text,
                        html=mail.html,
                        inline_bilder=mail.inline_bilder,
                    )
                )
            else:
                send_sms(ziel, f"{betreff_aussen}\n\n{text_aussen}")
        except (MailError, SmsError) as exc:
            # Spezifisch gefangen (Wurzel 5): der andere Kanal laeuft weiter,
            # der Fehlschlag bleibt aber sichtbar — kein stiller Erfolg.
            ergebnis.fehlgeschlagen[kanal.value] = exc.message
            # ... und in den Verlauf, denn „sichtbar im Ergebnis" reichte nicht:
            # KEIN Aufrufer wertet `Zustellung` aus, alle sechs fangen breit und
            # verwerfen den Rueckgabewert. Eine nicht zugestellte Pflicht-Mail
            # (Buchung, Storno) hinterliess damit nur eine Log-Zeile.
            worker_verlauf.merken(
                self._db,
                richtung="ausgang",
                vorgang=f"benachrichtigung_{kanal.value}",
                ergebnis="fehler",
                tenant_id=tenant_id,
                fehler_text=exc.message[:2000],
                zusammenfassung=f"Benachrichtigung nicht zugestellt: {betreff}"[:2000],
            )
            return
        ergebnis.gesendet.append(kanal.value)

    @staticmethod
    def _mail_bauen(
        betreff: str, text: str, ziel_pfad: str | None, sprache: str
    ) -> GerenderteMail:
        """Benachrichtigung ins gemeinsame Mail-Layout giessen.

        `betreff` ist die Ueberschrift, `text` der Rumpf — beide kommen als
        reiner Text herein und werden im Layout escaped (Wurzel 8): ein
        Objekttitel oder Gastname mit spitzen Klammern darf keine Injektion
        ergeben.

        Der Button entsteht NUR, wenn ein `ziel_pfad` da ist UND die Adresse des
        Dashboards konfiguriert ist. Fehlt sie, gibt es keinen Link — eine
        geratene Domain waere ein erfundener Wert (Wurzel 4), und die Mail sagt
        ohne Button immer noch alles Noetige.
        """
        roh = getattr(get_settings(), "app_base_url", "")
        basis = roh.rstrip("/") if isinstance(roh, str) else ""
        aktion = (
            Aktion(
                text=mail_text(
                    "benachrichtigung.aktion", sprache, marke=_MARKE
                ),
                url=f"{basis}{ziel_pfad}",
            )
            if ziel_pfad and basis
            else None
        )
        return mail_rendern(
            MailInhalt(
                titel=betreff,
                absaetze=[text] if text else [],
                aktion=aktion,
                sprache=sprache,
            )
        )

    def _empfaenger(self, user_id: str) -> dict[str, str | None]:
        """E-Mail, Telefonnummer und SPRACHE des Nutzers. Scope auf die eigene id.

        Die Sprache kommt aus derselben Zeile mit: sie wird für Betreff und
        Rumpf gebraucht, und eine zweite Abfrage dafür wäre ein Roundtrip je
        Benachrichtigung.
        """
        rows = (
            self._db.table("users")
            .select("email, phone, preferred_language")
            .eq("id", user_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return {"email": None, "phone": None, "preferred_language": None}
        return {
            "email": rows[0].get("email"),
            "phone": rows[0].get("phone"),
            "preferred_language": rows[0].get("preferred_language"),
        }
