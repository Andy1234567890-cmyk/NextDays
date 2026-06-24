"""Einmaliges Backfill: Kontaktdaten für Direktbuchungen aus dem guests-Eintrag.

Direktbuchungen (eigene Plattform/Wizard) OHNE source_channex_booking_id, die VOR
Migration 0049 angelegt wurden, tragen keine denormalisierten Kontaktfelder. Ihre
Daten liegen aber am verknüpften guests-Eintrag. Dieses Skript füllt nur leere
Felder aus guests (E-Mail/Telefon/Sprache) — überschreibt NICHTS.

Hinweis: Das betrifft ausschließlich Altdaten. Neue Buchungen füllen diese Felder
bereits im normalen create()-Pfad (reservations.service); ein erneuter Lauf ist
ein No-op.

Aufruf (im apps/api-Verzeichnis, venv aktiv):
    python -m scripts.backfill_direct_reservation_contact
    python -m scripts.backfill_direct_reservation_contact --dry-run
"""
from __future__ import annotations

import argparse

from src.core.logging import get_logger
from src.core.supabase import get_service_client

log = get_logger("nextdays.backfill.direct_reservation_contact")

_PAGE = 500


def _tenant_ids(db) -> list[str]:  # noqa: ANN001
    rows = db.table("tenants").select("id").execute().data or []
    return [r["id"] for r in rows]


def backfill(*, dry_run: bool = False) -> dict[str, int]:
    db = get_service_client()
    total = {"scanned": 0, "filled": 0, "skipped": 0}
    for tenant_id in _tenant_ids(db):
        offset = 0
        while True:
            rows = (
                db.table("reservations")
                .select(
                    "id, guest_id, guest_email, guest_phone, guest_language, "
                    "guests(email, phone, language)"
                )
                .eq("tenant_id", tenant_id)
                .is_("source_channex_booking_id", "null")
                .not_.is_("guest_id", "null")
                .range(offset, offset + _PAGE - 1)
                .execute()
            ).data or []
            if not rows:
                break
            for r in rows:
                total["scanned"] += 1
                guest = r.get("guests") or {}
                patch: dict[str, str] = {}
                # Nur LEERE Felder ergänzen (nie überschreiben).
                if not r.get("guest_email") and guest.get("email"):
                    patch["guest_email"] = guest["email"]
                if not r.get("guest_phone") and guest.get("phone"):
                    patch["guest_phone"] = guest["phone"]
                if not r.get("guest_language") and guest.get("language"):
                    patch["guest_language"] = guest["language"]
                if not patch:
                    total["skipped"] += 1
                    continue
                if dry_run:
                    total["filled"] += 1
                    continue
                db.table("reservations").update(patch).eq(
                    "tenant_id", tenant_id
                ).eq("id", r["id"]).execute()
                total["filled"] += 1
            offset += _PAGE
    log.info("backfill_direct_reservation_contact_done", dry_run=dry_run, **total)
    return total


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill Direktbuchungs-Kontakt aus guests"
    )
    parser.add_argument("--dry-run", action="store_true", help="nur zählen, nichts schreiben")
    args = parser.parse_args()
    result = backfill(dry_run=args.dry_run)
    print(  # noqa: T201 — bewusster CLI-Output
        f"{'[dry-run] ' if args.dry_run else ''}"
        f"scanned={result['scanned']} filled={result['filled']} skipped={result['skipped']}"
    )


if __name__ == "__main__":
    main()
