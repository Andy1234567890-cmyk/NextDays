"""Ein Fehler-Ereignis abhaken — für Webhook- UND Worker-Monitor.

DER BEFUND (13.08.2026): `channex_webhook_event.resolved` existierte seit 0378,
wurde aber NIRGENDS gesetzt: bei allen 603 Ereignissen stand `false`. Die
Backoffice-Liste zeigte deshalb 18 Fehler dauerhaft als „Eingriff nötig" —
darunter vier `deactivate_channel` vom 12.08., während live geprüft ALLE
Booking-Kanäle wieder `is_active: true` waren.

Warum das mehr ist als Unordnung: Eine Warnung, die nie verschwindet, wird zur
Tapete. Stehen achtzehn alte Einträge dauerhaft rot, übersieht man den einen,
der heute zählt — ein getrenntes Inserat verkauft dann tagelang nichts, und die
Seite sah schon vorher genauso aus.

EIN Modul für beide Tabellen, weil es dieselbe Geste ist. Der Unterschied
zwischen ihnen ist eine Zeile Konfiguration (welche Tabelle, welche Spalte trägt
den Fehler), nicht zwei Implementierungen, die auseinanderlaufen.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

log = get_logger("nextdays.platform_admin.ereignis_erledigen")


class ErledigenFehler(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class Quelle:
    """Woran ein Ereignis hängt — der einzige Unterschied zwischen den Monitoren."""

    tabelle: str
    #: Spalte, die den Fehler-Zustand trägt, samt Wert.
    fehler_spalte: str
    fehler_wert: str
    #: Für die Protokollzeile.
    name: str


WEBHOOK = Quelle(
    tabelle="channex_webhook_event",
    fehler_spalte="severity",
    fehler_wert="error",
    name="webhook",
)
WORKER = Quelle(
    tabelle="worker_ereignis",
    fehler_spalte="ergebnis",
    fehler_wert="fehler",
    name="worker",
)

# Obergrenze für die Notiz. Ein Freitextfeld ohne Grenze ist ein offener
# Speicher (Wurzel 8) — und wer mehr schreiben will, gehört ins Ticket, nicht
# in eine Abhak-Notiz.
NOTIZ_MAX = 2000


def erledigen(
    db: Client,
    ctx: AuthContext,
    quelle: Quelle,
    ereignis_id: str,
    *,
    notiz: str | None = None,
) -> dict[str, Any]:
    """Ein Ereignis als erledigt markieren.

    Idempotent (Wurzel 2): Ein zweiter Klick auf denselben Eintrag ist ein
    No-op und gibt die bereits erledigte Zeile zurück, statt 404 zu werfen oder
    Zeitstempel und Bearbeiter zu überschreiben — wer zuerst abgehakt hat,
    bleibt vermerkt.

    Abgehakt werden darf JEDES Ereignis, nicht nur ein fehlerhaftes: Auch ein
    `booking_unmapped_rate` mit `severity='info'` kann eine offene Aufgabe sein,
    und die Liste filtert ohnehin selbst. Eine Prüfung „nur Fehler" würde nur
    Fälle verbieten, die niemandem schaden.
    """
    text = (notiz or "").strip()
    if len(text) > NOTIZ_MAX:
        raise ErledigenFehler(
            f"Notiz zu lang (max. {NOTIZ_MAX} Zeichen).", status_code=422
        )

    vorher = _laden(db, quelle, ereignis_id)
    if vorher.get("resolved"):
        # Schon erledigt — unverändert zurück, nichts überschreiben.
        return _antwort(vorher)

    aenderung: dict[str, Any] = {
        "resolved": True,
        "resolved_at": datetime.now(UTC).isoformat(),
        "resolved_by": ctx.user_id,
        # NULL statt leerem Objekt, wenn nichts notiert wurde: „{}" sähe aus wie
        # eine Notiz, die verloren ging (Wurzel 4).
        "resolution": {"note": text} if text else None,
    }
    treffer = (
        db.table(quelle.tabelle)
        .update(aenderung)
        .eq("id", ereignis_id)
        # Nur die noch offene Zeile: Läuft parallel ein zweiter Klick, gewinnt
        # der erste und der zweite findet nichts mehr (Wurzel 2, DB-seitig).
        .eq("resolved", False)
        .execute()
    ).data or []
    if not treffer:
        # Zwischen Laden und Schreiben hat jemand anderes abgehakt — kein
        # Fehler, sondern genau das gewünschte Ergebnis.
        return _antwort(_laden(db, quelle, ereignis_id))

    log.info(
        "ereignis_erledigt",
        quelle=quelle.name,
        ereignis_id=ereignis_id,
        user_id=ctx.user_id,
        mit_notiz=bool(text),
    )
    return _antwort(treffer[0])


def wieder_oeffnen(
    db: Client, ctx: AuthContext, quelle: Quelle, ereignis_id: str
) -> dict[str, Any]:
    """Ein versehentlich abgehaktes Ereignis wieder öffnen.

    Ohne Rückweg wäre das Abhaken eine Einbahnstraße: Ein Fehlklick liesse ein
    echtes Problem für immer aus der Liste verschwinden — genau die Sorte
    stiller Verlust, gegen die dieser Monitor gebaut wurde.

    Die Notiz bleibt stehen: Sie sagt, was jemand damals dachte, und das bleibt
    auch nach dem Wiederöffnen wahr.
    """
    vorher = _laden(db, quelle, ereignis_id)
    if not vorher.get("resolved"):
        return _antwort(vorher)
    treffer = (
        db.table(quelle.tabelle)
        .update({"resolved": False, "resolved_at": None, "resolved_by": None})
        .eq("id", ereignis_id)
        .execute()
    ).data or []
    log.info(
        "ereignis_wieder_geoeffnet",
        quelle=quelle.name,
        ereignis_id=ereignis_id,
        user_id=ctx.user_id,
    )
    return _antwort(treffer[0] if treffer else vorher)


def _laden(db: Client, quelle: Quelle, ereignis_id: str) -> dict[str, Any]:
    """Die Zeile holen — 404, wenn es sie nicht gibt.

    Kein Tenant-Scope: Beide Tabellen sind plattformweit und der Endpunkt läuft
    hinter `platform_admin` (Wurzel 9 — die Autorisierung sitzt an der Route,
    hier gäbe es keinen engeren Scope, der etwas zusätzlich schützt).
    """
    treffer = (
        db.table(quelle.tabelle)
        .select("*")
        .eq("id", ereignis_id)
        .limit(1)
        .execute()
    ).data or []
    if not treffer:
        raise ErledigenFehler("Ereignis nicht gefunden.", status_code=404)
    return treffer[0]


def _antwort(row: dict[str, Any]) -> dict[str, Any]:
    """Nur der Zustand, den die Oberfläche braucht — nicht die ganze Payload."""
    resolution = row.get("resolution")
    notiz = resolution.get("note") if isinstance(resolution, dict) else None
    return {
        "id": str(row["id"]),
        "resolved": bool(row.get("resolved")),
        "resolved_at": (
            str(row["resolved_at"]) if row.get("resolved_at") else None
        ),
        "resolved_by": (
            str(row["resolved_by"]) if row.get("resolved_by") else None
        ),
        "notiz": notiz or None,
    }
