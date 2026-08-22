"""Tests für guest_messages — der Gast↔Host-Chat des Marktplatzes.

Der Slice hatte bis 22.08.2026 KEINE Tests, und genau darin lag ein Fehler
unbemerkt: eine Gastnachricht landete still in der Datenbank, ohne dass der
Betrieb eine Glocke, eine Mail oder einen Push bekam. Die Kategorie `messages`
stand im Katalog und war im Konto einschaltbar — ausgelöst hat sie nur der
Portal-Eingang, nie der eigene Marktplatz.

Geprüft wird deshalb der Nachlauf des Sendens, nicht die Persistenz allein.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from src.features.guest_messages.schemas import SendMessageRequest
from src.features.guest_messages.service import GuestMessagesError, GuestMessagesService

GAST = "11111111-1111-4111-8111-111111111111"
THREAD = "22222222-2222-4222-8222-222222222222"
TENANT = "33333333-3333-4333-8333-333333333333"


class _Res:
    def __init__(self, data: object) -> None:
        self.data = data


class _Query:
    def __init__(self, store: dict, tabelle: str) -> None:
        self._store = store
        self._tab = tabelle
        self._eq: dict[str, str] = {}
        self._insert: dict | None = None
        self._update: dict | None = None

    def select(self, *_a: object, **_k: object) -> _Query:
        return self

    def insert(self, werte: dict) -> _Query:
        self._insert = werte
        return self

    def update(self, werte: dict) -> _Query:
        self._update = werte
        return self

    def eq(self, feld: str, wert: object) -> _Query:
        self._eq[feld] = str(wert)
        return self

    def limit(self, *_a: object) -> _Query:
        return self

    def order(self, *_a: object, **_k: object) -> _Query:
        return self

    def execute(self) -> _Res:
        zeilen = self._store.setdefault(self._tab, [])
        if self._insert is not None:
            zeile = {"id": f"{self._tab}-{len(zeilen) + 1}", **self._insert}
            zeilen.append(zeile)
            return _Res([zeile])
        treffer = [
            z for z in zeilen
            if all(str(z.get(k)) == v for k, v in self._eq.items())
        ]
        if self._update is not None:
            for z in treffer:
                z.update(self._update)
            return _Res(treffer)
        return _Res(treffer)


class _DB:
    def __init__(self, store: dict) -> None:
        self.store = store

    def table(self, name: str) -> _Query:
        return _Query(self.store, name)


def _store() -> dict:
    return {
        "guest_message_threads": [{
            "id": THREAD, "tenant_id": TENANT, "portal_guest_id": GAST,
            "reservation_id": "r-1", "property_id": "p-1",
        }],
        "guest_messages": [],
        "portal_guests": [{"id": GAST, "name": "Anna Müller"}],
    }


@pytest.fixture
def melden(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """`melde_gastnachricht` abfangen — der Nachlauf ist der Prüfgegenstand."""
    fake = MagicMock()
    monkeypatch.setattr(
        "src.features.notification_settings.ereignisse.melde_gastnachricht", fake
    )
    return fake


def test_gastnachricht_meldet_dem_betrieb(melden: MagicMock) -> None:
    """Der Kern: eine neue Gastnachricht MUSS den Betrieb erreichen.

    Ohne diesen Nachlauf liegt die Nachricht in der Datenbank, das
    Sidebar-Abzeichen zählt nicht hoch, und ein Gast, der vor der Anreise etwas
    fragt, wartet auf eine Antwort, von der niemand weiß.
    """
    db = _DB(_store())
    svc = GuestMessagesService(service_client=db)
    svc.send_message(THREAD, SendMessageRequest(body="Wann ist Check-in?"), GAST)

    melden.assert_called_once()
    _, kwargs = melden.call_args
    assert kwargs["tenant_id"] == TENANT
    # Der Posteingang führt Marktplatz-Threads unter `mb:` — die Meldung MUSS
    # dieselbe ID tragen, sonst öffnet ihr Link eine Ansicht, die es nicht gibt.
    assert kwargs["thread_id"] == f"mb:{THREAD}"
    assert kwargs["absender"] == "Anna Müller"
    assert kwargs["vorschau"] == "Wann ist Check-in?"


def test_nachricht_wird_trotzdem_gespeichert(melden: MagicMock) -> None:
    """Wurzel 5: kippt die Meldung, bleibt die Nachricht bestehen.

    Der Nachlauf ist best-effort — er darf den Versand nicht zurückdrehen. Sonst
    verlöre der Gast seine Nachricht, weil eine Glocke nicht klingeln konnte.
    """
    melden.side_effect = RuntimeError("Dispatcher weg")
    db = _DB(_store())
    svc = GuestMessagesService(service_client=db)
    svc.send_message(THREAD, SendMessageRequest(body="Hallo"), GAST)
    assert [m["body"] for m in db.store["guest_messages"]] == ["Hallo"]


def test_fremder_thread_wird_abgewiesen(melden: MagicMock) -> None:
    """Wurzel 3/9: der Thread muss dem eingeloggten Gast gehören — sonst 404,
    und es geht auch keine Meldung raus."""
    db = _DB(_store())
    svc = GuestMessagesService(service_client=db)
    with pytest.raises(GuestMessagesError) as exc:
        svc.send_message(THREAD, SendMessageRequest(body="fremd"), "fremder-gast")
    assert exc.value.status_code == 404
    melden.assert_not_called()
