"""Objektfelder, die NUR über Airbnbs eigene API zurückgehen.

Der Channex-Content-Sync deckt sie nicht ab, aus zwei verschiedenen Gründen:

* **Ausstattung** — Channex trägt nur, was einen Eintrag in seinem
  Facility-Katalog hat. Ein großer Teil der Airbnb-Merkmale (Parkvarianten,
  Hängematte, Mülltrennung, Langzeitaufenthalte …) hat dort keine UUID und
  fiele beim Sync still unter den Tisch: die Auswahl sähe bei uns gespeichert
  aus und käme bei Airbnb nie an.
* **Fläche, Kapazität, Standort-Genauigkeit** — Channex' ausgehender Payload
  besteht ausschließlich aus Verfügbarkeit, Preis und Restriktionen. Wir HOLEN
  alle drei aber von Airbnb (`property_details.listing_size`,
  `person_capacity`, `display_exact_location_to_guest`), also muss eine
  Korrektur bei uns auch dorthin zurück, sonst ist die Maske eine Einbahnstraße.

Eigenes Modul, weil `service.py` an der 1500-Zeilen-Grenze steht und diese
Anstöße eine geschlossene Sache sind: ein Feld dazu heißt eine Zeile hier.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from supabase import Client

from src.features.channel_manager.airbnb_direkt import standort_schalter
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


def standort_genauigkeit_geaendert(
    alte_attrs: Mapping[str, Any] | None, changes: Mapping[str, Any]
) -> bool:
    """Hat sich der Schalter „Genauen Standort anzeigen" geändert?

    Er liegt in `type_attributes.location.showPreciseLocation` — eine Spalte,
    die bei JEDEM Speichern der Maske im Update steht. Der Stammdaten-Job soll
    aber nur laufen, wenn sich der Wert wirklich geändert hat; sonst ginge bei
    jedem Klick auf „Speichern" ein Aufruf an Airbnb. Konservativ: ohne
    ladbaren Alt-Stand gilt „geändert" (Wurzel 1 — lieber ein Job zu viel als
    ein Airbnb-Listing, das den falschen Standort zeigt).
    """
    neu_attrs = changes.get("type_attributes")
    if not isinstance(neu_attrs, dict):
        return False
    neu_wert = standort_schalter(neu_attrs)
    if neu_wert is None:
        return False
    if not isinstance(alte_attrs, dict):
        return True
    return standort_schalter(alte_attrs) is not neu_wert


def airbnb_direkt_nachziehen(
    db: Client, tenant_id: str, property_id: str, changes: Mapping[str, Any],
    alte_attrs: Mapping[str, Any] | None = None,
) -> list[str]:
    """Für die geänderten Spalten die passenden Direkt-Jobs einreihen.

    `alte_attrs` ist der Stand von `type_attributes` VOR dem Update — nur damit
    lässt sich erkennen, ob der Standort-Schalter darin umgelegt wurde.

    Rückgabe: die Namen der eingereihten Jobs (leer = nichts betroffen) — so
    kann der Aufrufer es loggen, ohne die Zuordnung zu kennen.
    """
    geaendert: Iterable[str] = changes.keys()
    eingereiht: list[str] = []
    for felder, einreihen in _AUSLOESER:
        if felder & set(geaendert):
            einreihen(db, tenant_id, property_id)
            eingereiht.append(einreihen.__name__.removeprefix("try_enqueue_"))
    if (
        "airbnb_stammdaten" not in eingereiht
        and standort_genauigkeit_geaendert(alte_attrs, changes)
    ):
        # Derselbe Job wie bei Fläche/Kapazität — er sendet ohnehin den vollen
        # Soll-Stand aller drei Felder.
        _AUSLOESER[1][1](db, tenant_id, property_id)
        eingereiht.append("airbnb_stammdaten")
    return eingereiht
