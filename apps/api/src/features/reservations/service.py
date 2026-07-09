"""Reservations-Service: Fassade.

Komponiert Schreib- und Lesepfad zu `ReservationsService`. Nach Domäne
aufgeteilt (siehe `_base.py`, `reads.py`, `writes.py`, `property_stats.py`) —
die öffentliche Oberfläche (Klassenname, Methodennamen) bleibt unverändert, alle
Aufrufstellen (Router, Tests) importieren weiter aus diesem Modul.

`ReservationError`, `_map_booking_conflict` und `load_guest_mask` werden hier
re-exportiert, damit Router und Tests sie weiter aus `service` importieren.
Zum Patchen der Maske ist `_base.load_guest_mask` der kanonische Ort (writes/
reads lösen sie von dort auf).
"""
from __future__ import annotations

from ._base import (
    ReservationError,
    _map_booking_conflict,
    load_guest_mask,
)
from .reads import ReadsMixin
from .writes import WritesMixin

__all__ = [
    "ReservationError",
    "ReservationsService",
    "_map_booking_conflict",
    "load_guest_mask",
]


class ReservationsService(WritesMixin, ReadsMixin):
    """Reservations-Slice: Schreib- + Lesepfad über der geteilten Basis."""
