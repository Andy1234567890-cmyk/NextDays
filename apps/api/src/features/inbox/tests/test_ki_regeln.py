"""Tests der Regel- und Zustell-Logik.

Der teuerste Fehler in diesem Bereich ist eine automatisch gesendete Zusage,
die Geld kostet oder rechtlich bindet — „ja, wir erstatten Ihnen 200 €", von
niemandem gelesen. Die Sperre dagegen ist nicht abschaltbar; diese Tests
halten sie fest.

Der zweitteuerste ist eine Regel, die nach einer Umstellung weiter für Objekte
gilt, aus denen sie entfernt wurde (Wurzel 1). Auch das steht hier.
"""

from __future__ import annotations

import pytest

from src.features.inbox.ki_regeln import (
    GESPERRTE_THEMEN,
    KiRegelnMixin,
    gesperrtes_thema,
)

_entscheiden = KiRegelnMixin.zustellart_entscheiden


def _regel(**felder: object) -> dict:
    basis = {
        "id": "r1",
        "name": "Testregel",
        "zustellart": "automatisch",
        "anweisung": "Antworte kurz.",
        "ist_eskalation": False,
        "benachrichtigen": False,
    }
    return {**basis, **felder}


# --- Die Themensperre -------------------------------------------------------
@pytest.mark.parametrize(
    "frage",
    [
        "Können Sie mir den Betrag erstatten?",
        "Can I get a refund?",
        "Kan jeg få pengene tilbage?",
        "Gibt es einen Rabatt für längere Aufenthalte?",
        "Ich möchte die Buchung stornieren.",
        "Meine Kreditkarte wurde belastet, bitte prüfen.",
        "Es gab einen Wasserschaden im Bad.",
        "Ich schalte meinen Anwalt ein.",
        "Können Sie uns die Woche danach auch reservieren?",
    ],
)
def test_gesperrte_themen_werden_erkannt(frage: str) -> None:
    assert gesperrtes_thema(frage) is not None


@pytest.mark.parametrize(
    "frage",
    [
        "Wie ist das WLAN-Passwort?",
        "Wann können wir anreisen?",
        "Sind Hunde erlaubt?",
        "Where is the nearest supermarket?",
        "Hvornår skal vi tjekke ud?",
    ],
)
def test_harmlose_fragen_sind_nicht_gesperrt(frage: str) -> None:
    """Die Sperre darf nicht alles fangen — sonst ist Autoantwort wertlos."""
    assert gesperrtes_thema(frage) is None


def test_gesperrtes_thema_nennt_sich_beim_namen() -> None:
    """Der Betrieb muss im Protokoll lesen, WARUM nicht gesendet wurde.

    Ein blosses „nein" sähe wie ein Aussetzer aus.
    """
    assert gesperrtes_thema("Bitte erstatten Sie mir das Geld.") in GESPERRTE_THEMEN


def test_sperre_schlaegt_die_regel() -> None:
    """Auch eine ausdrücklich automatische Regel sendet hier nicht.

    Das ist der Kern: ein Betrieb, der „beantworte alles automatisch" anlegt,
    hat Erstattungszusagen nicht gemeint.
    """
    zustellart, grund, _regel_ = _entscheiden(
        [_regel(zustellart="automatisch")],
        "Können Sie mir den Betrag erstatten?",
        autoantwort_aktiv=True,
    )
    assert zustellart == "entwurf"
    assert grund is not None and "Gesperrtes Thema" in grund


# --- Rangfolge der Entscheidung ---------------------------------------------
def test_ohne_grossen_schalter_geht_nichts_automatisch() -> None:
    """Rang 1: der Schalter des Betriebs steht über jeder Regel."""
    zustellart, _grund, _r = _entscheiden(
        [_regel(zustellart="automatisch")],
        "Wie ist das WLAN?",
        autoantwort_aktiv=False,
    )
    assert zustellart == "entwurf"


