"""Airbnb-Zugangsdaten landen dort, wo ihr Leser sie sucht.

Anlass (11.08.2026, live): Objekt „Fewo-Mosbjerg-Sindal" trug
`type_attributes.messaging.wifiName = "WAP3205v3"` samt Passwort — Schlüssel,
die kein Leser kennt. Gleichzeitig meldete die Anreise-Automail des Betriebs
„Diese Felder haben für diese Reservierung keinen Wert: door_code,
wifi_password, wifi_ssid" und ging bei sechs Anreisen in Folge NICHT raus. Der
Wert war da, nur am falschen Ort.
"""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from src.features.channel_manager import airbnb_zugang

PID = "11111111-1111-4111-8111-111111111111"

LISTING = {
    "wifi_network": "WAP3205v3",
    "wifi_password": "AxTgeheim",
    "directions": "Von Hirtshals kommend die letzte Abfahrt nehmen.",
    "apt": "lejlighed t.v.",
    "check_in_option": {
        "category": "lockbox",
        "instruction": "Der Check-in erfolgt über eine Schlüsselbox.",
    },
    "descriptions": {"locale": "de", "name": "Fewo Mosbjerg"},
}


class _Chain:
    def __init__(self, name: str, rows: list[dict], protokoll: list) -> None:
        self._name = name
        self._rows = rows
        self._protokoll = protokoll
        self._upsert: dict | None = None

    def select(self, *_a: object, **_k: object) -> _Chain:
        return self

    def eq(self, *_a: object) -> _Chain:
        return self

    def limit(self, *_a: object) -> _Chain:
        return self

    def upsert(self, payload: dict, **_k: object) -> _Chain:
        self._upsert = payload
        return self

    def execute(self) -> SimpleNamespace:
        if self._upsert is not None:
            self._protokoll.append((self._name, self._upsert))
            return SimpleNamespace(data=[self._upsert])
        return SimpleNamespace(data=self._rows)


class _DB:
    def __init__(self, portal: list[dict] | None = None) -> None:
        self.portal = portal or []
        self.geschrieben: list = []

    def table(self, name: str) -> _Chain:
        rows = self.portal if name == "property_guest_portal" else []
        return _Chain(name, rows, self.geschrieben)


def _uebernehmen(
    db: _DB, listing: dict[str, Any], alt: dict[str, Any] | None = None
) -> tuple[dict, list]:
    alt = alt or {}
    neu: dict[str, Any] = dict(alt)
    gesetzt: list[str] = []
    airbnb_zugang.zugang_uebernehmen(
        db,  # type: ignore[arg-type]
        PID, listing, alt, neu, gesetzt,
    )
    return neu, gesetzt


def test_wlan_geht_in_die_strukturierten_spalten() -> None:
    """Nicht nach `messaging.wifiName` — das liest niemand."""
    db = _DB()
    neu, _gesetzt = _uebernehmen(db, LISTING)
    assert db.geschrieben == [
        (
            "property_guest_portal",
            {
                "property_id": PID,
                "wifi_ssid": "WAP3205v3",
                "wifi_password": "AxTgeheim",
            },
        )
    ]
    messaging = neu.get("messaging") or {}
    assert "wifiName" not in messaging
    assert "wifiPassword" not in messaging


def test_gepflegtes_wlan_bleibt_stehen() -> None:
    """Wurzel 1: was der Betrieb selbst gepflegt hat, gehört ihm."""
    db = _DB([{"id": "p1", "wifi_ssid": "Eigenes-Netz", "wifi_password": None}])
    _uebernehmen(db, LISTING)
    assert db.geschrieben == [
        ("property_guest_portal", {"property_id": PID, "wifi_password": "AxTgeheim"})
    ]


def test_texte_werden_je_sprache_abgelegt() -> None:
    """`messaging.*` ist je Sprache gepflegt. Ein nackter String war für beide
    Leser unsichtbar und wäre beim nächsten Speichern der Maske gelöscht
    worden."""
    neu, gesetzt = _uebernehmen(_DB(), LISTING)
    messaging = neu["messaging"]
    assert messaging["directions"] == {"de": LISTING["directions"]}
    assert messaging["checkIn"] == {
        "de": "Der Check-in erfolgt über eine Schlüsselbox."
    }
    assert "messaging" in gesetzt


def test_vorhandene_sprache_wird_nicht_ueberschrieben() -> None:
    alt = {"messaging": {"directions": {"de": "Eigene Anfahrt", "en": ""}}}
    neu, _gesetzt = _uebernehmen(_DB(), LISTING, alt)
    assert neu["messaging"]["directions"]["de"] == "Eigene Anfahrt"


def test_ohne_locale_wird_keine_sprache_erfunden() -> None:
    """Wurzel 4: eine geratene Sprache wäre ein erfundener Wert."""
    ohne = {k: v for k, v in LISTING.items() if k != "descriptions"}
    neu, gesetzt = _uebernehmen(_DB(), ohne)
    assert "messaging" not in gesetzt
    assert not (neu.get("messaging") or {})
    # Die strukturierten Werte hängen NICHT an der Sprache — die kommen an.
    assert neu["apt"] == "lejlighed t.v."
    assert neu["checkInArt"] == "lockbox"
