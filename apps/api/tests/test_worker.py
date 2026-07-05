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


# --- Fake-DB (zeichnet die enqueue_job-RPC auf) -----------------------------
# enqueue() reiht über die RPC enqueue_job (0103) ein, NICHT per PostgREST-upsert
# (der partielle Coalescing-Index ist per on_conflict nicht adressierbar → 42P10).

class _Res:
    def __init__(self, data) -> None:  # noqa: ANN001
        self.data = data


class _FakeRpc:
    def __init__(self, sink, fn, params) -> None:  # noqa: ANN001
        self._sink = sink
        self._fn = fn
        self._params = params

    def execute(self):  # noqa: ANN201
        self._sink.append((self._fn, self._params))
        return _Res([])


class _FakeDB:
    def __init__(self) -> None:
        self.rpcs: list = []

    def rpc(self, fn, params):  # noqa: ANN001, ANN201
        return _FakeRpc(self.rpcs, fn, params)


def test_enqueue_mit_dedup_key_ruft_enqueue_job_rpc() -> None:
    db = _FakeDB()
    enqueue(db, "push_ari", payload={"property_id": "p1"},
            tenant_id="t1", dedup_key="t1:p1:push_ari")
    assert len(db.rpcs) == 1
    fn, params = db.rpcs[0]
    # Coalescing läuft in der RPC (partieller Index) — dedup_key wird durchgereicht.
    assert fn == "enqueue_job"
    assert params["p_job_type"] == "push_ari"
    assert params["p_tenant_id"] == "t1"
    assert params["p_dedup_key"] == "t1:p1:push_ari"
    assert params["p_payload"] == {"property_id": "p1"}
    assert "p_run_after" in params


def test_enqueue_ohne_dedup_key_ruft_rpc_mit_null_key() -> None:
    db = _FakeDB()
    enqueue(db, "reconcile_tenant", payload={"tenant_id": "t1"}, tenant_id="t1")
    fn, params = db.rpcs[0]
    assert fn == "enqueue_job"
    # Kein Coalescing → die RPC macht bei NULL-Key einen schlichten Insert.
    assert params["p_dedup_key"] is None


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


class _FakeBudget:
    """Budget-Stub: erlaubt/verweigert deterministisch, ohne echtes Redis."""

    def __init__(self, *, allow: bool = True, retry_after: int = 30) -> None:
        self._allow = allow
        self._retry = retry_after
        self.calls: list = []

    def try_consume(self, property_id):  # noqa: ANN001, ANN201
        from src.jobs.channex_budget import BudgetDecision

        self.calls.append(property_id)
        return BudgetDecision(allowed=self._allow, retry_after=self._retry)


def _worker_with(db, budget=None):  # noqa: ANN001, ANN202
    from src.worker import Worker

    # Default-Budget erlaubt immer → die Handler-/Retry-Tests laufen wie bisher,
    # ohne echtes Redis (das Gate ist in eigenen Tests unten separat geprüft).
    return Worker(db=db, budget=budget or _FakeBudget(allow=True))


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


def test_run_job_kein_budget_wird_deferred(monkeypatch) -> None:  # noqa: ANN001
    # Channex-Job ohne freies Token: NICHT ausführen, sondern verzögern (queued),
    # OHNE attempts zu verbrauchen (Warten ist kein Fehlversuch).
    import src.worker as worker_mod

    called = {"ran": False}

    def _handler(_db, _payload):  # noqa: ANN001, ANN202
        called["ran"] = True

    monkeypatch.setitem(worker_mod.HANDLERS, "sync_property_content", _handler)
    db = _StatusDB()
    w = _worker_with(db, budget=_FakeBudget(allow=False, retry_after=45))
    w._run_job({
        "id": "j5", "job_type": "sync_property_content",
        "attempts": 3, "max_attempts": 10, "payload": {"property_id": "p1"},
    })
    assert called["ran"] is False           # Handler NICHT gelaufen
    last = db.updates[-1]
    assert last["status"] == "queued"        # zurück in die Warteschlange
    assert last["attempts"] == 2             # 3 − 1 (Claim-Erhöhung zurückgedreht)


