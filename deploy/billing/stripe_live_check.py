#!/usr/bin/env python3
"""Ist Stripe für LIVE bereit? Liest nur, ändert nichts.

WARUM: „Key getauscht" ist keine Live-Schaltung. Stripe trennt Test und Live
vollständig — Connected Accounts, Kunden, Abos, Preise, Webhook-Endpunkte und
Zahlungsmethoden aus dem Testmodus existieren im Live-Modus NICHT. Wer nur den
Key umstellt, hat: keinen Webhook (Zahlungen bleiben ewig „pending"), keine
Preise (Abo-Anlage 404), und ein `acct_…` in der DB, das live niemand kennt —
während `stripe_charges_enabled = true` weiter behauptet, der Betrieb könne
verkaufen.

Dieses Skript prüft genau das, gegen den Key, der in der Umgebung steht:

  1. Modus (live/test) + Konto: Land, Standardwährung, `charges_enabled`,
     `details_submitted`, Connect-Capabilities.
  2. Webhook-Endpunkte in DIESEM Modus: URL und ob JEDES Event abgedeckt ist,
     das `payments/webhook.py` verarbeitet.
  3. Abo-Preise: existiert jeder `lookup_key` aus `subscriptions/schemas.py`
     bzw. `seed_stripe_prices.py` in diesem Modus?
  4. DB-Abgleich: gehören die gespeicherten Stripe-Kennungen zu DIESEM Modus?
     Nicht geraten — jede Kennung wird bei Stripe abgefragt. Ein „No such
     account" ist der Beweis für eine Kennung aus dem anderen Modus.
  5. Connect-Anlage (nur mit --probe-connect): legt einen Account an und löscht
     ihn sofort wieder. Nur so lässt sich beweisen, dass `type=custom` in diesem
     Modus überhaupt erlaubt ist — Stripe hat Custom für NEUE Integrationen
     abgekündigt, und eine Ablehnung erscheint erst beim ersten echten Versuch.

AUSFÜHRUNG (vom Repo-Root):
    apps/api/.venv/bin/python deploy/billing/stripe_live_check.py
    apps/api/.venv/bin/python deploy/billing/stripe_live_check.py --probe-connect

Der Key kommt AUSSCHLIESSLICH aus der Umgebung (`apps/api/.env` oder gesetzte
Variablen) und wird nie ausgegeben — im Bericht steht nur der Modus.
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

import stripe  # noqa: E402

from src.core.supabase import get_service_client  # noqa: E402
from src.features.subscriptions.schemas import (  # noqa: E402
    GRUNDTARIF_LOOKUP_KEY,
    MODULE_PRICE_LOOKUP,
)

# Alle Events, die `payments/webhook.py` wirklich verarbeitet (Stand: dort im
# `match`-Block). Fehlt eines am Live-Endpunkt, bleibt der zugehörige Zustand in
# der DB stehen — z. B. eine bezahlte Buchung dauerhaft auf „pending".
BENOETIGTE_EVENTS = (
    "account.updated",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.amount_capturable_updated",
    "charge.refunded",
    "charge.dispute.created",
    "charge.dispute.closed",
    "identity.verification_session.verified",
    "identity.verification_session.processing",
    "identity.verification_session.requires_input",
    "identity.verification_session.canceled",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
)

# Gespeicherte Stripe-Kennungen, die der Code für KÜNFTIGE Aktionen benutzt.
# (Historische `payments`-Zeilen bleiben außen vor: sie sind Protokoll, kein
# Zeiger, und ein Refund einer Testzahlung ist live ohnehin unmöglich.)
DB_ZEIGER: tuple[tuple[str, str, str], ...] = (
    ("tenant_billing_profile", "stripe_account_id", "account"),
    ("tenant_subscription", "stripe_customer_id", "customer"),
    ("tenant_subscription", "stripe_subscription_id", "subscription"),
    ("cohost_stripe_accounts", "stripe_account_id", "account"),
)

befunde: list[str] = []


def ok(text: str) -> None:
    print(f"  ✓ {text}")


def mangel(text: str) -> None:
    print(f"  ✗ {text}")
    befunde.append(text)


def hinweis(text: str) -> None:
    print(f"  · {text}")


def _modus(key: str) -> str:
    if key.startswith(("sk_live_", "rk_live_")):
        return "live"
    if key.startswith(("sk_test_", "rk_test_")):
        return "test"
    return "unbekannt"


def _abrufen(art: str, kennung: str) -> tuple[bool, str]:
    """Existiert diese Kennung im aktuellen Modus? (gefunden, Meldung)"""
    try:
        if art == "account":
            stripe.Account.retrieve(kennung)
        elif art == "customer":
            stripe.Customer.retrieve(kennung)
        else:
            stripe.Subscription.retrieve(kennung)
        return True, ""
    except stripe.InvalidRequestError as exc:
        return False, str(exc.user_message or exc)[:120]
    except stripe.StripeError as exc:  # noqa: BLE001 — Bericht statt Absturz
        return False, str(exc)[:120]


def main() -> None:  # pylint: disable=too-many-branches,too-many-statements
    probe = "--probe-connect" in sys.argv
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    if not key:
        sys.exit("STRIPE_SECRET_KEY fehlt in der Umgebung.")
    stripe.api_key = key
    modus = _modus(key)
    print(f"Stripe-Modus des gesetzten Keys: {modus.upper()}")
    if modus == "unbekannt":
        mangel("Key-Prefix ist weder sk_test_ noch sk_live_ — Modus unklar")

    # --- 1) Konto ----------------------------------------------------------
    print("\n1) Plattform-Konto")
    konto = stripe.Account.retrieve()
    print(f"  · Konto {konto.id}, Land {konto.country}, "
          f"Standardwährung {str(konto.default_currency).upper()}")
    if bool(konto.charges_enabled):
        ok("charges_enabled — das Plattformkonto darf abrechnen")
    else:
        mangel("charges_enabled ist FALSE: das Konto ist nicht aktiviert "
               "(Stripe-Dashboard → Konto aktivieren)")
    if bool(konto.details_submitted):
        ok("details_submitted — Kontoangaben vollständig")
    else:
        mangel("details_submitted ist FALSE: Angaben im Dashboard vervollständigen")
    # `capabilities` ist ein typisiertes Stripe-Objekt (Account.Capabilities),
    # kein dict: `dict(...)` liest es als Sequenz (KeyError: 0), `.get` gibt es
    # nicht. Zugriff daher über die Attribute.
    caps: Any = getattr(konto, "capabilities", None)
    for name in ("card_payments", "transfers"):
        zustand_cap = getattr(caps, name, None) if caps is not None else None
        if zustand_cap == "active":
            ok(f"Capability {name} aktiv")
        else:
            mangel(f"Capability {name} ist '{zustand_cap}' — ohne sie kein "
                   f"Charge bzw. keine Weiterleitung an den Betrieb")

    # --- 2) Webhooks -------------------------------------------------------
    print("\n2) Webhook-Endpunkte in diesem Modus")
    endpunkte = list(stripe.WebhookEndpoint.list(limit=100).auto_paging_iter())
    if not endpunkte:
        mangel("KEIN Webhook-Endpunkt registriert — Zahlungen würden nie "
               "bestätigt (payment_status bleibt 'pending')")
    for ep in endpunkte:
        events = set(ep.enabled_events or [])
        alles = "*" in events
        fehlend = [e for e in BENOETIGTE_EVENTS if not alles and e not in events]
        zustand = ep.status
        print(f"  · {ep.url}  (status={zustand}, {len(events)} Events)")
        if zustand != "enabled":
            mangel(f"Endpunkt {ep.url} ist nicht 'enabled'")
        if fehlend:
            mangel(f"Endpunkt {ep.url}: {len(fehlend)} Event(s) fehlen "
                   f"({', '.join(fehlend[:4])}{' …' if len(fehlend) > 4 else ''})")
        else:
            ok(f"Endpunkt {ep.url} deckt alle {len(BENOETIGTE_EVENTS)} "
               f"gebrauchten Events ab")
    if endpunkte:
        hinweis("Das Signing-Secret jedes Endpunkts ist modus-spezifisch: "
                "STRIPE_WEBHOOK_SECRET muss zum LIVE-Endpunkt gehören, sonst "
                "verwirft die Signaturprüfung jedes Ereignis (fail-closed).")

    # --- 3) Abo-Preise -----------------------------------------------------
    print("\n3) Abo-Preise (lookup_keys)")
    erwartet = [GRUNDTARIF_LOOKUP_KEY, *sorted(set(MODULE_PRICE_LOOKUP.values()))]
    for schluessel in erwartet:
        treffer = stripe.Price.list(lookup_keys=[schluessel], limit=1).data
        if treffer:
            preis = treffer[0]
            ok(f"{schluessel} → {preis.id} "
               f"({'aktiv' if preis.active else 'INAKTIV'})")
        else:
            mangel(f"Preis '{schluessel}' fehlt in diesem Modus — "
                   f"`deploy/billing/seed_stripe_prices.py --apply` mit dem "
                   f"LIVE-Key laufen lassen")

    # --- 4) DB-Zeiger ------------------------------------------------------
    print("\n4) Gespeicherte Stripe-Kennungen gegen diesen Modus")
    db = get_service_client()
    geprueft = 0
    for tabelle, spalte, art in DB_ZEIGER:
        try:
            rows = (
                db.table(tabelle)
                .select(f"{spalte}")
                .not_.is_(spalte, "null")
                .limit(200)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — Tabelle fehlt = nichts zu prüfen
            hinweis(f"{tabelle}: nicht lesbar ({str(exc)[:60]})")
            continue
        werte = sorted({str(r[spalte]) for r in rows if r.get(spalte)})
        if not werte:
            hinweis(f"{tabelle}.{spalte}: keine Kennung gespeichert")
            continue
        for wert in werte:
            geprueft += 1
            gefunden, meldung = _abrufen(art, wert)
            if gefunden:
                ok(f"{tabelle}.{spalte} {wert} existiert in diesem Modus")
            else:
                mangel(f"{tabelle}.{spalte} {wert} gibt es in diesem Modus NICHT "
                       f"({meldung}) — Kennung aus dem anderen Modus. "
                       f"`stripe_mode_reset.py --apply` und neu verbinden")
    if geprueft == 0:
        hinweis("keine gespeicherten Kennungen — nichts umzustellen")

    # --- 5) Connect-Anlage beweisen ---------------------------------------
    print("\n5) Connect: ist `type=custom` in diesem Modus erlaubt?")
    if not probe:
        hinweis("übersprungen (mit --probe-connect wird ein Account angelegt und "
                "sofort wieder gelöscht — nur das ist ein Beweis; Custom ist für "
                "NEUE Integrationen abgekündigt und kann live abgelehnt werden)")
    else:
        angelegt: str | None = None
        try:
            konto_probe = stripe.Account.create(
                type="custom",
                country=konto.country,
                business_type="company",
                business_profile={"mcc": "7011"},
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
                tos_acceptance={"service_agreement": "full"},
                metadata={"mnd_probe": "stripe_live_check"},
            )
            angelegt = konto_probe.id
            ok(f"Custom-Account anlegbar ({angelegt}) — derselbe Aufruf wie in "
               f"`payments.create_connect_account`")
        except stripe.StripeError as exc:
            mangel(f"Custom-Account NICHT anlegbar: "
                   f"{str(exc.user_message or exc)[:200]}")
        finally:
            # Gegenzustand (Wurzel 1): der Probe-Account wird immer entfernt,
            # auch wenn oben etwas schiefging.
            if angelegt:
                try:
                    stripe.Account.delete(angelegt)
                    hinweis(f"Probe-Account {angelegt} wieder gelöscht")
                except stripe.StripeError as exc:  # noqa: BLE001
                    mangel(f"Probe-Account {angelegt} konnte NICHT gelöscht "
                           f"werden — im Dashboard entfernen ({str(exc)[:80]})")

    print()
    if befunde:
        print(f"NICHT LIVE-BEREIT — {len(befunde)} Befund(e):")
        for b in befunde:
            print(f"  · {b}")
        sys.exit(1)
    print(f"BEREIT ({modus.upper()}-Modus vollständig geprüft)")


if __name__ == "__main__":
    main()
