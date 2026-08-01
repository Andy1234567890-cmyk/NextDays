#!/usr/bin/env python3
"""Prueft live, welche Content-Felder Channex WIRKLICH speichert.

ANLASS: Unsere Kanal-Badges behaupten, Groesse und Objekttyp gingen nicht (bzw.
nur unklar) an die Portale. Lodgify zeigt beides in seiner Oberflaeche und
verteilt es. Bevor wir ein Badge aendern, muss die Wahrheit gemessen sein —
nicht aus einer Doku abgeschrieben (Regel: "OTA-Badge nur verifiziert").

METHODE: je Kandidat ein PUT mit einem Probewert, danach ein frisches GET und
ein Vergleich. Ein HTTP 200 ist KEIN Beweis: mehrere Channex-Felder quittieren
freundlich und verwerfen still. Am Ende wird jeder veraenderte Wert wieder auf
den Ausgangsstand zurueckgesetzt (Wurzel 1: Gegenzustand), auch wenn zwischen-
drin etwas schiefgeht.

AUSFUEHRUNG (vom Repo-Root, liest apps/api/.env):
    python3 scripts/channex/feld_sonde.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ENV_DATEI = Path(__file__).resolve().parents[2] / "apps" / "api" / ".env"

# Kandidaten je Ebene: (Feldname, Probewert). Alles, was eine Flaeche, einen
# Typ oder eine Masseinheit tragen koennte.
PROPERTY_KANDIDATEN: list[tuple[str, Any]] = [
    ("property_type", "villa"),
    ("property_size", 142),
    ("size", 142),
    ("square_meters", 142),
    ("area", 142),
    ("living_area", 142),
    ("size_unit", "sqm"),
]

ROOM_TYPE_KANDIDATEN: list[tuple[str, Any]] = [
    ("room_size", 142),
    ("size", 142),
    ("square_meters", 142),
    ("area", 142),
    ("room_kind", "apartment"),
    ("room_type", "apartment"),
]


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


def anfrage(
    api_key: str, url: str, *, methode: str = "GET", rumpf: dict[str, Any] | None = None
) -> tuple[int, dict[str, Any]]:
    """Eine Channex-Anfrage. Gibt (HTTP-Status, Antwort) zurueck — der Status
    wird gebraucht, weil gerade das Auseinanderfallen von Status und
    gespeichertem Wert der Befund ist."""
    daten = json.dumps(rumpf).encode() if rumpf is not None else None
    req = urllib.request.Request(url, data=daten, method=methode)
    req.add_header("user-api-key", api_key)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as antwort:
            roh = antwort.read().decode()
            return antwort.status, (json.loads(roh) if roh else {})
    except urllib.error.HTTPError as fehler:
        roh = fehler.read().decode()
        try:
            return fehler.code, json.loads(roh)
        except json.JSONDecodeError:
            return fehler.code, {"fehler": roh}


def sonde(
    api_key: str,
    basis: str,
    pfad: str,
    huelle: str,
    objekt_id: str,
    kandidaten: list[tuple[str, Any]],
) -> None:
    """Jedes Kandidatenfeld einzeln setzen, zuruecklesen, wieder zuruecksetzen."""
    print(f"\n=== {huelle} {objekt_id} ===")
    for feld, probe in kandidaten:
        _, vorher = anfrage(api_key, f"{basis}{pfad}/{objekt_id}")
        attrs_vorher = (vorher.get("data") or {}).get("attributes") or {}
        alt = attrs_vorher.get(feld)

        status, antwort = anfrage(
            api_key,
            f"{basis}{pfad}/{objekt_id}",
            methode="PUT",
            rumpf={huelle: {feld: probe}},
        )
        if status >= 400:
            fehlertext = json.dumps(antwort.get("errors") or antwort)[:120]
            print(f"  {feld:<16} HTTP {status}  abgelehnt: {fehlertext}")
            continue

        _, nachher = anfrage(api_key, f"{basis}{pfad}/{objekt_id}")
        attrs_nachher = (nachher.get("data") or {}).get("attributes") or {}
        neu = attrs_nachher.get(feld)
        gespeichert = str(neu) == str(probe)
        kennt_feld = feld in attrs_nachher
        befund = (
            "GESPEICHERT" if gespeichert
            else ("verworfen (Feld existiert)" if kennt_feld else "unbekanntes Feld")
        )
        print(f"  {feld:<16} HTTP {status}  {befund}  (vorher={alt!r}, jetzt={neu!r})")

        # Gegenzustand: nur zuruecksetzen, wenn wir wirklich etwas veraendert haben.
        if gespeichert and str(alt) != str(probe):
            anfrage(
                api_key,
                f"{basis}{pfad}/{objekt_id}",
                methode="PUT",
                rumpf={huelle: {feld: alt}},
            )
            _, kontrolle = anfrage(api_key, f"{basis}{pfad}/{objekt_id}")
            zurueck = ((kontrolle.get("data") or {}).get("attributes") or {}).get(feld)
            if str(zurueck) != str(alt):
                print(f"    ACHTUNG: {feld} steht auf {zurueck!r}, erwartet {alt!r}")


def main() -> None:
    api_key, basis = env_laden()

    _, props = anfrage(api_key, f"{basis}/properties")
    eintraege = props.get("data") or []
    if not eintraege:
        sys.exit("Keine Properties im Channex-Konto")
    property_id = eintraege[0]["id"]
    print(f"Property: {eintraege[0]['attributes'].get('title')} ({property_id})")

    sonde(api_key, basis, "/properties", "property", property_id, PROPERTY_KANDIDATEN)

    _, rts = anfrage(api_key, f"{basis}/room_types?filter[property_id]={property_id}")
    zimmer = rts.get("data") or []
    if not zimmer:
        print("\nKein Room-Type an dieser Property — Room-Type-Sonde entfaellt.")
        return
    sonde(
        api_key, basis, "/room_types", "room_type", zimmer[0]["id"], ROOM_TYPE_KANDIDATEN
    )

    # Welche property_type-Werte kennt Channex ueberhaupt?
    status, typen = anfrage(api_key, f"{basis}/property_types")
    print(f"\n=== GET /property_types → HTTP {status} ===")
    if status < 400:
        print(json.dumps(typen, ensure_ascii=False)[:800])


if __name__ == "__main__":
    main()
