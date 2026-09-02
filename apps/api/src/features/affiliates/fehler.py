"""Fachlicher Fehler des Partnerprogramms — eigenes Modul, damit Service-Mixins
ihn ohne Zirkelimport benutzen können."""

from __future__ import annotations


class AffiliateError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
