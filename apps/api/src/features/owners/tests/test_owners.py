"""Tests für den owners-Slice (verwaltete Eigentümer).

Unit/Contract: Health, Schema-Validierung, Service-CRUD + Objekt-Zuordnung mit
In-Memory-Fake-DB (tenant-Scope wird im Code erzwungen). Backfill-Logik (SQL)
wird hier nicht getestet (reine Migration), die Zuordnungs-/Scope-Logik schon.
"""
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.owners.schemas import (
    OwnerCreate,
    OwnerPropertyAssign,
    OwnerUpdate,
)
from src.features.owners.service import OwnerError, OwnersService
from src.main import create_app

client = TestClient(create_app())


def _ctx(tenant: str | None = "t-1") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="admin")


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: dict | list[dict] | None = None
        self._conflict: str | None = None
        self._filters: list[tuple[str, object]] = []
        self._neq: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._order: str | None = None

    def select(self, *_a: object, **_k: object) -> "_Query":
        self._op = "select"
        return self

    def insert(self, payload: dict | list[dict]) -> "_Query":
        self._op = "insert"
        self._payload = payload
        return self

    def upsert(self, payload: dict, on_conflict: str | None = None) -> "_Query":
        self._op = "upsert"
        self._payload = payload
        self._conflict = on_conflict
        return self

    def update(self, payload: dict) -> "_Query":
        self._op = "update"
        self._payload = payload
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._filters.append((col, val))
        return self

    def neq(self, col: str, val: object) -> "_Query":
        self._neq.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in = (col, vals)
        return self

    def order(self, col: str, **_k: object) -> "_Query":
        self._order = col
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def _match(self, row: dict) -> bool:
        ok = all(str(row.get(c)) == str(v) for c, v in self._filters)
        if ok and self._neq:
            ok = all(str(row.get(c)) != str(v) for c, v in self._neq)
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        return ok

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            payload = self._payload
            new_rows = payload if isinstance(payload, list) else [payload]
            created = []
            for p in new_rows:
                row = dict(p)
                row.setdefault("id", f"{self._table}-{self._db.next_id()}")
                row.setdefault("created_at", "2026-06-25T00:00:00Z")
                row.setdefault("updated_at", "2026-06-25T00:00:00Z")
                rows.append(row)
                created.append(row)
            return _Result(created)
        if self._op == "upsert":
            payload = dict(self._payload)  # type: ignore[arg-type]
            keys = (self._conflict or "").split(",")
            for row in rows:
                if all(str(row.get(k)) == str(payload.get(k)) for k in keys):
                    row.update(payload)
                    return _Result([row])
            payload.setdefault("id", f"{self._table}-{self._db.next_id()}")
            rows.append(payload)
            return _Result([payload])
        selected = [r for r in rows if self._match(r)]
        if self._op == "update":
            for r in selected:
                r.update(self._payload)  # type: ignore[arg-type]
            return _Result(selected)
        if self._op == "delete":
            self._db.tables[self._table] = [r for r in rows if not self._match(r)]
            return _Result(selected)
        if self._order:
            selected = sorted(selected, key=lambda r: str(r.get(self._order) or ""))
        return _Result(selected)


class _DB:
    def __init__(self, tables: dict[str, list[dict]] | None = None) -> None:
        self.tables: dict[str, list[dict]] = tables or {}
        self._counter = 0

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _svc(tables: dict[str, list[dict]] | None = None) -> OwnersService:
    base = {
        "owners": [],
        "owner_properties": [],
        "properties": [{"id": "p-1", "tenant_id": "t-1", "title": "Villa"}],
        "users": [],
    }
    if tables:
        base.update(tables)
    return OwnersService(service_client=_DB(base))


# --- Health / Schema ---------------------------------------------------------

