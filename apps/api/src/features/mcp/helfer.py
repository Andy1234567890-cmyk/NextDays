"""Kleine Helfer der MCP-Werkzeuge.

Eigene Datei, weil `tools.py` und `stammdaten.py` sie beide brauchen. Ein
Import von `stammdaten` nach `tools` wäre ein Ringschluss (tools importiert
das Mixin aus stammdaten), deshalb liegen sie darunter.
"""
from __future__ import annotations

from typing import Any

from pydantic import ValidationError


def _validierung_lesbar(exc: ValidationError) -> str:
    """Pydantic-Fehler in einen Satz, den ein Modell verwerten kann.

    Die Rohausgabe nennt Typen und interne Pfade; hier steht, WELCHES Feld
    falsch ist und warum. Ein Modell, das „ungültige Eingabe" liest, rät beim
    nächsten Versuch — eines, das „max_guests: darf höchstens 99 sein" liest,
    korrigiert gezielt.
    """
    teile = []
    for fehler in exc.errors()[:5]:
        feld = ".".join(str(p) for p in fehler.get("loc", ())) or "?"
        teile.append(f"{feld}: {fehler.get('msg', 'ungültig')}")
    return "Eingabe abgelehnt — " + "; ".join(teile)


def _pflicht(args: dict[str, Any], feld: str) -> str:
    """Pflichtargument lesen; leer ist ein Fehler, kein stiller Ersatzwert."""
    wert = str(args.get(feld) or "").strip()
    if not wert:
        raise ValueError(f"{feld} fehlt")
    return wert
