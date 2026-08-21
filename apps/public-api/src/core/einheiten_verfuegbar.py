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

STOP-SELL GEHÖRT HIER HINEIN, nicht nur in die Anzeige (15.08.2026). Ein
objektweiter Stop-Sell steht in der eigenen Tabelle `stop_sell`, nicht als
Kalender-Status. Er ging deshalb ausschließlich als `stop_sell`-Restriction auf
RATE-PLAN-Ebene an Channex, während `/availability` für dieselben Tage
unverändert die freie Stückzahl meldete. Booking.com sieht beide Signale und
verkauft, wenn der Bestand > 0 ist: live passiert an „Feriehus Rævehulen" — der
Stop-Sell 15.–21.08. stand seit dem 10.08. bei Channex, `/availability` meldete
für denselben Zeitraum durchgehend `1`, und am 14.08. kam eine Booking.com-
Buchung über 17.–27.08. herein. Die Regel „Stop-Sell sperrt überall" war damit
gebrochen (Wurzel 1: der Gegenzustand wurde nicht mitgepflegt).

Die Verrechnung stand bereits in `calendar.service._spannen_ohne_stop_sell`,
aber nur im LESEPFAD der Oberfläche — die drei ARI-Push-Pfade
(`calendar`, `reservations._push_einheiten_stand`, `bookings_sync`) riefen die
rohen Spannen. Genau die Zwei-Antworten-Lage, die der Docstring von
`_push_einheiten_stand` verbietet. Deshalb ist der Stop-Sell jetzt Teil DIESER
Funktion: wer die freie Stückzahl fragt, bekommt sie unverkäuflichkeits-bereinigt,
ohne dass jede Aufrufstelle daran denken muss.

ALLE REGELN, DIE EINE NACHT UNVERKÄUFLICH MACHEN — hier vollständig, weil eine
vergessene Regel exakt den Schaden oben erzeugt (Portal verkauft, was gesperrt
ist). Wer eine neue Regel baut, trägt sie hier ein UND sorgt dafür, dass sie in
dieser Funktion ankommt:

    Regel              Wo sie steht                        Abgedeckt über
    ─────────────────────────────────────────────────────────────────────────
    Buchung            availability.status='booked'        _GESPERRT
    Handsperre         availability.status='blocked'       _GESPERRT
    Vertragsende       availability.status='blocked'       _GESPERRT
                       (source='contract_end', 0355)
    Sperrantrag        availability.status='blocked'       _GESPERRT
                       (genehmigt, sperrantraege.py)
    iCal-Fremdbelegung availability.status='booked'        _GESPERRT
    Objektweiter       stop_sell (EIGENE Tabelle,          _stop_sell_tage
    Stop-Sell          rate_plan_id IS NULL)

Der Bauplan dahinter: Fünf der sechs Regeln schreiben echte Kalenderzeilen und
sind deshalb automatisch dabei. Stop-Sell ist die EINZIGE, die in einer eigenen
Tabelle lebt — und genau die fiel durch. Eine neue Regel gehört bevorzugt in
`availability`; braucht sie eine eigene Tabelle, MUSS sie hier explizit
eingerechnet werden.

NICHT hier hinein gehören zwei Nachbarn, die etwas anderes tun:
  * plan-genauer Stop-Sell (`stop_sell.rate_plan_id` gesetzt) — er schließt
    EINEN Rate-Plan, nicht den Einheiten-Typ; die übrigen Pläne bleiben
    verkäuflich. Er wirkt allein über die stop_sell-Restriction.
  * `property_sales_pause` / `properties.status` — die schalten das INSERAT
    (`objekt_verkauf.py`), nicht einzelne Tage. Kein Datum, keine Stückzahl.
"""
# SCHWESTERDATEI — byte-identisch in beiden Bäumen halten:
#     apps/api/src/core/einheiten_verfuegbar.py
#     apps/public-api/src/core/einheiten_verfuegbar.py
# Die öffentliche API ist ein EIGENER Service (apps/public-api/README.md) und
# importiert nichts aus apps/api. Diese Datei liegt dort deshalb als bewusste
# Kopie (Muster ADR-0019). Der CI-Job `public-api-konsistenz` prüft die
# Byte-Gleichheit, und hier ist der Einsatz am höchsten: die Liste der Regeln,
# die eine Nacht unverkäuflich machen, ist die Wahrheit für die Verfügbarkeit.
# Wer sie nur in einem der beiden Bäume ergänzt, meldet über den anderen Kanal
# eine gesperrte Nacht als frei — genau der Schaden, der oben beschrieben ist.
from __future__ import annotations

from datetime import date, timedelta

from supabase import Client

# Kalender-Status, die eine Nacht unverkäuflich machen. Deckt Buchung,
# Handsperre, Vertragsende, Sperrantrag und iCal ab — siehe Tabelle oben.
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


def _stop_sell_tage(
    db: Client, property_id: str, von: date, bis: date
) -> set[str]:
    """Objektweite Stop-Sell-Tage im Zeitraum (ISO-Tage).

    Nur `rate_plan_id is null`: ein Stopp für EINEN Rate-Plan schließt den
    Einheiten-Typ nicht, die übrigen Pläne bleiben verkäuflich. Ein solcher
    plan-genauer Stopp wirkt allein über die `stop_sell`-Restriction.
    """
    rows = (
        db.table("stop_sell")
        .select("date")
        .eq("property_id", property_id)
        .is_("rate_plan_id", "null")
        .gte("date", von.isoformat())
        .lte("date", bis.isoformat())
        .execute()
    ).data or []
    return {str(r["date"])[:10] for r in rows}


def freie_einheiten_spannen(
    db: Client, tenant_id: str, property_id: str, von: date, bis: date
) -> list[tuple[date, date, int]]:
    """Zusammenhängende Spannen gleicher VERKÄUFLICHER Stückzahl im Zeitraum.

    Gibt [(von, bis, zahl), …] zurück — genau die Form, die der ARI-Push braucht
    (ein Range-Call je Wert statt ein Call je Tag).

    Ein objektweiter Stop-Sell-Tag zählt als 0, egal wie viele Einheiten der
    Kalender freihat: er ist unverkäuflich, und der Bestand ist das Signal, auf
    das Booking.com hört (siehe Modul-Docstring).
    """
    if bis < von:
        return []
    gesamt = einheiten_zahl(db, tenant_id, property_id)
    belegt = _belegte_einheiten_je_tag(db, property_id, von, bis)
    gestoppt = _stop_sell_tage(db, property_id, von, bis)

    spannen: list[tuple[date, date, int]] = []
    start = von
    tag = von
    letzter: int | None = None
    while tag <= bis:
        iso = tag.isoformat()
        besetzt = belegt.get(iso, set())
        if iso in gestoppt or "*" in besetzt:
            frei = 0
        else:
            frei = max(0, gesamt - len(besetzt))
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
