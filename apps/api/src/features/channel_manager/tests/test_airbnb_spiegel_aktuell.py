"""Der Airbnb-Spiegel muss dem Original FOLGEN, nicht einfrieren.

DER GEMELDETE FEHLER (Beta-Betrieb, 05.08.2026): Der Betrieb benannte
„Sommerhus Dora" bei Airbnb in „Feriehus Dora" um und synchronisierte erneut —
bei uns blieb der alte Name stehen. Ursache war ein `if not ziel.get(sprache)`
in `_details_texte`: ein einmal geholter Wert wurde nie wieder aktualisiert.
Weil der Objekt-Titel aus genau diesem Spiegel abgeleitet wird
(`_landestitel`), blieb auch er alt.

Zweiter Teil: Airbnbs Verfügbarkeitsregeln lagen vollständig in
`airbnbVerfuegbarkeit` — und wurden von der Maske nie gelesen. Die liest
`type_attributes.availability`, und dort stand bei 14 von 18 Objekten nichts.
"""
from __future__ import annotations

from src.features.channel_manager.airbnb_objekt_abruf import (
    AirbnbObjektAbrufMixin,
)


class _Channex:
    """Liefert Airbnbs HEUTIGE Texte — der Betrieb hat gerade umbenannt."""

    def __init__(self, name_da: str) -> None:
        self.name_da = name_da

    def get_airbnb_listing_descriptions(
        self, _channel: str, _listing: str
    ) -> dict:
        return {
            "data": {
                "listing_descriptions": [
                    {"locale": "da", "name": self.name_da,
                     "description": "tekst"},
                ]
            }
        }


class _Mixin(AirbnbObjektAbrufMixin):
    def __init__(self, channex: _Channex) -> None:
        self._channex = channex


def test_geaenderter_name_ueberschreibt_den_spiegel() -> None:
    """DER gemeldete Fehler: Airbnb ist die Wahrheit, der Spiegel folgt.

    Vor dem Fix stand hier `if not ziel.get(sprache)` — der vorhandene Wert
    blieb, und „Feriehus Dora" kam nie an.
    """
    alt = {"airbnbTexte": {"name": {"da": "Sommerhus Dora"}}}
    neu = dict(alt)
    gesetzt: list[str] = []
    dienst = _Mixin(_Channex("Feriehus Dora"))
    dienst._details_texte("ch-1", "l-1", alt, neu, gesetzt)  # noqa: SLF001
    assert neu["airbnbTexte"]["name"]["da"] == "Feriehus Dora"
    assert "airbnbTexte" in gesetzt
    # Und der Titel folgt daraus — das ist der Weg zur sichtbaren Spalte.
    titel = AirbnbObjektAbrufMixin._landestitel(  # noqa: SLF001
        neu["airbnbTexte"], "DK", "Sommerhus Dora"
    )
    assert titel == "Feriehus Dora"


def test_sprache_die_airbnb_nicht_liefert_bleibt_stehen() -> None:
    """Ein Ausfall in einer Sprache darf keinen Text löschen (Wurzel 1)."""
    alt = {"airbnbTexte": {"name": {"da": "Feriehus Dora", "de": "Ferienhaus"}}}
    neu = dict(alt)
    dienst = _Mixin(_Channex("Feriehus Dora"))
    dienst._details_texte("ch-1", "l-1", alt, neu, [])  # noqa: SLF001
    spiegel = neu.get("airbnbTexte") or alt["airbnbTexte"]
    assert spiegel["name"]["de"] == "Ferienhaus"


def test_unveraenderter_name_loest_kein_update_aus() -> None:
    """Gleich bleibt gleich — kein leerer Realtime-Ausschlag (Wurzel 2)."""
    titel = AirbnbObjektAbrufMixin._landestitel(  # noqa: SLF001
        {"name": {"da": "Sommerhus Hjejlevej"}}, "DK", "Sommerhus Hjejlevej"
    )
    assert titel is None


