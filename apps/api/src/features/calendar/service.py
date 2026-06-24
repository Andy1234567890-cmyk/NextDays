"""Service-Schicht für calendar — das Herzstück (Lastenheft §2.2).

Verfügbarkeitslogik + Double-Booking-Schutz über die availability-Tabelle
(eine Zeile pro property_id/date). Manuelle Preisüberschreibung pro Tag.

Der Supabase-Client wird injiziert → im Test mockbar; echte DB-Calls beim
laufenden Stack. Kein stilles Exception-Swallowing (PROJECT.md).
"""
from datetime import date
from typing import TYPE_CHECKING

from supabase import Client

from src.core.logging import get_logger

from .schemas import (
    AvailabilityCheck,
    AvailabilitySource,
    AvailabilityStatus,
    BlockRequest,
    BulkEditRequest,
    BulkEditResult,
    DateRange,
    DayAvailability,
    PriceOverrideRequest,
    SliceHealth,
)

if TYPE_CHECKING:
    from src.features.pricing.resolver import PricingResolver

log = get_logger("nextdays.calendar")


class CalendarError(Exception):
    """Fachlicher Kalender-Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class CalendarService:
    slice_name = "calendar"

    def __init__(self, client: Client | None = None) -> None:
        # client optional, damit der Health-Endpoint ohne Supabase-Key läuft.
        self._client = client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise CalendarError("Kalender-DB nicht verfügbar.", status_code=500)
        return self._client

    def _resolver(self) -> "PricingResolver":
        """Zentraler Preis-Resolver (eine Preis-Wahrheit für Kalender + Quote)."""
        from src.features.pricing.resolver import PricingResolver

        return PricingResolver(service_client=self._db())

    def get_availability(
        self, property_id: str, rng: DateRange
    ) -> list[DayAvailability]:
        """Tagesstatus im Zeitraum inkl. Preis + Min-Stay. Fehlende Tage = offen.

        Preis je Tag kommt aus dem zentralen Preis-Resolver (override > weekday >
        base) — DIESELBE Wahrheit wie der Buchungs-Quote, damit Kalender und Quote
        nie auseinanderlaufen. Min-Stay kommt aus dem Rate-Plan (per-Tag-
        Restriktionen sind v2). Ohne Rate-Plan/Override bleibt der Preis None
        (kein erfundener Fallback-Preis).
        """
        rows = self._fetch_days(property_id, rng)
        by_date = {r["date"]: r for r in rows}
        prices = {
            d.date.isoformat(): d.price
            for d in self._resolver().effective_prices(property_id, rng.start, rng.end)
        }
        _base, min_stay = self._fetch_rate_plan(property_id)
        result: list[DayAvailability] = []
        for day in rng.nights():
            key = day.isoformat()
            row = by_date.get(key)
            price = prices.get(key)
            result.append(
                DayAvailability(
                    date=day,
                    status=(
                        AvailabilityStatus(row["status"])
                        if row is not None
                        else AvailabilityStatus.open
                    ),
                    source=(
                        AvailabilitySource(row["source"])
                        if row is not None
                        else AvailabilitySource.manual
                    ),
                    price=price,
                    min_stay=min_stay,
                )
            )
        return result

    def check_availability(
        self, property_id: str, rng: DateRange
    ) -> AvailabilityCheck:
        """Double-Booking-Schutz: frei nur, wenn KEIN Tag booked/blocked ist."""
        conflicts: list[date] = [
            d.date
            for d in self.get_availability(property_id, rng)
            if d.status != AvailabilityStatus.open
        ]
        return AvailabilityCheck(
            property_id=property_id,
            available=not conflicts,
            conflicting_days=conflicts,
        )

    def block(self, req: BlockRequest) -> int:
        """Tage sperren (manuell). Idempotenter Upsert pro Tag. Gibt Anzahl zurück.

        Schützt vor Double-Booking: bereits gebuchte Tage werden NICHT überschrieben.
        """
        booked = [
            d.date
            for d in self.get_availability(req.property_id, req.range)
            if d.status == AvailabilityStatus.booked
        ]
        if booked:
            raise CalendarError(
                "Zeitraum enthält bereits gebuchte Tage.", status_code=409
            )
        payload = [
            {
                "property_id": req.property_id,
                "date": day.isoformat(),
                "status": AvailabilityStatus.blocked.value,
                "source": AvailabilitySource.manual.value,
            }
            for day in req.range.nights()
        ]
        self._db().table("availability").upsert(
            payload, on_conflict="property_id,date"
        ).execute()
        # Realtime: gesperrte Tage sofort an Channex/OTAs (availability=0).
        self._push_channex_availability(
            req.property_id, req.range.start, req.range.end, 0
        )
        log.info("calendar_block", property_id=req.property_id, days=len(payload))
        return len(payload)

    def set_price_override(self, req: PriceOverrideRequest) -> None:
        """Tagespreis im Kalenderblatt setzen/zurücknehmen (Lastenheft §2.2).

        price=None nimmt die Überschreibung zurück (Tag folgt wieder dem Rate-Plan).
        """
        self._db().table("price_overrides").upsert(
            {
                "property_id": req.property_id,
                "date": req.date.isoformat(),
                "price": req.price,
            },
            on_conflict="property_id,date",
        ).execute()
        log.info(
            "calendar_price_override",
            property_id=req.property_id,
            date=req.date.isoformat(),
            cleared=req.price is None,
        )

    def _fetch_days(self, property_id: str, rng: DateRange) -> list[dict[str, str]]:
        res = (
            self._db()
            .table("availability")
            .select("date,status,source")
            .eq("property_id", property_id)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .execute()
        )
        return res.data or []

    def _fetch_rate_plan(
        self, property_id: str
    ) -> tuple[float | None, int | None]:
        """Basispreis + Min-Stay aus dem (ersten) Rate-Plan des Objekts.

        Ohne Rate-Plan → (None, None); es wird kein Preis erfunden.
        """
        res = (
            self._db()
            .table("rate_plans")
            .select("base_price,min_stay")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None, None
        row = rows[0]
        base = row.get("base_price")
        min_stay = row.get("min_stay")
        return (
            float(base) if base is not None else None,
            int(min_stay) if min_stay is not None else None,
        )

    # -- Stop-Sell (Verkaufsstopp je Tag) -------------------------------------
    def list_stop_sell(
        self, property_id: str, rng: DateRange
    ) -> list[dict[str, object]]:
        res = (
            self._db()
            .table("stop_sell")
            .select("id,property_id,date,reason,source")
            .eq("property_id", property_id)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .order("date")
            .execute()
        )
        return res.data or []

    def set_stop_sell(
        self, tenant_id: str, property_id: str, rng: DateRange, reason: str | None
    ) -> int:
        """Verkaufsstopp manuell setzen (idempotent pro Tag)."""
        payload = [
            {
                "tenant_id": tenant_id,
                "property_id": property_id,
                "date": day.isoformat(),
                "reason": reason,
                "source": "manual",
            }
            for day in rng.nights()
        ]
        self._db().table("stop_sell").upsert(
            payload, on_conflict="property_id,date"
        ).execute()
        log.info("calendar_stop_sell_set", property_id=property_id, days=len(payload))
        return len(payload)

    def clear_stop_sell(self, property_id: str, rng: DateRange) -> None:
        """Manuellen Verkaufsstopp aufheben. Channex-Stops (source=channex) bleiben
        unangetastet — die spiegeln den OTA-Stand und werden per Import gepflegt."""
        self._db().table("stop_sell").delete().eq("property_id", property_id).eq(
            "source", "manual"
        ).gte("date", rng.start.isoformat()).lt(
            "date", rng.end.isoformat()
        ).execute()
        log.info("calendar_stop_sell_cleared", property_id=property_id)

    # -- Saisonpreise (Tagespreise je Zeitraum → price_overrides + Channex) ----
    def list_season_prices(
        self, property_id: str, rng: DateRange
    ) -> list[dict[str, object]]:
        res = (
            self._db()
            .table("price_overrides")
            .select("date, price")
            .eq("property_id", property_id)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .not_.is_("price", "null")
            .order("date")
            .execute()
        )
        return res.data or []

    def set_season_price(
        self, property_id: str, rng: DateRange, price: float
    ) -> int:
        """Tagespreis für jeden Tag im Zeitraum setzen (price_overrides) und an
        Channex pushen (Restrictions/rate). Gibt Anzahl Tage zurück."""
        payload = [
            {
                "property_id": property_id,
                "date": day.isoformat(),
                "price": price,
            }
            for day in rng.nights()
        ]
        self._db().table("price_overrides").upsert(
            payload, on_conflict="property_id,date"
        ).execute()
        # Realtime an Channex: Tagespreis (Cent) für den Zeitraum.
        self._push_channex_rate(property_id, rng.start, rng.end, round(price * 100))
        log.info(
            "calendar_season_price_set", property_id=property_id, days=len(payload)
        )
        return len(payload)

    # -- Bulk-Edit (mehrere Objekte × ein Zeitraum) ---------------------------
    def _set_min_stay(self, property_id: str, rng: DateRange, min_stay: int) -> None:
        """Mindestaufenthalt des Objekts setzen (rate_plans, property-weit) und
        als Restriktion für den Zeitraum an Channex pushen. Per-Tag-Min-Stay
        ist v2 — hier gilt der Wert objektweit (so wie der Rate-Plan)."""
        self._db().table("rate_plans").update({"min_stay": min_stay}).eq(
            "property_id", property_id
        ).execute()
        self._push_channex_rate(
            property_id, rng.start, rng.end, None, min_stay=min_stay
        )

    def bulk_edit(self, tenant_id: str, req: BulkEditRequest) -> BulkEditResult:
        """Preis/Min-Stay/Sperre/Verkaufsstopp über mehrere Objekte × Zeitraum
        in einem Rutsch setzen. Nur gesetzte Felder werden angewendet. Jedes
        Objekt muss DIESEM Tenant gehören (sonst 404 für die ganze Operation).
        """
        owned = (
            self._db()
            .table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("id", req.property_ids)
            .execute()
        ).data or []
        owned_ids = {p["id"] for p in owned}
        missing = [pid for pid in req.property_ids if pid not in owned_ids]
        if missing:
            raise CalendarError("Objekt nicht gefunden.", status_code=404)

        applied: list[str] = []
        for pid in req.property_ids:
            if req.block is True:
                self.block(BlockRequest(property_id=pid, range=req.range))
            elif req.block is False:
                self._unblock(pid, req.range)
            if req.stop_sell is True:
                self.set_stop_sell(tenant_id, pid, req.range, None)
            elif req.stop_sell is False:
                self.clear_stop_sell(pid, req.range)
            if req.price is not None:
                self.set_season_price(pid, req.range, req.price)
            if req.min_stay is not None:
                self._set_min_stay(pid, req.range, req.min_stay)

        if req.block is True:
            applied.append("block")
        elif req.block is False:
            applied.append("unblock")
        if req.stop_sell is True:
            applied.append("stop_sell")
        elif req.stop_sell is False:
            applied.append("clear_stop_sell")
        if req.price is not None:
            applied.append("price")
        if req.min_stay is not None:
            applied.append("min_stay")

        log.info(
            "calendar_bulk_edit",
            properties=len(req.property_ids),
            applied=applied,
        )
        return BulkEditResult(
            properties=len(req.property_ids),
            days=len(req.range.nights()),
            applied=applied,
        )

    def _unblock(self, property_id: str, rng: DateRange) -> None:
        """Manuelle Sperre im Zeitraum aufheben (nur source=manual; gebuchte Tage
        bleiben unberührt). Gibt die Tage an Channex frei (availability=1)."""
        self._db().table("availability").delete().eq(
            "property_id", property_id
        ).eq("status", "blocked").eq("source", "manual").gte(
            "date", rng.start.isoformat()
        ).lt("date", rng.end.isoformat()).execute()
        self._push_channex_availability(property_id, rng.start, rng.end, 1)

    def _push_channex_rate(
        self,
        property_id: str,
        start: date,
        end: date,
        rate_cents: int | None,
        *,
        min_stay: int | None = None,
    ) -> None:
        """Tagespreis und/oder Min-Stay an Channex pushen. tenant_id über die
        property. Fehler dürfen die Speicherung NICHT scheitern lassen (Cron
        gleicht Preise/Restriktionen ohnehin ab)."""
        if self._client is None:
            return
        try:
            from datetime import timedelta

            prop = (
                self._db()
                .table("properties")
                .select("tenant_id")
                .eq("id", property_id)
                .limit(1)
                .execute()
            ).data
            if not prop:
                return
            from src.features.channel_manager.service import ChannelManagerService

            ChannelManagerService(service_client=self._client).push_rate_for_property(
                prop[0]["tenant_id"],
                property_id,
                start,
                end - timedelta(days=1),  # end exklusiv
                rate_cents,
                min_stay=min_stay,
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("calendar_channex_rate_push_failed", error=str(exc))

    def _push_channex_availability(
        self, property_id: str, start: date, end: date, availability: int
    ) -> None:
        """Verfügbarkeit der Tage [start, end) realtime an Channex pushen
        (Doppelbuchungsschutz). tenant_id wird über die property ermittelt. Fehler
        dürfen die Kalenderaktion NICHT scheitern lassen (ari_outbox-Retry)."""
        if self._client is None:
            return
        try:
            from datetime import timedelta

            prop = (
                self._db()
                .table("properties")
                .select("tenant_id")
                .eq("id", property_id)
                .limit(1)
                .execute()
            ).data
            if not prop:
                return
            from src.features.channel_manager.service import ChannelManagerService

            ChannelManagerService(
                service_client=self._client
            ).push_availability_for_property(
                prop[0]["tenant_id"],
                property_id,
                start,
                end - timedelta(days=1),  # end ist exklusiv
                availability,
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("calendar_channex_push_failed", error=str(exc))
