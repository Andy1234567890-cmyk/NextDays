"""Fehlertyp des Posteingang-Slices.

Eigenes Modul, damit `service.py` und `planung.py` ihn teilen können, ohne
einen Importzyklus zu bauen. `from .service import InboxError` funktioniert
weiterhin — der Service exportiert ihn erneut.
"""


class InboxError(Exception):
    """Fachlicher Fehler des Posteingangs (wird im Router zu HTTP übersetzt)."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
