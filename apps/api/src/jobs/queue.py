"""Enqueue-API + Backoff-Logik der generischen Job-Queue (Migration 0102).

Die Services (properties/rates/calendar/pricing) reihen ihre Channex-Arbeit als
Job ein, statt synchron im Request-Pfad an Channex zu pushen. Der Worker
(src/worker.py) arbeitet die Jobs mit Concurrency-Pool + Channex-Token-Budget ab.

Coalescing: Ein `dedup_key` sorgt über den partiellen Unique-Index
`jobs_dedup_open_uq` dafür, dass mehrfaches Speichern desselben Objekts nicht N
Jobs erzeugt — höchstens EIN offener Job je Schlüssel.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.jobs.queue")

# Backoff-Staffel auf Job-Ebene (Minuten). Analog zum HTTP-Level-Backoff in
# channex_client (_RETRY_BACKOFF_SECONDS), aber gröber: ein fehlgeschlagener Job
# soll nicht sofort, aber auch nicht erst nach Stunden erneut laufen. Nach dem
# letzten Eintrag bleibt der Abstand konstant, bis max_attempts erreicht ist.
_BACKOFF_MINUTES = (1, 5, 15, 30, 60)


def next_run_after(attempts: int, *, now: datetime | None = None) -> datetime:
    """Fälligkeit für den nächsten Versuch nach `attempts` Fehlversuchen.

    Pur/deterministisch (für Unit-Tests). `attempts` ist die Zahl der bereits
    unternommenen Versuche (claim_jobs erhöht sie vor dem Handler-Lauf), also ist
    attempts>=1, wenn ein Job nach einem Fehler neu terminiert wird.
    """
    base = now or datetime.now(UTC)
    idx = min(max(attempts - 1, 0), len(_BACKOFF_MINUTES) - 1)
    return base + timedelta(minutes=_BACKOFF_MINUTES[idx])


def dedup_key(tenant_id: str | None, property_id: str, job_type: str,
              *, suffix: str | None = None) -> str:
    """Kanonischer Coalescing-Schlüssel. Gleicher Schlüssel → höchstens ein
    offener Job. `suffix` trennt Untertypen (z. B. push_ari nach kind)."""
    parts = [tenant_id or "global", property_id, job_type]
    if suffix:
        parts.append(suffix)
    return ":".join(parts)


def enqueue(
    db: Client,
    job_type: str,
    *,
    payload: dict[str, Any],
    tenant_id: str | None = None,
    dedup_key: str | None = None,  # noqa: A002 — bewusst gleicher Name wie Spalte
    delay_seconds: int = 0,
    max_attempts: int = 10,
) -> None:
    """Einen Job einreihen. Idempotent bei gesetztem `dedup_key` (Coalescing):
    ist bereits ein offener Job mit demselben Schlüssel vorhanden, wird dessen
    Payload aktualisiert (letzter Stand gewinnt) statt ein Duplikat anzulegen.

    Best-effort by design — der Aufrufer kapselt dies in try/except, damit das
    Einreihen den Request-Pfad nie kippt (wie die alten inline-Pushes)."""
    run_after = datetime.now(UTC) + timedelta(seconds=delay_seconds)
    row: dict[str, Any] = {
        "job_type": job_type,
        "tenant_id": tenant_id,
        "payload": payload,
        "dedup_key": dedup_key,
        "max_attempts": max_attempts,
        "run_after": run_after.isoformat(),
    }
    if dedup_key is not None:
        # on_conflict auf den partiellen Unique-Index: bestehenden offenen Job mit
        # dem neuen Payload überschreiben ("letzter gewinnt"). Erledigte Jobs
        # (done/failed/dead) sind nicht im Index → blockieren keinen neuen.
        db.table("jobs").upsert(row, on_conflict="dedup_key").execute()
    else:
        db.table("jobs").insert(row).execute()
    log.info("job_enqueued", job_type=job_type, tenant_id=tenant_id,
             dedup_key=dedup_key)
