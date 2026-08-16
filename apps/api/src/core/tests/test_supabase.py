"""Tests für die Härtung der Supabase-Client-Factory gegen tote Keep-Alive-
Verbindungen (Kong/PostgREST schließt idle HTTP/2-Connections serverseitig)."""
import httpx
import pytest

from src.core.config import Settings, get_settings
from src.core.supabase import (
    _CONNECT_TIMEOUT_S,
    _MAX_RETRIES,
    _harden,
    _ReconnectingTransport,
    _zustandslose_optionen,
    public_storage_url,
)


class _AbbrechenderStream(httpx.SyncByteStream):
    """Antwort-Stream, der nach den Headern abbricht — genau das Muster, mit dem
    Kong eine idle HTTP/2-Verbindung beendet (GOAWAY nach dem Header-Frame)."""

    def __init__(self, request: httpx.Request) -> None:
        self._request = request

    def __iter__(self):  # noqa: ANN204
        raise httpx.RemoteProtocolError(
            "<ConnectionTerminated error_code:1>", request=self._request
        )
        yield b""  # pragma: no cover  # macht die Methode zum Generator

    def close(self) -> None:
        return None


def _abbruch_nach_headern(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, stream=_AbbrechenderStream(request))


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


def test_abbruch_beim_body_wird_wiederholt() -> None:
    # Der reale Fall aus dem Log: `handle_request` kehrt sauber zurück, der
    # GOAWAY kommt erst beim Lesen des Bodys. Ohne Retry an dieser Stelle wurde
    # daraus ein 500 auf GET /api/v1/properties.
    inner = _ScriptedTransport(
        _abbruch_nach_headern(_req()),
        httpx.Response(200, json={"ok": True}),
    )
    resp = _ReconnectingTransport(inner).handle_request(_req())
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert inner.calls == 2


def test_abbruch_beim_body_wiederholt_kein_post() -> None:
    # Header da heißt: der Server HAT den Request ausgeführt. Ein zweiter
    # Versuch würde das POST doppelt anlegen (Wurzel 2) → durchreichen.
    post = httpx.Request("POST", "http://x/rest/v1/reservations")
    inner = _ScriptedTransport(
        _abbruch_nach_headern(post),
        httpx.Response(201, json={"id": "doppelt"}),
    )
    with pytest.raises(httpx.RemoteProtocolError):
        _ReconnectingTransport(inner).handle_request(post)
    assert inner.calls == 1


def test_abbruch_vor_antwort_wiederholt_auch_post() -> None:
    # Kein Header, keine Ausführung: hier ist der Retry auch für POST sicher.
    post = httpx.Request("POST", "http://x/rest/v1/reservations")
    inner = _ScriptedTransport(
        httpx.RemoteProtocolError("Server disconnected", request=post),
        httpx.Response(201, json={"id": "einmalig"}),
    )
    resp = _ReconnectingTransport(inner).handle_request(post)
    assert resp.status_code == 201
    assert inner.calls == 2


def test_public_storage_url_nutzt_externe_basis(monkeypatch) -> None:  # noqa: ANN001
    """Gespeicherte Storage-URLs müssen von AUSSEN erreichbar sein.

    Im Container ist SUPABASE_URL die interne Kong-Adresse; eine damit gebaute
    URL landete in der DB und war im Browser ein kaputtes Bild (Firmenlogo).
    """
    get_settings.cache_clear()
    monkeypatch.setenv("SUPABASE_URL", "http://kong:8000")
    # Der explizite Name gewinnt laut AliasChoices — hier wird der Fallback auf
    # API_EXTERNAL_URL geprüft, also muss er weg (in CI ist er gesetzt).
    monkeypatch.delenv("SUPABASE_PUBLIC_URL", raising=False)
    monkeypatch.setenv("API_EXTERNAL_URL", "https://kong.example.com/")
    try:
        url = public_storage_url("company-logos", "t-1/logo.jpg")
        assert url == (
            "https://kong.example.com/storage/v1/object/public/company-logos/t-1/logo.jpg"
        )
    finally:
        get_settings.cache_clear()


def test_public_storage_url_explizite_basis_gewinnt(monkeypatch) -> None:  # noqa: ANN001
    get_settings.cache_clear()
    monkeypatch.setenv("SUPABASE_URL", "http://kong:8000")
    monkeypatch.setenv("API_EXTERNAL_URL", "https://kong.example.com")
    monkeypatch.setenv("SUPABASE_PUBLIC_URL", "https://cdn.example.com")
    try:
        assert public_storage_url("avatars", "u 1/a.png") == (
            "https://cdn.example.com/storage/v1/object/public/avatars/u%201/a.png"
        )
    finally:
        get_settings.cache_clear()


