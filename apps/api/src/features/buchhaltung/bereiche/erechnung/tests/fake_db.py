"""In-Memory-Doppelgänger des Supabase-Clients für den Bereich »erechnung«.

Deckt genau die Kette ab, die der Service benutzt (select/eq/in_/is_/gte/lte/
order/limit, insert/update/upsert, storage.upload/download) — und wirft den
23505 des Unique-Index nach, damit der Idempotenz-Pfad testbar ist.
"""
# ruff: noqa: E501 — XML-Fixturen und Aufrufe mit vollem Payload bleiben in einer Zeile lesbar
from __future__ import annotations

import itertools
from types import SimpleNamespace

from postgrest.exceptions import APIError

_ids = itertools.count(1)


class _Chain:
    def __init__(self, table: _Table) -> None:
        self._t = table
        self._filter: list[tuple[str, str, object]] = []
        self._op: str | None = None
        self._payload: object = None
        self._limit: int | None = None

    def select(self, *_a: object, **_k: object) -> _Chain:
        return self

    def order(self, *_a: object, **_k: object) -> _Chain:
        return self

    def limit(self, n: int) -> _Chain:
        self._limit = n
        return self

    def eq(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("eq", feld, wert))
        return self

    def in_(self, feld: str, werte: list) -> _Chain:
        self._filter.append(("in", feld, list(werte)))
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

    def insert(self, payload: dict) -> _Chain:
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict) -> _Chain:
        self._op, self._payload = "update", payload
        return self

    def upsert(self, payload: dict, **_k: object) -> _Chain:
        self._op, self._payload = "upsert", payload
        return self

    def _passt(self, row: dict) -> bool:
        for art, feld, wert in self._filter:
            v = row.get(feld)
            if art == "eq" and v != wert:
                return False
            if art == "in" and v not in wert:
                return False
            if art == "is" and wert == "null" and v is not None:
                return False
            if art == "gte" and (v is None or str(v) < str(wert)):
                return False
            if art == "lte" and (v is None or str(v) > str(wert)):
                return False
        return True

    def execute(self) -> SimpleNamespace:
        if self._op == "insert":
            return SimpleNamespace(data=[self._t.einfuegen(dict(self._payload))])  # type: ignore[arg-type]
        if self._op == "update":
            treffer = [r for r in self._t.rows if self._passt(r)]
            for r in treffer:
                r.update(self._payload)  # type: ignore[arg-type]
            self._t.updates.append(dict(self._payload))  # type: ignore[arg-type]
            return SimpleNamespace(data=treffer)
        if self._op == "upsert":
            p = dict(self._payload)  # type: ignore[arg-type]
            for r in self._t.rows:
                if r.get("tenant_id") == p.get("tenant_id"):
                    r.update(p)
                    return SimpleNamespace(data=[r])
            return SimpleNamespace(data=[self._t.einfuegen(p)])
        rows = [r for r in self._t.rows if self._passt(r)]
        if self._limit is not None:
            rows = rows[: self._limit]
        return SimpleNamespace(data=rows)


class _Table:
    def __init__(self, name: str, rows: list[dict], unique: list[tuple[str, ...]]) -> None:
        self.name = name
        self.rows = rows
        self.unique = unique
        self.inserts: list[dict] = []
        self.updates: list[dict] = []

    def einfuegen(self, row: dict) -> dict:
        for schluessel in self.unique:
            for alt in self.rows:
                if all(alt.get(k) == row.get(k) for k in schluessel):
                    raise APIError({"code": "23505", "message": "duplicate", "hint": "", "details": ""})
        row.setdefault("id", f"{self.name}-{next(_ids)}")
        row.setdefault("created_at", "2026-09-12T10:00:00+00:00")
        row.setdefault("updated_at", "2026-09-12T10:00:00+00:00")
        row.setdefault("generated_at", "2026-09-12T10:00:00+00:00")
        self.rows.append(row)
        self.inserts.append(row)
        return row


class FakeStorage:
    def __init__(self) -> None:
        self.dateien: dict[str, bytes] = {}
        self.uploads: list[str] = []

    def from_(self, _bucket: str) -> FakeStorage:
        return self

    def upload(self, pfad: str, daten: bytes, _opts: dict) -> None:
        self.dateien[pfad] = daten
        self.uploads.append(pfad)

    def download(self, pfad: str) -> bytes:
        return self.dateien[pfad]


_UNIQUE = {
    "e_invoices": [("tenant_id", "invoice_id", "xml_sha256"), ("tenant_id", "invoice_id", "version")],
}


class FakeDB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables: dict[str, _Table] = {}
        for n, r in tables.items():
            self.tables[n] = _Table(n, r, _UNIQUE.get(n, []))
        self.storage = FakeStorage()

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.setdefault(name, _Table(name, [], _UNIQUE.get(name, []))))
