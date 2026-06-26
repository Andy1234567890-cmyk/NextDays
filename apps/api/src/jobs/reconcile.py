"""CLI-Job: Channex→DB-Reconcile für ALLE Tenants.

Entkoppelt vom Live-API-Prozess: Der 15-Minuten-Cron startet diesen Job als
eigenen Prozess (`python -m src.jobs.reconcile`), statt `POST /internal/reconcile`
gegen den uvicorn-Worker zu feuern. Dadurch blockieren die vielen (teils langen)
externen Channex-Calls nie den Live-Traffic — sie laufen in einem separaten
Prozess mit eigenem Thread-Budget.

Exit-Code 0 bei Erfolg, 1 bei Fehler (für Cron-Logs sichtbar).
"""
from __future__ import annotations

import sys

from src.core.logging import configure_logging, get_logger
from src.core.supabase import get_service_client
from src.features.channel_manager.channex_client import ChannexClient
from src.features.channel_manager.service import (
    ChannelManagerError,
    ChannelManagerService,
)


def run() -> int:
    configure_logging("INFO", json_logs=True)
    log = get_logger("nextdays.jobs.reconcile")
    service = ChannelManagerService(
        service_client=get_service_client(),
        channex=ChannexClient(),
    )
    try:
        result = service.reconcile_all_tenants()
    except ChannelManagerError as exc:
        log.error("reconcile_job_failed", error=exc.message)
        return 1
    except Exception as exc:  # noqa: BLE001 — Job-Grenze: nie den Cron crashen lassen
        log.error("reconcile_job_crashed", error=str(exc))
        return 1
    log.info("reconcile_job_done", **result)
    return 0


if __name__ == "__main__":
    sys.exit(run())
