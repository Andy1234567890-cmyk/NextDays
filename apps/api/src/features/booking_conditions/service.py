"""Service-Schicht für booking_conditions (Buchungsbedingungen).

Tenant-scoped über die Service-Role mit EXPLIZITEM tenant-Scope (tenant_id aus dem
JWT, nie aus User-Input; Wurzel 3). Eine Kondition + ihre gestaffelten
Storno-Regeln (Kind-Tabelle) werden zusammen gelesen/geschrieben.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .schemas import (
    BookingConditionCreate,
    BookingConditionResponse,
    BookingConditionUpdate,
    RefundRule,
    SliceHealth,
)

# Spalten der booking_conditions-Tabelle (ohne refund_rules — die liegen in der
# Kind-Tabelle und werden separat gepflegt).
_CONDITION_COLUMNS = (
    "id",
    "tenant_id",
    "internal_name",
    "is_default",
    "installments",
    "first_payment_amount_type",
    "first_payment_percent",
    "first_payment_timing",
    "first_payment_days",
    "balance_timing",
    "balance_days_before_arrival",
    "third_payment_percent",
    "third_payment_days_before",
    "cancellation_mode",
    "deposit_required",
    "deposit_method",
    "deposit_amount_type",
    "deposit_amount",
    "deposit_currency",
    "preauth_days_before_arrival",
    "release_days_after_departure",
    "quote_validity_hours",
)


class BookingConditionError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class BookingConditionService:
    slice_name = "booking_conditions"

    def __init__(self, service_client: Client | None = None) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_db(self) -> Client:
        if self._db is None:
            raise BookingConditionError("Datenbank nicht verfügbar.", status_code=500)
        return self._db

    @staticmethod
    def _require_tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise BookingConditionError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    # -- Lesen -----------------------------------------------------------------
    def list(self, ctx: AuthContext) -> list[BookingConditionResponse]:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        rows = (
            db.table("booking_conditions")
            .select(",".join(_CONDITION_COLUMNS))
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        ).data or []
        rules_by_condition = self._load_refund_rules([r["id"] for r in rows])
        return [self._to_response(r, rules_by_condition.get(r["id"], [])) for r in rows]

    def get(self, ctx: AuthContext, condition_id: str) -> BookingConditionResponse:
        tenant_id = self._require_tenant(ctx)
        row = self._load_own(condition_id, tenant_id)
        rules = self._load_refund_rules([condition_id]).get(condition_id, [])
        return self._to_response(row, rules)

    def _load_own(self, condition_id: str, tenant_id: str) -> dict[str, Any]:
        """Eine Kondition per ID laden UND auf den Tenant scopen (Wurzel 3): Load
        und Scope gemeinsam, nie ein ungescopter Load mit späterem Vergleich."""
        db = self._require_db()
        rows = (
            db.table("booking_conditions")
            .select(",".join(_CONDITION_COLUMNS))
            .eq("id", condition_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise BookingConditionError("Kondition nicht gefunden.", status_code=404)
        return rows[0]

    def _load_refund_rules(
        self, condition_ids: list[str]
    ) -> dict[str, list[RefundRule]]:
        if not condition_ids:
            return {}
        db = self._require_db()
        rows = (
            db.table("booking_condition_refund_rules")
            .select("condition_id, refund_percent, days_before_arrival")
            .in_("condition_id", condition_ids)
            .order("days_before_arrival", desc=True)
            .execute()
        ).data or []
        out: dict[str, list[RefundRule]] = {}
        for r in rows:
            out.setdefault(r["condition_id"], []).append(
                RefundRule(
                    refund_percent=r["refund_percent"],
                    days_before_arrival=r["days_before_arrival"],
                )
            )
        return out

    # -- Schreiben -------------------------------------------------------------
    def create(
        self, ctx: AuthContext, req: BookingConditionCreate
    ) -> BookingConditionResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        payload = self._to_row(req)
        payload["tenant_id"] = tenant_id
        # Standard-Kondition ist tenant-weit eindeutig (partieller Unique-Index):
        # setzt der Nutzer diese als Standard, die bisherige zuerst entmarkieren.
        if req.is_default:
            self._clear_default(tenant_id)
        res = db.table("booking_conditions").insert(payload).execute().data
        if not res:
            raise BookingConditionError(
                "Kondition konnte nicht angelegt werden.", status_code=500
            )
        condition_id = res[0]["id"]
        self._replace_refund_rules(condition_id, req.refund_rules)
        return self.get(ctx, condition_id)

    def update(
        self, ctx: AuthContext, condition_id: str, req: BookingConditionUpdate
    ) -> BookingConditionResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        self._load_own(condition_id, tenant_id)  # Scope + Existenz erzwingen
        if req.is_default:
            self._clear_default(tenant_id, keep=condition_id)
        db.table("booking_conditions").update(self._to_row(req)).eq(
            "id", condition_id
        ).eq("tenant_id", tenant_id).execute()
        self._replace_refund_rules(condition_id, req.refund_rules)
        return self.get(ctx, condition_id)

    def delete(self, ctx: AuthContext, condition_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        self._load_own(condition_id, tenant_id)  # Scope + Existenz
        # refund_rules kaskadieren per FK (on delete cascade); rate_plans-Referenz
        # wird per FK auf null gesetzt (on delete set null) — kein manuelles Cleanup.
        db.table("booking_conditions").delete().eq("id", condition_id).eq(
            "tenant_id", tenant_id
        ).execute()

    def set_default(
        self, ctx: AuthContext, condition_id: str
    ) -> BookingConditionResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        self._load_own(condition_id, tenant_id)
        self._clear_default(tenant_id, keep=condition_id)
        db.table("booking_conditions").update({"is_default": True}).eq(
            "id", condition_id
        ).eq("tenant_id", tenant_id).execute()
        return self.get(ctx, condition_id)

    def _clear_default(self, tenant_id: str, *, keep: str | None = None) -> None:
        """Bisherige Standard-Kondition entmarkieren, bevor eine neue gesetzt wird
        (der partielle Unique-Index erlaubt genau eine je Tenant)."""
        db = self._require_db()
        q = (
            db.table("booking_conditions")
            .update({"is_default": False})
            .eq("tenant_id", tenant_id)
            .eq("is_default", True)
        )
        if keep is not None:
            q = q.neq("id", keep)
        q.execute()

    def _replace_refund_rules(
        self, condition_id: str, rules: list[RefundRule]
    ) -> None:
        """Storno-Regeln der Kondition komplett ersetzen (Gegenzustand pflegen,
        Wurzel 1): erst alte löschen, dann neue schreiben."""
        db = self._require_db()
        db.table("booking_condition_refund_rules").delete().eq(
            "condition_id", condition_id
        ).execute()
        if not rules:
            return
        db.table("booking_condition_refund_rules").insert(
            [
                {
                    "condition_id": condition_id,
                    "refund_percent": r.refund_percent,
                    "days_before_arrival": r.days_before_arrival,
                }
                for r in rules
            ]
        ).execute()

    # -- Mapping ---------------------------------------------------------------
    @staticmethod
    def _to_row(req: BookingConditionCreate | BookingConditionUpdate) -> dict[str, Any]:
        data = req.model_dump(mode="json")
        data.pop("refund_rules", None)  # eigene Tabelle
        return data

    @staticmethod
    def _to_response(
        row: dict[str, Any], rules: list[RefundRule]
    ) -> BookingConditionResponse:
        return BookingConditionResponse(**row, refund_rules=rules)
