"""Einmaliges Backfill: bestehende channex_booking-Zeilen über den zentralen
Resolver mit guest_id verknüpfen (Prompt A — Nachricht→Gast-Zuordnung).

Vor Einführung des Resolvers trugen channex_booking-Threads keinen guest_id-Link;
die Gästekarte zeigte „Keine verknüpften Nachrichten". Dieses Skript läuft pro
Tenant über alle channex_booking ohne guest_id und setzt ihn über
`resolve_or_create_guest` (gleiche Logik wie der Live-Ingest → konsistent,
keine Sonderbehandlung).

Idempotent: nur Zeilen mit guest_id IS NULL werden angefasst; erneuter Lauf ist
ein No-op. Service-Role-Client (umgeht RLS), Tenant immer explizit gefiltert.

Aufruf (im apps/api-Verzeichnis, venv aktiv):
    python -m scripts.backfill_guest_links            # alle Tenants
    python -m scripts.backfill_guest_links --dry-run  # nur zählen, nichts schreiben
"""
from __future__ import annotations

import argparse

from src.core.logging import get_logger
from src.core.supabase import get_service_client
from src.features.guests.identity import (
    contact_from_ota_customer,
    resolve_or_create_guest,
)

log = get_logger("nextdays.backfill.guest_links")

_PAGE = 500


def _tenant_ids(db) -> list[str]:  # noqa: ANN001
    rows = db.table("tenants").select("id").execute().data or []
    return [r["id"] for r in rows]


def backfill(*, dry_run: bool = False) -> dict[str, int]:
    db = get_service_client()
    total = {"scanned": 0, "linked": 0, "skipped": 0}
    for tenant_id in _tenant_ids(db):
        offset = 0
        while True:
            rows = (
                db.table("channex_booking")
                .select("id, customer, ota_reservation_code")
                .eq("tenant_id", tenant_id)
                .is_("guest_id", "null")
                .range(offset, offset + _PAGE - 1)
                .execute()
            ).data or []
            if not rows:
                break
            for r in rows:
                total["scanned"] += 1
                guest_id = (
                    None
                    if dry_run
                    else resolve_or_create_guest(
                        db,
                        tenant_id,
                        contact_from_ota_customer(
                            r.get("customer") or {},
                            external_ref=r.get("ota_reservation_code"),
                        ),
                    )
                )
                if dry_run:
                    total["linked"] += 1
                    continue
                if not guest_id:
                    total["skipped"] += 1
                    continue
                db.table("channex_booking").update({"guest_id": guest_id}).eq(
                    "tenant_id", tenant_id
                ).eq("id", r["id"]).execute()
                total["linked"] += 1
            offset += _PAGE
    log.info("backfill_guest_links_done", dry_run=dry_run, **total)
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill channex_booking.guest_id")
    parser.add_argument("--dry-run", action="store_true", help="nur zählen, nichts schreiben")
    args = parser.parse_args()
    result = backfill(dry_run=args.dry_run)
    print(  # noqa: T201 — bewusster CLI-Output
        f"{'[dry-run] ' if args.dry_run else ''}"
        f"scanned={result['scanned']} linked={result['linked']} skipped={result['skipped']}"
    )


if __name__ == "__main__":
    main()
