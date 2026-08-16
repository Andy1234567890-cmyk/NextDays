"""Sprachnamen im Katalog folgen der Oberfläche des Betriebs.

Ohne den `sprache`-Parameter stünden in einer englischen oder italienischen
Oberfläche die deutschen Namen („Englisch, Italienisch" statt „English,
Italian"). Der Katalog führt zwei Namen je Code; für jede Sprache außer Deutsch
ist Englisch die belegte Fassung — kein erfundener dritter Name (Wurzel 4).
"""
from __future__ import annotations

from src.core.languages import alle_sprachen


def test_deutsch_liefert_deutsche_namen() -> None:
    namen = dict(alle_sprachen(sprache="de"))
    assert namen["en"] == "Englisch"
    assert namen["it"] == "Italienisch"


def test_englisch_liefert_englische_namen() -> None:
    namen = dict(alle_sprachen(sprache="en"))
    assert namen["en"] == "English"
    assert namen["it"] == "Italian"


def test_beide_fassungen_decken_dieselben_codes_ab() -> None:
    """Sonst fehlte eine Sprache je nach Oberfläche still in der Auswahl."""
    assert {c for c, _ in alle_sprachen(sprache="de")} == {
        c for c, _ in alle_sprachen(sprache="en")
    }


def test_nach_namen_sortiert_nicht_nach_code() -> None:
    """Die Liste wird gelesen, nicht gerechnet — in BEIDEN Fassungen."""
    for sprache in ("de", "en"):
        namen = [n for _c, n in alle_sprachen(sprache=sprache)]
        assert namen == sorted(namen)
