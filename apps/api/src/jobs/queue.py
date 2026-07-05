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


# --- Best-effort-Wrapper für die Services (Phase 2) --------------------------
# Die Slices rufen diese statt inline an Channex zu pushen. Sie kapseln das
# try/except selbst, damit ein DB-/Queue-Fehler den Request-Pfad NIE kippt — der
# Sync ist ohnehin asynchron und wird vom Reconcile-Tick nachgeholt, falls das
# Einreihen scheitert. Bewusst breit gefangen (wie die alten inline-Pushes).

def try_enqueue_content_sync(
    db: Client, tenant_id: str, property_id: str,
    *, title: str | None = None, currency: str | None = None,
) -> None:
    """Vollen Channex-Content-Sync eines Objekts einreihen (coalesced je Objekt)."""
    try:
        enqueue(
            db, "sync_property_content", tenant_id=tenant_id,
            payload={"tenant_id": tenant_id, "property_id": property_id,
                     "title": title, "currency": currency},
            dedup_key=dedup_key(tenant_id, property_id, "sync_property_content"),
        )
    except Exception as exc:  # noqa: BLE001 — Einreihen darf den Request nie kippen
        log.warning("enqueue_content_sync_failed", property_id=property_id,
                    error=str(exc)[:200])


def try_enqueue_recompute(db: Client, tenant_id: str, property_id: str) -> None:
    """DP-Recompute eines Objekts als Job einreihen (coalesced je Objekt). Der
    Handler rechnet die Tagespreise neu und pusht sie via push_rates_batch."""
    try:
        enqueue(
            db, "recompute_property", tenant_id=tenant_id,
            payload={"property_id": property_id},
            dedup_key=dedup_key(tenant_id, property_id, "recompute_property"),
        )
    except Exception as exc:  # noqa: BLE001 — Einreihen darf den Request nie kippen
        log.warning("enqueue_recompute_failed", property_id=property_id,
                    error=str(exc)[:200])


def try_enqueue_ari(
    db: Client, tenant_id: str, property_id: str, kind: str,
    fields: dict[str, Any], *, coalesce: bool = False,
) -> None:
    """Einen ARI-Push (kind = availability|rate|max_stay|restrictions|stop_sell)
    für ein Objekt einreihen. `fields` sind die kind-spezifischen Payload-Werte
    (date_from/date_to als ISO-Strings, availability/rate_cents/… je nach kind).

    WICHTIG zum Coalescing: standardmäßig KEIN dedup_key. Reine ARI-Pushes
    betreffen oft DISJUNKTE Zeiträume (zwei Blocks in verschiedenen Monaten; alte
    Freigabe + neue Belegung beim Umbuchen). Ein pauschaler dedup_key würde sie via
    "letzter gewinnt" verschmelzen und frühere Ranges verlieren → verlorene
    Verfügbarkeits-/Preis-Updates. Die ari_outbox dedupliziert bereits auf
    Zeilenebene, und der Reconcile-Tick gleicht ab.

    `coalesce=True` NUR setzen, wenn der Push IMMER den vollen Horizont des Objekts
    abdeckt (z. B. property-weiter min_stay/max_stay über 365 Tage) — dann ist
    "letzter gewinnt" korrekt und spart Stau bei häufigem Speichern.
    """
    key = (
        dedup_key(tenant_id, property_id, "push_ari", suffix=kind)
        if coalesce else None
    )
    try:
        enqueue(
            db, "push_ari", tenant_id=tenant_id,
            payload={"kind": kind, "tenant_id": tenant_id,
                     "property_id": property_id, **fields},
            dedup_key=key,
        )
    except Exception as exc:  # noqa: BLE001 — Einreihen darf den Request nie kippen
        log.warning("enqueue_ari_failed", property_id=property_id, kind=kind,
                    error=str(exc)[:200])
