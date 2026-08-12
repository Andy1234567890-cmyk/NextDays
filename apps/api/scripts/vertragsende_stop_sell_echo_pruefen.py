"""Stop-Sell-Echo auf Vertragsende-Nächten finden (0378).

NUR LESEND. `--aufraeumen` gibt das SQL zum Löschen aus, führt es aber NICHT
aus — der Eingriff bleibt beim Menschen.

WAS HIER GESUCHT WIRD:
Ein Vertragsende sperrt die Nächte und meldet den Portalen `availability = 0`.
Channex macht daraus für die OTAs einen Stop-Sell, und der ARI-Import las diesen
Stop-Sell bis 0378 als FREMDE Information zurück — als Zeile mit
`source='channex'` auf genau denselben Tagen.

WARUM DAS EINE PRÜFUNG BRAUCHT UND NICHT NUR EINEN FIX:
Der Schaden ist die AUSSAGE. Der Kalender zeigte „Stop-Sell · alle Kanäle"
statt „Vertragsende": ein Grund, den die Agentur selbst gesetzt haben könnte
und mit einem Klick aufhebt — dahinter steht aber ein beendeter Vertrag, der
gar nicht aufhebbar sein darf. Von außen ist das nicht unterscheidbar, beide
Balken sehen nach „gesperrt" aus. Live gefunden am 12.08.2026 an Feriehus
Kornblomst: 307 Zeilen, angelegt vier Sekunden nach dem eigenen Push.

Der Import schreibt seit 0378 keine solchen Zeilen mehr. Dieses Skript findet
die ALTBESTÄNDE und dient danach als Wächter — ein neuer Treffer heißt, es gibt
einen zweiten Weg ins `stop_sell`, den der Filter nicht abdeckt.

Aufruf:
    uv run python scripts/vertragsende_stop_sell_echo_pruefen.py
    uv run python scripts/vertragsende_stop_sell_echo_pruefen.py --objekt <UUID>
    uv run python scripts/vertragsende_stop_sell_echo_pruefen.py --aufraeumen

Exit 1, sobald ein Echo gefunden ist.
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from collections.abc import Callable
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from postgrest import SyncSelectRequestBuilder  # noqa: E402
from supabase import Client, create_client  # noqa: E402

GRUEN = "\033[32m"
ROT = "\033[31m"
GELB = "\033[33m"
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


def _seitenweise(
    db: Client,
    tabelle: str,
    spalten: str,
    aufbau: Callable[[SyncSelectRequestBuilder], SyncSelectRequestBuilder],
    seite: int = 1000,
) -> list[dict[str, Any]]:
    """Alle Zeilen holen, nicht nur die erste PostgREST-Seite.

    Ohne das meldete die Prüfung bei 672 Sperrnächten „alles in Ordnung", weil
    sie nur die ersten 1000 Zeilen sah — eine Prüfung, die stillschweigend
    abschneidet, ist schlimmer als keine (Wurzel 5).
    """
    alle: list[dict[str, Any]] = []
    von = 0
    while True:
        teil = (
            aufbau(db.table(tabelle).select(spalten))
            .range(von, von + seite - 1)
            .execute()
        ).data or []
        alle.extend(teil)
        if len(teil) < seite:
            return alle
        von += seite


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--objekt", help="nur dieses Objekt")
    parser.add_argument(
        "--aufraeumen",
        action="store_true",
        help="SQL zum Löschen ausgeben (führt NICHTS aus)",
    )
    args = parser.parse_args()
    db = _db()

    def objekt_filter(
        q: SyncSelectRequestBuilder,
    ) -> SyncSelectRequestBuilder:
        return q.eq("property_id", args.objekt) if args.objekt else q

    # Alle Vertragsende-Nächte …
    vertragsende = _seitenweise(
        db,
        "availability",
        "property_id, date",
        lambda q: objekt_filter(
            q.eq("source", "contract_end").eq("status", "blocked")
        ),
    )
    # … und alle Stop-Sells, die vom Portal-Import kommen.
    stops = _seitenweise(
        db,
        "stop_sell",
        "id, property_id, date, source, created_at",
        lambda q: objekt_filter(q.eq("source", "channex")),
    )

    titel = {
        str(p["id"]): str(p.get("title") or p["id"])
        for p in (
            db.table("properties").select("id, title").execute().data or []
        )
    }

    ende_tage: dict[str, set[str]] = defaultdict(set)
    for zeile in vertragsende:
        ende_tage[str(zeile["property_id"])].add(str(zeile["date"]))

    echos: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for stop in stops:
        pid = str(stop["property_id"])
        if str(stop["date"]) in ende_tage.get(pid, set()):
            echos[pid].append(stop)

    print(f"\n{'=' * 78}")
    print("STOP-SELL-ECHO AUF VERTRAGSENDE-NÄCHTEN (0378)")
    print(f"{'=' * 78}")
    print(
        f"{len(vertragsende)} Vertragsende-Nächte, "
        f"{len(stops)} Portal-Stop-Sells geprüft\n"
    )

    if not echos:
        print(
            f"{GRUEN}Kein Echo — auf keiner Vertragsende-Nacht liegt ein "
            f"Portal-Stop-Sell.{AUS}\n"
        )
        return 0

    gesamt = 0
    for pid, zeilen in sorted(echos.items(), key=lambda kv: titel.get(kv[0], "")):
        tage = sorted(str(z["date"]) for z in zeilen)
        gesamt += len(zeilen)
        print(f"{'-' * 78}")
        print(f"{titel.get(pid, pid)}  {GRAU}{pid}{AUS}")
        print(f"  {ROT}{len(zeilen)} Echo-Zeilen{AUS}  {tage[0]} … {tage[-1]}")
        print(
            f"  {GELB}→ Der Kalender nennt hier Stop-Sell statt Vertragsende. "
            f"Die Agentur sieht eine Einstellung, die sie aufheben kann — "
            f"dahinter steht ein beendeter Vertrag.{AUS}"
        )
        if args.aufraeumen:
            print(f"\n  {GRAU}-- Löschen (nicht ausgeführt):{AUS}")
            # S608 ist hier gegenstandslos: der Text wird AUSGEGEBEN, nicht
            # ausgeführt. Der Eingriff in die Live-Daten bleibt beim Menschen.
            print(
                "  delete from public.stop_sell\n"  # noqa: S608
                f"  where property_id = '{pid}'\n"
                "    and source = 'channex'\n"
                "    and exists (\n"
                "      select 1 from public.availability a\n"
                "      where a.property_id = stop_sell.property_id\n"
                "        and a.date = stop_sell.date\n"
                "        and a.source = 'contract_end'\n"
                "        and a.status = 'blocked'\n"
                "    );\n"
            )

    print(f"{'=' * 78}")
    print(f"{ROT}{gesamt} Echo-Zeilen in {len(echos)} Objekten.{AUS}")
    if not args.aufraeumen:
        print(
            f"{GRAU}Mit --aufraeumen das Lösch-SQL ausgeben. Vorher ein "
            f"Backup ziehen.{AUS}"
        )
    print()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
