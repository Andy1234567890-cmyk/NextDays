"""Modul-Entitlements — EINE Quelle für „hat dieser Betrieb Modul X gebucht?".

Vorher stand dieselbe Abfrage dreimal im Code (Abrechnung, Preis-Engine,
Einstellungen). Drei Kopien heißt: eine kann fail-OPEN werden, ohne dass es
auffällt. Deshalb hier EINE Funktion, die fail-CLOSED antwortet (Wurzel 5):
ohne Tenant, ohne Zeile oder bei ``active = false`` gilt das Modul als NICHT
gebucht — ein kostenpflichtiges Feature wird nie versehentlich verschenkt.

Warum kein Cache: die Antwort entscheidet über Geld (0,5 % je Buchung) und über
Feature-Zugang. Eine Sekunde alte Wahrheit ist hier schlechter als eine Abfrage.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.subscriptions.entitlements")


def modul_aktiv(db: Client, tenant_id: str | None, module_key: str) -> bool:
    """Hat der Tenant das Modul gebucht? Fail-CLOSED bei fehlendem Tenant/Zeile."""
    if not tenant_id:
        return False
    rows = (
        db.table("tenant_module_entitlement")
        .select("active")
        .eq("tenant_id", tenant_id)
        .eq("module_key", module_key)
        .limit(1)
        .execute()
    ).data or []
    return bool(rows) and bool(rows[0].get("active"))
