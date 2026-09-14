"""Der verschluesselte Weg durch die Empfangsstelle.

Hier wird nicht die Verschluesselung geprueft (das tut
`test_umschlag.py`), sondern der WEG: Kommt ein Umschlag an, wird er
geoeffnet, geprueft und quittiert — und traegt die Quittung die Stationen
mit, die die Behoerde sehen will.

Jeder Test baut GENAU EINEN Fehler ein. Ein Pruefer, der alles annimmt,
ist schlimmer als keiner.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.core import umschlag
from src.core.config import get_settings

KOPF = {"X-Staging-Token": "test-token-nicht-echt"}
BEISPIEL = Path(__file__).parents[2] / "beispiele" / "demo-meldung.csv"


@pytest.fixture
def paar() -> umschlag.Schluesselpaar:
    return umschlag.schluesselpaar_erzeugen()


@pytest.fixture
def klient(
    monkeypatch: pytest.MonkeyPatch, paar: umschlag.Schluesselpaar
) -> TestClient:
    """Eine Stelle MIT privatem Schluessel und leerem Protokoll.

    Das Protokoll lebt im Prozessspeicher (ein Arbeiter, siehe
    `core/protokoll.py`) und ueberlebt damit den einzelnen Test. Ohne das
    Leeren greift die Dublettensperre: Der zweite Test, der dieselbe
    Beispieldatei einreicht, bekommt zu Recht „bereits angenommen" — und
    prueft dann nicht mehr, was er pruefen soll.

    Das ist KEIN Mangel des Dienstes, sondern genau sein gewolltes
    Verhalten („Indtaegten skal kun indberettes een gang").
    """
    get_settings.cache_clear()
    monkeypatch.setenv("STAGING_TOKEN", "test-token-nicht-echt")
    monkeypatch.setenv("EMPFAENGER_PRIVKEY", paar.privat)
    monkeypatch.setenv("EMPFAENGER_PUBKEY", paar.oeffentlich)
    from src.main import create_app
    from src.v1.einreichung import PROTOKOLL

    PROTOKOLL.leeren()
    with TestClient(create_app()) as k:
        yield k
    PROTOKOLL.leeren()
    get_settings.cache_clear()


def _einreichen(klient: TestClient, rohdaten: bytes, name: str) -> dict:
    antwort = klient.post(
        "/v1/einreichung",
        headers=KOPF,
        files={"datei": (name, rohdaten, "application/octet-stream")},
    )
    assert antwort.status_code == 200, antwort.text
    return antwort.json()


def test_verschluesselte_meldung_wird_angenommen(
    klient: TestClient, paar: umschlag.Schluesselpaar
) -> None:
    """Der Gutfall: Umschlag rein, Quittung raus."""
    klar = BEISPIEL.read_bytes()
    brief = umschlag.verschliessen(
        klar, paar.oeffentlich, dateiname="meldung.csv"
    )
    daten = _einreichen(klient, brief, "meldung.umschlag")
    assert daten["angenommen"] is True, daten["fehler"]
    # Die Saetze stehen in der Quittung — die Stelle hat also wirklich
    # entschluesselt und nicht nur „ok" gesagt.
    assert daten["saetze"], "keine Saetze — wurde ueberhaupt geoeffnet?"


def test_schrittprotokoll_nennt_die_entschluesselung(
    klient: TestClient, paar: umschlag.Schluesselpaar
) -> None:
    """Die Behoerde will den WEG sehen, nicht nur das Ergebnis."""
    brief = umschlag.verschliessen(
        BEISPIEL.read_bytes(), paar.oeffentlich, dateiname="meldung.csv"
    )
    daten = _einreichen(klient, brief, "meldung.umschlag")
    namen = [s["name"] for s in daten["schritte"]]
    assert namen == [
        "Empfang",
        "Entschluesselung",
        "Formaterkennung",
        "Pruefung",
        "Dublettenpruefung",
        "Quittung",
    ], namen
    entschluesselung = daten["schritte"][1]
    assert entschluesselung["geschafft"] is True
    assert "AES-256-GCM" in entschluesselung["beschreibung"]


def test_klartext_geht_weiterhin_durch(klient: TestClient) -> None:
    """Die Verschluesselung ist eine Huelle, keine Pflicht.

    Fuer das Meldejahr 2025 reicht Klartext; der Umschlag ist der Weg, den
    die Behoerde sich fuer die Zukunft ansieht. Beide muessen gehen.
    """
    daten = _einreichen(klient, BEISPIEL.read_bytes(), "meldung.csv")
    assert daten["angenommen"] is True, daten["fehler"]
    assert daten["verschluesselt"] is False
    assert daten["schritte"][1]["beschreibung"].startswith("nicht verschluesselt")


def test_fremder_schluessel_wird_zurueckgewiesen(klient: TestClient) -> None:
    """Ein Umschlag fuer einen anderen Empfaenger geht nicht auf.

    Und er wird NICHT als Klartext weiterverarbeitet (fail-closed): Sonst
    liefe Geheimtext in die Formatpruefung und die Stelle meldete
    „unbekanntes Format" statt des wahren Grundes.
    """
    fremd = umschlag.schluesselpaar_erzeugen()
    brief = umschlag.verschliessen(
        BEISPIEL.read_bytes(), fremd.oeffentlich, dateiname="meldung.csv"
    )
    daten = _einreichen(klient, brief, "meldung.umschlag")
    assert daten["angenommen"] is False
    gruende = " ".join(f["grund"] for f in daten["fehler"])
    assert "anderen Empfaenger" in gruende, gruende
    assert daten["schritte"][1]["geschafft"] is False


def test_verfaelschter_umschlag_wird_erkannt(
    klient: TestClient, paar: umschlag.Schluesselpaar
) -> None:
    """Ein gekipptes Byte im Geheimtext faellt auf (AES-GCM)."""
    import base64

    brief = json.loads(
        umschlag.verschliessen(
            BEISPIEL.read_bytes(), paar.oeffentlich, dateiname="meldung.csv"
        )
    )
    roh = bytearray(base64.b64decode(brief["inhalt"]))
    roh[30] ^= 0x01
    brief["inhalt"] = base64.b64encode(bytes(roh)).decode()
    daten = _einreichen(klient, json.dumps(brief).encode(), "meldung.umschlag")
    assert daten["angenommen"] is False
    gruende = " ".join(f["grund"] for f in daten["fehler"])
    assert "veraendert" in gruende, gruende


def test_dublette_greift_am_klartext(
    klient: TestClient, paar: umschlag.Schluesselpaar
) -> None:
    """Zweimal derselbe Inhalt in zwei verschiedenen Umschlaegen.

    Der Kern: Zwei Umschlaege desselben Inhalts haben VERSCHIEDENE Bytes
    (frischer Nonce je Verschluesselung). Griffe die Dublettensperre am
    Umschlag, ginge dieselbe Meldung beliebig oft durch —
    „Indtaegten skal kun indberettes een gang og ikke dobbelt".
    """
    klar = BEISPIEL.read_bytes()
    erst = umschlag.verschliessen(klar, paar.oeffentlich, dateiname="m.csv")
    zweit = umschlag.verschliessen(klar, paar.oeffentlich, dateiname="m.csv")
    assert erst != zweit, "gleiche Bytes — dann prueft der Test nichts"

    assert _einreichen(klient, erst, "m.umschlag")["angenommen"] is True
    zweite = _einreichen(klient, zweit, "m.umschlag")
    assert zweite["angenommen"] is False
    gruende = " ".join(f["grund"] for f in zweite["fehler"])
    assert "bereits" in gruende.lower(), gruende


def test_ohne_privaten_schluessel_sagt_die_stelle_das(
    monkeypatch: pytest.MonkeyPatch, paar: umschlag.Schluesselpaar
) -> None:
    """Eine Stelle ohne Schluessel taeuscht nichts vor.

    Sie nimmt den Umschlag nicht an und nennt den Grund. Ein stilles
    Durchwinken als „unbekanntes Format" waere die falsche Auskunft.
    """
    get_settings.cache_clear()
    monkeypatch.setenv("STAGING_TOKEN", "test-token-nicht-echt")
    monkeypatch.delenv("EMPFAENGER_PRIVKEY", raising=False)
    from src.main import create_app
    from src.v1.einreichung import PROTOKOLL

    PROTOKOLL.leeren()
    with TestClient(create_app()) as klient:
        brief = umschlag.verschliessen(
            BEISPIEL.read_bytes(), paar.oeffentlich, dateiname="m.csv"
        )
        daten = _einreichen(klient, brief, "m.umschlag")
    get_settings.cache_clear()
    assert daten["angenommen"] is False
    gruende = " ".join(f["grund"] for f in daten["fehler"])
    assert "EMPFAENGER_PRIVKEY" in gruende, gruende
