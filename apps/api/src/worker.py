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
import contextlib
import os
import signal
import socket
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.config import get_settings
from src.core.logging import configure_logging, get_logger
from src.core.supabase import get_service_client
from src.jobs.channex_budget import BudgetDecision, ChannexBudget
from src.jobs.queue import enqueue, next_run_after

log = get_logger("nextdays.worker")

# Job-Typen, die tatsächlich an Channex pushen. Sie bekommen das kontoweite
# Channex-Budget NICHT mehr als einmaliges Vorab-Gate, sondern PRO ECHTEM
# HTTP-CALL: der ChannexClient zieht über ein before_call-Callback vor jedem
# Request ein Token (siehe channex_client._request). Grund: Batch-Jobs
# (reconcile_tenant über hunderte Objekte, process_ari_outbox mit bis zu 200
# Zeilen) machen je Job SEHR VIELE Calls — ein einmaliges Vorab-Gate für 1
# Token hätte das Konto-Limit umgangen. Ein per-Call abgelehnter Job wirft
# ChannexBudgetExhausted → der Worker verzögert (deferred) ihn, ohne einen
# Retry-Versuch zu verbrennen.
_CHANNEX_JOB_TYPES = frozenset(
    {"sync_property_content", "reconcile_tenant", "push_ari", "process_ari_outbox",
     "process_restriction_outbox",
     # recompute_property pusht die meisten Rate-Calls (Tagespreise über den
     # 365-Tage-Horizont) — MUSS das kontoweite Channex-Token-Budget ziehen.
     "recompute_property"}
)

# Parallel verarbeitete Jobs je Worker-Instanz. Begrenzt lokale Thread-/DB-Last;
# die eigentliche Channex-Grenze ist das Redis-Token-Budget (Folge-Baustein).
CONCURRENCY = int(os.getenv("WORKER_CONCURRENCY", "4"))
# Poll-Intervall, wenn zuletzt kein Job kam (idle). Bei Treffern sofort weiter.
IDLE_SLEEP_SECONDS = 1.0
# Ein 'running'-Job, dessen Worker abgestürzt ist, wird nach dieser Zeit requeued.
STUCK_AFTER_SECONDS = 300
# locked_at-Refresh je laufendem Job: Langläufer (reconcile_tenant über hunderte
# Objekte, process_ari_outbox mit 200 Zeilen) überschreiten STUCK_AFTER_SECONDS
# regelmäßig. Ohne Heartbeat requeued der Reaper einen NOCH LAUFENDEN Job →
# Doppelausführung/Doppel-Push an Channex. Mit Heartbeat trifft der Reaper nur
# noch tote Worker (5 verpasste Heartbeats).
JOB_HEARTBEAT_SECONDS = 60
# Zeit-Tick: Reconcile aller Tenants einreihen (ersetzt den externen 15-min-Cron).
RECONCILE_TICK_SECONDS = 15 * 60
# Max. aufeinanderfolgende Budget-Verzögerungen (defer_count), bevor ein Job
# aufgibt ('dead'). Deckel gegen Endlos-Defer-Livelock bei dauerhaft totem Redis.
# Großzügig, damit legitimes Warten auf ein volles Budget-Fenster nie greift.
_MAX_DEFERS = 100
# Heartbeat-Datei für den Docker-Healthcheck: der Run-Loop schreibt sie je
# Durchlauf neu (idle ≤ 1 s, unter Last je Claim-Zyklus). Der Healthcheck im
# Worker-Compose meldet unhealthy, wenn sie älter als 120 s ist — so wird ein
# HÄNGENDER Event-Loop sichtbar, nicht nur ein toter Prozess (den fängt schon
# restart: unless-stopped, weil der Worker PID 1 ist).
HEARTBEAT_PATH = os.getenv(
    "WORKER_HEARTBEAT_PATH",
    # noqa: S108 — Container-privates /tmp (1 Prozess); per Env übersteuerbar.
    "/tmp/worker-heartbeat",  # noqa: S108
)


