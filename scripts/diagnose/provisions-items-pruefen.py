"""Hängende Provisions-/Nutzungs-Invoice-Items bei Stripe finden.

WARUM ES DAS GIBT (Befund 01.09.2026): Ein Invoice-Item, dessen Währung nicht
zur Währung des Stripe-Kunden passt, landet auf KEINER Rechnung. Stripe meldet
das nicht — kein Fehler, kein Ereignis, kein Webhook. Das Item bleibt mit
invoice=null liegen, der Ledger steht auf 'invoiced', das Log sagt
'commissions_billed'. Live hingen so 1.868,80 DKK; gemeldet hat es kein System,
sondern der Betreiber ("keine Abrechnung funktioniert").

Exit 1, sobald ein Posten länger als KARENZ_TAGE ohne Rechnung liegt.

Aufruf: uv run python scripts/diagnose/provisions-items-pruefen.py
Nötig:  STRIPE_SECRET_KEY in apps/api/.env
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from pathlib import Path

KARENZ_TAGE = int(os.environ.get("KARENZ_TAGE", "40"))
UNSERE = ("OTA-Provision", "Dynamische Preise")


def schluessel() -> str:
    datei = Path(__file__).resolve().parents[2] / "apps" / "api" / ".env"
    if not datei.exists():
        sys.exit(f"FEHLER: {datei} nicht gefunden")
    for zeile in datei.read_text().splitlines():
        if zeile.startswith("STRIPE_SECRET_KEY="):
            wert = zeile.split("=", 1)[1].strip()
            if wert and wert != "changeme":
                return wert
    sys.exit("FEHLER: STRIPE_SECRET_KEY nicht gesetzt")


def offene_posten(key: str) -> list[dict]:
    """Alle Invoice-Items ohne Rechnung, über alle Seiten."""
    posten: list[dict] = []
    url = "https://api.stripe.com/v1/invoiceitems?pending=true&limit=100"
    while url:
        req = urllib.request.Request(url)  # noqa: S310 — feste Stripe-URL
        import base64
        auth = base64.b64encode(f"{key}:".encode()).decode()
        req.add_header("Authorization", f"Basic {auth}")
        with urllib.request.urlopen(req, timeout=20) as resp:  # noqa: S310
            daten = json.load(resp)
        if "error" in daten:
            sys.exit(f"STRIPE-FEHLER: {daten['error'].get('message')}")
        posten.extend(daten.get("data", []))
        if not daten.get("has_more"):
            break
        letzte = posten[-1]["id"]
        url = (
            "https://api.stripe.com/v1/invoiceitems"
            f"?pending=true&limit=100&starting_after={letzte}"
        )
    return posten


def main() -> int:
    print(f"== Abrechnungsposten ohne Rechnung (Karenz: {KARENZ_TAGE} Tage) ==")
    jetzt = time.time()
    haengend = []
    for it in offene_posten(schluessel()):
        if it.get("invoice") is not None:
            continue
        if not (it.get("description") or "").startswith(UNSERE):
            continue
        haengend.append((it, (jetzt - it["date"]) / 86400))

    if not haengend:
        print("OK — kein hängender Abrechnungsposten.")
        return 0

    ueberfaellig = 0
    for it, alter in sorted(haengend, key=lambda x: -x[1]):
        marke = "HAENGT" if alter > KARENZ_TAGE else "offen "
        ueberfaellig += alter > KARENZ_TAGE
        print(
            f"  [{marke}] {it['id']} | {it['amount'] / 100:.2f} "
            f"{it['currency'].upper()} | {alter:.0f} Tage | "
            f"{it.get('description')} | Kunde {it.get('customer')}"
        )

    if ueberfaellig:
        print(
            f"\nFEHLER: {ueberfaellig} Posten länger als {KARENZ_TAGE} Tage "
            "ohne Rechnung. Häufigste Ursache: die Währung des Postens passt "
            "nicht zur Währung des Stripe-Kunden (customer.currency) — dann "
            "nimmt Stripe ihn auf keine Rechnung und meldet nichts.",
            file=sys.stderr,
        )
        return 1
    print("\nOK — alle Posten innerhalb der Karenz.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
