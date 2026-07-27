"""Owner-Scope-Helfer (Lastenheft §4.2) — eine Wahrheit für alle Slices.

Die owner-Rolle besitzt VIEW_CALENDAR/VIEW_OWNER_REPORTS und sieht damit
grundsätzlich Kalender/Reservierungen — aber NUR die ihr über
`owner_property_assignments` zugeordneten Objekte, nie die anderer Eigentümer
desselben Tenants. Die APIs laufen mit dem Service-Role-Key und umgehen RLS
(0059 schützt nur den direkten Frontend→Supabase-Pfad); der Owner-Scope MUSS
deshalb serverseitig explizit erzwungen werden.

Bewusst als frei stehende Funktionen (kein Mixin): calendar/reservations/pricing
scopen identisch, ohne dass ein Service vom anderen erben muss. Alle Funktionen
sind fail-closed — ein Owner ohne Zuordnung sieht nichts.
"""
from __future__ import annotations

from supabase import Client

from src.core.security import AuthContext


def is_owner(ctx: AuthContext) -> bool:
    """Eingeloggter Immobilien-Eigentümer (read-only, nur zugeordnete Objekte)."""
    return ctx.role == "owner"


def owner_property_ids(db: Client, ctx: AuthContext) -> set[str]:
    """Objekt-IDs, die diesem Eigentümer zugeordnet sind
    (`owner_property_assignments`, auf Tenant + user_id gebunden).

    Leere Menge = sieht nichts (fail-closed). Nur für die owner-Rolle sinnvoll;
    Aufrufer prüfen `is_owner(ctx)` zuvor.
    """
    if not ctx.tenant_id:
        return set()
    rows = (
        db.table("owner_property_assignments")
        .select("property_id")
        .eq("tenant_id", ctx.tenant_id)
        .eq("user_id", ctx.user_id)
        .execute()
    ).data or []
    return {r["property_id"] for r in rows}
