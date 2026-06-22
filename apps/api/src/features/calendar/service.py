"""Service-Schicht für calendar — das Herzstück (Lastenheft §2.2).

Verfügbarkeitslogik + Double-Booking-Schutz über die availability-Tabelle
(eine Zeile pro property_id/date). Manuelle Preisüberschreibung pro Tag.

Der Supabase-Client wird injiziert → im Test mockbar; echte DB-Calls beim
laufenden Stack. Kein stilles Exception-Swallowing (PROJECT.md).
"""
from datetime import date

from supabase import Client

from src.core.logging import get_logger

from .schemas import (
    AvailabilityCheck,
    AvailabilitySource,
    AvailabilityStatus,
    BlockRequest,
    DateRange,
    DayAvailability,
    PriceOverrideRequest,
    SliceHealth,
)

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

    def get_availability(
        self, property_id: str, rng: DateRange
    ) -> list[DayAvailability]:
        """Tagesstatus im Zeitraum. Fehlende Tage gelten als offen."""
        rows = self._fetch_days(property_id, rng)
        by_date = {r["date"]: r for r in rows}
        result: list[DayAvailability] = []
        for day in rng.nights():
            row = by_date.get(day.isoformat())
            if row is not None:
                result.append(
                    DayAvailability(
                        date=day,
                        status=AvailabilityStatus(row["status"]),
                        source=AvailabilitySource(row["source"]),
                    )
                )
            else:
                result.append(
                    DayAvailability(
                        date=day,
                        status=AvailabilityStatus.open,
                        source=AvailabilitySource.manual,
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