def test_owners_health() -> None:
    resp = client.get("/api/v1/owners/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "owners", "status": "ok"}


def test_owner_create_requires_name() -> None:
    with pytest.raises(ValidationError):
        OwnerCreate(name="")


def test_owner_create_rejects_bad_commission() -> None:
    with pytest.raises(ValidationError):
        OwnerCreate(name="X", default_commission_pct=150)


def test_owner_update_all_optional() -> None:
    assert OwnerUpdate().model_dump(exclude_unset=True) == {}


# --- CRUD --------------------------------------------------------------------

def test_create_sets_tenant_from_context() -> None:
    svc = _svc()
    res = svc.create(_ctx(), OwnerCreate(name="Max Mustermann", default_commission_pct=20))
    assert res.tenant_id == "t-1"
    assert res.name == "Max Mustermann"
    assert res.default_commission_pct == 20


def test_create_without_tenant_fails() -> None:
    svc = _svc()
    with pytest.raises(OwnerError) as exc:
        svc.create(_ctx(tenant=None), OwnerCreate(name="X"))
    assert exc.value.status_code == 400


def test_get_missing_raises_404() -> None:
    svc = _svc()
    with pytest.raises(OwnerError) as exc:
        svc.get(_ctx(), "owners-x")
    assert exc.value.status_code == 404


def test_list_returns_items_with_property_count() -> None:
    svc = _svc()
    a = svc.create(_ctx(), OwnerCreate(name="A"))
    svc.create(_ctx(), OwnerCreate(name="B"))
    svc.assign_property(_ctx(), a.id, OwnerPropertyAssign(property_id="p-1"))
    res = svc.list(_ctx())
    assert res.total == 2
    by_name = {i.name: i for i in res.items}
    assert by_name["A"].property_count == 1
    assert by_name["B"].property_count == 0


def test_list_shows_effective_commission_from_override() -> None:
    # Owner-Default 0, aber Objekt-Override 29 → Karte zeigt effektiv 29 (kein 0).
    svc = _svc()
    a = svc.create(_ctx(), OwnerCreate(name="A", default_commission_pct=0))
    svc.assign_property(
        _ctx(),
        a.id,
        OwnerPropertyAssign(property_id="p-1", commission_override_pct=29),
    )
    item = {i.name: i for i in svc.list(_ctx()).items}["A"]
    assert item.commission_min == 29.0
    assert item.commission_max == 29.0


def test_list_commission_none_without_properties() -> None:
    # Ohne zugeordnete Objekte: min/max None → UI fällt auf den Default zurück.
    svc = _svc()
    svc.create(_ctx(), OwnerCreate(name="A", default_commission_pct=15))
    item = {i.name: i for i in svc.list(_ctx()).items}["A"]
    assert item.commission_min is None and item.commission_max is None


def test_update_changes_fields() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    upd = svc.update(_ctx(), owner.id, OwnerUpdate(default_commission_pct=15, iban="DE00"))
    assert upd.default_commission_pct == 15
    assert upd.iban == "DE00"


def test_delete_removes_owner() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    svc.delete(_ctx(), owner.id)
    with pytest.raises(OwnerError) as exc:
        svc.get(_ctx(), owner.id)
    assert exc.value.status_code == 404


# --- Objekt-Zuordnung --------------------------------------------------------

def test_assign_property_with_share_and_commission() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    res = svc.assign_property(
        _ctx(),
        owner.id,
        OwnerPropertyAssign(property_id="p-1", ownership_share=60, commission_override_pct=12),
    )
    assert len(res.properties) == 1
    link = res.properties[0]
    assert link.property_id == "p-1"
    assert link.ownership_share == 60
    assert link.commission_override_pct == 12


def test_assign_foreign_property_rejected() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    with pytest.raises(OwnerError) as exc:
        svc.assign_property(_ctx(), owner.id, OwnerPropertyAssign(property_id="p-fremd"))
    assert exc.value.status_code == 400


def test_assign_is_upsert_updates_share() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    svc.assign_property(
        _ctx(), owner.id, OwnerPropertyAssign(property_id="p-1", ownership_share=50)
    )
    res = svc.assign_property(
        _ctx(), owner.id, OwnerPropertyAssign(property_id="p-1", ownership_share=80)
    )
    assert len(res.properties) == 1
    assert res.properties[0].ownership_share == 80


def test_unassign_property() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    svc.assign_property(_ctx(), owner.id, OwnerPropertyAssign(property_id="p-1"))
    res = svc.unassign_property(_ctx(), owner.id, "p-1")
    assert res.properties == []


# --- Exklusivität: ein Objekt gehört genau einem Eigentümer ------------------

def test_assign_property_owned_by_other_rejected() -> None:
    """p-1 gehört Owner A — Owner B darf es nicht zusätzlich bekommen (409)."""
    svc = _svc()
    a = svc.create(_ctx(), OwnerCreate(name="A"))
    b = svc.create(_ctx(), OwnerCreate(name="B"))
    svc.assign_property(_ctx(), a.id, OwnerPropertyAssign(property_id="p-1"))
    with pytest.raises(OwnerError) as exc:
        svc.assign_property(_ctx(), b.id, OwnerPropertyAssign(property_id="p-1"))
    assert exc.value.status_code == 409


def test_available_properties_excludes_other_owners_property() -> None:
    """Frei + eigenes Objekt erscheinen; Objekt eines anderen Owners nicht."""
    svc = _svc(
        {
            "properties": [
                {"id": "p-1", "tenant_id": "t-1", "title": "Villa"},
                {"id": "p-2", "tenant_id": "t-1", "title": "Haus"},
                {"id": "p-3", "tenant_id": "t-1", "title": "Loft"},
            ]
        }
    )
    a = svc.create(_ctx(), OwnerCreate(name="A"))
    b = svc.create(_ctx(), OwnerCreate(name="B"))
    svc.assign_property(_ctx(), a.id, OwnerPropertyAssign(property_id="p-1"))
    svc.assign_property(_ctx(), b.id, OwnerPropertyAssign(property_id="p-2"))
    # Für A: das eigene p-1 + das freie p-3, aber NICHT B's p-2.
    avail = {p.id for p in svc.available_properties(_ctx(), a.id).items}
    assert avail == {"p-1", "p-3"}


def test_available_properties_scoped_by_accommodation_type() -> None:
    """Betriebsart hotel → nur Zimmertypen zur Zuordnung anbieten."""
    svc = _svc(
        {
            "tenants": [{"id": "t-1", "accommodation_type": "hotel"}],
            "properties": [
                {
                    "id": "p-1",
                    "tenant_id": "t-1",
                    "title": "FeWo",
                    "property_type": "appartement",
                },
                {
                    "id": "p-2",
                    "tenant_id": "t-1",
                    "title": "Zimmer 101",
                    "property_type": "einzelzimmer",
                },
            ],
        }
    )
    a = svc.create(_ctx(), OwnerCreate(name="A"))
    avail = {p.id for p in svc.available_properties(_ctx(), a.id).items}
    assert avail == {"p-2"}


# --- Owner-Login-Verknüpfung -------------------------------------------------

def test_link_user_must_be_owner_role() -> None:
    svc = _svc({"users": [{"id": "u-9", "tenant_id": "t-1", "role": "staff"}]})
    with pytest.raises(OwnerError) as exc:
        svc.create(_ctx(), OwnerCreate(name="A", user_id="u-9"))
    assert exc.value.status_code == 400


def test_link_unknown_user_404() -> None:
    svc = _svc()
    with pytest.raises(OwnerError) as exc:
        svc.create(_ctx(), OwnerCreate(name="A", user_id="u-unknown"))
    assert exc.value.status_code == 404


def test_link_valid_owner_user_ok() -> None:
    svc = _svc({"users": [{"id": "u-own", "tenant_id": "t-1", "role": "owner"}]})
    res = svc.create(_ctx(), OwnerCreate(name="A", user_id="u-own"))
    assert res.user_id == "u-own"
