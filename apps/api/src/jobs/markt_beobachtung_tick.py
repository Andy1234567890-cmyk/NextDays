"""Tages-Tick: Marktbeobachtung — Preisniveau der Umgebung ins Raster holen.

Einreihen und Abarbeiten stehen hier zusammen (Muster wie
`feed_abgleich_tick`): der Worker kennt nur Registry und Aufruf, der Fachlauf
liegt in `pricing.market.beobachtung_service`.

WARUM EIN JOB UND NICHT IM RECOMPUTE
====================================
Der Recompute laeuft je Objekt und oft; ein Fremdabruf darin haette eine
Preisberechnung an die Erreichbarkeit eines Dritten gekettet und die Quelle
vielfach getroffen. Hier laeuft er EINMAL taeglich fuer alle, das Ergebnis
liegt im Raster, und der Recompute liest nur noch.

TENANT-LOS MIT ABSICHT
======================
Marktdaten sind betriebsuebergreifend: eine Rasterzelle bedient alle Objekte,
die in ihr liegen, egal welchem Betrieb sie gehoeren. Ein Job je Tenant wuerde
dieselbe Zelle mehrfach abrufen. Deshalb genau EIN Job pro Tag, ohne
`tenant_id` — der Dedup-Key traegt nur den Tagesbucket.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.features.pricing.market.beobachtung_service import MarktBeobachtung
from src.jobs.channex_budget import ChannexBudget
from src.jobs.queue import enqueue

log = get_logger("nextdays.jobs.markt_beobachtung_tick")

JOB_TYPE = "markt_beobachtung"


def einreihen(db: Client, bucket: int) -> int:
    """Genau einen Lauf je Tag einreihen (betriebsuebergreifend)."""
    enqueue(
        db, JOB_TYPE,
        payload={},
        dedup_key=f"markt_beobachtung_tick:{bucket}",
    )
    log.info("markt_beobachtung_eingereiht", bucket=bucket)
    return 1


def handle(
    db: Client, _payload: dict[str, Any], _budget: ChannexBudget | None = None
) -> dict[str, Any]:
    """Worker-Handler des Jobs `markt_beobachtung` (Registry in `src/worker.py`).

    Zieht KEIN Channex-Budget: der Lauf spricht Channex nicht an.
    """
    return MarktBeobachtung(db).lauf()
