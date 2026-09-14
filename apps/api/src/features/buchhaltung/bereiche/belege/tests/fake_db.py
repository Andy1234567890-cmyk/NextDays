"""Fake-Supabase für die Tests des Bereichs »belege«.

Im Stil von ../../../tests/test_kunden_anlegen.py, aber mit dem, was die
Belegkette braucht: Filter (`eq`, `is_`, `in_`, `lte`), Sortierung, `update`
und `delete` mit Filtern, `rpc('next_document_number')` mit eigenem Zähler je
doc_type — und die Unique-Indizes aus 0660/0661 als APIError 23505, damit die
Idempotenz-Pfade (Retry, Doppelklick) wirklich durchlaufen werden.
"""

from __future__ import annotations

import itertools
from types import SimpleNamespace

from postgrest.exceptions import APIError

_ids = itertools.count(1)


class _Chain:
    def __init__(self, db: FakeDB, table: str) -> None:
        self._db = db
        self._table = table
        self._filters: list[tuple[str, str, object]] = []
        self._op = "select"
        self._payload: object = None
        self._limit: int | None = None
        self._order: list[tuple[str, bool]] = []

    # --- Aufbau ---------------------------------------------------------------
    def select(self, *_a: object, **_k: object) -> _Chain:
        return self

    def limit(self, n: int) -> _Chain:
        self._limit = n
        return self

    def order(self, spalte: str, desc: bool = False) -> _Chain:
        self._order.append((spalte, desc))
        return self

    def eq(self, spalte: str, wert: object) -> _Chain:
        self._filters.append(("eq", spalte, wert))
        return self

    def is_(self, spalte: str, wert: object) -> _Chain:
        self._filters.append(("is", spalte, wert))
        return self

    def in_(self, spalte: str, werte: list) -> _Chain:
        self._filters.append(("in", spalte, list(werte)))
        return self

    def lte(self, spalte: str, wert: object) -> _Chain:
        self._filters.append(("lte", spalte, wert))
        return self

    def insert(self, payload: object) -> _Chain:
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict) -> _Chain:
        self._op, self._payload = "update", payload
        return self

    def delete(self) -> _Chain:
        self._op = "delete"
        return self

    # --- Ausführung -------------------------------------------------------------
    def _passt(self, row: dict) -> bool:
        for art, spalte, wert in self._filters:
            v = row.get(spalte)
            if art == "eq" and v != wert:
                return False
            if art == "is" and wert == "null" and v is not None:
                return False
            if art == "in" and v not in wert:
                return False
            if art == "lte" and (v is None or str(v) > str(wert)):
                return False
        return True

    def _treffer(self) -> list[dict]:
        rows = [r for r in self._db.rows(self._table) if self._passt(r)]
        for spalte, desc in reversed(self._order):
            rows.sort(key=lambda r: str(r.get(spalte) or ""), reverse=desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        return rows

    def execute(self) -> SimpleNamespace:
        if self._op == "select":
            return SimpleNamespace(data=[dict(r) for r in self._treffer()])
        if self._op == "insert":
            payloads = self._payload if isinstance(self._payload, list) else [self._payload]
            neu = []
            for p in payloads:
                row = {**p}
                row.setdefault("id", f"{self._table}-{next(_ids)}")
                row.setdefault(
                    "created_at", f"2026-09-12T00:00:{len(self._db.rows(self._table)):02d}Z"
                )
                row.setdefault("updated_at", row["created_at"])
                self._db.unique_pruefen(self._table, row)
                self._db.rows(self._table).append(row)
                neu.append(dict(row))
            self._db.inserts.append((self._table, payloads))
            return SimpleNamespace(data=neu)
        if self._op == "update":
            treffer = self._treffer()
            for r in treffer:
                r.update(self._payload)  # type: ignore[arg-type]
            self._db.updates.append((self._table, self._payload, [r["id"] for r in treffer]))
            return SimpleNamespace(data=[dict(r) for r in treffer])
        if self._op == "delete":
            treffer = self._treffer()
            ids = {r["id"] for r in treffer}
            self._db.tables[self._table] = [
                r for r in self._db.rows(self._table) if r["id"] not in ids
            ]
            self._db.deletes.append((self._table, sorted(ids)))
            return SimpleNamespace(data=[dict(r) for r in treffer])
        raise AssertionError(self._op)


def _fehler(index: str) -> APIError:
    return APIError(
        {
            "message": f'duplicate key value violates unique constraint "{index}"',
            "code": "23505",
            "hint": None,
            "details": None,
        }
    )


class FakeDB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables: dict[str, list[dict]] = dict(tables)
        self.inserts: list[tuple[str, list]] = []
        self.updates: list[tuple[str, dict, list]] = []
        self.deletes: list[tuple[str, list]] = []
        self.rpc_calls: list[dict] = []
        self._zaehler: dict[str, int] = {}

    def rows(self, table: str) -> list[dict]:
        return self.tables.setdefault(table, [])

    def table(self, name: str) -> _Chain:
        return _Chain(self, name)

    def rpc(self, name: str, params: dict) -> SimpleNamespace:
        assert name == "next_document_number", name
        self.rpc_calls.append(params)
        key = f"{params['p_tenant_id']}/{params['p_doc_type']}"
        n = self._zaehler.get(key, 0) + 1
        self._zaehler[key] = n
        return SimpleNamespace(
            execute=lambda: SimpleNamespace(
                data=[{"sequential_number": n, "formatted_number": f"{params['p_prefix']}{n:04d}"}]
            )
        )

    # Unique-Indizes aus 0660/0661/0105 (nur aktive Zeilen).
    def unique_pruefen(self, table: str, row: dict) -> None:
        if table != "invoices":
            return
        aktive = [r for r in self.rows("invoices") if r.get("deleted_at") is None]
        if row.get("source_document_id") and any(
            r.get("source_document_id") == row["source_document_id"]
            and r.get("invoice_type") == row.get("invoice_type")
            for r in aktive
        ):
            raise _fehler("invoices_folgebeleg_je_quelle_uidx")
        if row.get("source_quote_id") and any(
            r.get("source_quote_id") == row["source_quote_id"]
            and r.get("invoice_type") == row.get("invoice_type")
            for r in aktive
        ):
            raise _fehler("invoices_folgebeleg_je_angebot_uidx")
        if row.get("recurring_template_id") and any(
            r.get("recurring_template_id") == row["recurring_template_id"]
            and r.get("recurring_period_start") == row.get("recurring_period_start")
            for r in aktive
        ):
            raise _fehler("invoices_recurring_lauf_uidx")
