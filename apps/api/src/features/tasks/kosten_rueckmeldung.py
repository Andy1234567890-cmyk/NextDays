"""Auslagen und Abschluss-Rückmeldung einer Aufgabe (0360, Hostaway-Gleichzug).

Bewusst ein eigenes Modul und keine weiteren 200 Zeilen in `service.py`: das
ist ein abgeschlossenes Thema mit eigenen Tabellen (`task_costs`,
`task_resolutions`), eigenen Sichtbarkeitsregeln und ohne Berührung mit dem
Aufgaben-Lebenszyklus. Der Dienst delegiert und bleibt lesbar.

Freistehende Funktionen wie in `auth/staff_scope.py` — der Aufrufer bringt den
DB-Client mit, damit hier nichts über den Zustand des Dienstes weiß.

SICHTBARKEIT (§4.3): Eine Reinigungskraft darf ihre EIGENE Auslage eintragen
und sehen — das ist ihr Geld. Sie darf NICHT die Auslagen des Betriebs lesen.
Der Filter sitzt deshalb hier im Lesepfad und nicht in der Oberfläche; sonst
käme sie über den blanken API-Aufruf trotzdem an die fremden Zeilen.
Beide Tabellen sind für `authenticated` ohne Grant (Wurzel 6) — der einzige Weg
dorthin führt durch diesen Code.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime

from supabase import Client

from src.core.security import AuthContext
from src.features.auth.staff_scope import is_staff

from .schemas import TaskCost, TaskCostCreate, TaskResolution, TaskResolutionUpsert

# Namen zu user_ids auflösen — der Dienst bringt seine eigene Auflösung mit,
# damit es nur EINE gibt.
NamenLoeser = Callable[[str, set[str]], dict[str, str]]


def waehrung_fuer_aufgabe(
    db: Client, tenant_id: str, property_id: str | None
) -> str | None:
    """Währung, in der eine Auslage zu dieser Aufgabe gebucht wird.

    Objektwährung schlägt Betriebswährung — dieselbe Reihenfolge wie überall
    sonst bei Beträgen. Fehlt beides, gibt es KEINEN Ersatzwert: die Oberfläche
    blendet das Kostenfeld aus, ein Schreibversuch endet in 422. Ein stilles
    „EUR" wäre in 27 Ländern eine falsche Zahl in einer Abrechnung (Wurzel 4).
    """
    if property_id:
        rows = (
            db.table("properties")
            .select("currency")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        waehrung = (rows[0].get("currency") if rows else None) or ""
        if waehrung.strip():
            return waehrung.strip().upper()
    rows = (
        db.table("tenants")
        .select("currency")
        .eq("id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    waehrung = (rows[0].get("currency") if rows else None) or ""
    return waehrung.strip().upper() or None


def kosten_laden(
    db: Client,
    tenant_id: str,
    task_id: str,
    ctx: AuthContext | None,
    namen_loeser: NamenLoeser,
) -> list[TaskCost]:
    """Auslagen der Aufgabe — für staff/cleaner nur die selbst erfassten."""
    rows = (
        db.table("task_costs")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("task_id", task_id)
        .order("created_at")
        .execute()
    ).data or []
    if ctx is not None and is_staff(ctx):
        rows = [r for r in rows if r.get("created_by") == ctx.user_id]
    namen = namen_loeser(
        tenant_id, {r.get("created_by") for r in rows if r.get("created_by")}
    )
    return [
        TaskCost(
            id=r["id"],
            task_id=r["task_id"],
            amount=r["amount"],
            currency=r["currency"],
            note=r.get("note"),
            created_by=r.get("created_by"),
            created_by_name=namen.get(r.get("created_by") or ""),
            created_at=r.get("created_at"),
        )
        for r in rows
    ]


def kosten_einfuegen(
    db: Client,
    tenant_id: str,
    task_id: str,
    req: TaskCostCreate,
    ctx: AuthContext,
    waehrung: str,
) -> None:
    """Eine Auslage schreiben. Die Währung bringt der Aufrufer mit (geprüft)."""
    db.table("task_costs").insert(
        {
            "tenant_id": tenant_id,
            "task_id": task_id,
            "amount": str(req.amount),
            "currency": waehrung,
            "note": (req.note or "").strip() or None,
            "created_by": ctx.user_id,
        }
    ).execute()


def kosten_zeile(db: Client, tenant_id: str, cost_id: str) -> dict | None:
    rows = (
        db.table("task_costs")
        .select("*")
        .eq("id", cost_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def kosten_entfernen(db: Client, tenant_id: str, cost_id: str) -> None:
    db.table("task_costs").delete().eq("id", cost_id).eq(
        "tenant_id", tenant_id
    ).execute()


def rueckmeldung_laden(
    db: Client, tenant_id: str, task_id: str, namen_loeser: NamenLoeser
) -> TaskResolution | None:
    rows = (
        db.table("task_resolutions")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("task_id", task_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return None
    r = rows[0]
    namen = namen_loeser(
        tenant_id, {r["created_by"]} if r.get("created_by") else set()
    )
    return TaskResolution(
        task_id=r["task_id"],
        note=r.get("note"),
        score=r.get("score"),
        created_by=r.get("created_by"),
        created_by_name=namen.get(r.get("created_by") or ""),
        updated_at=r.get("updated_at"),
    )


def rueckmeldung_schreiben(
    db: Client,
    tenant_id: str,
    task_id: str,
    req: TaskResolutionUpsert,
    ctx: AuthContext,
    notiz: str | None,
) -> None:
    """Genau EINE Rückmeldung je Aufgabe (upsert auf task_id).

    Wer sie ändert, ändert sie — deshalb `updated_at` und kein zweiter Eintrag.
    „Wie ist es gelaufen" ist eine Aussage über den Vorgang, keine Sammlung.
    """
    db.table("task_resolutions").upsert(
        {
            "task_id": task_id,
            "tenant_id": tenant_id,
            "note": notiz,
            "score": req.score,
            "created_by": ctx.user_id,
            "updated_at": datetime.now(UTC).isoformat(),
        },
        on_conflict="task_id",
    ).execute()