# --- Job-Handler ------------------------------------------------------------
# Jeder Handler bekommt (db, payload) und delegiert an bestehende, tenant-
# gescopte Service-Methoden — keine neue Logik, nur Enqueue-Adapter. Ein Handler
# wirft bei retry-würdigem Fehler; No-op/erledigt → sauber zurückkehren.

def _svc(db: Client, budget: ChannexBudget | None = None):  # noqa: ANN202
    """ChannelManagerService bauen. Ist ein `budget` gegeben, bekommt der
    ChannexClient dessen try_consume als before_call-Callback → jeder echte
    HTTP-Call zieht ein Token (per-Call-Gate für Batch-Jobs). Ohne budget läuft
    der Client unverändert (Nicht-Channex-Handler brauchen kein Gate)."""
    from src.features.channel_manager.channex_client import ChannexClient
    from src.features.channel_manager.service import ChannelManagerService

    before_call = budget.try_consume if budget is not None else None
    return ChannelManagerService(
        service_client=db, channex=ChannexClient(before_call=before_call)
    )


def _handle_sync_property_content(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    _svc(db, budget).sync_property_to_channex(
        payload["tenant_id"],
        property_id=payload["property_id"],
        title=payload.get("title") or "Unbenannt",
        currency=payload.get("currency") or "EUR",
    )


def _handle_reconcile_tenant(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    _svc(db, budget).reconcile_properties_for_tenant(payload["tenant_id"])


def _handle_process_ari_outbox(
    db: Client, _payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Offene ari_outbox-Zeilen (ausgehende ARI-Pushes) erneut an Channex pushen.
    Ersetzt den finalen process_ari_outbox()-Schritt des alten Host-Crons: die
    per-Tenant-reconcile_tenant-Jobs spiegeln nur Channex→DB, arbeiten die outbox
    aber NICHT ab. Tenant-übergreifend (die outbox ist nicht tenant-gefiltert),
    darum einmal je Tick als eigener Job statt pro Tenant."""
    _svc(db, budget).process_ari_outbox()


def _handle_process_restriction_outbox(
    db: Client, _payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Offene ari_restriction_outbox-Zeilen (Stop-Sell/Rate/Min-Stay/Max-Stay/
    CTA-CTD) erneut an Channex pushen — der dauerhafte Backstop für Restriktions-
    Pushes (analog process_ari_outbox für Availability). Baut je Zeile die values
    aus dem persistierten kind+payload neu auf und löst das Rate-Plan-Mapping
    frisch auf (Selbstheilung, sobald der Rate-Plan-Import gelaufen ist). Tenant-
    übergreifend, darum einmal je Tick als eigener Job statt pro Tenant."""
    _svc(db, budget).process_restriction_outbox()


def _handle_recompute_property(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    from src.features.pricing.recompute import DynamicPricingRecompute

    # Budget durchreichen → der Rate-Push aus dem Recompute zieht pro HTTP-Call ein
    # Channex-Token (kein Umgehen des kontoweiten Limits bei Churn über viele Objekte).
    DynamicPricingRecompute(
        service_client=db, channex_budget=budget
    ).recompute_property(payload["property_id"])


def _handle_push_ari(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Generischer ARI-Push (Availability/Rate/Max-Stay/Restrictions/Stop-Sell)
    für einen Zeitraum. `kind` wählt die Ziel-Methode; die übrigen Payload-Felder
    sind die Argumente. Ersetzt die früher synchron im Request-Pfad laufenden
    _push_channex_*-Aufrufe (calendar/rates) — dieselben Service-Methoden, nur
    jetzt asynchron im Worker mit Channex-Token-Budget."""
    from datetime import date

    # push_*-Methoden liegen direkt am Service (AriPushMixin).
    push = _svc(db, budget)
    kind = payload["kind"]
    tenant_id = payload["tenant_id"]
    property_id = payload["property_id"]

    def _d(key: str) -> date:
        return date.fromisoformat(payload[key])

    # Die push_*-Methoden geben True zurück, wenn der Channex-Call fehlschlug
    # (statt zu werfen — im Request-Pfad sind sie best-effort). Hier im Worker
    # heben wir das Signal zu einer Exception, damit _run_job → _retry den
    # schnellen Job-Backoff (1/5/15 min) startet, statt den Push bis zum
    # 15-min-Reconcile-Tick liegen zu lassen (oder ganz zu verlieren).
    if kind == "availability":
        failed = push.push_availability_for_property(
            tenant_id, property_id, _d("date_from"), _d("date_to"),
            int(payload["availability"]),
            # Vom Request-Pfad bereits persistierte Outbox-Zeile (RPC 0104 bzw.
            # _write_ari_outbox) abarbeiten statt eine zweite anzulegen.
            outbox_id=payload.get("outbox_id"),
        )
    elif kind == "rate":
        failed = push.push_rate_for_property(
            tenant_id, property_id, _d("date_from"), _d("date_to"),
            rate_cents=payload.get("rate_cents"), min_stay=payload.get("min_stay"),
        )
    elif kind == "max_stay":
        failed = push.push_max_stay_for_property(
            tenant_id, property_id, _d("date_from"), _d("date_to"),
            int(payload["max_stay"]),
        )
    elif kind == "restrictions":
        failed = push.push_restrictions_for_property(
            tenant_id, property_id, _d("date_from"), _d("date_to"),
            closed_to_arrival=payload.get("closed_to_arrival"),
            closed_to_departure=payload.get("closed_to_departure"),
        )
    elif kind == "stop_sell":
        spans = [(date.fromisoformat(a), date.fromisoformat(b))
                 for a, b in payload["spans"]]
        failed = push.push_stop_sell_for_property(
            tenant_id, property_id, spans,
            stop_sell=bool(payload["stop_sell"]),
            days=payload.get("days"),
        )
    else:
        raise ValueError(f"unbekannter ARI-kind: {kind}")

    if failed:
        # Channex war nicht erreichbar → Job-Retry auslösen (Backoff). _run_job
        # fängt die Exception und ruft _retry (1/5/15-min-Staffel). Bei
        # 'availability' bleibt die ari_outbox zusätzlich als Backstop bestehen.
        raise RuntimeError(
            f"ARI-Push ({kind}) an Channex fehlgeschlagen — Job wird erneut versucht."
        )


class _ProgressBudget:
    """Dünner Wrapper um ein ChannexBudget, der die ERFOLGREICH vergebenen Token
    zählt (= echte Channex-Calls, die durchgingen). So erkennt _run_job, ob ein
    Batch-Job vor einem ChannexBudgetExhausted schon Fortschritt gemacht hat, und
    setzt dann den defer_count-Livelock-Zähler zurück. Erfüllt das before_call-
    Kontrakt (try_consume) transparent — der ChannexClient merkt keinen Unterschied."""

    def __init__(self, inner: ChannexBudget) -> None:
        self._inner = inner
        self.granted = 0

    def try_consume(self, channex_property_id: str | None) -> BudgetDecision:
        decision = self._inner.try_consume(channex_property_id)
        if decision.allowed:
            self.granted += 1
        return decision


HANDLERS: dict[
    str, Callable[[Client, dict[str, Any], ChannexBudget | None], None]
] = {
    "sync_property_content": _handle_sync_property_content,
    "reconcile_tenant": _handle_reconcile_tenant,
    "recompute_property": _handle_recompute_property,
    "push_ari": _handle_push_ari,
    "process_ari_outbox": _handle_process_ari_outbox,
    "process_restriction_outbox": _handle_process_restriction_outbox,
}


# --- Worker-Kern ------------------------------------------------------------

class Worker:
    """Claim-Loop mit Concurrency-Pool, Reaper und Zeit-Tick."""

    def __init__(
        self, db: Client | None = None, budget: ChannexBudget | None = None
    ) -> None:
        self._db = db or get_service_client()
        self._sem = asyncio.Semaphore(CONCURRENCY)
        self._stop = asyncio.Event()
        self._inflight: set[asyncio.Task] = set()
        self._worker_id = f"{socket.gethostname()}:{os.getpid()}"
        self._last_reconcile_tick = 0.0
        # Kontoweites Channex-Token-Budget (Phase 1b): vor jedem Channex-Push wird
        # ein Token verbraucht, sonst wird der Job verzögert statt Channex überfahren.
        self._budget = budget or ChannexBudget(get_settings())

    def request_stop(self) -> None:
        self._stop.set()

    def _touch_heartbeat(self) -> None:
        with open(HEARTBEAT_PATH, "w", encoding="utf-8") as fh:
            fh.write(datetime.now(UTC).isoformat())

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
        # Guard: nur den EIGENEN, noch laufenden Claim abschließen. Hat der
        # Reaper den Job inzwischen requeued (und ggf. ein anderer Worker ihn
        # neu geclaimt), würde ein blindes Update dessen Zustand überschreiben.
        res = (
            self._db.table("jobs").update(patch)
            .eq("id", job_id)
            .eq("locked_by", self._worker_id)
            .eq("status", "running")
            .execute()
        )
        if not (res.data or []):
            log.warning("job_finish_lost_claim", id=job_id, status=status)

    def _requeue(self, job: dict[str, Any], patch: dict[str, Any]) -> None:
        """Einen laufenden Job zurück auf 'queued' setzen (Retry/Defer).

        Fängt die Kollision mit dem partiellen Unique-Index jobs_dedup_queued_uq
        (0108: dedup_key WHERE status='queued') ab: solange dieser Job 'running'
        war, durfte ein neuer enqueue_job(dedup_key) eine ZWEITE 'queued'-Zeile
        anlegen (genau das Ziel von 0108). Ein blindes running→queued würde dann
        eine zweite 'queued'-Zeile mit demselben dedup_key erzeugen → 23505; ohne
        Fangen bliebe der Job dauerhaft 'running' stecken. In dem Fall erledigt der
        bereits eingereihte Zwilling die Arbeit → diesen Job sauber als 'done'
        abschließen (kein Verlust, keine Dublette)."""
        try:
            self._db.table("jobs").update(patch).eq("id", job["id"]).eq(
                "locked_by", self._worker_id  # Guard wie _finish: nur eigenen Claim
            ).eq("status", "running").execute()
        except APIError as exc:
            if "jobs_dedup_queued_uq" not in str(exc):
                raise
            log.info(
                "job_requeue_dedup_yield",
                id=job["id"], job_type=job.get("job_type"),
            )
            self._finish(
                job["id"], "done",
                "übersprungen — bereits neu eingereiht (dedup_key)",
            )

    def _retry(self, job: dict[str, Any], error: str) -> None:
        """Fehlgeschlagenen Job neu terminieren — oder 'dead', wenn Budget aus."""
        attempts = job.get("attempts") or 0
        if attempts >= (job.get("max_attempts") or 10):
            self._finish(job["id"], "dead", error)
            log.error("job_dead", id=job["id"], job_type=job["job_type"], error=error[:300])
            return
        self._requeue(job, {
            "status": "queued", "locked_at": None, "locked_by": None,
            "last_error": error[:1000],
            "run_after": next_run_after(attempts).isoformat(),
        })

    def _defer(
        self, job: dict[str, Any], retry_after: int, *, progressed: bool = False
    ) -> None:
        """Job wegen erschöpftem Channex-Budget verzögern: zurück auf queued mit
        run_after = jetzt + retry_after (genau bis das nächste Token frei wird),
        OHNE attempts zu verbrauchen (es ist kein Fehler, nur Warten). claim_jobs
        hat attempts beim Claim erhöht → hier −1 zurückdrehen, damit das Retry-
        Budget nicht durch Budget-Wartephasen aufgezehrt wird.

        Deckel gegen Livelock: bei DAUERHAFT totem Redis liefert das Budget nie ein
        Token → der Job defert unendlich (attempts wird nie verbraucht, erreicht nie
        'dead'). Ein separater defer_count deckelt das: nach _MAX_DEFERS Verzögerungen
        OHNE Fortschritt gibt der Job auf ('dead'), statt zyklisch einen Slot zu
        belegen. `progressed`=True (der Batch-Job hat vor dem Erschöpfen echte Calls
        gepusht) setzt defer_count ZURÜCK — ein Batch, der je Tick voranarbeitet
        (Normalbetrieb unter Last), stirbt so nicht fälschlich mid-batch."""
        defer_count = 0 if progressed else (job.get("defer_count") or 0) + 1
        if defer_count > _MAX_DEFERS:
            self._finish(
                job["id"], "dead",
                "Channex-Budget dauerhaft nicht verfügbar (Redis-Ausfall?) — "
                f"nach {_MAX_DEFERS} Verzögerungen aufgegeben.",
            )
            log.error(
                "job_dead_defer_livelock",
                id=job["id"], job_type=job.get("job_type"), defer_count=defer_count,
            )
            return
        attempts = max((job.get("attempts") or 1) - 1, 0)
        run_after = datetime.now(UTC) + timedelta(seconds=max(retry_after, 1))
        self._requeue(job, {
            "status": "queued", "locked_at": None, "locked_by": None,
            "attempts": attempts, "defer_count": defer_count,
            "run_after": run_after.isoformat(),
        })

    def _run_job(self, job: dict[str, Any]) -> None:
        """Synchron im Thread: Handler ausführen, Status setzen.

        Das Channex-Budget wird NICHT mehr einmalig vorab gezogen, sondern
        PRO ECHTEM HTTP-CALL im ChannexClient (before_call-Callback). Nur die
        pushenden Job-Typen bekommen das Budget durchgereicht; Nicht-Channex-
        Jobs (recompute_property) laufen ohne Gate. Reißt der Budget-Vorrat
        mitten im Batch, wirft der Client ChannexBudgetExhausted → der Job wird
        verzögert (deferred, ohne Retry-Versuch zu verbrennen) und läuft nach
        retry_after ab dem bereits erledigten Punkt weiter (Handler idempotent).
        """
        from src.features.channel_manager.channex_client import ChannexBudgetExhausted

        handler = HANDLERS.get(job["job_type"])
        if handler is None:
            self._finish(job["id"], "dead", f"unknown job_type: {job['job_type']}")
            log.error("job_unknown_type", id=job["id"], job_type=job["job_type"])
            return
        # Fortschritts-Zähler: der Budget-Wrapper zählt jeden ERFOLGREICH vergebenen
        # Token = jeder echte Channex-Call, der durchging. Erschöpft das Budget
        # MITTEN im Batch (Normalbetrieb unter Last), hat der Job bis dahin bereits
        # Zeilen gepusht → progressed=True → _defer setzt defer_count zurück. Nur ein
        # Job OHNE jeden Fortschritt (echter Redis-Ausfall: schon der 1. Token wird
        # verweigert) läuft in den defer_count-Deckel und stirbt als 'dead'.
        budget = (
            _ProgressBudget(self._budget)
            if job["job_type"] in _CHANNEX_JOB_TYPES
            else None
        )
        try:
            handler(self._db, job.get("payload") or {}, budget)
            self._finish(job["id"], "done")
        except ChannexBudgetExhausted as exc:
            # Budget mitten im Job erschöpft → verzögern statt Retry verbrennen.
            progressed = budget is not None and budget.granted > 0
            self._defer(job, exc.retry_after, progressed=progressed)
            log.info("job_deferred_budget", id=job["id"], job_type=job["job_type"],
                     retry_after=exc.retry_after, progressed=progressed)
        except Exception as exc:  # noqa: BLE001 — ein Job-Fehler darf den Worker nie killen
            self._retry(job, str(exc))
            log.warning("job_failed", id=job["id"], job_type=job["job_type"], error=str(exc)[:300])

    async def _dispatch(self, job: dict[str, Any]) -> None:
        async with self._sem:
            heartbeat = asyncio.create_task(self._job_heartbeat(job["id"]))
            try:
                await asyncio.to_thread(self._run_job, job)
            finally:
                heartbeat.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await heartbeat

    async def _job_heartbeat(self, job_id: str) -> None:
        """locked_at des laufenden Jobs periodisch auffrischen, solange der
        Handler läuft. Der Reaper requeued Jobs mit locked_at älter als
        STUCK_AFTER_SECONDS — ohne Heartbeat traf das auch legitime Langläufer
        (reconcile_tenant über hunderte Objekte ≫ 300 s) und erzeugte
        Doppelausführungen. Mit Heartbeat heißt „stuck" nur noch: Worker tot."""
        while True:
            await asyncio.sleep(JOB_HEARTBEAT_SECONDS)
            try:
                await asyncio.to_thread(
                    lambda: self._db.table("jobs")
                    .update({"locked_at": datetime.now(UTC).isoformat()})
                    .eq("id", job_id)
                    .eq("locked_by", self._worker_id)
                    .eq("status", "running")
                    .execute()
                )
            except Exception as exc:  # noqa: BLE001 — Heartbeat-Fehler nie fatal
                log.warning("job_heartbeat_failed", id=job_id, error=str(exc)[:200])

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
        # Coalescing-Bucket aus der WALL-CLOCK (time.time()), NICHT aus der
        # Monotonic-Loop-Uhr: loop.time() hat pro Prozess einen anderen, undefinierten
        # Nullpunkt. Zwei Worker-Instanzen (oder derselbe Worker über einen Neustart)
        # berechneten daraus für denselben Wandzeit-Tick verschiedene Buckets →
        # dedup_keys kollidierten nie → das versprochene Cross-Instance-/Cross-Restart-
        # Coalescing griffe nicht (N-fache Reconcile-/Channex-Last bei N Instanzen).
        # Die Wall-Clock ist über alle Instanzen gleich → gemeinsamer Bucket.
        bucket = int(time.time() // RECONCILE_TICK_SECONDS)
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
        # Ausgehende ARI-Pushes (ari_outbox) tenant-übergreifend nachziehen — den
        # per-Tenant-Jobs fehlt dieser Schritt. Einmal je Tick (Bucket-Coalescing),
        # entspricht dem finalen process_ari_outbox() des alten Host-Crons.
        enqueue(
            self._db, "process_ari_outbox",
            payload={}, dedup_key=f"ari_outbox_tick:{bucket}",
        )
        # Ausgehende Restriktions-Pushes (Stop-Sell/Rate/Min-/Max-Stay/CTA-CTD)
        # tenant-übergreifend nachziehen — der dauerhafte Backstop, den es vor 0115
        # nur für Availability gab. Ein gescheiterter Verkaufsstopp/Preis heilt so
        # selbst (auch nach nachträglichem Rate-Plan-Import). Einmal je Tick.
        enqueue(
            self._db, "process_restriction_outbox",
            payload={}, dedup_key=f"ari_restriction_outbox_tick:{bucket}",
        )

    async def run(self) -> None:
        log.info("worker_started", worker_id=self._worker_id, concurrency=CONCURRENCY)
        while not self._stop.is_set():
            self._touch_heartbeat()
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
