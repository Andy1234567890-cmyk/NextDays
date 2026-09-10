"""Verspätungsmeldung an die Leitung (0544, Vertrag §3.3).

Eine veröffentlichte Schicht, die anläuft, ohne dass jemand stempelt, ist der
einzige Personalfall, der SOFORT jemanden braucht: das Zimmer wird nicht
gereinigt, die Rezeption ist leer. Deshalb ist `verspaetung` die einzige
Kategorie des Personalbereichs mit Push (0548) — Dienstplan und Anträge haben
Tage Vorlauf, das hier hat Minuten.

Die Schwelle steht in den Betriebsregeln (`verspaetung_melden_min`, NULL = aus).
Kein Standardwert: „nach 15 Minuten melden" ist eine betriebliche Entscheidung,
keine Tatsache (Wurzel 4).

Ein `dedup_key` je Schicht sorgt dafür, dass der stündliche Tick nicht jede
Stunde erneut klingelt (Wurzel 2).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger

from ._base import als_dt
from .benachrichtigungen_zeit import melde_verspaetung

log = get_logger("nextdays.personal.verspaetung")

_LEITUNG = ("admin", "co_admin")
_ZU_MELDEN = ("veroeffentlicht", "bestaetigt")
# Wie weit zurück geschaut wird. Eine Schicht von vorgestern zu melden hilft
# niemandem; das Fenster hält die Abfrage klein und die Meldung sinnvoll.
_RUECKBLICK_STUNDEN = 12


def verspaetungen_melden(db: Client, jetzt: datetime) -> int:
    """Je Betrieb mit Schwelle: begonnene Schichten ohne Stempelung melden.

    Rückgabe = Zahl der gemeldeten Schichten. Ein Fehler in einem Mandanten
    kippt die anderen nicht.
    """
    regeln = (
        db.table("personal_regeln")
        .select("tenant_id, verspaetung_melden_min")
        .not_.is_("bestaetigt_am", "null")
        .not_.is_("verspaetung_melden_min", "null")
        .execute()
    ).data or []
    gemeldet = 0
    for regel in regeln:
        tenant_id = str(regel["tenant_id"])
        schwelle = int(regel.get("verspaetung_melden_min") or 0)
        if schwelle <= 0:
            continue
        try:
            gemeldet += _fuer_tenant(db, tenant_id=tenant_id, schwelle=schwelle, jetzt=jetzt)
        except Exception as exc:  # noqa: BLE001 — ein Mandant kippt die anderen nicht
            log.warning(
                "personal_verspaetung_tenant_fehlgeschlagen",
                tenant_id=tenant_id,
                error=str(exc)[:200],
            )
    return gemeldet


def _fuer_tenant(db: Client, *, tenant_id: str, schwelle: int, jetzt: datetime) -> int:
    grenze = jetzt - timedelta(minutes=schwelle)
    frueh = jetzt - timedelta(hours=_RUECKBLICK_STUNDEN)
    schichten = (
        db.table("personal_schichten")
        # KEIN `verspaetung_min`: die Spalte steht in `personal_zeiterfassung`,
        # nicht an der Schicht. Sie wurde hier ohnehin nirgends gelesen — der
        # Name allein liess die ganze Abfrage mit 42703 auflaufen.
        .select("id, user_id, datum, start_at, end_at, property_id")
        .eq("tenant_id", tenant_id)
        .in_("status", list(_ZU_MELDEN))
        .not_.is_("user_id", "null")
        .gte("start_at", frueh.isoformat())
        .lte("start_at", grenze.isoformat())
        .execute()
    ).data or []
    if not schichten:
        return 0
    leitung = _leitung(db, tenant_id)
    if not leitung:
        return 0
    gemeldet = 0
    for schicht in schichten:
        if _hat_gestempelt(db, tenant_id=tenant_id, schicht=schicht, jetzt=jetzt):
            continue
        melde_verspaetung(
            db,
            tenant_id=tenant_id,
            schicht=schicht,
            leitung_ids=leitung,
            dedup=f"verspaetung:{schicht['id']}",
        )
        gemeldet += 1
    if gemeldet:
        log.info("personal_verspaetungen_gemeldet", tenant_id=tenant_id, anzahl=gemeldet)
    return gemeldet


def _hat_gestempelt(
    db: Client, *, tenant_id: str, schicht: dict[str, Any], jetzt: datetime
) -> bool:
    """Gibt es eine Stempelung der Person, die die Schicht überlappt?

    Nicht `schicht_id` allein prüfen: wer ohne Schichtbezug stempelt (Terminal
    ohne passende Schicht, Nachtrag), arbeitet trotzdem — eine Meldung wäre
    dann falsch.
    """
    start = als_dt(schicht.get("start_at")) or jetzt
    ende = als_dt(schicht.get("end_at")) or jetzt
    rows = (
        db.table("personal_zeiterfassung")
        .select("id, start_at, end_at")
        .eq("tenant_id", tenant_id)
        .eq("user_id", str(schicht["user_id"]))
        .gte("start_at", (start - timedelta(hours=6)).isoformat())
        .lte("start_at", ende.isoformat())
        .execute()
    ).data or []
    for r in rows:
        z_start = als_dt(r.get("start_at"))
        z_ende = als_dt(r.get("end_at")) or jetzt.astimezone(UTC)
        if z_start and z_start < ende and start < z_ende:
            return True
    return False


def _leitung(db: Client, tenant_id: str) -> set[str]:
    rows = (
        db.table("users")
        .select("id, role, deactivated_at")
        .eq("tenant_id", tenant_id)
        .in_("role", list(_LEITUNG))
        .execute()
    ).data or []
    return {str(r["id"]) for r in rows if r.get("deactivated_at") is None}


__all__ = ["verspaetungen_melden"]
