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


def test_gefaelschte_marke_gilt_nicht_als_serverseitig(monkeypatch) -> None:
    """Die Marke `sv1:` allein beweist nichts — nur der Auth-Tag zählt.

    Die erste Fassung prüfte das base64-Präfix. Ein Absender konnte damit
    `b64encode(b"sv1:" + irgendwas)` schicken, und `nachricht_ablegen`
    übersprang die Geräteprüfung: beliebiges `sender_key`-Material liess sich
    unter fremdem Namen ablegen (nachgestellt 09.09.2026). Fälschen muss
    heissen, den Serverschlüssel zu kennen.
    """
    monkeypatch.setenv("OWNER_CHAT_SCHLUESSEL", base64.b64encode(b"k" * 32).decode())
    gefaelscht = base64.b64encode(b"sv1:" + b"beliebige bytes").decode()
    assert serverkrypto.ist_serverseitig(gefaelscht) is False
    # Die echte Nachricht wird weiterhin erkannt.
    assert serverkrypto.ist_serverseitig(serverkrypto.verschluesseln("echt")) is True


# --- Rueckhalt fuer OwnerChatError (09.09.2026) ------------------------------


def test_owner_chat_fehler_wird_nicht_zum_500() -> None:
    """Ein `OwnerChatError` ausserhalb eines try-Blocks behaelt seinen Code.

    Der Verlaufsabruf entschluesselt in `_verlauf_antwort` — also NACH dem
    try. Fehlte `OWNER_CHAT_SCHLUESSEL`, kam der 503 als 500 beim Nutzer an:
    ein Konfigurationsmangel, der wie ein Serverfehler aussieht (Wurzel 5).
    """
    from fastapi.testclient import TestClient as _TC

    from src.features.owner_chat.fehler import OwnerChatError
    from src.main import create_app

    app = create_app()

    @app.get("/api/v1/__pruefung_owner_chat_fehler")
    def _werfen() -> None:  # noqa: ANN202
        raise OwnerChatError("Chat ist nicht eingerichtet.", status_code=503)

    antwort = _TC(app, raise_server_exceptions=False).get(
        "/api/v1/__pruefung_owner_chat_fehler"
    )
    assert antwort.status_code == 503
    assert antwort.json()["detail"] == "Chat ist nicht eingerichtet."
