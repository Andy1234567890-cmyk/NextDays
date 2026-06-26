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
    PostBookingAddonRequest,
    PublicAddon,
    PublicAvailabilityResponse,
    PublicBookingRequest,
    PublicBookingResponse,
    PublicDay,
    PublicListing,
    PublicListingDetail,
    PublicListingListResponse,
    PurchasedAddon,
    ReservationAddonsView,
    SliceHealth,
)

log = get_logger("nextdays.booking_engine")

# Gast-sichere Property-Felder (NIE tenant_id/Eigentümer/interne Preisdetails).
# platform_description ist der optionale Eigenplattform-Text (überschreibt
# description NUR hier; OTAs/Channex sehen ihn nicht).
_PUBLIC_PROPERTY_COLUMNS = (
    "id, title, description, platform_description, property_type, city, country, "
    "lat, lng, max_guests, amenities, photos, type_attributes, status"
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


def _as_opt_float(value: object) -> float | None:
    """DB-Wert → float oder None (kein erfundener 0-Preis)."""
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
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

        if not rows:
            return PublicListingListResponse(items=[], total=0)

        property_ids = [r["id"] for r in rows]
        # Verfügbarkeit für ALLE Objekte in EINER Query (statt pro Objekt) — nur
        # wenn ein Zeitraum gewählt ist; sonst gibt es nichts zu filtern.
        if start and end:
            blocked = self._unavailable_property_ids(property_ids, start, end)
            rows = [r for r in rows if r["id"] not in blocked]
            property_ids = [r["id"] for r in rows]

        # „ab"-Preis für ALLE Objekte gebündelt (statt N×~6 Resolver-Queries):
        # ohne Zeitraum der Basispreis (stabil, eine rate_plans-Query); mit
        # Zeitraum der niedrigste Effektiv-Tagespreis (ein Resolver, je Objekt
        # die bestehende Auflösung — aber ohne pro Objekt neu aufzubauen).
        prices = self._prices_for_listings(property_ids, start, end)

        items = [
            self._to_listing(r, *prices.get(r["id"], (None, "")))
            for r in rows
        ]
        return PublicListingListResponse(items=items, total=len(items))

    def _unavailable_property_ids(
        self, property_ids: list[str], start: date, end: date
    ) -> set[str]:
        """Objekte mit mindestens einem nicht-offenen Tag im Zeitraum — in EINER
        Query für alle Objekte (statt _is_available pro Objekt)."""
        if not property_ids:
            return set()
        rows = (
            self._db()
            .table("availability")
            .select("property_id, status")
            .in_("property_id", property_ids)
            .gte("date", start.isoformat())
            .lt("date", end.isoformat())
            .execute()
        ).data or []
        return {r["property_id"] for r in rows if r.get("status") != "open"}

    def _prices_for_listings(
        self,
        property_ids: list[str],
        start: date | None,
        end: date | None,
    ) -> dict[str, tuple[float | None, str]]:
        """„ab"-Preis + Währung je Objekt, gebündelt (kein N+1).

        Ohne Zeitraum: Basispreis aus dem ältesten Rate-Plan je Objekt in EINER
        Query. Mit Zeitraum: niedrigster Effektiv-Tagespreis je Objekt über den
        gemeinsam genutzten Resolver (Währung weiter aus dem Rate-Plan)."""
        if not property_ids:
            return {}
        base_by_property = self._base_prices(property_ids)
        if not (start and end):
            return base_by_property

        from src.features.pricing.resolver import PricingResolver  # noqa: PLC0415

        resolver = PricingResolver(service_client=self._db())
        out: dict[str, tuple[float | None, str]] = {}
        for pid in property_ids:
            _base, currency = base_by_property.get(pid, (None, ""))
            days = resolver.effective_prices(pid, start, end)
            prices = [d.price for d in days if d.price is not None]
            out[pid] = (min(prices) if prices else None, currency)
        return out

    def _base_prices(
        self, property_ids: list[str]
    ) -> dict[str, tuple[float | None, str]]:
        """Basispreis + Währung je Objekt aus dem ältesten Rate-Plan — EINE Query
        für alle Objekte. Pro Objekt gewinnt der zuerst erstellte Plan."""
        rows = (
            self._db()
            .table("rate_plans")
            .select("property_id, base_price, currency, created_at")
            .in_("property_id", property_ids)
            .order("created_at")
            .execute()
        ).data or []
        out: dict[str, tuple[float | None, str]] = {}
        for r in rows:
            pid = r.get("property_id")
            if pid in out:  # ältester Plan zuerst (order created_at) → behalten
                continue
            out[pid] = (_as_opt_float(r.get("base_price")), r.get("currency") or "")
        return out

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
            # Eigene Buchungsseite bevorzugt den Plattform-Text; sonst der
            # kanonische (OTA-)Text. Kein EUR-/Default-Ersatz, nur Fallback.
            description=r.get("platform_description") or r.get("description"),
            lat=_round_coord(r.get("lat")),
            lng=_round_coord(r.get("lng")),
            price=price,
            nights=nights,
            addons=self._public_addons(listing_id),
        )

    def _public_addons(self, property_id: str) -> list[PublicAddon]:
        """Aktive, für die Buchungsstrecke freigegebene Zusatzleistungen."""
        try:
            rows = (
                self._db()
                .table("property_addons")
                .select(
                    "id, name, description, media, price, basis, mandatory, "
                    "tax_rate, appears_in, active, sort_order"
                )
                .eq("property_id", property_id)
                .eq("active", True)
                .order("sort_order")
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = keine Add-ons
            log.warning("public_addons_unavailable", error=str(exc))
            return []
        out: list[PublicAddon] = []
        for a in rows:
            if "booking_engine" not in (a.get("appears_in") or []):
                continue
            out.append(
                PublicAddon(
                    id=str(a["id"]),
                    name=a.get("name") or {},
                    description=a.get("description") or {},
                    media=list(a.get("media") or []),
                    price=float(a.get("price") or 0),
                    basis=str(a.get("basis") or "per_stay"),
                    mandatory=bool(a.get("mandatory")),
                    tax_rate=(
                        float(a["tax_rate"]) if a.get("tax_rate") is not None else None
                    ),
                )
            )
        return out

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

        # Währung aus dem Objekt (Rate-Plan) — nie hart auf EUR (27 EU-Länder).
        _price, currency = self._price_from(
            req.property_id, req.check_in, req.check_out
        )
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
                    "currency": currency or None,
                }
            )
            .execute()
        ).data
        if not ins:
            raise BookingEngineError("Buchung fehlgeschlagen.", status_code=500)
        row = ins[0]

        # Zusatzleistungen (Upsells) serverseitig bepreisen + anlegen + Task-Trigger.
        if req.addons:
            from src.features.addons.service import purchase_addons  # noqa: PLC0415

            purchase_addons(
                self._db(),
                tenant_id=tenant_id,
                reservation_id=str(row["id"]),
                property_id=req.property_id,
                surface="booking_engine",
                selections=[(a.addon_id, a.qty) for a in req.addons],
                nights=len(nights),
                guests=max(req.guests, 1),
                check_in_iso=req.check_in.isoformat(),
                is_before_checkin=True,
            )

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

        # Loyalty-Aggregate des Gastes (Aufenthalte/Umsatz) neu berechnen.
        if guest_id:
            from src.features.guests.service import (  # noqa: PLC0415
                recompute_guest_aggregates,
            )

            recompute_guest_aggregates(self._db(), tenant_id, str(guest_id))

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

    def _verified_reservation(self, reservation_id: str, email: str) -> dict:
        """Reservierung laden + leichte Verifikation über die Gast-E-Mail.

        Gäste haben keinen Login — die E-Mail der Buchung dient als einfacher
        Besitznachweis fürs Nach-Buchung-Upsell. 404, wenn nicht gefunden/abweicht.
        """
        rows = (
            self._db()
            .table("reservations")
            .select(
                "id, tenant_id, property_id, check_in, check_out, num_guests, "
                "guest_email"
            )
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise BookingEngineError("Reservierung nicht gefunden.", status_code=404)
        res = rows[0]
        if (res.get("guest_email") or "").strip().lower() != email.strip().lower():
            raise BookingEngineError("Reservierung nicht gefunden.", status_code=404)
        return res

    def reservation_addons_view(
        self, reservation_id: str, email: str, *, today: date
    ) -> ReservationAddonsView:
        """Gast-Sicht: noch buchbare guest_portal-Add-ons + bereits gekaufte."""
        res = self._verified_reservation(reservation_id, email)
        check_in = date.fromisoformat(str(res["check_in"]))
        before_checkin = today < check_in

        rows = (
            self._db()
            .table("property_addons")
            .select(
                "id, name, description, media, price, basis, mandatory, "
                "tax_rate, appears_in, available_until"
            )
            .eq("property_id", res["property_id"])
            .eq("active", True)
            .order("sort_order")
            .execute()
        ).data or []
        available: list[PublicAddon] = []
        for a in rows:
            if "guest_portal" not in (a.get("appears_in") or []):
                continue
            if a.get("available_until") == "before_checkin" and not before_checkin:
                continue
            available.append(
                PublicAddon(
                    id=str(a["id"]),
                    name=a.get("name") or {},
                    description=a.get("description") or {},
                    media=list(a.get("media") or []),
                    price=float(a.get("price") or 0),
                    basis=str(a.get("basis") or "per_stay"),
                    mandatory=bool(a.get("mandatory")),
                    tax_rate=(
                        float(a["tax_rate"]) if a.get("tax_rate") is not None else None
                    ),
                )
            )

        bought = (
            self._db()
            .table("reservation_addons")
            .select("id, name, qty, total, status")
            .eq("reservation_id", reservation_id)
            .order("created_at")
            .execute()
        ).data or []
        purchased = [
            PurchasedAddon(
                id=str(b["id"]),
                name=b.get("name") or {},
                qty=int(b.get("qty") or 1),
                total=float(b.get("total") or 0),
                status=str(b.get("status") or "pending"),
            )
            for b in bought
        ]
        return ReservationAddonsView(
            reservation_id=reservation_id,
            available=available,
            purchased=purchased,
        )

    def purchase_post_booking_addons(
        self, reservation_id: str, req: PostBookingAddonRequest, *, today: date
    ) -> ReservationAddonsView:
        """Nachträglicher Add-on-Kauf durch den Gast (Verkaufsfläche guest_portal)."""
        res = self._verified_reservation(reservation_id, str(req.email))
        check_in = date.fromisoformat(str(res["check_in"]))
        check_out = date.fromisoformat(str(res["check_out"]))
        if req.addons:
            from src.features.addons.service import purchase_addons  # noqa: PLC0415

            purchase_addons(
                self._db(),
                tenant_id=str(res["tenant_id"]),
                reservation_id=reservation_id,
                property_id=str(res["property_id"]),
                surface="guest_portal",
                selections=[(a.addon_id, a.qty) for a in req.addons],
                nights=max((check_out - check_in).days, 1),
                guests=int(res.get("num_guests") or 1),
                check_in_iso=check_in.isoformat(),
                is_before_checkin=today < check_in,
            )
        return self.reservation_addons_view(reservation_id, str(req.email), today=today)

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
