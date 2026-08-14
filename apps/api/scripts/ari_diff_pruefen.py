"""Gesendete ARI-Verfügbarkeit gegen den eigenen Kalender halten (Off-by-one).

NUR LESEND. Exit 1, sobald eine gesendete Spanne einen Tag abdeckt, den die
eigene `availability` nicht als gesperrt kennt.

WAS HIER GESUCHT WIRD:
`ari_outbox.date_to` ist INKLUSIV — der letzte betroffene Tag, nicht der Tag
danach. Sender, Outbox-Nachzug und Superseding lesen die Spanne über
`_iso_days`, das beide Enden einschließt. Wer intern exklusiv rechnet und das
Ende ungerechnet weiterreicht, sperrt bei den Portalen einen Tag zu viel.

WARUM DAS EINE DAUERPRÜFUNG BRAUCHT:
Dieser Fehler meldet sich nie von selbst. Ein Tag, der bei Booking und Airbnb
zu ist, obwohl er offen sein dürfte, erzeugt keine Fehlermeldung, keinen
fehlgeschlagenen Request und keine Beschwerde — er erzeugt eine ausbleibende
Buchung. Sichtbar wird er ausschließlich im Vergleich der GESENDETEN Payload
mit dem eigenen Kalender, und genau den macht dieses Skript.

Live gefunden am 14.08.2026: `vertragsende._push_stand` reichte `span_bis + 1`
weiter. Der eigene Kalender sperrte bis 2028-08-12, an Channex ging 2028-08-13
— bei zwei Objekten, seit dem Tag, an dem das Enddatum gesetzt wurde. Alle
übrigen Erzeuger (Kalender, Buchungen, Preise, externer Kalender) rechnen das
Ende korrekt ab.

Geprüft wird nur der OBERE Rand von Sperr-Pushes (`availability = 0`): dort ist
ein Tag zu viel gleichbedeutend mit unverkäuflich. Freigabe-Pushes
(`availability > 0`) sind die andere Richtung und hängen am Ist-Stand mehrerer
Einheiten; sie hier mitzuprüfen ergäbe Rauschen statt Befunden.

Aufruf:
    uv run python scripts/ari_diff_pruefen.py
    uv run python scripts/ari_diff_pruefen.py --tage 30
    uv run python scripts/ari_diff_pruefen.py --objekt <UUID>
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# pylint: disable=wrong-import-position  # der sys.path-Einschub oben muss zuerst
from supabase import Client, create_client  # noqa: E402

GRUEN = "\033[32m"
ROT = "\033[31m"
GRAU = "\033[90m"
AUS = "\033[0m"


def _db() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
        "SUPABASE_SERVICE_KEY"
    )
    if not url or not key:
        print(f"{ROT}SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY fehlen.{AUS}")
        raise SystemExit(2)
    return create_client(url, key)


def _tage(von: str, bis_inkl: str) -> list[str]:
    """Alle ISO-Tage [von … bis_inkl] — dieselbe Rechnung wie `_iso_days`.

    Bewusst nachgebaut statt importiert: das Skript prüft, ob der SENDER diese
    Konvention einhält. Zöge es die Funktion aus demselben Modul, prüfte es den
    Sender gegen sich selbst.
    """
    lo = date.fromisoformat(von[:10])
    hi = date.fromisoformat(bis_inkl[:10])
    out: list[str] = []
    cur = lo
    while cur <= hi:
        out.append(cur.isoformat())
        cur += timedelta(days=1)
    return out


def _gesendete_spannen(
    db: Client, seit: str, objekt: str | None
) -> list[dict[str, Any]]:
    """ALLE gesendeten Spannen des Zeitfensters, neueste zuletzt.

    Quelle ist `ari_outbox`, nicht `channex_debug_log`: die Outbox trägt die
    LOKALE property_id, das Debug-Log nur die Channex-IDs — der Vergleich mit
    `availability` liefe dort über eine zusätzliche Mapping-Auflösung, die
    selbst falsch sein kann.

    Auch die FREIGABEN (`availability > 0`) kommen mit, obwohl geprüft wird, ob
    zu viel gesperrt wurde: ohne sie vergliche das Skript eine alte Sperre mit
    dem heutigen Kalender und meldete jeden zwischenzeitlichen Storno als
    Fehler. Live waren das 2.647 Fehlalarme neben einem echten Befund — eine
    Prüfung, die man wegen Rauschen ignoriert, ist keine.

    Geholt wird SEITENWEISE. PostgREST deckelt die Antwort serverseitig (live
    bei 1000 Zeilen); bei aufsteigender Sortierung fielen damit ausgerechnet
    die NEUESTEN Aussagen heraus — die Prüfung meldete grün, während der
    gesuchte Off-by-one unter dem Schnitt lag. Ein Skript, das stillschweigend
    abschneidet, ist schlimmer als keines (Wurzel 5).
    """
    alle: list[dict[str, Any]] = []
    seite = 1000
    von = 0
    while True:
        q = (
            db.table("ari_outbox")
            .select(
                "property_id, date_from, date_to, availability, created_at, status"
            )
            .gte("created_at", seit)
        )
        if objekt:
            q = q.eq("property_id", objekt)
        teil = q.order("created_at").range(von, von + seite - 1).execute().data or []
        alle.extend(teil)
        if len(teil) < seite:
            return alle
        von += seite


def _zuletzt_gemeldet(zeilen: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    """Was den Portalen je Objekt und Tag ZULETZT gemeldet wurde.

    Die Outbox ist ein Verlauf, kein Zustand (Wurzel 5b). Für die Frage „ist
    dieser Tag bei den Portalen zu?" zählt allein die jüngste Aussage über ihn
    — genau so rechnet auch das Superseding im Sender (`_newer_covered_days`).
    """
    stand: dict[str, dict[str, int]] = defaultdict(dict)
    for r in zeilen:  # aufsteigend sortiert → die letzte Aussage gewinnt
        wert = int(r.get("availability") or 0)
        for tag in _tage(str(r["date_from"])[:10], str(r["date_to"])[:10]):
            stand[str(r["property_id"])][tag] = wert
    return stand


def _gesperrte_tage(
    db: Client, property_id: str, von: str, bis: str
) -> set[str]:
    """Die Tage, die der eigene Kalender im Bereich als NICHT verkäuflich führt.

    Jede Quelle zählt (Vertragsende, Handsperre, Buchung, Portal): gefragt ist
    nicht, WARUM ein Tag zu ist, sondern ob der Push ihn zu Recht zugemacht
    hat. Ein Tag ohne Zeile ist offen — genau das ist der gesuchte Fall.
    """
    rows = (
        db.table("availability")
        .select("date, status")
        .eq("property_id", property_id)
        .neq("status", "open")
        .gte("date", von)
        .lte("date", bis)
        .execute()
    ).data or []
    return {str(r["date"])[:10] for r in rows}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--tage", type=int, default=7, help="wie weit zurück (Vorgabe: 7)"
    )
    parser.add_argument("--objekt", help="nur dieses Objekt (UUID)")
    args = parser.parse_args()
    db = _db()

    seit = (datetime.now().astimezone() - timedelta(days=args.tage)).isoformat()
    zeilen = _gesendete_spannen(db, seit, args.objekt)
    if not zeilen:
        print(f"{GRAU}Keine ARI-Pushes in den letzten {args.tage} Tagen.{AUS}")
        return 0

    titel: dict[str, str] = {}
    ids = sorted({str(r["property_id"]) for r in zeilen})
    for p in (
        db.table("properties").select("id, title").in_("id", ids).execute()
    ).data or []:
        titel[str(p["id"])] = str(p.get("title") or p["id"])

    heute = date.today().isoformat()
    befunde: dict[str, set[str]] = defaultdict(set)
    geprueft = 0
    for pid, stand in _zuletzt_gemeldet(zeilen).items():
        # Nur Tage, die zuletzt als GESPERRT gemeldet wurden und noch kommen.
        zu = sorted(t for t, wert in stand.items() if wert == 0 and t >= heute)
        if not zu:
            continue
        geprueft += len(zu)
        befunde[pid] = set(zu) - _gesperrte_tage(db, pid, zu[0], zu[-1])

    treffer = {p: t for p, t in befunde.items() if t}
    print()
    print(f"{'=' * 78}")
    print(f"Zuletzt gesperrt gemeldete Tage geprüft: {geprueft} "
          f"(aus {len(zeilen)} Pushes, {len(ids)} Objekte, {args.tage} Tage)")
    print(f"{'=' * 78}")
    if not treffer:
        print(f"{GRUEN}Jeder gesperrt gemeldete Tag ist auch im eigenen "
              f"Kalender gesperrt.{AUS}")
        print()
        return 0

    for pid, tage in sorted(treffer.items(), key=lambda kv: -len(kv[1])):
        sortiert = sorted(tage)
        print(f"\n{ROT}{titel.get(pid, pid)}{AUS}  ({len(sortiert)} Tag(e))")
        print(f"  {GRAU}{pid}{AUS}")
        print(f"  zu viel gesperrt: {', '.join(sortiert[:10])}"
              f"{' …' if len(sortiert) > 10 else ''}")

    gesamt = sum(len(t) for t in treffer.values())
    print(f"\n{'=' * 78}")
    print(f"{ROT}{gesamt} Tag(e) in {len(treffer)} Objekt(en) gingen als "
          f"gesperrt an die Portale, obwohl der eigene Kalender sie offen "
          f"führt.{AUS}")
    print(f"{GRAU}Das sind unverkäufliche Nächte ohne Grund. Prüfe den "
          f"Erzeuger der Spanne: `date_to` muss der LETZTE betroffene Tag "
          f"sein, nicht der Tag danach.{AUS}")
    print(f"{GRAU}Liegt der Tag genau EINEN hinter dem Sperr-Horizont "
          f"(heute+730), ist er ein Nachhall des bis 14.08.2026 gesendeten "
          f"`span_bis + 1`: über ihn hat seither niemand mehr etwas gesagt, "
          f"also gilt bei den Portalen die alte Aussage weiter. Er "
          f"verschwindet, sobald der wandernde Horizont ihn einholt und der "
          f"Nachzug seine Sperrzeile schreibt — nicht durch einen neuen "
          f"Push.{AUS}")
    print()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
