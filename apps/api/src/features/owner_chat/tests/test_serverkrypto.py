"""Serverseitige Chat-Verschlüsselung — an der ECHTEN Krypto gemessen.

Kein Mock: Ein Mock bewiese nur, dass der Mock funktioniert — genau die Art
Test, die grün ist, während die Sache kaputt ist.
"""
import base64

import pytest

from src.features.owner_chat import serverkrypto
from src.features.owner_chat.fehler import OwnerChatError

SCHLUESSEL = base64.b64encode(bytes(range(32))).decode()


@pytest.fixture(autouse=True)
def _schluessel_setzen(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OWNER_CHAT_SCHLUESSEL", SCHLUESSEL)


def test_hin_und_zurueck() -> None:
    text = "Der Zähler steht auf 4711 — bitte prüfen. 🔑"
    assert serverkrypto.entschluesseln(serverkrypto.verschluesseln(text)) == text


def test_nonce_wird_nie_wiederverwendet() -> None:
    # Der EINE Fehler, der AES-GCM vollständig bricht. Zwei gleiche Klartexte
    # müssen unterschiedliche Chiffretexte ergeben.
    a = serverkrypto.verschluesseln("gleich")
    b = serverkrypto.verschluesseln("gleich")
    assert a != b
    assert serverkrypto.entschluesseln(a) == serverkrypto.entschluesseln(b)


def test_manipulierter_chiffretext_gibt_none_statt_klartext() -> None:
    # GCM ist authentifiziert: ein verändertes Byte MUSS auffallen. Ein
    # Rückfall auf Teil-Klartext wäre die gefährlichste Variante (Wurzel 5).
    roh = bytearray(base64.b64decode(serverkrypto.verschluesseln("geheim")))
    roh[-1] ^= 0x01
    assert serverkrypto.entschluesseln(base64.b64encode(bytes(roh)).decode()) is None


def test_fremder_schluessel_oeffnet_nicht(monkeypatch: pytest.MonkeyPatch) -> None:
    verpackt = serverkrypto.verschluesseln("vertraulich")
    monkeypatch.setenv(
        "OWNER_CHAT_SCHLUESSEL", base64.b64encode(bytes(32)).decode()
    )
    assert serverkrypto.entschluesseln(verpackt) is None


def test_e2e_bestand_gibt_none_statt_fehler() -> None:
    # Nachrichten aus der Zeit vor der Umstellung tragen die Marke nicht. Sie
    # sind nicht kaputt — sie gehören einem anderen Verfahren.
    alt = base64.b64encode(b"irgendein alter E2E-Chiffretext").decode()
    assert serverkrypto.entschluesseln(alt) is None
    assert serverkrypto.ist_serverseitig(alt) is False


def test_eigene_nachricht_traegt_die_marke() -> None:
    assert serverkrypto.ist_serverseitig(serverkrypto.verschluesseln("x")) is True


def test_ohne_schluessel_faellt_es_auf(monkeypatch: pytest.MonkeyPatch) -> None:
    # Fail-closed: NIE still im Klartext speichern (Wurzel 4/5).
    monkeypatch.delenv("OWNER_CHAT_SCHLUESSEL", raising=False)
    with pytest.raises(OwnerChatError) as exc:
        serverkrypto.verschluesseln("etwas")
    assert exc.value.status_code == 503


def test_falsche_schluessellaenge_faellt_auf(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OWNER_CHAT_SCHLUESSEL", base64.b64encode(b"zu kurz").decode())
    with pytest.raises(OwnerChatError) as exc:
        serverkrypto.verschluesseln("etwas")
    assert exc.value.status_code == 503


def test_leerer_text_wird_abgewiesen() -> None:
    with pytest.raises(OwnerChatError):
        serverkrypto.verschluesseln("")


def test_muell_gibt_none() -> None:
    assert serverkrypto.entschluesseln("kein base64 !!!") is None
    assert serverkrypto.entschluesseln("") is None
