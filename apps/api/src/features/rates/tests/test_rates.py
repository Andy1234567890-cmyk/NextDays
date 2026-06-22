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

    def execute(self):  # noqa: ANN201
        class _R:
            pass

        r = _R()
        if self._op == "insert":
            row = dict(self._payload)
            row.setdefault("id", "rp-new")
            self._db.inserted.setdefault(self._name, []).append(row)
            r.data = [row]
        else:
            r.data = self._db.canned.get(self._name, [])
        return r


class _FakeDB:
    def __init__(self, canned) -> None:  # noqa: ANN001
        self.canned = canned
        self.inserted: dict = {}

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
