"""Telefonnummer-Normalisierung an der Stripe-Grenze.

Stripe weist Nummern ohne Landesvorwahl mit "not a valid phone number" ab und
lässt damit das GESAMTE Account-Update scheitern — inklusive Handelsregister und
vertretungsberechtigter Person. Genau das passierte am 30.07.2026 mit dem im
Profil gespeicherten Wert "1234567890".
"""
import pytest

from src.features.buchhaltung.service import _e164_phone


def test_bereits_e164_bleibt_erhalten() -> None:
    assert _e164_phone("+491234567890", "DE") == "+491234567890"


def test_leerzeichen_werden_entfernt() -> None:
    """Das Eingabefeld speichert anzeige-freundlich mit Leerzeichen."""
    assert _e164_phone("+49 1234 567890", "DE") == "+491234567890"


def test_nationale_nummer_bekommt_vorwahl_aus_land() -> None:
    """Der eigentliche Fehlerfall: keine Vorwahl gespeichert."""
    assert _e164_phone("1234567890", "DE") == "+491234567890"


def test_fuehrende_null_entfaellt_international() -> None:
    """"0151…" ist national; international gilt "+49151…"."""
    assert _e164_phone("0151234567", "DE") == "+49151234567"


def test_ohne_land_wird_keine_vorwahl_geraten() -> None:
    """Kein Land → None statt einer falschen Nummer (Wurzel 4)."""
    assert _e164_phone("1234567890", None) is None
    assert _e164_phone("1234567890", "") is None


def test_unbekanntes_land_wird_nicht_geraten() -> None:
    assert _e164_phone("1234567890", "XX") is None


@pytest.mark.parametrize("wert", ["", None, "   ", "abc"])
def test_leere_oder_ziffernlose_eingabe_ist_none(wert: object) -> None:
    assert _e164_phone(wert, "DE") is None


def test_andere_laender() -> None:
    assert _e164_phone("612345678", "NL") == "+31612345678"
    assert _e164_phone("791234567", "CH") == "+41791234567"
