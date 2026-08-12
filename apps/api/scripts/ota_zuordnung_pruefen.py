"""Findet OTA-Buchungen, deren Zuordnung unvollständig ist — die stillen Lücken.

Drei Klassen von Lücke, alle live am 11.08.2026 im Bestand gefunden und alle
unsichtbar, weil die entstehenden Zahlen plausibel aussehen:

1. **Buchung ohne Objekt** — `channex_booking.property_id` NULL. Jede
   Auswertung, die über diese Spalte joint (Eigentümer-Reporting, Umsatz je
   Objekt), verliert die Buchung stillschweigend. Gefunden: 2 Buchungen mit
   gesetzter `property_map_id`, aber leerer `property_id`.

2. **Unmapped Rate** — `rooms[].rate_plan_id` NULL, aber ein Portal-Rate-Code
   liegt vor. Channex kann den vom Portal gemeldeten Rate-Plan keinem unserer
   Pläne zuordnen. Das betrifft **Verfügbarkeit und Restriktionen** dieser Rate
   (Channex nennt es selbst eine Überbuchungsgefahr), NICHT die Gebühren — die
   fehlen bei den Alt-Buchungen wegen des Import-Eingangswegs, an vier Objekten
   mit identischer Channex-Konfiguration gegengeprüft. Gefunden: 9 von 77.
   Bei Airbnb ist ein leerer Rate-Plan der NORMALFALL (das Portal meldet keinen,
   22/22 geprüft) und wird hier nicht gemeldet.

3. **Portal-Buchung ohne Aufstellung** — die Buchung bringt keine
   Gebührenaufstellung mit. Seit 11.08.2026 werden dann KEINE Gebühren angesetzt:
   nicht gemeldet heißt nicht gezahlt. Vorher sprangen die Objekt-Stammdaten ein
   und erzeugten über den Bestand 191 Reinigungs- (186.120 DKK), 151 Resort-
   (20.950 DKK) und 73 Haustier-Posten (10.950 DKK), von denen kein einziger
   belegt war. Diese Buchungen erscheinen hier, weil ihre Auszahlung unter dem
   liegt, was der Betrieb erwartet — und er wissen muss, warum.

Aufruf::

    cd apps/api
    python -m scripts.ota_zuordnung_pruefen                 # alle Betriebe
    python -m scripts.ota_zuordnung_pruefen --tenant <uuid> # einer
    python -m scripts.ota_zuordnung_pruefen --exit-code     # Exit 1 bei Befund

Nur LESEND. `--exit-code` macht es für einen Cron/CI-Lauf nutzbar: solange nichts
gefunden wird, ist es still.
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from typing import TYPE_CHECKING, Any

from src.core.supabase import get_service_client

if TYPE_CHECKING:  # pragma: no cover - nur für die Typprüfung
    from supabase import Client

_BUCHUNG_SPALTEN = (
    "id, tenant_id, property_id, property_map_id, ota_name, "
    "ota_reservation_code, arrival_date, departure_date, raw"
)


def _buchungen(db: Client, tenant_id: str | None) -> list[dict[str, Any]]:
    q = db.table("channex_booking").select(_BUCHUNG_SPALTEN)
    if tenant_id:
        q = q.eq("tenant_id", tenant_id)
    return q.execute().data or []


def _objekt_gebuehren_arten(db: Client, tenant_id: str | None) -> dict[str, list[str]]:
    """property_id → gepflegte Gebührenarten (aus `type_attributes.pricing.fees`)."""
    q = db.table("properties").select("id, tenant_id, title, type_attributes")
    if tenant_id:
        q = q.eq("tenant_id", tenant_id)
    out: dict[str, list[str]] = {}
    for row in q.execute().data or []:
        fees = ((row.get("type_attributes") or {}).get("pricing") or {}).get(
            "fees"
        ) or []
        arten = [
            str(f.get("feeType"))
            for f in fees
            if isinstance(f, dict) and f.get("feeType")
        ]
        if arten:
            out[str(row["id"])] = arten
    return out


def _titel(db: Client, tenant_id: str | None) -> dict[str, str]:
    q = db.table("properties").select("id, title")
    if tenant_id:
        q = q.eq("tenant_id", tenant_id)
    return {str(r["id"]): str(r.get("title") or "?") for r in q.execute().data or []}


def _hat_gebuehren_im_payload(raw: object) -> bool:
    """Bringt der Payload eine Gebührenaufstellung mit?

    Benutzt `portal_posten` — DIESELBE Leser-Reihenfolge wie die Abrechnung.
    Eine eigene Kette hier wäre die zweite Wahrheit: die Diagnose meldete dann
    „alles in Ordnung", während die Auszahlung eine andere Stelle liest (oder
    umgekehrt). Als `rooms[].taxes` als bessere erste Stelle dazukam, hätte eine
    Kopie hier weiter die alte gelesen.
    """
    from src.features.owner_statements.gebuehren_quelle import portal_posten

    return bool(portal_posten(raw))


def _unmapped_rooms(raw: object) -> list[dict[str, Any]]:
    """Zimmer, deren Rate-Plan Channex nicht auflösen konnte — echte Lücken nur.

    Ausschlag gibt der PORTAL-CODE, nicht der leere Rate-Plan. Live gezählt
    (11.08.2026, 77 Buchungen): Airbnb schickt in 0 von 22 Fällen einen
    Rate-Plan-Code, Booking in 55 von 55. Ein leerer Rate-Plan ohne Code ist
    also bei Airbnb der Normalfall und keine Lücke — ihn zu melden wäre eine
    Dauerwarnung, gegen die niemand etwas tun kann.

    Gemeldet wird nur, wo das Portal einen Code geschickt hat, den Channex nicht
    zuordnen konnte („Unmapped Rate" im Live-Feed).
    """
    if not isinstance(raw, dict):
        return []
    rooms = raw.get("rooms")
    if not isinstance(rooms, list):
        return []
    return [
        r
        for r in rooms
        if isinstance(r, dict)
        and not r.get("rate_plan_id")
        and (r.get("meta") or {}).get("rate_plan_code")
    ]


def pruefen(db: Client, tenant_id: str | None) -> dict[str, list[str]]:
    """Die drei Lücken sammeln. Rückgabe: Klasse → Zeilen für die Ausgabe."""
    titel = _titel(db, tenant_id)
    gepflegt = _objekt_gebuehren_arten(db, tenant_id)
    befunde: dict[str, list[str]] = defaultdict(list)

    for b in _buchungen(db, tenant_id):
        code = str(b.get("ota_reservation_code") or b["id"])
        kanal = str(b.get("ota_name") or "?")
        pid = str(b.get("property_id") or "")
        objekt = titel.get(pid, "(kein Objekt)")
        zeitraum = f"{b.get('arrival_date')}→{b.get('departure_date')}"

        if not pid:
            hinweis = (
                " (Map-Zeile vorhanden — property_id wurde nicht mitgeschrieben)"
                if b.get("property_map_id")
                else " (Inserat bei uns nicht gemappt)"
            )
            befunde["ohne_objekt"].append(
                f"{kanal:<11} {code:<14} {zeitraum}{hinweis}"
            )

        unmapped = _unmapped_rooms(b.get("raw"))
        if unmapped:
            codes = [
                str((r.get("meta") or {}).get("rate_plan_code") or "—")
                for r in unmapped
            ]
            befunde["unmapped_rate"].append(
                f"{kanal:<11} {code:<14} {objekt[:24]:<24} "
                f"Portal-Rate-Code: {', '.join(codes)}"
            )

        # Die Frage ist, ob das PORTAL geliefert hat — nicht, ob am Objekt etwas
        # gepflegt ist. Vorher war die Objekt-Pflege der Auslöser; damit blieb
        # eine Buchung ohne Aufstellung an einem Objekt ohne gepflegte Gebühren
        # unsichtbar, obwohl sie genauso wenig belegt ist.
        if not _hat_gebuehren_im_payload(b.get("raw")):
            from src.features.owner_statements.gebuehren_quelle import (
                _stammdaten_grund,
            )

            grund = _stammdaten_grund(b.get("raw"))
            hinweis = (
                f"am Objekt gepflegt: {', '.join(gepflegt[pid])}"
                if pid and pid in gepflegt
                else "am Objekt keine Gebühren gepflegt"
            )
            befunde[f"gebuehren_{grund}"].append(
                f"{kanal:<11} {code:<14} {objekt[:24]:<24} {hinweis}"
            )

    return befunde


_KOPF = {
    "ohne_objekt": (
        "BUCHUNGEN OHNE OBJEKT — jede Auswertung über property_id verliert sie"
    ),
    "unmapped_rate": (
        "UNMAPPED RATE — das Portal meldet einen Rate-Code, den Channex keinem "
        "Preisplan zuordnen kann. Betrifft Verfügbarkeit und Restriktionen "
        "dieser Rate (Überbuchungsgefahr), NICHT die Gebühren"
    ),
    # Nach GRUND getrennt, weil nur einer davon behebbar ist.
    "gebuehren_channex_import": (
        "CHANNEX-IMPORT OHNE AUFSTELLUNG — beim Kanal-Anschluss nachgeholte "
        "Buchungen enthalten laut Channex-Doku KEINE Extras und "
        "Reinigungsgebühren. Nicht behebbar und kein Konfigurationsfehler. Die "
        "Abrechnung setzt hier KEINE Gebühren an (nicht gemeldet = nicht "
        "gezahlt); die Auszahlung liegt darum unter der erwarteten"
    ),
    "gebuehren_portal_meldet_keine": (
        "PORTAL MELDET KEINE GEBÜHREN — normale Buchung ohne Aufstellung. Bei "
        "Booking.com hängt das an der Extranet-Konfiguration (Property → "
        "Policies → Additional fees & charges) und am Gültigkeitsbeginn der "
        "Gebühr (im Payload: rooms[].meta.charge_periods)"
    ),
    "gebuehren_kein_payload": (
        "KEIN PAYLOAD — Buchung ohne Zimmerdaten (CSV-/Direktimport). Ohne "
        "Portal gelten die Objekt-Stammdaten, das ist hier richtig"
    ),
}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--tenant", help="nur dieser Betrieb (UUID)")
    p.add_argument(
        "--exit-code",
        action="store_true",
        help="Exit 1, wenn etwas gefunden wurde (für Cron/CI)",
    )
    args = p.parse_args()

    befunde = pruefen(get_service_client(), args.tenant)
    gesamt = sum(len(v) for v in befunde.values())

    if not gesamt:
        print("Keine Zuordnungslücken gefunden.")
        return 0

    for schluessel, kopf in _KOPF.items():
        zeilen = befunde.get(schluessel) or []
        if not zeilen:
            continue
        print(f"\n=== {kopf} ({len(zeilen)}) ===")
        for z in zeilen:
            print(f"  {z}")

    print(f"\n{gesamt} Befund(e).")
    if befunde.get("unmapped_rate"):
        print(
            "\nUnmapped Rate in Channex zuordnen (Channels → Mapping): der "
            "Portal-Rate-Code gehört an einen Preisplan. Es geht dabei NICHT um "
            "Gebühren, sondern um Verfügbarkeit und Restriktionen — Channex "
            "nennt ungelöste Mapping-Probleme selbst eine Überbuchungsgefahr."
        )
    if befunde.get("gebuehren_channex_import"):
        print(
            "\nDie Channex-Importe sind KEIN Fehler und nicht behebbar: beim "
            "Verbinden eines Kanals holt Channex bestehende Buchungen nach und "
            "lässt Extras/Reinigungsgebühren weg (eigene Doku). Am 11.08.2026 "
            "über 55 Booking-Buchungen geprüft: 52 mit is_imported=True hatten "
            "keine Gebühren, 3 normal eingegangene hatten sie vollständig — bei "
            "identischer Channex-Konfiguration.\n"
            "Für diese Buchungen setzt die Abrechnung KEINE Gebühren an: was "
            "das Portal nicht gemeldet hat, hat der Gast nicht gezahlt. Bis "
            "11.08.2026 sprangen hier die Objekt-Stammdaten ein und erzeugten "
            "über den Bestand 218.020 DKK an Posten, die kein Gast bezahlt "
            "hatte. Wer die Gebühr trotzdem abrechnen will, trägt sie an der "
            "Buchung nach — dann ist sie eine Entscheidung des Betriebs und "
            "keine Vermutung der Software."
        )
    return 1 if args.exit_code else 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
