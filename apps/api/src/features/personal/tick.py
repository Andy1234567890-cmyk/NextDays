"""Stündlicher Worker-Lauf des Personalbereichs (0541).

Drei Pflichten, alle idempotent (Wurzel 2):
  1. Feiertage: für jedes Land mit bestätigten Betriebsregeln laufendes und
     folgendes Jahr importieren, falls sie fehlen (E3, alle EU-Länder).
  2. Offene Stempelungen, die länger als OFFEN_WARNUNG_STUNDEN laufen → Hinweis
     an die Leitung (einmal je Stempelung und Tag, `dedup_key`).
  3. Dokumente, Nachweise und Schulungen, die in 30 Tagen ablaufen → Hinweis
     an die Leitung (einmal je Eintrag, `dedup_key` mit Ablaufdatum).
Ein Fehler in einem Mandanten kippt die anderen nicht.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger

from . import feiertage as feiertage_mod
from ._base import als_dt
from .benachrichtigungen import melde_zeit_hinweis
from .zeiterfassung import OFFEN_WARNUNG_STUNDEN

log = get_logger("nextdays.personal.tick")

_ABLAUF_VORLAUF_TAGE = 30
_LEITUNG = ("admin", "co_admin")


def _leitung(db: Client, tenant_id: str) -> set[str]:
    rows = (
        db.table("users")
        .select("id, role, deactivated_at")
        .eq("tenant_id", tenant_id)
        .in_("role", list(_LEITUNG))
        .execute()
    ).data or []
    return {str(r["id"]) for r in rows if r.get("deactivated_at") is None}


def feiertage_sicherstellen(db: Client, *, heute: date) -> dict[str, int]:
    """Länder aus den Betriebsregeln; je Land ein Import, wenn ein Jahr fehlt."""
    rows = (
        db.table("personal_regeln").select("land").not_.is_("bestaetigt_am", "null").execute()
    ).data or []
    laender = sorted({str(r["land"]).upper() for r in rows if r.get("land")})
    stand: dict[str, int] = {"laender": len(laender), "fehler": 0}
    for land in laender:
        try:
            feiertage_mod.sicherstellen(db, land, heute=heute)
        except Exception as exc:  # noqa: BLE001 — ein Land kippt die anderen nicht
            stand["fehler"] += 1
            log.warning("personal_feiertage_tick_fehler", land=land, error=str(exc)[:200])
    return stand


def offene_stempelungen_melden(db: Client, *, jetzt: datetime) -> int:
    grenze = jetzt - timedelta(hours=OFFEN_WARNUNG_STUNDEN)
    rows = (
        db.table("personal_zeiterfassung")
        .select("id, tenant_id, user_id, start_at")
        .is_("end_at", "null")
        .lt("start_at", grenze.isoformat())
        .execute()
    ).data or []
    n = 0
    for r in rows:
        start = als_dt(r.get("start_at"))
        if start is None:
            continue
        stunden = int((jetzt - start).total_seconds() // 3600)
        melde_zeit_hinweis(
            db,
            tenant_id=str(r["tenant_id"]),
            leitung_ids=_leitung(db, str(r["tenant_id"])),
            betroffen_id=str(r["user_id"]),
            art="offen",
            werte={"stunden": stunden, "start": start.astimezone(UTC).strftime("%Y-%m-%d %H:%M")},
            dedup=f"{r['id']}:{jetzt.date().isoformat()}",
        )
        n += 1
    return n


# Alles mit Ablaufdatum in der Akte: Dokumente (0541), Nachweise und
# Schulungen (0543) — dieselbe Meldung, derselbe dedup_key-Zuschnitt.
_ABLAUF_QUELLEN: tuple[tuple[str, str], ...] = (
    ("personal_dokumente", "ablauf_am"),
    ("personal_nachweise", "ablauf_am"),
    ("personal_schulungen", "gueltig_bis"),
)


def dokumente_ablauf_melden(db: Client, *, heute: date) -> int:
    grenze = heute + timedelta(days=_ABLAUF_VORLAUF_TAGE)
    n = 0
    for table, spalte in _ABLAUF_QUELLEN:
        rows = (
            db.table(table)
            .select(f"id, tenant_id, user_id, titel, {spalte}")
            .not_.is_(spalte, "null")
            .lte(spalte, grenze.isoformat())
            .gte(spalte, heute.isoformat())
            .execute()
        ).data or []
        for r in rows:
            melde_zeit_hinweis(
                db,
                tenant_id=str(r["tenant_id"]),
                leitung_ids=_leitung(db, str(r["tenant_id"])),
                betroffen_id=str(r["user_id"]),
                art="dokument_ablauf",
                werte={"titel": str(r.get("titel") or ""), "ablauf": str(r.get(spalte) or "")},
                dedup=f"{r['id']}:{r.get(spalte)}",
            )
            n += 1
    return n


def stuendlich(db: Client) -> dict[str, object]:
    """Der eine Einstieg für den Worker."""
    jetzt = datetime.now(UTC)
    heute = jetzt.date()
    stand: dict[str, object] = {}
    stand["feiertage"] = feiertage_sicherstellen(db, heute=heute)
    stand["offene_stempelungen"] = offene_stempelungen_melden(db, jetzt=jetzt)
    stand["dokumente_ablauf"] = dokumente_ablauf_melden(db, heute=heute)
    return stand
