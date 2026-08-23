"""Das Schaufenster der Plattform — Suche, Inserat, Verfügbarkeit.

Alles, was ein Gast sieht, BEVOR er bucht: die Marktplatz-Suche (Filter, Umkreis,
Preise, Bewertungen), die Detailseite eines Inserats, die Reiseziel-Vorschläge,
die Sitemap und der Verfügbarkeitskalender. Kein JWT — die Existenz des Objekts
ist die Autorisierung, und gast-sichere Spalten sind hier abschließend
aufgezählt (`_PUBLIC_PROPERTY_COLUMNS`).

Getrennt aus `service.py`, als die Datei die Pylint-Grenze von 1500 Zeilen
erreichte. Geschnitten wurde entlang der Zuständigkeit, nicht nach Zeilenzahl:
„anschauen" und „buchen" teilen nur zwei Helfer (`_db`, `_public_property`), und
genau diese schmale Naht macht den Schnitt tragfähig. Dasselbe Muster wie
`AbsichtMixin` (Zahlung-zuerst-Strecke) — ein Mixin je Aufgabe, EIN Service, der
sie zusammensetzt.
"""
from datetime import date, timedelta
from math import asin, cos, radians, sin, sqrt

from src.core.dates import nights as _nights
from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from .common import _as_opt_int, _assert_span, _pets_allowed
from .errors import BookingEngineError
from .reiseziele import land_treffer, ziele_aus_objekten
from .schemas import (
    PublicAddon,
    PublicAvailabilityResponse,
    PublicDay,
    PublicDestinationListResponse,
    PublicListing,
    PublicListingDetail,
    PublicListingListResponse,
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

# Max. Umkreis der Standortsuche („In der Nähe" in der App). Ohne Obergrenze
# wäre `radius_km` ein Weg, die Marktplatz-Filterung auszuhebeln; fail-closed
# (Wurzel 5/8): darüber 422 statt stiller Deckelung.
_MAX_RADIUS_KM = 500.0


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


def _as_opt_float(value: object) -> float | None:
    """DB-Wert → float oder None (kein erfundener 0-Preis)."""
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None

class SchaufensterMixin:
    """Die lesende Gast-Sicht des Buchungs-Service.

    Die Methoden nutzen `self._db()` und `self._public_property()` aus dem
    Basis-Service — dieselben zwei, die auch das Buchen braucht; alles andere
    steht hier vollständig. Die reinen Funktionen oben im Modul (Entfernung,
    Rundung, Prüfungen) sind ohne Service testbar.
    """

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
        if tenant is not None and property_ids is None:
            # Website-Sichtbarkeit ist die dritte Achse (0159): die EIGENE
            # Kunden-Website zeigt nur Objekte mit listed_on_website=true.
            #
            # Das fehlte, und damit war der Schalter im Baukasten wirkungslos:
            # ein Objekt, das der Betrieb bewusst nicht auf seiner Website haben
            # wollte (nur Booking.com, nur Marktplatz), erschien dort trotzdem.
            # Aufgefallen beim Bau des Objekte-Reiters am 23.08.2026.
            #
            # Der Featured-Block (property_ids) ist davon bewusst ausgenommen:
            # wer ein Objekt namentlich auf seine Seite setzt, hat damit
            # entschieden, dass es dort erscheint — genau wie im
            # Marktplatz-Zweig darunter.
            query = query.eq("listed_on_website", True)
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
            # Dieselbe Website-Achse wie in `list_listings`. Ohne sie schlüge das
            # Suchfeld der Kunden-Website ein Ziel vor, dessen Objekte dort gar
            # nicht erscheinen — genau der Fall, den der Docstring oben
            # ausschließen soll.
            query = query.eq("listed_on_website", True)
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
