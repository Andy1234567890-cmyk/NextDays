"""Dynamic-Pricing-Einstellungen je Objekt (dp_settings) — tenant-scoped CRUD.

Liest/schreibt die dp_settings-Zeile eines Objekts. Property-Eigentum wird gegen
den Tenant geprüft (kein Fremd-Zugriff). Beim Aktivieren/Ändern wird KEIN
Recompute erzwungen — das macht der tägliche Cron bzw. der Reservierungs-Hook;
der Aufrufer kann nach dem Speichern gezielt recompute_property() auslösen.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .resolver import PricingError
from .schemas import DpSettingsResponse, DpSettingsUpdate

log = get_logger("nextdays.pricing.settings")

# Spalten-Defaults spiegeln Migration 0055 (ein Ort der Wahrheit für die API).
_DEFAULTS = {
    "enabled": False,
    "min_price": None,
    "max_price": None,
    "weekend_uplift_pct": 15.0,
    "last_minute": [
        {"days_before": 7, "discount_pct": 10},
        {"days_before": 3, "discount_pct": 20},
    ],
    "orphan_gap_discount_pct": 15.0,
    "occupancy_sensitivity": 30.0,
    "min_stay_min": 1,
    "min_stay_max": 7,
}


class DpSettingsService:
    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            raise PricingError("Preis-DB nicht verfügbar.", status_code=500)
        return self._client

    def _require_own_property(self, ctx: AuthContext, property_id: str) -> None:
        if not ctx.tenant_id:
            raise PricingError("Kein Tenant im Konto.", status_code=400)
        res = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", ctx.tenant_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise PricingError("Objekt nicht gefunden.", status_code=404)

    def get(self, ctx: AuthContext, property_id: str) -> DpSettingsResponse:
        """dp_settings eines Objekts (oder Defaults, falls noch keine Zeile)."""
        self._require_own_property(ctx, property_id)
        res = (
            self._db()
            .table("dp_settings")
            .select("*")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        row = {**_DEFAULTS, **(res[0] if res else {})}
        return self._to_response(property_id, row)

    def update(
        self, ctx: AuthContext, property_id: str, req: DpSettingsUpdate
    ) -> DpSettingsResponse:
        """dp_settings setzen (Upsert). Nur gesetzte Felder werden übernommen."""
        self._require_own_property(ctx, property_id)
        patch = req.model_dump(mode="json", exclude_none=True)
        row = {"property_id": property_id, **patch}
        self._db().table("dp_settings").upsert(
            row, on_conflict="property_id"
        ).execute()
        log.info(
            "dp_settings_updated",
            property_id=property_id,
            fields=sorted(patch.keys()),
        )
        return self.get(ctx, property_id)

    @staticmethod
    def _to_response(property_id: str, row: dict) -> DpSettingsResponse:
        return DpSettingsResponse(
            property_id=property_id,
            enabled=bool(row.get("enabled")),
            min_price=_opt_float(row.get("min_price")),
            max_price=_opt_float(row.get("max_price")),
            weekend_uplift_pct=float(row.get("weekend_uplift_pct") or 0),
            last_minute=[
                r for r in (row.get("last_minute") or []) if isinstance(r, dict)
            ],
            orphan_gap_discount_pct=float(row.get("orphan_gap_discount_pct") or 0),
            occupancy_sensitivity=float(row.get("occupancy_sensitivity") or 0),
            min_stay_min=int(row.get("min_stay_min") or 1),
            min_stay_max=int(row.get("min_stay_max") or 7),
        )


def _opt_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
