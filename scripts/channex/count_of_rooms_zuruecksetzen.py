#!/usr/bin/env python3
"""Setzt count_of_rooms aller Channex-Room-Types auf 1 (Gegenzustand zu 0245).

HINTERGRUND: count_of_rooms ist bei Channex die Obergrenze, wie oft ein Objekt
am selben Tag verkauft werden kann — ein hoeherer availability-Push wird darauf
gekappt (live gemessen 01.08.2026: "Provided value is greater than max
availability (3). Value changes to max availability."). Bei
"1 property = 1 buchbare Einheit" ist der Wert immer 1.

Frueher floss type_attributes.occupancy.rooms ein; 0245 raeumt das Feld in der
DB. Room-Types, die bei Channex bereits mit einem hoeheren Wert stehen, aendern
sich davon NICHT — dieses Skript zieht sie nach.

AUSFUEHRUNG (vom Repo-Root, liest apps/api/.env):
    python3 scripts/channex/count_of_rooms_zuruecksetzen.py            # Trockenlauf
    python3 scripts/channex/count_of_rooms_zuruecksetzen.py --schreiben

Ein 200 von Channex ist kein Beweis, dass gespeichert wurde (mehrere Felder
quittieren freundlich und verwerfen still, siehe docs/CHANNEX-FELDER.md).
Darum liest das Skript jeden geaenderten Room-Type zurueck und meldet
Abweichungen als Fehler.
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import json

ENV_DATEI = Path(__file__).resolve().parents[2] / "apps" / "api" / ".env"


def env_laden() -> tuple[str, str]:
    """API-Key und Basis-URL aus apps/api/.env lesen. Fehlt eines, wird
    abgebrochen — ein Default waere ein erfundener Wert (Wurzel 4)."""
    werte: dict[str, str] = {}
    if ENV_DATEI.exists():
        for zeile in ENV_DATEI.read_text(encoding="utf-8").splitlines():
            if zeile.startswith(("CHANNEX_API_KEY=", "CHANNEX_BASE_URL=")):
                schluessel, _, wert = zeile.partition("=")
                werte[schluessel] = wert.strip().strip('"').strip("'")
    api_key = os.environ.get("CHANNEX_API_KEY") or werte.get("CHANNEX_API_KEY", "")
    basis = os.environ.get("CHANNEX_BASE_URL") or werte.get("CHANNEX_BASE_URL", "")
    if not api_key or not basis:
        sys.exit("CHANNEX_API_KEY/CHANNEX_BASE_URL fehlen (apps/api/.env oder Umgebung)")
    return api_key, basis.rstrip("/")


class ChannexFehler(RuntimeError):
    """Channex hat die Anfrage abgelehnt (HTTP-Fehler)."""


def anfrage(
    api_key: str, url: str, *, methode: str = "GET", rumpf: dict[str, Any] | None = None
) -> dict[str, Any]:
    daten = json.dumps(rumpf).encode("utf-8") if rumpf is not None else None
    req = urllib.request.Request(url, data=daten, method=methode)  # noqa: S310
    req.add_header("user-api-key", api_key)
    if daten is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as antwort:  # noqa: S310
            return json.loads(antwort.read().decode("utf-8"))
    except urllib.error.HTTPError as fehler:
        rumpf_text = fehler.read().decode("utf-8", "replace")
        raise ChannexFehler(
            f"Channex {methode} {url} → HTTP {fehler.code}: {rumpf_text[:400]}"
        ) from fehler


def main() -> int:
    schreiben = "--schreiben" in sys.argv
    api_key, basis = env_laden()

    room_types = anfrage(api_key, f"{basis}/room_types").get("data", [])
    betroffen = [
        r for r in room_types if int(r["attributes"].get("count_of_rooms") or 1) != 1
    ]

    print(f"Room-Types gesamt: {len(room_types)} · mit count_of_rooms != 1: {len(betroffen)}")
    for r in betroffen:
        print(f"  {r['id']}  {r['attributes'].get('title')}  → {r['attributes']['count_of_rooms']}")

    if not betroffen:
        return 0
    if not schreiben:
        print("\nTrockenlauf. Zum Anwenden erneut mit --schreiben aufrufen.")
        return 0

    fehler = 0
    for r in betroffen:
        # Ein einzelner Room-Type, den Channex ablehnt, darf den Lauf nicht
        # kippen (Wurzel 5: spezifisch fangen, Rest weiterarbeiten).
        try:
            anfrage(
                api_key,
                f"{basis}/room_types/{r['id']}",
                methode="PUT",
                rumpf={"room_type": {"count_of_rooms": 1}},
            )
        except ChannexFehler as abgelehnt:
            print(f"  ✗ {r['id']} {abgelehnt}")
            fehler += 1
            continue
        # Zuruecklesen statt dem 200 zu glauben.
        nachher = anfrage(api_key, f"{basis}/room_types").get("data", [])
        ist = next(
            (int(x["attributes"].get("count_of_rooms") or 1) for x in nachher if x["id"] == r["id"]),
            None,
        )
        if ist == 1:
            print(f"  ✓ {r['id']} count_of_rooms = 1")
        else:
            print(f"  ✗ {r['id']} steht weiterhin auf {ist}")
            fehler += 1

    return 1 if fehler else 0


if __name__ == "__main__":
    raise SystemExit(main())
