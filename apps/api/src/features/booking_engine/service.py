"""Service-Schicht für booking_engine — öffentliche Buchungsstrecke der Plattform.

Liest öffentlich die Verfügbarkeit einer Property und legt Gastbuchungen an.
KEIN JWT: die tenant_id wird aus der Property abgeleitet (Property-Existenz ist
die Autorisierung). Der Buchungskalender (availability) ist die oberste Wahrheit —
jede Buchung prüft Double-Booking (409) und pusht realtime an Channex/OTAs.
"""
from datetime import UTC, date, datetime, timedelta
from math import asin, cos, radians, sin, sqrt

from postgrest.exceptions import APIError
from supabase import Client

from src.core.dates import nights as _nights
from src.core.logging import get_logger
from src.core.sales_channels import (
    PLATFORM,
    availability_block_hits_channel,
    stop_sell_blocks_channel,
)
from src.core.supabase import fetch_all_rows
from src.features.booking_conditions.plan import (
    erste_zahlung,
    kaution,
    kondition_fuer,
    restzahlung_faellig_am,
    storno_regeln,
)
from src.features.guest_blocks.service import GuestBlockService

from .reiseziele import land_treffer, ziele_aus_objekten
from .schemas import (
    GuestContact,
    PostBookingAddonRequest,
    PublicAddon,
    PublicAvailabilityResponse,
    PublicBookingRequest,
    PublicBookingResponse,
    PublicCancellation,
    PublicDay,
    PublicDeposit,
    PublicDestinationListResponse,
    PublicListing,
    PublicListingDetail,
    PublicListingListResponse,
    PublicPaymentPlan,
    PublicQuoteLine,
    PublicQuoteRequest,
    PublicQuoteResponse,
    PublicRefundRule,
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
    "lat, lng, max_guests, amenities, photos, type_attributes, status, "
    "search_engine_indexing"
)

# Max. angezeigte Marktplatz-Treffer je Suche. Deckelt die datierte Preisauflösung
# (je Objekt ein Resolver-Lauf) und die Antwortgröße. Über diesem Wert wird
# getruncated + geloggt (keine stille Begrenzung).
_MAX_LISTING_RESULTS = 200

# Max. Reiseziel-Vorschläge je Anfrage (harte Obergrenze, Wurzel 8): das Suchfeld
# zeigt eine kurze Liste, ein beliebig großes `limit` wäre ein Report-Endpunkt.
_MAX_DESTINATION_RESULTS = 50

# Max. Objekte in der öffentlichen Sitemap. Deckelt den JWT-losen Sitemap-Endpunkt
# (Wurzel 8); Suchmaschinen holen Sitemaps sowieso paginiert, 50k ist das
# Sitemap-Protokoll-Limit — deutlich darunter bleiben.
_MAX_SITEMAP_ENTRIES = 10000

# Max. Datums-Span für öffentliche, JWT-lose Endpunkte. Ohne Obergrenze baut der
# Tag-für-Tag-Loop (_nights) + die datierte Preisauflösung bei z. B. end=9999
# Millionen Objekte pro Request → ein einziger unauth Request kippt den Worker
# (DoS). 730 Tage (2 Jahre) deckt jeden realen Buchungshorizont ab. Fail-closed
# (Wurzel 5): darüber 422 statt stiller Deckelung.
_MAX_SPAN_DAYS = 730

# Max. Umkreis der Standortsuche („In der Nähe" in der App). Ohne Obergrenze
# wäre `radius_km` ein Weg, die Marktplatz-Filterung auszuhebeln; fail-closed
# (Wurzel 5/8): darüber 422 statt stiller Deckelung.
_MAX_RADIUS_KM = 500.0


class BookingEngineError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _assert_span(start: date | None, end: date | None) -> None:
    """[start, end) muss valide und ≤ _MAX_SPAN_DAYS sein. None/None ist erlaubt
    (Endpunkte ohne Datumsfilter). Ein einzelnes gesetztes Datum ohne das andere
    ist unvollständig → 422."""
    if start is None and end is None:
        return
    if start is None or end is None:
        raise BookingEngineError(
            "start und end müssen gemeinsam angegeben werden.", status_code=422
        )
    if end <= start:
        raise BookingEngineError("end muss nach start liegen.", status_code=422)
    if (end - start).days > _MAX_SPAN_DAYS:
        raise BookingEngineError(
            f"Zeitraum zu groß (max. {_MAX_SPAN_DAYS} Tage).", status_code=422
        )




