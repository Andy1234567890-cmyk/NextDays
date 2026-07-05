"""Background-Job-Worker (Skalierung 100 Betriebe, Migration 0102).

Ein eigener Prozess (`python -m src.worker`), der die generische `jobs`-Queue
abarbeitet: Channex-Content-Sync, ARI-Push, Reconcile, Recompute laufen hier
statt synchron im FastAPI-Request-Pfad. Damit blockiert kein Nutzer-Request mehr
auf einem langsamen Channex-Call, und die Sync-Last verteilt sich über einen
Concurrency-Pool statt seriell (Baseline: 800 Objekte seriell = ~40 min).

Substrat = Postgres (`jobs`), Reentrancy via `claim_jobs` (FOR UPDATE SKIP
LOCKED) → mehrere Worker-Instanzen sind race-frei. Zustand liegt in der DB →
ein Neustart/Crash verliert nichts; laufende Jobs recovert der Reaper.

Muster wie inbox/scheduler.py: async-Loop, synchrone DB-/Channex-Arbeit via
asyncio.to_thread, Fehler dürfen den Worker nie killen.
"""
from __future__ import annotations

import asyncio
import os
import signal
import socket
from collections.abc import Callable
from typing import Any

from supabase import Client

from src.core.logging import configure_logging, get_logger
from src.core.supabase import get_service_client
from src.jobs.queue import enqueue, next_run_after

log = get_logger("nextdays.worker")

# Parallel verarbeitete Jobs je Worker-Instanz. Begrenzt lokale Thread-/DB-Last;
# die eigentliche Channex-Grenze ist das Redis-Token-Budget (Folge-Baustein).
CONCURRENCY = int(os.getenv("WORKER_CONCURRENCY", "4"))
# Poll-Intervall, wenn zuletzt kein Job kam (idle). Bei Treffern sofort weiter.
IDLE_SLEEP_SECONDS = 1.0
# Ein 'running'-Job, dessen Worker abgestürzt ist, wird nach dieser Zeit requeued.
STUCK_AFTER_SECONDS = 300
# Zeit-Tick: Reconcile aller Tenants einreihen (ersetzt den externen 15-min-Cron).
RECONCILE_TICK_SECONDS = 15 * 60


# --- Job-Handler ------------------------------------------------------------
# Jeder Handler bekommt (db, payload) und delegiert an bestehende, tenant-
# gescopte Service-Methoden — keine neue Logik, nur Enqueue-Adapter. Ein Handler
# wirft bei retry-würdigem Fehler; No-op/erledigt → sauber zurückkehren.

def _svc(db: Client):  # noqa: ANN202 — interner Factory-Helper
    from src.features.channel_manager.channex_client import ChannexClient
    from src.features.channel_manager.service import ChannelManagerService

    return ChannelManagerService(service_client=db, channex=ChannexClient())


def _handle_sync_property_content(db: Client, payload: dict[str, Any]) -> None:
    _svc(db).sync_property_to_channex(
        payload["tenant_id"],
        property_id=payload["property_id"],
        title=payload.get("title") or "Unbenannt",
        currency=payload.get("currency") or "EUR",
    )


def _handle_reconcile_tenant(db: Client, payload: dict[str, Any]) -> None:
    _svc(db).reconcile_properties_for_tenant(payload["tenant_id"])


def _handle_recompute_property(db: Client, payload: dict[str, Any]) -> None:
    from src.features.pricing.recompute import DynamicPricingRecompute

    DynamicPricingRecompute(service_client=db).recompute_property(
        payload["property_id"]
    )


HANDLERS: dict[str, Callable[[Client, dict[str, Any]], None]] = {
    "sync_property_content": _handle_sync_property_content,
    "reconcile_tenant": _handle_reconcile_tenant,
    "recompute_property": _handle_recompute_property,
}


# --- Worker-Kern ------------------------------------------------------------

