"""Den Stand an die Portale melden (ARI-Push).

Wurzel 1 in einem Satz: wer den Kalender oder einen Preis ändert, MUSS den
Gegenzustand mitpflegen — und dazu gehört, dass die Portale den neuen Stand
erfahren. Eine Nacht, die bei uns gesperrt ist und bei Booking.com weiter frei
steht, wird verkauft. Genau das ist live passiert (Stop-Sell 15.–21.08.2026 stand
bei Channex, `/availability` meldete unverändert 1, am 14.08. kam eine
Booking.com-Buchung über 17.–27.08.).

Dieser Service pusht NICHT selbst zu Channex. Er reiht einen Job ein — über die
DB-Funktion `enqueue_job`, dieselbe, die auch die Haupt-API benutzt. Der
bestehende Worker holt ihn und sendet. Das ist bewusst so:

  * Der Vertrag ist ein DB-Aufruf, kein Import und kein HTTP-Aufruf an die
    Haupt-API — die Dienste bleiben getrennt.
  * Es gibt nur EINEN Sender zu Channex. Zwei Sender wären zwei Wahrheiten über
    Reihenfolge, Budget und Wiederholung; Channex zählt Aufrufe pro Konto.

DIE ENDE-KONVENTION IST DIE HÄUFIGSTE FEHLERQUELLE: `date_to` im Payload ist
INKLUSIV — der letzte betroffene Tag, nicht der Tag danach. Die ganze Kette
(Sender, Outbox-Nachzug, Superseding) liest den Bereich mit beiden Enden
eingeschlossen. Wer intern exklusiv rechnet, zieht HIER einen Tag ab. Ein
exklusiv übergebenes Ende sperrt bei den Portalen stillschweigend einen Tag zu
viel, während der eigene Kalender ihn offen führt — der Fehler fällt erst beim
Vergleich der gesendeten Nutzlast mit der `availability` auf.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from supabase import Client

from .einheiten_verfuegbar import freie_einheiten_spannen
from .logging import get_logger

log = get_logger("publicapi.ari")


def _job_einreihen(db: Client, job_type: str, payload: dict[str, Any], tenant_id: str) -> None:
    """Job über die DB-Funktion einreihen — best effort.

    Best effort mit Absicht: der Abgleich ist asynchron, und der
    Reconcile-Tick des Worker holt einen verlorenen Push nach. Ein Fehler beim
    Einreihen darf deshalb den Aufruf des Kunden nicht kippen — seine Sperre ist
    ja bereits geschrieben. Er wird aber PROTOKOLLIERT, nicht verschluckt: ohne
    Logzeile wäre ein dauerhaft klemmender Push unsichtbar (Wurzel 5).
    """
    try:
        db.rpc(
            "enqueue_job",
            # `p_run_after` und `p_dedup_key` werden NICHT mitgeschickt: die
            # Funktion setzt `run_after` auf `now()`, und ein übergebenes NULL
            # würde die NOT-NULL-Spalte verletzen. Kein dedup_key ist hier
            # richtig — ARI-Pushes betreffen oft disjunkte Zeiträume, und ein
            # pauschaler Schlüssel würde sie zu „letzter gewinnt" verschmelzen
            # und frühere Zeiträume verlieren.
            {
                "p_job_type": job_type,
                "p_payload": payload,
                "p_tenant_id": tenant_id,
                "p_max_attempts": 10,
            },
        ).execute()
    except Exception as exc:  # noqa: BLE001 — Einreihen darf den Request nie kippen
        log.warning(
            "ari_job_nicht_eingereiht",
            job_type=job_type,
            tenant_id=tenant_id,
            fehler=str(exc)[:200],
        )


def verfuegbarkeit_melden(
    db: Client, tenant_id: str, property_id: str, von: date, bis_inkl: date
) -> None:
    """Den FERTIGEN Kalenderstand eines Zeitraums an die Portale melden.

    Gemeldet wird die echte Zahl freier Einheiten je Spanne — nicht 0/1. Ein
    festes `0` beim Sperren wäre zu viel, sobald die Sperre nur eine Einheit von
    fünf betrifft; ein festes `1` beim Freigeben zu wenig.

    VORAUSSETZUNG: der Kalender ist für den ganzen Zeitraum bereits geschrieben.
    Vor dem Schreiben gerufen, meldet diese Funktion den Zustand von VORHER —
    beim Sperren also zu viele freie Einheiten (Überbuchungsrisiko), beim
    Freigeben zu wenige (verschenkter Verkauf).
    """
    for span_von, span_bis, frei in freie_einheiten_spannen(
        db, tenant_id, property_id, von, bis_inkl
    ):
        _job_einreihen(
            db,
            "push_ari",
            {
                "kind": "availability",
                "tenant_id": tenant_id,
                "property_id": property_id,
                "date_from": span_von.isoformat(),
                "date_to": span_bis.isoformat(),  # inklusiv
                "availability": frei,
            },
            tenant_id,
        )


def preis_melden(
    db: Client,
    tenant_id: str,
    property_id: str,
    rate_plan_id: str,
    von: date,
    bis_inkl: date,
) -> None:
    """Geänderte Tagespreise eines Rate-Plans an die Portale melden."""
    _job_einreihen(
        db,
        "push_ari",
        {
            "kind": "rate",
            "tenant_id": tenant_id,
            "property_id": property_id,
            "rate_plan_id": rate_plan_id,
            "date_from": von.isoformat(),
            "date_to": bis_inkl.isoformat(),  # inklusiv
        },
        tenant_id,
    )


def restriktionen_melden(
    db: Client,
    tenant_id: str,
    property_id: str,
    rate_plan_id: str,
    von: date,
    bis_inkl: date,
) -> None:
    """Geänderte Aufenthaltsregeln melden (Mindest-/Höchstaufenthalt, An-/Abreisesperre)."""
    _job_einreihen(
        db,
        "push_ari",
        {
            "kind": "restrictions",
            "tenant_id": tenant_id,
            "property_id": property_id,
            "rate_plan_id": rate_plan_id,
            "date_from": von.isoformat(),
            "date_to": bis_inkl.isoformat(),  # inklusiv
        },
        tenant_id,
    )


def stop_sell_melden(
    db: Client, tenant_id: str, property_id: str, von: date, bis_inkl: date
) -> None:
    """Verkaufsstopp melden.

    Zusätzlich zur Verfügbarkeit, nicht statt ihr: Booking.com sieht beide
    Signale und verkauft, solange der Bestand > 0 ist. Deshalb muss ein
    Stop-Sell BEIDES senden — die Restriktion und die auf 0 gerechnete
    Stückzahl. `freie_einheiten_spannen` rechnet den Stop-Sell schon ein, also
    genügt es, danach `verfuegbarkeit_melden` zu rufen.
    """
    _job_einreihen(
        db,
        "push_ari",
        {
            "kind": "stop_sell",
            "tenant_id": tenant_id,
            "property_id": property_id,
            "date_from": von.isoformat(),
            "date_to": bis_inkl.isoformat(),  # inklusiv
        },
        tenant_id,
    )
