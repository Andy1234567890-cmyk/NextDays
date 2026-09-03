#!/usr/bin/env python3
"""Prueft, ob JEDE Portal-Aufstellung der Live-DB lesbar ist.

WARUM ES DIESES SKRIPT GIBT: Am 03.09.2026 blockierte die Eigentuemer-
Abrechnung von Feriehus Kornblomst mit „Die Gebuehrenart `portal:stromkosten`
ist nicht zugeordnet" — ein Wert, der in KEINER Tabelle steht, weil er erst zur
Laufzeit gebildet wird. Zwei Fehler steckten dahinter, und beide waren fuer
Tests unsichtbar, weil sie an der FORM der echten Daten hingen:

1. `ELECTRICITYFEE` fehlte im sprachneutralen Schluessel-Katalog
   (`_BOOKING_SCHLUESSEL_ARTEN`). Channex liefert die Art bei JEDER Buchung
   in `rooms[].meta.charge_periods` mit — gemessen an 788 Payloads kommen
   sechs Schluessel vor, einer davon war unbekannt.
2. Die Namensliste kannte 4 der 13 Gebuehrenarten, die Bookings Extranet
   anbietet (abgelesen 03.09.2026). Die uebrigen 9 fielen in das
   `portal:<name>`-Auffangnetz — eine Art, die erst zur Laufzeit entsteht
   und in der Zuordnungsmaske nicht anlegbar ist.

Die Unit-Tests waren gruen, weil ihre Fixtures dieselbe falsche Form benutzten
wie der Code. Nur die echten Payloads zeigen es. Deshalb liest dieses Skript
die Live-DB und laesst denselben Code darauf laufen, den die Abrechnung nutzt.

AUFRUF (vom Repo-Root, braucht SSH-Zugang):
    uv run --project apps/api python scripts/diagnose/portal-gebuehren-lesbar.py
    ... --exit-code     # Exit 1 bei jeder Blockade (fuer CI/Cron)

Nur LESEND. Es aendert nichts.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter

SSH_ZIEL = "root@65.21.144.136"
DB_PREFIX = "db-"

# `channex_booking.raw` und NICHT `reservations.ota_details`: das ist die
# Quelle, aus der die Abrechnung liest (`payloads.py` ueber
# `source_channex_booking_id`). `ota_details` ist eine gekuerzte Kopie in
# anderer Form — wer sie prueft, prueft nicht, was die Rechnung sieht.
ABFRAGE = """
select cb.id::text || E'\\t' || coalesce(cb.raw->>'ota_name','BookingCom')
       || E'\\t' || cb.raw::text
