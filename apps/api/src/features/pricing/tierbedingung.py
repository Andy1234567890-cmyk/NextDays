"""Wann eine Gebühr an ein mitgebrachtes Tier gebunden ist.

Eigene Datei, weil die Frage zur PREISBERECHNUNG gehört und nicht zur
Objektverwaltung: `properties/gebuehren.py` validiert und speichert Gebühren
(900 Zeilen mit DB-Zugriff), der Resolver rechnet sie. Die öffentliche API hat
den Resolver als Kopie, aber kein `features/properties` — ein Import von dort
würde sie beim Start brechen. Deshalb dieselbe Lösung wie bei den
Zusatzleistungen (`features/addons/pricing.py`): eine kleine Schwesterdatei
ohne eigene Abhängigkeiten.
"""
# SCHWESTERDATEI — byte-identisch in beiden Bäumen halten:
#     apps/api/src/features/pricing/tierbedingung.py
#     apps/public-api/src/features/pricing/tierbedingung.py
# Drift heißt: die Preisvorschau der öffentlichen API berechnet einem Gast ohne
# Hund eine Haustiergebühr, die das Dashboard nicht berechnet — zwei Preise für
# denselben Aufenthalt.
from __future__ import annotations

from typing import Any

# Gebührenarten der Kategorie „pet". Gegenstück: die Einträge mit Zielwert
# "pet" in `properties.gebuehren.FEE_TYPE_CATEGORY` (`pet_fee`) und
# `FEE_TYPE_ALTBESTAND` (`pet`). Bewusst als eigene Menge und nicht per Import:
# siehe Modul-Kopf. Kommt eine dritte Tier-Gebührenart hinzu, gehört sie hier
# UND dort hinein — `test_tierbedingung_deckt_alle_pet_arten` schlägt sonst fehl.
PET_FEE_TYPES = frozenset({"pet_fee", "pet"})


def ist_tierbedingt(fee: dict[str, Any]) -> bool:
    """Greift diese Gebühr NUR, wenn der Gast ein Tier mitbringt?

    Die Bedingung hängt an der ART, nicht an der Berechnungsbasis. Das ist der
    Unterschied zu `PET_BASIS` (`per_pet_stay`): die MULTIPLIZIERT mit der
    Tierzahl (zwei Hunde = doppelt) und wird dadurch bei null Tieren nebenbei
    null. Eine Haustier-PAUSCHALE (`per_stay`, „150 je Aufenthalt, egal wie
    viele Tiere") multipliziert nichts — sie lief deshalb bei JEDER Buchung mit,
    auch ohne Tier.

    Live gemessen am 23.08.2026 gegen die Server-Datenbank: alle NEUN gepflegten
    Haustiergebühren stehen als `feeType: pet_fee`, `basis: per_stay`, 150 DKK.
    Jeder Gast ohne Hund zahlte sie mit. Entstanden sind sie nicht durch
    Handeingabe, sondern durch den Airbnb-Import: dessen `PER_BOOKING` wird zu
    `per_stay` (`channel_manager/airbnb_gebuehren_import.py`). Die Pauschale ist
    also der NORMALFALL, nicht der Ausnahmefall, den man wegkonfiguriert.

    Deshalb kein Schalter „nur mit Tier" an der Gebühr: eine Haustiergebühr ohne
    Tier ist fachlich in jeder Basis falsch. Ein Schalter würde die richtige
    Antwort zur Option machen und den Bestand falsch lassen, bis jemand ihn
    neunmal setzt. Die Umkehrung — „Haustiergebühr auch ohne Tier erheben" — hat
    keinen fachlichen Fall.

    Eine Gebühr ohne `feeType` (Altbestand) ist NICHT tierbedingt: welche Art
    sie hat, ist unbekannt, und aus einem Namen wie „Hundegebühr" eine Art zu
    raten wäre ein erfundener Wert (Wurzel 4). Sie verhält sich wie bisher.
    """
    return str(fee.get("feeType") or "").strip() in PET_FEE_TYPES
