"""Standort-Genauigkeit zwischen Airbnb und der Standort-Maske abgleichen.

Der Schalter „Genauen Standort anzeigen" (Standort-Maske,
`type_attributes.location.showPreciseLocation`) war eine Insel: er wurde
gespeichert und nirgends gelesen. Airbnb führt dasselbe als
`display_exact_location_to_guest` am Listing. Hier der Hinweg (Airbnb → Maske);
der Rückweg (Maske → Airbnb) steht in `airbnb_direkt.airbnb_stammdaten_schreiben`,
ausgelöst über `properties.airbnb_nachziehen`.

Eigenes Modul, weil `airbnb_objekt_abruf.py` an der 1500-Zeilen-Grenze steht.
"""
from __future__ import annotations

from typing import Any

from . import airbnb_listing_import as ali


def standort_uebernehmen(
    listing: dict[str, Any], alt: dict[str, Any],
    neu: dict[str, Any], gesetzt: list[str],
) -> None:
    """Airbnbs Stand in `location.showPreciseLocation` spiegeln.

    ABGEGLICHEN, nicht nur einmal befüllt (Wurzel 1): ein Bool kennt kein
    „leer", und wer „alles aus Airbnb" abruft, will Airbnbs Stand — der eigene
    Schalter geht danach über den Rückweg wieder dorthin. `type_attributes.
    location` trägt daneben Entfernungen, Kartenbild und Wegbeschreibung; es
    wird ergänzt, nie ersetzt.
    """
    wert = ali.standort_genauigkeit(listing)
    if wert is None:
        return
    location = alt.get("location")
    location = dict(location) if isinstance(location, dict) else {}
    if location.get("showPreciseLocation") is wert:
        return
    location["showPreciseLocation"] = wert
    neu["location"] = location
    gesetzt.append("standortGenauigkeit")
