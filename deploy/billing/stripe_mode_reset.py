#!/usr/bin/env python3
"""Stripe-Kennungen aus dem ALTEN Modus aus der DB nehmen (Test → Live).

WARUM DAS SEIN MUSS: Stripe trennt Test und Live vollständig. Ein
`acct_…`/`cus_…`/`sub_…` aus dem Testmodus existiert live nicht. Bleibt es in der
DB stehen, ist der Schaden nicht „ein Fehler beim Aufruf", sondern eine LÜGE im
Zustand: `tenant_billing_profile.stripe_charges_enabled = true` sagt der
Oberfläche „dieser Betrieb kann Geld einnehmen", während jeder Charge live mit
„No such account" scheitert. Der Betrieb sieht eine Buchung, der Gast eine
Fehlermeldung, und niemand weiß, warum.

WAS ZURÜCKGESETZT WIRD — nur ZEIGER, kein Protokoll:
  * `tenant_billing_profile`: Connect-Account + die gespiegelten KYC-Flags. Der
    Betrieb muss sich live neu verbinden (das ist unvermeidbar: Stripe verlangt
    für ein Live-Konto echte Identitätsdaten, die im Testmodus nie erhoben
    wurden).
  * `tenant_subscription`: Kunde + Abo. Das Abo wird live neu angelegt.
  * `tenant_module_entitlement`: die Abo-Positionen dazu.
  * `cohost_stripe_accounts`: Auszahlungskonten der Co-Hosts.

WAS BLEIBT: `payments`, `payouts`, `commission_ledger`, `cohost_payouts` — das
ist Buchungs-/Zahlungsprotokoll. Es zu leeren wäre Geschichtsfälschung; eine
Testzahlung lässt sich live ohnehin nicht erstatten. Die Zeilen tragen ihre alten
Kennungen weiter, und genau das ist richtig: sie dokumentieren, was im Testmodus
passiert ist.

AUSFÜHRUNG (vom Repo-Root; ohne --apply nur Bericht):
    apps/api/.venv/bin/python deploy/billing/stripe_mode_reset.py
    apps/api/.venv/bin/python deploy/billing/stripe_mode_reset.py --apply

Reihenfolge der Umstellung: ERST diesen Reset, DANN den Live-Key setzen. Wer
umgekehrt vorgeht, hat zwischenzeitlich eine Oberfläche, die falsche
Verkaufsbereitschaft anzeigt.
"""
# pylint: disable=wrong-import-position,wrong-import-order,import-error
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
API = ROOT / "apps" / "api"
sys.path.insert(0, str(API))

ENV = API / ".env"
if ENV.exists():
    for zeile in ENV.read_text(encoding="utf-8").splitlines():
        if "=" in zeile and not zeile.lstrip().startswith("#"):
            schluessel, _, wert = zeile.partition("=")
            os.environ.setdefault(schluessel.strip(), wert.strip().strip('"').strip("'"))

from src.core.supabase import get_service_client  # noqa: E402

# Tabelle → (Schlüsselspalte, zu leerende Felder, Kennungs-Spalte für den Bericht)
#
# Die Schlüsselspalte ist NICHT überall `id`: `tenant_billing_profile` und
# `tenant_subscription` haben `tenant_id` als Primärschlüssel (ein Profil je
# Betrieb), `cohost_stripe_accounts` hat `user_id`. Mit hart kodiertem `id` bricht
# jede Abfrage mit „column does not exist" ab — und ein Reset, der nichts findet,
# sieht aus wie „schon erledigt".
ZURUECKSETZEN: tuple[tuple[str, str, dict[str, Any], str], ...] = (
    (
        "tenant_billing_profile",
        "tenant_id",
        {
            "stripe_account_id": None,
            # Die Flags sind ein SPIEGEL des Stripe-Kontos. Ohne Konto sind sie
            # false — nicht null: die Oberfläche liest sie als „kann verkaufen?",
            # und ein null würde dort wieder zu einer Annahme (Wurzel 4).
            "stripe_charges_enabled": False,
            "stripe_payouts_enabled": False,
            "stripe_details_submitted": False,
            "stripe_onboarding_at": None,
            "stripe_sync_error": None,
        },
        "stripe_account_id",
    ),
    (
        "tenant_subscription",
        "tenant_id",
        {"stripe_customer_id": None, "stripe_subscription_id": None},
        "stripe_subscription_id",
    ),
    (
        "tenant_module_entitlement",
        "id",
        {"stripe_subscription_item_id": None},
        "stripe_subscription_item_id",
    ),
    (
        "cohost_stripe_accounts",
        "user_id",
        {"stripe_account_id": None},
        "stripe_account_id",
    ),
)


def main() -> None:
    apply = "--apply" in sys.argv
    db = get_service_client()
    print("Stripe-Modus-Reset" + ("" if apply else " (DRY-RUN, nichts wird geschrieben)"))
    gesamt = 0
    for tabelle, schluessel, felder, kennung in ZURUECKSETZEN:
        try:
            rows = (
                db.table(tabelle)
                .select(f"{schluessel}, {kennung}")
                .not_.is_(kennung, "null")
                .limit(500)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — Tabelle fehlt = nichts zu tun
            print(f"  · {tabelle}: nicht lesbar ({str(exc)[:70]})")
            continue
        if not rows:
            print(f"  · {tabelle}: keine Kennung gespeichert")
            continue
        print(f"  {'→' if apply else '?'} {tabelle}: {len(rows)} Zeile(n) — "
              f"{', '.join(str(r.get(kennung)) for r in rows[:5])}"
              f"{' …' if len(rows) > 5 else ''}")
        gesamt += len(rows)
        if not apply:
            continue
        for row in rows:
            db.table(tabelle).update(felder).eq(
                schluessel, row[schluessel]
            ).execute()
    print()
    if not gesamt:
        print("Nichts zurückzusetzen.")
        return
    if apply:
        print(f"{gesamt} Zeile(n) zurückgesetzt. Jeder Betrieb muss sich im "
              f"Live-Modus neu verbinden (Konto → Zahlungen), das Abo wird beim "
              f"nächsten Aufruf live neu angelegt.")
    else:
        print(f"{gesamt} Zeile(n) WÜRDEN zurückgesetzt. Mit --apply ausführen.")


if __name__ == "__main__":
    main()
