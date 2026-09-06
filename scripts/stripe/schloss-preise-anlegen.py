#!/usr/bin/env python3
"""Stripe-Preise der Schloss-Anbieter anlegen (0577).

WARUM EIN SKRIPT UND NICHT IM CODE: Preise sind Stammdaten in Stripe, keine
Laufzeitkonfiguration. Sie einmal anzulegen ist ein bewusster Vorgang mit
Geldbezug — der gehört nicht in einen Startup-Pfad, der bei jedem Deploy läuft.

WARUM DER NUTZER DAS AUSFÜHRT UND NICHT DIE ENTWICKLUNGSUMGEBUNG: Der echte
Stripe-Schlüssel liegt nur in Coolify; die lokale `.env` trägt `changeme`. Ein
Skript, das mit dem Live-Key schreibt, wird vom Betreiber gestartet, nicht
nebenbei.

IDEMPOTENT (Wurzel 2): Anker ist der `lookup_key` je Anbieter. Ein zweiter Lauf
findet den vorhandenen Preis und legt keinen zweiten an. Das ist wichtig, weil
ein doppelter Preis in Stripe nicht löschbar ist (nur deaktivierbar) und die
Preisliste dann zwei Kandidaten fände.

AUFRUF (aus dem Repo-Wurzelverzeichnis):

    STRIPE_SECRET_KEY=sk_live_… uv run --project apps/api \\
        python scripts/stripe/schloss-preise-anlegen.py

    # Erst ansehen, nichts schreiben:
    STRIPE_SECRET_KEY=sk_live_… uv run --project apps/api \\
        python scripts/stripe/schloss-preise-anlegen.py --probe

Der Preis steht in `SCHLOSS_PREIS_JE_GERAET` (apps/api/.../subscriptions/
schemas.py) — 3,00 EUR und die festgelegten Gegenwerte. Er wird hier NICHT
neu erfunden: eine zweite Preis-Wahrheit wäre genau der Fehler, den die
Preisliste vermeidet (Wurzel 4).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Das Backend liegt nicht im Pfad, wenn das Skript aus dem Repo-Wurzel läuft.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "api"))

from src.features.subscriptions.schemas import (  # noqa: E402
    SCHLOSS_ANBIETER,
    SCHLOSS_PREIS_JE_GERAET,
    SCHLOSS_PRICE_LOOKUP,
    schloss_modul_key,
)
from stripe import (
    StripeClient,  # noqa: E402
    StripeError,  # noqa: E402
)

# Anzeigename je Kennung — muss zu `web/lib/schloss-anbieter.ts` passen.
# Steht hier und nicht im Backend-Katalog, weil nur dieses Skript ihn braucht:
# Stripe zeigt den Produktnamen auf der Rechnung des Kunden.
NAMEN: dict[str, str] = {
    "igloohome": "igloohome",
    "nuki": "Nuki",
    "ttlock": "TTLock",
    "yale": "Yale",
    "august": "August",
    "tedee": "Tedee",
    "schlage": "Schlage",
    "kwikset": "Kwikset",
    "lockly": "Lockly",
    "smartthings": "SmartThings",
    "akiles": "Akiles",
    "ultraloq": "Ultraloq",
    "wyze": "Wyze",
    "keyincode": "KeyInCode",
    "korelock": "KoreLock",
    "sifely": "Sifely",
    "dusaw": "Dusaw",
    "yacan": "Yacan",
    "thirty_three_lock": "33Lock",
    "dormakaba_oracode": "dormakaba Oracode",
    "keynest": "KeyNest",
    "salto_ks": "Salto KS",
    "salto_space": "Salto Space",
    "assa_abloy_vostio": "ASSA ABLOY Vostio",
    "assa_abloy_credential_service": "ASSA ABLOY Credential Service",
    "dormakaba_ambiance": "dormakaba Ambiance",
    "dormakaba_community": "dormakaba Community",
    "visionline": "ASSA ABLOY Visionline",
    "hotek": "Hotek",
    "latch": "Latch",
    "brivo": "Brivo",
    "legic_connect": "LEGIC Connect",
}

# Die Leitwährung des Preises. Die übrigen kommen als `currency_options`, damit
# ein Betrieb in Dänemark denselben Preis in DKK sieht — ohne Tageskurs
# (Wurzel 4: kein geschätzter Umrechnungskurs).
LEITWAEHRUNG = "EUR"


def _cent(betrag: float) -> int:
    """Betrag in die kleinste Einheit. Stripe rechnet in Cent/Øre."""
    return int(round(betrag * 100))


def _vorhandener_preis(stripe: StripeClient, lookup: str) -> str | None:
    """Die Preis-ID zu diesem lookup_key, falls es sie schon gibt."""
    res = stripe.v1.prices.list(
        params={"lookup_keys": [lookup], "active": True, "limit": 1}
    )
    daten = getattr(res, "data", None) or []
    return getattr(daten[0], "id", None) if daten else None


def _produkt_finden(stripe: StripeClient, kennung: str) -> str | None:
    """Ein Produkt mit dieser Metadaten-Kennung, falls vorhanden.

    Über `metadata` und nicht über den Namen: der Name ist Anzeigetext und
    kann sich ändern, die Kennung ist der Schlüssel.
    """
    res = stripe.v1.products.search(
        params={"query": f'metadata["schloss_anbieter"]:"{kennung}"', "limit": 1}
    )
    daten = getattr(res, "data", None) or []
    return getattr(daten[0], "id", None) if daten else None


def anlegen(stripe: StripeClient, kennung: str, *, probe: bool) -> str:
    """Produkt und Preis eines Anbieters sicherstellen. Gibt eine Statuszeile."""
    modul = schloss_modul_key(kennung)
    lookup = SCHLOSS_PRICE_LOOKUP[modul]
    name = NAMEN.get(kennung, kennung)

    vorhanden = _vorhandener_preis(stripe, lookup)
    if vorhanden:
        return f"  ✓ {name:32s} Preis besteht schon ({vorhanden})"
    if probe:
        return f"  + {name:32s} würde angelegt ({lookup})"

    produkt = _produkt_finden(stripe, kennung)
    if produkt is None:
        prod = stripe.v1.products.create(
            params={
                "name": f"Schlösser: {name}",
                "description": (
                    f"Türcodes je Buchung für {name}-Schlösser. Der Betrieb "
                    "verbindet sein eigenes Hersteller-Konto."
                ),
                "metadata": {"schloss_anbieter": kennung, "modul": modul},
            }
        )
        produkt = str(getattr(prod, "id", ""))

    # Die übrigen Währungen als currency_options — ein Preis, viele Währungen.
    # Getrennte Preise je Währung hätten bedeutet, dass die Preisliste je
    # Währung einen anderen lookup_key suchen muss.
    optionen = {
        w.lower(): {"unit_amount": _cent(b)}
        for w, b in SCHLOSS_PREIS_JE_GERAET.items()
        if w != LEITWAEHRUNG
    }
    preis = stripe.v1.prices.create(
        params={
            "product": produkt,
            "currency": LEITWAEHRUNG.lower(),
            "unit_amount": _cent(SCHLOSS_PREIS_JE_GERAET[LEITWAEHRUNG]),
            "recurring": {"interval": "month"},
            "lookup_key": lookup,
            "currency_options": optionen,
            "metadata": {"schloss_anbieter": kennung, "modul": modul},
        }
    )
    return f"  ✓ {name:32s} angelegt ({getattr(preis, 'id', '?')})"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Stripe-Preise der Schloss-Anbieter anlegen (idempotent)."
    )
    parser.add_argument(
        "--probe",
        action="store_true",
        help="Nur zeigen, was passieren würde — nichts in Stripe schreiben.",
    )
    args = parser.parse_args()

    schluessel = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    if not schluessel or schluessel == "changeme":
        print(
            "STRIPE_SECRET_KEY fehlt oder ist ein Platzhalter.\n"
            "Der echte Schlüssel liegt in Coolify — dieses Skript startet der "
            "Betreiber, nicht die Entwicklungsumgebung.",
            file=sys.stderr,
        )
        return 2

    live = schluessel.startswith(("sk_live", "rk_live"))
    print(
        f"Stripe: {'PRODUKTION' if live else 'Test'} · "
        f"{len(SCHLOSS_ANBIETER)} Anbieter · "
        f"{SCHLOSS_PREIS_JE_GERAET[LEITWAEHRUNG]:.2f} {LEITWAEHRUNG} monatlich"
    )
    if args.probe:
        print("PROBE — es wird nichts geschrieben.\n")
    elif live:
        # Kein automatisches Weiterlaufen gegen Produktion: ein Preis in Stripe
        # ist nicht löschbar, nur deaktivierbar.
        antwort = input("Gegen das PRODUKTIONS-Konto schreiben? [ja/nein] ")
        if antwort.strip().lower() not in {"ja", "j", "yes", "y"}:
            print("Abgebrochen.")
            return 1
        print()

    stripe = StripeClient(schluessel)
    fehler = 0
    for kennung in SCHLOSS_ANBIETER:
        try:
            print(anlegen(stripe, kennung, probe=args.probe))
        except StripeError as exc:
            # Ein Anbieter darf die übrigen nicht stoppen (Wurzel 5) — der
            # Zähler macht es am Ende sichtbar, statt es zu verschlucken.
            fehler += 1
            print(f"  ✗ {kennung:32s} {exc}", file=sys.stderr)

    print(
        f"\nFertig: {len(SCHLOSS_ANBIETER) - fehler} von "
        f"{len(SCHLOSS_ANBIETER)} in Ordnung"
        + (f", {fehler} mit Fehler" if fehler else "")
    )
    return 1 if fehler else 0


if __name__ == "__main__":
    raise SystemExit(main())
