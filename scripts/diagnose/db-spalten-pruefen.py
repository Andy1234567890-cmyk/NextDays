#!/usr/bin/env python3
"""Prueft jede `db.table("x").select("a, b, c")`-Kette gegen die LIVE-Datenbank.

WARUM ES DIESES SKRIPT GIBT
---------------------------
Am 24.08.2026 warf `/api/v1/site-config/seo/pruefung` einen 500. Ursache war
eine Zeile, die niemand als falsch erkennen konnte:

    db.table("properties").select("id, name, description")

`properties` hat keine Spalte `name`, sie heisst `title`. Weder `ruff` noch
`pylint` noch `pytest` sehen das: fuer Python ist es eine Zeichenkette, und die
Tests laufen gegen eine nachgebaute Datenbank, die jede Spalte akzeptiert.
Sichtbar wird es erst beim echten Aufruf gegen die echte Datenbank -- also im
Betrieb, beim Kunden.

Dieses Skript schliesst genau diese Luecke: es liest die Spaltennamen aus dem
Quelltext (per AST, nicht per Regex) und vergleicht sie mit dem, was die
Datenbank wirklich hat.

WAS ES NICHT PRUEFT
-------------------
* Spalten in `eq()/order()/insert()` -- die liessen sich ergaenzen, aber die
  `select`-Liste ist die haeufigste und teuerste Fehlerquelle.
* Eingebettete PostgREST-Ausdruecke (`kunde:users(name)`) und `*` -- sie werden
  uebersprungen, weil ihr Bezugspunkt eine andere Tabelle ist.
* Ob die Tabelle selbst existiert -- ein Tippfehler dort faellt sofort auf.

AUFRUF
------
    python3 scripts/diagnose/db-spalten-pruefen.py [pfad ...]

Ohne Pfad wird `apps/api/src` geprueft. Exit 1, sobald eine Spalte fehlt.
"""
from __future__ import annotations

import ast
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
STANDARD = WURZEL / "apps" / "api" / "src"

SQL_SPALTEN = """
select table_name || '\t' || column_name
  from information_schema.columns
 where table_schema = 'public';
"""

REMOTE = (
    'docker exec -i $(docker ps --format "{{.Names}}" '
    '| grep -E "^db-cdqxi" | head -1) '
    "psql -U supabase_admin -d postgres -tAq -f -"
)


def live_schema() -> dict[str, set[str]]:
    """Tabelle -> Spalten, direkt aus der Live-Datenbank."""
    roh = subprocess.run(
        ["ssh", "-o", "ConnectTimeout=15", "root@65.21.144.136", REMOTE],
        input=SQL_SPALTEN,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    schema: dict[str, set[str]] = defaultdict(set)
    for zeile in roh.splitlines():
        if "\t" in zeile:
            tab, spalte = zeile.split("\t", 1)
            schema[tab].add(spalte)
    return schema


def _tabelle_der_kette(knoten: ast.AST) -> str | None:
    """Steigt eine Aufrufkette hinab und liefert das Argument von `.table("x")`.

    `db.table("a").select("b").eq(...)` ist im AST von aussen nach innen
    verschachtelt; die Tabelle steht ganz unten.
    """
    while isinstance(knoten, (ast.Call, ast.Attribute)):
        if isinstance(knoten, ast.Call):
            f = knoten.func
            if (
                isinstance(f, ast.Attribute)
                and f.attr == "table"
                and knoten.args
                and isinstance(knoten.args[0], ast.Constant)
                and isinstance(knoten.args[0].value, str)
            ):
                return knoten.args[0].value
            knoten = f
        else:
            knoten = knoten.value
    return None


def _ohne_eingebettete(text: str) -> str:
    """Entfernt eingebettete Ressourcen `tabelle(a, b, c)` samt Inhalt.

    Ohne diesen Schritt liest ein einfaches `split(",")` die Spalten der
    EINGEBETTETEN Tabelle als Spalten der aeusseren -- aus
    `"id, guests(first_name, last_name)"` wuerde `reservations.first_name`,
    und das Skript meldete lauter Fehler, die keine sind. Geklammert wird
    verschachtelt gezaehlt, weil PostgREST das erlaubt.
    """
    raus = []
    tiefe = 0
    for zeichen in text:
        if zeichen == "(":
            tiefe += 1
            # Den Tabellennamen VOR der Klammer mit wegwerfen.
            while raus and (raus[-1].isalnum() or raus[-1] == "_"):
                raus.pop()
        elif zeichen == ")":
            tiefe = max(0, tiefe - 1)
        elif tiefe == 0:
            raus.append(zeichen)
    return "".join(raus)


def _spalten(text: str) -> list[str]:
    """Spaltennamen aus einer select-Zeichenkette; Ausdruecke werden verworfen."""
    raus = []
    for teil in _ohne_eingebettete(text).split(","):
        t = teil.strip()
        if not t or t == "*" or ":" in t or "!" in t:
            continue
        raus.append(t)
    return raus


def sammle(pfade: list[Path]) -> list[tuple[str, str, Path, int]]:
    """(tabelle, spalte, datei, zeile) fuer jede select-Kette im Quelltext."""
    treffer: list[tuple[str, str, Path, int]] = []
    for pfad in pfade:
        dateien = sorted(pfad.rglob("*.py")) if pfad.is_dir() else [pfad]
        for datei in dateien:
            try:
                baum = ast.parse(datei.read_text(encoding="utf-8"))
            except SyntaxError as exc:  # kaputte Datei ist ein eigener Fehler
                print(f"  !  {datei}: {exc}", file=sys.stderr)
                continue
            for knoten in ast.walk(baum):
                if not isinstance(knoten, ast.Call):
                    continue
                f = knoten.func
                if not (isinstance(f, ast.Attribute) and f.attr == "select"):
                    continue
                if not (
                    knoten.args
                    and isinstance(knoten.args[0], ast.Constant)
                    and isinstance(knoten.args[0].value, str)
                ):
                    continue
                tabelle = _tabelle_der_kette(f.value)
                if not tabelle:
                    continue
                for spalte in _spalten(knoten.args[0].value):
                    treffer.append((tabelle, spalte, datei, knoten.lineno))
    return treffer


def main() -> int:
    pfade = [Path(a) for a in sys.argv[1:]] or [STANDARD]
    schema = live_schema()
    treffer = sammle(pfade)
    fehler = []
    for tabelle, spalte, datei, zeile in treffer:
        if tabelle not in schema:
            # Kein Fehler: es kann eine Sicht, eine RPC oder ein anderes Schema
            # sein. Nur gemeldet, damit die Zahl unten stimmt.
            continue
        if spalte not in schema[tabelle]:
            rel = datei.relative_to(WURZEL) if WURZEL in datei.parents else datei
            fehler.append(f"{rel}:{zeile}  {tabelle}.{spalte} gibt es nicht")

    geprueft = sum(1 for t, _s, _d, _z in treffer if t in schema)
    for f in fehler:
        print("  FEHLT " + f)
    if fehler:
        print(f"\n{len(fehler)} unbekannte Spalte(n) von {geprueft} geprueften.")
        return 1
    print(
        f"✓ {geprueft} Spaltenangaben in {len({t[2] for t in treffer})} Dateien "
        "stimmen mit der Live-Datenbank überein."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
