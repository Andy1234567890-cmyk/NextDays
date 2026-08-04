#!/usr/bin/env python3
"""E2E: Modul „Dynamische Preise" buchen und kündigen — live gegen die Server-DB.

WARUM DIESES SKRIPT: die Unit-Tests laufen gegen einen DB-Fake, der keine
CHECK-Constraints kennt. Genau dort steckte der Fehler: `module_key` durfte laut
`tenant_module_entitlement_module_key_check` (0117/0256) nur die vier Abo-Module
enthalten — `dynamische_preise` schlug live mit 23514 fehl, obwohl 1454 Tests
grün waren. Migration 0278 erweitert den CHECK; dieses Skript beweist es an der
echten DB, ohne Stripe zu berühren (das Modul ist nutzungsabhängig, `add_module`
schreibt für es NUR das Entitlement).

GEPRÜFT WIRD die Kette, an der das Modul hängt:
  1. Ausgangslage: Modul NICHT gebucht (fail-closed).
  2. `dp_settings.enabled = true` wird mit **402** abgelehnt.
  3. `GET /pricing/overview` meldet `module_active = false` (UI: Verkaufsseite).
  4. `add_module` schreibt das Entitlement — hier schlug es vor 0278 fehl.
  5. Danach: `module_active = true`, `enabled = true` wird gespeichert.
  6. `remove_module` nimmt es sofort zurück (nichts vorausbezahlt).
  7. Aufräumen: Entitlement-Zeile und dp_settings wieder wie vorgefunden.

AUSFÜHRUNG (vom Repo-Root, braucht apps/api/.env mit Server-DB):
    apps/api/.venv/bin/python scripts/subscriptions/e2e_modul_dynamische_preise.py
"""
# pylint: disable=wrong-import-position,wrong-import-order,import-error
# import-error: die src-Module liegen erst nach dem sys.path-Eintrag unten im
# Suchpfad — pylint löst das statisch nicht auf (wie scripts/channex/*).
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = ROOT / "apps" / "api"
sys.path.insert(0, str(API))