def test_eskalationsregel_antwortet_nicht() -> None:
    """Rang 2: wo ein Mensch übernehmen soll, schreibt die KI nicht selbst."""
    zustellart, grund, regel = _entscheiden(
        [
            _regel(id="esk", name="Beschwerde", ist_eskalation=True),
            _regel(id="auto", zustellart="automatisch"),
        ],
        "Wie ist das WLAN?",
        autoantwort_aktiv=True,
    )
    assert zustellart == "entwurf"
    assert grund is not None and "Eskalationsregel" in grund
    assert regel is not None and regel["id"] == "esk"


def test_automatische_regel_sendet() -> None:
    """Rang 4: erst hier geht wirklich etwas hinaus."""
    zustellart, grund, regel = _entscheiden(
        [_regel(id="auto", zustellart="automatisch")],
        "Wie ist das WLAN?",
        autoantwort_aktiv=True,
    )
    assert zustellart == "automatisch"
    assert grund is None
    assert regel is not None and regel["id"] == "auto"


def test_ohne_regel_bleibt_es_beim_entwurf() -> None:
    """Rang 5, die Vorgabe: eingeschalteter Schalter allein sendet nicht.

    Sonst würde das Einschalten des Schalters den ganzen Posteingang
    automatisieren — der Betrieb hat dann nur „grundsätzlich ja" gesagt, nicht
    „zu jedem Thema".
    """
    zustellart, _grund, _r = _entscheiden([], "Wie ist das WLAN?", autoantwort_aktiv=True)
    assert zustellart == "entwurf"


def test_reine_entwurfsregel_sendet_nicht() -> None:
    zustellart, _grund, regel = _entscheiden(
        [_regel(id="e1", zustellart="entwurf")],
        "Wie ist das WLAN?",
        autoantwort_aktiv=True,
    )
    assert zustellart == "entwurf"
    # Die Regel wird trotzdem benannt: sie hat den Text geprägt.
    assert regel is not None and regel["id"] == "e1"


# --- Der Regelblock im Prompt ----------------------------------------------
def test_eskalationsregel_steht_nicht_im_prompt() -> None:
    """Sie beschreibt, wann ein Mensch übernimmt — nicht, wie zu antworten ist.

    Als Anweisung im Prompt würde das Modell über die Eskalation schreiben,
    statt zu antworten.
    """
    from src.features.inbox.ki_antwort import _regelblock

    block = _regelblock(
        [
            _regel(anweisung="Sei knapp."),
            _regel(anweisung="Bei Beschwerden melden.", ist_eskalation=True),
        ]
    )
    assert "Sei knapp." in block
    assert "Bei Beschwerden melden." not in block


def test_regelblock_ist_leer_ohne_regeln() -> None:
    from src.features.inbox.ki_antwort import _regelblock

    assert _regelblock([]) == ""
    assert _regelblock(None) == ""


# --- Grenzfälle der Stichwortliste ------------------------------------------
@pytest.mark.parametrize(
    ("frage", "gesperrt"),
    [
        # Getrennte Verbform: „zahlen … zurück" ist Geld, „Weg zurück" nicht.
        ("Wann zahlen Sie das Geld zurück?", True),
        ("Bitte den Betrag zurück überweisen", True),
        ("Der Weg zurück zum Strand", False),
        ("Wie komme ich zurück zum Bahnhof?", False),
        ("Wann kommen Sie zurück?", False),
    ],
)
def test_zurueck_trifft_nur_bei_geld(frage: str, gesperrt: bool) -> None:
    """Ein blosses „zurück" hätte jede Wegbeschreibung zum Entwurf gemacht."""
    assert (gesperrtes_thema(frage) is not None) is gesperrt


@pytest.mark.parametrize(
    "frage",
    [
        # `w in s` (Rückrichtung) fing hier: „the" steckt in „theft",
        # „wir" in „buchen wir". Der Vergleich läuft deshalb nur noch in
        # einer Richtung.
        "Where is the nearest supermarket?",
        "Wann können wir anreisen?",
    ],
)
def test_kurze_woerter_loesen_keinen_fehlalarm_aus(frage: str) -> None:
    assert gesperrtes_thema(frage) is None
