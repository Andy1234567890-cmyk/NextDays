"""Länder-Normalisierung: ISO-2 ↔ Name, Präfix-Suche für die Freitextsuche.

Hintergrund: `properties.country` speichert „DK", der Gast sucht „Dänemark".
Ohne die Auflösung fand die Marktplatz-Suche nach dem Land NIE etwas.
"""
from src.core.countries import (
    country_codes_matching,
    country_name,
    is_iso2_country,
    normalize_country,
)


def test_normalize_country_code_und_name() -> None:
    assert normalize_country("DK") == "DK"
    assert normalize_country("dk") == "DK"
    assert normalize_country("Dänemark") == "DK"
    assert normalize_country("Denmark") == "DK"
    assert normalize_country("Deutschland") == "DE"


def test_normalize_country_unbekannt_ohne_fallback() -> None:
    assert normalize_country("Atlantis") is None
    assert normalize_country("") is None
    assert normalize_country(None) is None


def test_country_name_beide_richtungen() -> None:
    assert country_name("DK") == "Dänemark"
    assert country_name("dk") == "Dänemark"
    assert country_name("DK", englisch=True) == "Denmark"
    assert country_name("DE") == "Deutschland"


def test_country_name_unbekannt_wird_nicht_geraten() -> None:
    assert country_name("XX") is None
    assert country_name("") is None
    assert country_name(None) is None


def test_country_codes_matching_praefix() -> None:
    assert country_codes_matching("Däne") == frozenset({"DK"})
    assert country_codes_matching("dän") == frozenset({"DK"})
    assert country_codes_matching("Deutsch") == frozenset({"DE"})
    assert country_codes_matching("Denm") == frozenset({"DK"})
    # Gemeinsamer Präfix trifft mehrere Länder — beide gehören ins Ergebnis.
    assert {"SK", "SI"} <= country_codes_matching("Slow")


def test_country_codes_matching_kein_teilstring_treffer() -> None:
    """„land" darf NICHT Deutschland/Finnland/Irland/Polen treffen — Präfix,
    kein Teilstring, sonst wird die Suche unbrauchbar."""
    assert country_codes_matching("land") == frozenset()


def test_country_codes_matching_leer() -> None:
    assert country_codes_matching("") == frozenset()
    assert country_codes_matching("   ") == frozenset()
    assert country_codes_matching(None) == frozenset()


def test_is_iso2_country() -> None:
    assert is_iso2_country("DK") is True
    assert is_iso2_country("dk") is True
    assert is_iso2_country("Dänemark") is False
    assert is_iso2_country(None) is False
