"""Die Fehlerklasse des Slice.

Eigenes Modul, weil sie von ALLEN Teilen gebraucht wird — Service, Mixins,
Weiterleitungen, Router. Lag sie weiter in `service.py`, entstünde ein
Zirkelimport, sobald ein Mixin sie braucht: `service` importiert `mediathek`,
`mediathek` importiert `service`.

`service.py` re-exportiert sie, damit die bestehenden Importe
(`from .service import SiteConfigError`) weiter gelten. Ein Modul umzubenennen
und dabei zwanzig Importzeilen anzufassen wäre Arbeit ohne Gewinn.
"""

from __future__ import annotations


class SiteConfigError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
