"""Tages-Tick: Portalpreise der Dynamic-Pricing-Objekte gegen das Soll abgleichen.

WARUM
=====
`reconcile_rate_plan_prices` (Soll aus dem Resolver gegen den lokalen Schatten,
nur die Differenz wird gesendet) lief bisher NUR auf Nutzerwunsch („Jetzt
uebertragen"). Es gab keinen taeglichen Auslaeufer — deshalb standen am
04.09.2026 435 von 540 Tagen falsch bei Channex, tagelang, ohne dass irgendein
Job sie nachgezogen haette. Der Betrieb hat es im Extranet gesehen.

Hier wird der Abgleich je Objekt mit eingeschaltetem Dynamic Pricing EINMAL
pro Tag eingereiht. Er sendet nichts, wenn nichts abweicht (Wurzel 2), und
zieht Channex-Budget nur fuer die Tage, die wirklich raus muessen.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.jobs.queue import enqueue

log = get_logger("nextdays.jobs.dp_portal_abgleich_tick")

JOB_TYPE = "reconcile_rate_plan_prices"


def einreihen(db: Client, bucket: int) -> int:
    """Je DP-Objekt mit Channex-Anbindung einen Abgleich einreihen — Dedup je
    Objekt und Tagesbucket, damit N Worker-Instanzen einen Job erzeugen."""
    aktiv = (
        db.table("dp_settings").select("property_id").eq("enabled", True).execute()
    ).data or []
    ids = sorted({str(r["property_id"]) for r in aktiv if r.get("property_id")})
    if not ids:
        return 0
    anzahl = 0
    for i in range(0, len(ids), 100):
        maps = (
            db.table("channex_property_map")
            .select("tenant_id, property_id")
            .in_("property_id", ids[i : i + 100])
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        for m in maps:
            tid, pid = str(m["tenant_id"]), str(m["property_id"])
            enqueue(
                db, JOB_TYPE, tenant_id=tid,
                payload={"tenant_id": tid, "property_id": pid},
                dedup_key=f"dp_portal_abgleich:{pid}:{bucket}",
            )
            anzahl += 1
    log.info("dp_portal_abgleich_eingereiht", objekte=anzahl, bucket=bucket)
    return anzahl
