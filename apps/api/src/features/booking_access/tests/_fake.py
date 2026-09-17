"""Zustandsbehaftetes DB-Doppel für die Buchungsberechtigungen.

Jeder Filter filtert ECHT — auch `ilike`. Das ist hier keine Gründlichkeit um
ihrer selbst willen: der Dienst sucht Gäste über ihre E-Mail-Adresse, und `_`
ist in PostgREST ein Platzhalter. Ein Doppel, das `ilike` wie `eq` behandelt,
würde die Prüfung auf `escape_like` stillschweigend durchwinken und damit
genau den Fehler verstecken, der einen fremden Prüfstand als eigenen
durchgehen ließe.
"""
from __future__ import annotations

import re
from typing import Any

from src.core.security import AuthContext


def ctx(tenant_id: str | None = "t-1", user_id: str = "u-1") -> AuthContext:
    return AuthContext(user_id=user_id, tenant_id=tenant_id, role="admin")


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


def _ilike_passt(wert: object, muster: str) -> bool:
    """PostgREST-`ilike`: `%` = beliebig viele Zeichen, `_` = genau eines."""
    if wert is None:
        return False
    regex, i = "", 0
    while i < len(muster):
        z = muster[i]
        if z == "\\" and i + 1 < len(muster):
            regex += re.escape(muster[i + 1])
            i += 2
            continue
        regex += {"%": ".*", "_": "."}.get(z, re.escape(z))
        i += 1
    return re.fullmatch(regex, str(wert), flags=re.IGNORECASE) is not None


class _Not:
    def __init__(self, q: _Query) -> None:
        self._q = q

    def is_(self, col: str, val: object) -> _Query:
        self._q._filters.append((col, "isnot", val))
        return self._q


class _Query:
    def __init__(self, db: FakeDB, table: str) -> None:
        self._db = db
        self._table = table
        self._filters: list[tuple[str, str, Any]] = []
        self._op = "select"
        self._payload: dict | None = None
        self._limit: int | None = None

    def select(self, *_a: object, **_k: object) -> _Query:
        return self

    def update(self, payload: dict) -> _Query:
        self._op, self._payload = "update", payload
        return self

    def eq(self, col: str, val: object) -> _Query:
        self._filters.append((col, "eq", val))
        return self

    def in_(self, col: str, vals: list) -> _Query:
        self._filters.append((col, "in", tuple(str(v) for v in vals)))
        return self

    def lte(self, col: str, val: object) -> _Query:
        self._filters.append((col, "lte", val))
        return self

    def ilike(self, col: str, muster: str) -> _Query:
        self._filters.append((col, "ilike", muster))
        return self

    @property
    def not_(self) -> _Not:
        return _Not(self)

    def limit(self, n: int) -> _Query:
        self._limit = n
        return self

    def _passt(self, row: dict) -> bool:
        for col, op, val in self._filters:
            wert = row.get(col)
            if op == "eq" and str(wert) != str(val):
                return False
            if op == "in" and str(wert) not in val:
                return False
            if op == "isnot" and (wert is None) == (val in ("null", None)):
                return False
            if op == "ilike" and not _ilike_passt(wert, val):
                return False
            if op == "lte" and (wert is None or str(wert) > str(val)):
                return False
        return True

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        treffer = [r for r in rows if self._passt(r)]
        if self._op == "update":
            for r in treffer:
                r.update(self._payload or {})
            self._db.schreibzugriffe.append(self._table)
            return _Result([dict(r) for r in treffer])
        if self._limit is not None:
            treffer = treffer[: self._limit]
        return _Result([dict(r) for r in treffer])


class FakeDB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables: dict[str, list[dict]] = {k: list(v) for k, v in tables.items()}
        # Welche Tabellen geschrieben wurden — die Entscheidung muss an BEIDEN
        # Stellen landen (Betrieb und Objekte), und genau das soll prüfbar sein.
        self.schreibzugriffe: list[str] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)
