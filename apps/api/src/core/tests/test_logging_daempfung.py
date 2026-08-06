"""Fremdbibliotheken dürfen das Log nicht zumüllen.

DER ANLASS (06.08.2026): Bei der Fehlersuche am Airbnb-Rückweg bestand das
Worker-Log fast vollständig aus „HTTP Request: POST …/rpc/claim_jobs 200" —
dem Leerlauf-Takt der Warteschlange, mehrmals pro Sekunde. Die eine Zeile, auf
die es ankam (`airbnb_stammdaten_geschrieben`), war darin nicht auffindbar.
Ein Log, in dem man nichts findet, ist kein Log.
"""
from __future__ import annotations

import logging

from src.core.logging import configure_logging


def test_httpx_schweigt_auf_info() -> None:
    """Auf INFO protokolliert httpx sonst JEDE Anfrage."""
    configure_logging("INFO")
    assert logging.getLogger("httpx").level == logging.WARNING
    assert logging.getLogger("httpcore").level == logging.WARNING


def test_fehler_bleiben_sichtbar() -> None:
    """Gedämpft heißt nicht stumm: eine gescheiterte Anfrage muss man sehen."""
    configure_logging("INFO")
    assert logging.getLogger("httpx").isEnabledFor(logging.WARNING)
    assert logging.getLogger("httpx").isEnabledFor(logging.ERROR)


def test_daempfung_hebt_nie_an() -> None:
    """Die Dämpfung setzt auf WARNING — sie darf nie STRENGER werden.

    Bei `configure_logging("ERROR")` wäre ein Anheben auf WARNING das
    Gegenteil des Gewünschten: plötzlich stünden mehr Fremdzeilen im Log als
    verlangt.
    """
    configure_logging("ERROR")
    assert logging.getLogger("httpx").level == logging.ERROR


def test_eigene_logger_bleiben_unberuehrt() -> None:
    """Nur die genannten Fremdbibliotheken werden gedämpft."""
    configure_logging("INFO")
    assert logging.getLogger("src.features.channel_manager").level == logging.NOTSET
