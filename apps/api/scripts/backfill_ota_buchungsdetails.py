"""Bestandsbefüllung der Portal-Buchungsdetails (0384) aus dem gespeicherten Payload.

WOZU: Seit 0384 übernimmt der Buchungsimport die Konditionen des Portals
(Storno-Staffel, Notes, Policies/Verpflegung/Rauchen/Kinder-Alter) und leitet
den Buchungszeitpunkt notfalls aus der Storno-Staffel ab. Buchungen, die VOR
dieser Änderung ankamen, haben die Spalten leer — obwohl die Daten längst da
sind: der vollständige Channex-Payload liegt in `channex_booking.raw`.

WARUM AUS `raw` UND NICHT AUS CHANNEX: Ein erneuter Abruf wäre ein
Schreibzugriffs-freier, aber teurer Fremdaufruf gegen ein Live-Konto mit
Ratelimit — und er könnte einen anderen Stand liefern als den, aus dem unsere
Buchung entstanden ist. Der gespeicherte Payload IST die Quelle, aus der die
Zeile gebaut wurde; genau ihn erneut auszupacken ist reproduzierbar.

WARUM ÜBER DEN ECHTEN CODE: die Felder kommen aus denselben Funktionen, die der
Import benutzt (`common.ota_cancel_penalties/ota_notes_text/ota_zusatzdetails`,
`common.ota_buchungszeitpunkt`). Eine zweite Auspack-Logik für den Bestand
liefe mit der Zeit auseinander, und niemand könnte sagen, welche Version gilt.

IDEMPOTENT (Wurzel 2): schreibt je Buchung ein Update mit denselben Werten —
mehrfach laufen lassen ändert nichts. `booked_at` wird nur gesetzt, wenn es noch
leer ist: ein bereits gemeldeter Zeitpunkt des Portals ist besser als jede
Ableitung und darf nicht überschrieben werden.

AUSFÜHRUNG (vom apps/api-Verzeichnis, braucht die Server-Umgebung):
    python scripts/backfill_ota_buchungsdetails.py --dry-run   # nur zeigen
    python scripts/backfill_ota_buchungsdetails.py             # schreiben
    python scripts/backfill_ota_buchungsdetails.py --tenant <uuid>
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from typing import TYPE_CHECKING, Any

from src.core.supabase import get_service_client
from src.features.channel_manager.common import (
    ota_buchungszeitpunkt,
    ota_cancel_penalties,
    ota_notes_text,
    ota_zusatzdetails,
)

if TYPE_CHECKING:  # nur für die Signatur — zur Laufzeit nicht gebraucht
    from supabase import Client


def _attrs(raw: object) -> dict[str, Any] | None:
    """Der Attribut-Block einer gespeicherten Channex-Buchung.

    `raw` liegt je nach Eingangsweg flach (Feed/Historie) oder als
    JSON-API-Hülle mit `attributes` (Webhook) vor. Beides kommt im Bestand vor,
    deshalb beide Formen bedienen statt eine zu erraten.
    """
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            return None
    if not isinstance(raw, dict):
        return None
    attributes = raw.get("attributes")
    if isinstance(attributes, dict):
        return attributes
    return raw


def backfill(db: Client, *, tenant: str | None, dry_run: bool) -> Counter:
    zaehler: Counter = Counter()
    query = (
        db.table("channex_booking")
        .select("id, tenant_id, channex_booking_id, ota_reservation_code, raw")
        .order("created_at", desc=False)
    )
    if tenant:
        query = query.eq("tenant_id", tenant)
    staging = query.execute().data or []
    zaehler["staging_zeilen"] = len(staging)

    for zeile in staging:
        attrs = _attrs(zeile.get("raw"))
        if attrs is None:
            zaehler["ohne_payload"] += 1
            continue
        res = (
            db.table("reservations")
            .select("id, booked_at")
            .eq("tenant_id", zeile["tenant_id"])
            # Die Buchung trägt die CHANNEX-ID der Buchung, nicht die ID unserer
            # Staging-Zeile (so verknüpft auch der Posteingang, `inbox`-Slice).
            .eq("source_channex_booking_id", zeile["channex_booking_id"])
            .limit(1)
            .execute()
        ).data
        if not res:
            zaehler["ohne_buchung"] += 1
            continue
        buchung = res[0]

        werte: dict[str, Any] = {
            "ota_cancel_penalties": ota_cancel_penalties(attrs),
            "ota_notes": ota_notes_text(attrs),
            "ota_details": ota_zusatzdetails(attrs),
        }
        # Buchungszeitpunkt nur ergänzen, nie ersetzen (siehe Modul-Doku).
        if not buchung.get("booked_at"):
            zeitpunkt = ota_buchungszeitpunkt(attrs)
            if zeitpunkt:
                werte["booked_at"] = zeitpunkt
                zaehler["booked_at_ergaenzt"] += 1

        gefuellt = {k: v for k, v in werte.items() if v is not None}
        if not gefuellt:
            zaehler["nichts_im_payload"] += 1
            continue
        for feld in gefuellt:
            zaehler[f"feld_{feld}"] += 1
        if dry_run:
            zaehler["wuerde_schreiben"] += 1
            continue
        db.table("reservations").update(gefuellt).eq("id", buchung["id"]).eq(
            "tenant_id", zeile["tenant_id"]
        ).execute()
        zaehler["geschrieben"] += 1
    return zaehler


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant", help="nur diesen Mandanten")
    parser.add_argument(
        "--dry-run", action="store_true", help="nichts schreiben, nur zählen"
    )
    args = parser.parse_args()

    db = get_service_client()
    zaehler = backfill(db, tenant=args.tenant, dry_run=args.dry_run)
    print("Modus:", "Probelauf" if args.dry_run else "schreibend")
    for schluessel in sorted(zaehler):
        print(f"  {schluessel}: {zaehler[schluessel]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
