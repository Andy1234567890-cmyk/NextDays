"""Welche Huellen beim Entfernen eines Bausteins mitgehen.

WARUM DAS EIN EIGENER TEST IST: Loeschen ist die eine Operation, die man nicht
nachtraeglich untersuchen kann — die Zeilen sind dann weg. Beide Regeln hier
stammen aus realen Fehlern, und beide sind Mengenlogik, die sich einzeln
pruefen laesst. Bis zum 10.09.2026 stand sie als vierfach verschachtelte
Schleife mitten in `replace_blocks` (492 Zeilen); sie steht jetzt in
`baum.py`, wo die Eltern-Kind-Beziehungen des Slices ohnehin zu Hause sind.
"""
from __future__ import annotations

from src.features.site_config.baum import huellen_kaskade


def test_leere_huelle_geht_mit() -> None:
    """Spalte und Abschnitt fallen, wenn nichts mehr darin bleibt."""
    eltern = {"w1": "sp1", "sp1": "sec1", "sec1": None}
    weg = huellen_kaskade({"w1"}, eltern, set())
    assert weg == {"w1", "sp1", "sec1"}


def test_huelle_mit_verbleibendem_baustein_bleibt() -> None:
    """Eine Spalte mit zwei Bausteinen, von denen einer bleibt.

    Sonst risse das Entfernen des einen den anderen mit — dasselbe `cascade`,
    das sonst nuetzt, waere dann der Schaden.
    """
    eltern = {"w1": "sp1", "w2": "sp1", "sp1": "sec1", "sec1": None}
    weg = huellen_kaskade({"w1"}, eltern, set())
    assert weg == {"w1"}, "sp1 traegt noch w2"


def test_zielspalte_eines_gesendeten_bausteins_ist_tabu() -> None:
    """Der Fall, der beim Verschieben zwischen zwei Spalten entsteht.

    Ohne diese Regel riss das Aufraeumen genau die Spalte weg, in die der
    Kunde gerade etwas gezogen hatte: `parent_id` zeigte danach ins Leere.
    """
    eltern = {"w1": "sp1", "sp1": "sec1", "sec1": None}
    # sp1 ist Ziel eines gesendeten Bausteins, obwohl ihr Inhalt entfaellt.
    weg = huellen_kaskade({"w1"}, eltern, {"sp1"})
    assert weg == {"w1"}, "die Zielspalte darf nicht fallen"


def test_abschnitt_bleibt_wenn_eine_zweite_spalte_bleibt() -> None:
    """Nur die leere Spalte faellt, der Abschnitt traegt noch die zweite."""
    eltern = {
        "w1": "sp1", "sp1": "sec1",
        "w2": "sp2", "sp2": "sec1",
        "sec1": None,
    }
    weg = huellen_kaskade({"w1"}, eltern, set())
    assert weg == {"w1", "sp1"}
    assert "sec1" not in weg


def test_baustein_ohne_huelle_geht_allein() -> None:
    """Ein Baustein direkt auf der Seite hat nichts mitzunehmen."""
    assert huellen_kaskade({"w1"}, {"w1": None}, set()) == {"w1"}


def test_beide_spalten_leer_nimmt_den_abschnitt_mit() -> None:
    """Erst wenn ALLE Kinder gehen, faellt auch der Abschnitt."""
    eltern = {
        "w1": "sp1", "sp1": "sec1",
        "w2": "sp2", "sp2": "sec1",
        "sec1": None,
    }
    weg = huellen_kaskade({"w1", "w2"}, eltern, set())
    assert weg == {"w1", "w2", "sp1", "sp2", "sec1"}
