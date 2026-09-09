"""Fehlertyp des Eigentümer-Chats.

Eigener Typ statt `HTTPException`, damit beide aufrufenden Slices (`inbox`,
`public_portal`) ihn in ihre eigene Fehlerform übersetzen können — und damit
ein `except` im Chat-Kern nie versehentlich eine fremde Ausnahme schluckt
(Wurzel 5).
"""
from __future__ import annotations


class OwnerChatError(Exception):
    """Fachlicher Fehler mit HTTP-Status."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