def test_verfuegbarkeit_landet_wo_die_maske_liest() -> None:
    """`airbnbVerfuegbarkeit` → `availability`, in der Form der Oberfläche.

    Die Maske (`readAvailability`) erwartet bei Buchungsfenster und Vorlaufzeit
    die `PerChannel`-Form; ein blanker Wert fällt dort auf die Vorgabe zurück.
    """
    alt = {
        "airbnbVerfuegbarkeit": {
            "minNaechte": 2, "maxNaechte": 1125, "vorausbuchungTage": 365,
            "vorlaufStunden": 12, "wechseltage": 0,
        }
    }
    neu = dict(alt)
    gesetzt: list[str] = []
    AirbnbObjektAbrufMixin._verfuegbarkeit_in_maske(alt, neu, gesetzt)  # noqa: SLF001
    av = neu["availability"]
    assert av["minStay"] == 2
    assert av["maxStay"] == 1125
    assert av["bookingWindowDays"]["global"] == 365
    assert av["bookingWindowDays"]["channels"]["airbnb"] == 365
    assert av["advanceNotice"]["global"] == "12:00"
    assert "availability" in gesetzt


def test_eigene_einstellung_wird_nicht_ueberschrieben() -> None:
    """`availability` pflegt der BETRIEB — Wurzel 1, nur Leeres füllen.

    Wer bewusst 3 Nächte einstellt, obwohl Airbnb 2 meldet, darf das beim
    nächsten Abruf nicht verlieren.
    """
    alt = {
        "airbnbVerfuegbarkeit": {"minNaechte": 2, "vorausbuchungTage": 365},
        "availability": {"minStay": 3},
    }
    neu = dict(alt)
    AirbnbObjektAbrufMixin._verfuegbarkeit_in_maske(alt, neu, [])  # noqa: SLF001
    assert neu["availability"]["minStay"] == 3
    # Das leere Feld daneben wird trotzdem gefüllt.
    assert neu["availability"]["bookingWindowDays"]["global"] == 365


def test_vorgabewert_gilt_nicht_als_entscheidung() -> None:
    """DER zweite gemeldete Fehler: „Mindestaufenthalt weiter falsch".

    Die Maske schreibt beim ersten Öffnen den KOMPLETTEN Default-Block. Live
    standen dadurch bei vier Objekten `minStay: 1`, während Airbnb und unsere
    eigenen Rate-Pläne 2 führten. Ein Feld auf dem Vorgabewert hat niemand
    gesetzt — es darf überschrieben werden.
    """
    alt = {
        "airbnbVerfuegbarkeit": {"minNaechte": 2, "vorlaufStunden": 12},
        # Der Default-Block, wie die Maske ihn hinterlässt.
        "availability": {
            "minStay": 1, "maxStay": 365,
            "advanceNotice": {"custom": False, "global": "00:00",
                              "channels": {"airbnb": "00:00"}},
        },
    }
    neu = dict(alt)
    AirbnbObjektAbrufMixin._verfuegbarkeit_in_maske(alt, neu, [])  # noqa: SLF001
    assert neu["availability"]["minStay"] == 2
    assert neu["availability"]["advanceNotice"]["global"] == "12:00"


def test_eigener_wert_mit_custom_bleibt() -> None:
    """`custom: true` heißt: der Betrieb hat je Kanal etwas eingestellt."""
    alt = {
        "airbnbVerfuegbarkeit": {"vorausbuchungTage": 365},
        "availability": {
            "bookingWindowDays": {"custom": True, "global": 365,
                                  "channels": {"airbnb": 90}},
        },
    }
    neu = dict(alt)
    AirbnbObjektAbrufMixin._verfuegbarkeit_in_maske(alt, neu, [])  # noqa: SLF001
    assert neu.get("availability", alt["availability"])[
        "bookingWindowDays"
    ]["channels"]["airbnb"] == 90


def test_unbekannte_vorlaufzeit_wird_nicht_erfunden() -> None:
    """Airbnb zählt Stunden, die Maske kennt feste Optionen.

    Ein Zwischenwert (z. B. 6 Stunden) hat dort keine Entsprechung — dann lieber
    nichts setzen als eine erfundene Uhrzeit (Wurzel 4).
    """
    alt = {"airbnbVerfuegbarkeit": {"vorlaufStunden": 6}}
    neu = dict(alt)
    AirbnbObjektAbrufMixin._verfuegbarkeit_in_maske(alt, neu, [])  # noqa: SLF001
    assert "advanceNotice" not in (neu.get("availability") or {})


def test_ohne_spiegel_passiert_nichts() -> None:
    """Kein Airbnb-Stand → keine erfundene Verfügbarkeit."""
    neu: dict = {}
    gesetzt: list[str] = []
    AirbnbObjektAbrufMixin._verfuegbarkeit_in_maske({}, neu, gesetzt)  # noqa: SLF001
    assert neu == {}
    assert gesetzt == []
