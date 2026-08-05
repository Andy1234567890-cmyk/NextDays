"""Bundesland/Region: kommt aus den Koordinaten, nie aus der Luft.

Warum diese Tests: Airbnb liefert KEIN Regionsfeld (35 Felder gemessen, vier
`_format`-Varianten identisch, `v2/listing_addresses` → 404), Channex führt es
leer (`state: null`). Unser Standort-Formular verlangt es. Der einzige ehrliche
Weg ist die Ableitung aus `lat`/`lng` — und genau dabei sind zwei Fehler leicht
gemacht:

  1. `type_attributes` mit `{"location": {...}}` ÜBERSCHREIBEN und dabei
     Entfernungen, Wegbeschreibung und Kartenbild löschen (Wurzel 1).
  2. Bei fehlendem Treffer irgendetwas Plausibles einsetzen (Wurzel 4).
"""
from __future__ import annotations

import httpx
import pytest

from src.features.channel_manager import region_geokodierung as rg
from src.features.channel_manager.airbnb_direkt import AirbnbDirektMixin

ANTWORT_OK = {
    "status": "OK",
    "results": [
        {
            "formatted_address": "North Denmark Region, Denmark",
            "address_components": [
                {
                    "long_name": "North Denmark Region",
                    "short_name": "North Denmark Region",
                    "types": ["administrative_area_level_1", "political"],
                },
                {
                    "long_name": "Denmark",
                    "short_name": "DK",
                    "types": ["country", "political"],
                },
            ],
        }
    ],
}


class _Antwort:
    """Minimale httpx-Antwort — nur was das Modul liest."""

    def __init__(self, status_code: int, daten: object = None, kaputt: bool = False):
        self.status_code = status_code
        self._daten = daten
        self._kaputt = kaputt

    def json(self) -> object:
        if self._kaputt:
            raise ValueError("kein JSON")
        return self._daten


@pytest.fixture(name="mit_schluessel")
def _mit_schluessel(monkeypatch):
    """Ein Schlüssel ist gesetzt — sonst bricht das Modul sofort ab."""

    class _Einstellungen:
        class google_maps_api_key:  # noqa: N801 — spiegelt SecretStr-Schnittstelle
            @staticmethod
            def get_secret_value() -> str:
                return "test-schluessel"

    monkeypatch.setattr(rg, "get_settings", lambda: _Einstellungen)


def _antwort_setzen(monkeypatch, antwort: _Antwort | Exception) -> list[dict]:
    """Den HTTP-Aufruf ersetzen; gibt die gesendeten Parameter zurück."""
    gesendet: list[dict] = []

    class _Client:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        @staticmethod
        def get(_url, params=None):
            gesendet.append(params or {})
            if isinstance(antwort, Exception):
                raise antwort
            return antwort

    monkeypatch.setattr(rg.httpx, "Client", _Client)
    return gesendet


def test_region_aus_koordinaten(monkeypatch, mit_schluessel):
    """Der Lodgify-Wert: 57.44/10.05 → „North Denmark Region"."""
    gesendet = _antwort_setzen(monkeypatch, _Antwort(200, ANTWORT_OK))
    assert rg.region_aus_koordinaten(57.44, 10.05) == "North Denmark Region"
    # Ohne `result_type` liefert Google die ganze Kette bis zum Haus; ohne
    # festes `language` heißt dieselbe Region je Sprache anders.
    assert gesendet[0]["result_type"] == "administrative_area_level_1"
    assert gesendet[0]["language"] == "en"


def test_ohne_schluessel_kein_aufruf(monkeypatch):
    """Kein Schlüssel → gar kein HTTP-Aufruf und kein Ersatzwert."""

    class _Leer:
        class google_maps_api_key:  # noqa: N801
            @staticmethod
            def get_secret_value() -> str:
                return ""

    monkeypatch.setattr(rg, "get_settings", lambda: _Leer)
    gesendet = _antwort_setzen(monkeypatch, _Antwort(200, ANTWORT_OK))
    assert rg.region_aus_koordinaten(57.44, 10.05) is None
    assert gesendet == []


def test_ohne_koordinaten_kein_aufruf(monkeypatch, mit_schluessel):
    """Ohne lat/lng gibt es nichts zu geokodieren."""
    gesendet = _antwort_setzen(monkeypatch, _Antwort(200, ANTWORT_OK))
    assert rg.region_aus_koordinaten(None, 10.05) is None
    assert rg.region_aus_koordinaten(57.44, None) is None
    assert gesendet == []


