"""Eigentümer-Objekt-Zuordnung (Lastenheft §4.2).

Die Agentur (admin/co_admin) ordnet einem Eigentümer-Login (Rolle 'owner') seine
Objekte zu. Diese Zuordnung steuert, welche Objekte der Eigentümer im read-only-
Portal sieht (durchgesetzt per RLS 0059 + Pricing-API). Replace-Semantik: die
übergebene Liste IST die neue Zuordnung.

Alle Schreibvorgänge laufen mit dem Service-Role-Key (umgeht RLS); die Tenant-
und Eigentums-Prüfung passiert hier explizit, damit keine fremden Nutzer/Objekte
zugeordnet werden können.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import OwnerAssignmentResponse, OwnerAssignmentUpdate
from .service import AuthError

log = get_logger("nextdays.auth.owner_assignment")


class OwnerAssignmentService:
    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise AuthError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _require_owner_user(self, tenant_id: str, user_id: str) -> None:
        """Ziel muss ein Eigentümer (Rolle 'owner') im selben Tenant sein."""
        rows = (
            self._db.table("users")
            .select("id, role")
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise AuthError("Nutzer nicht gefunden.", status_code=404)
        if rows[0].get("role") != "owner":
            raise AuthError(
                "Objekt-Zuordnung ist nur für Eigentümer möglich.", status_code=400
            )

    def _tenant_property_ids(self, tenant_id: str) -> set[str]:
        rows = (
            self._db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {r["id"] for r in rows}

    def get(self, ctx: AuthContext, user_id: str) -> OwnerAssignmentResponse:
        """Aktuelle Objekt-Zuordnung eines Eigentümers (Agentur-Sicht)."""
        tenant_id = self._require_tenant(ctx)
        self._require_owner_user(tenant_id, user_id)
        rows = (
            self._db.table("owner_property_assignments")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .execute()
        ).data or []
        return OwnerAssignmentResponse(
            user_id=user_id, property_ids=[r["property_id"] for r in rows]
        )

    def set(
        self, ctx: AuthContext, user_id: str, req: OwnerAssignmentUpdate
    ) -> OwnerAssignmentResponse:
        """Objekt-Zuordnung setzen (Replace). Nur eigene Tenant-Objekte erlaubt."""
        tenant_id = self._require_tenant(ctx)
        self._require_owner_user(tenant_id, user_id)

        wanted = list(dict.fromkeys(req.property_ids))  # dedupe, Reihenfolge egal
        if wanted:
            owned = self._tenant_property_ids(tenant_id)
            fremd = [pid for pid in wanted if pid not in owned]
            if fremd:
                raise AuthError(
                    "Mindestens ein Objekt gehört nicht zu diesem Konto.",
                    status_code=400,
                )

        # Replace: bestehende Zuordnungen dieses Nutzers entfernen, neue setzen.
        self._db.table("owner_property_assignments").delete().eq(
            "tenant_id", tenant_id
        ).eq("user_id", user_id).execute()
        if wanted:
            self._db.table("owner_property_assignments").insert(
                [
                    {
                        "tenant_id": tenant_id,
                        "user_id": user_id,
                        "property_id": pid,
                    }
                    for pid in wanted
                ]
            ).execute()
        log.info(
            "owner_assignment_set",
            tenant_id=tenant_id,
            user_id=user_id,
            count=len(wanted),
        )
        return OwnerAssignmentResponse(user_id=user_id, property_ids=wanted)
