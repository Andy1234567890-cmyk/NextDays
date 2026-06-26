"""Tests für die Härtung der Supabase-Client-Factory gegen tote Keep-Alive-
Verbindungen (Kong/PostgREST schließt idle HTTP/2-Connections serverseitig)."""
import httpx
import pytest

from src.core.supabase import _MAX_RETRIES, _ReconnectingTransport


class _ScriptedTransport(httpx.BaseTransport):
    """Inner-Transport, der eine Liste von Aktionen abspielt: Exception-Instanz
    → wird geworfen; httpx.Response → wird zurückgegeben."""

    def __init__(self, *actions: object) -> None:
        self._actions = list(actions)
        self.calls = 0

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        action = self._actions[self.calls]
        self.calls += 1
        if isinstance(action, Exception):
            raise action
        assert isinstance(action, httpx.Response)
        return action


def _req() -> httpx.Request:
    return httpx.Request("GET", "http://x/rest/v1/properties")


def test_stale_connection_is_retried_then_succeeds() -> None:
    # Genau das beobachtete Muster: erster Reuse läuft in eine tote Verbindung,
    # der Retry öffnet eine frische und liefert 200.
    inner = _ScriptedTransport(
        httpx.RemoteProtocolError("Server disconnected", request=_req()),
        httpx.Response(200, json={"ok": True}),
    )
    resp = _ReconnectingTransport(inner).handle_request(_req())
    assert resp.status_code == 200
    assert inner.calls == 2


def test_persistent_failure_is_raised_after_retries() -> None:
    # Dauerhaft tot: nach Erschöpfung der Versuche wird der echte Fehler
    # durchgereicht — kein Endlos-Loop, kein Verschlucken.
    actions = [
        httpx.RemoteProtocolError("Server disconnected", request=_req())
    ] * (_MAX_RETRIES + 1)
    inner = _ScriptedTransport(*actions)
    with pytest.raises(httpx.RemoteProtocolError):
        _ReconnectingTransport(inner).handle_request(_req())
    assert inner.calls == _MAX_RETRIES + 1


def test_non_stale_error_is_not_retried() -> None:
    # Ein Timeout ist KEIN stale-connection-Fall → sofort durchreichen, nicht
    # maskieren (sonst verstecken wir echte Probleme).
    inner = _ScriptedTransport(
        httpx.ReadTimeout("timeout", request=_req())
    )
    with pytest.raises(httpx.ReadTimeout):
        _ReconnectingTransport(inner).handle_request(_req())
    assert inner.calls == 1


def test_success_on_first_try_does_not_retry() -> None:
    inner = _ScriptedTransport(httpx.Response(200, json={"ok": True}))
    resp = _ReconnectingTransport(inner).handle_request(_req())
    assert resp.status_code == 200
    assert inner.calls == 1
