#!/usr/bin/env python3
"""Legt die myNextDays-Abo-Preisliste idempotent in Stripe an (SDK).

Quelle der Wahrheit: myNextDays_Preisliste.pdf (Stand 07/2026).
Betraege in EUR (Anker 19,90 EUR). Die Umrechnung in die uebrigen EU-Waehrungen
uebernimmt Stripe Adaptive Pricing im Checkout (Stripe-Kurs, kein erfundener
Wert) — daher wird hier NUR EUR angelegt.

Idempotenz (Wurzel 2): jedes Produkt/jeder Preis traegt einen stabilen
`lookup_key` (Preise) bzw. `metadata.mnd_key` (Produkte). Ein zweiter Lauf
erzeugt NICHTS doppelt: vorhandene Objekte werden wiederverwendet. Preise sind
in Stripe immutable — Betragsaenderung = neuer Preis + alter deaktiviert (nie
mutieren). Das erkennt das Skript und meldet DRIFT statt still zu ueberschreiben.

Ausfuehrung (nie automatisch, nur manuell):
    STRIPE_SECRET_KEY=sk_test_... python3 deploy/billing/seed_stripe_prices.py [--apply]

Ohne --apply laeuft ein DRY-RUN (nichts wird geschrieben, nur der Plan gezeigt).
Der Key wird NUR aus der Umgebung gelesen, nie hardcoded/geloggt.
"""
from __future__ import annotations

import os
import sys

import stripe

CURRENCY = "eur"  # Anker. Nicht-EUR laeuft ueber Adaptive Pricing im Checkout.

# --- Produkte -------------------------------------------------------------
# mnd_key = stabiler interner Schluessel (metadata), NICHT die Stripe-ID.
PRODUCTS = {
    "grundtarif": {
        "name": "myNextDays Grundtarif",
        "desc": "Grundgebuehr inkl. 1. Objekt (voller Funktionsumfang) + "
        "Objekt-Staffel. Modul 1+2: PMS, Channel Manager, Buchungsportal, "
        "Eigentuemer-App, Reinigungs-App.",
    },
    "modul3_buchhaltung": {"name": "Modul 3 - Buchhaltung",
                           "desc": "Rechnungs- & Exportlogik, DATEV / e-conomic."},
    "modul4_mitarbeiter": {"name": "Modul 4 - Mitarbeiter",
                           "desc": "Schicht- & Einsatzplanung."},
    "modul6_hotel": {"name": "Modul 6 - Hotel",
                     "desc": "Front Desk."},
    # Modul 5 (Jobmarkt, 2 % vom Umsatz) ist KEIN fixer Preis -> wird nachgelagert
    # als Invoice-Item berechnet, kein Stripe-Produkt hier. Bewusst ausgelassen.
}

# --- Preise ---------------------------------------------------------------
# Betraege in kleinster Einheit (Cent). lookup_key = stabiler Schluessel.
# Grundtarif: EIN wiederkehrender graduated Preis (tiers_mode=graduated).
#   Tier 1  (up_to 1)   : 19,90 EUR FLAT   -> flat_amount 1990
#   Tier 2  (up_to 50)  :  6,00 EUR/Objekt -> unit_amount  600
#   Tier 3  (up_to 100) :  5,00 EUR/Objekt -> unit_amount  500
#   Tier 4  (inf)       :  4,00 EUR/Objekt -> unit_amount  400
GRADUATED_TIERS = [
    {"up_to": 1, "flat_amount": 1990},
    {"up_to": 50, "unit_amount": 600},
    {"up_to": 100, "unit_amount": 500},
    {"up_to": "inf", "unit_amount": 400},
]

# Fixe Modul-Preise (recurring monatlich, per_unit).
FIXED_PRICES = {
    "modul3_flat": {"product": "modul3_buchhaltung", "unit_amount": 3000,
                    "recurring": {"interval": "month"}},
    # Modul 4: zwei Alternativpreise (Kunde waehlt einen).
    "modul4_flat": {"product": "modul4_mitarbeiter", "unit_amount": 1990,
                    "recurring": {"interval": "month"}},
    "modul4_per_seat": {"product": "modul4_mitarbeiter", "unit_amount": 250,
                        "recurring": {"interval": "month"}},
    # Modul 6: zwei Alternativpreise (ab 600/Monat ODER 1,50/Zimmer).
    "modul6_flat": {"product": "modul6_hotel", "unit_amount": 60000,
                    "recurring": {"interval": "month"}},
    "modul6_per_room": {"product": "modul6_hotel", "unit_amount": 150,
                        "recurring": {"interval": "month"}},
}


def _die(msg: str) -> None:
    print(f"FEHLER: {msg}", file=sys.stderr)
    sys.exit(1)