@pytest.mark.parametrize(
    "antwort",
    [
        _Antwort(200, {"status": "ZERO_RESULTS", "results": []}),
        _Antwort(200, {"status": "REQUEST_DENIED", "error_message": "key bad"}),
        _Antwort(200, {"status": "OK", "results": []}),
        _Antwort(403, {}),
        _Antwort(200, kaputt=True),
        httpx.ConnectError("kein Netz"),
    ],
)
def test_kein_treffer_kein_ersatzwert(monkeypatch, mit_schluessel, antwort):
    """Jeder Fehlerfall endet in None — nie in einem plausiblen Wert."""
    _antwort_setzen(monkeypatch, antwort)
    assert rg.region_aus_koordinaten(57.44, 10.05) is None


def test_ebene_1_wird_gewaehlt_nicht_das_land(monkeypatch, mit_schluessel):
    """Aus mehreren Komponenten kommt die Verwaltungsebene 1, nicht das Land."""
    _antwort_setzen(
        monkeypatch,
        _Antwort(
            200,
            {
                "status": "OK",
                "results": [
                    {
                        "address_components": [
                            {"long_name": "Denmark", "types": ["country"]},
                            {
                                "long_name": "Region Syddanmark",
                                "types": ["administrative_area_level_1"],
                            },
                        ]
                    }
                ],
            },
        ),
    )
    assert rg.region_aus_koordinaten(55.4, 9.5) == "Region Syddanmark"


# --- Einbau in die Übernahme ----------------------------------------------


class _Uebernahme(AirbnbDirektMixin):
    """Nur die Region-Methode wird geprüft — der Rest braucht kein Objekt."""


def test_region_ergaenzt_und_loescht_nichts(monkeypatch):
    """Wurzel 1: die anderen Standort-Zusätze bleiben erhalten."""
    monkeypatch.setattr(
        "src.features.channel_manager.airbnb_direkt.region_aus_koordinaten",
        lambda lat, lng: "North Denmark Region",
    )
    alt = {
        "type_attributes": {
            "location": {
                "distances": {"unit": "km", "values": {"airport": 42}},
                "directions": {"de": "Hinter der Kirche links."},
                "stateProvince": "",
            },
            "hotel": {"sterne": 3},
        }
    }
    neu = _Uebernahme()._region_nachtragen(alt, 57.44, 10.05)
    assert neu is not None
    ort = neu["location"]
    assert ort["stateProvince"] == "North Denmark Region"
    # Alles, was daneben lag, ist noch da:
    assert ort["distances"] == {"unit": "km", "values": {"airport": 42}}
    assert ort["directions"] == {"de": "Hinter der Kirche links."}
    assert neu["hotel"] == {"sterne": 3}
    # Und das Original wurde nicht mutiert (der Aufrufer schreibt selbst).
    assert alt["type_attributes"]["location"]["stateProvince"] == ""


def test_gepflegte_region_bleibt(monkeypatch):
    """Wurzel 1: was der Betrieb selbst eingetragen hat, wird nicht ersetzt."""
    aufrufe: list[tuple] = []
    monkeypatch.setattr(
        "src.features.channel_manager.airbnb_direkt.region_aus_koordinaten",
        lambda lat, lng: aufrufe.append((lat, lng)) or "Andere Region",
    )
    alt = {"type_attributes": {"location": {"stateProvince": "Region Nordjylland"}}}
    assert _Uebernahme()._region_nachtragen(alt, 57.44, 10.05) is None
    # Nicht einmal gefragt wurde — kein Aufruf, keine Kosten.
    assert aufrufe == []


def test_ohne_treffer_kein_schreibvorgang(monkeypatch):
    """Wurzel 4: keine Region gefunden → nichts wird gesetzt."""
    monkeypatch.setattr(
        "src.features.channel_manager.airbnb_direkt.region_aus_koordinaten",
        lambda lat, lng: None,
    )
    alt = {"type_attributes": {"location": {}}}
    assert _Uebernahme()._region_nachtragen(alt, 57.44, 10.05) is None


def test_ohne_koordinaten_kein_schreibvorgang():
    """Ohne lat/lng (String aus der DB, None) wird nichts geraten."""
    alt = {"type_attributes": {}}
    assert _Uebernahme()._region_nachtragen(alt, None, None) is None
    assert _Uebernahme()._region_nachtragen(alt, "57.44", "10.05") is None


def test_leere_attribute_werden_angelegt(monkeypatch):
    """Ein Objekt ohne `type_attributes` bekommt die Struktur neu."""
    monkeypatch.setattr(
        "src.features.channel_manager.airbnb_direkt.region_aus_koordinaten",
        lambda lat, lng: "North Denmark Region",
    )
    neu = _Uebernahme()._region_nachtragen({}, 57.44, 10.05)
    assert neu == {"location": {"stateProvince": "North Denmark Region"}}
