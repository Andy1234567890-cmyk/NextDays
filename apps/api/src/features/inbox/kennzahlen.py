"""Nachrichten-Kennzahlen des Posteingangs für die Startseite.

Eigenes Modul und nicht in `service.py`: die Datei steht bei ~1500 Zeilen an
der pylint-Grenze — dieselbe Begründung, aus der schon `spiegel.py`
herausgelöst wurde.

Gesendet/empfangen zählt über `portal_messages` (der Spiegel, 0293), nicht über den
Aggregator: die Zahlen sollen ohne Portal-Runde entstehen. Der Zeitfilter
läuft über `sent_at` — den Zeitpunkt BEIM PORTAL —, nie über `created_at`,
unsere Schreibzeit (Wurzel 5b). Bei einem Nachholimport liegen die beiden
Monate auseinander, und eine Kennzahl über `created_at` zeigte einen Berg
Nachrichten an dem Tag, an dem wir sie geholt haben.

„Per Automation gesendet" zählt dagegen über `automation_scheduled_message`
(`status='sent'`) — unser eigenes Versandprotokoll. Am Spiegel ist die
Automail nicht erkennbar: sie läuft durch dieselbe `send_message` wie eine
Handnachricht und kommt als `sender='property'` zurück. Das Feld `quelle`
(0400) unterscheidet sie zwar ab jetzt, kennt aber keine früher gesendete —
dort steht der Spaltendefault `manuell`.

WAS BEWUSST FEHLT: Marktplatz-Nachrichten (`guest_messages`) und WhatsApp
(`whatsapp_message`) sind eigene Töpfe mit eigenen Richtungsfeldern. Sie hier
mitzuzählen hieße, drei Zählweisen in eine Zahl zu mischen; sie
wegzulassen und das NICHT zu sagen wäre die schlechtere Variante. Die
Kennzahlen sind deshalb ausdrücklich die des Portal-/OTA-Postfachs.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Final

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.zeitraum import STANDARD_ZEITRAUM, UnbekannterZeitraum, tage_fuer
from src.core.zeitraum import ZEITRAEUME as _ZEITRAEUME

from .errors import InboxError
from .schemas import NachrichtenKennzahl, NachrichtenKennzahlen

if TYPE_CHECKING:
    from .authz import InboxAccess

log = get_logger("nextdays.inbox")

# Die wählbaren Zeiträume stehen in `core.zeitraum` — dieselbe Menge nutzen
# die KPI-Kacheln der Startseite. Der Re-Export hält die bisherigen
# Importstellen (`kennzahlen.ZEITRAEUME`) gültig.
ZEITRAEUME: Final[dict[str, int]] = _ZEITRAEUME
_STANDARD_ZEITRAUM: Final = STANDARD_ZEITRAUM

# Obergrenze der gezählten Zeilen (Wurzel 8). `count="exact"` zählt in der DB
# und lädt nichts, aber die Zahl wird trotzdem gedeckelt gemeldet, statt bei
# einem Ausreißer-Mandanten eine Abfrage ohne Grenze zu fahren.
_MAX_ZEILEN: Final = 100_000

# Wie viele offene Konversationen die Karte auf der Startseite zeigt. Die Zahl
# daneben bleibt die vollständige — die Liste ist der Auszug, der die Frage
# „ist das dringend?" ohne Klick beantwortet.
_MAX_UNGELESEN_ZEILEN: Final = 6


def _kennzahl(aktuell: int, vorher: int, tage: int) -> NachrichtenKennzahl:
    """Wert, Tagesschnitt und Vergleich zur Vorperiode aus zwei Zählungen."""
    return NachrichtenKennzahl(
        value=aktuell,
        # Schnitt je Tag mit EINER Nachkommastelle: „2,8 am Tag" ist die
        # Aussage, „2,7666…" wäre Genauigkeit, die die Daten nicht hergeben.
        per_day=round(aktuell / tage, 1),
        # Ohne Vorperiode kein Prozentwert — eine Steigerung von 0 auf
        # irgendwas ist nicht „+100 %", sondern schlicht keine Vergleichsgröße
        # (Wurzel 4, wie `DashboardKpi.change_pct`).
        change_pct=(
            round((aktuell - vorher) / vorher * 100, 1) if vorher else None
        ),
    )


class KennzahlenMixin:
    """Nachrichten-Kennzahlen (`/inbox/kennzahlen`)."""

    def nachrichten_kennzahlen(
        self,
        ctx: AuthContext,
        *,
        zeitraum: str = _STANDARD_ZEITRAUM,
        access: InboxAccess | None = None,
    ) -> NachrichtenKennzahlen:
        """Gesendet / empfangen / per Automation, je mit Vergleich zur Vorperiode.

        Der Scope gilt unverändert (Wurzel 9): die Zahlen entstehen über
        `tenant_id`, und die ungelesenen Konversationen kommen aus
        `unread_count`, das seinerseits `access` durchreicht. Eine eigene
        Zählung für „ungelesen" wäre eine zweite Wahrheit über denselben
        Zustand — der Lesestand ist abgeleitet, nicht eine Spalte.

        Ein unbekannter `zeitraum` wird abgewiesen (422) statt still auf den
        Standard zurückzufallen: sonst zeigte die Karte „12 Monate" die Zahlen
        von 30 Tagen, und niemand sähe den Unterschied (Wurzel 4/5).
        """
        try:
            tage = tage_fuer(zeitraum)
        except UnbekannterZeitraum as exc:
            raise InboxError(str(exc), status_code=422) from exc
        db, tenant_id = self._require(ctx)  # type: ignore[attr-defined]
        jetzt = datetime.now(UTC)
        akt_start = jetzt - timedelta(days=tage)
        vor_start = jetzt - timedelta(days=tage * 2)

        def zaehle(von: datetime, bis: datetime, *, sender: str) -> int:
            antwort = (
                db.table("portal_messages")
                .select("id", count="exact")
                .eq("tenant_id", tenant_id)
                .eq("sender", sender)
                .gte("sent_at", von.isoformat())
                .lt("sent_at", bis.isoformat())
                .limit(_MAX_ZEILEN)
                .execute()
            )
            anzahl = getattr(antwort, "count", None)
            return int(anzahl) if anzahl is not None else len(antwort.data or [])

        def kennzahl(*, sender: str) -> NachrichtenKennzahl:
            aktuell = zaehle(akt_start, jetzt, sender=sender)
            vorher = zaehle(vor_start, akt_start, sender=sender)
            return _kennzahl(aktuell, vorher, tage)

        return NachrichtenKennzahlen(
            gesendet=kennzahl(sender="property"),
            empfangen=kennzahl(sender="guest"),
            automation=self._automation_kennzahl(
                db, tenant_id, akt_start, vor_start, jetzt, tage
            ),
            **self._ungelesene(ctx, access),
            zeitraum=zeitraum,
            tage=tage,
        )

    def _automation_kennzahl(
        self,
        db: object,
        tenant_id: str,
        akt_start: datetime,
        vor_start: datetime,
        jetzt: datetime,
        tage: int,
    ) -> NachrichtenKennzahl:
        """Per Automation gesendet — gezählt am Versandprotokoll, nicht am Spiegel.

        Quelle ist `automation_scheduled_message` mit `status='sent'`: dort
        steht, WAS die Automation tatsächlich zugestellt hat. Der Spiegel
        (`portal_messages.quelle`) kann es nicht sein — er kennt den Auslöser
        erst, seit der Sendepfad ihn mitschreibt (0400), und trägt für jede
        früher gesendete Automail den Spaltendefault `manuell`. Eine Zählung
        darüber zeigte deshalb 0, obwohl 57 Nachrichten nachweislich raus
        waren: eine Falschaussage über einen Vorgang, den wir selbst
        protokolliert haben.

        Der Zeitfilter läuft über `updated_at` — hier ausnahmsweise KEIN
        Verstoß gegen Wurzel 5b: der Versand ist UNSERE Handlung, und
        `updated_at` ist der Moment, in dem der Dispatch die Zeile auf 'sent'
        gesetzt hat. `send_at` wäre der geplante, nicht der erfolgte Zeitpunkt.

        Der Vergleich läuft über TAGESRATEN, nicht über rohe Summen, und die
        Vorperiode endet frühestens am ersten Datensatz. Sonst misst man gegen
        eine Zeit, in der es die Automation noch gar nicht gab: die erste
        Sendung lief am 07.08.2026, ein 30-Tage-Fenster reichte bis in den
        Juli, und der Vergleich fiel mangels Vorperiode auf `None` — die
        Kachel zeigte „—", obwohl zehn Tage Daten vorlagen. Läuft eine Quelle
        erst neun Tage, ist ihre Vorperiode neun Tage lang, nicht dreißig.
        """
        def zaehle(von: datetime, bis: datetime) -> int:
            antwort = (
                db.table("automation_scheduled_message")  # type: ignore[attr-defined]
                .select("id", count="exact")
                .eq("tenant_id", tenant_id)
                .eq("status", "sent")
                .gte("updated_at", von.isoformat())
                .lt("updated_at", bis.isoformat())
                .limit(_MAX_ZEILEN)
                .execute()
            )
            anzahl = getattr(antwort, "count", None)
            return int(anzahl) if anzahl is not None else len(antwort.data or [])

        aktuell = zaehle(akt_start, jetzt)
        vorher = zaehle(vor_start, akt_start)
        if not vorher:
            # Nichts im vollen Vorfenster: liegt der erste Datensatz INNERHALB
            # der aktuellen Periode, ist deren früherer Teil die ehrliche
            # Vergleichsbasis. Der Wert bleibt `None`, wenn es wirklich nichts
            # zu vergleichen gibt (kein Datensatz, oder alles am selben Tag) —
            # eine Rate ohne Grundlage wäre erfunden (Wurzel 4).
            return self._anteiliger_vergleich(
                db, tenant_id, akt_start, jetzt, aktuell, tage
            )
        return _kennzahl(aktuell, vorher, tage)

    def _anteiliger_vergleich(
        self,
        db: object,
        tenant_id: str,
        akt_start: datetime,
        jetzt: datetime,
        aktuell: int,
        tage: int,
    ) -> NachrichtenKennzahl:
        """Vergleich gegen die erste Hälfte der belegten Zeit statt gegen leere Tage.

        Gerechnet wird auf TAGESRATEN: die belegte Spanne (erster Datensatz bis
        jetzt) wird halbiert, und die jüngere Hälfte gegen die ältere gestellt.
        Zwei ungleich lange Fenster über rohe Summen zu vergleichen wäre eine
        Falschaussage — vier Tage gegen zehn ergäben immer ein Minus, egal wie
        gut die jüngeren vier laufen.
        """
        erste = (
            db.table("automation_scheduled_message")  # type: ignore[attr-defined]
            .select("updated_at")
            .eq("tenant_id", tenant_id)
            .eq("status", "sent")
            .gte("updated_at", akt_start.isoformat())
            .order("updated_at", desc=False)
            .limit(1)
            .execute()
        ).data or []
        roh = erste[0].get("updated_at") if erste else None
        if not roh:
            return _kennzahl(aktuell, 0, tage)
        start = datetime.fromisoformat(str(roh).replace("Z", "+00:00"))
        spanne = (jetzt - start).total_seconds()
        # Unter zwei Tagen Daten gibt es keine zwei Hälften, die eine Aussage
        # tragen — dann bleibt es bei „kein Vergleich".
        if spanne < 2 * 86400:
            return _kennzahl(aktuell, 0, tage)
        mitte = start + (jetzt - start) / 2
        halbe_tage = spanne / 2 / 86400

        def rate(von: datetime, bis: datetime) -> float:
            antwort = (
                db.table("automation_scheduled_message")  # type: ignore[attr-defined]
                .select("id", count="exact")
                .eq("tenant_id", tenant_id)
                .eq("status", "sent")
                .gte("updated_at", von.isoformat())
                .lt("updated_at", bis.isoformat())
                .limit(_MAX_ZEILEN)
                .execute()
            )
            anzahl = getattr(antwort, "count", None)
            treffer = int(anzahl) if anzahl is not None else len(antwort.data or [])
            return treffer / halbe_tage

        alt = rate(start, mitte)
        neu = rate(mitte, jetzt)
        return NachrichtenKennzahl(
            value=aktuell,
            per_day=round(aktuell / tage, 1),
            change_pct=round((neu - alt) / alt * 100, 1) if alt else None,
        )

    def _ungelesene(
        self, ctx: AuthContext, access: InboxAccess | None
    ) -> dict:
        """Die offenen Konversationen: Zahl UND die ersten davon.

        Beides aus EINEM `list_threads`-Aufruf. Ein zweiter Weg für die Zahl
        (etwa `count(is_read = false)` in SQL) wäre eine zweite Wahrheit über
        denselben Zustand — der Lesestand ist ABGELEITET (`_ist_gelesen`),
        nicht eine Spalte: das Flag steht nach dem ersten Öffnen für immer auf
        `true`, und eine danach eingegangene Gastnachricht fiele aus einer
        reinen Spaltenzählung heraus.

        Best-effort: die Kennzahlen sind die Hauptsache. Fällt die Thread-
        Liste aus (Portal-Störung, fehlender Scope), stehen die Zahlen
        trotzdem — die Karte zeigt dann 0 offene statt einer Fehlerseite.
        """
        try:
            liste = self.list_threads(  # type: ignore[attr-defined]
                ctx, status="active", access=access
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad kippt die Zahlen nicht
            log.warning("kennzahlen_ungelesen_fehlgeschlagen", error=str(exc)[:200])
            return {"ungelesen": 0, "ungelesen_threads": []}
        offen = [t for t in liste.items if not t.is_read]
        return {
            "ungelesen": len(offen),
            "ungelesen_threads": offen[:_MAX_UNGELESEN_ZEILEN],
        }
