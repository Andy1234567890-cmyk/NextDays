"""Der Veroeffentlichen-Dialog zeigt JE PORTAL eine Zeile — nicht je Verbindung.

ANLASS (29.08.2026): Im Dialog „Objekt veroeffentlichen" stand DREIMAL

    Airbnb — Noch nicht mit diesem Portal verbunden

untereinander. React meldete dazu in der Konsole:

    Encountered two children with the same key, `AirBNB`.

URSACHE: `kanal_auswahl` lief ueber die Zeilen aus
`channex_channel_connection`, und davon gibt es zu EINEM Portal mehrere — jeder
abgebrochene Verbindungsversuch hinterlaesst eine, ebenso ein zweiter
Portal-Zugang am selben Objekt (0304). Der Kunde hatte dreimal auf „Airbnb
verbinden" geklickt, ohne den Login je abzuschliessen.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager import veroeffentlichen


def _auswahl(zeilen: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """`kanal_auswahl` mit fest vorgegebenen Verbindungszeilen."""
    original = veroeffentlichen._kanaele_des_objekts
    veroeffentlichen._kanaele_des_objekts = lambda *_a, **_k: zeilen
    try:
        return veroeffentlichen.kanal_auswahl(
            None, "t", "p", marktplatz=False  # type: ignore[arg-type]
        )
    finally:
        veroeffentlichen._kanaele_des_objekts = original


def test_drei_tote_zeilen_ergeben_eine_portalzeile() -> None:
    """Der Live-Fall: drei Airbnb-Zeilen ohne Kanal → EINE Zeile."""
    kanaele = _auswahl([
        {"ota_portal_code": "AirBNB", "channex_channel_id": None, "is_active": False},
        {"ota_portal_code": "AirBNB", "channex_channel_id": None, "is_active": False},
        {"ota_portal_code": "AirBNB", "channex_channel_id": None, "is_active": False},
    ])
    airbnb = [k for k in kanaele if k["code"] == "AirBNB"]
    assert len(airbnb) == 1, f"AirBNB steht {len(airbnb)}x im Dialog"
    assert airbnb[0]["waehlbar"] is False


def test_verbundene_zeile_schlaegt_tote() -> None:
    """Eine Leiche aus einem Abbruch darf ein funktionierendes Portal nicht sperren."""
    kanaele = _auswahl([
        {"ota_portal_code": "AirBNB", "channex_channel_id": None, "is_active": False},
        {"ota_portal_code": "AirBNB", "channex_channel_id": "kanal-1", "is_active": True},
    ])
    airbnb = [k for k in kanaele if k["code"] == "AirBNB"]
    assert len(airbnb) == 1
    assert airbnb[0]["waehlbar"] is True, (
        "Die tote Zeile hat das Portal gesperrt, obwohl eine aktive daneben steht."
    )


def test_verschiedene_portale_bleiben_getrennt() -> None:
    """Zusammenfassen heisst nicht verschmelzen."""
    kanaele = _auswahl([
        {"ota_portal_code": "AirBNB", "channex_channel_id": "k1", "is_active": True},
        {"ota_portal_code": "BookingCom", "channex_channel_id": None, "is_active": False},
    ])
    codes = [k["code"] for k in kanaele]
    assert "AirBNB" in codes and "BookingCom" in codes
    assert len(codes) == len(set(codes)), f"Doppelte Codes: {codes}"


def test_schluessel_sind_eindeutig() -> None:
    """Genau das, was React einfordert: der Portal-Code ist der Schluessel."""
    kanaele = _auswahl([
        {"ota_portal_code": "AirBNB", "channex_channel_id": None, "is_active": False},
        {"ota_portal_code": "AirBNB", "channex_channel_id": "k1", "is_active": False},
        {"ota_portal_code": "BookingCom", "channex_channel_id": "k2", "is_active": True},
    ])
    codes = [k["code"] for k in kanaele]
    assert len(codes) == len(set(codes)), f"Doppelte Schluessel: {codes}"


def test_inaktiv_schlaegt_kein_kanal() -> None:
    """Verbunden-aber-inaktiv ist naeher am Ziel als gar kein Kanal."""
    kanaele = _auswahl([
        {"ota_portal_code": "AirBNB", "channex_channel_id": None, "is_active": False},
        {"ota_portal_code": "AirBNB", "channex_channel_id": "k1", "is_active": False},
    ])
    airbnb = [k for k in kanaele if k["code"] == "AirBNB"][0]
    assert airbnb["grund"] == veroeffentlichen.GRUND_INAKTIV, (
        "Der Dialog meldet nicht-verbunden, obwohl ein Kanal existiert: "
        "der Betrieb sucht dann eine Verbindung, die es laengst gibt."
    )
