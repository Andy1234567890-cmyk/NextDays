"""Tests für den Entwickler-API-Zugang: Erzeugung, Token-Tausch, Scope-
Enforcement, Objekt-Scope, fail-closed. Nutzt eine schlanke In-Memory-Fake-DB.
"""
from __future__ import annotations

from typing import Any

import jwt
import pytest

from src.core.config import Settings
from src.core.security import AuthContext
from src.features.api_clients.dependencies import (
    api_property_allowed,
    require_api_scope,
)
from src.features.api_clients.service import ApiClientError, ApiClientsService

_CTX = AuthContext(user_id="admin", tenant_id="t1")
_SECRET = "test-signing-secret-0123456789"


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


def _svc(monkeypatch: pytest.MonkeyPatch, *, secret: str = _SECRET) -> ApiClientsService:
    s = ApiClientsService(service_client=_FakeDB())
    s._settings = Settings(api_token_secret=secret)  # type: ignore[arg-type]
    return s


def test_create_returns_secret_once_and_hashes(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(monkeypatch)
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


def test_token_roundtrip_carries_scopes(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(monkeypatch)
    created = s.create_client(
        _CTX, name="T", is_test=False,
        scopes=["reservations:read", "availability:read"], property_ids=["p1"],
    )
    tok = s.issue_token(
        client_id=created["client_id"], client_secret=created["client_secret"]
    )
    claims = jwt.decode(
        tok["access_token"], _SECRET, algorithms=["HS256"], audience="mynextdays-api"
    )
    assert claims["tenant_id"] == "t1"
    assert set(claims["scopes"]) == {"reservations:read", "availability:read"}
    assert claims["property_ids"] == ["p1"]
    assert tok["expires_in"] == 3600


def test_wrong_secret_is_401(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(monkeypatch)
    created = s.create_client(
        _CTX, name="T", is_test=False, scopes=["reservations:read"], property_ids=[]
    )
    with pytest.raises(ApiClientError) as exc:
        s.issue_token(client_id=created["client_id"], client_secret="falsch")
    assert exc.value.status_code == 401


def test_revoked_client_cannot_get_token(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(monkeypatch)
    created = s.create_client(
        _CTX, name="T", is_test=False, scopes=["reservations:read"], property_ids=[]
    )
    s.revoke_client(_CTX, created["id"])
    with pytest.raises(ApiClientError) as exc:
        s.issue_token(
            client_id=created["client_id"], client_secret=created["client_secret"]
        )
    assert exc.value.status_code == 401


def test_missing_signing_secret_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(monkeypatch, secret="")
    created = s.create_client(
        _CTX, name="T", is_test=False, scopes=["reservations:read"], property_ids=[]
    )
    with pytest.raises(ApiClientError) as exc:
        s.issue_token(
            client_id=created["client_id"], client_secret=created["client_secret"]
        )
    assert exc.value.status_code == 503


def test_unknown_scope_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(monkeypatch)
    with pytest.raises(ApiClientError) as exc:
        s.create_client(
            _CTX, name="T", is_test=False, scopes=["nonsense:read"], property_ids=[]
        )
    assert exc.value.status_code == 422


def test_foreign_property_id_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(monkeypatch)
    with pytest.raises(ApiClientError) as exc:
        s.create_client(
            _CTX, name="T", is_test=False,
            scopes=["reservations:read"], property_ids=["fremd"],
        )
    assert exc.value.status_code == 422


def test_require_api_scope_enforces_scope(monkeypatch: pytest.MonkeyPatch) -> None:
    # Token mit nur reservations:read; Endpunkt fordert reservations:write → 403.
    import datetime as _dt
    now = _dt.datetime.now(_dt.UTC)
    token = jwt.encode(
        {
            "sub": "c1", "aud": "mynextdays-api", "tenant_id": "t1",
            "scopes": ["reservations:read"], "property_ids": ["p1"],
            "is_test": False, "iat": now, "exp": now + _dt.timedelta(hours=1),
        },
        _SECRET, algorithm="HS256",
    )
    settings = Settings(api_token_secret=_SECRET)  # type: ignore[arg-type]
    dep_read = require_api_scope("reservations:read")
    ctx = dep_read(settings=settings, authorization=f"Bearer {token}")
    assert ctx.tenant_id == "t1"
    assert api_property_allowed(ctx, "p1") is True
    assert api_property_allowed(ctx, "p2") is False  # nicht gescopet → verboten

    dep_write = require_api_scope("reservations:write")
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        dep_write(settings=settings, authorization=f"Bearer {token}")
    assert exc.value.status_code == 403
