"""Service-Schicht für dashboard (inkl. Onboarding-Fortschritt).

Tenant-scoped über die Service-Role mit EXPLIZITEM tenant-Scope (tenant_id aus
dem JWT, nie aus User-Input) — gleiches Muster wie die anderen Slices.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .schemas import OnboardingStatus, OnboardingUpdate, SliceHealth


class DashboardError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class DashboardService:
    slice_name = "dashboard"

    def __init__(self, service_client: Client | None = None) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_db(self) -> Client:
        if self._db is None:
            raise DashboardError("Datenbank nicht verfügbar.", status_code=500)
        return self._db

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise DashboardError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    # -- Onboarding ------------------------------------------------------------
    def get_onboarding(self, ctx: AuthContext) -> OnboardingStatus:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        res = (
            db.table("tenant_onboarding")
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            # Noch kein Eintrag → frischer Tenant, Onboarding offen.
            return OnboardingStatus()
        return self._to_status(res.data[0])

    def update_onboarding(
        self, ctx: AuthContext, req: OnboardingUpdate
    ) -> OnboardingStatus:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        row: dict[str, Any] = {"tenant_id": tenant_id}
        data = req.model_dump(exclude_none=True)
        row.update(data)
        if data.get("completed") is True:
            row["completed_at"] = datetime.now(UTC).isoformat()

        saved = (
            db.table("tenant_onboarding")
            .upsert(row, on_conflict="tenant_id")
            .execute()
        )
        if not saved.data:
            raise DashboardError("Onboarding konnte nicht gespeichert werden.", status_code=500)
        return self._to_status(saved.data[0])

    @staticmethod
    def _to_status(row: dict[str, Any]) -> OnboardingStatus:
        return OnboardingStatus(
            has_ota=row.get("has_ota"),
            selected_portals=row.get("selected_portals") or [],
            company_data_set=row.get("company_data_set", False),
            object_created=row.get("object_created", False),
            price_set=row.get("price_set", False),
            channels_done=row.get("channels_done", False),
            completed=row.get("completed", False),
        )
