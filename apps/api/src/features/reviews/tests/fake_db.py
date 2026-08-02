"""Leichtgewichtige Fake-Supabase für die reviews-Tests.

Bildet nur die Query-Ketten ab, die der Slice wirklich benutzt (Muster wie
addons.tests). Kein Netz, keine echte Supabase — die Tests prüfen Logik, nicht
PostgREST.
"""
from __future__ import annotations

from typing import Any


class Result:
    def __init__(self, data: list[dict], count: int | None = None) -> None:
        self.data = data
        self.count = count


class Query:  # noqa: PLR0904 — Fluent-Builder, jede Methode ein Einzeiler
    def __init__(self, db: FakeDB, table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: list[dict] | dict | None = None
        self._eq: list[tuple[str, object]] = []
        self._in: list[tuple[str, list]] = []
        self._null: list[tuple[str, bool]] = []   # (Spalte, soll_null)
        self._cmp: list[tuple[str, str, Any]] = []
        self._want_count = False
        self._range: tuple[int, int] | None = None
        self._not = False

    # -- Aufbau ---------------------------------------------------------------
    def select(self, *_cols: object, count: str | None = None) -> Query:
        self._op = "select"
        self._want_count = count is not None
        return self

    def insert(self, payload: list[dict] | dict) -> Query:
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict) -> Query:
        self._op = "update"
        self._payload = payload
        return self

    def upsert(self, payload: list[dict] | dict, **_k: object) -> Query:
        self._op = "upsert"
        self._payload = payload
        return self

    def delete(self) -> Query:
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> Query:
        self._eq.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> Query:
        self._in.append((col, list(vals)))
        return self

    def ilike(self, col: str, val: str) -> Query:
        self._eq.append((col, str(val).lower()))
        return self

    def gte(self, col: str, val: object) -> Query:
        self._cmp.append((col, ">=", val))
        return self

    def lte(self, col: str, val: object) -> Query:
        self._cmp.append((col, "<=", val))
        return self

    def lt(self, col: str, val: object) -> Query:
        self._cmp.append((col, "<", val))
        return self

    def or_(self, _expr: str) -> Query:
        return self

    @property
    def not_(self) -> Query:
        self._not = True
        return self

    def is_(self, col: str, _null: str) -> Query:
        self._null.append((col, not self._not))
        self._not = False
        return self

    def order(self, *_a: object, **_k: object) -> Query:
        return self

    def limit(self, _n: int) -> Query:
        return self

    def range(self, start: int, end: int) -> Query:
        self._range = (start, end)
        return self

    # -- Ausführung -----------------------------------------------------------
    def _match(self, row: dict) -> bool:
        for col, val in self._eq:
            wert = self._value(row, col)
            if isinstance(val, str) and isinstance(wert, str):
                if wert.lower() != val.lower():
                    return False
            elif str(wert) != str(val):
                return False
        for col, vals in self._in:
            if str(self._value(row, col)) not in {str(v) for v in vals}:
                return False
        for col, soll_null in self._null:
            if (self._value(row, col) is None) is not soll_null:
                return False
        for col, op, val in self._cmp:
            wert = self._value(row, col)
            if wert is None:
                return False
            if op == ">=" and not str(wert) >= str(val):
                return False
            if op == "<=" and not str(wert) <= str(val):
                return False
            if op == "<" and not str(wert) < str(val):
                return False
        return True

    @staticmethod
    def _value(row: dict, col: str) -> object:
        """Spalte lesen — auch über einen eingebetteten Join (`properties.x`)."""
        if "." in col:
            aussen, innen = col.split(".", 1)
            eingebettet = row.get(aussen)
            if isinstance(eingebettet, dict):
                return eingebettet.get(innen)
            return None
        return row.get(col)

    def execute(self) -> Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            neu = self._payload if isinstance(self._payload, list) else [self._payload]
            angelegt = [self._db.add(self._table, dict(r)) for r in neu]
            return Result(angelegt)
        if self._op == "upsert":
            neu = self._payload if isinstance(self._payload, list) else [self._payload]
            return Result([self._db.upsert(self._table, dict(r)) for r in neu])
        treffer = [r for r in rows if self._match(r)]
        if self._op == "update":
            for row in treffer:
                row.update(self._payload or {})
            return Result(list(treffer))
        if self._op == "delete":
            for row in treffer:
                rows.remove(row)
            return Result(list(treffer))
        gesamt = len(treffer)
        if self._range:
            start, end = self._range
            treffer = treffer[start : end + 1]
        return Result(list(treffer), count=gesamt if self._want_count else None)


class FakeDB:
    """Speichert Zeilen je Tabelle. `unique` erzwingt Idempotenz-Backstops."""

    def __init__(
        self, tables: dict[str, list[dict]] | None = None,
        unique: dict[str, tuple[str, ...]] | None = None,
        defaults: dict[str, dict[str, object]] | None = None,
    ) -> None:
        self.tables: dict[str, list[dict]] = tables or {}
        self.unique = unique or {}
        # Spalten-Defaults der echten Tabelle. Postgres setzt sie beim INSERT;
        # ohne sie hier fehlten Felder, die der Code danach liest.
        self.defaults = defaults or {}
        self._seq = 0

    def table(self, name: str) -> Query:
        return Query(self, name)

    def _next_id(self) -> str:
        self._seq += 1
        return f"id-{self._seq}"

    def _key(self, table: str, row: dict) -> tuple | None:
        cols = self.unique.get(table)
        if not cols:
            return None
        return tuple(str(row.get(c)) for c in cols)

    def add(self, table: str, row: dict) -> dict:
        from postgrest.exceptions import APIError

        rows = self.tables.setdefault(table, [])
        key = self._key(table, row)
        if key is not None and any(self._key(table, r) == key for r in rows):
            raise APIError({"code": "23505", "message": "duplicate key"})
        for spalte, wert in self.defaults.get(table, {}).items():
            row.setdefault(spalte, wert() if callable(wert) else wert)
        row.setdefault("id", self._next_id())
        row.setdefault("created_at", "2026-08-01T00:00:00+00:00")
        rows.append(row)
        return row

    def upsert(self, table: str, row: dict) -> dict:
        rows = self.tables.setdefault(table, [])
        key = self._key(table, row)
        if key is not None:
            for vorhanden in rows:
                if self._key(table, vorhanden) == key:
                    vorhanden.update(row)
                    return vorhanden
        return self.add(table, row)