# .env laden, BEVOR die Settings-Klasse importiert wird.
for zeile in (API / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in zeile and not zeile.lstrip().startswith("#"):
        schluessel, _, wert = zeile.partition("=")
        os.environ.setdefault(schluessel.strip(), wert.strip().strip('"').strip("'"))

from src.core.security import AuthContext  # noqa: E402
from src.core.supabase import get_service_client  # noqa: E402
from src.features.pricing.resolver import PricingError  # noqa: E402
from src.features.pricing.schemas import DpSettingsUpdate  # noqa: E402
from src.features.pricing.settings_service import DpSettingsService  # noqa: E402
from src.features.subscriptions.entitlements import modul_aktiv  # noqa: E402
from src.features.subscriptions.schemas import (  # noqa: E402
    DYNPRICING_MODULE_KEY,
)
from src.features.subscriptions.service import SubscriptionsService  # noqa: E402
from supabase import Client  # noqa: E402

OK = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"


class Pruefung:
    """Zählt Treffer und Fehlschläge, damit der Exit-Code die Wahrheit sagt."""

    def __init__(self) -> None:
        self.gut = 0
        self.schlecht = 0

    def gleich(self, name: str, ist: object, soll: object) -> None:
        if ist == soll:
            self.gut += 1
            print(f"  {OK} {name}: {ist!r}")
        else:
            self.schlecht += 1
            print(f"  {FAIL} {name}: ist {ist!r}, soll {soll!r}")


def tenant_mit_abo(db: Client) -> tuple[str, str]:
    """Ein Betrieb mit laufendem Abo + Stripe-Kunde (Vorbedingung von add_module)."""
    rows = (
        db.table("tenant_subscription")
        .select("tenant_id, status, stripe_customer_id")
        .in_("status", ["active", "trialing", "past_due"])
        .not_.is_("stripe_customer_id", "null")
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        sys.exit(
            "Kein Betrieb mit laufendem Abo + Stripe-Kunde in der DB — "
            "ohne den greift add_module bewusst mit 422 (Wurzel 5)."
        )
    tenant_id = rows[0]["tenant_id"]
    users = (
        db.table("users")
        .select("id")
        .eq("tenant_id", tenant_id)
        .in_("role", ["admin", "co_admin"])
        .limit(1)
        .execute()
    ).data or []
    if not users:
        sys.exit(f"Betrieb {tenant_id} hat keinen admin/co_admin.")
    return tenant_id, users[0]["id"]


def objekt_des_tenants(db: Client, tenant_id: str) -> str | None:
    rows = (
        db.table("properties")
        .select("id")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    return rows[0]["id"] if rows else None


def main() -> int:  # noqa: PLR0915  (ein linearer Prüfablauf, kein Zerlegen)
    db = get_service_client()
    if db is None:
        sys.exit("Kein Service-Client — apps/api/.env prüfen.")
    tenant_id, user_id = tenant_mit_abo(db)
    ctx = AuthContext(user_id=user_id, tenant_id=tenant_id, role="admin")
    subs = SubscriptionsService(service_client=db)
    dps = DpSettingsService(service_client=db)
    prop_id = objekt_des_tenants(db, tenant_id)
    print(f"Betrieb {tenant_id}, Objekt {prop_id}")

    vorher = (
        db.table("tenant_module_entitlement")
        .select("active")
        .eq("tenant_id", tenant_id)
        .eq("module_key", DYNPRICING_MODULE_KEY)
        .execute()
    ).data or []
    if vorher:
        sys.exit(
            "Der Betrieb hat das Modul schon (oder eine gekündigte Zeile) — "
            "dieses Skript würde echten Kundenzustand verändern. Abbruch."
        )
    dp_vorher = None
    if prop_id:
        dp_vorher = (
            db.table("dp_settings")
            .select("enabled")
            .eq("property_id", prop_id)
            .execute()
        ).data or []

    p = Pruefung()
    try:
        print("\n1) Ausgangslage — Modul nicht gebucht")
        p.gleich("modul_aktiv", modul_aktiv(db, tenant_id, DYNPRICING_MODULE_KEY), False)

        print("\n2) Einschalten ohne Modul → 402")
        if prop_id:
            try:
                dps.update(ctx, prop_id, DpSettingsUpdate(enabled=True))
                p.gleich("update(enabled=True)", "durchgelassen", "402")
            except PricingError as exc:
                p.gleich("update(enabled=True) → status_code", exc.status_code, 402)
        else:
            print("  – übersprungen: der Betrieb hat kein Objekt")

        print("\n3) overview.module_active vor der Buchung")
        p.gleich("module_active", dps.overview(ctx).module_active, False)

        print("\n4) add_module — der Schritt, der vor 0278 mit 23514 starb")
        ent = subs.add_module(ctx, module_key=DYNPRICING_MODULE_KEY)
        p.gleich("add_module.active", ent.active, True)
        zeile = (
            db.table("tenant_module_entitlement")
            .select("active, stripe_subscription_item_id")
            .eq("tenant_id", tenant_id)
            .eq("module_key", DYNPRICING_MODULE_KEY)
            .single()
            .execute()
        ).data
        p.gleich("DB-Zeile.active", zeile["active"], True)
        # Nutzungsabhängig → KEINE Stripe-Abo-Position (Faktura über den Ledger).
        p.gleich(
            "DB-Zeile.stripe_subscription_item_id",
            zeile["stripe_subscription_item_id"],
            None,
        )

        print("\n5) Wirkung — Gate offen")
        p.gleich("modul_aktiv", modul_aktiv(db, tenant_id, DYNPRICING_MODULE_KEY), True)
        p.gleich("module_active", dps.overview(ctx).module_active, True)
        if prop_id:
            res = dps.update(ctx, prop_id, DpSettingsUpdate(enabled=True))
            p.gleich("update(enabled=True).enabled", res.enabled, True)

        print("\n6) Kündigen — sofort aus (nichts vorausbezahlt)")
        weg = subs.remove_module(ctx, module_key=DYNPRICING_MODULE_KEY)
        p.gleich("remove_module.active", weg.active, False)
        p.gleich("modul_aktiv", modul_aktiv(db, tenant_id, DYNPRICING_MODULE_KEY), False)
        p.gleich("module_active", dps.overview(ctx).module_active, False)
    finally:
        print("\n7) Aufräumen")
        db.table("tenant_module_entitlement").delete().eq(
            "tenant_id", tenant_id
        ).eq("module_key", DYNPRICING_MODULE_KEY).execute()
        print(f"  {OK} Entitlement-Zeile entfernt")
        if prop_id and dp_vorher is not None:
            if dp_vorher:
                db.table("dp_settings").update(
                    {"enabled": dp_vorher[0]["enabled"]}
                ).eq("property_id", prop_id).execute()
                print(f"  {OK} dp_settings.enabled = {dp_vorher[0]['enabled']}")
            else:
                db.table("dp_settings").delete().eq(
                    "property_id", prop_id
                ).execute()
                print(f"  {OK} dp_settings-Zeile entfernt (gab es vorher nicht)")

    print(f"\n{p.gut} bestanden, {p.schlecht} fehlgeschlagen")
    return 1 if p.schlecht else 0


if __name__ == "__main__":
    sys.exit(main())
