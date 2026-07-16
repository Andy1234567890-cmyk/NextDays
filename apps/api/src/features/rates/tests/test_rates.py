"""Tests für den rates-Slice (rate_plan CRUD + Channex-Sync-Trigger)."""
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.rates.schemas import RatePlanCreate
from src.features.rates.service import RateError, RatesService
from src.main import create_app

client = TestClient(create_app())


def test_rates_health() -> None:
    resp = client.get("/api/v1/rates/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "rates", "status": "ok"}


def _ctx(tenant: str | None = "t-1") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="owner")


class _Query:
    def __init__(self, db, name) -> None:  # noqa: ANN001
        self._db = db
        self._name = name
        self._op = None
        self._payload = None

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def eq(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def in_(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def gte(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def lt(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    @property
    def not_(self):  # noqa: ANN201
        return self

    def is_(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def insert(self, payload):  # noqa: ANN001, ANN201
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload):  # noqa: ANN001, ANN201
        self._op, self._payload = "update", payload
        return self

    def upsert(self, payload, **_k):  # noqa: ANN001, ANN003, ANN201
        self._op, self._payload = "upsert", payload
        return self

    def delete(self):  # noqa: ANN201
        self._op = "delete"
        return self

    def execute(self):  # noqa: ANN201
        class _R:
            pass

        r = _R()
        if self._op == "insert":
            row = dict(self._payload)
            row.setdefault("id", "rp-new")
            self._db.inserted.setdefault(self._name, []).append(row)
            r.data = [row]
        elif self._op == "upsert":
            self._db.upserted.setdefault(self._name, []).extend(self._payload)
            r.data = list(self._payload)
        elif self._op == "delete":
            self._db.deleted.append(self._name)
            r.data = []
        else:
            r.data = self._db.canned.get(self._name, [])
        return r


class _FakeDB:
    def __init__(self, canned) -> None:  # noqa: ANN001
        self.canned = canned
        self.inserted: dict = {}
        self.upserted: dict = {}
        self.deleted: list = []

    def table(self, name):  # noqa: ANN001, ANN201
        return _Query(self, name)


def _svc(canned) -> RatesService:  # noqa: ANN001
    return RatesService(service_client=_FakeDB(canned))


def test_create_rate_plan_writes_row() -> None:
    svc = _svc({"properties": [{"id": "p-1", "title": "Villa"}]})
    res = svc.create(
        _ctx(),
        RatePlanCreate(property_id="p-1", base_price=120, currency="EUR", min_stay=2),
    )
    assert res.base_price == 120 and res.currency == "EUR" and res.min_stay == 2


def test_list_reports_sync_status_per_plan() -> None:
    # Plan mit Datumspreisen + in_sync=True → 'synced'; ohne Preise → None.
    svc = _svc({
        "properties": [{"id": "p-1", "title": "Hotel"}],
        "rate_plans": [
            {"id": "rp-1", "property_id": "p-1", "name": "BAR", "base_price": 100,
             "currency": "USD", "min_stay": 1, "room_type_id": "rt-1"},
        ],
        "rate_plan_price_overrides": [{"rate_plan_id": "rp-1"}],
        "rate_plan_sync_state": [{"rate_plan_id": "rp-1", "in_sync": True}],
    })
    res = svc.list(_ctx(), "p-1")
    assert res.items[0].date_price_count == 1
    assert res.items[0].sync_status == "synced"


def test_list_sync_status_pending_when_drift() -> None:
    svc = _svc({
        "properties": [{"id": "p-1", "title": "Hotel"}],
        "rate_plans": [
            {"id": "rp-1", "property_id": "p-1", "name": "BAR", "base_price": 100,
             "currency": "USD", "min_stay": 1, "room_type_id": "rt-1"},
        ],
        "rate_plan_price_overrides": [{"rate_plan_id": "rp-1"}],
        "rate_plan_sync_state": [{"rate_plan_id": "rp-1", "in_sync": False}],
    })
    res = svc.list(_ctx(), "p-1")
    assert res.items[0].sync_status == "pending"


def test_list_sync_status_none_without_date_prices() -> None:
    svc = _svc({
        "properties": [{"id": "p-1", "title": "Hotel"}],
        "rate_plans": [
            {"id": "rp-1", "property_id": "p-1", "name": "BAR", "base_price": 100,
             "currency": "USD", "min_stay": 1, "room_type_id": "rt-1"},
        ],
        "rate_plan_price_overrides": [],
        "rate_plan_sync_state": [],
    })
    res = svc.list(_ctx(), "p-1")
    assert res.items[0].sync_status is None


def test_resync_prices_enqueues_reconcile(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod

    calls: list = []
    monkeypatch.setattr(svc_mod, "enqueue", lambda *a, **k: calls.append((a, k)))
    monkeypatch.setattr(svc_mod, "dedup_key", lambda *a, **k: "dk")
    svc = _svc(_OWN_PLAN)
    svc.resync_prices(_ctx(), "rp-1")
    assert len(calls) == 1
    _args, kw = calls[0]
    assert _args[1] == "reconcile_rate_plan_prices"
    assert kw["payload"]["property_id"] == "p-1"


def test_resync_prices_foreign_plan_404() -> None:
    svc = _svc({"rate_plans": []})
    try:
        svc.resync_prices(_ctx(), "rp-x")
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404


def test_create_rate_plan_foreign_property_404() -> None:
    svc = _svc({"properties": []})  # Property gehört nicht dem Tenant
    try:
        svc.create(_ctx(), RatePlanCreate(property_id="p-x", base_price=100))
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404


def test_create_rate_plan_requires_tenant() -> None:
    svc = _svc({"properties": [{"id": "p-1", "title": "Villa"}]})
    try:
        svc.create(_ctx(tenant=None), RatePlanCreate(property_id="p-1", base_price=100))
        raise AssertionError("sollte fehlschlagen")
    except RateError as exc:
        assert exc.status_code == 400


# --- Datumsgenaue Preise pro Rate-Plan (Hotel) ------------------------------

_OWN_PLAN = {"rate_plans": [
    {"id": "rp-1", "property_id": "p-1", "properties": {"tenant_id": "t-1"}}
]}


def test_set_rate_plan_prices_upserts_and_enqueues(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanPriceSet

    enqueued: list = []
    monkeypatch.setattr(
        svc_mod, "try_enqueue_ari",
        lambda *a, **k: enqueued.append((a, k)),
    )
    svc = _svc(_OWN_PLAN)
    svc.set_prices(
        _ctx(), "rp-1",
        RatePlanPriceSet(start="2026-11-21", end="2026-11-22", price=333),
    )
    # Ein Tag upserted, und genau EIN rate-plan-genaues Segment eingereiht.
    assert svc._db().canned  # sanity
    assert len(enqueued) == 1
    _args, _kw = enqueued[0]
    # kind="rate", segments mit rate_plan_id + rate_cents in Cent.
    kind = _args[3]
    fields = _args[4]
    assert kind == "rate"
    seg = fields["segments"][0]
    assert seg["rate_plan_id"] == "rp-1"
    assert seg["rate_cents"] == 33300
    assert seg["date_from"] == "2026-11-21" and seg["date_to"] == "2026-11-21"


def test_set_rate_plan_prices_foreign_plan_404(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanPriceSet

    monkeypatch.setattr(svc_mod, "try_enqueue_ari", lambda *a, **k: None)
    svc = _svc({"rate_plans": []})  # Plan gehört nicht dem Tenant
    try:
        svc.set_prices(
            _ctx(), "rp-x",
            RatePlanPriceSet(start="2026-11-21", end="2026-11-22", price=333),
        )
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404


# --- Datumsgenauer Mindestaufenthalt pro Rate-Plan (Zert #5) -----------------

def test_set_rate_plan_min_stays_upserts_and_enqueues(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanMinStaySet

    enqueued: list = []
    monkeypatch.setattr(
        svc_mod, "try_enqueue_ari",
        lambda *a, **k: enqueued.append((a, k)),
    )
    svc = _svc(_OWN_PLAN)
    svc.set_min_stays(
        _ctx(), "rp-1",
        RatePlanMinStaySet(start="2026-11-23", end="2026-11-24", min_stay=3),
    )
    assert len(enqueued) == 1
    _args, _kw = enqueued[0]
    kind = _args[3]
    fields = _args[4]
    assert kind == "rate"
    seg = fields["segments"][0]
    assert seg["rate_plan_id"] == "rp-1"
    assert seg["min_stay"] == 3
    assert seg["date_from"] == "2026-11-23" and seg["date_to"] == "2026-11-23"
    assert "rate_cents" not in seg  # reiner Min-Stay-Push, kein Preis


def test_clear_rate_plan_min_stays_deletes(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanMinStaySet

    monkeypatch.setattr(svc_mod, "try_enqueue_ari", lambda *a, **k: None)
    monkeypatch.setattr(svc_mod, "try_enqueue_content_sync", lambda *a, **k: None)
    db = _FakeDB(_OWN_PLAN)
    svc = RatesService(service_client=db)
    svc.set_min_stays(
        _ctx(), "rp-1",
        RatePlanMinStaySet(start="2026-11-23", end="2026-11-25", min_stay=None),
    )
    assert "rate_plan_min_stay_overrides" in db.deleted
    assert not db.upserted.get("rate_plan_min_stay_overrides")


def test_set_rate_plan_min_stays_foreign_plan_404(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanMinStaySet

    monkeypatch.setattr(svc_mod, "try_enqueue_ari", lambda *a, **k: None)
    svc = _svc({"rate_plans": []})
    try:
        svc.set_min_stays(
            _ctx(), "rp-x",
            RatePlanMinStaySet(start="2026-11-23", end="2026-11-24", min_stay=3),
        )
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404


def test_clear_rate_plan_prices_deletes(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanPriceSet

    monkeypatch.setattr(svc_mod, "try_enqueue_ari", lambda *a, **k: None)
    monkeypatch.setattr(svc_mod, "try_enqueue_content_sync", lambda *a, **k: None)
    db = _FakeDB(_OWN_PLAN)
    svc = RatesService(service_client=db)
    svc.set_prices(
        _ctx(), "rp-1",
        RatePlanPriceSet(start="2026-11-21", end="2026-11-23", price=None),
    )
    # Zurücknehmen löscht die Datumspreis-Zeilen (kein Upsert).
    assert "rate_plan_price_overrides" in db.deleted
    assert not db.upserted.get("rate_plan_price_overrides")


def test_clear_all_rate_plan_prices(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod

    synced: list = []
    monkeypatch.setattr(
        svc_mod, "try_enqueue_content_sync",
        lambda *a, **k: synced.append((a, k)),
    )
    db = _FakeDB(_OWN_PLAN)
    svc = RatesService(service_client=db)
    svc.clear_all_prices(_ctx(), "rp-1")
    # Alle Zeilen des Plans gelöscht + Content-Sync (Basispreis zurück) eingereiht.
    assert "rate_plan_price_overrides" in db.deleted
    assert len(synced) == 1


def test_clear_all_rate_plan_prices_foreign_404() -> None:
    svc = _svc({"rate_plans": []})  # Plan gehört nicht dem Tenant
    try:
        svc.clear_all_prices(_ctx(), "rp-x")
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404
