#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Den Baum einer Website-Seite gegen die Live-DB prüfen (0472).

WOZU
====
Seit 0472 ist eine Seite ein Baum: ``section > column > widget``. Vier Regeln
halten ihn zusammen (``site_blocks_wurzel_check``, ``_tiefe_check``,
``_span_check``, ``_kind_check``), und wer sie beim Schreiben nicht bedient,
bekommt einen 500 — oder schlimmer: eine Zeile, die zwar durchgeht, aber
nirgends mehr auftaucht.

Genau das war am 25.08.2026 der Fall, gleich dreifach:

  * Jeder neue Baustein scheiterte an ``site_blocks_tiefe_check``, weil die
    Schreibpfade ``kind``/``parent_id``/``tiefe`` nicht setzten und die
    Spalten-DEFAULTS (``kind='widget'``, ``tiefe=0``) genau die verbotene
    Kombination sind.
  * Beim Entfernen blieb die Hülle stehen — leere Abschnitte, die als Lücke
    rendern und in der Reihenfolge mitzählen.
  * ``list_blocks`` gab die Container mit heraus, weshalb der Editor aus acht
    Bausteinen vierundzwanzig machte.

Alle drei sahen von außen gleich aus („der Baukasten spinnt"). Dieses Skript
macht sie unterscheidbar, BEVOR jemand raten muss.

AUFRUF
======
    # alle Seiten eines Betriebs
    uv run python scripts/diagnose/website-bloecke-pruefen.py --tenant <UUID>

    # eine bestimmte Seite
    uv run python scripts/diagnose/website-bloecke-pruefen.py --page <UUID>

Exit 1, sobald ein Befund vorliegt — damit taugt es für CI und für ein
„ist es jetzt sauber?" nach einer Reparatur.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict

try:
    from supabase import create_client
except ImportError:  # pragma: no cover
    print("supabase-py fehlt. Aufruf über `uv run` aus apps/api.")
    sys.exit(2)


#: Welche Tiefe zu welcher Art gehört — dieselbe Tabelle wie der DB-Constraint.
ERLAUBTE_TIEFE: dict[str, set[int]] = {
    "section": {0},
    "column": {1},
    "inner_column": {2},
    "widget": {2, 3},
}


def verbinde():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        # Fail-closed und LAUT: ein Prüfskript, das ohne Zugang stillschweigend
        # „keine Befunde" meldet, ist schlimmer als keins (Wurzel 5).
        print("FEHLER: SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY nötig.")
        sys.exit(2)
    return create_client(url, key)


def pruefe(zeilen: list[dict], seite: str) -> list[str]:
    """Alle Befunde EINER Seite. Leere Liste = der Baum ist in Ordnung."""
    befunde: list[str] = []
    nach_id = {z["id"]: z for z in zeilen}
    kinder: dict[str | None, list[dict]] = defaultdict(list)
    for z in zeilen:
        kinder[z.get("parent_id")].append(z)

    for z in zeilen:
        art = z.get("kind") or "widget"
        tiefe = z.get("tiefe")
        eltern = z.get("parent_id")
        kurz = f"{z['id'][:8]} ({art}, {z.get('type')})"

        # 1. Art und Tiefe müssen zusammenpassen.
        if art not in ERLAUBTE_TIEFE:
            befunde.append(f"{kurz}: unbekannte Art „{art}“")
        elif tiefe not in ERLAUBTE_TIEFE[art]:
            befunde.append(
                f"{kurz}: Tiefe {tiefe} unzulässig "
                f"(erlaubt: {sorted(ERLAUBTE_TIEFE[art])})"
            )

        # 2. Abschnitte hängen an der Seite, alles andere an einem Elternteil.
        if art == "section" and eltern is not None:
            befunde.append(f"{kurz}: Abschnitt mit Elternteil {eltern[:8]}")
        if art != "section" and eltern is None:
            befunde.append(f"{kurz}: hängt an keinem Elternteil (Waise)")
        elif eltern is not None and eltern not in nach_id:
            befunde.append(f"{kurz}: Elternteil {eltern[:8]} fehlt auf der Seite")

        # 3. Container ohne Inhalt sind Leichen eines Löschvorgangs.
        if art in ("section", "column", "inner_column") and not kinder[z["id"]]:
            befunde.append(f"{kurz}: leerer Container — Rest eines Löschens?")

        # 4. Ein Container trägt keinen Blocktyp, ein Widget schon.
        if art != "widget" and z.get("type") != "container":
            befunde.append(f"{kurz}: Container mit Blocktyp „{z.get('type')}“")
        if art == "widget" and z.get("type") == "container":
            befunde.append(f"{kurz}: Widget ohne Blocktyp")

    # 5. Doppelte Positionen unter denselben Eltern — die Reihenfolge ist dann
    #    Zufall, und der Kunde sieht sie bei jedem Laden anders.
    for elter, geschwister in kinder.items():
        positionen = [g.get("position") for g in geschwister]
        doppelt = {p for p in positionen if positionen.count(p) > 1}
        if doppelt:
            wo = elter[:8] if elter else "Seite"
            befunde.append(f"unter {wo}: Position {sorted(doppelt)} doppelt")

    return [f"[{seite[:8]}] {b}" for b in befunde]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--tenant", help="alle Seiten dieses Betriebs")
    ap.add_argument("--page", help="nur diese Seite")
    args = ap.parse_args()
    if not args.tenant and not args.page:
        ap.error("--tenant oder --page angeben")

    db = verbinde()
    if args.page:
        seiten = [args.page]
    else:
        rows = (
            db.table("site_pages")
            .select("id")
            .eq("tenant_id", args.tenant)
            .execute()
        ).data or []
        seiten = [r["id"] for r in rows]

    alle: list[str] = []
    for seite in seiten:
        zeilen = (
            db.table("site_blocks")
            .select("id, type, kind, parent_id, tiefe, span, position")
            .eq("page_id", seite)
            .execute()
        ).data or []
        befunde = pruefe(zeilen, seite)
        bausteine = sum(1 for z in zeilen if (z.get("kind") or "widget") == "widget")
        zustand = "OK" if not befunde else f"{len(befunde)} Befund(e)"
        print(
            f"{seite[:8]}  {len(zeilen):3d} Zeilen, {bausteine:3d} Bausteine  {zustand}"
        )
        alle.extend(befunde)

    if alle:
        print(f"\n{len(alle)} Befund(e):")
        for b in alle:
            print(f"  · {b}")
        return 1
    print(f"\n{len(seiten)} Seite(n) geprüft, keine Befunde.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
