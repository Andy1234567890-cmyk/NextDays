"""Einheiten eines Objekts — geteilt über alle Slices.

Ein Objekt ist der Einheiten-TYP, darunter hängen seine identischen Einheiten
(`property_units`, 0265). Der Kalender führt die Belegung seit 0266 JE EINHEIT:
eine Zeile in `availability` gehört genau einer Einheit.

Damit muss jeder Schreibpfad wissen, für welche Einheiten er schreibt. Ein
Sperr-Tag des ganzen Typs (Stop-Sell, Wartung, externer Kalender) betrifft ALLE
Einheiten und wird deshalb zu je einer Zeile pro Einheit aufgefächert — bei
einem Objekt mit einer Einheit ist das genau die eine Zeile wie bisher. Eine
Buchung dagegen belegt EINE Einheit und schreibt nur deren Zeile.

Hier steht beides an einer Stelle, damit die Regel nicht in neun Slices je
eigenständig nachgebaut (und irgendwo vergessen) wird.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

# Konflikt-Ziel aller availability-Upserts. Seit 0266 identifiziert erst das
# Tripel eine Zeile eindeutig.
AVAILABILITY_CONFLICT = "property_id,unit_id,date"


def einheiten_ids(db: Client, property_id: str, tenant_id: str | None = None) -> list[str]:
    """IDs der Einheiten eines Objekts, stabil nach Position sortiert.

    `tenant_id` ist optional: mehrere Aufrufer haben an der Stelle nur die
    property_id zur Hand, und die Einheit hängt ohnehin eindeutig am Objekt.
    """
    query = (
        db.table("property_units")
        .select("id, position")
        .eq("property_id", property_id)
    )
    if tenant_id:
        query = query.eq("tenant_id", tenant_id)
    rows = query.order("position").execute().data or []
    return [str(r["id"]) for r in rows]


def je_einheit(
    db: Client, property_id: str, rows: list[dict[str, Any]],
    *, tenant_id: str | None = None, unit_id: str | None = None,
) -> list[dict[str, Any]]:
    """availability-Zeilen um die Einheit ergänzen.

    `unit_id` gesetzt → genau diese Einheit (Buchung). Sonst gilt die Angabe für
    den ganzen Typ und wird auf alle Einheiten aufgefächert (Sperre, Freigabe).

    Findet sich keine Einheit — ein Datenfehler, den 0265 im Bestand ausschließt
    —, bleiben die Zeilen unverändert. Sie fallen dann beim Schreiben mit einer
    klaren NOT-NULL-Verletzung auf, statt still im Nichts zu landen (Wurzel 5).
    """
    if unit_id:
        return [{**r, "unit_id": unit_id} for r in rows]
    ids = einheiten_ids(db, property_id, tenant_id)
    if not ids:
        return rows
    return [{**r, "unit_id": uid} for uid in ids for r in rows]


def freie_einheit(
    db: Client, property_id: str, von: str, bis_exkl: str,
    *, tenant_id: str | None = None,
    eigene_unit: str | None = None,
    eigene_naechte: list[str] | None = None,
) -> str | None:
    """Erste Einheit, die im Zeitraum [von, bis_exkl) keinen belegten Tag hat.

    Für die Zuweisung einer eingehenden Buchung. Hostaway macht dasselbe
    („When a reservation comes in, it will be assigned to a unit randomly") und
    lässt danach Umziehen zu — wir nehmen die erste freie statt einer zufälligen,
    damit dieselbe Buchung bei einem Wiederholungslauf dieselbe Einheit trifft.

    Bei der MODIFIKATION einer bestehenden Buchung sind deren eigene Nächte im
    Kalender als 'booked' gesperrt — die eigene Einheit sähe sonst belegt aus,
    die Buchung verlöre ihre Zuweisung und der Typ würde fälschlich als
    überbucht gesperrt. `eigene_unit` + `eigene_naechte` (die bisher belegten
    Tage der Buchung selbst) nehmen genau diese Belegung aus der Rechnung;
    die bisherige Einheit wird bevorzugt behalten (kein stilles Umziehen).

    None heißt: keine Einheit frei. Der Aufrufer darf die Buchung dann NICHT
    still verwerfen — sie ist real. Er sperrt den Zeitraum und meldet es, damit
    aus einer Überbuchung des Portals keine stille Doppelbelegung bei uns wird.
    """
    ids = einheiten_ids(db, property_id, tenant_id)
    if not ids:
        return None
    belegt = (
        db.table("availability")
        .select("unit_id, date, status")
        .eq("property_id", property_id)
        .gte("date", von)
        .lt("date", bis_exkl)
        .eq("status", "booked")
        .execute()
    ).data or []
    eigene_tage = {str(t) for t in (eigene_naechte or [])}
    besetzt: set[str] = set()
    for r in belegt:
        uid = r.get("unit_id")
        if not uid:
            continue
        uid = str(uid)
        if (
            eigene_unit
            and uid == str(eigene_unit)
            and str(r.get("date")) in eigene_tage
        ):
            continue
        besetzt.add(uid)
    if eigene_unit and str(eigene_unit) in ids and str(eigene_unit) not in besetzt:
        return str(eigene_unit)
    for uid in ids:
        if uid not in besetzt:
            return uid
    return None
