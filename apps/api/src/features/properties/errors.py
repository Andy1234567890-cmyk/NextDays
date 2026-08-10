"""Fehlertyp des properties-Slice.

Eigenes Modul, damit service.py und rooms.py ihn beide nutzen koennen, ohne
sich gegenseitig zu importieren.
"""
from __future__ import annotations

from typing import Any


class PropertyError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt.

    `details` traegt strukturierte Zusatzdaten zum Fehler, wenn die Meldung
    allein dem Nutzer nicht weiterhilft: beim Vertragsende (0355) die Liste der
    Buchungen, die dem Enddatum im Weg stehen — er muss wissen WELCHE, um
    entscheiden zu koennen. Default `None`, kein leeres Dict (Wurzel 4): der
    Normalfall hat keine Details, und ein leeres Dict im JSON sieht aus wie
    „geprueft, nichts gefunden".
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details
