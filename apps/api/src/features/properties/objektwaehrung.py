"""Objektwährung auf die abhängigen Zeilen durchschreiben.

Die Objektwährung (`properties.currency`, 0161) ist die EINE Wahrheit: Channex
verlangt 1 Objekt = 1 Währung, ein Rate-Plan darf davon nicht abweichen. Wer sie
am Objekt ändert, muss die Rate-Plans mitziehen (Wurzel 1 — jede Aktion hat
einen Gegenzustand).

Eigenes Modul, weil `service.py` sonst über die 1500-Zeilen-Grenze läuft; der
Zweck ist klein und abgeschlossen, das passt hierher besser als in den
Objekt-Service.
"""

from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.properties")


def waehrung_auf_rate_plans(
    db: Client, tenant_id: str, property_id: str, currency: str
) -> None:
    """Objektwährung auf alle Rate-Plans des Objekts durchschreiben (Wurzel 1).

    Scope über `property_id` — der Aufrufer hat das Objekt bereits
    tenant-gescopt aktualisiert, es kann also keinem fremden Betrieb gehören.

    Best-effort im Sinne von Wurzel 5: schlägt das Nachziehen fehl, bleibt die
    Objektwährung gesetzt und ein erneutes Speichern greift wieder — es darf den
    Objekt-Update-Hauptpfad nicht kippen.
    """
    try:
        db.table("rate_plans").update({"currency": currency}).eq(
            "property_id", property_id
        ).neq("currency", currency).execute()
    except Exception:  # noqa: BLE001 — best-effort, kippt das Speichern nicht
        log.warning(
            "rate_plan_currency_sync_failed",
            tenant_id=tenant_id,
            property_id=property_id,
        )
