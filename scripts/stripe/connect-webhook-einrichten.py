"""Den CONNECT-Webhook-Endpunkt bei Stripe anlegen — die Wurzel des Falls 0473.

WAS AM 25.08.2026 LIVE GEFUNDEN WURDE
=====================================
Es existierte genau EIN Webhook-Endpunkt::

    we_1U0RPE1UAdGwIBFl70VbyZLU → https://api.mynextdays.com/api/v1/payments/webhook
    16 Events, KEINES davon `checkout.session.*`, kein `connect`

Damit hat **kein einziger Zahlungseingang eines verbundenen Kontos** je einen
Webhook ausgelöst. Zusatzleistungen (0386) und Nachberechnungen (0469) laufen als
Direct Charge IM KONTO DES BETRIEBS; ihre `checkout.session.completed` ist ein
Connect-Event und wird nur an einen Endpunkt mit ``connect: true`` zugestellt.

Bemerkt wurden diese Zahlungen ausschließlich vom Nachlese-Abgleich in
``addons.zahlung.lesen`` — und der läuft nur, wenn jemand GENAU DIESE Buchung im
Dashboard öffnet. Live-Folge: Der Gast der Buchung 6179a5d0 zahlte am 20.08. um
15:54 Uhr 150,00 DKK für ein Wäschepaket. Bei uns stand der Link fünf Tage auf
„offen", die Abrechnungsseite führte ihn als offene Forderung, und als
Booking.com die Buchung stornierte, lag das Geld unauffindbar im Verbundkonto.

WARUM EIN ZWEITER ENDPUNKT UND NICHT DER BESTEHENDE
===================================================
``connect`` ist bei Stripe nicht nachträglich umschaltbar — ein Endpunkt ist bei
seiner Anlage entweder ein Konto- oder ein Connect-Endpunkt. Der bestehende
bleibt also, wie er ist (er bedient unsere eigenen Events), und daneben entsteht
der Connect-Endpunkt. Beide zeigen auf DIESELBE Route; die FastAPI prüft die
Signatur gegen beide Secrets (``STRIPE_WEBHOOK_SECRET`` und
``STRIPE_CONNECT_WEBHOOK_SECRET``).

AUFRUF
======
Das Skript SCHREIBT bei Stripe. Es läuft nur mit ausdrücklicher Bestätigung::

    # 1. Zeigen, was da ist und was fehlen würde (schreibt nichts)
    uv run python scripts/stripe/connect-webhook-einrichten.py --pruefen

    # 2. Anlegen (verlangt --ja)
    uv run python scripts/stripe/connect-webhook-einrichten.py --anlegen --ja

Danach GIBT DAS SKRIPT DAS SIGNING-SECRET EINMALIG AUS. Stripe zeigt es nie
wieder. Es gehört in Coolify als ``STRIPE_CONNECT_WEBHOOK_SECRET`` — bei BEIDEN
Anwendungen (api UND worker), denn beide fahren denselben Code
(`mail-variablen-drift-api-worker`).
"""
from __future__ import annotations

import argparse
import os
import pathlib
import re

#: Die Events, die aus einem VERBUNDENEN Konto kommen müssen. Bewusst knapp:
#: Jedes zusätzliche Event ist Last und eine weitere Stelle, die still ins
#: Nichts läuft, wenn sie niemand behandelt.
CONNECT_EVENTS = [
    # DER fehlende Event: Zahlungseingang einer Zusatzleistung/Nachberechnung.
    "checkout.session.completed",
    # Erstattung im verbundenen Konto — auch wenn sie jemand direkt im
    # Stripe-Dashboard auslöst, statt über unsere Oberfläche. Ohne diesen Event
    # wüssten wir von so einer Erstattung nichts, und der Betrag stünde bei uns
    # weiter als Umsatz.
    "charge.refunded",
]

URL_STANDARD = "https://api.mynextdays.com/api/v1/payments/webhook"


def _lade_env() -> None:
    """``apps/api/.env`` von Hand lesen.

    Nicht über python-dotenv: Die Datei enthält mehrzeilige Werte, an denen
    dotenv aussteigt und danach LEISE nichts mehr setzt (beobachtet am
    25.08.2026 — der Vertex-Client galt als „nicht eingerichtet", obwohl die
    Variablen da waren).
    """
    wurzel = pathlib.Path(__file__).resolve().parents[2]
    datei = wurzel / "apps" / "api" / ".env"
    if not datei.exists():
        return
    for zeile in datei.read_text(encoding="utf-8").splitlines():
        treffer = re.match(r"^([A-Z0-9_]+)=(.*)$", zeile)
        if treffer:
            os.environ.setdefault(treffer.group(1), treffer.group(2))


def _stripe():  # noqa: ANN202 — Modul-Typ
    import stripe  # noqa: PLC0415

    key = os.environ.get("STRIPE_SECRET_KEY", "")
    if not key:
        raise SystemExit(
            "STRIPE_SECRET_KEY fehlt. Ohne Schlüssel wird nichts geraten — "
            "setzen oder apps/api/.env bereitstellen."
        )
    stripe.api_key = key
    return stripe


