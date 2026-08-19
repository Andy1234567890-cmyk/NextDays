"""Fehlertyp des booking_engine-Slice.

Eigene Datei, damit ihn beide Hälften des Buchungswegs importieren können, ohne
einen Zirkel zu bauen: `absicht.py` (Zahlung starten/einlösen) und `service.py`
(Prüfungen, Preis) brauchen ihn gleichermassen, und `service.py` importiert
seinerseits `absicht.py`.
"""
from __future__ import annotations


class BookingEngineError(Exception):
    """Fachlicher Fehler der öffentlichen Buchungsstrecke (mit HTTP-Status)."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