class Worker:
    """Claim-Loop mit Concurrency-Pool, Reaper und Zeit-Tick."""

    def __init__(self, db: Client | None = None) -> None:
        self._db = db or get_service_client()
        self._sem = asyncio.Semaphore(CONCURRENCY)
        self._stop = asyncio.Event()
        self._inflight: set[asyncio.Task] = set()
        self._worker_id = f"{socket.gethostname()}:{os.getpid()}"
        self._last_reconcile_tick = 0.0

    def request_stop(self) -> None:
        self._stop.set()

    def _claim(self, limit: int) -> list[dict[str, Any]]:
        return (
            self._db.rpc(
                "claim_jobs", {"p_limit": limit, "p_worker": self._worker_id}
            ).execute()
        ).data or []

    def _finish(self, job_id: str, status: str, error: str | None = None) -> None:
        patch: dict[str, Any] = {"status": status, "locked_at": None, "locked_by": None}
        if error is not None:
            patch["last_error"] = error[:1000]
        self._db.table("jobs").update(patch).eq("id", job_id).execute()

    def _retry(self, job: dict[str, Any], error: str) -> None:
        """Fehlgeschlagenen Job neu terminieren — oder 'dead', wenn Budget aus."""
        attempts = job.get("attempts") or 0
        if attempts >= (job.get("max_attempts") or 10):
            self._finish(job["id"], "dead", error)
            log.error("job_dead", id=job["id"], job_type=job["job_type"], error=error[:300])
            return
        self._db.table("jobs").update({
            "status": "queued", "locked_at": None, "locked_by": None,
            "last_error": error[:1000],
            "run_after": next_run_after(attempts).isoformat(),
        }).eq("id", job["id"]).execute()

    def _run_job(self, job: dict[str, Any]) -> None:
        """Synchron im Thread: Handler ausführen, Status setzen."""
        handler = HANDLERS.get(job["job_type"])
        if handler is None:
            self._finish(job["id"], "dead", f"unknown job_type: {job['job_type']}")
            log.error("job_unknown_type", id=job["id"], job_type=job["job_type"])
            return
        try:
            handler(self._db, job.get("payload") or {})
            self._finish(job["id"], "done")
        except Exception as exc:  # noqa: BLE001 — ein Job-Fehler darf den Worker nie killen
            self._retry(job, str(exc))
            log.warning("job_failed", id=job["id"], job_type=job["job_type"], error=str(exc)[:300])

    async def _dispatch(self, job: dict[str, Any]) -> None:
        async with self._sem:
            await asyncio.to_thread(self._run_job, job)

    async def _reap_stuck(self) -> None:
        try:
            res = await asyncio.to_thread(
                lambda: self._db.rpc(
                    "requeue_stuck_jobs", {"p_older_than_seconds": STUCK_AFTER_SECONDS}
                ).execute()
            )
            n = res.data if isinstance(res.data, int) else 0
            if n:
                log.info("jobs_reaped", count=n)
        except Exception as exc:  # noqa: BLE001
            log.warning("reap_failed", error=str(exc)[:200])

    async def _reconcile_tick(self, loop_time: float) -> None:
        """Alle 15 min je Tenant einen reconcile_tenant-Job einreihen. Coalescing
        über dedup_key (Zeit-Bucket) → mehrere Worker enqueuen nur einmal."""
        if loop_time - self._last_reconcile_tick < RECONCILE_TICK_SECONDS:
            return
        self._last_reconcile_tick = loop_time
        try:
            await asyncio.to_thread(self._enqueue_reconcile_all)
        except Exception as exc:  # noqa: BLE001
            log.warning("reconcile_tick_failed", error=str(exc)[:200])

    def _enqueue_reconcile_all(self) -> None:
        bucket = int(self._last_reconcile_tick // RECONCILE_TICK_SECONDS)
        rows = (
            self._db.table("channex_group_map").select("tenant_id").execute()
        ).data or []
        for r in rows:
            tid = r["tenant_id"]
            enqueue(
                self._db, "reconcile_tenant", tenant_id=tid,
                payload={"tenant_id": tid},
                dedup_key=f"reconcile_tick:{tid}:{bucket}",
            )

    async def run(self) -> None:
        log.info("worker_started", worker_id=self._worker_id, concurrency=CONCURRENCY)
        while not self._stop.is_set():
            loop_time = asyncio.get_running_loop().time()
            await self._reap_stuck()
            await self._reconcile_tick(loop_time)
            free = CONCURRENCY - len(self._inflight)
            jobs = await asyncio.to_thread(self._claim, free) if free > 0 else []
            for job in jobs:
                task = asyncio.create_task(self._dispatch(job))
                self._inflight.add(task)
                task.add_done_callback(self._inflight.discard)
            if not jobs:
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=IDLE_SLEEP_SECONDS)
                except TimeoutError:
                    pass
        # Graceful shutdown: laufende Jobs auslaufen lassen (< Docker-Grace 30s).
        if self._inflight:
            log.info("worker_draining", inflight=len(self._inflight))
            await asyncio.wait(self._inflight, timeout=25)
        log.info("worker_stopped")


async def _main() -> None:
    configure_logging("INFO", json_logs=True)
    worker = Worker()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, worker.request_stop)
    await worker.run()


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
