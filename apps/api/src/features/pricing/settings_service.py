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

from .engine import DpSettings
from .resolver import PricingError
from .schemas import (
    DpOverviewItem,
    DpOverviewResponse,
    DpSettingsResponse,
    DpSettingsUpdate,
)

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
    "market_enabled": False,
    "market_sensitivity": 20.0,
    "market_max_adjust_pct": 25.0,
    "market_key": None,
    "comp_refs": [],
    "base_mode": "data_driven",
    "base_rate_mode": "recommended",
    "manual_base_price": None,
    "autopilot_enabled": False,
    "weather_enabled": False,
    "weather_max_adjust_pct": 10.0,
    "rate_rules": [],
}


class DpSettingsService:
    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            raise PricingError("Preis-DB nicht verfügbar.", status_code=500)
        return self._client

    def _is_owner(self, ctx: AuthContext) -> bool:
        """Eingeloggter Immobilien-Eigentümer (Lastenheft §4.2, read-only-Sicht)."""
        return ctx.role == "owner"

    def _owner_property_ids(self, ctx: AuthContext) -> set[str]:
        """Objekte, die diesem Eigentümer zugeordnet sind (owner_property_assignments).

        Die API nutzt den Service-Role-Key und umgeht RLS — der owner-Scope muss
        hier also explizit durchgesetzt werden (die RLS aus 0059 schützt nur den
        direkten Frontend→Supabase-Pfad). Leere Menge = sieht nichts (fail-closed)."""
        rows = (
            self._db()
            .table("owner_property_assignments")
            .select("property_id")
            .eq("tenant_id", ctx.tenant_id)
            .eq("user_id", ctx.user_id)
            .execute()
        ).data or []
        return {r["property_id"] for r in rows}

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
        # Eigentümer dürfen nur ihre zugeordneten Objekte sehen (§4.2).
        if self._is_owner(ctx) and property_id not in self._owner_property_ids(ctx):
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
        # Eigentümer-Sicht ist read-only (Lastenheft §4.2): kein Schreibzugriff.
        if self._is_owner(ctx):
            raise PricingError(
                "Eigentümer können Dynamic Pricing nicht ändern.", status_code=403
            )
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

    def overview(self, ctx: AuthContext) -> DpOverviewResponse:
        """Alle Objekte des Kontos + ihr Dynamic-Pricing-Status (Hostaway-Tabelle).

        Eine Zeile je Objekt: Aktiv-Status, Basispreis-Modus + effektiver Basispreis
        (manueller Wert oder Grundpreis aus dem Rate-Plan; None = kein Grundpreis,
        kein Fallback), Min/Max. dp_settings fehlt → Defaults (DP aus)."""
        if not ctx.tenant_id:
            raise PricingError("Kein Tenant im Konto.", status_code=400)
        query = (
            self._db()
            .table("properties")
            .select("id, title, photos, status")
            .eq("tenant_id", ctx.tenant_id)
        )
        # Eigentümer sehen nur ihre zugeordneten Objekte (Lastenheft §4.2).
        if self._is_owner(ctx):
            owned = self._owner_property_ids(ctx)
            if not owned:
                return DpOverviewResponse(items=[])
            query = query.in_("id", list(owned))
        props = query.order("title").execute().data or []
        if not props:
            return DpOverviewResponse(items=[])

        ids = [p["id"] for p in props]
        settings_by_prop = self._settings_by_property(ids)
        rate_by_prop = self._rate_plan_by_property(ids)
        channels_by_prop = self._active_channels_by_property(ids)

        items: list[DpOverviewItem] = []
        for p in props:
            pid = p["id"]
            s = DpSettings.from_row(settings_by_prop.get(pid))
            rate = rate_by_prop.get(pid, {})
            rate_base = _opt_float(rate.get("base_price"))
            # Effektiver Anker: manuell gesetzt oder Grundpreis (kein Erfinden).
            base_rate = (
                s.manual_base_price
                if s.base_mode == "manual" and s.manual_base_price is not None
                else rate_base
            )
            photos = p.get("photos") or []
            status = p.get("status") or "draft"
            # Eigene Plattform zählt als Kanal, sobald das Objekt aktiv ist
            # (booking_engine zeigt nur status=active). OTA-Kanäle aus Channex.
            channels = list(channels_by_prop.get(pid, []))
            if status == "active":
                channels = ["platform", *channels]
            items.append(
                DpOverviewItem(
                    property_id=pid,
                    title=p.get("title") or "Objekt",
                    photo=photos[0] if photos else None,
                    status=status,
                    currency=rate.get("currency"),
                    enabled=s.enabled,
                    base_mode=s.base_mode,
                    base_rate_mode=s.base_rate_mode,
                    base_rate=base_rate,
                    min_price=s.min_price,
                    max_price=s.max_price,
                    channels=channels,
                )
            )
        return DpOverviewResponse(items=items)

    def _settings_by_property(self, ids: list[str]) -> dict[str, dict]:
        rows = (
            self._db()
            .table("dp_settings")
            .select("*")
            .in_("property_id", ids)
            .execute()
        ).data or []
        return {r["property_id"]: r for r in rows}

    def _rate_plan_by_property(self, ids: list[str]) -> dict[str, dict]:
        """Pro Objekt der (älteste) Rate-Plan mit Grundpreis + Währung."""
        rows = (
            self._db()
            .table("rate_plans")
            .select("property_id, base_price, currency, created_at")
            .in_("property_id", ids)
            .order("created_at")
            .execute()
        ).data or []
        out: dict[str, dict] = {}
        for r in rows:  # erster (ältester) je Objekt gewinnt
            out.setdefault(r["property_id"], r)
        return out

    def _active_channels_by_property(self, ids: list[str]) -> dict[str, list[str]]:
        """Aktive OTA-Portal-Codes je Objekt aus channex_channel_connection.

        Nur is_active=true. Fehlt die Tabelle (Env ohne Migration 0035), liefert
        das leer zurück — kein erfundener Kanal."""
        try:
            rows = (
                self._db()
                .table("channex_channel_connection")
                .select("property_id, ota_portal_code, is_active")
                .in_("property_id", ids)
                .eq("is_active", True)
                .execute()
            ).data or []
        except Exception:  # pylint: disable=broad-exception-caught
            return {}
        out: dict[str, list[str]] = {}
        for r in rows:
            code = r.get("ota_portal_code")
            if not code:
                continue
            out.setdefault(r["property_id"], []).append(code)
        return out

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
            market_enabled=bool(row.get("market_enabled")),
            market_sensitivity=float(row.get("market_sensitivity") or 0),
            market_max_adjust_pct=float(row.get("market_max_adjust_pct") or 0),
            market_key=row.get("market_key"),
            comp_refs=[str(r) for r in (row.get("comp_refs") or [])],
            base_mode=_choice(
                row.get("base_mode"), ("data_driven", "manual"), "data_driven"
            ),
            base_rate_mode=_choice(
                row.get("base_rate_mode"),
                ("conservative", "recommended", "aggressive"),
                "recommended",
            ),
            manual_base_price=_opt_float(row.get("manual_base_price")),
            autopilot_enabled=bool(row.get("autopilot_enabled")),
            weather_enabled=bool(row.get("weather_enabled")),
            weather_max_adjust_pct=float(row.get("weather_max_adjust_pct") or 0),
            rate_rules=[
                r for r in (row.get("rate_rules") or []) if isinstance(r, dict)
            ],
        )


def _opt_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _choice(value: object, allowed: tuple[str, ...], default: str) -> str:
    s = str(value) if value is not None else ""
    return s if s in allowed else default
