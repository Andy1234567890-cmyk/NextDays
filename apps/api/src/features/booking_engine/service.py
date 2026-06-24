"""Service-Schicht für booking_engine — öffentliche Buchungsstrecke der Plattform.

Liest öffentlich die Verfügbarkeit einer Property und legt Gastbuchungen an.
KEIN JWT: die tenant_id wird aus der Property abgeleitet (Property-Existenz ist
die Autorisierung). Der Buchungskalender (availability) ist die oberste Wahrheit —
jede Buchung prüft Double-Booking (409) und pusht realtime an Channex/OTAs.
"""
from datetime import date, timedelta

from supabase import Client

from src.core.logging import get_logger

from .schemas import (
    GuestContact,
    PublicAvailabilityResponse,
    PublicBookingRequest,
    PublicBookingResponse,
    PublicDay,
    PublicListing,
    PublicListingDetail,
    PublicListingListResponse,
    SliceHealth,
)

log = get_logger("nextdays.booking_engine")

# Gast-sichere Property-Felder (NIE tenant_id/Eigentümer/interne Preisdetails).
_PUBLIC_PROPERTY_COLUMNS = (
    "id, title, description, property_type, city, country, lat, lng, "
    "max_guests, amenities, photos, type_attributes, status"
)


class BookingEngineError(Exception):
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


def _round_coord(value: object) -> float | None:
    """Koordinate auf ~2 Nachkommastellen runden (ungefähre Lage, nie exakt)."""
    if value is None:
        return None
    try:
        return round(float(value), 2)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _as_opt_int(value: object) -> int | None:
    """jsonb-Wert → int oder None (keine erfundenen 0-Werte)."""
    if value is None:
        return None
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


