"""Der Versand muss ehrlich sagen, was er nicht weiss.

Der gefaehrlichste Fall ist nicht der Fehlschlag, sondern der UNKLARE
Ausgang: Eine Zeitueberschreitung heisst nicht, dass nichts ankam. Wer
daraufhin erneut sendet, erzeugt eine Doppelmeldung — und der Vermieter
wird doppelt veranlagt.
"""
from __future__ import annotations

import os

os.environ.setdefault("VERSAND_TOKEN", "test-versand-token")
os.environ.setdefault("AMT_URL", "https://amt.beispiel.test")

import httpx
import pytest
from fastapi.testclient import TestClient

from src.main import create_app

KOPF = {"X-Versand-Token": "test-versand-token"}
DATEI = {"datei": ("meldung.csv", b"ROW_TYPE;X\nMessage;1\n", "text/csv")}


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def _antwort(monkeypatch, **json_daten) -> None:
    """Die Gegenstelle antwortet mit diesem JSON."""
    async def post(self, url, **kw):  # noqa: ANN001, ARG001
        return httpx.Response(
            json_daten.pop("_status", 200), json=json_daten,
            request=httpx.Request("POST", url),
        )
    monkeypatch.setattr(httpx.AsyncClient, "post", post)


def _wirft(monkeypatch, fehler: Exception) -> None:
    async def post(self, url, **kw):  # noqa: ANN001, ARG001
        raise fehler
    monkeypatch.setattr(httpx.AsyncClient, "post", post)


class TestZugang:
    def test_ohne_token_abgewiesen(self, client: TestClient) -> None:
        assert client.post("/v1/einreichen", files=DATEI).status_code == 401

    def test_falsches_token_abgewiesen(self, client: TestClient) -> None:
        antwort = client.post(
            "/v1/einreichen", files=DATEI, headers={"X-Versand-Token": "falsch"}
        )
        assert antwort.status_code == 401


class TestAngenommen:
    def test_quittung_wird_durchgereicht(self, client: TestClient, monkeypatch) -> None:
        _antwort(monkeypatch, angenommen=True, quittungsnummer="DK-2026-ABC", fehler=[])
        d = client.post("/v1/einreichen", files=DATEI, headers=KOPF).json()
        assert d["angenommen"] is True
        assert d["quittungsnummer"] == "DK-2026-ABC"

    def test_angenommene_meldung_ist_nicht_wiederholbar(
        self, client: TestClient, monkeypatch
    ) -> None:
        """Ein zweiter Versand waere eine Doppelmeldung."""
        _antwort(monkeypatch, angenommen=True, quittungsnummer="DK-1", fehler=[])
        d = client.post("/v1/einreichen", files=DATEI, headers=KOPF).json()
        assert d["wiederholbar"] is False


class TestAbgewiesen:
    def test_abgewiesen_ist_wiederholbar(self, client: TestClient, monkeypatch) -> None:
        """Eine abgewiesene Datei kam nicht an — erneut senden ist richtig."""
        _antwort(monkeypatch, angenommen=False, quittungsnummer="DK-2",
                 fehler=[{"grund": "x"}, {"grund": "y"}])
        d = client.post("/v1/einreichen", files=DATEI, headers=KOPF).json()
        assert d["angenommen"] is False
        assert d["wiederholbar"] is True
        assert "2 Beanstandungen" in d["meldung"]

    def test_wartung_der_behoerde(self, client: TestClient, monkeypatch) -> None:
        _antwort(monkeypatch, _status=503)
        d = client.post("/v1/einreichen", files=DATEI, headers=KOPF).json()
        assert d["angenommen"] is False
        assert d["wiederholbar"] is True
        assert "NICHT eingereicht" in d["meldung"]

    def test_zugang_abgewiesen(self, client: TestClient, monkeypatch) -> None:
        _antwort(monkeypatch, _status=401)
        d = client.post("/v1/einreichen", files=DATEI, headers=KOPF).json()
        assert d["angenommen"] is False
        assert d["wiederholbar"] is False


class TestUnbekannterAusgang:
    """Der wichtigste Fall: Wir wissen es NICHT."""

    def test_zeitueberschreitung_ist_nicht_abgelehnt(
        self, client: TestClient, monkeypatch
    ) -> None:
        _wirft(monkeypatch, httpx.TimeoutException("zu lange"))
        d = client.post("/v1/einreichen", files=DATEI, headers=KOPF).json()
        assert d["angenommen"] is None, "None heisst unbekannt, nicht False"
        assert d["wiederholbar"] is False, "Sonst droht eine Doppelmeldung"
        assert "NICHT fest" in d["meldung"]

    def test_unlesbare_antwort(self, client: TestClient, monkeypatch) -> None:
        async def post(self, url, **kw):  # noqa: ANN001, ARG001
            return httpx.Response(200, text="<html>Fehler</html>",
                                  request=httpx.Request("POST", url))
        monkeypatch.setattr(httpx.AsyncClient, "post", post)
        d = client.post("/v1/einreichen", files=DATEI, headers=KOPF).json()
        assert d["angenommen"] is None
        assert d["wiederholbar"] is False

    def test_netzfehler_ist_wiederholbar(self, client: TestClient, monkeypatch) -> None:
        """Verbindung kam nicht zustande — dann kam auch die Datei nicht an."""
        _wirft(monkeypatch, httpx.ConnectError("kein Netz"))
        d = client.post("/v1/einreichen", files=DATEI, headers=KOPF).json()
        assert d["angenommen"] is None
        assert d["wiederholbar"] is True


class TestZielIstImmerSichtbar:
    def test_jede_antwort_nennt_ziel_und_teststufe(
        self, client: TestClient, monkeypatch
    ) -> None:
        """Eine Meldung, von der niemand weiss, wohin sie ging, ist wertlos."""
        _antwort(monkeypatch, angenommen=True, quittungsnummer="DK-3", fehler=[])
        d = client.post("/v1/einreichen", files=DATEI, headers=KOPF).json()
        assert d["ziel"].startswith("https://amt.beispiel.test")
        assert d["ist_teststufe"] is True

    def test_health_nennt_das_ziel(self, client: TestClient) -> None:
        d = client.get("/health").json()
        assert d["ziel"] == "https://amt.beispiel.test"
        assert d["teststufe"] is True


class TestLeereDatei:
    def test_leere_datei_wird_abgewiesen(self, client: TestClient) -> None:
        antwort = client.post(
            "/v1/einreichen",
            files={"datei": ("leer.csv", b"", "text/csv")},
            headers=KOPF,
        )
        assert antwort.status_code == 400
