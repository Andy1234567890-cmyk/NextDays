"""Website-Buchungen aus Lodgify übernehmen (Bestandsübernahme AirSmil).

WAS DIESES SKRIPT MACHT: Es legt die Buchungen an, die über die EIGENE
Buchungsstrecke des Betriebs bei Lodgify eingegangen sind — Kanal `website`
(Migration 0380), provisionsfreier Direktumsatz. Portal-Buchungen
(Booking.com/Airbnb) sind ausdrücklich NICHT dabei: die kommen über den
Channel-Manager und würden sich mit dem laufenden Sync beißen.

WAS ES NICHT MACHT — und zwar mit Absicht:

* **Kein Schreibaufruf gegen Lodgify.** Lodgify ist das Produktivsystem der
  Kundin. Gelesen wird ausschliesslich (der Abruf lief getrennt, siehe
  `--eingabe`); dieses Skript spricht Lodgify gar nicht an.
* **Kein UPDATE bestehender Buchungen.** Nur INSERT. Eine vorhandene
  Reservierung kann dieses Skript nicht verändern — ausgenommen das gezielte
  Nachtragen von `lodgify_booking_id` auf Zeilen, wo sie NULL ist (`--nachtragen`),
  und das fasst kein anderes Feld an.
* **Kein Überschreiben belegter Nächte.** Ist eine Nacht schon belegt, wird die
  Buchung NICHT angelegt, sondern als Konflikt gemeldet. Kein „der Neuere
  gewinnt" — bei fremdem Bestand wäre das Datenverlust.

IDEMPOTENZ (Wurzel 2) auf drei Ebenen, weil ein Import real mehrfach läuft:
  1. `lodgify_booking_id` — kennt das Skript die Buchung schon, überspringt es sie.
  2. (property_id, check_in, check_out) — fängt die Buchungen, die über
     Channex/Booking bereits bei uns liegen und KEINE Lodgify-ID tragen.
  3. Unique-Index `reservations_lodgify_booking_uidx` (0381) — der DB-Riegel,
     falls zwei Läufe gleichzeitig zwischen Prüfung und Insert geraten.

AUFRUF (Trockenlauf ist der Standard, schreiben muss man ausdrücklich wollen):
    uv run python scripts/lodgify_website_import.py --eingabe <bookings.json>
    uv run python scripts/lodgify_website_import.py --eingabe <…> --schreiben
    uv run python scripts/lodgify_website_import.py --eingabe <…> --nachtragen
    … zusätzlich `--objekt "Feriehus Line"` für einen Probelauf an EINEM Objekt.
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
from supabase import Client  # noqa: E402

# Herkunft: so kennzeichnet Lodgify eine Buchung über die eigene Website.
# `source_text` trägt die Domain der Buchungsstrecke bzw. „Homepage" bei einer
# von Hand als Website-Buchung erfassten Reservierung.
_WEBSITE_MARKER = "lodgify.com"
_WEBSITE_TEXT = {"homepage"}


def ist_website(b: dict) -> bool:
    t = (b.get("source_text") or "").strip()
    return _WEBSITE_MARKER in t or t.lower() in _WEBSITE_TEXT


def naechte(anreise: str, abreise: str) -> list[str]:
    """Belegte Nächte: Anreise inklusive, Abreise EXKLUSIV (Abreisetag ist frei)."""
    a = date.fromisoformat(anreise)
    b = date.fromisoformat(abreise)
    return [(a + timedelta(days=i)).isoformat() for i in range((b - a).days)]


def objekte_je_lodgify_id(db: Client, tenant_id: str, zuordnung: dict[str, str]) -> dict[str, dict]:
    """lodgify_property_id → unsere properties-Zeile, über den Titel.

    Die Zuordnung kommt aus einer geprüften Datei (Titel-Paare), nicht aus einer
    Namens-Heuristik zur Laufzeit: bei 19 ähnlich benannten Ferienhäusern wäre
    ein Fehlgriff eine Buchung im falschen Haus.
    """
    zeilen = (
        db.table("properties")
        .select("id, title, currency")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    nach_titel = {z["title"]: z for z in zeilen}
    treffer: dict[str, dict] = {}
    for lod_id, titel in zuordnung.items():
        if titel in nach_titel:
            treffer[str(lod_id)] = nach_titel[titel]
    return treffer


def belegte_naechte(db: Client, property_id: str, tage: list[str]) -> list[str]:
    """Welche der Nächte sind schon belegt? (Kollisionsschutz vor dem Insert.)"""
    if not tage:
        return []
    zeilen = (
        db.table("availability")
        .select("date, status")
        .eq("property_id", property_id)
        .in_("date", tage)
        .execute()
    ).data or []
    return sorted({z["date"] for z in zeilen if z.get("status") == "booked"})


def vorhanden(db: Client, tenant_id: str, lodgify_id: str) -> dict | None:
    zeilen = (
        db.table("reservations")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("lodgify_booking_id", lodgify_id)
        .limit(1)
        .execute()
    ).data or []
    return zeilen[0] if zeilen else None


def datumsgleich(db: Client, tenant_id: str, property_id: str, von: str, bis: str) -> dict | None:
    """Dieselbe Buchung, aber ohne Lodgify-ID — z. B. über Channex gekommen."""
    zeilen = (
        db.table("reservations")
        .select("id, lodgify_booking_id, channel, status")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .eq("check_in", von)
        .eq("check_out", bis)
        .neq("status", "cancelled")
        .limit(1)
        .execute()
    ).data or []
    return zeilen[0] if zeilen else None


def main() -> int:  # noqa: PLR0912, PLR0915 — ein Skript, ein linearer Ablauf
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--eingabe", required=True, help="bookings.json aus dem Leseabruf")
    p.add_argument("--zuordnung", required=True, help="JSON: lodgify_property_id → Titel")
    p.add_argument("--tenant", required=True, help="Tenant-UUID")
    p.add_argument("--objekt", default=None, help="nur dieses Objekt (Probelauf)")
    p.add_argument("--schreiben", action="store_true", help="wirklich anlegen")
    p.add_argument(
        "--nachtragen",
        action="store_true",
        help="lodgify_booking_id auf datumsgleichen Bestandszeilen nachtragen",
    )
    args = p.parse_args()

    buchungen = json.loads(Path(args.eingabe).read_text(encoding="utf-8"))
    zuordnung = json.loads(Path(args.zuordnung).read_text(encoding="utf-8"))
    db = get_service_client()
    objekte = objekte_je_lodgify_id(db, args.tenant, zuordnung)

    kandidaten = [
        b
        for b in buchungen
        if ist_website(b)
        and not b.get("is_deleted")
        and not b.get("canceled_at")
        and b.get("status") != "Declined"
        and str(b.get("property_id")) in objekte
    ]
    if args.objekt:
        kandidaten = [
            b
            for b in kandidaten
            if objekte[str(b["property_id"])]["title"] == args.objekt
        ]

    modus = "SCHREIBEN" if args.schreiben else "TROCKENLAUF (nichts wird angelegt)"
    print(f"=== Lodgify Website-Import — {modus}")
    print(f"{len(kandidaten)} Website-Buchung(en) zu übernehmen\n")

    neu = uebersprungen = konflikt = nachgetragen = 0
    for b in sorted(kandidaten, key=lambda x: str(x.get("arrival"))):
        lod_id = str(b["id"])
        obj = objekte[str(b["property_id"])]
        von, bis = str(b["arrival"])[:10], str(b["departure"])[:10]
        gast = (b.get("guest") or {}).get("name") or ""
        kopf = f"  {von}→{bis} {obj['title'][:24]:<24} {gast[:20]:<20}"

        if vorhanden(db, args.tenant, lod_id):
            print(f"{kopf} schon importiert")
            uebersprungen += 1
            continue

        gleich = datumsgleich(db, args.tenant, obj["id"], von, bis)
        if gleich:
            if args.nachtragen and not gleich.get("lodgify_booking_id"):
                if args.schreiben:
                    db.table("reservations").update(
                        {"lodgify_booking_id": lod_id}
                    ).eq("tenant_id", args.tenant).eq("id", gleich["id"]).execute()
                print(f"{kopf} bereits da → Lodgify-ID nachgetragen")
                nachgetragen += 1
            else:
                print(f"{kopf} bereits da (Kanal {gleich.get('channel')})")
                uebersprungen += 1
            continue

        tage = naechte(von, bis)
        belegt = belegte_naechte(db, obj["id"], tage)
        if belegt:
            # NICHT anlegen: fremder Bestand belegt diese Nächte. Überschreiben
            # wäre Datenverlust, „daneben legen" eine Doppelbelegung.
            print(f"{kopf} KONFLIKT — belegt: {', '.join(belegt[:3])}")
            konflikt += 1
            continue

        waehrung = (b.get("currency_code") or "").strip() or obj.get("currency")
        if not waehrung:
            # Wurzel 4: keine Währung erfinden. Ohne sie ist der Betrag wertlos.
            print(f"{kopf} ÜBERSPRUNGEN — keine Währung an Buchung und Objekt")
            konflikt += 1
            continue

        gliederung = (b.get("rooms") or [{}])[0].get("guest_breakdown") or {}
        g = b.get("guest") or {}
        if args.schreiben:
            guest_id = resolve_or_create_guest(
                db,
                args.tenant,
                GuestContact(
                    name=g.get("name"),
                    email=g.get("email"),
                    phone=g.get("phone"),
                    channel="website",
                    external_ref=lod_id,
                ),
            )
            zeile = {
                "tenant_id": args.tenant,
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
                # Wurzel 5b: der Buchungszeitpunkt kommt aus der QUELLE, nicht
                # von unserer Uhr — sonst sähen alle Alt-Buchungen aus, als
                # wären sie heute eingegangen.
                "booked_at": b.get("created_at"),
                "note": f"Übernommen aus Lodgify (Website-Buchung, ID {lod_id}).",
            }
            try:
                db.table("reservations").insert(zeile).execute()
            except Exception as exc:  # noqa: BLE001 — eine Zeile darf nicht alles kippen
                if "reservations_lodgify_booking_uidx" in str(exc):
                    print(f"{kopf} schon importiert (DB-Riegel)")
                    uebersprungen += 1
                    continue
                print(f"{kopf} FEHLER: {str(exc)[:120]}")
                konflikt += 1
                continue
            # Nächte belegen (Wurzel 1: der Gegenzustand gehört mitgepflegt).
            # `je_einheit` fächert auf die Einheiten des Objekts auf — ohne das
            # läge die Sperre auf keiner Einheit und der Kalender zeigte die
            # Nacht weiter als frei (1 Objekt = 1 Typ mit n Einheiten, 0265).
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
        print(f"{kopf} {'ANGELEGT' if args.schreiben else 'würde angelegt'}"
              f" ({b.get('total_amount')} {waehrung})")
        neu += 1

    print(
        f"\nneu: {neu} · übersprungen: {uebersprungen} · "
        f"nachgetragen: {nachgetragen} · Konflikt/übersprungen: {konflikt}"
    )
    if not args.schreiben:
        print("\nTrockenlauf — es wurde NICHTS geschrieben. Mit --schreiben ausführen.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
