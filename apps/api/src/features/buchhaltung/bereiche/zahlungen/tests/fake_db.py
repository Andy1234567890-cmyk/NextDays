"""In-Memory-Doppelgänger des Supabase-Clients für den Bereich »zahlungen«.

Kann, was der Service braucht: Filterkette (eq/neq/gt/gte/lt/lte/in_/is_/or_),
order/limit/range, insert (einzeln oder Liste), update, delete — und die
UNIQUE-Backstops der Migrationen 0643/0644/0648 als `APIError 23505`, denn
genau darauf stützt sich die Idempotenz (Wurzel 2). Eine Fake-DB ohne diese
Constraints würde jeden Doppelklick-Test grün färben, ohne etwas zu prüfen.
"""

from __future__ import annotations

import itertools
import re
from types import SimpleNamespace
from typing import Any

from postgrest.exceptions import APIError

_ZAEHLER = itertools.count(1)
_STAMPS = ("2026-09-12T10:00:00+00:00", "2026-09-12T10:00:01+00:00")

# (Tabelle, Spaltenmenge, Bedingung) — Unique-Indizes der Migrationen.
_UNIQUE: dict[str, list[tuple[tuple[str, ...], Any]]] = {
    "bank_transactions": [
        (("tenant_id", "import_hash"), None),
        (("payment_account_id",), lambda r: r.get("source") == "opening"),
    ],
    "transaction_links": [(("id",), None)],
    "invoice_payments": [
        (("transaction_id", "invoice_id"), lambda r: r.get("transaction_id") is not None)
    ],
    "payment_accounts": [(("tenant_id",), lambda r: bool(r.get("is_default")))],
}
_ORDER_RE = re.compile(r"^(\w+)\.(eq|ilike)\.(.+)$")


def unique_fehler() -> APIError:
    return APIError({"message": "duplicate key value violates unique constraint", "code": "23505"})


def fehlende_tabelle() -> APIError:
    return APIError({"message": "relation does not exist", "code": "42P01"})


