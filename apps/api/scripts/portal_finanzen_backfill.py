"""Bestandsbefüllung der Portal-Zerlegung (0366) für vorhandene OTA-Buchungen.

WOZU: Die Zerlegung wird seit 0366 beim Buchungsimport geschrieben. Die
Buchungen, die VOR dieser Änderung ankamen, haben keine — ihre Abrechnung
zeigte sonst nichts, obwohl die Daten im Payload vorliegen.

WARUM ÜBER DEN ECHTEN CODE: das Skript ruft `zerlegung_ermitteln` /
`zerlegung_speichern` auf, nicht eigenes SQL. Eine zweite Implementierung der
Geldformel für die Bestandsdaten wäre genau der Fehler, den 0366 behebt — sie
liefe mit der Zeit auseinander, und niemand könnte sagen, welche Zahl gilt.

IDEMPOTENT (Wurzel 2): der Kopf geht per `upsert` auf den Primärschlüssel, die
Posten werden ersetzt statt ergänzt. Mehrfach laufen lassen ist gefahrlos.

AUSFÜHRUNG (vom apps/api-Verzeichnis, braucht die Server-Umgebung):
    python scripts/portal_finanzen_backfill.py --dry-run   # nur zeigen
    python scripts/portal_finanzen_backfill.py             # schreiben
    python scripts/portal_finanzen_backfill.py --tenant <uuid>

`--dry-run` schreibt NICHTS und ist der Normalfall für den ersten Durchlauf:
die Zerlegung kann an fehlender Datenpflege scheitern (unzugeordnete
Gebührenart, kein Portal-Satz), und das will man SEHEN, bevor Zeilen entstehen.
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from src.core.supabase import get_service_client
from src.features.owner_billing.service import OwnerBillingService
from src.features.owner_statements.common import PayoutUnbekannt
from src.features.owner_statements.gebuehren_quelle import klassifikation_laden
from src.features.owner_statements.portal_finanzen import (
    zerlegung_ermitteln,
    zerlegung_speichern,
)

if TYPE_CHECKING:  # nur für die Signaturen — zur Laufzeit nicht gebraucht
    from supabase import Client

_RES_SPALTEN = (
    "id, tenant_id, property_id, check_in, check_out, total_amount, currency, "
    "ota_commission, payment_collect, channel, source_channex_booking_id, "
    # `pets` entscheidet, ob die Haustiergebühr aus den Objekt-Stammdaten
    # überhaupt anfiel (siehe `objekt_gebuehren`). Ohne die Spalte legte der
    # Backfill sie auf jede Buchung.
    "pets"
)


def _naechte(check_in: object, check_out: object) -> int:
    def als_datum(w: object) -> date | None:
        if isinstance(w, date):
            return w
        try:
            return date.fromisoformat(str(w))
        except (TypeError, ValueError):
            return None

    a, b = als_datum(check_in), als_datum(check_out)
    return (b - a).days if a and b else 0


def _payloads(db: Client, tenant_id: str) -> dict[str, dict[str, Any]]:
    """Die Channex-Payloads je `channex_booking_id`.

    Einmal für alle Buchungen geladen, nicht je Buchung: bei 226 Buchungen
    wären das sonst 226 Rundreisen.
    """
    rows = (
        db.table("channex_booking")
        .select("channex_booking_id, raw")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    return {str(r["channex_booking_id"]): r.get("raw") for r in rows}


def _stammdaten(db: Client, tenant_id: str) -> dict[str, Any]:
    rows = (
        db.table("properties")
        .select("id, type_attributes")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    return {str(r["id"]): r.get("type_attributes") for r in rows}


def backfill(tenant_id: str, *, dry_run: bool) -> int:
    """Alle OTA-Buchungen eines Betriebs zerlegen. Rückgabe: Anzahl Fehler."""
    db = get_service_client()
    billing = OwnerBillingService(service_client=db)
    klassifikation = klassifikation_laden(db, tenant_id)
    payloads = _payloads(db, tenant_id)
    stammdaten = _stammdaten(db, tenant_id)

    reservations = (
        db.table("reservations")
        .select(_RES_SPALTEN)
        .eq("tenant_id", tenant_id)
        .not_.is_("source_channex_booking_id", "null")
        .execute()
    ).data or []

    # Portal-Sätze einmal je (Kanal, Objekt, Stichtag) auflösen statt je Buchung.
    satz_cache: dict[tuple[str, str, str], dict[str, Any] | None] = {}
    gruende: Counter[str] = Counter()
    geschrieben = 0
    summe_brutto = Decimal("0")

    for r in reservations:
        rid = str(r["id"])
        pid = str(r.get("property_id") or "")
        kanal = str(r.get("channel") or "").lower()
        stichtag = r.get("check_out")
        schluessel = (kanal, pid, str(stichtag))
        if schluessel not in satz_cache:
            try:
                tag = (
                    stichtag
                    if isinstance(stichtag, date)
                    else date.fromisoformat(str(stichtag))
                )
            except (TypeError, ValueError):
                tag = None
            satz_cache[schluessel] = (
                billing.portal_satz_aufloesen(tenant_id, kanal, pid, tag)
                if tag
                else None
            )
        try:
            finanzen = zerlegung_ermitteln(
                reservation=r,
                raw=payloads.get(str(r.get("source_channex_booking_id") or "")),
                type_attributes=stammdaten.get(pid),
                klassifikation=klassifikation,
                naechte=_naechte(r.get("check_in"), r.get("check_out")),
                satz=satz_cache[schluessel],
            )
        except PayoutUnbekannt as exc:
            gruende[exc.grund] += 1
            print(f"  offen  {rid[:8]} [{kanal}] {exc.grund}: {exc.message[:80]}")
            continue
        if not dry_run:
            zerlegung_speichern(db, finanzen)
        geschrieben += 1
        summe_brutto += finanzen.brutto

    print()
    print(f"Buchungen        : {len(reservations)}")
    print(f"Zerlegt          : {geschrieben}" + ("  (dry-run)" if dry_run else ""))
    print(f"Summe Gastpreis  : {summe_brutto}")
    if gruende:
        print("Offen nach Grund :")
        for grund, n in gruende.most_common():
            print(f"  {n:>4}x  {grund}")
    return sum(gruende.values())


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--tenant", help="Nur dieser Betrieb (UUID).")
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Nichts schreiben, nur zeigen, was entstehen würde.",
    )
    args = p.parse_args()

    db = get_service_client()
    if args.tenant:
        tenants = [args.tenant]
    else:
        rows = (db.table("tenants").select("id, name").execute()).data or []
        tenants = [str(r["id"]) for r in rows]

    offen = 0
    for tid in tenants:
        print(f"\n=== Betrieb {tid} ===")
        offen += backfill(tid, dry_run=args.dry_run)
    # Exit 1, wenn Buchungen offen blieben: im Zweifel soll ein Aufrufer
    # (Mensch oder Cron) das SEHEN, statt einen stillen Teilerfolg zu bekommen.
    return 1 if offen else 0


if __name__ == "__main__":
    sys.exit(main())