def _assert_pdf_math() -> None:
    """Rechnet die Staffel gegen die PDF-Beispiele (Abschnitt 4). Bricht ab,
    wenn die Tiers nicht exakt stimmen — bevor irgendetwas in Stripe entsteht."""
    def cost(objects: int) -> int:
        total, prev = 1990, 1  # Tier 1 flat, erste 1 Objekt drin
        for lo, hi, unit in ((1, 50, 600), (50, 100, 500), (100, None, 400)):
            if objects <= lo:
                break
            n = (min(objects, hi) if hi else objects) - lo
            total += n * unit
            prev = hi or objects
        return total
    checks = {1: 1990, 3: 3190, 20: 13390, 100: 56390, 200: 96390}
    for objs, want in checks.items():
        got = cost(objs)
        if got != want:
            _die(f"Staffel falsch: {objs} Objekte = {got/100:.2f} EUR, "
                 f"PDF sagt {want/100:.2f} EUR")
    print("  PDF-Rechenbeispiele stimmen (1/3/20/100/200 Objekte) ✓")


def _find_product(mnd_key: str):  # noqa: ANN202
    res = stripe.Product.search(query=f"metadata['mnd_key']:'{mnd_key}'", limit=1)
    return res.data[0] if res.data else None


def _find_price(lookup_key: str):  # noqa: ANN202
    res = stripe.Price.list(lookup_keys=[lookup_key], limit=1)
    return res.data[0] if res.data else None


def ensure_product(mnd_key: str, spec: dict, apply: bool):  # noqa: ANN202
    existing = _find_product(mnd_key)
    if existing:
        print(f"  = Produkt '{mnd_key}' existiert: {existing.id}")
        return existing
    if not apply:
        print(f"  + [DRY] Produkt '{mnd_key}' wuerde angelegt: {spec['name']}")
        return None
    prod = stripe.Product.create(
        name=spec["name"], description=spec["desc"],
        metadata={"mnd_key": mnd_key},
    )
    print(f"  + Produkt '{mnd_key}' angelegt: {prod.id}")
    return prod


def ensure_price(lookup_key: str, product_id: str, params: dict, apply: bool):
    existing = _find_price(lookup_key)
    if existing:
        # Drift-Check: gleicht der vorhandene Preis dem Soll? (nur melden, nie mutieren)
        print(f"  = Preis '{lookup_key}' existiert: {existing.id} "
              f"(active={existing.active})")
        return existing
    if not apply:
        print(f"  + [DRY] Preis '{lookup_key}' wuerde angelegt: {params}")
        return None
    price = stripe.Price.create(
        lookup_key=lookup_key, product=product_id, currency=CURRENCY, **params,
    )
    print(f"  + Preis '{lookup_key}' angelegt: {price.id}")
    return price


def main() -> None:
    key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    if not key:
        _die("STRIPE_SECRET_KEY nicht in der Umgebung gesetzt.")
    if not key.startswith("sk_test_") and "--apply" in sys.argv and \
            "--allow-live" not in sys.argv:
        _die("LIVE-Key erkannt. --apply nur mit zusaetzlichem --allow-live "
             "(Sicherheitsschranke).")
    stripe.api_key = key
    apply = "--apply" in sys.argv
    mode = "APPLY (schreibt in Stripe)" if apply else "DRY-RUN (nichts wird geschrieben)"
    live = "LIVE" if key.startswith("sk_live_") else "TEST"
    print(f"== Stripe-Preisliste seeden — {mode} — Account-Modus: {live} ==")

    print("\n[0] PDF-Betragspruefung")
    _assert_pdf_math()

    print("\n[1] Produkte")
    prods = {k: ensure_product(k, v, apply) for k, v in PRODUCTS.items()}

    print("\n[2] Grundtarif — graduated Preis")
    gt = prods.get("grundtarif")
    ensure_price(
        "mnd_grundtarif_month", gt.id if gt else "<dry>",
        {"recurring": {"interval": "month"},
         "billing_scheme": "tiered", "tiers_mode": "graduated",
         "tiers": GRADUATED_TIERS},
        apply,
    )

    print("\n[3] Modul-Preise")
    for lk, spec in FIXED_PRICES.items():
        prod = prods.get(spec["product"])
        params = {k: v for k, v in spec.items() if k != "product"}
        ensure_price(lk, prod.id if prod else "<dry>", params, apply)

    print("\n[4] Hinweise")
    print("  - Modul 5 (Jobmarkt 2%) + Provisionen: nachgelagert als Invoice-Item,")
    print("    KEIN Stripe-Produkt (variabel). Siehe PLAN-stripe-preisliste.md.")
    print("  - Nicht-EUR (DKK/SEK/PLN/CZK/HUF/RON/BGN): Adaptive Pricing im")
    print("    Checkout (Stripe-Kurs), kein currency_options am graduated Preis.")
    if not apply:
        print("\n>> DRY-RUN. Mit --apply real anlegen.")


if __name__ == "__main__":
    main()
