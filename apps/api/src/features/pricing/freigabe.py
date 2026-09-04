"""Freigabe-Sperre für den Portal-Push — EINE Stelle für alle Push-Wege.

WARUM DAS GATE HIER SITZT UND NICHT IM RESOLVER
===============================================
Erster Versuch (04.09.2026, sofort zurückgebaut): die Sperre steckte im
`PricingResolver`, damit sie keiner der Push-Wege umgehen kann. Das war
falsch — der Resolver ist die EINE Preis-Wahrheit für alles: Kalender,
Angebot, eigene Buchungsstrecke, Portal-Push.

Die Folge war live sichtbar: der Kalender zeigte 550/605/632 DKK
(Saisonpreise), während 540 berechnete Tage zwischen 440 und 801 DKK
danebenlagen und auf Freigabe warteten. Zwei Wahrheiten nebeneinander, ohne
Hinweis welche gilt. Schlimmer noch: ein Gast auf der eigenen Plattform hätte
den Saisonpreis BEZAHLT — die Sperre hätte nicht nur die Anzeige, sondern den
echten Verkaufspreis verändert. Gemeldet wurde es nicht vom System, sondern
vom Auge: *"alle einstellung und preise im kalender sind nicht syncrone"*.

Die Freigabe betrifft genau eine Frage: geht der Preis schon an FREMDE
Portale? Sie gehört deshalb an die Aussengrenze, nicht an die Preis-Wahrheit.

WARUM EIN GETEILTER HELFER UND NICHT DREI PRÜFUNGEN
====================================================
Es gibt drei Wege nach draussen — `recompute._push_to_channex`,
`ari_push.push_ari` und `full_sync`. Eine Sperre in nur einem davon ist eine
Attrappe: genau daran scheiterte der frühere "Autopilot"-Modus, dessen Gate im
Recompute sass, während Reconcile und Full-Sync munter weiterschickten. Alle
drei fragen hier, und ein vierter Weg fällt beim Lesen dieser Datei auf.
"""
from __future__ import annotations

from datetime import date

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.pricing.freigabe")


def freigabe_noetig(db: Client, property_id: str) -> bool:
    """Wartet dieses Objekt mit dem Senden auf eine Freigabe?

    Fail-OFFEN (Standard: nein). Anders als bei Rechte-Prüfungen ist das hier
    richtig: ein Lesefehler darf nicht dazu führen, dass Preise stillschweigend
    NICHT mehr an die Portale gehen. Ein stehengebliebener Preis fällt
    niemandem auf, bis ein Gast zu ihm bucht.
    """
    try:
        res = (
            db.table("dp_settings")
            .select("freigabe_noetig")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — kein Flag = senden wie bisher
        log.warning("dp_freigabe_flag_unlesbar", error=str(exc)[:200])
        return False
    return bool(res) and bool(res[0].get("freigabe_noetig"))


def gesperrte_tage(db: Client, property_id: str, von: date, bis: date) -> set[str]:
    """ISO-Tage, die (noch) NICHT an die Portale gehen dürfen.

    Leere Menge heisst "alles darf raus" — entweder verlangt das Objekt keine
    Freigabe, oder alles Berechnete ist bereits gesendet.

    `bis` ist exklusiv, wie überall im Slice.
    """
    if not freigabe_noetig(db, property_id):
        return set()
    try:
        res = (
            db.table("dynamic_prices")
            .select("date")
            .eq("property_id", property_id)
            .is_("gesendet_am", "null")
            .gte("date", von.isoformat())
            .lt("date", bis.isoformat())
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001
        log.warning("dp_gesperrte_tage_unlesbar", error=str(exc)[:200])
        return set()
    gesperrt = {r["date"] for r in res if isinstance(r.get("date"), str)}
    if gesperrt:
        log.info(
            "dp_push_wartet_auf_freigabe",
            property_id=property_id,
            tage=len(gesperrt),
        )
    return gesperrt
