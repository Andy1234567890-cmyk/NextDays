"""Rohwerte der Portale menschenlesbar machen — Telefon und Sprache.

DER ANLASS (06.08.2026): In der Gästekarte stand „Telefon: 491729274456" und
„Sprache: de". Beides sind die Rohwerte, wie Airbnb sie liefert. Die Nummer ist
so nicht anrufbar (das „+" fehlt), und „de" ist für einen Menschen keine
Auskunft — wer „da" liest, hält es eher für einen Tippfehler als für Dänisch.
"""
from __future__ import annotations

from src.core.countries import telefon_anzeigen
from src.core.languages import sprach_name


def test_landesvorwahl_ohne_plus_bekommt_es() -> None:
    """Airbnbs Format: Landesvorwahl, aber kein „+" — live gemessen."""
    assert telefon_anzeigen("491729274456") == "+491729274456"
    assert telefon_anzeigen("4551914741") == "+4551914741"


def test_bereits_korrekte_nummer_bleibt() -> None:
    assert telefon_anzeigen("+49 172 1234567") == "+49 172 1234567"


def test_doppelnull_wird_zum_plus() -> None:
    """00 ist die internationale Amtskennzahl — dieselbe Nummer, andere Schreibweise."""
    assert telefon_anzeigen("004917212345") == "+4917212345"


def test_nationale_nummer_wird_nicht_geraten() -> None:
    """Eine führende 0 ist die nationale Verkehrsausscheidungsziffer.

    Ohne Landesvorwahl lässt sich das Land NICHT erschließen; ein „+" davor
    erzeugte eine Nummer, die es nicht gibt (Wurzel 4). Lieber unverändert.
    """
    assert telefon_anzeigen("01721234567") == "01721234567"


def test_unbrauchbares_bleibt_unveraendert() -> None:
    assert telefon_anzeigen("Rückruf erbeten") == "Rückruf erbeten"
    assert telefon_anzeigen("") is None
    assert telefon_anzeigen(None) is None


def test_sprachcode_wird_ausgeschrieben() -> None:
    assert sprach_name("de") == "Deutsch"
    assert sprach_name("da") == "Dänisch"
    assert sprach_name("de", sprache="en") == "German"


def test_regionale_variante_faellt_auf_die_sprache_zurueck() -> None:
    """„pt-BR" ist Portugiesisch; die Region gehört zum Land, nicht zur Sprache."""
    assert sprach_name("pt-BR") == "Portugiesisch"
    assert sprach_name("de_AT") == "Deutsch"
    assert sprach_name("nb") == "Norwegisch"


def test_unbekannter_code_wird_nicht_erfunden() -> None:
    """Kein geratener Name: der Aufrufer zeigt dann den Rohwert (Wurzel 4)."""
    assert sprach_name("xx") is None
    assert sprach_name("") is None
    assert sprach_name(None) is None