class _Chain:
    def __init__(self, db: FakeDb, name: str) -> None:
        self._db = db
        self._name = name
        self._filter: list[Any] = []
        self._order: list[tuple[str, bool]] = []
        self._limit: int | None = None
        self._range: tuple[int, int] | None = None
        self._op: str | None = None
        self._payload: Any = None

    # --- Filter ---
    def select(self, *_a: object, **_k: object) -> _Chain:
        return self

    def eq(self, f: str, v: object) -> _Chain:
        self._filter.append(lambda r: _s(r.get(f)) == _s(v))
        return self

    def neq(self, f: str, v: object) -> _Chain:
        self._filter.append(lambda r: _s(r.get(f)) != _s(v))
        return self

    def gt(self, f: str, v: object) -> _Chain:
        self._filter.append(lambda r: _n(r.get(f)) > _n(v))
        return self

    def gte(self, f: str, v: object) -> _Chain:
        self._filter.append(lambda r: _n(r.get(f)) >= _n(v))
        return self

    def lt(self, f: str, v: object) -> _Chain:
        self._filter.append(lambda r: _n(r.get(f)) < _n(v))
        return self

    def lte(self, f: str, v: object) -> _Chain:
        self._filter.append(lambda r: _n(r.get(f)) <= _n(v))
        return self

    def in_(self, f: str, werte: list) -> _Chain:
        menge = {_s(w) for w in werte}
        self._filter.append(lambda r: _s(r.get(f)) in menge)
        return self

    def is_(self, f: str, v: object) -> _Chain:
        if v == "null":
            self._filter.append(lambda r: r.get(f) is None)
        else:
            self._filter.append(lambda r: r.get(f) == v)
        return self

    def or_(self, ausdruck: str) -> _Chain:
        teile = []
        for t in ausdruck.split(","):
            m = _ORDER_RE.match(t.strip())
            if not m:
                continue
            feld, op, wert = m.groups()
            if op == "eq":
                teile.append((feld, lambda x, w=wert: _s(x) == w))
            else:
                w = wert.strip("%").lower()
                teile.append((feld, lambda x, w=w: w in str(x or "").lower()))
        self._filter.append(lambda r: any(fn(r.get(f)) for f, fn in teile))
        return self

    def order(self, f: str, desc: bool = False) -> _Chain:
        self._order.append((f, desc))
        return self

    def limit(self, n: int) -> _Chain:
        self._limit = n
        return self

    def range(self, a: int, b: int) -> _Chain:
        self._range = (a, b)
        return self

    # --- Schreiben ---
    def insert(self, payload: Any) -> _Chain:
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict) -> _Chain:
        self._op, self._payload = "update", payload
        return self

    def delete(self) -> _Chain:
        self._op = "delete"
        return self

    def upsert(self, payload: dict, **_k: object) -> _Chain:
        self._op, self._payload = "insert", payload
        return self

    # --- Ausführen ---
    def _treffer(self) -> list[dict]:
        rows = [r for r in self._db.rows(self._name) if all(f(r) for f in self._filter)]
        for feld, desc in reversed(self._order):
            rows.sort(key=lambda r, f=feld: _s(r.get(f)), reverse=desc)
        if self._range:
            a, b = self._range
            rows = rows[a : b + 1]
        elif self._limit is not None:
            rows = rows[: self._limit]
        return rows

    def execute(self) -> SimpleNamespace:
        if self._name in self._db.fehlende_tabellen:
            raise fehlende_tabelle()
        if self._op == "insert":
            zeilen = self._payload if isinstance(self._payload, list) else [self._payload]
            neu: list[dict] = []
            for z in zeilen:
                self._db.unique_pruefen(self._name, z, neu)
            for z in zeilen:
                zeile = {**z}
                zeile.setdefault("id", f"{self._name}-{next(_ZAEHLER)}")
                zeile.setdefault("created_at", _STAMPS[0])
                zeile.setdefault("updated_at", _STAMPS[1])
                if self._name == "transaction_links":
                    zeile.setdefault("link_date", _STAMPS[0])
                if self._name == "bank_transactions":
                    zeile.setdefault("ignored", False)
                    zeile.setdefault("link_count", 0)
                    zeile.setdefault("linked_amount", "0")
                    zeile.setdefault("source", "import")
                self._db.rows(self._name).append(zeile)
                neu.append(zeile)
            self._db.log.append(("insert", self._name, len(neu)))
            return SimpleNamespace(data=[dict(z) for z in neu])
        if self._op == "update":
            treffer = self._treffer()
            for r in treffer:
                r.update(self._payload)
            self._db.log.append(("update", self._name, len(treffer)))
            return SimpleNamespace(data=[dict(r) for r in treffer])
        if self._op == "delete":
            treffer = self._treffer()
            ids = {id(r) for r in treffer}
            self._db.tables[self._name] = [r for r in self._db.rows(self._name) if id(r) not in ids]
            self._db.log.append(("delete", self._name, len(treffer)))
            return SimpleNamespace(data=[dict(r) for r in treffer])
        return SimpleNamespace(data=[dict(r) for r in self._treffer()])


def _s(v: object) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    return "" if v is None else str(v)


def _n(v: object) -> Any:
    try:
        return float(str(v))
    except (TypeError, ValueError):
        return _s(v)


class FakeDb:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables: dict[str, list[dict]] = {
            n: [dict(r) for r in rows] for n, rows in tables.items()
        }
        self.fehlende_tabellen: set[str] = set()
        self.log: list[tuple[str, str, int]] = []

    def rows(self, name: str) -> list[dict]:
        return self.tables.setdefault(name, [])

    def table(self, name: str) -> _Chain:
        return _Chain(self, name)

    def unique_pruefen(self, name: str, zeile: dict, neu_im_block: list[dict]) -> None:
        for spalten, bedingung in _UNIQUE.get(name, []):
            if bedingung and not bedingung(zeile):
                continue
            schluessel = tuple(_s(zeile.get(c)) for c in spalten)
            for r in [*self.rows(name), *neu_im_block]:
                if bedingung and not bedingung(r):
                    continue
                if tuple(_s(r.get(c)) for c in spalten) == schluessel:
                    raise unique_fehler()

    def einzige(self, name: str) -> dict:
        rows = self.rows(name)
        assert len(rows) == 1, (name, len(rows))
        return rows[0]
