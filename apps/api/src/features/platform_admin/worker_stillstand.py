"""Stillstands-Erkennung: welcher Kern-Job AUSBLEIBT.

Der Worker-Monitor zählte bisher nur, was passiert IST — Vorgänge, Fehler,
Warteschlange. Genau darin war der Ausfall vom 13.08.2026 unsichtbar: 16 Stunden
lang ging KEIN einziger Aufruf an die Portale raus, und die Seite meldete
„1000 Vorgänge · 0 Fehler". Beides stimmte sogar: Die Jobs liefen, sie kamen nur
nicht durch (Redis-Auth kaputt → Channex-Budget gab kein Token → jeder Job
verzögerte sich). Ein verzögerter Job ist ein GEPLANTER Ausgang, kein Fehler —
also blieb die Fehlerzahl bei null, während der Buchungs-Feed stand.

Was dabei real liegenblieb: ein Booking-Storno, der 16 h lang nicht ankam. Der
Kalender führte die Nacht weiter als belegt. Wäre es eine NEUE Buchung gewesen,
hätte er sie als frei geführt — Doppelbelegung.

Deshalb dreht dieses Modul die Frage um: nicht „ist ein Fehler passiert?",
sondern „wann lief dieser Job zuletzt ERFOLGREICH?". Ein Job, der sein
Intervall deutlich überschreitet, ist ein Befund — auch (und gerade) wenn
niemand einen Fehler gemeldet hat.

Die Erwartungswerte spiegeln die Tick-Intervalle aus `worker.py`. Sie stehen
hier bewusst als eigene Tabelle und werden nicht importiert: `worker.py` zieht
den halben Channel-Manager mit sich, und der Monitor soll ohne diesen Ballast
antwortbar bleiben. Weicht ein Intervall dort ab, fällt es hier auf — der Test
`test_stillstand_intervalle_passen_zum_worker` liest beide Seiten und vergleicht.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client

from .schemas import WorkerStillstand

_TABELLE = "worker_ereignis"

# Job → (Tick-Intervall in Sekunden, Klartext fürs Backoffice).
#
# Nur Jobs, deren Ausbleiben WEHTUT. Kein `reconcile_tenant` (läuft täglich,
# ist kein Live-Pfad) und keine Stunden-Ticks — sonst steht die Seite voller
# gelber Kacheln und niemand schaut mehr hin.
KERN_JOBS: dict[str, tuple[int, str]] = {
    # Der teuerste Ausfall: neue Buchungen und Stornos der Portale kommen hier
    # herein. Steht er, verkauft der Kalender belegte Nächte weiter.
    "sync_bookings_feed": (5 * 60, "Buchungen und Stornos von den Portalen"),
    # Verfügbarkeiten/Preise RAUS an die Portale. Steht er, verkaufen die
    # Portale zu alten Preisen und gesperrte Nächte bleiben buchbar.
    "process_ari_outbox": (5 * 60, "Verfügbarkeiten und Preise an die Portale"),
    "process_restriction_outbox": (5 * 60, "Mindestaufenthalte an die Portale"),
    # Airbnb-Direktfeed (eigener Weg neben Channex).
    "sync_live_feed": (5 * 60, "Airbnb-Buchungen im Direktabruf"),
}

# Ab wann gilt ein Ausbleiben als Stillstand: das Vielfache des Intervalls.
#
# Drei statt zwei, damit ein einzelner verzögerter Lauf (Backoff, langer
# Vorgänger, Deploy) nicht sofort Alarm auslöst. Bei 5-min-Ticks heißt das:
# nach 15 Minuten ohne Erfolg ist etwas faul — der reale Ausfall lief 16 Stunden.
TOLERANZ_FAKTOR = 3


def stillstand(db: Client) -> list[WorkerStillstand]:
    """Kern-Jobs, die überfällig sind — leere Liste heißt: alles läuft.

    Gemessen wird der letzte ERFOLGREICHE Lauf, nicht der letzte Versuch: Ein
    Job, der alle fünf Minuten startet und jedes Mal ergebnislos verzögert,
    sieht in einer Versuchs-Statistik gesund aus. Genau das war der Ausfall.

    Ein Job, der noch NIE gelaufen ist (frisches System, Verlauf aufgeräumt),
    ist kein Stillstand: ohne einen einzigen Lauf gibt es keinen Bezugspunkt,
    und „seit Anbeginn überfällig" wäre eine Falschaussage (Wurzel 4). Er wird
    mit `zuletzt=None` gemeldet und `ueberfaellig=False`.
    """
    jetzt = datetime.now(UTC)
    # Ein Abruf für alle Kern-Jobs statt einer Abfrage je Job: die Tabelle ist
    # nach (vorgang, erfasst_at) indiziert, aber vier Roundtrips für vier
    # Zahlen sind Verschwendung.
    aeltestes = max(i for i, _ in KERN_JOBS.values()) * TOLERANZ_FAKTOR
    seit = (jetzt - timedelta(seconds=aeltestes * 2)).isoformat()
    rows = (
        db.table(_TABELLE)
        .select("vorgang, erfasst_at, ergebnis")
        .eq("richtung", "job")
        .eq("ergebnis", "ok")
        .in_("vorgang", list(KERN_JOBS))
        .gte("erfasst_at", seit)
        .order("erfasst_at", desc=True)
        .execute()
    ).data or []

    letzter: dict[str, str] = {}
    for r in rows:
        vorgang = str(r.get("vorgang"))
        # Absteigend sortiert → der erste Treffer je Vorgang ist der jüngste.
        letzter.setdefault(vorgang, str(r.get("erfasst_at")))

    befunde: list[WorkerStillstand] = []
    for vorgang, (intervall, klartext) in KERN_JOBS.items():
        roh = letzter.get(vorgang)
        grenze = intervall * TOLERANZ_FAKTOR
        if roh is None:
            # Kein Lauf im Fenster. Das ist der eigentliche Alarmfall — aber es
            # kann auch ein frisches System sein. Beides wird gemeldet, die
            # Unterscheidung trifft `zuletzt`.
            befunde.append(
                WorkerStillstand(
                    vorgang=vorgang,
                    beschreibung=klartext,
                    zuletzt=None,
                    still_seit_sekunden=None,
                    erwartet_alle_sekunden=intervall,
                    ueberfaellig=True,
                )
            )
            continue
        alter = int((jetzt - _als_zeit(roh)).total_seconds())
        if alter > grenze:
            befunde.append(
                WorkerStillstand(
                    vorgang=vorgang,
                    beschreibung=klartext,
                    zuletzt=roh,
                    still_seit_sekunden=alter,
                    erwartet_alle_sekunden=intervall,
                    ueberfaellig=True,
                )
            )
    befunde.sort(key=lambda b: b.still_seit_sekunden or 10**9, reverse=True)
    return befunde


def _als_zeit(wert: str) -> datetime:
    """ISO-Zeitstempel aus der DB → aware datetime.

    Postgres liefert `+00:00`, ältere Zeilen teils `Z`. Ohne Zeitzone wäre die
    Differenz gegen `now(UTC)` um den lokalen Versatz daneben — und damit die
    Stillstands-Dauer schlicht falsch.
    """
    text = wert.replace("Z", "+00:00")
    zeit = datetime.fromisoformat(text)
    return zeit if zeit.tzinfo else zeit.replace(tzinfo=UTC)


def als_dict(befunde: list[WorkerStillstand]) -> list[dict[str, Any]]:
    """Für Log-Ausgaben (structlog nimmt keine Pydantic-Modelle)."""
    return [b.model_dump() for b in befunde]
