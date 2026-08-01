"""Fehlertyp des properties-Slice.

Eigenes Modul, damit service.py und rooms.py ihn beide nutzen koennen, ohne
sich gegenseitig zu importieren.
"""
from __future__ import annotations


class PropertyError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
