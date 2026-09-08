"""Fehlertypen des whatsapp-Slice und die Übersetzung Client → Service.

Eigenes Modul, damit Client, Service und Router dieselben Typen benutzen, ohne
sich gegenseitig zu importieren — und damit ``service.py`` unter der
1500-Zeilen-Grenze bleibt.

Der Kern ist ``als_service_fehler``: es hält Metas Drosselung als eigenen Typ
am Leben. Ohne diese eine Stelle müsste jeder der sieben Aufrufer den Sonderfall
kennen, und der erste, der es vergisst, macht aus der Drosselung wieder einen
gewöhnlichen 502 (Wurzel 5 — ein Kontroll-Signal nicht verschlucken).
"""
from __future__ import annotations

from .client import WhatsAppError, WhatsAppRateLimitError


class WhatsAppServiceError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class WhatsAppRateLimitServiceError(WhatsAppServiceError):
    """Metas Drosselung, auf Service-Ebene weitergereicht.

    Eigene Klasse, damit der Router einen ``Retry-After``-Header setzen kann
    und ein späterer Job „später nochmal" von „geht nie" unterscheidet — ein
    Textvergleich auf die Fehlermeldung wäre dafür die falsche Kupplung.
    """

    def __init__(self, message: str, *, sperrdauer_min: int | None = None) -> None:
        super().__init__(message, status_code=429)
        self.sperrdauer_min = sperrdauer_min


def als_service_fehler(exc: WhatsAppError) -> WhatsAppServiceError:
    """Client-Fehler in den Service-Fehler übersetzen, Drosselung erhalten."""
    if isinstance(exc, WhatsAppRateLimitError):
        return WhatsAppRateLimitServiceError(
            exc.message, sperrdauer_min=exc.sperrdauer_min
        )
    return WhatsAppServiceError(exc.message, status_code=exc.status_code)
