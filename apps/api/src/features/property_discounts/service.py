"""Service für die Rabatt-/Deal-Engine (property_discounts, 0185).

CRUD über die Service-Role mit explizitem Tenant-Scope (Wurzel 3: Service-Role
umgeht RLS). Owner ist read-only (§4.2), staff/cleaner sehen Vertriebsdaten gar
nicht — das Gating passiert im Router über die Permissions.
"""
from __future__ import annotations

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .schemas import DiscountCreate, DiscountResponse, DiscountUpdate

_COLUMNS = (
    "id, property_id, discount_type, discount_bps, active, min_nights, "
    "days_before, starts_on, ends_on, name, created_at, updated_at"
)


class DiscountError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class PropertyDiscountsService:
    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            raise DiscountError("Kein DB-Client verfügbar.", status_code=500)
        return self._client

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise DiscountError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _assert_own_property(self, tenant_id: str, property_id: str) -> None:
        rows = (
            self._db()
            .table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise DiscountError(
                "Objekt gehört nicht zu diesem Konto.", status_code=404
            )

    @staticmethod
    def _row(r: dict) -> DiscountResponse:
        return DiscountResponse(
            id=r["id"],
            property_id=r["property_id"],
            discount_type=r["discount_type"],
            discount_bps=int(r["discount_bps"]),
            active=bool(r["active"]),
            min_nights=r.get("min_nights"),
            days_before=r.get("days_before"),
            starts_on=r.get("starts_on"),
            ends_on=r.get("ends_on"),
            name=r.get("name") or {},
            created_at=str(r["created_at"]) if r.get("created_at") else None,
            updated_at=str(r["updated_at"]) if r.get("updated_at") else None,
        )

    def health(self) -> dict[str, str]:
        return {"slice": "property_discounts", "status": "ok"}

    def list_for_property(
        self, ctx: AuthContext, property_id: str
    ) -> list[DiscountResponse]:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        rows = (
            self._db()
            .table("property_discounts")
            .select(_COLUMNS)
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        ).data or []
        return [self._row(r) for r in rows]

    def create(
        self, ctx: AuthContext, property_id: str, req: DiscountCreate
    ) -> DiscountResponse:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        try:
            ins = (
                self._db()
                .table("property_discounts")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "discount_type": req.discount_type,
                        "discount_bps": req.discount_bps,
                        "active": req.active,
                        "min_nights": req.min_nights,
                        "days_before": req.days_before,
                        "starts_on": (
                            req.starts_on.isoformat() if req.starts_on else None
                        ),
                        "ends_on": req.ends_on.isoformat() if req.ends_on else None,
                        "name": req.name,
                    }
                )
                .execute()
            ).data
        except Exception as exc:  # noqa: BLE001 — Singleton-UNIQUE fängt Duplikat
            # 23505 = der partielle UNIQUE-Index (eine aktive Regel je Nicht-custom-
            # Typ). Doppelklick/Retry landet hier → 409 statt 500 (Wurzel 2).
            if "23505" in str(exc) or "duplicate" in str(exc).lower():
                raise DiscountError(
                    "Für diesen Rabatt-Typ existiert bereits eine aktive Regel.",
                    status_code=409,
                ) from exc
            raise
        if not ins:
            raise DiscountError("Rabatt konnte nicht angelegt werden.", status_code=500)
        return self._row(ins[0])

    def update(
        self,
        ctx: AuthContext,
        property_id: str,
        discount_id: str,
        req: DiscountUpdate,
    ) -> DiscountResponse:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        # tenant-scoped laden (Wurzel 3/9: gleicher Scope wie die Liste) + prüfen,
        # dass die Regel zu genau diesem Objekt gehört.
        current = load_scoped(
            self._db(),
            "property_discounts",
            discount_id,
            tenant_id,
            columns=_COLUMNS,
            not_found=DiscountError("Rabatt nicht gefunden.", status_code=404),
        )
        if current["property_id"] != property_id:
            raise DiscountError("Rabatt nicht gefunden.", status_code=404)
        patch: dict[str, object] = {}
        if req.discount_bps is not None:
            patch["discount_bps"] = req.discount_bps
        if req.active is not None:
            patch["active"] = req.active
        if req.min_nights is not None:
            patch["min_nights"] = req.min_nights
        if req.days_before is not None:
            patch["days_before"] = req.days_before
        if req.starts_on is not None:
            patch["starts_on"] = req.starts_on.isoformat()
        if req.ends_on is not None:
            patch["ends_on"] = req.ends_on.isoformat()
        if req.name is not None:
            patch["name"] = req.name
        if not patch:
            return self._row(current)
        try:
            upd = (
                self._db()
                .table("property_discounts")
                .update(patch)
                .eq("id", discount_id)
                .eq("tenant_id", tenant_id)
                .execute()
            ).data
        except Exception as exc:  # noqa: BLE001 — Aktivierung kann Singleton verletzen
            if "23505" in str(exc) or "duplicate" in str(exc).lower():
                raise DiscountError(
                    "Für diesen Rabatt-Typ existiert bereits eine aktive Regel.",
                    status_code=409,
                ) from exc
            raise
        if not upd:
            raise DiscountError("Rabatt konnte nicht geändert werden.", status_code=500)
        return self._row(upd[0])

    def delete(
        self, ctx: AuthContext, property_id: str, discount_id: str
    ) -> None:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        current = load_scoped(
            self._db(),
            "property_discounts",
            discount_id,
            tenant_id,
            columns="id, property_id",
            not_found=DiscountError("Rabatt nicht gefunden.", status_code=404),
        )
        if current["property_id"] != property_id:
            raise DiscountError("Rabatt nicht gefunden.", status_code=404)
        self._db().table("property_discounts").delete().eq(
            "id", discount_id
        ).eq("tenant_id", tenant_id).execute()
