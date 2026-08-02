"""Zeitzonen-Auflösung des Posteingangs.

Eigenes Modul, damit `service.py` und `planung.py` denselben Helfer nutzen,
ohne Importzyklus.
"""
from datetime import tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .errors import InboxError


def zeitzone(name: str) -> tzinfo:
    """IANA-Zone → tzinfo. Eine unbekannte Zone ist ein Datenfehler und darf
    NICHT stillschweigend zu UTC werden (Wurzel 4) — sie verschöbe den Versand
    um Stunden, ohne dass es jemandem auffiele. Die DB weist unbekannte Zonen
    beim Speichern bereits ab (0258); das hier ist der zweite Riegel."""
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise InboxError(
            f"Unbekannte Zeitzone am Objekt: {name}", status_code=422
        ) from exc
