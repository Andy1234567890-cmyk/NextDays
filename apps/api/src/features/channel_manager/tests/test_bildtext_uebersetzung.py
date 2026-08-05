"""Bildtexte: in der Sprache der Oberfläche, nie am falschen Bild.

Warum diese Tests: die Foto-Verwaltung liest GENAU EINE Sprache
(`photo.caption[lang]`). Der Import legte alle 17 Airbnb-Texte unter `en` ab, die
deutsche Oberfläche las `caption["de"]` und zeigte Platzhalter — die Daten waren
da, nur nie in der gelesenen Sprache.

Beim Beheben sind zwei Fehler leicht gemacht:
  1. Die Übersetzung dem FALSCHEN Bild zuordnen, wenn Google eine andere Anzahl
     zurückgibt oder Texte ohne Caption dazwischen liegen (Wurzel 5).
  2. Das Original wegwerfen — es ist der Stand bei Airbnb und geht so wieder an
     die Portale (Wurzel 1).
"""
from __future__ import annotations

import httpx
import pytest

from src.features.channel_manager import bildtext_uebersetzung as bu
from src.features.channel_manager.airbnb_direkt import AirbnbDirektMixin

ORIGINAL = "Living-dining area with sofa bed 140x200 and open kitchen"
DEUTSCH = "Wohn-Essbereich mit Schlafsofa (140 x 200 cm) und offener Küche"


class _Antwort:
    def __init__(self, status_code: int, daten: object = None, kaputt: bool = False):
        self.status_code = status_code
        self.text = "körper"
        self._daten = daten
        self._kaputt = kaputt

    def json(self) -> object:
        if self._kaputt:
            raise ValueError("kein JSON")
        return self._daten


def _treffer(*texte: str) -> dict:
    return {"data": {"translations": [{"translatedText": t} for t in texte]}}


@pytest.fixture(name="mit_schluessel")
def _mit_schluessel(monkeypatch):
    class _Einstellungen:
        class google_translate_api_key:  # noqa: N801 — spiegelt SecretStr
            @staticmethod
            def get_secret_value() -> str:
                return "test-schluessel"

    monkeypatch.setattr(bu, "get_settings", lambda: _Einstellungen)


def _post_setzen(monkeypatch, antwort: _Antwort | Exception) -> list[dict]:
    gesendet: list[dict] = []

    class _Client:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        @staticmethod
        def post(_url, params=None, data=None):
            gesendet.append(dict(data or {}))
            if isinstance(antwort, Exception):
                raise antwort
            return antwort

    monkeypatch.setattr(bu.httpx, "Client", _Client)
    return gesendet


def test_alle_texte_in_einem_aufruf(monkeypatch, mit_schluessel):
    """17 Bildtexte = EIN Aufruf, nicht 17."""
    gesendet = _post_setzen(monkeypatch, _Antwort(200, _treffer("A", "B", "C")))
    assert bu.bildtexte_uebersetzen(["a", "b", "c"], quelle="en", ziel="de") == [
        "A", "B", "C",
    ]
    assert len(gesendet) == 1
    # `q` als LISTE im dict — eine Liste von Tupeln wirft in httpx beim Senden
    # („expected a bytes-like object, tuple found"), und zwar erst live, nicht
    # im Test. Deshalb wird hier die tatsächlich gesendete Form geprüft.
    daten = gesendet[0]
    assert daten["q"] == ["a", "b", "c"]
    assert daten["source"] == "en"
    assert daten["target"] == "de"


def test_gleiche_sprache_kein_aufruf(monkeypatch, mit_schluessel):
    """en→en ist keine Übersetzung, sondern ein verschwendeter Aufruf."""
    gesendet = _post_setzen(monkeypatch, _Antwort(200, _treffer("A")))
    assert bu.bildtexte_uebersetzen(["a"], quelle="en", ziel="en") is None
    assert gesendet == []


def test_ohne_schluessel_kein_aufruf(monkeypatch):
    class _Leer:
        class google_translate_api_key:  # noqa: N801
            @staticmethod
            def get_secret_value() -> str:
                return ""

    monkeypatch.setattr(bu, "get_settings", lambda: _Leer)
    gesendet = _post_setzen(monkeypatch, _Antwort(200, _treffer("A")))
    assert bu.bildtexte_uebersetzen(["a"], quelle="en", ziel="de") is None
    assert gesendet == []


