"""Doppel für die Massenbearbeitung.

Das DB-Doppel filtert echt (eq/in/limit), damit die Mandanten-Prüfung wirklich
geprüft wird und nicht nur mitläuft.

Die beiden Dienst-Doppel sind absichtlich SCHREIBEND: sie tragen den neuen Wert
in dieselbe Fake-Tabelle ein, aus der der Dienst vorher gelesen hat. Ein Doppel,
das die Änderung nur protokolliert, würde jeden zweiten Aufruf als „geändert"
melden — und damit genau die Idempotenz verstecken, die hier geprüft werden
soll.
"""
from __future__ import annotations

from typing import Any

from src.core.security import AuthContext
from src.features.properties.errors import PropertyError
from src.features.rates.service import RateError


def ctx(tenant_id: str | None = "t-1", user_id: str = "u-1") -> AuthContext:
    return AuthContext(user_id=user_id, tenant_id=tenant_id, role="admin")


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


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
        self.schreibzugriffe: list[str] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)


class FakeProperties:
    """Doppel für PropertiesService — nur `update`."""

    def __init__(self, db: FakeDB, *, wirft: set[str] | None = None) -> None:
        self._db = db
        self._wirft = wirft or set()
        self.aufrufe: list[tuple[str, dict]] = []

    def update(self, _ctx: AuthContext, property_id: str, req: Any) -> None:
        if property_id in self._wirft:
            raise PropertyError("Objekt ist gesperrt.", status_code=409)
        changes = req.model_dump(exclude_unset=True)
        self.aufrufe.append((property_id, changes))
        for row in self._db.tables.get("properties", []):
            if str(row.get("id")) == property_id:
                row.update(changes)


class FakeRates:
    """Doppel für RatesService — nur `update`."""

    def __init__(self, db: FakeDB, *, wirft: set[str] | None = None) -> None:
        self._db = db
        self._wirft = wirft or set()
        self.aufrufe: list[tuple[str, dict]] = []

    def update(self, _ctx: AuthContext, rate_plan_id: str, req: Any) -> None:
        if rate_plan_id in self._wirft:
            raise RateError("Preisplan gesperrt.", status_code=409)
        changes = req.model_dump(exclude_unset=True)
        self.aufrufe.append((rate_plan_id, changes))
        for row in self._db.tables.get("rate_plans", []):
            if str(row.get("id")) == rate_plan_id:
                row.update(changes)
