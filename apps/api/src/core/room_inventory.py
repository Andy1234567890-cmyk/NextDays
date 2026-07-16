"""Verfügbarkeits-Modell: 1 Objekt = 1 buchbare Einheit (binär).

myNextDays führt EIN Modell für Ferienobjekte UND Hotels: jede `properties`-Zeile
ist genau eine buchbare Einheit (ein Zimmer bei Hotel ODER ein Ferienobjekt).
Verfügbarkeit ist binär (availability.status open/booked/blocked, 0/1 an Channex).
Es gibt KEINE Zimmerkategorien/room_types und keine count-basierte Verfügbarkeit
mehr (der frühere „Hotel-Container"-Zweig wurde zurückgebaut).

Diese beiden Funktionen bleiben als stabile No-Op-Fassade bestehen, damit die
(noch) aufrufenden Pfade nicht brechen, während der tote Hotel-Zweig kontrolliert
entfernt wird. Sie melden IMMER: keine Kategorien, kein Hotel-Modus.
"""
from __future__ import annotations

from typing import Any

from supabase import Client


def hotel_room_types(_db: Client, _property_id: str) -> list[dict[str, Any]]:
    """Immer leer — es gibt keine Zimmerkategorien mehr (1 Objekt = 1 Einheit)."""
    return []


def is_hotel_property(_db: Client, _property_id: str) -> bool:
    """Immer False — der count-basierte Hotel-Modus existiert nicht mehr."""
    return False