def _bestand(stripe) -> list:  # noqa: ANN001, ANN201
    return list(stripe.WebhookEndpoint.list(limit=50).data or [])


def _zeigen(stripe, url: str) -> bool:  # noqa: ANN001
    """Bestand ausgeben. Rückgabe: True, wenn ein passender Connect-Endpunkt fehlt."""
    endpunkte = _bestand(stripe)
    print(f"{len(endpunkte)} Webhook-Endpunkt(e) im Plattformkonto:\n")
    connect_da = False
    for e in endpunkte:
        # WIE MAN EINEN CONNECT-ENDPUNKT ERKENNT: nicht am Feld `connect` —
        # das ist ein reiner CREATE-Parameter und kommt in der API-Antwort
        # überhaupt nicht zurück (geprüft am 25.08.2026: die Antwort hat genau
        # api_version, application, created, description, enabled_events, id,
        # livemode, metadata, object, status, url). `getattr(e, "connect", False)`
        # war deshalb IMMER False und meldete den frisch angelegten Endpunkt als
        # fehlend — ein Prüfskript, das nach dem Anlegen weiter „fehlt" sagt, ist
        # schlimmer als keins.
        #
        # Der Marker ist `application`: Ein Connect-Endpunkt hängt an der
        # Connect-Anwendung (`ca_…`), ein Konto-Endpunkt hat dort None.
        ist_connect = bool(getattr(e, "application", None))
        events = sorted(e.enabled_events)
        fehlend = [x for x in CONNECT_EVENTS if x not in events and "*" not in events]
        print(f"  {e.id}  status={e.status}  connect={ist_connect}")
        print(f"    url:    {e.url}")
        print(f"    events: {len(events)}")
        if ist_connect and e.url == url:
            connect_da = True
            if fehlend:
                print(f"    ⚠ fehlende Events: {', '.join(fehlend)}")
            else:
                print("    ✓ alle nötigen Connect-Events abonniert")
        print()
    if connect_da:
        print("→ Ein Connect-Endpunkt auf diese URL existiert.")
        return False
    print(
        "→ ES FEHLT ein Connect-Endpunkt auf diese URL.\n"
        "  Solange er fehlt, erreicht KEIN Zahlungseingang eines verbundenen\n"
        "  Kontos den Webhook. Bemerkt werden solche Zahlungen dann nur vom\n"
        "  Nachlese-Abgleich (Buchung öffnen bzw. Konto → Abrechnung).\n"
        f"  Nötige Events: {', '.join(CONNECT_EVENTS)}"
    )
    return True


def _anlegen(stripe, url: str) -> None:  # noqa: ANN001
    endpunkt = stripe.WebhookEndpoint.create(
        url=url,
        enabled_events=CONNECT_EVENTS,
        connect=True,
        description=(
            "myNextDays Connect — Zahlungseingaenge der verbundenen Konten "
            "(Zusatzleistungen 0386, Nachberechnung 0469)"
        ),
    )
    print(f"\n✓ Angelegt: {endpunkt.id}")
    print(f"  url:    {endpunkt.url}")
    print(f"  events: {', '.join(sorted(endpunkt.enabled_events))}")
    print("\n" + "=" * 72)
    print("SIGNING SECRET — Stripe zeigt es NIE WIEDER:")
    print(f"\n  STRIPE_CONNECT_WEBHOOK_SECRET={endpunkt.secret}\n")
    print("In Coolify bei BEIDEN Anwendungen setzen (api UND worker) und beide")
    print("neu deployen. Der Worker fährt denselben Code; eine Variable nur an")
    print("der API zu setzen ist der Fehler aus `mail-variablen-drift-api-worker`.")
    print("=" * 72)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--pruefen", action="store_true", help="nur anzeigen (Standard)")
    p.add_argument("--anlegen", action="store_true", help="Connect-Endpunkt anlegen")
    p.add_argument(
        "--ja",
        action="store_true",
        help="Bestätigung für --anlegen (schreibender Stripe-Aufruf)",
    )
    p.add_argument("--url", default=URL_STANDARD, help=f"Ziel-URL (Standard: {URL_STANDARD})")
    args = p.parse_args()

    _lade_env()
    stripe = _stripe()
    fehlt = _zeigen(stripe, args.url)

    if not args.anlegen:
        return
    if not fehlt:
        print("\nNichts zu tun — der Endpunkt existiert bereits.")
        return
    if not args.ja:
        raise SystemExit(
            "\n--anlegen ohne --ja: Das wäre ein schreibender Aufruf gegen das "
            "Live-Stripe-Konto. Mit --ja wiederholen, wenn das gewollt ist."
        )
    _anlegen(stripe, args.url)


if __name__ == "__main__":
    main()