def test_clients_halten_keine_sitzung() -> None:
    """URSACHE der willkürlichen Abmeldungen: supabase-py ist für EINEN
    Browser-Nutzer gedacht. Mit den Defaults (`persist_session=True`,
    `auto_refresh_token=True`) legt jeder `sign_in`/`refresh_session` die Session
    im prozessweiten MemoryStorage ab und startet einen `threading.Timer`, der
    das Refresh-Token SPÄTER VON SELBST einlöst und rotiert. Auf dem Server, wo
    ein Client alle Nutzer bedient, verbrennt das fremde Tokens: der Browser
    kennt das rotierte Token nicht, sein nächster Refresh bekommt „Already Used"
    → 401 → Zwangsabmeldung.

    Der Server hält deshalb KEINE Sitzung — jedes Token kommt pro Request vom
    Aufrufer."""
    optionen = _zustandslose_optionen()
    assert optionen.auto_refresh_token is False
    assert optionen.persist_session is False

    # Auch der Wegwerf-Client für den echten Browser-User-Agent: ohne die
    # Optionen hinterließe JEDER Login einen lebenden Auto-Refresh-Thread.
    mit_ua = _zustandslose_optionen(headers={"User-Agent": "Mozilla/5.0"})
    assert mit_ua.auto_refresh_token is False
    assert mit_ua.persist_session is False
    assert mit_ua.headers["User-Agent"] == "Mozilla/5.0"


def test_storage_public_base_ohne_konfiguration_schlaegt_fehl() -> None:
    """Kein Rückfall auf die interne Adresse: ohne konfigurierte externe Basis
    gibt es keine speicherbare URL, also einen klaren Fehler."""
    # _env_file=None: bewusst ohne die lokale .env prüfen (dort ist die Basis
    # gesetzt) — hier geht es um den unkonfigurierten Zustand.
    settings = Settings(_env_file=None, supabase_url="http://kong:8000",
                        supabase_public_url="")
    with pytest.raises(RuntimeError, match="SUPABASE_PUBLIC_URL"):
        _ = settings.storage_public_base


def test_connect_timeout_wird_nicht_wiederholt() -> None:
    """Ein Verbindungs-TIMEOUT ist keine tote Keep-Alive-Verbindung.

    Der Retry existiert für den Fall, dass Kong eine idle Verbindung geschlossen
    hat — dann hilft ein zweiter Versuch sofort. Läuft dagegen schon der
    Verbindungsaufbau in die Zeitgrenze, ist der Host weg; jeder weitere
    Versuch verlängert nur die Wartezeit des Aufrufers um dieselbe Spanne.
    Live am 16.08.2026 hing daran der halbe Server, weil das Auth-Gate auf
    jeder Route wartet.
    """
    req = _req()
    inner = _ScriptedTransport(
        httpx.ConnectTimeout("timed out", request=req),
        httpx.Response(200),
    )
    with pytest.raises(httpx.ConnectTimeout):
        _ReconnectingTransport(inner).handle_request(req)
    assert inner.calls == 1


def test_sessions_bekommen_eine_zeitgrenze() -> None:
    """Jede Sub-Session des Clients trägt eine Connect-Zeitgrenze.

    supabase-py setzt keine; ohne sie wartet ein Request, bis das
    Betriebssystem den TCP-Verbindungsaufbau aufgibt (live 75 s). Geprüft wird
    das Ergebnis von `_harden` an einem Doppel mit denselben Attributen, die
    ein echter Client hat — der echte Client bräuchte eine Verbindung.
    """
    class _Session:
        def __init__(self) -> None:
            self.timeout = httpx.Timeout(None)
            self._transport = httpx.HTTPTransport()

    class _Client:
        def __init__(self) -> None:
            self.postgrest = type("P", (), {"session": _Session()})()
            self.auth = type("A", (), {"session": _Session()})()

    client = _harden(_Client())  # type: ignore[arg-type]
    for teil in (client.postgrest, client.auth):
        assert teil.session.timeout.connect == _CONNECT_TIMEOUT_S
        # Der Retry-Wrapper bleibt zusätzlich bestehen — die Härtung ersetzt
        # ihn nicht, sie ergänzt sie.
        assert isinstance(teil.session._transport, _ReconnectingTransport)  # noqa: SLF001
