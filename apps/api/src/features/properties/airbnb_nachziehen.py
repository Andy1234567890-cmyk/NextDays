"""Objektfelder, die NUR über Airbnbs eigene API zurückgehen.

Der Channex-Content-Sync deckt sie nicht ab, aus zwei verschiedenen Gründen:

* **Ausstattung** — Channex trägt nur, was einen Eintrag in seinem
  Facility-Katalog hat. Ein großer Teil der Airbnb-Merkmale (Parkvarianten,
  Hängematte, Mülltrennung, Langzeitaufenthalte …) hat dort keine UUID und
  fiele beim Sync still unter den Tisch: die Auswahl sähe bei uns gespeichert
  aus und käme bei Airbnb nie an.
* **Fläche und Kapazität** — Channex' ausgehender Payload besteht ausschließlich
  aus Verfügbarkeit, Preis und Restriktionen. Wir HOLEN beides aber von Airbnb
  (`property_details.listing_size`, `person_capacity`), also muss eine Korrektur
  bei uns auch dorthin zurück, sonst ist die Maske eine Einbahnstraße.

Eigenes Modul, weil `service.py` an der 1500-Zeilen-Grenze steht und diese
Anstöße eine geschlossene Sache sind: ein Feld dazu heißt eine Zeile hier.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from supabase import Client

from src.jobs.queue import (
    try_enqueue_airbnb_ausstattung,
    try_enqueue_airbnb_stammdaten,
)

# Welche geänderte Spalte welchen Direkt-Job auslöst. Die Felder eines Jobs
# stehen zusammen, weil er ohnehin den vollen Soll-Stand sendet — zwei
# geänderte Spalten sind ein Job, nicht zwei.
_AUSLOESER: tuple[tuple[frozenset[str], Any], ...] = (
    (frozenset({"amenities", "room_amenities"}), try_enqueue_airbnb_ausstattung),
    (
        frozenset({"size_value", "size_unit", "max_guests"}),
        try_enqueue_airbnb_stammdaten,
    ),
)


def airbnb_direkt_nachziehen(
    db: Client, tenant_id: str, property_id: str, changes: Mapping[str, Any]
) -> list[str]:
    """Für die geänderten Spalten die passenden Direkt-Jobs einreihen.

    Rückgabe: die Namen der eingereihten Jobs (leer = nichts betroffen) — so
    kann der Aufrufer es loggen, ohne die Zuordnung zu kennen.
    """
    geaendert: Iterable[str] = changes.keys()
    eingereiht: list[str] = []
    for felder, einreihen in _AUSLOESER:
        if felder & set(geaendert):
            einreihen(db, tenant_id, property_id)
            eingereiht.append(einreihen.__name__.removeprefix("try_enqueue_"))
    return eingereiht
