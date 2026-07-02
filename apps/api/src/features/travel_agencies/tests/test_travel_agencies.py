"""Tests für die Reisebüro-Kartei: Tenant-Scope, Validierung, Datei-Regeln."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from src.features.travel_agencies.schemas import (
    AgencyCreate,
    AgencyUpdate,
    ContractCreate,
    RateCreate,
)
from src.features.travel_agencies.service import (
    TravelAgenciesError,
    TravelAgenciesService,
)
from src.main import create_app

client = TestClient(create_app())


def test_travel_agencies_health() -> None:
    resp = client.get("/api/v1/travel-agencies/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "travel_agencies", "status": "ok"}


# --- In-Memory-Fake-DB (deckt die genutzten Query-Ketten ab) -----------------

class _Res:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, store: dict, name: str) -> None:
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._op = "select"
        self._payload: dict | list | None = None

    def select(self, *_a, **_k) -> "_Query":
        return self

    def eq(self, col, val) -> "_Query":  # noqa: ANN001
        self._eq[col] = val
        return self

    def ilike(self, *_a, **_k) -> "_Query":
        return self

    def order(self, *_a, **_k) -> "_Query":
        return self

    def limit(self, *_a, **_k) -> "_Query":
        return self

    def insert(self, payload) -> "_Query":  # noqa: ANN001
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload) -> "_Query":  # noqa: ANN001
        self._op = "update"
        self._payload = payload
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    def execute(self) -> _Res:
        rows = list(self._store.get(self._name, []))
        if self._op == "insert":
            row = {"id": f"{self._name}-{len(rows) + 1}", **self._payload}
            self._store.setdefault(self._name, []).append(row)
            return _Res([row])
        if self._op == "update":
            matched = [r for r in rows if self._matches(r)]
            for r in matched:
                r.update(self._payload)
            return _Res(matched)
        if self._op == "delete":
            kept = [r for r in rows if not self._matches(r)]
            self._store[self._name] = kept
            return _Res([])
        return _Res([r for r in rows if self._matches(r)])

    def _matches(self, row: dict) -> bool:
        return all(row.get(col) == val for col, val in self._eq.items())


class _FakeDB:
    def __init__(self, store: dict) -> None:
        self._store = store

    def table(self, name: str) -> _Query:
        return _Query(self._store, name)


def _service(**tables: list[dict]) -> tuple[TravelAgenciesService, dict]:
    store: dict = dict(tables)
    return TravelAgenciesService(service_client=_FakeDB(store)), store


# --- Tenant-Scope -------------------------------------------------------------

def test_get_agency_rejects_foreign_tenant() -> None:
    svc, _ = _service(travel_agencies=[{"id": "a1", "tenant_id": "t2", "name": "TUI"}])
    with pytest.raises(TravelAgenciesError) as exc:
        svc.get_agency("t1", "a1")
    assert exc.value.status_code == 404


def test_list_agencies_filters_tenant() -> None:
    svc, _ = _service(travel_agencies=[
        {"id": "a1", "tenant_id": "t1", "name": "TUI", "is_active": True},
        {"id": "a2", "tenant_id": "t2", "name": "DERTOUR", "is_active": True},
    ])
    items = svc.list_agencies("t1")
    assert [a["id"] for a in items] == ["a1"]


def test_create_agency_stamps_tenant() -> None:
    svc, store = _service()
    row = svc.create_agency("t1", AgencyCreate(name="TUI"))
    assert row["tenant_id"] == "t1"
    assert store["travel_agencies"][0]["name"] == "TUI"


def test_update_agency_patches_only_set_fields() -> None:
    svc, store = _service(travel_agencies=[
        {"id": "a1", "tenant_id": "t1", "name": "TUI", "commission_pct": 10.0},
    ])
    svc.update_agency("t1", "a1", AgencyUpdate(commission_pct=12.5))
    assert store["travel_agencies"][0]["commission_pct"] == 12.5
    assert store["travel_agencies"][0]["name"] == "TUI"  # unangetastet


# --- Verträge ------------------------------------------------------------------

def _contract(**over) -> ContractCreate:
    base = {
        "title": "Sommer 2027",
        "valid_from": date(2027, 5, 1),
        "valid_to": date(2027, 10, 31),
        "currency": "EUR",
    }
    return ContractCreate(**{**base, **over})


def test_contract_rejects_inverted_validity() -> None:
    with pytest.raises(ValueError):
        _contract(valid_from=date(2027, 10, 31), valid_to=date(2027, 5, 1))


def test_add_contract_requires_own_agency() -> None:
    svc, _ = _service()  # keine Agentur im Tenant
    with pytest.raises(TravelAgenciesError) as exc:
        svc.add_contract("t1", "a1", _contract())
    assert exc.value.status_code == 404


def test_add_contract_stamps_scope() -> None:
    svc, store = _service(travel_agencies=[{"id": "a1", "tenant_id": "t1", "name": "TUI"}])
    row = svc.add_contract("t1", "a1", _contract())
    assert row["tenant_id"] == "t1"
    assert row["agency_id"] == "a1"
    assert store["travel_agency_contracts"][0]["currency"] == "EUR"


# --- Raten (Rate-Sheet) ---------------------------------------------------------

def test_add_rate_validates_property_tenant() -> None:
    svc, _ = _service(
        travel_agencies=[{"id": "a1", "tenant_id": "t1", "name": "TUI"}],
        travel_agency_contracts=[{
            "id": "c1", "tenant_id": "t1", "agency_id": "a1",
            "valid_from": "2027-05-01", "valid_to": "2027-10-31",
        }],
        properties=[{"id": "p1", "tenant_id": "t2"}],  # fremdes Objekt!
    )
    rate = RateCreate(
        property_id="p1",
        season_start=date(2027, 6, 1),
        season_end=date(2027, 8, 31),
        price=99.0,
        basis="net",
    )
    with pytest.raises(TravelAgenciesError) as exc:
        svc.add_rate("t1", "a1", "c1", rate)
    assert exc.value.status_code == 404


def test_rate_rejects_inverted_season() -> None:
    with pytest.raises(ValueError):
        RateCreate(
            property_id="p1",
            season_start=date(2027, 8, 31),
            season_end=date(2027, 6, 1),
            price=99.0,
            basis="net",
        )


# --- Datei-Regeln ----------------------------------------------------------------

def test_upload_rejects_unknown_mime() -> None:
    svc, _ = _service(
        travel_agencies=[{"id": "a1", "tenant_id": "t1", "name": "TUI"}],
        travel_agency_contracts=[{"id": "c1", "tenant_id": "t1", "agency_id": "a1"}],
    )
    with pytest.raises(TravelAgenciesError) as exc:
        svc.upload_contract_file("t1", "a1", "c1", b"x", "application/zip", "a.zip")
    assert exc.value.status_code == 415


def test_file_url_requires_document() -> None:
    svc, _ = _service(
        travel_agencies=[{"id": "a1", "tenant_id": "t1", "name": "TUI"}],
        travel_agency_contracts=[{
            "id": "c1", "tenant_id": "t1", "agency_id": "a1", "storage_path": None,
        }],
    )
    with pytest.raises(TravelAgenciesError) as exc:
        svc.contract_file_url("t1", "a1", "c1")
    assert exc.value.status_code == 404


def test_db_unavailable_raises_clean_error() -> None:
    svc = TravelAgenciesService(service_client=None)
    with pytest.raises(TravelAgenciesError) as exc:
        svc.list_agencies("t1")
    assert exc.value.status_code == 500