from public.channex_booking cb
where cb.raw is not null
"""

# Die getroffenen Zuordnungen. Nur die BETRIEBSREGEL (`property_id is null`)
# zaehlt als „zugeordnet": eine Objekt-Ausnahme deckt genau ein Objekt, die
# Abrechnung eines anderen blockiert weiter.
ABFRAGE_ZUORDNUNG = """
select fc.tenant_id::text || E'\\t' || fc.fee_type
from public.fee_classification fc
where fc.property_id is null
"""


def _payloads() -> list[tuple[str, str, dict]]:
    """Die Payloads der Live-DB. Containername dynamisch — er wechselt je Deploy."""
    befehl = (
        f'CID=$(docker ps --format "{{{{.Names}}}}" | grep "^{DB_PREFIX}" | head -1); '
        'docker exec -i "$CID" psql -U postgres -t -A'
    )
    fertig = subprocess.run(
        ["ssh", "-o", "ConnectTimeout=10", SSH_ZIEL, befehl],
        input=ABFRAGE, capture_output=True, text=True, check=False,
    )
    if fertig.returncode != 0:
        print(f"DB nicht erreichbar: {fertig.stderr.strip()[:200]}", file=sys.stderr)
        sys.exit(2)
    aus: list[tuple[str, str, dict]] = []
    for zeile in fertig.stdout.splitlines():
        teile = zeile.split("\t", 2)
        if len(teile) != 3:
            continue
        try:
            aus.append((teile[0], teile[1], json.loads(teile[2])))
        except json.JSONDecodeError:
            continue
    return aus


def _zugeordnet() -> set[str]:
    """Die Arten, fuer die eine Betriebsregel existiert (ueber alle Betriebe).

    Absichtlich NICHT je Betrieb getrennt: dieses Skript prueft die Form der
    Daten, nicht die Buchhaltung eines einzelnen Kunden. Eine Art, die
    irgendwo erkannt und nirgends zugeordnet ist, ist der Befund.
    """
    befehl = (
        f'CID=$(docker ps --format "{{{{.Names}}}}" | grep "^{DB_PREFIX}" | head -1); '
        'docker exec -i "$CID" psql -U postgres -t -A'
    )
    fertig = subprocess.run(
        ["ssh", "-o", "ConnectTimeout=10", SSH_ZIEL, befehl],
        input=ABFRAGE_ZUORDNUNG, capture_output=True, text=True, check=False,
    )
    if fertig.returncode != 0:
        print(f"DB nicht erreichbar: {fertig.stderr.strip()[:200]}", file=sys.stderr)
        sys.exit(2)
    aus: set[str] = set()
    for zeile in fertig.stdout.splitlines():
        teile = zeile.split("\t", 1)
        if len(teile) == 2 and teile[1].strip():
            aus.add(teile[1].strip())
    return aus


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--exit-code", action="store_true",
                   help="Exit 1, wenn eine Aufstellung blockiert")
    args = p.parse_args()

    sys.path.insert(0, "apps/api")
    from src.features.owner_statements import gebuehren_quelle as gq  # noqa: PLC0415
    from src.features.owner_statements.common import PayoutUnbekannt  # noqa: PLC0415

    daten = _payloads()
    print(f"{len(daten)} Buchungen mit Payload aus der Live-DB\n")

    gelesen = ohne = 0
    arten: Counter[str] = Counter()
    blockaden: list[tuple[str, str, str]] = []
    auffangnetz: list[tuple[str, str]] = []

    for rid, portal, raw in daten:
        leser = (
            gq.booking_gebuehren if "booking" in portal.casefold()
            else gq.airbnb_gebuehren if hasattr(gq, "airbnb_gebuehren")
            else None
        )
        if leser is None:
            continue
        try:
            posten = leser(raw)
        except PayoutUnbekannt as exc:
            blockaden.append((rid, portal, exc.message))
            continue
        if posten is None:
            ohne += 1
            continue
        gelesen += 1
        for art, _ in posten:
            arten[str(art)] += 1
            if str(art).startswith("portal:"):
                auffangnetz.append((rid, str(art)))

    print(f"  gelesen:              {gelesen}")
    print(f"  ohne Aufstellung:     {ohne}")
    print(f"  BLOCKIERT:            {len(blockaden)}")
    print(f"  im Auffangnetz:       {len(auffangnetz)}")
    if arten:
        print("\n  Erkannte Arten:")
        for art, n in arten.most_common():
            print(f"    {art:20} {n}")

    if blockaden:
        print("\n  BLOCKADEN — diese Abrechnungen sind nicht erstellbar:")
        for rid, portal, meldung in blockaden[:20]:
            print(f"    {portal} {rid}: {meldung[:110]}")
    if auffangnetz:
        print("\n  AUFFANGNETZ — Arten, die zur Laufzeit entstehen und in der")
        print("  Zuordnungsmaske NICHT anlegbar sind:")
        for rid, art in auffangnetz[:20]:
            print(f"    {rid}: {art}")

    # Dritte Pruefung: erkannt ist nicht zugeordnet.
    #
    # Warum sie hier steht: am 03.09.2026 war `electricity` sauber ERKANNT
    # (Blockaden 0, Auffangnetz 0) und trotzdem blockierte die Abrechnung —
    # es fehlte die Zuordnung, und die Zuordnungsmaske bot die Art nicht an,
    # weil sie `reservations.ota_details` las statt `channex_booking.raw`.
    # Beide Stufen oben waren gruen. Ohne diesen Abgleich meldet nichts die
    # eine Sache, die den Nutzer tatsaechlich aufhaelt.
    echte_arten = {a for a in arten if not a.startswith("portal:")}
    fehlende = sorted(echte_arten - _zugeordnet())
    if fehlende:
        print("\n  NICHT ZUGEORDNET — erkannt, aber ohne Betriebsregel:")
        for art in fehlende:
            print(f"    {art:20} {arten[art]}x  (Buchhaltung -> Abrechnungsregeln)")

    schlecht = bool(blockaden or auffangnetz or fehlende)
    print("\n" + ("FEHLER: siehe oben." if schlecht
                  else "Alle Aufstellungen lesbar, jede Art zugeordnet."))
    return 1 if (schlecht and args.exit_code) else 0


if __name__ == "__main__":
    sys.exit(main())
