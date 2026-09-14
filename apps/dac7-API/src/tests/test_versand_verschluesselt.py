"""Der Versand als verschluesselter Umschlag.

Geprueft wird, was auf die LEITUNG geht — nicht, ob die Verschluesselung
rechnet (das tut `core/umschlag.py` samt eigenen Tests der
Empfangsstelle). Die Frage hier: Verlaesst die Meldung das Haus wirklich
verschluesselt, und was passiert, wenn der Schluessel fehlt.
"""
from __future__ import annotations

import json
import os

os.environ.setdefault("VERSAND_TOKEN", "test-versand-token")
os.environ.setdefault("AMT_URL", "https://amt.beispiel.test")

import httpx
import pytest
from fastapi.testclient import TestClient

from src.core import umschlag
from src.core.config import get_settings
from src.main import create_app

KOPF = {"X-Versand-Token": "test-versand-token"}
# Ein echt aussehender Personenbezug — er darf die Leitung nicht im
# Klartext erreichen.
MELDUNG = b"ROW_TYPE;TIN\nRS_IND_Individual_Seller;120385-4127 Lars Bak Nielsen\n"
DATEI = {"datei": ("meldung.csv", MELDUNG, "text/csv")}


@pytest.fixture
def paar() -> umschlag.Schluesselpaar:
    return umschlag.schluesselpaar_erzeugen()


def _mitschnitt(monkeypatch: pytest.MonkeyPatch) -> dict:
    """Faengt ab, was tatsaechlich gesendet wurde."""
    gesehen: dict = {}

    async def post(self, url, **kw):  # noqa: ANN001, ARG001
        name, inhalt, _typ = kw["files"]["datei"]
        gesehen["dateiname"] = name
        gesehen["bytes"] = inhalt
        return httpx.Response(
            200,
            json={"angenommen": True, "quittungsnummer": "DK-1", "fehler": []},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    return gesehen


def test_ohne_schluessel_geht_klartext_hinaus(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Der heute gueltige Weg bleibt offen.

    Fuer das Meldejahr 2025 nimmt die Behoerde Klartext entgegen; ein
    Zwang zur Verschluesselung wuerde ihn verbauen.
    """
    get_settings.cache_clear()
    monkeypatch.delenv("AMT_PUBKEY", raising=False)
    gesehen = _mitschnitt(monkeypatch)
    antwort = TestClient(create_app()).post(
        "/v1/einreichen", headers=KOPF, files=DATEI
    )
    get_settings.cache_clear()
    assert antwort.status_code == 200, antwort.text
    assert antwort.json()["verschluesselt"] is False
    assert gesehen["bytes"] == MELDUNG


def test_mit_schluessel_geht_ein_umschlag_hinaus(
    monkeypatch: pytest.MonkeyPatch, paar: umschlag.Schluesselpaar
) -> None:
    """Der eigentliche Beweis: Auf der Leitung steht kein Personenbezug."""
    get_settings.cache_clear()
    monkeypatch.setenv("AMT_PUBKEY", paar.oeffentlich)
    gesehen = _mitschnitt(monkeypatch)
    antwort = TestClient(create_app()).post(
        "/v1/einreichen", headers=KOPF, files=DATEI
    )
    get_settings.cache_clear()

    assert antwort.status_code == 200, antwort.text
    daten = antwort.json()
    assert daten["verschluesselt"] is True

    gesendet = gesehen["bytes"]
    assert b"120385-4127" not in gesendet
    assert b"Nielsen" not in gesendet
    assert json.loads(gesendet)["umschlag"]["format"] == umschlag.FORMAT
    # Und der Empfaenger kann ihn oeffnen — sonst waere es nur Rauschen.
    assert umschlag.oeffnen(gesendet, paar.privat).klartext == MELDUNG


def test_pruefsumme_bleibt_die_des_klartexts(
    monkeypatch: pytest.MonkeyPatch, paar: umschlag.Schluesselpaar
) -> None:
    """Sonst belegt sie nichts.

    Zweimal verschluesselt ergibt zweimal andere Bytes (frischer Nonce).
    Eine Pruefsumme ueber den Geheimtext koennte deshalb nicht zeigen,
    dass zweimal dasselbe eingereicht wurde — und genau das ist die
    Frage, die sie beantworten soll.
    """
    import hashlib

    get_settings.cache_clear()
    monkeypatch.setenv("AMT_PUBKEY", paar.oeffentlich)
    gesehen = _mitschnitt(monkeypatch)
    klient = TestClient(create_app())
    erst = klient.post("/v1/einreichen", headers=KOPF, files=DATEI).json()
    erste_bytes = gesehen["bytes"]
    zweit = klient.post("/v1/einreichen", headers=KOPF, files=DATEI).json()
    get_settings.cache_clear()

    assert erste_bytes != gesehen["bytes"], "gleiche Bytes — frischer Nonce fehlt"
    assert erst["pruefsumme"] == zweit["pruefsumme"] == (
        hashlib.sha256(MELDUNG).hexdigest()
    )


def test_pflicht_ohne_schluessel_sendet_nicht(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fail-closed.

    Wer Verschluesselung verlangt hat, soll keine Klartextmeldung an eine
    Steuerbehoerde geschickt bekommen, weil eine Variable fehlte. Der
    Versuch wird abgebrochen, BEVOR etwas hinausgeht.
    """
    get_settings.cache_clear()
    monkeypatch.delenv("AMT_PUBKEY", raising=False)
    monkeypatch.setenv("VERSCHLUESSELUNG_PFLICHT", "true")
    gesehen = _mitschnitt(monkeypatch)
    antwort = TestClient(create_app()).post(
        "/v1/einreichen", headers=KOPF, files=DATEI
    )
    get_settings.cache_clear()

    daten = antwort.json()
    assert daten["angenommen"] is False
    assert "NICHT gesendet" in daten["meldung"]
    assert "AMT_PUBKEY" in daten["meldung"]
    assert not gesehen, "es wurde trotzdem gesendet"


def test_unbrauchbarer_schluessel_sendet_nicht(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Kein Ausweichen auf Klartext.

    Ein kaputter Schluessel ist ein Konfigurationsfehler. Darauf mit einer
    unverschluesselten Steuermeldung zu antworten waere die falsche
    Richtung (Wurzel 5).
    """
    get_settings.cache_clear()
    monkeypatch.setenv("AMT_PUBKEY", "-----BEGIN PUBLIC KEY-----\nkaputt\n")
    gesehen = _mitschnitt(monkeypatch)
    antwort = TestClient(create_app()).post(
        "/v1/einreichen", headers=KOPF, files=DATEI
    )
    get_settings.cache_clear()

    daten = antwort.json()
    assert daten["angenommen"] is False
    assert "unbrauchbar" in daten["meldung"]
    assert not gesehen, "es wurde trotzdem gesendet"
