"""Baut das Produktwissen für den Support-Chatbot auf (Embeddings + Ablage).

ABLAUF: `marketing/scripts/produktwissen-sammeln.mjs` schreibt die Texte als
JSON, dieses Skript bettet sie ein und legt sie in `public.produktwissen` ab.

ZWEI SCHRITTE STATT EINEM, weil der teure Teil der Embedding-Lauf ist: bricht
er ab (Netz, Kontingent), sollen die gesammelten Texte nicht verloren sein.

WAS ES NICHT TUT: alles löschen und neu schreiben. Der Lauf vergleicht die
Prüfsumme jedes Stücks mit der abgelegten und bettet nur Geändertes neu ein.
Ein Volllauf über 24 Sprachen wäre sonst bei jeder Textkorrektur ein paar
tausend Embedding-Aufrufe für Texte, die sich nicht geändert haben.

VERWAISTE ZEILEN: Stücke, die es in der Quelle nicht mehr gibt (ein Artikel
wurde gelöscht), werden entfernt — sonst antwortet der Chatbot aus einem
Artikel, den niemand mehr aufrufen kann (Wurzel 1: der Gegenzustand gehört
mitgepflegt).

AUFRUF (aus apps/api):
    uv run python scripts/produktwissen_aufbauen.py ../produktwissen.json
    uv run python scripts/produktwissen_aufbauen.py ../produktwissen.json --trocken
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Der Pfad MUSS vor dem Import stehen: das Skript liegt in `scripts/` und
# `src` liegt eine Ebene höher. pylint sieht darin einen falsch platzierten
# Import (C0413) — hier ist er notwendig, nicht nachlässig.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# pylint: disable=wrong-import-position
from src.core.ki import EinbettungClient  # noqa: E402
from src.core.supabase import get_service_client  # noqa: E402

TABELLE = "produktwissen"


def _laden(pfad: Path) -> list[dict[str, Any]]:
    stuecke = json.loads(pfad.read_text(encoding="utf-8"))
    if not isinstance(stuecke, list) or not stuecke:
        raise SystemExit(f"{pfad} enthält keine Wissensstücke.")
    pflicht = {"quelle", "quelle_id", "sprache", "titel", "inhalt", "inhalt_hash"}
    for i, s in enumerate(stuecke):
        fehlt = pflicht - set(s)
        if fehlt:
            raise SystemExit(f"Stück {i} fehlen Felder: {', '.join(sorted(fehlt))}")
    return stuecke


def _schluessel(s: dict[str, Any]) -> tuple[str, str, str, int]:
    return (s["quelle"], s["quelle_id"], s["sprache"], int(s.get("abschnitt", 0)))


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("json_datei", type=Path)
    p.add_argument(
        "--trocken",
        action="store_true",
        help="nur zeigen, was passieren würde — nichts schreiben, nichts einbetten",
    )
    p.add_argument(
        "--sprachen",
        default="",
        help="nur diese Sprachen (Komma-getrennt); leer = alle in der Datei",
    )
    args = p.parse_args()

    stuecke = _laden(args.json_datei)
    if args.sprachen:
        erlaubt = {s.strip() for s in args.sprachen.split(",") if s.strip()}
        stuecke = [s for s in stuecke if s["sprache"] in erlaubt]
    if not stuecke:
        print("Keine Stücke für die gewählten Sprachen.")
        return 0

    sprachen = sorted({s["sprache"] for s in stuecke})
    db = get_service_client()

    # Bestand NUR für die betroffenen Sprachen holen: ein Lauf über `de` darf
    # die 23 anderen Sprachen nicht als verwaist ansehen und löschen.
    bestand: dict[tuple[str, str, str, int], dict[str, Any]] = {}
    for sprache in sprachen:
        treffer = (
            db.table(TABELLE)
            .select("id, quelle, quelle_id, sprache, abschnitt, inhalt_hash")
            .eq("sprache", sprache)
            .execute()
        )
        for zeile in treffer.data or []:
            bestand[_schluessel(zeile)] = zeile

    neu: list[dict[str, Any]] = []
    geaendert: list[dict[str, Any]] = []
    for s in stuecke:
        alt = bestand.get(_schluessel(s))
        if alt is None:
            neu.append(s)
        elif alt["inhalt_hash"] != s["inhalt_hash"]:
            geaendert.append({**s, "id": alt["id"]})

    aktuelle = {_schluessel(s) for s in stuecke}
    verwaist = [z for k, z in bestand.items() if k not in aktuelle]

    print(f"Sprachen:   {', '.join(sprachen)}")
    print(f"In Quelle:  {len(stuecke)}")
    print(f"Bestand:    {len(bestand)}")
    print(f"Neu:        {len(neu)}")
    print(f"Geändert:   {len(geaendert)}")
    print(f"Verwaist:   {len(verwaist)}")

    if args.trocken:
        for z in verwaist[:10]:
            print(f"  würde entfallen: {z['quelle']}/{z['quelle_id']} [{z['sprache']}]")
        return 0

    zu_betten = neu + geaendert
    if zu_betten:
        client = EinbettungClient()
        if not client.is_configured:
            raise SystemExit("Vertex AI ist nicht eingerichtet — kein Embedding möglich.")
        print(f"\nBette {len(zu_betten)} Stücke ein ({client.modell}) …")
        vektoren = client.einbetten(
            [s["inhalt"] for s in zu_betten], aufgabe="RETRIEVAL_DOCUMENT"
        )
        for s, v in zip(zu_betten, vektoren, strict=True):
            s["einbettung"] = v
            s["modell"] = client.modell

    # Upsert über den eindeutigen Schlüssel: ein zweiter Lauf darf keine
    # Dubletten erzeugen, auch wenn er mittendrin abgebrochen war.
    if zu_betten:
        nutzlast = [
            {
                "quelle": s["quelle"],
                "quelle_id": s["quelle_id"],
                "abschnitt": int(s.get("abschnitt", 0)),
                "sprache": s["sprache"],
                "titel": s["titel"][:300],
                "inhalt": s["inhalt"],
                "pfad": s.get("pfad"),
                "einbettung": s["einbettung"],
                "modell": s["modell"],
                "inhalt_hash": s["inhalt_hash"],
            }
            for s in zu_betten
        ]
        for start in range(0, len(nutzlast), 100):
            db.table(TABELLE).upsert(
                nutzlast[start : start + 100],
                on_conflict="quelle,quelle_id,sprache,abschnitt",
            ).execute()
        print(f"{len(nutzlast)} Stücke geschrieben.")

    if verwaist:
        for z in verwaist:
            db.table(TABELLE).delete().eq("id", z["id"]).execute()
        print(f"{len(verwaist)} verwaiste Stücke entfernt.")

    print("\nFertig.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
