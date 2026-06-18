"""Service-Schicht für reservations.

Legt Reservierungen tenant-gescoped an (tenant_id immer aus dem JWT). Eine
Reservierung belegt den Zeitraum im Kalender: alle Übernachtungstage werden in
der availability-Tabelle auf `booked` gesetzt. Vorher Double-Booking-Schutz —
ist ein Tag bereits booked/blocked, schlägt das Anlegen mit 409 fehl.

Gleiches Muster wie properties.service: Service-Role-Client + explizites
tenant-Filtern (PROJECT.md §2 — Business-Logik im Backend).
"""
from datetime import date, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import (
    ReservationCreate,
    ReservationListResponse,
    ReservationResponse,
    SliceHealth,
)

log = get_logger("nextdays.reservations")


class ReservationError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _nights(check_in: date, check_out: date) -> list[date]:
    days: list[date] = []
    cur = check_in
    while cur < check_out:
        days.append(cur)
        cur += timedelta(days=1)
    return days


class ReservationsService:
    slice_name = "reservations"

    def __init__(self, service_client: Client | None = None) -> None:
        # client optional, damit der Health-Endpoint ohne Supabase-Key läuft.
        self._client = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise ReservationError("Reservierungs-DB nicht verfügbar.", status_code=500)
        return self._client

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise ReservationError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def list(self, ctx: AuthContext, property_id: str | None = None) -> ReservationListResponse:
        tenant_id = self._require_tenant(ctx)
        query = (
            self._db()
            .table("reservations")
            .select("*, guests(name)")
            .eq("tenant_id", tenant_id)
        )
        if property_id:
            query = query.eq("property_id", property_id)
        res = query.order("check_in", desc=True).execute()
        items = [self._row(r) for r in (res.data or [])]
        return ReservationListResponse(items=items, total=len(items))

    def create(self, ctx: AuthContext, req: ReservationCreate) -> ReservationResponse:
        tenant_id = self._require_tenant(ctx)

        # 1) Property gehört dem Tenant? (sonst fremde Belegung möglich)
        prop = (
            self._db()
            .table("properties")
            .select("id, currency")
            .eq("id", req.property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not prop.data:
            raise ReservationError("Objekt nicht gefunden.", status_code=404)

        # 2) Double-Booking-Schutz: kein Tag darf booked/blocked sein.
        nights = _nights(req.check_in, req.check_out)
        avail = (
            self._db()
            .table("availability")
            .select("date,status")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        )
        taken = [r["date"] for r in (avail.data or []) if r["status"] != "open"]
        if taken:
            raise ReservationError(
                "Zeitraum enthält bereits belegte/gesperrte Tage.", status_code=409
            )

        # 3) Gast anlegen (oder bestehenden per E-Mail wiederverwenden).
        guest_id = self._upsert_guest(tenant_id, req)

        # 4) Reservierung schreiben.
        currency = prop.data[0].get("currency") or ""
        ins = (
            self._db()
            .table("reservations")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": req.property_id,
                    "guest_id": guest_id,
                    "channel": req.channel.value,
                    "check_in": req.check_in.isoformat(),
                    "check_out": req.check_out.isoformat(),
                    "status": req.status.value,
                    "total_amount": req.total_amount,
                    "currency": currency,
                }
            )
            .execute()
        )
        if not ins.data:
            raise ReservationError("Reservierung konnte nicht angelegt werden.", status_code=500)
        row = ins.data[0]

        # 5) Kalender belegen: alle Übernachtungstage auf booked.
        payload = [
            {
                "property_id": req.property_id,
                "date": day.isoformat(),
                "status": "booked",
                "source": req.channel.value if req.channel.value != "direct" else "direct",
            }
            for day in nights
        ]
        self._db().table("availability").upsert(
            payload, on_conflict="property_id,date"
        ).execute()

        log.info(
            "reservation_created",
            property_id=req.property_id,
            nights=len(nights),
            reservation_id=row["id"],
        )

        guest_name = f"{req.contact.first_name} {req.contact.last_name}".strip()
        return ReservationResponse(
            id=row["id"],
            property_id=row["property_id"],
            guest_id=row.get("guest_id"),
            guest_name=guest_name,
            channel=row["channel"],
            check_in=row["check_in"],
            check_out=row["check_out"],
            status=row["status"],
            total_amount=float(row.get("total_amount") or 0),
            currency=row.get("currency") or "",
        )

    def _upsert_guest(self, tenant_id: str, req: ReservationCreate) -> str | None:
        name = f"{req.contact.first_name} {req.contact.last_name}".strip()
        email = req.contact.email.strip()
        if not name and not email:
            return None
        # Bestehenden Gast per E-Mail wiederverwenden.
        if email:
            found = (
                self._db()
                .table("guests")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("email", email)
                .limit(1)
                .execute()
            )
            if found.data:
                return found.data[0]["id"]
        ins = (
            self._db()
            .table("guests")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "name": name or email,
                    "email": email or None,
                    "phone": req.contact.phone or None,
                }
            )
            .execute()
        )
        return ins.data[0]["id"] if ins.data else None

    def _row(self, r: dict) -> ReservationResponse:
        guest = r.get("guests") or {}
        guest_name = guest.get("name", "") if isinstance(guest, dict) else ""
        return ReservationResponse(
            id=r["id"],
            property_id=r["property_id"],
            guest_id=r.get("guest_id"),
            guest_name=guest_name,
            channel=r["channel"],
            check_in=r["check_in"],
            check_out=r["check_out"],
            status=r["status"],
            total_amount=float(r.get("total_amount") or 0),
            currency=r.get("currency") or "",
        )