class BookingEngineService:
    slice_name = "booking_engine"

    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise BookingEngineError("Buchungs-DB nicht verfügbar.", status_code=500)
        return self._client

    # -- Öffentliche Listings (nur active) -----------------------------------
    def list_listings(
        self,
        *,
        q: str | None = None,
        guests: int | None = None,
        start: date | None = None,
        end: date | None = None,
        tenant: str | None = None,
    ) -> PublicListingListResponse:
        """Öffentliche Liste buchbarer Objekte. STRIKT status='active' — draft/
        inactive erscheinen NIE. Default tenant-übergreifend (zentraler Marktplatz);
        mit `tenant` auf einen Mandanten gefiltert (künftige White-Label-Seiten).

        Bei gesetztem start/end fließt die Verfügbarkeit ein (belegte Objekte
        fallen raus) und `price_from` ist der Effektivpreis des Zeitraums. `q`
        filtert über Titel/Ort, `guests` über die Kapazität.
        """
        query = (
            self._db()
            .table("properties")
            .select(_PUBLIC_PROPERTY_COLUMNS)
            .eq("status", "active")
        )
        if tenant:
            query = query.eq("tenant_id", tenant)
        if guests:
            query = query.gte("max_guests", guests)
        rows = query.order("title").execute().data or []

        if q:
            needle = q.strip().lower()
            rows = [
                r
                for r in rows
                if needle in (r.get("title") or "").lower()
                or needle in (r.get("city") or "").lower()
                or needle in (r.get("country") or "").lower()
            ]

        items: list[PublicListing] = []
        for r in rows:
            if start and end and not self._is_available(r["id"], start, end):
                continue
            price, currency = self._price_from(r["id"], start, end)
            items.append(self._to_listing(r, price, currency))
        return PublicListingListResponse(items=items, total=len(items))

    def listing_detail(
        self,
        listing_id: str,
        *,
        start: date | None = None,
        end: date | None = None,
    ) -> PublicListingDetail:
        """Detail eines active Objekts (404, wenn nicht active). Ungefähre Lage
        (gerundete lat/lng), Effektivpreis für den Zeitraum (falls start/end)."""
        rows = (
            self._db()
            .table("properties")
            .select(_PUBLIC_PROPERTY_COLUMNS)
            .eq("id", listing_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise BookingEngineError("Objekt nicht gefunden.", status_code=404)
        r = rows[0]
        price, currency = self._price_from(listing_id, start, end)
        base = self._to_listing(r, price, currency)
        nights = (end - start).days if start and end else None
        return PublicListingDetail(
            **base.model_dump(),
            description=r.get("description"),
            lat=_round_coord(r.get("lat")),
            lng=_round_coord(r.get("lng")),
            price=price,
            nights=nights,
        )

    def _is_available(self, property_id: str, start: date, end: date) -> bool:
        """True, wenn KEIN Tag im Zeitraum belegt/gesperrt ist (open/fehlend)."""
        rows = (
            self._db()
            .table("availability")
            .select("status")
            .eq("property_id", property_id)
            .gte("date", start.isoformat())
            .lt("date", end.isoformat())
            .execute()
        ).data or []
        return all(r.get("status") == "open" for r in rows)

    def _price_from(
        self, property_id: str, start: date | None, end: date | None
    ) -> tuple[float | None, str]:
        """„ab"-Preis pro Nacht via Pricing-Resolver. Mit Zeitraum der niedrigste
        Effektiv-Tagespreis darin, sonst der Effektivpreis von heute. Kein
        Preis hinterlegt → None (kein erfundener Fallback)."""
        from src.features.pricing.resolver import PricingResolver

        resolver = PricingResolver(service_client=self._db())
        if start and end:
            days = resolver.effective_prices(property_id, start, end)
        else:
            today = date.today()
            days = resolver.effective_prices(property_id, today, today + timedelta(days=1))
        prices = [d.price for d in days if d.price is not None]
        currency = self._currency(property_id)
        return (min(prices) if prices else None, currency)

    def _currency(self, property_id: str) -> str:
        res = (
            self._db()
            .table("rate_plans")
            .select("currency")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return (res[0].get("currency") if res else "") or ""

    @staticmethod
    def _to_listing(
        r: dict, price_from: float | None, currency: str
    ) -> PublicListing:
        attrs = r.get("type_attributes") or {}
        return PublicListing(
            id=r["id"],
            title=r.get("title") or "",
            property_type=r.get("property_type") or "",
            city=r.get("city"),
            country=r.get("country"),
            photos=list(r.get("photos") or []),
            max_guests=int(r.get("max_guests") or 1),
            bedrooms=_as_opt_int(attrs.get("bedrooms")),
            baths=_as_opt_int(attrs.get("baths") or attrs.get("bathrooms")),
            amenities=list(r.get("amenities") or []),
            price_from=price_from,
            currency=currency,
        )

    def _property_tenant(self, property_id: str) -> str | None:
        """tenant_id einer veröffentlichten Property. Nur 'active' ist öffentlich
        buchbar (kein draft)."""
        res = (
            self._db()
            .table("properties")
            .select("tenant_id, status")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            return None
        return res[0]["tenant_id"]

    def public_availability(
        self, property_id: str, start: date, end: date
    ) -> PublicAvailabilityResponse:
        """Öffentliche Tagesverfügbarkeit [start, end). Nur buchbar/nicht — keine
        Tenant-/Buchungsdaten. Fehlende Tage gelten als frei."""
        if self._property_tenant(property_id) is None:
            raise BookingEngineError("Objekt nicht gefunden.", status_code=404)
        rows = (
            self._db()
            .table("availability")
            .select("date,status")
            .eq("property_id", property_id)
            .gte("date", start.isoformat())
            .lt("date", end.isoformat())
            .execute()
        ).data or []
        status_by_date = {r["date"]: r["status"] for r in rows}
        days = [
            PublicDay(date=d, available=status_by_date.get(d.isoformat(), "open") == "open")
            for d in _nights(start, end)
        ]
        return PublicAvailabilityResponse(property_id=property_id, days=days)

    def create_public_booking(
        self, req: PublicBookingRequest
    ) -> PublicBookingResponse:
        """Gastbuchung über die eigene Plattform. Double-Booking-Schutz (409),
        belegt den Kalender und sperrt realtime an Channex/OTAs."""
        tenant_id = self._property_tenant(req.property_id)
        if tenant_id is None:
            raise BookingEngineError("Objekt nicht gefunden.", status_code=404)

        nights = _nights(req.check_in, req.check_out)

        # Double-Booking-Schutz: kein Tag darf belegt/gesperrt sein.
        avail = (
            self._db()
            .table("availability")
            .select("date,status")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        ).data or []
        taken = [r["date"] for r in avail if r["status"] != "open"]
        if taken:
            raise BookingEngineError(
                "Zeitraum ist nicht mehr verfügbar.", status_code=409
            )

        guest_id = self._upsert_guest(tenant_id, req.contact)

        ins = (
            self._db()
            .table("reservations")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": req.property_id,
                    "guest_id": guest_id,
                    "channel": "direct",          # eigene Plattform = Direktbuchung
                    "ota_name": "myNextDays",      # Herkunft für Kalender/Posteingang
                    "check_in": req.check_in.isoformat(),
                    "check_out": req.check_out.isoformat(),
                    "status": "confirmed",
                    "total_amount": req.total_amount,
                    "currency": "EUR",
                }
            )
            .execute()
        ).data
        if not ins:
            raise BookingEngineError("Buchung fehlgeschlagen.", status_code=500)
        row = ins[0]

        # Kalender belegen.
        self._db().table("availability").upsert(
            [
                {
                    "property_id": req.property_id,
                    "date": d.isoformat(),
                    "status": "booked",
                    "source": "direct",
                }
                for d in nights
            ],
            on_conflict="property_id,date",
        ).execute()

        # Realtime an Channex/OTAs sperren (availability=0) — kein OTA-Doppel.
        self._push_channex(tenant_id, req.property_id, req.check_in, req.check_out, 0)

        log.info(
            "public_booking_created",
            tenant_id=tenant_id,
            property_id=req.property_id,
            reservation_id=row["id"],
        )
        return PublicBookingResponse(
            id=row["id"],
            property_id=req.property_id,
            check_in=req.check_in,
            check_out=req.check_out,
            status="confirmed",
        )

    def _upsert_guest(self, tenant_id: str, contact: GuestContact) -> str | None:
        name = f"{contact.first_name} {contact.last_name}".strip()
        email = str(contact.email)
        existing = (
            self._db()
            .table("guests")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("email", email)
            .limit(1)
            .execute()
        ).data
        if existing:
            return existing[0]["id"]
        ins = (
            self._db()
            .table("guests")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "name": name or email,
                    "email": email,
                    "phone": contact.phone or None,
                }
            )
            .execute()
        ).data
        return ins[0]["id"] if ins else None

    def _push_channex(
        self,
        tenant_id: str,
        property_id: str,
        check_in: date,
        check_out: date,
        availability: int,
    ) -> None:
        """Realtime-Push an Channex (Doppelbuchungsschutz). Fehler dürfen die
        Buchung NICHT scheitern lassen (ari_outbox-Retry)."""
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
                check_out - timedelta(days=1),
                availability,
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("public_booking_channex_push_failed", error=str(exc))
