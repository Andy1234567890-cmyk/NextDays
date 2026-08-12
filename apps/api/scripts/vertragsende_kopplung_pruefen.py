"""Vertragsende-Kopplung diagnostizieren — Abrechnungsvertrag ↔ Kalender (0378).

NUR LESEND. Zeigt für jedes Objekt die vier Ebenen, die zusammenspielen müssen,
und benennt jede Abweichung:

  1. `owner_billing_terms`   — was vereinbart ist (Satz, Geltung)
  2. der abgeleitete SOLL-Wert nach der Kopplungsregel
  3. `properties.contract_end_date` — was der Kalender führt
  4. `availability` mit `source='contract_end'` — was die Portale sehen

Warum das ein eigenes Skript braucht: die drei Ebenen liegen in drei Tabellen
und wurden bis 0378 getrennt gepflegt. Eine Abweichung ist von außen unsichtbar
— das Objekt sieht im Kalender gesperrt aus, verkauft aber bei Booking weiter,
oder umgekehrt. Live vorgefunden am 12.08.2026: vier Objekte mit
Vermarktungsende ohne jede Vertragszeile, und ein „Gültig bis", das den Kalender
nie erreichte.

Aufruf (Umgebung wie die API):
    uv run python scripts/vertragsende_kopplung_pruefen.py
    uv run python scripts/vertragsende_kopplung_pruefen.py --tenant <UUID>
    uv run python scripts/vertragsende_kopplung_pruefen.py --objekt <UUID>

Exit 1, sobald mindestens eine Abweichung gefunden ist — damit ein Aufruf im
Betrieb als Prüfung taugt und nicht nur als Bericht.
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from datetime import date
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.features.owner_billing.vertragsende_kopplung import (  # noqa: E402
    ende_bestimmen,
)
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
        print(
            f"{ROT}SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt "
            f"sein.{AUS}"
        )
        raise SystemExit(2)
    return create_client(url, key)


def _datum(wert: object) -> date | None:
    if not wert:
        return None
    return date.fromisoformat(str(wert)[:10])


def _sperrtage(db: Client, property_id: str) -> tuple[int, str | None, str | None]:
    """Zahl, erster und letzter Tag der Vertragssperre im Kalender."""
    rows = (
        db.table("availability")
        .select("date")
        .eq("property_id", property_id)
        .eq("source", "contract_end")
        .eq("status", "blocked")
        .order("date")
        .execute()
    ).data or []
    if not rows:
        return 0, None, None
    tage = [str(r["date"]) for r in rows]
    return len(tage), tage[0], tage[-1]


def _zeilen_fuer_objekt(
    terms: list[dict[str, Any]], property_id: str
) -> list[dict[str, Any]]:
    """Objekt schlägt Eigentümer — dieselbe Rangfolge wie die Kopplung."""
    eigene = [t for t in terms if str(t.get("property_id") or "") == property_id]
    return eigene or [t for t in terms if not t.get("property_id")]


def _geltung(zeile: dict[str, Any]) -> str:
    bis = zeile.get("gueltig_bis") or "unbefristet"
    umfang = "dieses Objekt" if zeile.get("property_id") else "ALLE Objekte"
    return (
        f"{zeile.get('provisions_pct')} % · {zeile.get('gueltig_ab')} bis {bis}"
        f" · {umfang}"
    )


def main() -> int:  # noqa: C901, PLR0912, PLR0915
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant", help="nur diesen Betrieb")
    parser.add_argument("--objekt", help="nur dieses Objekt")
    args = parser.parse_args()

    db = _db()

    objekte_q = db.table("properties").select(
        "id, title, tenant_id, status, contract_end_date"
    )
    if args.tenant:
        objekte_q = objekte_q.eq("tenant_id", args.tenant)
    if args.objekt:
        objekte_q = objekte_q.eq("id", args.objekt)
    objekte = (objekte_q.order("title").execute()).data or []

    zuordnung = (
        db.table("owner_properties").select("owner_id, property_id").execute()
    ).data or []
    owner_je_objekt = {
        str(z["property_id"]): str(z["owner_id"]) for z in zuordnung
    }

    terms_q = db.table("owner_billing_terms").select(
        "id, tenant_id, owner_id, property_id, gueltig_ab, gueltig_bis, "
        "provisions_pct"
    )
    if args.tenant:
        terms_q = terms_q.eq("tenant_id", args.tenant)
    alle_terms = (terms_q.execute()).data or []
    terms_je_owner: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for zeile in alle_terms:
        terms_je_owner[str(zeile["owner_id"])].append(zeile)

    eigentuemer = {
        str(o["id"]): str(o.get("name") or "?")
        for o in ((db.table("owners").select("id, name").execute()).data or [])
    }

    print(f"\n{'=' * 78}")
    print("VERTRAGSENDE-KOPPLUNG (0378) — Vertrag ↔ Kalender ↔ Portale")
    print(f"{'=' * 78}")
    print(
        f"{len(objekte)} Objekte, {len(alle_terms)} Vertragszeilen, "
        f"heute {date.today().isoformat()}\n"
    )

    abweichungen: list[str] = []
    ohne_vertrag: list[str] = []
    geprueft = 0

    for objekt in objekte:
        property_id = str(objekt["id"])
        titel = str(objekt.get("title") or property_id)
        owner_id = owner_je_objekt.get(property_id)
        zeilen = (
            _zeilen_fuer_objekt(terms_je_owner.get(owner_id, []), property_id)
            if owner_id
            else []
        )
        ist = _datum(objekt.get("contract_end_date"))
        soll = ende_bestimmen(zeilen) if zeilen else None
        anzahl, erster, letzter = _sperrtage(db, property_id)

        # Objekte ohne Vertrag UND ohne Ende sind unauffällig — nicht drucken,
        # sonst ist der Bericht bei 20 Objekten nicht mehr lesbar.
        if not zeilen and ist is None and anzahl == 0:
            continue
        geprueft += 1

        print(f"{'-' * 78}")
        kopf = f"{titel}  {GRAU}{property_id}{AUS}"
        print(f"{kopf}   [{objekt.get('status')}]")
        if owner_id:
            print(
                f"  Eigentümer      {eigentuemer.get(owner_id, '?')} "
                f"{GRAU}{owner_id}{AUS}"
            )
        else:
            print(f"  Eigentümer      {GELB}keiner zugeordnet{AUS}")

        if zeilen:
            for zeile in sorted(zeilen, key=lambda z: str(z["gueltig_ab"])):
                print(f"  Vertrag         {_geltung(zeile)}")
        else:
            print(f"  Vertrag         {GRAU}keine Zeile{AUS}")

        print(f"  SOLL (Regel)    {soll.isoformat() if soll else 'kein Ende'}")
        print(f"  IST (Kalender)  {ist.isoformat() if ist else 'kein Ende'}")

        if anzahl:
            print(f"  Sperrnächte     {anzahl}  ({erster} … {letzter})")
        else:
            print(f"  Sperrnächte     {GRAU}0{AUS}")

        # --- Bewertung ---
        if not zeilen:
            if ist is not None:
                ohne_vertrag.append(titel)
                print(
                    f"  {GELB}→ Vermarktungsende ohne Abrechnungsvertrag. "
                    f"Quelle ist der Kündigungsantrag oder ein Handeintrag; "
                    f"die Kopplung fasst es nicht an.{AUS}"
                )
        elif soll != ist:
            abweichungen.append(
                f"{titel}: SOLL {soll or 'kein Ende'} ≠ IST "
                f"{ist or 'kein Ende'}"
            )
            print(
                f"  {ROT}→ ABWEICHUNG: der Vertrag sagt "
                f"{soll.isoformat() if soll else 'kein Ende'}, der Kalender "
                f"führt {ist.isoformat() if ist else 'kein Ende'}. Ein "
                f"Speichern am Vertrag zieht es nach.{AUS}"
            )
        else:
            print(f"  {GRUEN}→ Vertrag und Kalender stimmen überein.{AUS}")

        # Der Kalender-Riegel selbst: ein Ende ohne Sperrnächte heißt, die
        # Portale verkaufen weiter — der eigentliche Schaden.
        if ist is not None and anzahl == 0:
            abweichungen.append(f"{titel}: Ende {ist} OHNE Sperrnächte")
            print(
                f"  {ROT}→ ABWEICHUNG: Enddatum gesetzt, aber KEINE "
                f"Sperrnacht im Kalender. Die Portale verkaufen dieses Objekt "
                f"weiter.{AUS}"
            )
        elif ist is not None and erster and _datum(erster) != max(
            ist, date.today()
        ):
            # Die Sperre beginnt am Endtag; liegt er in der Vergangenheit, ab
            # heute (vertragsende.py sperrt nicht rückwirkend).
            abweichungen.append(
                f"{titel}: Sperre beginnt {erster}, erwartet "
                f"{max(ist, date.today()).isoformat()}"
            )
            print(
                f"  {ROT}→ ABWEICHUNG: erste Sperrnacht {erster}, erwartet "
                f"{max(ist, date.today()).isoformat()}.{AUS}"
            )
        if ist is None and anzahl:
            abweichungen.append(f"{titel}: {anzahl} Sperrnächte ohne Enddatum")
            print(
                f"  {ROT}→ ABWEICHUNG: {anzahl} Vertragssperren im Kalender, "
                f"aber kein Enddatum am Objekt. Diese Nächte sind unverkäuflich "
                f"ohne Grund.{AUS}"
            )

    print(f"{'=' * 78}")
    print(f"{geprueft} Objekte mit Vertrag oder Vermarktungsende geprüft.")
    if ohne_vertrag:
        print(
            f"{GELB}{len(ohne_vertrag)} davon ohne Abrechnungsvertrag: "
            f"{', '.join(ohne_vertrag)}{AUS}"
        )
    if abweichungen:
        print(f"\n{ROT}{len(abweichungen)} ABWEICHUNG(EN):{AUS}")
        for zeile in abweichungen:
            print(f"  {ROT}·{AUS} {zeile}")
        print()
        return 1
    print(f"{GRUEN}Keine Abweichung — alle drei Ebenen stimmen überein.{AUS}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
