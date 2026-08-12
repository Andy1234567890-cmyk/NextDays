"""Nachtrag: die beiden manuellen Lodgify-Buchungen von Otto Kurz.

WARUM EIN EIGENES SKRIPT UND NICHT `lodgify_website_import.py`:
Der Website-Import legt nur Buchungen an, deren Nächte FREI sind — bei belegten
Nächten meldet er einen Konflikt und rührt nichts an. Das ist dort richtig: bei
fremdem Bestand wäre „der Neuere gewinnt" Datenverlust.

Hier liegt der Sonderfall, den diese Regel nicht abdeckt: Die vier Nächte sind
bei uns `blocked` (`source='manual'`, ohne `block_request_id`) — eine anonyme
Handsperre, die beim Umzug offensichtlich als PLATZHALTER für genau diese
Buchungen gesetzt wurde, weil die echten Buchungen fehlten. Die Sperre ist also
nicht das, was geschützt werden muss, sondern das, was ersetzt wird.

BELEG FÜR DIE OBJEKTZUORDNUNG (nicht geraten, Wurzel 4):
Der Name der EINHEIT trägt bei beiden Objekten wörtlich den Lodgify-Namen:
  * `FeWo Lille Vidstrup` → Einheit „001 Højenevej Lille Vidstrup ·
    Apartment Lille Vidstrup" = Lodgify 759213 „Apartment Lille Vidstrup"
  * `FeWo Vidstrup Have`  → Einheit „003 Højenevej Vidstrup Have ·
    Fewo Vidstrup Garden" = Lodgify 759211 „Fewo Vidstrup Garden"
Zusätzlich bestätigt für 759213: zwei bereits importierte Buchungen tragen
diese Lodgify-Objekt-ID und hängen an `FeWo Lille Vidstrup`.

ZWEI BUCHUNGEN, KEIN DUPLIKAT: Otto Kurz hat für denselben Zeitraum ZWEI
verschiedene Objekte gebucht (Lodgify 759213 und 759211). Die zwei weiteren
Lodgify-Einträge auf seinen Namen sind `Declined` + `is_deleted=true` — von
Lodgify verworfene Erstversuche eine Stunde zuvor mit anderen Preisen. Sie
werden NICHT übernommen.

REIHENFOLGE (Wurzel 1 — der Gegenzustand gehört in denselben Durchlauf):
  1. Buchung anlegen (der DB-Riegel `reservations_lodgify_booking_uidx` ist der
     Idempotenz-Backstop).
  2. Handsperre und `stop_sell` NUR für genau diese Nächte und genau diese
     Einheit lösen.
  3. Nächte als `booked` belegen.
Bricht Schritt 2/3 ab, steht eine Buchung ohne Belegung — darum meldet das
Skript das laut und bricht ab, statt weiterzulaufen.

AUFRUF (Trockenlauf ist der Standard):
    uv run python scripts/lodgify_otto_kurz_nachtrag.py --eingabe <bookings.json>
    uv run python scripts/lodgify_otto_kurz_nachtrag.py --eingabe <…> --schreiben
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.einheiten import AVAILABILITY_CONFLICT, je_einheit  # noqa: E402
from src.core.supabase import get_service_client  # noqa: E402
from src.features.guests.identity import (  # noqa: E402
    GuestContact,
    resolve_or_create_guest,
)

TENANT = "a25577cf-c941-45c4-8d23-008887e631aa"

# Die zwei Buchungen und ihr Zielobjekt. Fest verdrahtet und nicht über eine
# Namenssuche aufgelöst: die Zuordnung ist oben einzeln belegt, und eine
# Suche über ähnliche Namen hätte hier zweimal danebengegriffen
# („Fewo Vidstrup Garden" ist NICHT `Feriehus Britt`, obwohl der Datums-
# Abgleich das dreimal nahelegte).
NACHTRAG = {
    "20384390": "FeWo Lille Vidstrup",
    "20384409": "FeWo Vidstrup Have",
}

# Die Sperre, die ersetzt wird. Nur GENAU diese Signatur wird gelöst — eine
# Sperre aus einem genehmigten Sperrantrag (`block_request_id`) oder aus einem
# Vertragsende (`source='contract_end'`) bleibt unangetastet.
ERSETZBARE_SPERRE = ("blocked", "manual")


def naechte(anreise: str, abreise: str) -> list[str]:
    """Belegte Nächte: Anreisetag bis einschließlich Vortag der Abreise."""
    cur = date.fromisoformat(anreise)
    ende = date.fromisoformat(abreise)
    out: list[str] = []
    while cur < ende:
        out.append(cur.isoformat())
        cur += timedelta(days=1)
    return out


def objekt_laden(db, titel: str) -> dict:
    rows = (
        db.table("properties")
        .select("id, title, currency")
        .eq("tenant_id", TENANT)
        .eq("title", titel)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        raise SystemExit(f"Objekt nicht gefunden: {titel}")
    return rows[0]


def sperre_pruefen(db, property_id: str, tage: list[str]) -> tuple[list[dict], list[dict]]:
    """Was auf diesen Nächten liegt — getrennt nach lösbar und fremd.

    Fremd ist alles, was NICHT die anonyme Handsperre ist: eine Buchung, eine
    Sperre aus einem genehmigten Antrag, ein Vertragsende. Steht davon etwas im
    Weg, wird nichts geschrieben (Wurzel 5: klar fehlschlagen).
    """
    rows = (
        db.table("availability")
        .select("id, date, status, source, unit_id, block_request_id")
        .eq("property_id", property_id)
        .in_("date", tage)
        .execute()
    ).data or []
    loesbar, fremd = [], []
    for r in rows:
        ist_hand = (
            (r.get("status"), r.get("source")) == ERSETZBARE_SPERRE
            and not r.get("block_request_id")
        )
        (loesbar if ist_hand else fremd).append(r)
    return loesbar, fremd


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--eingabe", required=True, help="Lodgify-Buchungen als JSON")
    p.add_argument("--schreiben", action="store_true", help="wirklich schreiben")
    args = p.parse_args()

    quelle = {
        str(b.get("id")): b for b in json.loads(Path(args.eingabe).read_text("utf-8"))
    }
    db = get_service_client()
    fehler = 0

    for lod_id, titel in NACHTRAG.items():
        b = quelle.get(lod_id)
        if not b:
            print(f"[{lod_id}] NICHT im Abzug gefunden — übersprungen")
            fehler += 1
            continue
        # Was das Skript übernimmt, muss auch das sein, was übernommen werden
        # soll: eine verworfene oder gelöschte Buchung darf nicht durchrutschen.
        if b.get("status") != "Booked" or b.get("is_deleted"):
            print(
                f"[{lod_id}] Status={b.get('status')} deleted={b.get('is_deleted')}"
                " — wird NICHT übernommen"
            )
            fehler += 1
            continue

        obj = objekt_laden(db, titel)
        von, bis = b["arrival"], b["departure"]
        tage = naechte(von, bis)
        kopf = f"[{lod_id}] {titel} {von}→{bis} ({len(tage)} N)"

        # Idempotenz (Wurzel 2): schon da? Dann nichts tun.
        da = (
            db.table("reservations")
            .select("id")
            .eq("tenant_id", TENANT)
            .eq("lodgify_booking_id", lod_id)
            .limit(1)
            .execute()
        ).data or []
        if da:
            print(f"{kopf} schon importiert — übersprungen")
            continue

        loesbar, fremd = sperre_pruefen(db, obj["id"], tage)
        if fremd:
            print(f"{kopf} FREMDE Belegung im Weg — es wird NICHTS geschrieben:")
            for r in fremd:
                print(
                    f"    {r['date']} status={r['status']} source={r['source']}"
                    f" antrag={r.get('block_request_id')}"
                )
            fehler += 1
            continue

        # Währung aus den Daten, nie ein Ersatzwert (Wurzel 4).
        waehrung = (b.get("currency_code") or obj.get("currency") or "").strip()
        if not waehrung:
            print(f"{kopf} FEHLER: keine Währung an Buchung und Objekt")
            fehler += 1
            continue

        print(f"{kopf} Handsperre auf {len(loesbar)} Zeilen wird ersetzt")
        if not args.schreiben:
            print(f"{kopf} würde angelegt ({b.get('total_amount')} {waehrung})")
            continue

        g = b.get("guest") or {}
        gliederung = (b.get("rooms") or [{}])[0].get("guest_breakdown") or {}
        guest_id = resolve_or_create_guest(
            db,
            TENANT,
            GuestContact(
                name=g.get("name"),
                email=g.get("email"),
                phone=g.get("phone"),
                channel="website",
                external_ref=lod_id,
            ),
        )
        zeile = {
            "tenant_id": TENANT,
            "property_id": obj["id"],
            "guest_id": guest_id,
            "channel": "website",
            "check_in": von,
            "check_out": bis,
            "status": "confirmed",
            "total_amount": b.get("total_amount"),
            "currency": waehrung,
            "paid_amount": b.get("amount_paid") or 0,
            "num_guests": gliederung.get("adults", 0)
            + gliederung.get("children", 0)
            or 1,
            "adults": gliederung.get("adults"),
            "children": gliederung.get("children"),
            "infants": gliederung.get("infants"),
            "pets": gliederung.get("pets"),
            "guest_email": g.get("email"),
            "guest_phone": g.get("phone"),
            "lodgify_booking_id": lod_id,
            "is_imported": True,
            # Wurzel 5b: Buchungszeitpunkt aus der QUELLE, nicht unsere Uhr.
            "booked_at": b.get("created_at"),
            "note": (
                f"Übernommen aus Lodgify (manuelle Buchung, ID {lod_id}). "
                "Ersetzt die beim Umzug gesetzte Handsperre."
            ),
        }
        try:
            db.table("reservations").insert(zeile).execute()
        except Exception as exc:  # noqa: BLE001 — eine Zeile darf nicht alles kippen
            if "reservations_lodgify_booking_uidx" in str(exc):
                print(f"{kopf} schon importiert (DB-Riegel)")
                continue
            print(f"{kopf} FEHLER beim Anlegen: {str(exc)[:200]}")
            fehler += 1
            continue

        # Ab hier ist die Buchung in der DB — der Gegenzustand MUSS folgen
        # (Wurzel 1). Ein Abbruch dazwischen ließe eine Buchung ohne Belegung
        # stehen, also wird er laut gemeldet und nicht verschluckt (Wurzel 5).
        try:
            # `stop_sell` gehört zur Handsperre und muss mit weg, sonst bleibt
            # der Verkauf trotz Belegung zu.
            db.table("stop_sell").delete().eq("property_id", obj["id"]).in_(
                "date", tage
            ).execute()
            # Die Nächte auf `booked` setzen — dasselbe `je_einheit`-Muster wie
            # der Website-Import: ohne die Auffächerung läge die Belegung auf
            # keiner Einheit und der Kalender zeigte die Nacht weiter frei
            # (1 Objekt = 1 Typ mit n Einheiten, 0265).
            db.table("availability").upsert(
                je_einheit(
                    db,
                    obj["id"],
                    [
                        {
                            "property_id": obj["id"],
                            "date": tag,
                            "status": "booked",
                            "source": "website",
                        }
                        for tag in tage
                    ],
                    unit_id=None,
                ),
                on_conflict=AVAILABILITY_CONFLICT,
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Zustand muss sichtbar werden
            print(
                f"{kopf} ACHTUNG: Buchung angelegt, aber Belegung FEHLGESCHLAGEN"
                f" — von Hand prüfen! {str(exc)[:200]}"
            )
            return 1
        print(f"{kopf} ANGELEGT ({b.get('total_amount')} {waehrung})")

    if not args.schreiben:
        print("\nTrockenlauf — es wurde NICHTS geschrieben. Mit --schreiben ausführen.")
    return 1 if fehler else 0


if __name__ == "__main__":
    raise SystemExit(main())
