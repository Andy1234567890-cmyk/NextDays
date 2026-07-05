"""Tests für die Job-Queue (src/jobs/queue.py) und den Worker (src/worker.py).

Reine Funktionen (Backoff, dedup_key) unit; enqueue + Worker-Job-Ausführung über
das etablierte Fake-DB/Fake-Channex-Muster — kein echtes Redis/Postgres/Channex.
"""
from __future__ import annotations

from datetime import UTC, datetime

from src.jobs.queue import dedup_key, enqueue, next_run_after

# --- Reine Funktionen -------------------------------------------------------

def test_next_run_after_staffelt_backoff() -> None:
    base = datetime(2026, 7, 5, 12, 0, tzinfo=UTC)
    # attempts=1 → 1 min, =2 → 5, =3 → 15, danach gedeckelt auf 60.
    assert next_run_after(1, now=base) == datetime(2026, 7, 5, 12, 1, tzinfo=UTC)
    assert next_run_after(2, now=base) == datetime(2026, 7, 5, 12, 5, tzinfo=UTC)
    assert next_run_after(3, now=base) == datetime(2026, 7, 5, 12, 15, tzinfo=UTC)
    assert next_run_after(99, now=base) == datetime(2026, 7, 5, 13, 0, tzinfo=UTC)
    # attempts=0 darf nicht negativ indizieren.
    assert next_run_after(0, now=base) == datetime(2026, 7, 5, 12, 1, tzinfo=UTC)


def test_dedup_key_kanonisch() -> None:
    assert dedup_key("t1", "p1", "push_ari") == "t1:p1:push_ari"
    assert dedup_key("t1", "p1", "push_ari", suffix="rate") == "t1:p1:push_ari:rate"
    # Globaler Job (tenant_id=None) → "global"-Präfix statt None.
    assert dedup_key(None, "p1", "reconcile") == "global:p1:reconcile"


# --- Fake-DB (Fluent-Query-Fake, zeichnet upsert/insert auf) ----------------

class _Res:
    def __init__(self, data) -> None:  # noqa: ANN001
        self.data = data


class _FakeJobsQuery:
    def __init__(self, sink) -> None:  # noqa: ANN001
        self._sink = sink

    def upsert(self, row, on_conflict=None):  # noqa: ANN001, ANN201
        self._sink.append(("upsert", row, on_conflict))
        return self

    def insert(self, row):  # noqa: ANN001, ANN201
        self._sink.append(("insert", row, None))
        return self

    def execute(self):  # noqa: ANN201
        return _Res([])


class _FakeDB:
    def __init__(self) -> None:
        self.writes: list = []

    def table(self, name):  # noqa: ANN001, ANN201
        assert name == "jobs"
        return _FakeJobsQuery(self.writes)


def test_enqueue_mit_dedup_key_nutzt_upsert() -> None:
    db = _FakeDB()
    enqueue(db, "push_ari", payload={"property_id": "p1"},
            tenant_id="t1", dedup_key="t1:p1:push_ari")
    assert len(db.writes) == 1
    op, row, on_conflict = db.writes[0]
    # Coalescing: upsert auf dedup_key (letzter gewinnt).
    assert op == "upsert"
    assert on_conflict == "dedup_key"
    assert row["job_type"] == "push_ari"
    assert row["tenant_id"] == "t1"
    assert row["dedup_key"] == "t1:p1:push_ari"
    assert "run_after" in row


def test_enqueue_ohne_dedup_key_nutzt_insert() -> None:
    db = _FakeDB()
    enqueue(db, "reconcile_tenant", payload={"tenant_id": "t1"}, tenant_id="t1")
    op, _row, _oc = db.writes[0]
    assert op == "insert"  # kein Coalescing → jeder Job zählt


# --- Worker-Job-Ausführung: Handler + Retry/dead-Pfad -----------------------

class _StatusDB:
    """Fake-DB, die jobs-Updates aufzeichnet (für _run_job/_retry-Assertions)."""

    def __init__(self) -> None:
        self.updates: list[dict] = []

    def table(self, name):  # noqa: ANN001, ANN201
        assert name == "jobs"
        return self

    def update(self, patch):  # noqa: ANN001, ANN201
        self._patch = patch
        return self

    def eq(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        self.updates.append(self._patch)
        return _Res([])


def _worker_with(db):  # noqa: ANN001, ANN202
    from src.worker import Worker

    return Worker(db=db)


def test_run_job_unbekannter_typ_wird_dead() -> None:
    db = _StatusDB()
    w = _worker_with(db)
    w._run_job({"id": "j1", "job_type": "gibts_nicht", "attempts": 1, "payload": {}})
    assert db.updates[-1]["status"] == "dead"


def test_run_job_erfolg_setzt_done(monkeypatch) -> None:  # noqa: ANN001
    import src.worker as worker_mod

    called = {}

    def _ok(_db, payload):  # noqa: ANN001, ANN202
        called["payload"] = payload

    monkeypatch.setitem(worker_mod.HANDLERS, "sync_property_content", _ok)
    db = _StatusDB()
    w = _worker_with(db)
    w._run_job({
        "id": "j2", "job_type": "sync_property_content",
        "attempts": 1, "max_attempts": 10,
        "payload": {"tenant_id": "t1", "property_id": "p1"},
    })
    assert called["payload"]["property_id"] == "p1"
    assert db.updates[-1]["status"] == "done"


def test_run_job_fehler_requeued_mit_backoff(monkeypatch) -> None:  # noqa: ANN001
    import src.worker as worker_mod

    def _boom(_db, _payload):  # noqa: ANN001, ANN202
        raise RuntimeError("Channex down")

    monkeypatch.setitem(worker_mod.HANDLERS, "sync_property_content", _boom)
    db = _StatusDB()
    w = _worker_with(db)
    # attempts < max_attempts → zurück auf queued mit run_after.
    w._run_job({
        "id": "j3", "job_type": "sync_property_content",
        "attempts": 2, "max_attempts": 10, "payload": {},
    })
    last = db.updates[-1]
    assert last["status"] == "queued"
    assert "run_after" in last
    assert "Channex down" in last["last_error"]


def test_run_job_budget_erschoepft_wird_dead(monkeypatch) -> None:  # noqa: ANN001
    import src.worker as worker_mod

    def _boom(_db, _payload):  # noqa: ANN001, ANN202
        raise RuntimeError("immer noch kaputt")

    monkeypatch.setitem(worker_mod.HANDLERS, "sync_property_content", _boom)
    db = _StatusDB()
    w = _worker_with(db)
    # attempts >= max_attempts → dead (kein endloser Retry).
    w._run_job({
        "id": "j4", "job_type": "sync_property_content",
        "attempts": 10, "max_attempts": 10, "payload": {},
    })
    assert db.updates[-1]["status"] == "dead"
