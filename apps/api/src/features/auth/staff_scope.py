"""Staff-Scope-Helfer (Lastenheft §4.3) — eine Wahrheit für alle Slices.

Die Rollen staff/cleaner arbeiten operativ (Tasks, Verfügbarkeiten, Inventar) —
aber NUR an den ihnen über `staff_property_assignments` freigegebenen Objekten,
nie an denen anderer Mitarbeiter desselben Tenants. Die APIs laufen mit dem
Service-Role-Key und umgehen RLS; der Staff-Scope MUSS deshalb serverseitig
explizit erzwungen werden.

Bewusst als frei stehende Funktionen (kein Mixin), analog zu owner_scope. Alle
Funktionen sind fail-closed — ein Mitarbeiter ohne Freigabe sieht nichts.
"""
from __future__ import annotations

from supabase import Client

from src.core.security import AuthContext

# Operative Rollen, deren Objektsicht über staff_property_assignments läuft.
_STAFF_ROLES = frozenset({"staff", "cleaner"})


def is_staff(ctx: AuthContext) -> bool:
    """Eingeloggter Mitarbeiter/Dienstleister (nur freigegebene Objekte)."""
    return ctx.role in _STAFF_ROLES


def staff_property_ids(db: Client, ctx: AuthContext) -> set[str]:
    """Objekt-IDs, die diesem Mitarbeiter freigegeben sind
    (`staff_property_assignments`, auf Tenant + user_id gebunden).

    Leere Menge = sieht nichts (fail-closed). Nur für staff/cleaner sinnvoll;
    Aufrufer prüfen `is_staff(ctx)` zuvor.
    """
    if not ctx.tenant_id:
        return set()
    rows = (
        db.table("staff_property_assignments")
        .select("property_id")
        .eq("tenant_id", ctx.tenant_id)
        .eq("user_id", ctx.user_id)
        .execute()
    ).data or []
    return {r["property_id"] for r in rows}


def filter_to_assigned(
    db: Client, ctx: AuthContext, property_ids: list[str]
) -> list[str]:
    """`property_ids` für Mitarbeiter auf die freigegebenen Objekte einschränken
    (Reihenfolge bleibt erhalten). Nicht-Staff erhalten die Liste unverändert."""
    if not is_staff(ctx):
        return property_ids
    allowed = staff_property_ids(db, ctx)
    return [p for p in property_ids if p in allowed]
