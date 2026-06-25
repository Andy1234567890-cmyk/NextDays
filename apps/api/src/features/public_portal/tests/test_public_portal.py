"""Tests für public_portal (Eigentümer-Self-Service-Portal).

Schwerpunkt: Owner-Scope (nur eigene Objekte, fail-closed) und Daten-Split
(guest_masking → Owner sieht keine Beträge). In-Memory-Fake-DB.
"""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.public_portal.schemas import (
    BlockRequestCreate,
    MeterReadingCreate,
)
from src.features.public_portal.service import PortalError, PublicPortalService
from src.main import create_app

client = TestClient(create_app())


def test_public_portal_health() -> None:
    resp = client.get("/api/v1/public-portal/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "public_portal", "status": "ok"}


def _ctx(user: str = "owner-1", tenant: str = "t-1") -> AuthContext:
    return AuthContext(user_id=user, tenant_id=tenant, role="owner")


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: dict | None = None
        self._filters: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._gte: tuple[str, str] | None = None
        self._lt: tuple[str, str] | None = None
        self._lte: tuple[str, str] | None = None

    def select(self, *_a: object, **_k: object) -> "_Query":
        self._op = "select"
        return self

    def insert(self, payload: dict) -> "_Query":
        self._op = "insert"
        self._payload = payload
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._filters.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in = (col, vals)
        return self

    def gte(self, col: str, val: str) -> "_Query":
        self._gte = (col, val)
        return self

    def lt(self, col: str, val: str) -> "_Query":
        self._lt = (col, val)
        return self

    def lte(self, col: str, val: str) -> "_Query":
        self._lte = (col, val)
        return self

    def order(self, *_a: object, **_k: object) -> "_Query":
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def _match(self, row: dict) -> bool:
        ok = all(str(row.get(c)) == str(v) for c, v in self._filters)
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        if ok and self._gte:
            ok = str(row.get(self._gte[0])) >= self._gte[1]
        if ok and self._lt:
            ok = str(row.get(self._lt[0])) < self._lt[1]
        if ok and self._lte:
            ok = str(row.get(self._lte[0])) <= self._lte[1]
        return ok

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            row = dict(self._payload or {})
            row.setdefault("id", f"{self._table}-{self._db.next_id()}")
            row.setdefault("created_at", "2026-06-25T00:00:00Z")
            rows.append(row)
            return _Result([row])
        return _Result([r for r in rows if self._match(r)])


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self._counter = 0

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _tables() -> dict[str, list[dict]]:
    return {
        # owner-1 ist owner OHNE pm_booking_total → mask.amounts = False.
        "users": [{"id": "owner-1", "role": "owner", "permissions": []}],
        "tenants": [{"id": "t-1", "currency": "EUR"}],
        "owner_property_assignments": [
            {"id": "a1", "tenant_id": "t-1", "user_id": "owner-1", "property_id": "p-1"}
        ],
        "properties": [
            {"id": "p-1", "tenant_id": "t-1", "title": "Villa", "city": "Kiel", "photos": []},
            {"id": "p-2", "tenant_id": "t-1", "title": "Fremd", "city": "X", "photos": []},
        ],
        "availability": [
            {"property_id": "p-1", "date": "2026-01-05", "status": "booked"},
        ],
        "reservations": [
            {
                "property_id": "p-1",
                "tenant_id": "t-1",
                "check_in": "2026-01-05",
                "check_out": "2026-01-08",
                "status": "confirmed",
                "total_amount": 900,
                "channel_fee": 0,
            }
        ],
        "owners": [{"id": "o-1", "tenant_id": "t-1", "user_id": "owner-1"}],
        "owner_statements": [
            {
                "id": "s-1",
                "tenant_id": "t-1",
                "owner_id": "o-1",
                "period_from": "2026-01-01",
                "period_to": "2026-01-31",
                "status": "finalized",
                "owner_payout": 720,
                "currency": "EUR",
                "invoice_number": "INV-1",
                "created_at": "2026-02-01T00:00:00Z",
            },
            {
                "id": "s-2",
                "tenant_id": "t-1",
                "owner_id": "o-1",
                "period_from": "2026-02-01",
                "period_to": "2026-02-28",
                "status": "draft",
                "owner_payout": 100,
                "currency": "EUR",
                "created_at": "2026-03-01T00:00:00Z",
            },
        ],
        "block_requests": [],
        "meter_readings": [],
    }


def _svc(tables: dict[str, list[dict]] | None = None) -> PublicPortalService:
    return PublicPortalService(service_client=_DB(tables or _tables()))


# --- Scope -------------------------------------------------------------------

def test_my_properties_only_assigned() -> None:
    res = _svc().my_properties(_ctx())
    assert res.total == 1
    assert res.items[0].id == "p-1"  # p-2 (fremd) NICHT enthalten


def test_calendar_foreign_property_404() -> None:
    with pytest.raises(PortalError) as exc:
        _svc().calendar(_ctx(), "p-2", date(2026, 1, 1), date(2026, 1, 10))
    assert exc.value.status_code == 404


def test_owner_with_no_assignments_sees_nothing() -> None:
    tables = _tables()
    tables["owner_property_assignments"] = []
    res = _svc(tables).my_properties(_ctx())
    assert res.total == 0


# --- Maskierung (Daten-Split) ------------------------------------------------

def test_calendar_prices_masked_for_owner() -> None:
    # Owner ohne pm_booking_total → Preise sind None (maskiert).
    res = _svc().calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 7))
    assert len(res.days) == 2
    assert all(d.price is None for d in res.days)
    # Status kommt durch (booked am 5.).
    assert res.days[0].status == "booked"


