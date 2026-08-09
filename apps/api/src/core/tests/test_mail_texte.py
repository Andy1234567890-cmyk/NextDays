"""Der Katalog der Mailtexte muss in ALLEN 24 Sprachen vollständig sein.

Das ist die Mail-Variante des i18n-Vollständigkeitschecks im Frontend. Ohne
diesen Test zerfällt der Katalog beim nächsten Feature: jemand ergänzt einen
Schlüssel für die deutsche Fassung, und 23 Empfänger bekommen — je nach
Implementierung — einen leeren Betreff, den rohen Schlüssel oder eine
englische Zeile mitten in einer französischen Mail.

Geprüft werden vier Eigenschaften, jede hat einen realen Fehlerfall dahinter:
  1. Jeder Schlüssel kennt alle 24 Sprachen.  → sonst fehlender Text
  2. Kein Text ist leer.                       → sonst leerer Betreff
  3. Die Platzhalter stimmen sprachübergreifend überein.
     → ein in der Übersetzung vergessenes `{link}` ergibt eine Mail OHNE Link,
       und das fällt niemandem auf, der die Sprache nicht spricht.
  4. Keine Sprache trägt versehentlich einen Code, den es nicht gibt.
"""
from __future__ import annotations

import re

import pytest

from src.core.mail_sprache import FALLBACK, SUPPORTED, aufloesen, normalisieren
from src.core.mail_texte import TEXTE, MailTextFehlt, text

# Platzhalter der Form {name} — die Formatfelder, die `str.format` füllt.
_PLATZHALTER = re.compile(r"\{([a-z_]+)\}")


def test_alle_schluessel_kennen_alle_24_sprachen() -> None:
    """Jeder Schlüssel MUSS in genau den 24 unterstützten Sprachen stehen."""
    assert len(SUPPORTED) == 24, "Es müssen 24 EU-Amtssprachen sein."
    fehlend: dict[str, set[str]] = {}
    ueberzaehlig: dict[str, set[str]] = {}
    for schluessel, fassungen in TEXTE.items():
        vorhandene = set(fassungen)
        if fehlt := SUPPORTED - vorhandene:
            fehlend[schluessel] = fehlt
        if zuviel := vorhandene - SUPPORTED:
            ueberzaehlig[schluessel] = zuviel
    assert not fehlend, f"Übersetzungen fehlen: {fehlend}"
    assert not ueberzaehlig, f"Unbekannte Sprachcodes: {ueberzaehlig}"


def test_kein_text_ist_leer() -> None:
    """Ein leerer Text wäre ein leerer Betreff im Postfach des Kunden."""
    leer = [
        f"{schluessel}/{sprache}"
        for schluessel, fassungen in TEXTE.items()
        for sprache, wert in fassungen.items()
        if not wert.strip()
    ]
    assert not leer, f"Leere Mailtexte: {leer}"


def test_platzhalter_sind_in_jeder_sprache_gleich() -> None:
    """Jede Übersetzung muss dieselben Platzhalter tragen wie das Original.

    Der reale Fehlerfall: In der Übersetzung geht `{link}` oder `{objekt}`
    verloren. Die Mail wird dann fehlerfrei versendet — nur ohne Link bzw. ohne
    den Namen des Objekts. Ein zusätzlicher Platzhalter ist ebenso ein Fehler:
    `str.format` wirft dann `KeyError` mitten im Versand.
    """
    abweichungen: dict[str, str] = {}
    for schluessel, fassungen in TEXTE.items():
        erwartet = set(_PLATZHALTER.findall(fassungen[FALLBACK]))
        for sprache, wert in fassungen.items():
            gefunden = set(_PLATZHALTER.findall(wert))
            if gefunden != erwartet:
                abweichungen[f"{schluessel}/{sprache}"] = (
                    f"erwartet {sorted(erwartet)}, gefunden {sorted(gefunden)}"
                )
    assert not abweichungen, f"Platzhalter weichen ab: {abweichungen}"


def test_jeder_text_laesst_sich_formatieren() -> None:
    """Jeder Text muss sich mit seinen Platzhaltern rendern lassen.

    Fängt kaputte Klammern ab (`{name` oder `{{name}`), die `str.format` erst
    zur Laufzeit im Versand melden würde.
    """
    for schluessel, fassungen in TEXTE.items():
        felder = set(_PLATZHALTER.findall(fassungen[FALLBACK]))
        werte = {feld: "X" for feld in felder}
        for sprache in fassungen:
            ergebnis = text(schluessel, sprache, **werte)
            assert ergebnis, f"{schluessel}/{sprache} rendert leer"


# --- Auflösung / Fallback-Kette --------------------------------------------


@pytest.mark.parametrize(
    ("roh", "erwartet"),
    [
        ("de", "de"),
        ("DE", "de"),
        ("de-AT", "de"),          # Regionsvariante wird gekappt
        ("de_AT", "de"),          # Unterstrich wie bei manchen OTA-Payloads
        ("pt-BR", "pt"),
        ("  da  ", "da"),
        ("zh", None),             # nicht unterstützt → None, nicht "de"
        ("", None),
        (None, None),
        (123, None),
    ],
)
def test_normalisieren(roh: object, erwartet: str | None) -> None:
    assert normalisieren(roh) == erwartet


def test_kette_nimmt_die_erste_echte_auskunft() -> None:
    """Die erste brauchbare Stufe gewinnt, leere Stufen werden übersprungen."""
    assert aufloesen("fr", "de") == "fr"
    assert aufloesen(None, "da") == "da"
    assert aufloesen(None, "", "it") == "it"


def test_letzter_rueckfall_ist_englisch_nicht_deutsch() -> None:
    """Wurzel 4: Ohne jede Auskunft gibt es Englisch — NIE stillschweigend
    Deutsch. Deutsch wäre eine inhaltliche Behauptung über den Empfänger."""
    assert aufloesen() == "en"
    assert aufloesen(None, None) == "en"
    assert aufloesen("zh", "xx") == "en"
    assert FALLBACK == "en"


def test_unbekannter_schluessel_wirft() -> None:
    """Fail-closed: lieber ein Fehler als eine Mail mit rohem Schlüssel."""
    with pytest.raises(MailTextFehlt):
        text("gibt.es.nicht", "de")


def test_unbekannte_sprache_faellt_auf_englisch_zurueck() -> None:
    """Im Versand angekommen, ist eine englische Mail besser als ein Absturz."""
    assert text("auth.reset.aktion", "zh") == text("auth.reset.aktion", "en")
