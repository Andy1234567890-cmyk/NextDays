"""Partner als vierte Melder-Welt (0518): Scope, Eröffnung, Herkunft."""

from __future__ import annotations

from typing import Any

import pytest

from src.features.support.schemas import ChatStart
from src.features.support.service import SupportError, SupportService


class _Q:
    def __init__(self, store: dict, name: str) -> None:
        self._store, self._name, self._eq = store, name, {}
        self._payload: Any = None
        self._op = "select"

    def select(self, *_a: Any, **_k: Any) -> _Q:
        return self

    def insert(self, payload: dict) -> _Q:
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict) -> _Q:
        self._op, self._payload = "update", payload
        return self

    def eq(self, spalte: str, wert: Any) -> _Q:
        self._eq[spalte] = wert
        return self

    def in_(self, *_a: Any) -> _Q:
        return self

    def order(self, *_a: Any, **_k: Any) -> _Q:
        return self

    def limit(self, *_a: Any) -> _Q:
        return self

    def range(self, *_a: Any) -> _Q:
        return self

    def execute(self) -> Any:
        rows = self._store.setdefault(self._name, [])
        if self._op == "insert":
            z = {
                "id": f"{self._name}-{len(rows) + 1}",
                "created_at": "2026-09-02T00:00:00+00:00",
                **self._payload,
            }
            rows.append(z)
            return type("R", (), {"data": [z], "count": None})()
        if self._op == "update":
            treffer = [r for r in rows if all(r.get(k) == v for k, v in self._eq.items())]
            for r in treffer:
                r.update(self._payload)
            return type("R", (), {"data": treffer, "count": None})()
        treffer = [r for r in rows if all(r.get(k) == v for k, v in self._eq.items())]
        return type("R", (), {"data": treffer, "count": len(treffer)})()


class _DB:
    def __init__(self) -> None:
        self.store: dict = {}

    def table(self, name: str) -> _Q:
        return _Q(self.store, name)


def test_partner_chat_traegt_partner_welt_und_herkunft() -> None:
    db = _DB()
    svc = SupportService(db=db)
    detail = svc.start_chat(ChatStart(body="Wann kommt meine Auszahlung?"), affiliate_id="aff-1")
    ticket = db.store["support_tickets"][0]
    assert ticket["reporter_affiliate_id"] == "aff-1"
    assert ticket["reporter_user_id"] is None and ticket["reporter_guest_id"] is None
    assert ticket["source"] == "partner"
    assert detail.messages[0].body.startswith("Wann kommt")


def test_zwei_welten_gleichzeitig_werden_abgelehnt() -> None:
    svc = SupportService(db=_DB())
    with pytest.raises(SupportError):
        svc.start_chat(ChatStart(body="x"), affiliate_id="aff-1", user_id="u-1")


def test_partner_sieht_nur_eigene_tickets() -> None:
    db = _DB()
    svc = SupportService(db=db)
    svc.start_chat(ChatStart(body="meins"), affiliate_id="aff-1")
    svc.start_chat(ChatStart(body="fremd"), affiliate_id="aff-2")
    eigene = svc.list(affiliate_id="aff-1")
    assert eigene.total == 1
    fremd_id = db.store["support_tickets"][1]["id"]
    assert svc.detail(fremd_id, affiliate_id="aff-1") is None
    assert svc.reply(fremd_id, "hallo", affiliate_id="aff-1") is None


def test_ohne_identitaet_kein_zugriff() -> None:
    svc = SupportService(db=_DB())
    with pytest.raises(SupportError):
        svc.list()