def test_anzahl_abweichend_keine_zuordnung(monkeypatch, mit_schluessel):
    """Weniger Übersetzungen als Texte → GAR KEINE, sonst rutscht alles.

    Der schlimmste Fall: Text 2 landet an Bild 1. Ein fehlender Bildtext ist
    harmlos, ein falscher ist eine Falschaussage über das Objekt.
    """
    _post_setzen(monkeypatch, _Antwort(200, _treffer("A", "B")))
    assert bu.bildtexte_uebersetzen(["a", "b", "c"], quelle="en", ziel="de") is None


@pytest.mark.parametrize(
    "antwort",
    [
        _Antwort(403, {}),
        _Antwort(200, {"data": {"translations": []}}),
        _Antwort(200, {}),
        _Antwort(200, kaputt=True),
        httpx.ConnectError("kein Netz"),
    ],
)
def test_fehler_enden_in_none(monkeypatch, mit_schluessel, antwort):
    _post_setzen(monkeypatch, antwort)
    assert bu.bildtexte_uebersetzen(["a"], quelle="en", ziel="de") is None


def test_zu_viele_texte_nicht_still_gekappt(monkeypatch, mit_schluessel):
    """Über der Batch-Grenze wird nichts übersetzt — und es steht im Log."""
    gesendet = _post_setzen(monkeypatch, _Antwort(200, _treffer("A")))
    assert bu.bildtexte_uebersetzen(["x"] * 101, quelle="en", ziel="de") is None
    assert gesendet == []


# --- caption_mehrsprachig --------------------------------------------------


def test_beide_sprachen_gespeichert():
    """Original UND Übersetzung — das Original geht an die Portale zurück."""
    assert bu.caption_mehrsprachig(ORIGINAL, DEUTSCH, quelle="en", ziel="de") == {
        "en": ORIGINAL,
        "de": DEUTSCH,
    }


def test_ohne_uebersetzung_bleibt_original():
    """Wurzel 1: das Original wird nie weggeworfen."""
    assert bu.caption_mehrsprachig(ORIGINAL, None, quelle="en", ziel="de") == {
        "en": ORIGINAL,
    }


def test_leerer_text_erzeugt_keinen_eintrag():
    """Kein Bildtext bei Airbnb → leeres dict, kein erfundener Text."""
    assert bu.caption_mehrsprachig("", None, quelle="en", ziel="de") == {}
    assert bu.caption_mehrsprachig("   ", "  ", quelle="en", ziel="de") == {}


# --- Einbau in den Foto-Import --------------------------------------------


class _Import(AirbnbDirektMixin):
    """Nur `_captions_aufbauen` wird geprüft."""


def test_captions_ueberspringen_leere_ohne_zu_verrutschen(monkeypatch):
    """Fotos OHNE Bildtext dürfen die Zuordnung nicht verschieben.

    Der gemessene Fall: 17 Fotos, eines mit leerem Text. Würde der leere Text
    mitgesendet, käme eine Übersetzung zu viel zurück — und ohne Index-Zuordnung
    landete jeder Text ein Bild zu früh.
    """
    gesendet: list[list[str]] = []

    def _fake(texte, *, quelle, ziel):  # noqa: ARG001
        gesendet.append(list(texte))
        return [f"DE:{t}" for t in texte]

    monkeypatch.setattr(
        "src.features.channel_manager.airbnb_direkt.bildtexte_uebersetzen", _fake
    )
    fotos = [
        {"caption_roh": "erstes"},
        {"caption_roh": ""},
        {"caption_roh": "drittes"},
    ]
    assert _Import()._captions_aufbauen(fotos, "de") == [
        {"en": "erstes", "de": "DE:erstes"},
        {},
        {"en": "drittes", "de": "DE:drittes"},
    ]
    # Der leere Text wurde nicht mitgeschickt.
    assert gesendet == [["erstes", "drittes"]]


def test_captions_ohne_uebersetzer_nur_original(monkeypatch):
    """Kein Übersetzer → die Bildtexte stehen wenigstens auf Englisch da."""
    monkeypatch.setattr(
        "src.features.channel_manager.airbnb_direkt.bildtexte_uebersetzen",
        lambda texte, *, quelle, ziel: None,  # noqa: ARG005
    )
    fotos = [{"caption_roh": ORIGINAL}]
    assert _Import()._captions_aufbauen(fotos, "de") == [{"en": ORIGINAL}]
