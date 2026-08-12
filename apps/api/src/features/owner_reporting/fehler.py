"""Der eine Fehlertyp des Slice.

Eigenes Modul, damit ihn alle Teile (Service, Empfänger, Auswertung) benutzen
können, ohne sich gegenseitig zu importieren. Ein zweiter Fehlertyp „nur für
dieses Modul" wäre der Anfang davon, dass der Router zwei Sorten fangen muss —
und beim dritten eine davon vergisst (Wurzel 5).
"""
from __future__ import annotations


class ReportingError(Exception):
    """Fachlicher Fehler mit HTTP-Status — vom Router in eine Antwort gewandelt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
