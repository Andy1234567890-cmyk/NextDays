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
from src.features.auth.guest_masking import GuestMask, load_guest_mask
from src.features.guests.identity import (
    GuestContact as ResolverContact,
)
from src.features.guests.identity import (
    resolve_or_create_guest,
)

from .schemas import (
    DashboardEntry,
    DashboardKpi,
    DashboardResponse,
    ReservationCreate,
    ReservationListResponse,
    ReservationResponse,
    SliceHealth,
)

log = get_logger("nextdays.reservations")


def _as_date(value: object) -> date:
    """Supabase liefert Datumsspalten als ISO-String; date bleibt date."""
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


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

    def _push_channex_availability(
        self,
        tenant_id: str,
        property_id: str,
        check_in: date,
        check_out: date,
        availability: int,
    ) -> None:
        """Verfügbarkeit der belegten/freigegebenen Nächte realtime an Channex
        pushen (Doppelbuchungsschutz). Fehler dürfen die Buchung NICHT scheitern
        lassen — der Push ist über die ari_outbox abgesichert (Retry)."""
        if self._client is None:
            return
        try:
            from src.features.channel_manager.service import ChannelManagerService

            ChannelManagerService(
                service_client=self._client
            ).push_availability_for_property(
                tenant_id,
                property_id,
                check_in,
                check_out - timedelta(days=1),  # Abreisetag exklusiv
                availability,
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("reservation_channex_push_failed", error=str(exc))

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
        mask = load_guest_mask(self._client, ctx.user_id)
        items = [self._row(r, mask) for r in (res.data or [])]
        return ReservationListResponse(items=items, total=len(items))

    def dashboard(self, ctx: AuthContext) -> DashboardResponse:
        """Startseiten-Kennzahlen aus echten Reservierungen (kein Fallback).

        Listen: heutige Check-outs/-ins und die nächsten anstehenden Anreisen.
        KPIs: Check-ins, Umsatz und bestätigte Reservierungen der letzten 30
        Tage, jeweils mit prozentualer Veränderung gegenüber den 30 Tagen davor.
        """
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db()
            .table("reservations")
            .select("*, guests(name)")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []

        # Objekttitel je property_id nachladen (Liste zeigt den Objektnamen).
        prop_ids = sorted({r["property_id"] for r in rows if r.get("property_id")})
        titles: dict[str, str] = {}
        if prop_ids:
            props = (
                self._db()
                .table("properties")
                .select("id, title")
                .eq("tenant_id", tenant_id)
                .in_("id", prop_ids)
                .execute()
            ).data or []
            for p in props:
                titles[p["id"]] = p.get("title") or ""

        # Währung trägt die Reservierung selbst (properties hat keine currency-Spalte).
        currency = next(
            (r["currency"] for r in rows if r.get("currency")), ""
        )

        today = date.today()
        mask = load_guest_mask(self._client, ctx.user_id)

        def entry(r: dict) -> DashboardEntry:
            guest = r.get("guests") or {}
            name = guest.get("name", "") if isinstance(guest, dict) else ""
            return DashboardEntry(
                reservation_id=r["id"],
                guest_name=mask.name(name) or "",
                property_title=titles.get(r["property_id"], ""),
                channel=r["channel"],
                ota_name=mask.source_value(r.get("ota_name")),
                check_in=r["check_in"],
                check_out=r["check_out"],
                status=r["status"],
            )

        active = [r for r in rows if r.get("status") != "cancelled"]

        checkouts_today = sorted(
            (entry(r) for r in active if _as_date(r["check_out"]) == today),
            key=lambda e: e.check_out,
        )
        checkins_today = sorted(
            (entry(r) for r in active if _as_date(r["check_in"]) == today),
            key=lambda e: e.check_in,
        )
        upcoming = sorted(
            (entry(r) for r in active if _as_date(r["check_in"]) > today),
            key=lambda e: e.check_in,
        )

        # KPIs: laufende 30-Tage-Periode (inkl. heute) vs. die 30 Tage davor.
        cur_start = today - timedelta(days=29)  # 30 Tage inkl. heute
        prev_start = today - timedelta(days=59)

        def in_window(r: dict, start: date, end: date) -> bool:
            ci = _as_date(r["check_in"])
            return start <= ci <= end

        cur = [r for r in active if in_window(r, cur_start, today)]
        prev = [r for r in active if in_window(r, prev_start, cur_start - timedelta(days=1))]

        def kpi(cur_val: float, prev_val: float) -> DashboardKpi:
            if prev_val == 0:
                return DashboardKpi(value=cur_val, change_pct=None)
            change = (cur_val - prev_val) / prev_val * 100
            return DashboardKpi(value=cur_val, change_pct=round(change, 1))

        checkins_30d = kpi(len(cur), len(prev))
        revenue_30d = kpi(
            sum(float(r.get("total_amount") or 0) for r in cur),
            sum(float(r.get("total_amount") or 0) for r in prev),
        )
        confirmed_30d = kpi(
            sum(1 for r in cur if r.get("status") == "confirmed"),
            sum(1 for r in prev if r.get("status") == "confirmed"),
        )

        return DashboardResponse(
            today=today,
            checkouts_today=checkouts_today,
            checkins_today=checkins_today,
            upcoming=upcoming,
            checkins_30d=checkins_30d,
            revenue_30d=revenue_30d,
            confirmed_30d=confirmed_30d,
            currency=currency,
        )

    def create(self, ctx: AuthContext, req: ReservationCreate) -> ReservationResponse:
        tenant_id = self._require_tenant(ctx)

        # 1) Property gehört dem Tenant? (sonst fremde Belegung möglich)
        prop = (
            self._db()
            .table("properties")
            .select("id")
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

        # 4) Reservierung schreiben. Währung vom Rate-Plan des Objekts
        #    (properties hat keine currency-Spalte); ohne Rate-Plan bleibt sie leer.
        rate = (
            self._db()
            .table("rate_plans")
            .select("currency")
            .eq("property_id", req.property_id)
            .limit(1)
            .execute()
        )
        currency = (rate.data[0].get("currency") if rate.data else "") or ""
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

        # Realtime: belegte Tage sofort an Channex/OTAs sperren (availability=0),
        # damit keine OTA-Doppelbuchung entsteht. Buchungskalender = Wahrheit.
        self._push_channex_availability(
            tenant_id, req.property_id, req.check_in, req.check_out, 0
        )

        log.info(
            "reservation_created",
            property_id=req.property_id,
            nights=len(nights),
            reservation_id=row["id"],
        )

        mask = load_guest_mask(self._client, ctx.user_id)
        guest_name = f"{req.contact.first_name} {req.contact.last_name}".strip()
        return ReservationResponse(
            id=row["id"],
            property_id=row["property_id"],
            guest_id=row.get("guest_id"),
            guest_name=mask.name(guest_name) or "",
            channel=row["channel"],
            check_in=row["check_in"],
            check_out=row["check_out"],
            status=row["status"],
            total_amount=mask.amount(float(row.get("total_amount") or 0)),
            currency=(row.get("currency") or "") if mask.amounts else "",
            ota_name=mask.source_value(row.get("ota_name")),
            external_ref=row.get("external_ref"),
        )

    def _upsert_guest(self, tenant_id: str, req: ReservationCreate) -> str | None:
        # 1) Fest zugeordneter Gast (z. B. aus der Gästekarte): nur übernehmen,
        #    wenn er DIESEM Tenant gehört — sonst ignorieren (kein Fremd-Link).
        if req.guest_id:
            owned = (
                self._db()
                .table("guests")
                .select("id")
                .eq("id", req.guest_id)
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            )
            if owned.data:
                return owned.data[0]["id"]
        # 2) Sonst zentraler Resolver (E-Mail→Telefon→Neuanlage), ein Pfad für
        #    alle Kanäle. Keine Dublette bei wiederkehrendem Gast.
        return resolve_or_create_guest(
            self._db(),
            tenant_id,
            ResolverContact(
                first_name=req.contact.first_name,
                last_name=req.contact.last_name,
                email=req.contact.email,
                phone=req.contact.phone,
                channel="direct",
            ),
        )

    def _row(self, r: dict, mask: GuestMask) -> ReservationResponse:
        guest = r.get("guests") or {}
        guest_name = guest.get("name", "") if isinstance(guest, dict) else ""
        amount = mask.amount(float(r.get("total_amount") or 0))
        return ReservationResponse(
            id=r["id"],
            property_id=r["property_id"],
            guest_id=r.get("guest_id"),
            guest_name=mask.name(guest_name) or "",
            channel=r["channel"],
            check_in=r["check_in"],
            check_out=r["check_out"],
            status=r["status"],
            total_amount=amount,
            currency=(r.get("currency") or "") if mask.amounts else "",
            ota_name=mask.source_value(r.get("ota_name")),
            external_ref=r.get("external_ref"),
        )
