"""Zentraler Schalter Ferienwohnung ↔ Hotel — die EINE Quelle der Wahrheit.

myNextDays ist ein System für zwei Anbietertypen. Das Verfügbarkeits-Modell
verzweigt NICHT über ein Typ-Flag, sondern über die EXISTENZ von room_types-
Zeilen einer Property (0140):

  - keine room_types-Zeile  → Ferienvermietung: binäres availability-Modell
    (eine Einheit je Objekt, status open/booked/blocked, 0/1 an Channex).
  - ≥1 room_types-Zeile     → Hotel: Verfügbarkeit als ZAHL freier Zimmer je
    Zimmerkategorie (room_type_availability.booked_count, count_of_rooms − booked).

Alle Lese-/Schreibpfade der Verfügbarkeit fragen HIER, ob eine Property im
Hotel-Modus ist, statt die Regel je Aufrufstelle neu zu erfinden. So bleibt das
Ferienwohnungs-Verhalten unberührt, solange keine Kategorie angelegt ist.
"""
from __future__ import annotations

from typing import Any

from supabase import Client


def hotel_room_types(db: Client, property_id: str) -> list[dict[str, Any]]:
    """Zimmerkategorien einer Property (leer = Ferienvermietung/Single-Unit).

    Rückgabe pro Kategorie: id, title, count_of_rooms, occ_* — genug für den
    Availability-/Channex-Push. Sortiert nach position (Editor-Reihenfolge)."""
    res = (
        db.table("room_types")
        .select("id, title, count_of_rooms, occ_adults, occ_children, "
                "occ_infants, default_occupancy, position")
        .eq("property_id", property_id)
        .order("position")
        .order("created_at")
        .execute()
    )
    return res.data or []


def is_hotel_property(db: Client, property_id: str) -> bool:
    """True, wenn die Property mindestens eine Zimmerkategorie hat (Hotel-Modus).

    Bewusst über die Existenz einer room_types-Zeile — nicht über einen Typ auf
    tenant/property. Ein Tenant kann Hotels UND Ferienwohnungen führen; der Modus
    ist eine Eigenschaft des Objekts, nicht des Kontos."""
    res = (
        db.table("room_types")
        .select("id")
        .eq("property_id", property_id)
        .limit(1)
        .execute()
    )
    return bool(res.data)
