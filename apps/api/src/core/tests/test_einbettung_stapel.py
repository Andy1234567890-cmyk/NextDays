"""Tests der Stapelbildung für Einbettungen.

WARUM DIESE DATEI EXISTIERT: Am 11.09.2026 brach der Aufbaulauf mit HTTP 400
ab — „input token count is 22903 but the model supports up to 20000". Nichts
am Code hatte sich geändert; gewachsen waren die TEXTE (die Funktionsseiten
gingen von ~680 auf ~2000 Zeichen, weil der Sammler endlich die richtigen
Felder las).

Die Stapelbildung zählte Stücke, das Modell zählt Token. Eine feste Stückzahl
kann diese Grenze nicht treffen: 32 kurze Texte liegen weit darunter, 32 lange
weit darüber. Der Fehler ist deshalb nicht „wir hatten Pech mit der Größe",
sondern „die Einheit war falsch" — und er kommt beim nächsten Wachstum der
Texte wieder, wenn ihn nichts festhält.
"""

from __future__ import annotations

from src.core.ki.einbettung import (
    MAX_ZEICHEN_JE_AUFRUF,
    STAPEL_GROESSE,
    _stapeln,
)


def test_kurze_texte_fuellen_bis_zur_stueckzahl() -> None:
    """Bei kurzen Texten bleibt die Stückzahl die bindende Grenze."""
    stapel = _stapeln(["kurz"] * (STAPEL_GROESSE * 2 + 5))

    assert len(stapel[0]) == STAPEL_GROESSE
    assert len(stapel[1]) == STAPEL_GROESSE
    assert len(stapel[2]) == 5


def test_lange_texte_brechen_vor_der_stueckzahl() -> None:
    """Der reale Fehlerfall: 32 lange Texte sprengen die Token-Grenze.

    Hier greift die Zeichensumme, bevor die Stückzahl erreicht ist.
    """
    lang = "x" * 8000
    stapel = _stapeln([lang] * STAPEL_GROESSE)

    assert len(stapel) > 1
    assert all(len(s) < STAPEL_GROESSE for s in stapel)


def test_kein_stapel_ueberschreitet_die_zeichengrenze() -> None:
    """Die Zusage, auf die alles andere aufbaut."""
    gemischt = ["x" * 8000, "kurz", "y" * 5000, "z" * 7900, "noch kurz"] * 20
    for s in _stapeln(gemischt):
        assert sum(len(t) for t in s) <= MAX_ZEICHEN_JE_AUFRUF or len(s) == 1


def test_kein_text_geht_verloren() -> None:
    """Reihenfolge und Vollständigkeit — sonst verschieben sich die Vektoren.

    Die Zuordnung Vektor→Wissensstück läuft über die POSITION. Ein verlorener
    oder vertauschter Text hieße: jeder Artikel danach bekommt den Vektor
    seines Nachbarn, und die Suche liefert stillschweigend das Falsche.
    """
    texte = [f"text-{i}-{'x' * (i * 137 % 6000)}" for i in range(97)]
    zurueck = [t for s in _stapeln(texte) for t in s]

    assert zurueck == texte


def test_ein_einzelner_langer_text_bekommt_seinen_eigenen_aufruf() -> None:
    """Ein Text über der Aufrufgrenze darf nicht stillschweigend entfallen."""
    riese = "x" * (MAX_ZEICHEN_JE_AUFRUF + 1000)
    stapel = _stapeln(["kurz", riese, "auch kurz"])

    assert [riese] in stapel
    assert sum(len(s) for s in stapel) == 3


def test_leere_eingabe_ergibt_keinen_aufruf() -> None:
    """Sonst ginge ein leerer Stapel an Vertex — 400 ohne Erkenntnisgewinn."""
    assert _stapeln([]) == []