def test_earnings_payout_masked_for_owner() -> None:
    res = _svc().earnings(_ctx(), date(2026, 1, 1), date(2026, 1, 31))
    assert res.total_payout is None  # maskiert
    item = next(i for i in res.items if i.property_id == "p-1")
    assert item.payout is None
    assert item.nights == 3  # Nächte sind sichtbar (kein Betrag)
    assert item.reservations == 1


# --- Statements --------------------------------------------------------------

def test_my_statements_only_finalized_and_own() -> None:
    res = _svc().my_statements(_ctx())
    assert res.total == 1
    assert res.items[0].id == "s-1"  # nur finalized, draft (s-2) ausgeblendet


# --- Block-Requests ----------------------------------------------------------

def test_request_block_on_own_property() -> None:
    svc = _svc()
    item = svc.request_block(
        _ctx(),
        BlockRequestCreate(
            property_id="p-1", start_date=date(2026, 3, 1), end_date=date(2026, 3, 5)
        ),
    )
    assert item.status == "pending"
    assert item.property_id == "p-1"


def test_request_block_foreign_property_404() -> None:
    with pytest.raises(PortalError) as exc:
        _svc().request_block(
            _ctx(),
            BlockRequestCreate(
                property_id="p-2", start_date=date(2026, 3, 1), end_date=date(2026, 3, 5)
            ),
        )
    assert exc.value.status_code == 404


# --- Zählerstände ------------------------------------------------------------

def test_add_meter_reading_on_own_property() -> None:
    svc = _svc()
    item = svc.add_meter_reading(
        _ctx(),
        MeterReadingCreate(
            property_id="p-1", meter_kind="strom", value=1234.5, read_at=date(2026, 1, 31)
        ),
    )
    assert item.meter_kind == "strom"
    assert item.value == 1234.5


def test_add_meter_reading_foreign_property_404() -> None:
    with pytest.raises(PortalError) as exc:
        _svc().add_meter_reading(
            _ctx(),
            MeterReadingCreate(
                property_id="p-2", meter_kind="strom", value=1, read_at=date(2026, 1, 31)
            ),
        )
    assert exc.value.status_code == 404
