"""Freie Einheiten eines Objekts — die Zahl, die an die Portale geht.

Ein Objekt ist ein Einheiten-TYP mit n ≥ 1 identischen Einheiten (0265). Die
Portale erwarten deshalb keine Ja/Nein-Angabe, sondern eine STÜCKZAHL:
SiteMinder nennt sie `BookingLimit` je Zimmertyp („All rate plans under the same
room type share the same availability pool"), Booking.com zeigt sie im Extranet
als „number of rooms available to sell" je Typ.

Solange ein Objekt genau eine Einheit hat — der Bestand nach 0265 —, liefert
diese Berechnung exakt die 0/1, die vorher an den Aufrufstellen fest verdrahtet
war. Das ist Absicht: Phase 1 ändert das Modell, nicht das Verhalten.

Gerechnet wird auf dem KALENDER (`availability`), nicht auf den Reservierungen.
Das war mein erster Fehlversuch und ist ein Überbuchungs-Risiko: der Push läuft
im Buchungs-Import direkt nach dem Sperren der Nächte, die Reservierungszeile
entsteht erst danach — wer Reservierungen zählt, meldet eine gerade gebuchte
Nacht als frei. Der Kalender ist zu diesem Zeitpunkt bereits gesetzt und ist
ohnehin die Wahrheit für Belegung (Buchung, Stop-Sell, Wartung, iCal).

Gezählt wird je EINHEIT: `availability` trägt seit 0266 eine `unit_id`, also
ist die freie Stückzahl eines Tages die Zahl der Einheiten minus der Einheiten
mit belegtem oder gesperrtem Tag. Eine Buchung nimmt damit nur ihre eigene
Einheit aus dem Verkauf, nicht den ganzen Typ.
"""
from __future__ import annotations

from datetime import date, timedelta

from supabase import Client

# Kalender-Status, die eine Nacht unverkäuflich machen.
_GESPERRT = ("booked", "blocked")


def einheiten_zahl(db: Client, tenant_id: str, property_id: str) -> int:
    """Wie viele Einheiten dieses Objekt hat (mindestens 1).

    Fällt auf 1 zurück, wenn keine Zeile existiert: ein Objekt ohne Einheit ist
    ein Datenfehler, aber er darf nicht dazu führen, dass wir die Verfügbarkeit
    kontolos auf 0 setzen und das Objekt überall aus dem Verkauf nehmen.
    """
    rows = (
        db.table("property_units")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .execute()
    ).data or []
    return len(rows) or 1


def _belegte_einheiten_je_tag(
    db: Client, property_id: str, von: date, bis: date
) -> dict[str, set[str]]:
    """Je Tag die Einheiten, die der Kalender zumacht (gebucht oder gesperrt)."""
    rows = (
        db.table("availability")
        .select("date, status, unit_id")
        .eq("property_id", property_id)
        .gte("date", von.isoformat())
        .lte("date", bis.isoformat())
        .execute()
    ).data or []
    belegt: dict[str, set[str]] = {}
    for r in rows:
        if str(r.get("status") or "") not in _GESPERRT:
            continue
        tag = str(r["date"])[:10]
        # Eine Zeile ohne Einheit kann es seit 0266 nicht mehr geben; käme doch
        # eine, gilt sie für den ganzen Typ (konservativ: alles zu).
        belegt.setdefault(tag, set()).add(str(r.get("unit_id") or "*"))
    return belegt


def freie_einheiten_spannen(
    db: Client, tenant_id: str, property_id: str, von: date, bis: date
) -> list[tuple[date, date, int]]:
    """Zusammenhängende Spannen gleicher freier Stückzahl im Zeitraum.

    Gibt [(von, bis, zahl), …] zurück — genau die Form, die der ARI-Push braucht
    (ein Range-Call je Wert statt ein Call je Tag).
    """
    if bis < von:
        return []
    gesamt = einheiten_zahl(db, tenant_id, property_id)
    belegt = _belegte_einheiten_je_tag(db, property_id, von, bis)

    spannen: list[tuple[date, date, int]] = []
    start = von
    tag = von
    letzter: int | None = None
    while tag <= bis:
        besetzt = belegt.get(tag.isoformat(), set())
        frei = 0 if "*" in besetzt else max(0, gesamt - len(besetzt))
        if letzter is None:
            letzter, start = frei, tag
        elif frei != letzter:
            spannen.append((start, tag - timedelta(days=1), letzter))
            letzter, start = frei, tag
        tag += timedelta(days=1)
    if letzter is not None:
        spannen.append((start, bis, letzter))
    return spannen


def einheiten_ids(db: Client, tenant_id: str, property_id: str) -> list[str]:
    """IDs der Einheiten eines Objekts, stabil sortiert (position, id)."""
    rows = (
        db.table("property_units")
        .select("id, position")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .order("position")
        .execute()
    ).data or []
    return [str(r["id"]) for r in rows]
