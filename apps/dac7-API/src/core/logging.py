"""Logging der Versand-API — bewusst KEINE Schwesterdatei.

`apps/api/src/core/logging.py` und `apps/public-api/src/core/logging.py`
sind byte-identische Kopien, deren Gleichheit ein CI-Job erzwingt. Eine
dritte Kopie haette diesen Job gebrochen, ohne etwas zu gewinnen: Dieser
Dienst braucht die dortige Maskierung von E-Mail und Telefon nicht, weil
er ueberhaupt keine Personendaten protokolliert.

WAS HIER NIE INS LOG DARF
=========================
Eine DAC7-Datei enthaelt CPR-Nummern, Namen, Anschriften und
Bankverbindungen. Protokolliert werden deshalb nur Kennzahlen —
Quittungsnummer, Ziel, Pruefsumme, Ergebnis. Nie ein Feldwert, nie ein
Ausschnitt der Datei, nie der Dateiinhalt bei einem Fehler.
"""
from __future__ import annotations

import logging
import sys

import structlog


def configure_logging(*, als_json: bool = False) -> None:
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=logging.INFO)
    renderer = (
        structlog.processors.JSONRenderer()
        if als_json
        else structlog.dev.ConsoleRenderer()
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)  # type: ignore[no-any-return]
