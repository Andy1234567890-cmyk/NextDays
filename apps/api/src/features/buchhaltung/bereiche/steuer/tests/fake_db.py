"""Fake-Supabase für die Steuer-Tests: filtert in Python, zeichnet Schreibzugriffe auf.

Unterstützt die Kette, die der Service benutzt: select/eq/neq/is_/gte/lte/in_/
order/limit/execute sowie insert/update/upsert. Kein Netz, keine echte DB.
"""

from __future__ import annotations

from types import SimpleNamespace

from postgrest.exceptions import APIError


class _Chain:
    def __init__(self, table: _Table) -> None:
        self._t = table
        self._filter: list[tuple[str, str, object]] = []
        self._op: str | None = None
        self._payload: object = None
        self._order: list[tuple[str, bool]] = []
        self._limit: int | None = None

    def select(self, *_a: object, **_k: object) -> _Chain:
        return self

    def limit(self, n: int) -> _Chain:
        self._limit = n
        return self

    def order(self, feld: str, desc: bool = False) -> _Chain:
        self._order.append((feld, desc))
        return self

    def eq(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("eq", feld, wert))
        return self

    def neq(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("neq", feld, wert))
        return self

    def is_(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("is", feld, wert))
        return self

    def gte(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("gte", feld, wert))
        return self

    def lte(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("lte", feld, wert))
        return self

    def in_(self, feld: str, werte: list) -> _Chain:
        self._filter.append(("in", feld, list(werte)))
        return self

    def insert(self, payload: dict) -> _Chain:
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict) -> _Chain:
        self._op, self._payload = "update", payload
        return self

    def upsert(self, payload: dict, **_k: object) -> _Chain:
        self._op, self._payload = "upsert", payload
        return self

    @staticmethod
    def _passt(row: dict, art: str, feld: str, wert: object) -> bool:
        v = row.get(feld)
        if art == "eq":
            return v == wert
        if art == "neq":
            return v != wert
        if art == "is":
            return (v is None) if wert == "null" else (v is not None)
        if art == "gte":
            return v is not None and str(v) >= str(wert)
        if art == "lte":
            return v is not None and str(v) <= str(wert)
        if art == "in":
            return v in wert
        raise AssertionError(art)

    def _treffer(self) -> list[dict]:
        rows = [r for r in self._t.rows if all(self._passt(r, *f) for f in self._filter)]
        for feld, desc in reversed(self._order):
            rows.sort(key=lambda r: str(r.get(feld)), reverse=desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        return rows

    def execute(self) -> SimpleNamespace:
        if self._t.fehler is not None:
            raise self._t.fehler
        self._t.calls.append(self._op or "select")
        if self._op == "insert":
            assert isinstance(self._payload, dict)
            if self._t.race_einmal:
                # „Der andere Prozess" hat dieselbe Zeile soeben angelegt: sie steht
                # in der Tabelle, unser Insert läuft in den Unique-Backstop.
                self._t.race_einmal = False
                fremd = {**self._payload, "id": f"{self._t.name}-race"}
                fremd.setdefault("created_at", "2026-09-12T10:00:00Z")
                fremd.setdefault("updated_at", "2026-09-12T10:00:00Z")
                self._t.rows.append(fremd)
                raise APIError({"code": "23505", "message": "duplicate key"})
            if any(
                r.get("period") == self._payload.get("period")
                and r.get("version") == self._payload.get("version")
                and r.get("tenant_id") == self._payload.get("tenant_id")
                for r in self._t.rows
                if "version" in self._payload
            ):
                raise APIError({"code": "23505", "message": "duplicate key"})
            neu = {**self._payload, "id": f"{self._t.name}-{len(self._t.rows) + 1}"}
            neu.setdefault("created_at", "2026-09-12T10:00:00Z")
            neu.setdefault("updated_at", "2026-09-12T10:00:00Z")
            self._t.rows.append(neu)
            self._t.inserts.append(neu)
            return SimpleNamespace(data=[neu])
        if self._op == "update":
            assert isinstance(self._payload, dict)
            rows = self._treffer()
            for r in rows:
                r.update(self._payload)
            self._t.updates.append((list(self._filter), self._payload))
            return SimpleNamespace(data=rows)
        if self._op == "upsert":
            assert isinstance(self._payload, dict)
            key = self._payload.get("tenant_id")
            for r in self._t.rows:
                if r.get("tenant_id") == key:
                    r.update(self._payload)
                    return SimpleNamespace(data=[r])
            neu = {**self._payload, "updated_at": "2026-09-12T10:00:00Z"}
            self._t.rows.append(neu)
            return SimpleNamespace(data=[neu])
        return SimpleNamespace(data=self._treffer())


class _Table:
    def __init__(self, name: str, rows: list[dict]) -> None:
        self.name = name
        self.rows = rows
        self.inserts: list[dict] = []
        self.updates: list[tuple] = []
        self.calls: list[str] = []
        self.fehler: Exception | None = None
        self.race_einmal = False


class FakeDB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables = {n: _Table(n, r) for n, r in tables.items()}

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.setdefault(name, _Table(name, [])))

    def tabelle_fehlt(self, name: str) -> None:
        """Simuliert PostgreSQL 42P01 (Tabelle existiert noch nicht)."""
        self.table(name)
        self.tables[name].fehler = APIError({"code": "42P01", "message": "relation does not exist"})
