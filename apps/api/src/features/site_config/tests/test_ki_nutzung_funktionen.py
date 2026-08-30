"""Der Funktionsname steht an ZWEI Stellen — dieser Test hält sie zusammen.

``ki_nutzung.FUNKTIONEN`` und der check-Constraint auf ``site_ai_usage.funktion``
müssen deckungsgleich sein. Laufen sie auseinander, passiert nichts Lautes:
``_schreiben`` steigt bei unbekanntem Namen aus, BEVOR es den Insert versucht.
Der Zähler bewegt sich dann nie, ``deckel_pruefen`` vergleicht dauerhaft 0 gegen
die Grenze, und der Betrieb liest „0 von 200 verbraucht", während jeder Aufruf
bezahlt wird.

Dieser Fehler ist bereits ZWEIMAL passiert (0478 für ``seite_uebersetzen``,
0492 für ``gast_antwort``) — beide Male, weil eine Änderung nur eine der beiden
Stellen anfasste. Er wiederholt sich, solange nichts ihn fängt.

Der Test liest den Constraint aus der JÜNGSTEN Migration, die ihn definiert,
nicht aus einer gepflegten Dateiliste. Eine Liste wäre eine dritte Stelle, die
mitgepflegt werden muss — also derselbe Fehler eine Ebene höher.
"""

from __future__ import annotations

import re
from pathlib import Path

from src.features.site_config.ki_nutzung import FUNKTIONEN

# tests/ → site_config/ → features/ → src/ → api/ → apps/ → Repo-Wurzel
MIGRATIONS_DIR = Path(__file__).resolve().parents[6] / "supabase" / "migrations"

# Der Constraint wird per `drop`/`add` ersetzt, nicht ergänzt — es zählt also
# ausschließlich die zuletzt angewendete Definition.
_CONSTRAINT = re.compile(
    r"add\s+constraint\s+site_ai_usage_funktion_check\s+check\s*\((.*?)\n\s*\);",
    re.IGNORECASE | re.DOTALL,
)


def _funktionen_aus_migration() -> set[str]:
    """Die erlaubten Namen aus der jüngsten Migration, die den Check setzt."""
    treffer: list[tuple[str, str]] = []
    for pfad in sorted(MIGRATIONS_DIR.glob("*.sql")):
        sql = pfad.read_text(encoding="utf-8")
        gefunden = _CONSTRAINT.search(sql)
        if gefunden:
            treffer.append((pfad.name, gefunden.group(1)))
    assert treffer, "Keine Migration definiert site_ai_usage_funktion_check."
    _, block = treffer[-1]
    # Kommentarzeilen raus, bevor die Namen gelesen werden: ein '--'-Kommentar
    # kann selbst einen Namen in Anführungszeichen nennen.
    ohne_kommentar = re.sub(r"--[^\n]*", "", block)
    return set(re.findall(r"'([a-z_]+)'", ohne_kommentar))


def test_konstante_deckt_constraint_exakt_ab() -> None:
    """Beide Mengen sind gleich — kein Name mehr, kein Name weniger.

    Ein Name nur in der Konstante heißt: der Insert scheitert live mit 23514.
    Ein Name nur im Constraint heißt: die Funktion zählt still nicht mit.
    """
    assert set(FUNKTIONEN) == _funktionen_aus_migration()


def test_gastantwort_ist_enthalten() -> None:
    """Der Name, den der Posteingang benutzt (`ki_antwort.FUNKTION`)."""
    from src.features.inbox.ki_antwort import FUNKTION

    assert FUNKTION in FUNKTIONEN
