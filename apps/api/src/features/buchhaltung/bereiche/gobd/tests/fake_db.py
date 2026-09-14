"""Fake-Supabase für die gobd-Tests: Zeilen als Dicts, Filter in Python.

Kein Mock-Umbau der Produktion — der Fake versteht genau die Kette, die der
Service benutzt (select/eq/neq/in_/is_/gte/lte/lt/order/limit/range,
insert/update/upsert). `unique_kollisionen` simuliert 23505 auf der Kette.
"""
from __future__ import annotations

import itertools
from types import SimpleNamespace
from typing import Any

from postgrest.exceptions import APIError

_SEQ = itertools.count(1)


class _Chain:
    def __init__(self, table: _Table, db: FakeDb) -> None:
        self._t = table
        self._db = db
        self._filter: list[tuple[str, str, Any]] = []
        self._order: list[tuple[str, bool]] = []
        self._limit: int | None = None
        self._range: tuple[int, int] | None = None
        self._op: str | None = None
        self._payload: Any = None
        self._count = False

    # --- Auswahl
    def select(self, *_cols: str, count: str | None = None, **_k: Any) -> _Chain:
        self._count = count is not None
        return self

    def eq(self, f: str, v: Any) -> _Chain:
        self._filter.append(("eq", f, v))
        return self

    def neq(self, f: str, v: Any) -> _Chain:
        self._filter.append(("neq", f, v))
        return self

    def in_(self, f: str, v: list) -> _Chain:
        self._filter.append(("in", f, list(v)))
        return self

    def is_(self, f: str, v: Any) -> _Chain:
        self._filter.append(("is", f, v))
        return self

    def gte(self, f: str, v: Any) -> _Chain:
        self._filter.append(("gte", f, v))
        return self

    def lte(self, f: str, v: Any) -> _Chain:
        self._filter.append(("lte", f, v))
        return self

    def lt(self, f: str, v: Any) -> _Chain:
        self._filter.append(("lt", f, v))
        return self

    def order(self, f: str, desc: bool = False, **_k: Any) -> _Chain:
        self._order.append((f, desc))
        return self

    def limit(self, n: int) -> _Chain:
        self._limit = n
        return self

    def range(self, a: int, b: int) -> _Chain:
        self._range = (a, b)
        return self

    # --- Schreiben
    def insert(self, payload: Any) -> _Chain:
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict) -> _Chain:
        self._op, self._payload = "update", payload
        return self

    def upsert(self, payload: dict, on_conflict: str = "id") -> _Chain:
        self._op, self._payload = "upsert", (payload, on_conflict)
        return self

    def delete(self) -> _Chain:
        self._op = "delete"
        return self

    # --- Ausführen
    def _passt(self, row: dict) -> bool:
        for art, f, v in self._filter:
            w = row.get(f)
            if art == "eq" and w != v:
                return False
            if art == "neq" and w == v:
                return False
            if art == "in" and w not in v:
                return False
            if art == "is" and v == "null" and w is not None:
                return False
            if art == "gte" and (w is None or str(w) < str(v)):
                return False
            if art == "lte" and (w is None or str(w) > str(v)):
                return False
            if art == "lt" and (w is None or str(w) >= str(v)):
                return False
        return True

    def _treffer(self) -> list[dict]:
        rows = [r for r in self._t.rows if self._passt(r)]
        for f, desc in reversed(self._order):
            rows.sort(key=lambda r: (r.get(f) is None, str(r.get(f))), reverse=desc)
        return rows

    def execute(self) -> SimpleNamespace:
        if self._op == "insert":
            neu = self._payload if isinstance(self._payload, list) else [self._payload]
            gespeichert = []
            for p in neu:
                self._db.pruefe_unique(self._t.name, p)
                row = {**p}
                row.setdefault("id", f"{self._t.name}-{len(self._t.rows) + 1}")
                if self._t.name == "gobd_audit_log":
                    row["seq"] = next(_SEQ)
                row.setdefault("created_at", "2026-09-12T10:00:00+00:00")
                row.setdefault("updated_at", "2026-09-12T10:00:00+00:00")
                self._t.rows.append(row)
                gespeichert.append(row)
            self._t.inserts.extend(gespeichert)
            return SimpleNamespace(data=gespeichert, count=None)
        if self._op == "update":
            treffer = self._treffer()
            for r in treffer:
                r.update(self._payload)
            self._t.updates.append((dict(self._payload), [r["id"] for r in treffer]))
            return SimpleNamespace(data=treffer, count=None)
        if self._op == "upsert":
            payload, key = self._payload
            for r in self._t.rows:
                if r.get(key) == payload.get(key):
                    r.update(payload)
                    return SimpleNamespace(data=[r], count=None)
            row = {**payload, "updated_at": "2026-09-12T10:00:00+00:00"}
            self._t.rows.append(row)
            return SimpleNamespace(data=[row], count=None)
        if self._op == "delete":
            treffer = self._treffer()
            self._t.rows[:] = [r for r in self._t.rows if r not in treffer]
            return SimpleNamespace(data=treffer, count=None)
        rows = self._treffer()
        anzahl = len(rows) if self._count else None
        if self._range:
            a, b = self._range
            rows = rows[a : b + 1]
        elif self._limit is not None:
            rows = rows[: self._limit]
        return SimpleNamespace(data=rows, count=anzahl)


class _Table:
    def __init__(self, name: str, rows: list[dict]) -> None:
        self.name = name
        self.rows = rows
        self.inserts: list[dict] = []
        self.updates: list[tuple[dict, list]] = []


class FakeDb:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables = {n: _Table(n, r) for n, r in tables.items()}
        # Wie oft der NÄCHSTE Insert in gobd_audit_log mit 23505 scheitern soll.
        self.unique_kollisionen = 0

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.setdefault(name, _Table(name, [])), self)

    def pruefe_unique(self, table: str, payload: dict) -> None:
        if table != "gobd_audit_log":
            return
        if self.unique_kollisionen > 0:
            self.unique_kollisionen -= 1
            raise APIError({"message": "duplicate key", "code": "23505"})
        for r in self.tables[table].rows:
            if r.get("tenant_id") == payload.get("tenant_id") and r.get("prev_hash") == payload.get(
                "prev_hash"
            ):
                raise APIError({"message": "duplicate key gobd_audit_log_kette_eindeutig",
                                "code": "23505"})

    def rows(self, name: str) -> list[dict]:
        return self.tables.setdefault(name, _Table(name, [])).rows
