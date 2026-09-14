"""Gemeinsame Bausteine des Bereichs »zahlungen«: Fehlerklasse, Zahl-/Datums-
Helfer, Logger. Liegen hier, weil `service.py` und `verknuepfungen.py` sie
beide brauchen und keiner den anderen importieren darf (Mixin-Schnitt)."""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from postgrest.exceptions import APIError

from src.core.logging import get_logger

log = get_logger("nextdays.buchhaltung.zahlungen")

ZWEI_STELLEN = Decimal("0.01")
UNIQUE_VIOLATION = "23505"
UNDEFINED_TABLE = "42P01"


class ZahlungenError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def nicht_gefunden(was: str) -> ZahlungenError:
    return ZahlungenError(f"{was} nicht gefunden.", status_code=404)


def q(betrag: Decimal) -> Decimal:
    return betrag.quantize(ZWEI_STELLEN, rounding=ROUND_HALF_UP)


def dec(wert: object) -> Decimal:
    if wert is None or wert == "":
        return Decimal("0")
    return Decimal(str(wert))


def datum(wert: object) -> date | None:
    if wert is None or wert == "":
        return None
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert)[:10])


def ist_unique_verletzung(exc: APIError) -> bool:
    return getattr(exc, "code", None) == UNIQUE_VIOLATION


def ist_fehlende_tabelle(exc: APIError) -> bool:
    return getattr(exc, "code", None) == UNDEFINED_TABLE
