"""Tests für die Worker-Claim-Guards + Job-Heartbeat (Reaper-Doppelausführung).

Kontext: Der Reaper (requeue_stuck_jobs) setzt 'running'-Jobs mit altem
locked_at zurück auf 'queued'. Ohne Heartbeat traf das auch legitime Langläufer
→ Doppelausführung; ohne locked_by-Guard überschrieb der langsame Original-
Worker anschließend blind den Zustand des neu geclaimten Jobs.
"""
from unittest.mock import MagicMock

from src.worker import JOB_HEARTBEAT_SECONDS, STUCK_AFTER_SECONDS, Worker


def _worker() -> tuple[Worker, MagicMock]:
    db = MagicMock(name="supabase")
    w = Worker(db=db, budget=MagicMock())
    return w, db


def _update_chain_filters(db: MagicMock) -> list[tuple]:
    """Alle eq()-Filter der letzten jobs.update()-Kette einsammeln."""
    chain = db.table.return_value.update.return_value
    filters = [tuple(chain.eq.call_args.args)] if chain.eq.called else []
    nested = chain.eq.return_value
    while getattr(nested, "eq", None) is not None and nested.eq.called:
        filters.append(tuple(nested.eq.call_args.args))
        nested = nested.eq.return_value
    return filters


def test_finish_guards_own_running_claim() -> None:
    w, db = _worker()
    db.table.return_value.update.return_value.eq.return_value.eq.return_value \
        .eq.return_value.execute.return_value.data = [{"id": "j1"}]
    w._finish("j1", "done")  # noqa: SLF001
    filters = _update_chain_filters(db)
    assert ("id", "j1") in filters
    assert ("locked_by", w._worker_id) in filters  # noqa: SLF001
    assert ("status", "running") in filters


def test_finish_logs_lost_claim_without_crash() -> None:
    # Reaper hat den Job requeued → Update trifft 0 Zeilen → kein Overwrite,
    # kein Fehler (der neue Claim gehört einem anderen Worker).
    w, db = _worker()
    db.table.return_value.update.return_value.eq.return_value.eq.return_value \
        .eq.return_value.execute.return_value.data = []
    w._finish("j1", "done")  # noqa: SLF001 — darf nicht werfen


def test_retry_and_defer_guard_own_claim() -> None:
    w, db = _worker()
    job = {"id": "j1", "attempts": 1, "max_attempts": 10, "job_type": "push_ari"}
    w._retry(job, "boom")  # noqa: SLF001
    assert ("locked_by", w._worker_id) in _update_chain_filters(db)  # noqa: SLF001

    w2, db2 = _worker()
    w2._defer(job, retry_after=5)  # noqa: SLF001
    assert ("locked_by", w2._worker_id) in _update_chain_filters(db2)  # noqa: SLF001


def test_heartbeat_outpaces_reaper() -> None:
    # Der Heartbeat MUSS deutlich schneller feuern als der Reaper zuschlägt,
    # sonst requeued der Reaper weiterhin laufende Langläufer.
    assert JOB_HEARTBEAT_SECONDS * 2 <= STUCK_AFTER_SECONDS
