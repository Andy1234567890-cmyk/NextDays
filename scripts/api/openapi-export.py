#!/usr/bin/env python3
"""Schreibt die OpenAPI-Datei der öffentlichen API in die Marketing-App.

WARUM EINGECHECKT und nicht zur Laufzeit geholt: die Referenz auf
`/entwickler/referenz` ist die Dokumentation, die Kunden lesen. Sie darf nicht
davon abhängen, ob der API-Dienst gerade erreichbar ist — genau dieser Fehler
stand vorher live: die Doku-Seite verlinkte auf `…/docs` einer Domain, hinter
der nichts lief, und damit gab es faktisch keine Endpunkt-Dokumentation.

Die Wahrheit bleibt trotzdem der Code: die Datei wird aus `app.openapi()`
erzeugt, nie von Hand bearbeitet. Der CI-Job vergleicht die eingecheckte Datei
mit einem frischen Export und bricht bei Abweichung ab — eine veraltete
Referenz ist schlimmer als keine, weil ein Integrator ihr glaubt.

Aufruf (vom Repo-Root):
    python3 scripts/api/openapi-export.py            # schreiben
    python3 scripts/api/openapi-export.py --pruefen  # nur vergleichen (CI)

Braucht die Python-Umgebung von apps/public-api (`uv run` oder deren .venv).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
DIENST = WURZEL / "apps" / "public-api"
ZIEL = WURZEL / "marketing" / "content" / "api" / "openapi.json"


def spec_erzeugen() -> dict:
    """`app.openapi()` aufrufen, ohne den Dienst zu starten.

    Das Signier-Secret wird gesetzt, weil die Einstellungen es beim Import
    lesen — für die Schema-Erzeugung ist der Wert bedeutungslos, aber ein
    leerer Wert wäre in `Settings` ein anderer Zustand.
    """
    sys.path.insert(0, str(DIENST))
    os.environ.setdefault("API_TOKEN_SECRET", "export-only-kein-echtes-secret")
    from src.main import app  # noqa: PLC0415 — erst nach dem sys.path-Eintrag

    spec = app.openapi()
    if not spec.get("paths"):
        raise SystemExit("FEHLER: Schema ohne Pfade — Export abgebrochen.")
    if not str(spec.get("openapi", "")).startswith("3.1"):
        raise SystemExit(f"FEHLER: unerwartete OpenAPI-Version {spec.get('openapi')!r}.")
    return spec


def als_text(spec: dict) -> str:
    """Stabile Formatierung, damit der Vergleich in der CI aussagekräftig ist.

    `sort_keys` ist Pflicht: FastAPI baut das Dict in Registrierungsreihenfolge,
    und die verschiebt sich beim Umsortieren von Routern — ohne Sortierung wäre
    jeder zweite Export ein Diff ohne inhaltliche Änderung.
    """
    return json.dumps(spec, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> int:
    zerleger = argparse.ArgumentParser(description=__doc__)
    zerleger.add_argument(
        "--pruefen",
        action="store_true",
        help="nur vergleichen, nichts schreiben (Exit 1 bei Abweichung)",
    )
    args = zerleger.parse_args()

    text = als_text(spec_erzeugen())

    if args.pruefen:
        if not ZIEL.exists():
            print(f"FEHLER: {ZIEL.relative_to(WURZEL)} fehlt.", file=sys.stderr)
            return 1
        if ZIEL.read_text(encoding="utf-8") != text:
            print(
                f"FEHLER: {ZIEL.relative_to(WURZEL)} ist nicht der aktuelle Stand "
                "der API.\n"
                "        Die veröffentlichte Referenz würde Endpunkte oder "
                "Felder zeigen,\n"
                "        die es nicht (mehr) gibt. Neu erzeugen mit:\n"
                "        python3 scripts/api/openapi-export.py",
                file=sys.stderr,
            )
            return 1
        pfade = len(json.loads(text)["paths"])
        print(f"OK — eingecheckte OpenAPI-Datei entspricht dem Code ({pfade} Pfade).")
        return 0

    ZIEL.parent.mkdir(parents=True, exist_ok=True)
    ZIEL.write_text(text, encoding="utf-8")
    spec = json.loads(text)
    print(
        f"{ZIEL.relative_to(WURZEL)} geschrieben — OpenAPI {spec['openapi']}, "
        f"{len(spec['paths'])} Pfade, {len(spec.get('components', {}).get('schemas', {}))} Schemas."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
