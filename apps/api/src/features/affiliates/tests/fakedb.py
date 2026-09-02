"""In-Memory-Nachbau des Supabase-Query-Builders für die Partner-Tests.

Bewusst mehr als die üblichen Stubs: die Fachlogik hängt an Filtern
(`eq`, `in_`, `is_`, `lte`), an `count="exact"` und an den UNIQUE-Backstops.
Ein Stub, der alles zurückgibt, würde genau die Fälle verdecken, die hier
geprüft werden (Duplikat, Scope, Reifung). Die UNIQUE-Regeln aus 0517 sind
nachgebaut und werfen denselben `APIError` (23505) wie PostgREST.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from postgrest.exceptions import APIError

_UNIQUE: dict[str, list[tuple[tuple[str, ...], dict[str, Any] | None]]] = {
    "affiliate_referrals": [(("tenant_id",), None)],
    "affiliate_referral_codes": [(("code",), None)],
    "affiliate_clicks": [(("click_token",), None)],
    "affiliate_commissions": [
        (("stripe_invoice_id",), {"kind": "earn"}),
        (("stripe_event_id",), None),
        (("parent_id",), {"kind": "override"}),
        (("affiliate_id", "tier_id"), {"kind": "bonus"}),
        (("parent_id", "affiliate_id"), {"kind": "lifetime"}),
        (("stripe_charge_id", "affiliate_id"), {"kind": "booking_share"}),
    ],
    "affiliate_team_threads": [(("sponsor_affiliate_id", "member_affiliate_id"), None)],
    "affiliate_payouts": [
        (("statement_no",), None),
        (("stripe_transfer_id",), None),
    ],
    "affiliates": [(("email",), None)],
}


def _unique_error() -> APIError:
    return APIError(
        {
            "message": "duplicate key value violates unique constraint",
            "code": "23505",
            "hint": None,
            "details": None,
        }
    )


class _Result:
    def __init__(self, data: list[dict[str, Any]], count: int | None) -> None:
        self.data = data
        self.count = count


class _Not:
    def __init__(self, q: _Query) -> None:
        self._q = q

    def is_(self, spalte: str, wert: Any) -> _Query:  # noqa: ANN401
        self._q._filter.append(lambda r: not _is(r.get(spalte), wert))
        return self._q


def _is(feld: Any, wert: Any) -> bool:  # noqa: ANN401
    if wert in ("null", None):
        return feld is None
    return feld == wert


class _Query:
    def __init__(self, db: FakeDb, tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self._filter: list[Any] = []
        self._op: str = "select"
        self._payload: Any = None
        self._count = False
        self._order: tuple[str, bool] | None = None
        self._limit: int | None = None
        self._range: tuple[int, int] | None = None
        self.not_ = _Not(self)

    # --- Operationen -------------------------------------------------------
    def select(self, *_a: Any, count: str | None = None, **_k: Any) -> _Query:
        self._op = "select"
        self._count = count == "exact"
        return self

    def insert(self, payload: Any) -> _Query:  # noqa: ANN401
        self._op, self._payload = "insert", payload
        return self

    def upsert(self, payload: Any, **_k: Any) -> _Query:  # noqa: ANN401
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict[str, Any]) -> _Query:
        self._op, self._payload = "update", payload
        return self

    def delete(self) -> _Query:
        self._op = "delete"
        return self

    # --- Filter --------------------------------------------------------------
    def eq(self, spalte: str, wert: Any) -> _Query:  # noqa: ANN401
        self._filter.append(lambda r: r.get(spalte) == wert)
        return self

    def neq(self, spalte: str, wert: Any) -> _Query:  # noqa: ANN401
        self._filter.append(lambda r: r.get(spalte) != wert)
        return self

    def in_(self, spalte: str, werte: list[Any]) -> _Query:
        self._filter.append(lambda r: r.get(spalte) in set(werte))
        return self

    def is_(self, spalte: str, wert: Any) -> _Query:  # noqa: ANN401
        self._filter.append(lambda r: _is(r.get(spalte), wert))
        return self

    def lte(self, spalte: str, wert: Any) -> _Query:  # noqa: ANN401
        self._filter.append(lambda r: r.get(spalte) is not None and str(r[spalte]) <= str(wert))
        return self

    def lt(self, spalte: str, wert: Any) -> _Query:  # noqa: ANN401
        self._filter.append(lambda r: r.get(spalte) is not None and str(r[spalte]) < str(wert))
        return self

    def gte(self, spalte: str, wert: Any) -> _Query:  # noqa: ANN401
        self._filter.append(lambda r: r.get(spalte) is not None and str(r[spalte]) >= str(wert))
        return self

    def like(self, spalte: str, muster: str) -> _Query:
        praefix = muster.rstrip("%")
        self._filter.append(lambda r: str(r.get(spalte) or "").startswith(praefix))
        return self

    def or_(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def order(self, spalte: str, desc: bool = False, **_k: Any) -> _Query:
        self._order = (spalte, desc)
        return self

    def limit(self, n: int, **_k: Any) -> _Query:
        self._limit = n
        return self

    def range(self, von: int, bis: int) -> _Query:
        self._range = (von, bis)
        return self

    # --- Ausführung ------------------------------------------------------------
    def _treffer(self) -> list[dict[str, Any]]:
        rows = [r for r in self._db.rows[self._tabelle] if all(f(r) for f in self._filter)]
        if self._order:
            spalte, desc = self._order
            rows.sort(key=lambda r: str(r.get(spalte) or ""), reverse=desc)
        return rows

    def execute(self) -> _Result:
        tabelle = self._db.rows[self._tabelle]
        if self._op == "select":
            rows = self._treffer()
            total = len(rows)
            if self._range:
                rows = rows[self._range[0] : self._range[1] + 1]
            if self._limit is not None:
                rows = rows[: self._limit]
            return _Result([dict(r) for r in rows], total if self._count else None)
        if self._op == "insert":
            neu = self._payload if isinstance(self._payload, list) else [self._payload]
            angelegt = []
            for zeile in neu:
                z = dict(zeile)
                z.setdefault("id", str(uuid.uuid4()))
                z.setdefault("created_at", datetime.now(UTC).isoformat())
                self._db.pruefe_unique(self._tabelle, z)
                tabelle.append(z)
                angelegt.append(dict(z))
            self._db.inserts.append((self._tabelle, angelegt))
            return _Result(angelegt, None)
        if self._op == "update":
            rows = self._treffer()
            for r in rows:
                r.update(self._payload)
            self._db.updates.append((self._tabelle, dict(self._payload), len(rows)))
            return _Result([dict(r) for r in rows], None)
        if self._op == "delete":
            rows = self._treffer()
            for r in rows:
                tabelle.remove(r)
            return _Result([dict(r) for r in rows], None)
        raise AssertionError(self._op)


class FakeDb:
    def __init__(self, rows: dict[str, list[dict[str, Any]]] | None = None) -> None:
        self.rows: dict[str, list[dict[str, Any]]] = {}
        for t, liste in (rows or {}).items():
            self.rows[t] = []
            for r in liste:
                z = dict(r)
                # Wie die echte DB: jede Zeile hat id und created_at.
                z.setdefault("id", str(uuid.uuid4()))
                z.setdefault("created_at", datetime.now(UTC).isoformat())
                self.rows[t].append(z)
        self.inserts: list[tuple[str, list[dict[str, Any]]]] = []
        self.updates: list[tuple[str, dict[str, Any], int]] = []

    def table(self, name: str) -> _Query:
        self.rows.setdefault(name, [])
        return _Query(self, name)

    def pruefe_unique(self, tabelle: str, neu: dict[str, Any]) -> None:
        for spalten, bedingung in _UNIQUE.get(tabelle, []):
            if any(neu.get(s) is None for s in spalten):
                continue
            if bedingung and any(neu.get(k) != v for k, v in bedingung.items()):
                continue
            for r in self.rows[tabelle]:
                if bedingung and any(r.get(k) != v for k, v in bedingung.items()):
                    continue
                if all(r.get(s) == neu.get(s) for s in spalten):
                    raise _unique_error()

    def zeilen(self, tabelle: str) -> list[dict[str, Any]]:
        return self.rows.setdefault(tabelle, [])
