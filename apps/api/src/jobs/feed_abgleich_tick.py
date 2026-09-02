"""Tages-Tick: Feed-Staging ↔ Reservierungen abgleichen (Selbstheilung).

Einreihen und Abarbeiten des Jobs `abgleich_feed_buchungen` stehen hier
zusammen, wie bei `portal_raten_tick`: der Worker kennt nur Registry und
Aufruf. Der Fachlauf liegt in `channel_manager.buchungs_abgleich` — dort steht
auch, WARUM es diesen Abgleich gibt (54 von einem CSV-Upload ueberschriebene
Feed-Buchungen am 31.08.2026, Staging-Zeilen ohne Reservierung).

Kein Channex-Call: der Job liest nur `channex_booking` und `reservations` und
schickt Abweichungen durch die bestehende Projektion. Er zieht deshalb KEIN
Token-Budget — ein erschoepftes Budget darf die reine DB-Heilung nicht stoppen.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.features.channel_manager.service import ChannelManagerService
from src.jobs.channex_budget import ChannexBudget
from src.jobs.queue import enqueue

log = get_logger("nextdays.jobs.feed_abgleich_tick")

JOB_TYPE = "abgleich_feed_buchungen"


def einreihen(db: Client, bucket: int) -> int:
    """Je Betrieb mit aktivem Channex-Mapping einen Abgleich einreihen.

    `bucket` ist der Wall-Clock-Tagesbucket des Reconcile-Ticks — mehrere
    Worker-Instanzen reihen damit je Betrieb und Tag genau EINEN Job ein.
    """
    rows = (
        db.table("channex_property_map")
        .select("tenant_id")
        .is_("deleted_at", "null")
        .execute()
    ).data or []
    tenants = sorted({str(r["tenant_id"]) for r in rows if r.get("tenant_id")})
    for tid in tenants:
        enqueue(
            db, JOB_TYPE, tenant_id=tid,
            payload={"tenant_id": tid},
            dedup_key=f"feed_abgleich_tick:{tid}:{bucket}",
        )
    log.info("feed_abgleich_eingereiht", tenants=len(tenants), bucket=bucket)
    return len(tenants)


def handle(
    db: Client, payload: dict[str, Any], _budget: ChannexBudget | None = None
) -> dict[str, Any]:
    """Worker-Handler des Jobs `abgleich_feed_buchungen` (Registry in `src/worker.py`)."""
    return ChannelManagerService(service_client=db).feed_buchungen_abgleichen(
        str(payload["tenant_id"])
    )
