"""Service-Schicht für owners (verwaltete Eigentümer).

CRUD über die Service-Role mit EXPLIZITEM tenant-Scope: tenant_id stammt immer
aus dem verifizierten JWT (AuthContext), nie aus User-Input (gleiches Muster wie
properties.service). Objekt-Zuordnung mit Anteil + Provisions-Override. Optionale
Verknüpfung zu einem Owner-Login-User spiegelt sich ins Portal-Scoping
(owner_property_assignments via auth.OwnerAssignmentService).
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import (
    OwnerCreate,
    OwnerListItem,
    OwnerListResponse,
    OwnerPropertyAssign,
    OwnerPropertyLink,
    OwnerResponse,
    OwnerUpdate,
    SliceHealth,
)

log = get_logger("nextdays.owners")

_OWNER_COLUMNS = (
    "id, tenant_id, name, company, email, phone, street, house_number, "
    "postal_code, city, country, tax_id, vat_id, iban, bic, bank_name, "
    "account_holder, default_commission_pct, default_payout_method, "
    "statement_frequency, notes, user_id, created_at, updated_at"
)


class OwnerError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class OwnersService:
    slice_name = "owners"

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise OwnerError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _tenant_property_ids(self, tenant_id: str) -> set[str]:
        rows = (
            self._db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["id"]) for r in rows}

    def _links(self, owner_id: str) -> list[OwnerPropertyLink]:
        rows = (
            self._db.table("owner_properties")
            .select("property_id, ownership_share, commission_override_pct")
            .eq("owner_id", owner_id)
            .execute()
        ).data or []
        return [
            OwnerPropertyLink(
                property_id=str(r["property_id"]),
                ownership_share=float(r.get("ownership_share") or 0),
                commission_override_pct=(
                    float(r["commission_override_pct"])
                    if r.get("commission_override_pct") is not None
                    else None
                ),
            )
            for r in rows
        ]

    def _get_row(self, tenant_id: str, owner_id: str) -> dict:
        res = (
            self._db.table("owners")
            .select(_OWNER_COLUMNS)
            .eq("tenant_id", tenant_id)
            .eq("id", owner_id)
            .execute()
        )
        if not res.data:
            raise OwnerError("Eigentümer nicht gefunden.", status_code=404)
        return res.data[0]

    def list(self, ctx: AuthContext) -> OwnerListResponse:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("owners")
            .select(_OWNER_COLUMNS)
            .eq("tenant_id", tenant_id)
            .order("name")
            .execute()
        ).data or []
        # Objekt-Anzahl je Eigentümer in einem Rutsch (kein N+1).
        owner_ids = [str(r["id"]) for r in rows]
        counts: dict[str, int] = {oid: 0 for oid in owner_ids}
        if owner_ids:
            links = (
                self._db.table("owner_properties")
                .select("owner_id")
                .in_("owner_id", owner_ids)
                .execute()
            ).data or []
            for link in links:
                oid = str(link["owner_id"])
                counts[oid] = counts.get(oid, 0) + 1
        items = [
            OwnerListItem(**_owner_row(r), property_count=counts.get(str(r["id"]), 0))
            for r in rows
        ]
        return OwnerListResponse(items=items, total=len(items))

    def get(self, ctx: AuthContext, owner_id: str) -> OwnerResponse:
        tenant_id = self._require_tenant(ctx)
        row = self._get_row(tenant_id, owner_id)
        return OwnerResponse(**_owner_row(row), properties=self._links(owner_id))

    def create(self, ctx: AuthContext, req: OwnerCreate) -> OwnerResponse:
        tenant_id = self._require_tenant(ctx)
        payload = req.model_dump(mode="json")
        payload["tenant_id"] = tenant_id
        self._validate_user_link(tenant_id, payload.get("user_id"))
        res = self._db.table("owners").insert(payload).execute()
        if not res.data:
            raise OwnerError("Eigentümer konnte nicht angelegt werden.", status_code=500)
        row = res.data[0]
        log.info("owner_created", tenant_id=tenant_id, owner_id=row["id"])
        return OwnerResponse(**_owner_row(row), properties=[])

    def update(
        self, ctx: AuthContext, owner_id: str, req: OwnerUpdate
    ) -> OwnerResponse:
        tenant_id = self._require_tenant(ctx)
        self._get_row(tenant_id, owner_id)  # 404, wenn fremd
        changes = req.model_dump(mode="json", exclude_unset=True)
        if "user_id" in changes:
            self._validate_user_link(tenant_id, changes["user_id"])
        if changes:
            res = (
                self._db.table("owners")
                .update(changes)
                .eq("tenant_id", tenant_id)
                .eq("id", owner_id)
                .execute()
            )
            if not res.data:
                raise OwnerError("Eigentümer nicht gefunden.", status_code=404)
        log.info("owner_updated", tenant_id=tenant_id, owner_id=owner_id)
        return self.get(ctx, owner_id)

    def delete(self, ctx: AuthContext, owner_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("owners")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("id", owner_id)
            .execute()
        )
        if not res.data:
            raise OwnerError("Eigentümer nicht gefunden.", status_code=404)
        log.info("owner_deleted", tenant_id=tenant_id, owner_id=owner_id)

    def assign_property(
        self, ctx: AuthContext, owner_id: str, req: OwnerPropertyAssign
    ) -> OwnerResponse:
        """Objekt zuordnen (oder Anteil/Provision aktualisieren). Nur eigene
        Tenant-Objekte erlaubt."""
        tenant_id = self._require_tenant(ctx)
        self._get_row(tenant_id, owner_id)
        if req.property_id not in self._tenant_property_ids(tenant_id):
            raise OwnerError(
                "Objekt gehört nicht zu diesem Konto.", status_code=400
            )
        self._db.table("owner_properties").upsert(
            {
                "owner_id": owner_id,
                "property_id": req.property_id,
                "ownership_share": req.ownership_share,
                "commission_override_pct": req.commission_override_pct,
            },
            on_conflict="owner_id,property_id",
        ).execute()
        log.info(
            "owner_property_assigned",
            tenant_id=tenant_id,
            owner_id=owner_id,
            property_id=req.property_id,
        )
        return self.get(ctx, owner_id)

    def unassign_property(
        self, ctx: AuthContext, owner_id: str, property_id: str
    ) -> OwnerResponse:
        tenant_id = self._require_tenant(ctx)
        self._get_row(tenant_id, owner_id)
        self._db.table("owner_properties").delete().eq("owner_id", owner_id).eq(
            "property_id", property_id
        ).execute()
        log.info(
            "owner_property_unassigned",
            tenant_id=tenant_id,
            owner_id=owner_id,
            property_id=property_id,
        )
        return self.get(ctx, owner_id)

    def _validate_user_link(self, tenant_id: str, user_id: str | None) -> None:
        """Wenn ein Owner-Login-User verknüpft wird, muss er Rolle 'owner' im
        selben Tenant haben (Portal-Scoping setzt darauf auf)."""
        if not user_id:
            return
        rows = (
            self._db.table("users")
            .select("id, role")
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise OwnerError("Verknüpfter Nutzer nicht gefunden.", status_code=404)
        if rows[0].get("role") != "owner":
            raise OwnerError(
                "Nur ein Nutzer mit der Rolle 'owner' kann verknüpft werden.",
                status_code=400,
            )


def _owner_row(r: dict) -> dict:
    """DB-Zeile in das Response-Schema überführen (None-/Typ-Glättung)."""
    return {
        "id": str(r["id"]),
        "tenant_id": str(r["tenant_id"]),
        "name": r["name"],
        "company": r.get("company"),
        "email": r.get("email"),
        "phone": r.get("phone"),
        "street": r.get("street"),
        "house_number": r.get("house_number"),
        "postal_code": r.get("postal_code"),
        "city": r.get("city"),
        "country": r.get("country"),
        "tax_id": r.get("tax_id"),
        "vat_id": r.get("vat_id"),
        "iban": r.get("iban"),
        "bic": r.get("bic"),
        "bank_name": r.get("bank_name"),
        "account_holder": r.get("account_holder"),
        "default_commission_pct": float(r.get("default_commission_pct") or 0),
        "default_payout_method": r.get("default_payout_method"),
        "statement_frequency": r.get("statement_frequency") or "none",
        "notes": r.get("notes"),
        "user_id": str(r["user_id"]) if r.get("user_id") else None,
        "created_at": str(r["created_at"]) if r.get("created_at") else None,
        "updated_at": str(r["updated_at"]) if r.get("updated_at") else None,
    }