def _assert_near(
    lat: float | None, lng: float | None, radius_km: float | None
) -> None:
    """Standortsuche: lat/lng nur gemeinsam, in gültigen Bereichen, Radius
    innerhalb der Obergrenze. Unvollständig/außerhalb → 422 (fail-closed)."""
    if lat is None and lng is None:
        if radius_km is not None:
            raise BookingEngineError(
                "radius_km braucht lat und lng.", status_code=422
            )
        return
    if lat is None or lng is None:
        raise BookingEngineError(
            "lat und lng müssen gemeinsam angegeben werden.", status_code=422
        )
    if not -90.0 <= lat <= 90.0 or not -180.0 <= lng <= 180.0:
        raise BookingEngineError("lat/lng außerhalb des gültigen Bereichs.", status_code=422)
    if radius_km is not None and (radius_km <= 0 or radius_km > _MAX_RADIUS_KM):
        raise BookingEngineError(
            f"radius_km muss zwischen 0 und {_MAX_RADIUS_KM:.0f} liegen.", status_code=422
        )


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Großkreis-Entfernung in km (Haversine). Genauigkeit reicht für die
    Umkreissuche; die Objekt-Koordinaten sind ohnehin gerundet."""
    radius_erde_km = 6371.0
    p1, p2 = radians(lat1), radians(lat2)
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(p1) * cos(p2) * sin(d_lng / 2) ** 2
    return 2 * radius_erde_km * asin(sqrt(a))


def _round_coord(value: object) -> float | None:
    """Koordinate auf ~2 Nachkommastellen runden (ungefähre Lage, nie exakt)."""
    if value is None:
        return None
    try:
        return round(float(value), 2)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


# Haustier-Regel eines Objekts. Zwei Quellen, in dieser Reihenfolge:
# 1. die strukturierte Hotel-Policy (`policies.hotelPolicy.petsPolicy`), die auch
#    an die Portale geht — sie ist die ausdrückliche Angabe des Betriebs;
# 2. die Ausstattungsmerkmale, wenn keine Policy gepflegt ist.
# Ohne beides gilt NEIN (fail-closed, Wurzel 5): lieber bietet die Oberfläche die
# Tierauswahl nicht an, als dass ein Gast mit Hund anreist, wo keiner erlaubt ist.
_PETS_JA = frozenset({"pets_allowed", "pet_friendly", "nd_pets_on_request"})
_PETS_NEIN = frozenset({"nd_pets_not_allowed"})


def _pets_allowed(prop: dict) -> bool:
    """Sind Haustiere in diesem Objekt erlaubt?"""
    policies = (prop.get("type_attributes") or {}).get("policies") or {}
    policy = ((policies.get("hotelPolicy") or {}).get("petsPolicy") or "").strip()
    if policy:
        return policy != "not_allowed"
    amenities = {str(a) for a in (prop.get("amenities") or [])}
    if amenities & _PETS_NEIN:
        return False
    return bool(amenities & _PETS_JA)


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
        property_ids: list[str] | None = None,
        lat: float | None = None,
        lng: float | None = None,
        radius_km: float | None = None,
    ) -> PublicListingListResponse:
        """Öffentliche Liste buchbarer Objekte. STRIKT status='active' — draft/
        inactive erscheinen NIE. Default tenant-übergreifend (zentraler Marktplatz);
        mit `tenant` auf einen Mandanten gefiltert (White-Label-Seiten).
        `property_ids` schränkt auf konkrete Objekte ein (Featured-Block).

        Bei gesetztem start/end fließt die Verfügbarkeit ein (belegte Objekte
        fallen raus) und `price_from` ist der Effektivpreis des Zeitraums. `q`
        filtert über Titel/Ort, `guests` über die Kapazität. Mit `lat`/`lng`
        (+ optionalem `radius_km`) wird nach Entfernung gefiltert und sortiert
        („In der Nähe" der App) — Objekte ohne Koordinaten fallen dabei raus,
        statt mit einer geratenen Position zu erscheinen (Wurzel 4).
        """
        _assert_span(start, end)
        _assert_near(lat, lng, radius_km)
        # Leere property_ids-Liste = bewusst „keine Objekte" (nicht „alle"): der
        # Featured-Block ohne Auswahl darf nicht versehentlich alles rendern.
        if property_ids is not None and not property_ids:
            return PublicListingListResponse(items=[], total=0)
        query = (
            self._db()
            .table("properties")
            .select(_PUBLIC_PROPERTY_COLUMNS)
            .eq("status", "active")
        )
        # Marktplatz-Sichtbarkeit ist ein eigener Kanal (0159): der zentrale
        # myBestDays-Marktplatz (tenant=None) zeigt NUR Objekte mit
        # listed_on_marketplace=true — getrennt von der OTA-Distribution
        # (status='active' allein reicht nicht mehr). White-Label-Agentur-Seiten
        # (tenant gesetzt) und der explizite Featured-Block (property_ids) sind
        # EIGENE Flächen; sie kuratieren über tenant/property_ids und werden vom
        # Marktplatz-Flag NICHT gefiltert.
        if tenant is None and property_ids is None:
            query = query.eq("listed_on_marketplace", True)
            # Freigabe des Betreibers (0203): auf dem EIGENEN Marktplatz tritt
            # myBestDays als Anbieter auf, darum erscheint ein Objekt dort erst
            # nach Prüfung. OTA/Website sind davon bewusst NICHT betroffen —
            # deshalb steht diese Bedingung nur in diesem Zweig.
            query = query.eq("moderation_status", "approved")
            # Betriebs-Sperre (0405): der gesperrte Betrieb fällt komplett vom
            # Marktplatz. Nur auf dem zentralen Marktplatz — die White-Label-
            # Seite eines Betriebs ist SEINE Fläche; wer dort landet, hat den
            # Betrieb bereits direkt angesteuert.
            gesperrt = self._gesperrte_betriebe()
            if gesperrt:
                query = query.not_.in_("tenant_id", gesperrt)
        if tenant:
            query = query.eq("tenant_id", tenant)
        if property_ids:
            query = query.in_("id", property_ids)
        if guests:
            query = query.gte("max_guests", guests)
        # VOLLSTÄNDIG paginiert (fetch_all_rows) statt einer ungelimitierten Query:
        # auf dem zentralen Marktplatz (tenant=None) greift sonst der stille
        # PostgREST-1000-Cap und die Python-Filterung (q/Verfügbarkeit) liefe nur auf
        # den ersten 1000 alphabetischen Objekten → aktive, verfügbare Objekte hinter
        # Position 1000 tauchten in Suche/Grid nie auf.
        rows = fetch_all_rows(query.order("title"))

        if q:
            needle = q.strip().lower()
            # `properties.country` ist ein ISO-2-Code („DK"), der Gast tippt aber
            # den Landesnamen („Dänemark"). Ohne diese Auflösung fand die Suche
            # nach dem Land NIE etwas — ein Teilstring-Vergleich gegen „dk" trifft
            # keinen Ländernamen. Dieselbe Auflösung wie die Reiseziel-Vorschläge
            # (EIN Helfer, damit Liste und Vorschläge nicht auseinanderlaufen).
            laender = land_treffer(needle)
            rows = [
                r
                for r in rows
                if needle in (r.get("title") or "").lower()
                or needle in (r.get("city") or "").lower()
                or (r.get("country") or "").upper() in laender
            ]

        # Standortsuche: nach Entfernung filtern UND sortieren. Objekte ohne
        # Koordinaten fallen raus — eine geratene Position wäre eine Falschaussage
        # (Wurzel 4). Sortierung ersetzt hier bewusst die Titel-Sortierung.
        if lat is not None and lng is not None:
            with_distance: list[tuple[float, dict]] = []
            for r in rows:
                r_lat, r_lng = _round_coord(r.get("lat")), _round_coord(r.get("lng"))
                if r_lat is None or r_lng is None:
                    continue
                km = _distance_km(lat, lng, r_lat, r_lng)
                if radius_km is not None and km > radius_km:
                    continue
                with_distance.append((km, r))
            with_distance.sort(key=lambda paar: paar[0])
            rows = [r for _, r in with_distance]

        if not rows:
            return PublicListingListResponse(items=[], total=0)

        property_ids = [r["id"] for r in rows]
        # Verfügbarkeit für ALLE Objekte in EINER Query (statt pro Objekt) — nur
        # wenn ein Zeitraum gewählt ist; sonst gibt es nichts zu filtern.
        if start and end:
            blocked = self._unavailable_property_ids(property_ids, start, end)
            rows = [r for r in rows if r["id"] not in blocked]

        # Ergebnis-Deckel VOR der teuren Preisauflösung: die datierte Preisauflösung
        # (mit Zeitraum) läuft je Objekt über den Resolver (mehrere Queries) — ohne
        # Deckel wäre das ein N+1 über hunderte Marktplatz-Objekte. Der Deckel wird
        # bewusst geloggt, damit die Begrenzung sichtbar bleibt (keine stille
        # Truncation). Für White-Label-Seiten (tenant gesetzt, wenige Objekte) greift
        # er praktisch nie.
        if len(rows) > _MAX_LISTING_RESULTS:
            log.info(
                "listings_truncated",
                total_matched=len(rows), shown=_MAX_LISTING_RESULTS,
                dated=bool(start and end),
            )
            rows = rows[:_MAX_LISTING_RESULTS]
        property_ids = [r["id"] for r in rows]

        # „ab"-Preis für ALLE Objekte gebündelt (statt N×~6 Resolver-Queries):
        # ohne Zeitraum der Basispreis (stabil, eine rate_plans-Query); mit
        # Zeitraum der niedrigste Effektiv-Tagespreis (ein Resolver, je Objekt
        # die bestehende Auflösung — aber ohne pro Objekt neu aufzubauen).
        prices = self._prices_for_listings(property_ids, start, end)
        ratings = self._ratings_for_listings(property_ids)

        items = [
            self._to_listing(
                r, *prices.get(r["id"], (None, "")), rating=ratings.get(r["id"])
            )
            for r in rows
        ]
        return PublicListingListResponse(items=items, total=len(items))

    # -- Reiseziele (Vorschläge des Suchfelds) --------------------------------
    def list_destinations(
        self,
        *,
        q: str | None = None,
        tenant: str | None = None,
        limit: int = 8,
    ) -> PublicDestinationListResponse:
        """Echte Reiseziele aus dem Bestand: Städte und Länder, in denen buchbare
        Objekte liegen, nach Anzahl sortiert.

        Ersetzt die hartkodierte Vorschlagsliste im Suchfeld. Dieselben
        Sichtbarkeitsregeln wie ``list_listings`` (active + Marktplatz-Flag +
        Moderation beim zentralen Marktplatz), damit kein Ziel vorgeschlagen wird,
        das die Suche danach leer lässt. Die Aggregation selbst steht in
        ``reiseziele`` (inkl. Landesnamen-Auflösung und Motiv-Wahl)."""
        if limit < 1 or limit > _MAX_DESTINATION_RESULTS:
            raise BookingEngineError(
                f"limit muss zwischen 1 und {_MAX_DESTINATION_RESULTS} liegen",
                status_code=422,
            )
        query = (
            self._db()
            .table("properties")
            .select("city, country, property_type, lat, lng")
            .eq("status", "active")
        )
        if tenant is None:
            query = query.eq("listed_on_marketplace", True)
            query = query.eq("moderation_status", "approved")
            # Betriebs-Sperre (0405) — wie in list_listings, sonst schlüge das
            # Suchfeld ein Ziel vor, dessen Objekte die Suche danach ausblendet.
            gesperrt = self._gesperrte_betriebe()
            if gesperrt:
                query = query.not_.in_("tenant_id", gesperrt)
        else:
            query = query.eq("tenant_id", tenant)
        rows = fetch_all_rows(query.order("city"))
        return PublicDestinationListResponse(
            items=ziele_aus_objekten(rows, q=q, limit=limit)
        )

    def _gesperrte_betriebe(self) -> list[str]:
        """IDs plattformseitig gesperrter Betriebe (0405).

        Ein gesperrter Betrieb verschwindet vom Marktplatz — sonst bliebe er
        dort buchbar, obwohl niemand mehr auf die Buchung reagieren kann
        (seine Nutzer kommen nicht mehr rein, aktiv_gate). Der Filter sitzt
        hier und NICHT auf `properties`, damit die Objekte des Betriebs
        unverändert bleiben: nach dem Entsperren steht wieder genau der
        Zustand, den der Betrieb selbst gesetzt hatte.

        PostgREST kann den Betrieb nicht joinen, deshalb zwei Abfragen. Die
        Liste ist im Normalfall leer und der Index (0405) partiell — der
        Aufwand fällt praktisch nur an, wenn wirklich Betriebe gesperrt sind.
        """
        res = (
            self._db()
            .table("tenants")
            .select("id")
            .not_.is_("deactivated_at", "null")
            .execute()
        )
        return [str(r["id"]) for r in (res.data or []) if r.get("id")]

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
        _assert_span(start, end)
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
        base = self._to_listing(
            r, price, currency,
            rating=self._ratings_for_listings([listing_id]).get(listing_id),
        )
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
            # Steuert das robots-noindex-Meta auf der öffentlichen Inserat-Seite
            # (Airbnb-Mechanik). Default false = nicht indexierbar.
            search_engine_indexing=bool(r.get("search_engine_indexing")),
        )

    def sitemap_entries(self) -> list[dict]:
        """Aktive UND suchmaschinen-indexierbare Objekte (id + updated_at) für die
        Sitemap. Nur diese Objekte dürfen in der Sitemap stehen — noindex-Objekte
        (search_engine_indexing=false) tauchen gar nicht erst auf. Gedeckelt auf
        _MAX_SITEMAP_ENTRIES (DoS-Schutz für den JWT-losen Endpunkt, Wurzel 8)."""
        rows = (
            self._db()
            .table("properties")
            .select("id, updated_at")
            .eq("status", "active")
            .eq("search_engine_indexing", True)
            .order("updated_at", desc=True)
            .limit(_MAX_SITEMAP_ENTRIES)
            .execute()
        ).data or []
        return [
            {"id": str(r["id"]), "updated_at": r.get("updated_at")} for r in rows
        ]

    def _bookable_addon_selections(
        self, property_id: str, selections: list[tuple[str, int]]
    ) -> list[tuple[str, int]]:
        """Die vom Gast gewählten Add-ons auf die für die BUCHUNGSSTRECKE
        freigegebenen filtern (appears_in enthält 'booking_engine' + aktiv). So
        bepreist der Quote (total_amount/Stripe) GENAU die Add-ons, die
        purchase_addons danach auch als reservation_addons anlegt — sonst würde ein
        nur-guest_portal-Add-on kassiert, aber nie angelegt/erfüllt (Geldschaden)."""
        if not selections:
            return []
        ids = [aid for aid, _ in selections]
        rows = (
            self._db()
            .table("property_addons")
            .select("id, appears_in")
            .eq("property_id", property_id)
            .eq("active", True)
            .in_("id", ids)
            .execute()
        ).data or []
        allowed = {
            str(a["id"]) for a in rows
            if "booking_engine" in (a.get("appears_in") or [])
        }
        return [(aid, qty) for aid, qty in selections if aid in allowed]

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
        r: dict,
        price_from: float | None,
        currency: str,
        rating: tuple[float, int] | None = None,
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
            pets_allowed=_pets_allowed(r),
            price_from=price_from,
            currency=currency,
            # Ohne Bewertung bleibt beides None — die Oberfläche zeigt dann gar
            # keine Sterne, statt eine 0,0 zu erfinden (Wurzel 4).
            rating=rating[0] if rating else None,
            rating_count=rating[1] if rating else None,
        )

    def _ratings_for_listings(
        self, property_ids: list[str]
    ) -> dict[str, tuple[float, int]]:
        """Durchschnitt + Anzahl VERÖFFENTLICHTER Bewertungen je Objekt — in
        EINER Abfrage für die ganze Trefferliste. Objekte ohne Bewertung fehlen
        im Ergebnis."""
        from src.features.guest_reviews.service import GuestReviewsService

        return GuestReviewsService(
            service_client=self._db()
        ).property_aggregates(property_ids)

    def _property_tenant(self, property_id: str) -> str | None:
        """tenant_id einer ÖFFENTLICHEN Property. Nur 'active' ist öffentlich
        buchbar/abrufbar — draft/inactive geben None zurück (→ 404), damit ein
        noch nicht veröffentlichtes oder deaktiviertes Objekt nicht über die
        geratene UUID direkt gebucht werden kann (der Docstring galt bisher nur
        auf dem Papier — status wurde nicht geprüft)."""
        row = self._public_property(property_id)
        return row["tenant_id"] if row else None

    def _public_property(self, property_id: str) -> dict | None:
        """tenant_id + max_guests einer ÖFFENTLICHEN (active) Property, oder None.
        Nur 'active' ist öffentlich buchbar — draft/inactive → None (→ 404)."""
        res = (
            self._db()
            .table("properties")
            .select("tenant_id, status, max_guests, booking_mode")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        if not res or res[0].get("status") != "active":
            return None
        return res[0]

    def public_availability(
        self, property_id: str, start: date, end: date
    ) -> PublicAvailabilityResponse:
        """Öffentliche Tagesverfügbarkeit [start, end). Nur buchbar/nicht — keine
        Tenant-/Buchungsdaten. Fehlende Tage gelten als frei."""
        _assert_span(start, end)
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

    def _pets_property(self, property_id: str) -> dict | None:
        """Objektzeile für Kapazität + Haustierregel (nur öffentliche Objekte)."""
        res = (
            self._db()
            .table("properties")
            .select("tenant_id, status, max_guests, amenities, type_attributes")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        if not res or res[0].get("status") != "active":
            return None
        return res[0]

    def public_quote(self, req: PublicQuoteRequest) -> PublicQuoteResponse:
        """Preisaufschlüsselung für die Gast-Buchungsstrecke.

        Rechnet mit DENSELBEN Größen wie `create_public_booking` (gleicher
        Kanal, gleiche Add-on-Auswahl) — sonst zeigte das Widget einen Preis und
        die Buchung berechnete einen anderen. Der Gast bekommt Bezeichnung und
        Betrag je Zeile, keine internen Kennungen.
        """
        _assert_span(req.check_in, req.check_out)
        prop = self._pets_property(req.property_id)
        if prop is None:
            raise BookingEngineError("Objekt nicht gefunden.", status_code=404)

        max_guests = _as_opt_int(prop.get("max_guests")) or 1
        if req.guests > max_guests:
            raise BookingEngineError(
                "Die Gästezahl übersteigt die Kapazität des Objekts.",
                status_code=422,
            )
        pets_allowed = _pets_allowed(prop)
        if req.pets > 0 and not pets_allowed:
            raise BookingEngineError(
                "Für dieses Objekt sind keine Haustiere erlaubt.", status_code=422
            )

        # Lokal importiert wie in den anderen Preis-Pfaden dieses Slices.
        from src.features.pricing.resolver import PricingResolver  # noqa: PLC0415
        from src.features.pricing.schemas import (  # noqa: PLC0415
            AddonSelection,
            QuoteRequest,
        )

        bookable_addons = self._bookable_addon_selections(
            req.property_id, [(a.addon_id, a.qty) for a in (req.addons or [])]
        )
        quote = PricingResolver(service_client=self._db()).quote(
            QuoteRequest(
                property_id=req.property_id,
                check_in=req.check_in,
                check_out=req.check_out,
                guests=max(req.guests, 1),
                pets=max(req.pets, 0),
                # Wie in create_public_booking: derselbe Kanal, sonst wiche ein
                # Kanal-Markup zwischen Anzeige und Buchung ab.
                channel="direct",
                # Angebotscode des Gastes: NUR ein Filter auf die Aktionen des
                # Objekts. Der Rabatt wird serverseitig gerechnet; ein Betrag aus
                # dem Client wird nie übernommen (Wurzel 3).
                promo_code=req.promo_code,
                addons=[
                    AddonSelection(addon_id=aid, qty=qty)
                    for aid, qty in bookable_addons
                ],
            )
        )
        plan, storno, deposit = self._konditionen_fuer_gast(
            tenant_id=str(prop["tenant_id"]),
            total=quote.total,
            check_in=req.check_in,
            priceless=quote.priceless,
        )
        return PublicQuoteResponse(
            property_id=req.property_id,
            nights=len(_nights(req.check_in, req.check_out)),
            currency=quote.currency,
            lines=[
                PublicQuoteLine(label=line.label, amount=line.amount, kind=line.kind)
                for line in quote.lines
            ],
            total=quote.total,
            promo_code_applied=quote.promo_code_applied,
            priceless=quote.priceless,
            pets_allowed=pets_allowed,
            max_guests=max_guests,
            payment_plan=plan,
            cancellation=storno,
            deposit=deposit,
        )

    def _konditionen_fuer_gast(
        self, *, tenant_id: str, total: float, check_in: date, priceless: bool
    ) -> tuple[PublicPaymentPlan | None, PublicCancellation | None, PublicDeposit | None]:
        """Zahlungsplan, Storno-Staffel und Kaution für den Checkout.

        Quelle ist `booking_conditions` über den geteilten Helfer
        `booking_conditions.plan` — dieselbe Rechnung, die `payments` beim Einzug
        anwendet. Ohne gepflegte Kondition kommt überall None zurück: der
        Checkout zeigt dann „vollständig jetzt" und KEINE Storno-Zusage, statt
        eine zu erfinden (Wurzel 4).

        Rate-Plan: der Gast-Quote kennt keinen (FeWo hat genau einen, Hotel wählt
        ihn erst in der Buchung) → es gilt die Standard-Kondition des Betriebs,
        genau wie im Zahlungspfad für eine Buchung ohne `rate_plan_id`.
        """
        if priceless:
            return None, None, None
        db = self._db()
        condition = kondition_fuer(db, tenant_id=tenant_id)
        if condition is None:
            return None, None, None
        jetzt = erste_zahlung(condition, total)
        rest = round(total - jetzt, 2)
        plan = PublicPaymentPlan(
            installments=int(condition.get("installments") or 1),
            due_now=jetzt,
            due_later=max(rest, 0.0),
            balance_due_date=(
                restzahlung_faellig_am(condition, check_in) if rest > 0 else None
            ),
        )
        regeln = storno_regeln(db, str(condition["id"]))
        storno = PublicCancellation(
            mode=condition.get("cancellation_mode"),
            rules=[PublicRefundRule(**r) for r in regeln],
        )
        kaution_daten = kaution(condition, total)
        return (
            plan,
            storno,
            PublicDeposit(**kaution_daten) if kaution_daten else None,
        )

    def create_public_booking(
        self, req: PublicBookingRequest
    ) -> PublicBookingResponse:
        """Gastbuchung über die eigene Plattform. Double-Booking-Schutz (409),
        belegt den Kalender und sperrt realtime an Channex/OTAs."""
        prop = self._public_property(req.property_id)
        if prop is None:
            raise BookingEngineError("Objekt nicht gefunden.", status_code=404)
        tenant_id = prop["tenant_id"]

        # Airbnb-Block: ein vom Betrieb blockierter Gast kann dessen Objekte nicht
        # mehr buchen (E-Mail-Match auf portal_guests). Buchen ist IMMER gesperrt —
        # keine Trip-Ausnahme (Artikel 4046).
        if GuestBlockService(self._db()).is_email_blocked_for_booking(
            tenant_id, req.contact.email
        ):
            raise BookingEngineError(
                "Eine Buchung ist für dieses Konto nicht möglich.",
                status_code=403,
            )

        # Aufenthaltslänge deckeln (Wurzel 8) — dieser Endpunkt ist öffentlich
        # und ohne JWT erreichbar. Das Schema prüft nur `check_out > check_in`:
        # ein einziger Request mit `check_out=9999-12-31` baut Millionen
        # Tagesobjekte, jagt den Preis-Resolver über den ganzen Zeitraum und
        # lässt die Buchungs-RPC ebenso viele availability-Zeilen je Einheit
        # schreiben. Quote, Verfügbarkeit und Listings desselben Slices sind
        # längst gedeckelt — nur die Buchung selbst war es nicht.
        _assert_span(req.check_in, req.check_out)

        # Vergangene Anreise ablehnen: für Tage vor heute existieren keine
        # availability-Zeilen → der Double-Booking-Check unten griffe nicht.
        # Das Schema prüft nur check_out > check_in, nicht die Gegenwart.
        if req.check_in < date.today():
            raise BookingEngineError(
                "Das Anreisedatum liegt in der Vergangenheit.", status_code=422
            )

        # Überbelegung ablehnen: der Resolver bepreist Zusatzgäste zwar, lehnt
        # aber nie ab. max_guests ist die harte Kapazitätsgrenze des Objekts.
        max_guests = _as_opt_int(prop.get("max_guests"))
        if max_guests is not None and req.guests > max_guests:
            raise BookingEngineError(
                "Die Gästezahl übersteigt die Kapazität des Objekts.",
                status_code=422,
            )

        # Tiere nur, wo sie erlaubt sind — serverseitig, nicht nur im Widget
        # (Wurzel 3). `_public_property` liest die dafür nötigen Spalten nicht,
        # also hier gezielt nachladen statt raten.
        if req.pets > 0:
            pets_row = self._pets_property(req.property_id)
            if pets_row is None or not _pets_allowed(pets_row):
                raise BookingEngineError(
                    "Für dieses Objekt sind keine Haustiere erlaubt.",
                    status_code=422,
                )

        nights = _nights(req.check_in, req.check_out)

        # Double-Booking-Schutz: kein Tag darf belegt/gesperrt sein. Kanal-Trennung:
        # eine availability-Sperre mit source='portal' (Channex-Import) betrifft nur
        # OTAs — die eigene Plattform darf trotzdem buchen. Echte Belegung/manuelle
        # Sperre blockt weiter (Überbuchungsschutz).
        avail = (
            self._db()
            .table("availability")
            .select("date,status,source")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        ).data or []
        taken = [
            r["date"]
            for r in avail
            if r["status"] != "open"
            and availability_block_hits_channel(r.get("source"), PLATFORM)
        ]
        if taken:
            raise BookingEngineError(
                "Zeitraum ist nicht mehr verfügbar.", status_code=409
            )
        # Stop-Sell-Schutz: ein Stop-Sell sperrt die eigene Plattform nur, wenn er
        # den Plattform-Kanal betrifft (scope='all' oder 'platform' im channels-Set).
        # Ein reiner OTA-Stop lässt die eigene Plattform durch. Explizit gegen die
        # stop_sell-Tabelle prüfen — availability kann durch Sync-Verzug divergieren.
        # scope/channels MITLESEN, sonst greift der Kanal-Filter nie. Plan-genaue
        # Hotel-Stops (rate_plan_id gesetzt) blocken hier MIT: die öffentliche
        # Buchung wählt (noch) keinen Rate-Plan — im Zweifel fail-closed sperren
        # (Wurzel 5: lieber zu viel gesperrt als eine gestoppte Rate verkauft).
        stopped_rows = (
            self._db()
            .table("stop_sell")
            .select("date,scope,channels")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        ).data or []
        if any(stop_sell_blocks_channel(r, PLATFORM) for r in stopped_rows):
            raise BookingEngineError(
                "Zeitraum ist nicht mehr verfügbar.", status_code=409
            )

        guest_id = self._upsert_guest(tenant_id, req.contact)

        # Preis SERVERSEITIG über den zentralen Resolver bestimmen — der Gast darf
        # den Betrag NICHT selbst setzen (req.total_amount wird ignoriert, sonst
        # ließe sich eine 0-€-/Fantasiepreis-Buchung anlegen). Anders als die
        # interne reservations.create gibt es hier keinen Mitarbeiter-Override.
        from src.features.pricing.resolver import PricingResolver  # noqa: PLC0415
        from src.features.pricing.schemas import (  # noqa: PLC0415
            AddonSelection,
            QuoteRequest,
        )

        # Die gewählten Addons MÜSSEN in den Quote — sonst enthält total_amount nur
        # die Unterkunft und der spätere Stripe-PaymentIntent (payments.service liest
        # ausschließlich reservations.total_amount) kassiert die Zusatzleistungen nie.
        # Nur die für die BUCHUNGSSTRECKE freigegebenen Add-ons einpreisen (gleiche
        # Auswahl wie purchase_addons unten) — sonst zahlt der Gast für ein Add-on,
        # das nie als reservation_addons angelegt/erfüllt wird.
        bookable_addons = self._bookable_addon_selections(
            req.property_id, [(a.addon_id, a.qty) for a in (req.addons or [])]
        )
        quote = PricingResolver(service_client=self._db()).quote(
            QuoteRequest(
                property_id=req.property_id,
                check_in=req.check_in,
                check_out=req.check_out,
                guests=max(req.guests, 1),
                pets=max(req.pets, 0),
                channel="direct",
                # DERSELBE Code wie im Quote — ohne ihn zahlte der Gast den
                # Preis ohne seinen Rabatt, obwohl die Strecke ihn angezeigt hat.
                promo_code=req.promo_code,
                addons=[
                    AddonSelection(addon_id=aid, qty=qty)
                    for aid, qty in bookable_addons
                ],
            )
        )
        # Kein Verkauf unter Preis (Wurzel 4). Nächte ohne hinterlegten Preis
        # werden im Quote übersprungen — `total` deckt dann nur die bepreisten
        # ab. Ohne diese Prüfung bucht der Gast sieben Nächte und zahlt drei,
        # bei komplett fehlenden Preisen entsteht eine 0-€-Buchung. `priceless`
        # allein genügt nicht: es meldet nur den Totalausfall.
        if quote.priceless or quote.unpriced_nights > 0:
            raise BookingEngineError(
                "Für diesen Zeitraum ist kein vollständiger Preis hinterlegt.",
                status_code=422,
            )
        total_amount = quote.total
        currency = quote.currency
        # quote_items als Snapshot für die Check-out-Rechnung persistieren — aber
        # OHNE die Add-on-Zeilen (kind='addon'): die Add-ons werden beim Check-out
        # separat aus reservation_addons fakturiert. Lägen sie zusätzlich in
        # quote_items, würde build_positions sie DOPPELT fakturieren (einmal in der
        # Aufenthalts-Aufschlüsselung, einmal als Add-on-Position). items_sum deckt
        # dann die Unterkunft ab; die Prüfung breakdown_matches zieht die Add-on-
        # Summe hinzu (reservation_invoice), sodass total_amount konsistent bleibt.
        quote_items = [
            {
                "label": line.label,
                "amount": line.amount,
                "kind": line.kind,
                "tax_rate": line.tax_rate,
            }
            for line in quote.lines
            if line.kind != "addon"
        ]
        # Airbnb-Modell: instant = Sofortbuchung (status=confirmed, sperrt OTAs),
        # request = Anfrage (status=requested, belegt lokal den Slot atomar, aber
        # KEIN OTA-0-Push — die Nacht bleibt für OTAs verkäuflich, bis der Host
        # zusagt). DB-NOT-NULL-Default 'instant' garantiert den Wert (kein Fallback).
        is_request = prop.get("booking_mode") == "request"
        reservation_status = "requested" if is_request else "confirmed"
        # 24-h-Frist ab jetzt (Airbnb-Standard). Nur bei Anfrage; instant → NULL.
        request_expires_at = (
            (datetime.now(UTC) + timedelta(hours=24)).isoformat()
            if is_request
            else None
        )

        # Reservierung + Kalender-Belegung + ari_outbox ATOMAR (RPC 0104):
        # Advisory-Lock je Objekt schließt das TOCTOU-Fenster zwischen dem Check
        # oben und dem Write — zwei gleichzeitige Gäste bekommen nie dieselbe
        # Nacht. Der EXCLUDE-Constraint reservations_no_local_overlap ist der
        # DB-Backstop. Die ari_outbox-Zeile (availability=0) entsteht in
        # derselben Transaktion → der Channex-Push geht nie verloren. Bei Anfrage
        # KEINE outbox-Zeile (p_with_outbox=False): der 0-Push kommt erst bei accept.
        try:
            ins = (
                self._db()
                .rpc(
                    "create_reservation_atomic",
                    {
                        "p_reservation": {
                            "tenant_id": tenant_id,
                            "property_id": req.property_id,
                            "guest_id": guest_id,
                            # E-Mail/Telefon denormalisiert MITSCHREIBEN (wie der
                            # interne Pfad): _verified_reservation prüft den Post-
                            # Booking-Upsell über reservations.guest_email — ohne
                            # diese Felder schlägt die Verifikation immer mit 404
                            # fehl und der Upsell der eigenen Plattform ist tot.
                            "guest_email": req.contact.email or None,
                            "guest_phone": req.contact.phone or None,
                            # Unser Marktplatz ist ein EIGENER Kanal, nicht
                            # "direct". Die Preisliste unterscheidet genau hier:
                            # eigenes myBestDays-Portal = 8 % all-in, während
                            # Direktbuchungen über die Website des Betriebs
                            # provisionsfrei sind ("provisionsfreie
                            # Direktbuchungen zusätzlich", Preisliste §5).
                            # Mit "direct" entginge uns die Provision.
                            "channel": "portal",
                            "ota_name": "myBestDays",  # Herkunft für Kalender/Posteingang
                            "check_in": req.check_in.isoformat(),
                            "check_out": req.check_out.isoformat(),
                            # Gästezahl MITSCHREIBEN: sie floss bisher nur in den
                            # Quote ein, sodass jede Portal-Buchung mit dem
                            # Spalten-Default 1 in reservations landete — Gast-App,
                            # Kalender und Kurtaxe sahen dadurch eine falsche
                            # Belegung. Kapazität ist oben bereits gegen max_guests
                            # geprüft.
                            "num_guests": max(req.guests, 1),
                            # Wie num_guests: die Zahl ist bepreist worden und
                            # muss an der Buchung stehen, sonst rechnet jedes
                            # spätere Neurechnen sie weg (Wurzel 1).
                            "pets": max(req.pets, 0),
                            "status": reservation_status,
                            "request_expires_at": request_expires_at,
                            "total_amount": total_amount,
                            "quote_items": quote_items,
                            "currency": currency or None,
                        },
                        "p_source": "direct",
                        # Anfrage: keine ari_outbox-Zeile → kein OTA-0-Push vor accept.
                        "p_with_outbox": not is_request,
                    },
                )
                .execute()
            ).data
        except APIError as exc:
            if exc.code in ("RS409", "23P01"):
                raise BookingEngineError(
                    "Zeitraum ist nicht mehr verfügbar.", status_code=409
                ) from exc
            raise
        row = (ins or {}).get("reservation")
        if not row:
            raise BookingEngineError("Buchung fehlgeschlagen.", status_code=500)
        outbox_id = (ins or {}).get("outbox_id")

        # Zusatzleistungen (Upsells) als reservation_addons anlegen (Erfüllung/
        # Anzeige). Der Zahlbetrag steckt bereits im total_amount (Quote oben mit
        # addons). Die Reservierung ist an dieser Stelle schon verbindlich committet
        # (atomare RPC) — ein Addon-Insert-Fehler darf sie deshalb NICHT mehr mit
        # 500 kippen (sonst existiert die Buchung, der Gast sieht aber einen Fehler
        # und ein Retry läuft in einen 409 gegen die eigene Buchung). Best-effort.
        if bookable_addons:
            from src.features.addons.service import purchase_addons  # noqa: PLC0415

            try:
                # Dieselbe gefilterte Auswahl wie im Quote → der kassierte Betrag
                # (total_amount) und die angelegten reservation_addons stimmen überein.
                purchase_addons(
                    self._db(),
                    tenant_id=tenant_id,
                    reservation_id=str(row["id"]),
                    property_id=req.property_id,
                    surface="booking_engine",
                    selections=bookable_addons,
                    nights=len(nights),
                    guests=max(req.guests, 1),
                    check_in_iso=req.check_in.isoformat(),
                    is_before_checkin=True,
                )
            except Exception as exc:  # noqa: BLE001 — Buchung ist schon committet
                log.error(
                    "public_booking_addons_failed",
                    tenant_id=tenant_id,
                    reservation_id=str(row["id"]),
                    error=str(exc),
                )

        # Kalender-Belegung ist bereits Teil der atomaren RPC (oben).
        # Realtime an Channex/OTAs sperren (availability=0) — kein OTA-Doppel.
        # NUR bei Sofortbuchung: eine Anfrage sperrt die OTAs noch nicht (der Slot
        # bleibt dort verkäuflich, bis der Host zusagt → dann pusht accept den 0).
        if not is_request:
            self._push_channex(
                tenant_id, req.property_id, req.check_in, req.check_out, 0,
                outbox_id=outbox_id,
            )
        # Dynamic Pricing neu rechnen — eine Plattform-Buchung ändert Auslastung/
        # Orphan-Lücken genauso wie eine interne Buchung (wie reservations.create).
        try:
            from src.jobs.queue import try_enqueue_recompute  # noqa: PLC0415

            try_enqueue_recompute(self._db(), tenant_id, req.property_id)
        except Exception as exc:  # noqa: BLE001 — darf die Buchung nie kippen
            log.warning("public_booking_recompute_enqueue_failed", error=str(exc))

        # Loyalty-Aggregate des Gastes (Aufenthalte/Umsatz) neu berechnen.
        if guest_id:
            from src.features.guests.service import (  # noqa: PLC0415
                recompute_guest_aggregates,
            )

            recompute_guest_aggregates(self._db(), tenant_id, str(guest_id))

        # Konversation im Posteingang anlegen und die Automails planen.
        # Ohne diesen Schritt erreichte eine Marktplatz-Buchung die
        # Nachrichten-Automationen NIE: die Trigger-Engine plant ausschließlich
        # über Threads, und Threads entstanden bisher nur aus dem Channex-Feed.
        # Eine Regel „Buchungsbestätigung, Kanal myBestDays" lief damit ins
        # Leere — ohne Fehler, ohne Hinweis, obwohl die Oberfläche den Kanal
        # ausdrücklich anbietet. Best effort: die Buchung ist committet und darf
        # an einem Posteingangs-Fehler nicht mehr scheitern.
        self._posteingang_thread_anlegen(
            tenant_id=tenant_id,
            reservation=row,
            property_id=req.property_id,
            check_in=req.check_in.isoformat(),
            check_out=req.check_out.isoformat(),
            guest_id=str(guest_id) if guest_id else None,
            status=reservation_status,
            name=" ".join(
                t for t in (req.contact.first_name, req.contact.last_name) if t
            ).strip(),
        )

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
            status=reservation_status,
            is_request=is_request,
            request_expires_at=request_expires_at,
        )

    def _posteingang_thread_anlegen(
        self, *, tenant_id: str, reservation: dict, property_id: str,
        check_in: str, check_out: str, guest_id: str | None, status: str,
        name: str,
    ) -> None:
        """Marktplatz-Buchung → Konversation im Posteingang + Automails planen.

        Der Posteingang führt seine Konversationen in `channex_booking`. Der
        Name ist historisch (die Tabelle entstand für den Channex-Feed), der
        Inhalt ist es nicht: sie ist der Thread-Speicher für JEDEN Kanal. Eine
        myBestDays-Buchung gehört deshalb ebenso hinein wie eine von Booking.com
        — sonst hat der Gast keine Konversation, der Betrieb sieht ihn nicht im
        Posteingang, und keine einzige Automation greift.

        `channex_booking_id` trägt die ID der Reservierung: die Spalte ist der
        Dedup-Schlüssel (UNIQUE), und für eine Buchung ohne Aggregator ist die
        eigene Reservierungs-ID die stabile Kennung. Der Upsert macht den Aufruf
        wiederholbar (Wurzel 2) — ein Retry legt keine zweite Konversation an.

        `booked_at` ist hier zulässigerweise unsere Uhr: bei einer Buchung auf
        dem EIGENEN Marktplatz sind unser Zeitpunkt und der des Portals
        dasselbe Ereignis — anders als bei einer OTA-Buchung, wo `created_at`
        nur unsere Verarbeitung beschreibt (Wurzel 5b).
        """
        db = self._db()
        try:
            # `reservations.total_amount` ist ein Dezimalbetrag, die Thread-
            # Spalte führt CENT. Ohne Umrechnung stünde im Posteingang das
            # Hundertfache — lieber gar kein Betrag als ein falscher (Wurzel 4).
            betrag = reservation.get("total_amount")
            cents = round(float(betrag) * 100) if betrag is not None else None
            zeile = {
                "tenant_id": tenant_id,
                "channex_booking_id": str(reservation["id"]),
                "property_id": property_id,
                "guest_id": guest_id,
                "ota_name": "myBestDays",
                "status": "cancelled" if status == "cancelled" else "new",
                "arrival_date": check_in,
                "departure_date": check_out,
                "amount_cents": cents,
                "currency": reservation.get("currency"),
                "booked_at": reservation.get("created_at"),
                "customer": {
                    "name": name,
                    "mail": reservation.get("guest_email") or "",
                    "phone": reservation.get("guest_phone") or "",
                },
                "raw": {"source": "booking_engine"},
            }
            upserted = (
                db.table("channex_booking")
                .upsert(zeile, on_conflict="channex_booking_id")
                .execute()
            ).data or []
            if not upserted:
                return
            from src.features.inbox.service import InboxService  # noqa: PLC0415

            InboxService(service_client=db).schedule_automations_for_thread(
                tenant_id, str(upserted[0]["id"])
            )
        except Exception as exc:  # noqa: BLE001 — Buchung ist schon committet
            log.error(
                "public_booking_posteingang_failed",
                tenant_id=tenant_id,
                reservation_id=str(reservation.get("id")),
                error=str(exc),
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
        # An den ZENTRALEN Resolver delegieren (ein Pfad für alle Kanäle) statt
        # einer Eigenimplementierung: der Resolver sucht case-insensitiv per ilike
        # (mixed-case Bestands-E-Mail), sucht per Telefon UND fängt die 23505-
        # Verletzung der Unique-Indizes (0113: lower(email)/phone) ab, indem er den
        # bestehenden Gast nachlädt. Die vorherige Eigen-Logik (.eq case-sensitiv +
        # ungeschützter Insert) crashte bei wiederkehrenden Gästen mit anderer
        # Schreibweise/gleicher Nummer/Race mit 500 gegen die Unique-Indizes.
        from src.features.guests.identity import (  # noqa: PLC0415
            GuestContact as ResolverContact,
        )
        from src.features.guests.identity import (  # noqa: PLC0415
            resolve_or_create_guest,
        )

        return resolve_or_create_guest(
            self._db(),
            tenant_id,
            ResolverContact(
                first_name=contact.first_name,
                last_name=contact.last_name,
                email=str(contact.email),
                phone=contact.phone or None,
                channel="direct",
            ),
        )

    def _push_channex(
        self,
        tenant_id: str,
        property_id: str,
        check_in: date,
        check_out: date,
        availability: int,
        outbox_id: str | None = None,
    ) -> None:
        """Channex-Availability-Push als JOB einreihen (nicht synchron im
        Request-Pfad) — wie alle anderen Buchungs-/Kalenderpfade. Ein langsamer/
        ausgefallener Channex-Call darf die öffentliche Gastbuchung nicht
        blockieren; der Worker arbeitet den Push ab. `outbox_id` = die mit der
        Buchung atomar persistierte ari_outbox-Zeile (RPC 0104) — der Job
        arbeitet sie ab, statt eine zweite anzulegen. Die Outbox ist der
        Backstop, falls das Enqueue scheitert (process_ari_outbox-Tick)."""
        if self._client is None:
            return
        from src.jobs.queue import try_enqueue_ari  # noqa: PLC0415

        fields: dict[str, object] = {
            "date_from": check_in.isoformat(),
            "date_to": (check_out - timedelta(days=1)).isoformat(),  # Abreise exkl.
            "availability": availability,
        }
        if outbox_id:
            fields["outbox_id"] = outbox_id
        try_enqueue_ari(
            self._client, tenant_id, property_id, "availability", fields,
        )
