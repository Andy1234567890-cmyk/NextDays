"""Fake-DB für den Bereich »kontenplan« (Stil wie ../../tests/test_kunden_anlegen.py).

Unterstützt select/eq/neq/is_/order/limit/insert/update/delete/execute. Ein
Unique-Konflikt wird über `db.unique[(tabelle, spalte)]` simuliert: ein zweiter
Insert mit demselben Wert wirft `APIError(code=23505)` — so lässt sich die
Idempotenz (Wurzel 2) prüfen, ohne Postgres.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError

from src.core.security import AuthContext

TENANT = "t1"
CTX = AuthContext(user_id="u", tenant_id=TENANT, role="admin")
FREMD = AuthContext(user_id="u2", tenant_id="t2", role="admin")


class _Chain:
    def __init__(self, table: FakeTable) -> None:
        self._t = table
        self._filter: list[tuple[str, str, object]] = []
        self._op: str | None = None
        self._payload: dict | None = None

    def select(self, *_a: object, **_k: object) -> _Chain:
        return self

    def order(self, *_a: object, **_k: object) -> _Chain:
        return self

    def limit(self, *_a: object, **_k: object) -> _Chain:
        return self

    def eq(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("eq", feld, wert))
        return self

    def neq(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("neq", feld, wert))
        return self

    def is_(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("is", feld, None if wert == "null" else wert))
        return self

    def insert(self, payload: dict) -> _Chain:
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict) -> _Chain:
        self._op, self._payload = "update", payload
        return self

    def delete(self) -> _Chain:
        self._op = "delete"
        return self

    def _passt(self, row: dict) -> bool:
        for op, feld, wert in self._filter:
            if op == "eq" and row.get(feld) != wert:
                return False
            if op == "neq" and row.get(feld) == wert:
                return False
            if op == "is" and row.get(feld) is not wert:
                return False
        return True

    def _unique_pruefen(self, neu: dict, *, ausser: str | None = None) -> None:
        for spalten in self._t.unique:
            for row in self._t.rows:
                if row.get("id") == ausser:
                    continue
                if all(row.get(s) == neu.get(s) for s in spalten):
                    raise APIError(
                        {"code": "23505", "message": "duplicate key", "details": "", "hint": ""}
                    )

    def execute(self) -> SimpleNamespace:
        if self._op == "insert":
            assert self._payload is not None
            self._t.inserts.append(self._payload)
            neu = {
                "id": f"{self._t.name}-{len(self._t.rows) + 1}",
                "created_at": "2026-09-12T00:00:00Z",
                "updated_at": "2026-09-12T00:00:00Z",
                **self._t.defaults,
                **self._payload,
            }
            self._unique_pruefen(neu)
            self._t.rows.append(neu)
            return SimpleNamespace(data=[neu])
        if self._op == "update":
            assert self._payload is not None
            treffer = [r for r in self._t.rows if self._passt(r)]
            for r in treffer:
                self._unique_pruefen({**r, **self._payload}, ausser=r["id"])
                r.update(self._payload)
            self._t.updates.append((list(self._filter), self._payload))
            return SimpleNamespace(data=treffer)
        if self._op == "delete":
            treffer = [r for r in self._t.rows if self._passt(r)]
            self._t.rows[:] = [r for r in self._t.rows if r not in treffer]
            self._t.deletes.append(list(self._filter))
            return SimpleNamespace(data=treffer)
        return SimpleNamespace(data=[r for r in self._t.rows if self._passt(r)])


class FakeTable:
    def __init__(
        self, name: str, rows: list[dict], unique: list[tuple[str, ...]], defaults: dict
    ) -> None:
        self.name = name
        self.rows = rows
        self.unique = unique
        self.defaults = defaults
        self.inserts: list[dict] = []
        self.updates: list = []
        self.deletes: list = []


_UNIQUE = {
    "booking_accounts": [("tenant_id", "number")],
    "cost_centers": [("tenant_id", "number")],
    "payment_methods": [("tenant_id", "name")],
    "number_sequences": [("tenant_id", "doc_type", "year")],
}
_DEFAULTS = {
    "booking_accounts": {"is_system": False, "active": True, "automatic_booking": False},
    "cost_centers": {"active": True},
    "payment_methods": {"active": True, "is_default": False},
    "number_sequences": {
        "prefix": "RE-",
        "suffix": "",
        "padding": 4,
        "next_value": 1,
        "start_value": 1,
        "year": None,
    },
}


class FakeDB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables: dict[str, FakeTable] = {}
        for name in _UNIQUE:
            self._anlegen(name, [])
        for name, rows in tables.items():
            self._anlegen(name, rows)

    def _anlegen(self, name: str, rows: list[dict]) -> FakeTable:
        t = FakeTable(name, rows, _UNIQUE.get(name, []), _DEFAULTS.get(name, {}))
        self.tables[name] = t
        return t

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.get(name) or self._anlegen(name, []))


@pytest.fixture(name="db")
def _db() -> FakeDB:
    return FakeDB()
