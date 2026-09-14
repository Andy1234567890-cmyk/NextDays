"""Die Uebergabe an den Versanddienst (`uebermittlung.py`).

Der wichtigste Fall ist nicht der Fehlschlag, sondern der UNKLARE
Ausgang: Eine Zeitueberschreitung heisst nicht, dass nichts ankam. Wer
daraufhin erneut sendet, erzeugt eine Doppelmeldung — und der Vermieter
wird doppelt veranlagt.
"""
from __future__ import annotations

import httpx
import pytest

from src.core.config import get_settings
from src.features.taxpayer.dac7 import uebermittlung as U


@pytest.fixture(autouse=True)
def _eingerichtet(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("DAC7_VERSAND_URL", "https://versand.beispiel.test")
    monkeypatch.setenv("DAC7_VERSAND_TOKEN", "test-token")
    yield
    get_settings.cache_clear()


def _antwortet(monkeypatch: pytest.MonkeyPatch, **daten: object) -> dict:
    gesehen: dict = {}

    async def post(self, url, **kw):  # noqa: ANN001, ARG001
        gesehen["url"] = url
        gesehen["dateiname"] = kw["files"]["datei"][0]
        gesehen["bytes"] = kw["files"]["datei"][1]
        gesehen["kopf"] = kw.get("headers", {})
        return httpx.Response(
            int(daten.pop("_status", 200)),
            json=daten,
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    return gesehen


def _wirft(monkeypatch: pytest.MonkeyPatch, fehler: Exception) -> None:
    async def post(self, url, **kw):  # noqa: ANN001, ARG001
        raise fehler

    monkeypatch.setattr(httpx.AsyncClient, "post", post)


def test_nicht_eingerichtet_ist_kein_absturz(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Ohne Konfiguration bleibt der bisherige Weg — mit klarer Auskunft."""
    get_settings.cache_clear()
    monkeypatch.setenv("DAC7_VERSAND_URL", "")
    assert U.ist_eingerichtet() is False
    get_settings.cache_clear()


async def test_gutfall_reicht_die_quittung_durch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    gesehen = _antwortet(
        monkeypatch,
        angenommen=True,
        quittungsnummer="DK-20260911-ABC123",
        meldung="angenommen",
        wiederholbar=False,
        pruefsumme="abc",
        ziel="https://dac7-test.mynextdays.dk/v1/einreichung",
        ist_teststufe=True,
        verschluesselt=True,
    )
    ergebnis = await U.uebermitteln("ROW_TYPE;X\n", "dac7-1.csv")
    assert ergebnis.angenommen is True
    assert ergebnis.quittungsnummer == "DK-20260911-ABC123"
    assert ergebnis.verschluesselt is True
    assert gesehen["kopf"]["X-Versand-Token"] == "test-token"
    assert gesehen["dateiname"] == "dac7-1.csv"


async def test_zeitueberschreitung_ist_unbekannt_nicht_abgelehnt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`None`, nicht `False` — und NICHT wiederholbar.

    Der teuerste Fehler dieses Bereichs waere, aus einem Zeitlimit
    „nicht gesendet" zu machen: Der naechste Klick erzeugt dann die
    Doppelmeldung.
    """
    _wirft(monkeypatch, httpx.ReadTimeout("zu lange"))
    ergebnis = await U.uebermitteln("ROW_TYPE;X\n", "dac7-1.csv")
    assert ergebnis.angenommen is None
    assert ergebnis.wiederholbar is False
    assert "NICHT fest" in ergebnis.meldung


async def test_unerreichbar_ist_ein_fehler_kein_ergebnis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Hier ging nichts hinaus — das darf als Fehler auffallen.

    Anders als beim Zeitlimit: Der Aufruf kam nicht zustande, ein zweiter
    Versuch ist unbedenklich.
    """
    _wirft(monkeypatch, httpx.ConnectError("kein Netz"))
    with pytest.raises(U.UebermittlungError, match="nicht erreichbar"):
        await U.uebermitteln("ROW_TYPE;X\n", "dac7-1.csv")


async def test_abgelehntes_token_wird_benannt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _antwortet(monkeypatch, _status=401, detail="nope")
    with pytest.raises(U.UebermittlungError, match="DAC7_VERSAND_TOKEN"):
        await U.uebermitteln("ROW_TYPE;X\n", "dac7-1.csv")


async def test_ablehnung_der_behoerde_kommt_als_ergebnis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Eine zurueckgewiesene Meldung ist kein Schnittstellenfehler.

    Sie ist das Ergebnis — mit Grund und der Aussage, dass ein zweiter
    Versuch nach der Korrektur zulaessig ist.
    """
    _antwortet(
        monkeypatch,
        angenommen=False,
        quittungsnummer="DK-1",
        meldung="Die Behörde hat die Datei zurückgewiesen.",
        wiederholbar=True,
        pruefsumme="abc",
        ziel="z",
        ist_teststufe=True,
        verschluesselt=False,
        antwort={"fehler": [{"grund": "Spalte fehlt"}]},
    )
    ergebnis = await U.uebermitteln("ROW_TYPE;X\n", "dac7-1.csv")
    assert ergebnis.angenommen is False
    assert ergebnis.wiederholbar is True
    assert ergebnis.antwort["fehler"][0]["grund"] == "Spalte fehlt"
