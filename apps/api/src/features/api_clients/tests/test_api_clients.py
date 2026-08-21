"""Tests für die VERWALTUNG der Entwickler-Zugänge: Erzeugen (show-once-Secret),
Rotieren, Widerrufen, Scope- und Objekt-Validierung. Schlanke In-Memory-Fake-DB.

Der Token-Tausch und die Scope-Durchsetzung am Endpunkt werden hier NICHT mehr
geprüft — sie liegen im eigenen Service `apps/public-api`, dessen Tests
(`apps/public-api/src/tests/test_auth.py`) den Roundtrip, den 401 bei falschem
Secret, den widerrufenen Zugang und das fail-closed ohne Signier-Secret abdecken.
Doppelte Tests an zwei Orten hätten den Umzug verdeckt.
"""
from __future__ import annotations

from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.api_clients.service import ApiClientError, ApiClientsService

_CTX = AuthContext(user_id="admin", tenant_id="t1")


class _Tbl:
    def __init__(self, store: dict, name: str) -> None:
        self.s, self.n, self._f, self._op = store, name, [], None

    def _rows(self) -> list[dict]:
        return self.s.setdefault(self.n, [])

    def select(self, *_a: Any, **_k: Any) -> _Tbl:
        self._op = ("select",)
        return self

    def insert(self, payload: dict) -> _Tbl:
        self._op = ("insert", payload)
        return self

    def update(self, payload: dict) -> _Tbl:
        self._op = ("update", payload)
        return self

    def eq(self, c: str, v: Any) -> _Tbl:
        self._f.append((c, v))
        return self

    def is_(self, c: str, _v: str) -> _Tbl:
        self._f.append((c, None))
        return self

    def order(self, *_a: Any, **_k: Any) -> _Tbl:
        return self

    def limit(self, _n: int) -> _Tbl:
        return self

    def _match(self, r: dict) -> bool:
        return all(r.get(c) == v for c, v in self._f)

    def execute(self) -> Any:
        rows = self._rows()
        if self._op[0] == "select":
            return type("R", (), {"data": [r for r in rows if self._match(r)]})()
        if self._op[0] == "insert":
            row = {"id": f"pk{len(rows)+1}", **self._op[1]}
            rows.append(row)
            return type("R", (), {"data": [row]})()
        if self._op[0] == "update":
            hit = [r for r in rows if self._match(r)]
            for r in hit:
                r.update(self._op[1])
            return type("R", (), {"data": hit})()
        return type("R", (), {"data": []})()


class _FakeDB:
    def __init__(self) -> None:
        self.store: dict = {"properties": [{"id": "p1", "tenant_id": "t1"}]}

    def table(self, name: str) -> _Tbl:
        return _Tbl(self.store, name)


def _svc() -> ApiClientsService:
    """Service auf der Fake-DB. Braucht kein Signier-Secret mehr: die Verwaltung
    erzeugt nur Zugänge, Tokens gibt der öffentliche Service aus."""
    return ApiClientsService(service_client=_FakeDB())


def test_create_returns_secret_once_and_hashes() -> None:
    s = _svc()
    row = s.create_client(
        _CTX, name="Test", is_test=True,
        scopes=["reservations:read"], property_ids=[],
    )
    # Klartext-Secret genau einmal zurück, Prefix trägt Umgebung.
    assert row["client_secret"].startswith("mnd_test_")
    assert row["client_id"].startswith("mnd_test_id_")
    # In der DB liegt NUR der Hash, nie das Klartext-Secret.
    stored = s._db.store["api_clients"][0]  # type: ignore[union-attr]
    assert "secret_hash" in stored
    assert stored["secret_hash"] != row["client_secret"]
    assert stored.get("secret") is None






def test_unknown_scope_rejected() -> None:
    s = _svc()
    with pytest.raises(ApiClientError) as exc:
        s.create_client(
            _CTX, name="T", is_test=False, scopes=["nonsense:read"], property_ids=[]
        )
    assert exc.value.status_code == 422


def test_foreign_property_id_rejected() -> None:
    s = _svc()
    with pytest.raises(ApiClientError) as exc:
        s.create_client(
            _CTX, name="T", is_test=False,
            scopes=["reservations:read"], property_ids=["fremd"],
        )
    assert exc.value.status_code == 422
