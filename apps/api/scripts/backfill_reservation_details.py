"""Einmaliges Backfill: bestehende reservations mit Detailfeldern füllen.

Vor Migration 0049 trug reservations nur Stammfelder; die Detailansicht (rechter
Slider) blieb leer. Dieses Skript füllt für alle OTA-projizierten Reservierungen
(source_channex_booking_id gesetzt) die neuen Detailfelder aus dem zugehörigen
channex_booking-JSON nach — mit DERSELBEN Mapping-Logik wie der Live-Ingest
(_project_booking_to_reservation), damit kein Sonderfall entsteht.

Direktbuchungen (ohne source_channex_booking_id) tragen ihre Detaildaten bereits
aus dem Wizard; sie werden nicht angefasst.

Idempotent: nur Felder, die aktuell leer/Default sind, werden gesetzt.
Service-Role-Client (umgeht RLS), Tenant immer explizit gefiltert.

Aufruf (im apps/api-Verzeichnis, venv aktiv):
    python -m scripts.backfill_reservation_details
    python -m scripts.backfill_reservation_details --dry-run
"""
from __future__ import annotations

import argparse

from src.core.logging import get_logger
from src.core.supabase import get_service_client
from src.features.channel_manager.service import ChannelManagerService

log = get_logger("nextdays.backfill.reservation_details")

_PAGE = 500


def _tenant_ids(db) -> list[str]:  # noqa: ANN001
    rows = db.table("tenants").select("id").execute().data or []
    return [r["id"] for r in rows]


def _detail_patch(svc: ChannelManagerService, attrs: dict) -> dict:
    """Detailfelder aus dem channex_booking-raw-JSON (gleiche Logik wie Ingest)."""
    adults, children, infants = svc._booking_occupancy(attrs)  # noqa: SLF001
    customer = attrs.get("customer") or {}
    return {
        "num_guests": max(1, adults + children + infants),
        "adults": adults,
        "children": children,
        "infants": infants,
        "guest_email": customer.get("mail") or customer.get("email"),
        "guest_phone": customer.get("phone"),
        "guest_language": customer.get("language"),
        "guest_country": customer.get("country"),
        "checkin_time": attrs.get("checkin_time"),
        "checkout_time": attrs.get("checkout_time"),
        "quote_items": svc._booking_quote_items(attrs),  # noqa: SLF001
        "external_url": attrs.get("ota_url") or attrs.get("external_url"),
    }


def backfill(*, dry_run: bool = False) -> dict[str, int]:
    db = get_service_client()
    svc = ChannelManagerService(service_client=db)
    total = {"scanned": 0, "filled": 0, "skipped": 0}
    for tenant_id in _tenant_ids(db):
        offset = 0
        while True:
            rows = (
                db.table("reservations")
                .select("id, source_channex_booking_id")
                .eq("tenant_id", tenant_id)
                .not_.is_("source_channex_booking_id", "null")
                .range(offset, offset + _PAGE - 1)
                .execute()
            ).data or []
            if not rows:
                break
            for r in rows:
                total["scanned"] += 1
                cb = (
                    db.table("channex_booking")
                    .select("raw")
                    .eq("tenant_id", tenant_id)
                    .eq("channex_booking_id", r["source_channex_booking_id"])
                    .limit(1)
                    .execute()
                ).data
                if not cb:
                    total["skipped"] += 1
                    continue
                patch = _detail_patch(svc, cb[0].get("raw") or {})
                if dry_run:
                    total["filled"] += 1
                    continue
                db.table("reservations").update(patch).eq(
                    "tenant_id", tenant_id
                ).eq("id", r["id"]).execute()
                total["filled"] += 1
            offset += _PAGE
    log.info("backfill_reservation_details_done", dry_run=dry_run, **total)
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill reservations-Detailfelder")
    parser.add_argument("--dry-run", action="store_true", help="nur zählen, nichts schreiben")
    args = parser.parse_args()
    result = backfill(dry_run=args.dry_run)
    print(  # noqa: T201 — bewusster CLI-Output
        f"{'[dry-run] ' if args.dry_run else ''}"
        f"scanned={result['scanned']} filled={result['filled']} skipped={result['skipped']}"
    )


if __name__ == "__main__":
    main()
