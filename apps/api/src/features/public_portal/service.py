"""Service-Schicht für public_portal (Eigentümer-Self-Service-Portal, §4.2).

Der eingeloggte Eigentümer sieht NUR seine zugeordneten Objekte
(owner_property_assignments) — der Service nutzt den Service-Role-Key (umgeht RLS),
darum wird der Owner-Scope hier EXPLIZIT durchgesetzt (fail-closed: keine
Zuordnung → sieht nichts). Beträge/Gäste werden über guest_masking maskiert: ein
Owner sieht Netto/Vorname, aber keinen Gastpreis/PII.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.features.auth.guest_masking import load_guest_mask

from .schemas import (
    BlockRequestCreate,
    BlockRequestItem,
    BlockRequestList,
    MeterReadingCreate,
    MeterReadingItem,
    MeterReadingList,
    PortalCalendarDay,
    PortalCalendarResponse,
    PortalEarningsItem,
    PortalEarningsResponse,
    PortalProperty,
    PortalPropertyList,
    PortalStatementItem,
    PortalStatementList,
    SliceHealth,
)

log = get_logger("nextdays.public_portal")

_CENT = Decimal("0.01")


def _money(value: Decimal) -> float:
    return float(value.quantize(_CENT, rounding=ROUND_HALF_UP))


class PortalError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class PublicPortalService:
    slice_name = "public_portal"

    def __init__(self, service_client: Client | None = None) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    # --- Scope ---------------------------------------------------------------

    def _require(self, ctx: AuthContext) -> tuple[str, str]:
        if not ctx.tenant_id or not ctx.user_id:
            raise PortalError("Kein Tenant/Nutzer im Konto.", status_code=400)
        return ctx.tenant_id, ctx.user_id

    def _owned_property_ids(self, ctx: AuthContext) -> list[str]:
        """Objekte, die diesem Eigentümer zugeordnet sind. Fail-closed."""
        tenant_id, user_id = self._require(ctx)
        rows = (
            self._db.table("owner_property_assignments")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .execute()
        ).data or []
        return [str(r["property_id"]) for r in rows]

    def _require_own(self, ctx: AuthContext, property_id: str) -> None:
        if property_id not in self._owned_property_ids(ctx):
            raise PortalError("Objekt nicht gefunden.", status_code=404)

    # --- Objekte -------------------------------------------------------------

    def my_properties(self, ctx: AuthContext) -> PortalPropertyList:
        ids = self._owned_property_ids(ctx)
        if not ids:
            return PortalPropertyList(items=[], total=0)
        rows = (
            self._db.table("properties")
            .select("id, title, city, photos")
            .in_("id", ids)
            .order("title")
            .execute()
        ).data or []
        items = [
            PortalProperty(
                id=str(r["id"]),
                title=r.get("title") or "",
                city=r.get("city"),
                photo=(r.get("photos") or [None])[0],
            )
            for r in rows
        ]
        return PortalPropertyList(items=items, total=len(items))

    # --- Kalender (maskiert) -------------------------------------------------

    def calendar(
        self, ctx: AuthContext, property_id: str, start: date, end: date
    ) -> PortalCalendarResponse:
        self._require_own(ctx, property_id)
        mask = load_guest_mask(self._db, ctx.user_id)
        avail = {
            r["date"]: r.get("status") or "open"
            for r in (
                self._db.table("availability")
                .select("date, status")
                .eq("property_id", property_id)
                .gte("date", start.isoformat())
                .lt("date", end.isoformat())
                .execute()
            ).data
            or []
        }
        prices: dict[str, float | None] = {}
        if mask.amounts:
            from src.features.pricing.resolver import PricingResolver

            resolver = PricingResolver(service_client=self._db)
            for day in resolver.effective_prices(property_id, start, end):
                prices[day.date.isoformat()] = day.price

        days: list[PortalCalendarDay] = []
        cur = start
        while cur < end:
            iso = cur.isoformat()
            days.append(
                PortalCalendarDay(
                    date=cur,
                    status=avail.get(iso, "open"),
                    # Netto-Preis nur, wenn die Maske Beträge erlaubt.
                    price=prices.get(iso) if mask.amounts else None,
                )
            )
            cur += timedelta(days=1)
        return PortalCalendarResponse(property_id=property_id, days=days)

    # --- Earnings (maskiert) -------------------------------------------------

    def earnings(
        self, ctx: AuthContext, period_from: date, period_to: date
    ) -> PortalEarningsResponse:
        tenant_id, user_id = self._require(ctx)
        mask = load_guest_mask(self._db, user_id)
        ids = self._owned_property_ids(ctx)
        currency = self._tenant_currency(tenant_id)
        if not ids:
            return PortalEarningsResponse(
                period_from=period_from,
                period_to=period_to,
                items=[],
                total_payout=0.0 if mask.amounts else None,
                currency=currency,
            )
        titles = {
            str(r["id"]): r.get("title") or ""
            for r in (
                self._db.table("properties")
                .select("id, title")
                .in_("id", ids)
                .execute()
            ).data
            or []
        }
        # Vollständig paginiert: die Einnahmen-Übersicht aggregiert payout/nights
        # über ALLE Reservierungen des Zeitraums. Ein stiller 1000-Zeilen-Cap würde
        # dem Owner im Portal zu niedrige Summen anzeigen.
        reservations = fetch_all_rows(
            self._db.table("reservations")
            .select("id, property_id, check_in, check_out, total_amount, channel_fee")
            .eq("tenant_id", tenant_id)
            .in_("property_id", ids)
            .gte("check_in", period_from.isoformat())
            .lte("check_in", period_to.isoformat())
            .in_("status", ["confirmed", "completed"])
            .order("id")
        )

        agg: dict[str, dict] = {
            pid: {"nights": 0, "reservations": 0, "payout": Decimal("0")} for pid in ids
        }
        for r in reservations:
            pid = str(r["property_id"])
            a = agg.setdefault(
                pid, {"nights": 0, "reservations": 0, "payout": Decimal("0")}
            )
            a["nights"] += self._nights(r.get("check_in"), r.get("check_out"))
            a["reservations"] += 1
            a["payout"] += Decimal(str(r.get("total_amount") or 0)) - Decimal(
                str(r.get("channel_fee") or 0)
            )

        items: list[PortalEarningsItem] = []
        total = Decimal("0")
        for pid, a in agg.items():
            total += a["payout"]
            items.append(
                PortalEarningsItem(
                    property_id=pid,
                    title=titles.get(pid, ""),
                    nights=a["nights"],
                    reservations=a["reservations"],
                    payout=_money(a["payout"]) if mask.amounts else None,
                    currency=currency,
                )
            )
        items.sort(key=lambda i: i.title)
        return PortalEarningsResponse(
            period_from=period_from,
            period_to=period_to,
            items=items,
            total_payout=_money(total) if mask.amounts else None,
            currency=currency,
        )

    # --- Statements (eigene) -------------------------------------------------

    def my_statements(self, ctx: AuthContext) -> PortalStatementList:
        """Finalisierte Statements der Owner, die mit diesem Login verknüpft sind."""
        tenant_id, user_id = self._require(ctx)
        owner_ids = [
            str(r["id"])
            for r in (
                self._db.table("owners")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("user_id", user_id)
                .execute()
            ).data
            or []
        ]
        if not owner_ids:
            return PortalStatementList(items=[], total=0)
        rows = (
            self._db.table("owner_statements")
            .select(
                "id, period_from, period_to, status, owner_payout, currency, "
                "invoice_number, created_at"
            )
            .eq("tenant_id", tenant_id)
            .in_("owner_id", owner_ids)
            .eq("status", "finalized")
            .order("created_at", desc=True)
            .execute()
        ).data or []
        items = [
            PortalStatementItem(
                id=str(r["id"]),
                period_from=date.fromisoformat(r["period_from"]),
                period_to=date.fromisoformat(r["period_to"]),
                status=r.get("status") or "finalized",
                owner_payout=_money(Decimal(str(r.get("owner_payout") or 0))),
                currency=r.get("currency") or "EUR",
                invoice_number=r.get("invoice_number"),
                created_at=str(r["created_at"]) if r.get("created_at") else None,
            )
            for r in rows
        ]
        return PortalStatementList(items=items, total=len(items))

    # --- Sperrung beantragen -------------------------------------------------

    def request_block(
        self, ctx: AuthContext, req: BlockRequestCreate
    ) -> BlockRequestItem:
        tenant_id, user_id = self._require(ctx)
        self._require_own(ctx, req.property_id)
        if req.end_date < req.start_date:
            raise PortalError("Enddatum vor Startdatum.", status_code=400)
        res = (
            self._db.table("block_requests")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": req.property_id,
                    "requested_by": user_id,
                    "start_date": req.start_date.isoformat(),
                    "end_date": req.end_date.isoformat(),
                    "status": "pending",
                }
            )
            .execute()
        )
        if not res.data:
            raise PortalError("Antrag konnte nicht angelegt werden.", status_code=500)
        log.info(
            "portal_block_requested", tenant_id=tenant_id, property_id=req.property_id
        )
        return _block(res.data[0])

    def my_block_requests(self, ctx: AuthContext) -> BlockRequestList:
        tenant_id, user_id = self._require(ctx)
        rows = (
            self._db.table("block_requests")
            .select("id, property_id, start_date, end_date, status, created_at")
            .eq("tenant_id", tenant_id)
            .eq("requested_by", user_id)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        return BlockRequestList(items=[_block(r) for r in rows], total=len(rows))

    # --- Zählerstände --------------------------------------------------------

    def add_meter_reading(
        self, ctx: AuthContext, req: MeterReadingCreate
    ) -> MeterReadingItem:
        tenant_id, user_id = self._require(ctx)
        self._require_own(ctx, req.property_id)
        res = (
            self._db.table("meter_readings")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": req.property_id,
                    "meter_kind": req.meter_kind,
                    "value": req.value,
                    "read_at": req.read_at.isoformat(),
                    "created_by": user_id,
                }
            )
            .execute()
        )
        if not res.data:
            raise PortalError(
                "Zählerstand konnte nicht angelegt werden.", status_code=500
            )
        log.info(
            "portal_meter_reading_added",
            tenant_id=tenant_id,
            property_id=req.property_id,
        )
        return _meter(res.data[0])

    def meter_readings(self, ctx: AuthContext, property_id: str) -> MeterReadingList:
        self._require_own(ctx, property_id)
        rows = (
            self._db.table("meter_readings")
            .select("id, property_id, meter_kind, value, read_at, created_at")
            .eq("property_id", property_id)
            .order("read_at", desc=True)
            .execute()
        ).data or []
        return MeterReadingList(items=[_meter(r) for r in rows], total=len(rows))

    # --- Helfer --------------------------------------------------------------

    @staticmethod
    def _nights(check_in: str | None, check_out: str | None) -> int:
        try:
            return max(
                (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days, 0
            )
        except (ValueError, TypeError):
            return 0

    def _tenant_currency(self, tenant_id: str) -> str:
        rows = (
            self._db.table("tenants")
            .select("currency")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return (rows[0].get("currency") if rows else None) or "EUR"


def _block(r: dict) -> BlockRequestItem:
    return BlockRequestItem(
        id=str(r["id"]),
        property_id=str(r["property_id"]),
        start_date=date.fromisoformat(r["start_date"])
        if isinstance(r["start_date"], str)
        else r["start_date"],
        end_date=date.fromisoformat(r["end_date"])
        if isinstance(r["end_date"], str)
        else r["end_date"],
        status=r.get("status") or "pending",
        created_at=str(r["created_at"]) if r.get("created_at") else None,
    )


def _meter(r: dict) -> MeterReadingItem:
    return MeterReadingItem(
        id=str(r["id"]),
        property_id=str(r["property_id"]),
        meter_kind=r["meter_kind"],
        value=float(r.get("value") or 0),
        read_at=date.fromisoformat(r["read_at"])
        if isinstance(r["read_at"], str)
        else r["read_at"],
        created_at=str(r["created_at"]) if r.get("created_at") else None,
    )
