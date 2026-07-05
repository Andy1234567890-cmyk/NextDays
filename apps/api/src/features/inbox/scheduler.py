"""Sekundengenauer In-App-Scheduler für geplante Posteingang-Nachrichten.

Statt eines Cron-Polls (max. 1 Tick Verzögerung) setzt dieser Scheduler pro
geplanter Nachricht einen asyncio-Timer exakt auf `send_at`. Eine für 15:36:04
geplante Nachricht geht damit um 15:36:04 raus — auf die Sekunde.

Lebenszyklus:
- Beim App-Start (lifespan) werden alle offenen pending-Nachrichten geladen und
  ihre Timer (neu) gesetzt → übersteht Neustarts/Deploys.
- `schedule(...)` setzt beim Planen sofort einen Timer (ohne auf Reload zu warten).
- Fällige (send_at <= jetzt) gehen sofort raus.
- Der versendende Aufruf ist synchron (Supabase-Client) → via to_thread, damit
  der Event-Loop frei bleibt.

Der Cron-Endpoint bleibt als Sicherheitsnetz bestehen (falls ein Timer durch
einen harten Crash verloren geht), ist aber nicht mehr der primäre Weg.
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client

log = get_logger("nextdays.inbox.scheduler")

# Offene Timer: scheduled_message.id -> asyncio.Task (zum Abbrechen bei Cancel).
_timers: dict[str, asyncio.Task] = {}
_loop: asyncio.AbstractEventLoop | None = None


def _parse(ts: str) -> datetime:
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt


def _send_now(scheduled_id: str) -> None:
    """Synchron: fällige Nachricht versenden + Status setzen (im Thread)."""
    # Lokaler Import vermeidet Zirkularität (service importiert scheduler).
    from .service import InboxService

    db = get_service_client()
    row = (
        db.table("inbox_scheduled_message")
        .select("id, tenant_id, thread_id, body, status")
        .eq("id", scheduled_id)
        .limit(1)
        .execute()
    ).data
    if not row:
        return
    s = row[0]
    # ATOMARES CLAIM: nur EIN Versandpfad darf die Zeile senden. Der In-App-Timer
    # UND der Cron-Sicherheitsnetz-Tick verarbeiten dieselben pending-Zeilen; ohne
    # Claim entstünde ein TOCTOU-Fenster zwischen Read und dem finalen 'sent'-
    # Update → Gast bekäme die Nachricht zweimal. UPDATE ... WHERE status='pending'
    # gewinnt genau einer; die leere Rückgabe zeigt den Verlierern „schon geclaimt".
    claimed = (
        db.table("inbox_scheduled_message")
        .update({"status": "sending"})
        .eq("id", scheduled_id)
        .eq("status", "pending")
        .execute()
    ).data
    if not claimed:
        return  # anderer Pfad hat die Zeile bereits geclaimt/gesendet/abgebrochen
    svc = InboxService(service_client=db)
    try:
        ctx = AuthContext(user_id="scheduler", tenant_id=s["tenant_id"])
        # Berechtigung wurde beim Planen geprüft → interner Versand ohne Reply-Guard.
        svc.send_message(ctx, s["thread_id"], s["body"], enforce_reply=False)
        db.table("inbox_scheduled_message").update({"status": "sent"}).eq(
            "id", scheduled_id
        ).execute()
        log.info("scheduled_sent", id=scheduled_id)
    except Exception as exc:  # noqa: BLE001 — Scheduler darf nicht sterben
        db.table("inbox_scheduled_message").update(
            {"status": "failed", "last_error": str(exc)[:500]}
        ).eq("id", scheduled_id).execute()
        log.error("scheduled_failed", id=scheduled_id, error=str(exc))


async def _wait_and_send(scheduled_id: str, send_at: str) -> None:
    try:
        delay = (_parse(send_at) - datetime.now(UTC)).total_seconds()
        if delay > 0:
            await asyncio.sleep(delay)
        await asyncio.to_thread(_send_now, scheduled_id)
    finally:
        # Cancel des Plans propagiert über CancelledError; der Timer wird in
        # jedem Fall (Erfolg, Cancel, Fehler) aus der Registry entfernt.
        _timers.pop(scheduled_id, None)


def schedule(scheduled_id: str, send_at: str) -> None:
    """Timer für EINE Nachricht setzen (thread-safe vom Request aus aufrufbar)."""
    if _loop is None or not _loop.is_running():
        # Kein laufender Loop (z.B. im Test) → der Cron/Startup übernimmt.
        return

    def _create() -> None:
        old = _timers.pop(scheduled_id, None)
        if old:
            old.cancel()
        _timers[scheduled_id] = _loop.create_task(
            _wait_and_send(scheduled_id, send_at)
        )

    _loop.call_soon_threadsafe(_create)


def cancel(scheduled_id: str) -> None:
    """Timer einer abgebrochenen Nachricht stoppen."""
    if _loop is None:
        return

    def _cancel() -> None:
        task = _timers.pop(scheduled_id, None)
        if task:
            task.cancel()

    _loop.call_soon_threadsafe(_cancel)


def _load_pending() -> list[dict]:
    db = get_service_client()
    return (
        db.table("inbox_scheduled_message")
        .select("id, send_at")
        .eq("status", "pending")
        .execute()
    ).data or []


async def start() -> None:
    """Beim App-Start: Loop merken + alle offenen pending-Nachrichten timern.

    PostgREST/DB sind beim Container-Boot evtl. noch nicht bereit (502) — daher
    mit Backoff erneut versuchen, statt die pending-Nachrichten zu verlieren.
    """
    # Modul-globaler Loop-Singleton: schedule() (vom Request-Thread) braucht den
    # beim Start gemerkten Event-Loop, um Timer thread-safe einzuhängen.
    global _loop  # pylint: disable=global-statement
    _loop = asyncio.get_running_loop()
    delays = [1, 2, 5, 10, 15, 30]
    for attempt, wait in enumerate([0, *delays]):
        if wait:
            await asyncio.sleep(wait)
        try:
            rows = await asyncio.to_thread(_load_pending)
            for r in rows:
                schedule(r["id"], r["send_at"])
            log.info("scheduler_started", restored=len(rows), attempt=attempt)
            return
        except Exception as exc:  # noqa: BLE001 — App-Start darf nicht scheitern
            log.warning("scheduler_start_retry", attempt=attempt, error=str(exc)[:200])
    log.error("scheduler_start_failed", reason="DB nach Retries nicht bereit")


async def stop() -> None:
    """Beim App-Stop: laufende Timer abbrechen."""
    for task in list(_timers.values()):
        task.cancel()
    _timers.clear()