def test_run_job_nicht_channex_umgeht_budget(monkeypatch) -> None:  # noqa: ANN001
    # recompute_property ist KEIN Channex-Job → Budget-Gate greift nicht, selbst
    # wenn das Budget leer wäre. Handler läuft, Status done.
    import src.worker as worker_mod

    monkeypatch.setitem(worker_mod.HANDLERS, "recompute_property", lambda _d, _p: None)
    db = _StatusDB()
    denying = _FakeBudget(allow=False)
    w = _worker_with(db, budget=denying)
    w._run_job({
        "id": "j6", "job_type": "recompute_property",
        "attempts": 1, "max_attempts": 10, "payload": {"property_id": "p1"},
    })
    assert db.updates[-1]["status"] == "done"
    assert denying.calls == []  # Budget wurde gar nicht befragt


# --- push_ari-Handler: kind → richtige Push-Methode + Argumente --------------

class _RecordingService:
    """Fake-ChannelManagerService: zeichnet push_*-Aufrufe auf (args, kwargs)."""

    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def __getattr__(self, name):  # noqa: ANN001, ANN204
        def _rec(*args, **kwargs):  # noqa: ANN002, ANN003, ANN202
            self.calls.append((name, args, kwargs))
        return _rec


def _run_push_ari(monkeypatch, payload):  # noqa: ANN001, ANN202
    import src.worker as worker_mod

    svc = _RecordingService()
    monkeypatch.setattr(worker_mod, "_svc", lambda _db: svc)
    worker_mod._handle_push_ari(None, payload)
    return svc.calls


def test_push_ari_availability_maps_to_availability_push(monkeypatch) -> None:  # noqa: ANN001
    calls = _run_push_ari(monkeypatch, {
        "kind": "availability", "tenant_id": "t1", "property_id": "p1",
        "date_from": "2026-07-01", "date_to": "2026-07-10", "availability": 0,
    })
    from datetime import date
    name, args, _ = calls[0]
    assert name == "push_availability_for_property"
    assert args == ("t1", "p1", date(2026, 7, 1), date(2026, 7, 10), 0)


def test_push_ari_rate_passes_rate_and_min_stay(monkeypatch) -> None:  # noqa: ANN001
    calls = _run_push_ari(monkeypatch, {
        "kind": "rate", "tenant_id": "t1", "property_id": "p1",
        "date_from": "2026-07-01", "date_to": "2026-07-10",
        "rate_cents": 12000, "min_stay": 3,
    })
    name, _args, kwargs = calls[0]
    assert name == "push_rate_for_property"
    assert kwargs == {"rate_cents": 12000, "min_stay": 3}


def test_push_ari_stop_sell_uses_keyword_and_spans(monkeypatch) -> None:  # noqa: ANN001
    # Regression: stop_sell MUSS als keyword übergeben werden (Signatur *, stop_sell).
    from datetime import date
    calls = _run_push_ari(monkeypatch, {
        "kind": "stop_sell", "tenant_id": "t1", "property_id": "p1",
        "spans": [["2026-07-01", "2026-07-05"]], "stop_sell": True, "days": None,
    })
    name, args, kwargs = calls[0]
    assert name == "push_stop_sell_for_property"
    assert args == ("t1", "p1", [(date(2026, 7, 1), date(2026, 7, 5))])
    assert kwargs == {"stop_sell": True, "days": None}


def test_push_ari_unknown_kind_raises(monkeypatch) -> None:  # noqa: ANN001
    import pytest
    with pytest.raises(ValueError, match="unbekannter ARI-kind"):
        _run_push_ari(monkeypatch, {
            "kind": "gibts_nicht", "tenant_id": "t1", "property_id": "p1",
        })
