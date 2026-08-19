"""Tests für den booking_engine-Slice — inkl. öffentliche Listings.

Verifiziert: nur status='active' erscheint, draft/inactive nie; Output enthält
KEINE Tenant-/Eigentümer-Felder; price_from kommt aus dem Pricing-Resolver;
Default tenant-übergreifend, mit tenant-Filter nur dieser Mandant; Detail 404
für nicht-active.
"""
import pytest
from fastapi.testclient import TestClient

from src.features.booking_engine.service import BookingEngineService
from src.main import create_app

client = TestClient(create_app())


def test_booking_engine_health() -> None:
    resp = client.get("/api/v1/booking-engine/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "booking_engine", "status": "ok"}


# --- FakeDB für Listings -----------------------------------------------------

_PROPERTIES = [
    {
        "id": "p-active", "tenant_id": "t1", "title": "Strandhaus", "description": "Schön",
        "property_type": "ferienhaus", "city": "Sylt", "country": "DE",
        "lat": 54.123456, "lng": 8.654321, "max_guests": 6,
        "amenities": ["wifi"], "photos": ["a.jpg"],
        "type_attributes": {"bedrooms": 3, "baths": 2}, "status": "active",
        "listed_on_marketplace": True, "moderation_status": "approved",
    },
    {
        "id": "p-active2", "tenant_id": "t2", "title": "City Loft",
        "description": None, "property_type": "appartement", "city": "Berlin",
        "country": "DE", "lat": None, "lng": None, "max_guests": 2,
        "amenities": [], "photos": [], "type_attributes": {}, "status": "active",
        "listed_on_marketplace": True, "moderation_status": "approved",
    },
    {
        "id": "p-draft", "tenant_id": "t1", "title": "Entwurf", "description": None,
        "property_type": "ferienhaus", "city": "X", "country": "DE", "lat": None,
        "lng": None, "max_guests": 4, "amenities": [], "photos": [],
        "type_attributes": {}, "status": "draft",
        "listed_on_marketplace": True, "moderation_status": "draft",
    },
]


class _Q:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._filters: dict[str, object] = {}
        self._gte: dict[str, object] = {}
        self._in: dict[str, set] = {}
        self._range: tuple[int, int] | None = None

    def select(self, *_a: object, **_k: object) -> "_Q":
        return self

    def range(self, start: int, end: int) -> "_Q":
        self._range = (start, end)
        return self

    def eq(self, col: str, val: object) -> "_Q":
        self._filters[col] = val
        return self

    def in_(self, col: str, vals: object) -> "_Q":
        self._in[col] = set(vals)  # type: ignore[arg-type]
        return self

    def gte(self, col: str, val: object) -> "_Q":
        self._gte[col] = val
        return self

    def lt(self, *_a: object, **_k: object) -> "_Q":
        return self

    def order(self, *_a: object, **_k: object) -> "_Q":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Q":
        return self

    @property
    def not_(self) -> "_Q":
        return self

    def is_(self, *_a: object, **_k: object) -> "_Q":
        return self

    def execute(self) -> object:
        rows = list(self._db.tables.get(self._table, []))
        for col, val in self._filters.items():
            rows = [r for r in rows if r.get(col) == val]
        for col, val in self._gte.items():
            rows = [r for r in rows if (r.get(col) or 0) >= val]
        for col, vals in self._in.items():
            rows = [r for r in rows if r.get(col) in vals]
        if self._range is not None:
            start, end = self._range
            rows = rows[start : end + 1]  # PostgREST-range inklusiv

        class _R:
            pass

        res = _R()
        res.data = rows  # type: ignore[attr-defined]
        return res


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self.table_calls: list[str] = []  # für N+1-Regression-Schutz

    def table(self, name: str) -> _Q:
        self.table_calls.append(name)
        return _Q(self, name)


def _service(
    rate_plans: list[dict] | None = None,
    properties: list[dict] | None = None,
) -> BookingEngineService:
    return BookingEngineService(
        service_client=_DB(
            {
                "properties": properties if properties is not None else _PROPERTIES,
                "availability": [],
                "rate_plans": rate_plans
                if rate_plans is not None
                else [{"property_id": "p-active", "base_price": 120, "currency": "EUR"}],
                "property_pricing_config": [],
            }
        )
    )


def test_listings_only_active() -> None:
    res = _service().list_listings()
    ids = {item.id for item in res.items}
    assert ids == {"p-active", "p-active2"}  # p-draft NICHT enthalten
    assert res.total == 2


def test_listings_marketplace_flag_hides_from_central_only() -> None:
    # Marktplatz-Sichtbarkeit ist ein eigener Kanal (0159): ein aktives Objekt
    # mit listed_on_marketplace=false verschwindet aus dem zentralen Marktplatz
    # (tenant=None), bleibt aber über White-Label (tenant) und den Featured-Block
    # (property_ids) erreichbar — dort kuratiert der Betreiber selbst.
    props = [
        {**_PROPERTIES[0], "listed_on_marketplace": False},  # p-active, unlisted
        _PROPERTIES[1],  # p-active2, gelistet
    ]
    svc = _service(properties=props)
    # Zentraler Marktplatz: nur das gelistete Objekt.
    assert {i.id for i in svc.list_listings().items} == {"p-active2"}
    # White-Label-Seite des Tenants: das unlistete Objekt bleibt sichtbar.
    assert {i.id for i in svc.list_listings(tenant="t1").items} == {"p-active"}
    # Featured-Block per ID: ebenfalls sichtbar (explizite Kuratierung).
    assert {
        i.id for i in svc.list_listings(property_ids=["p-active"]).items
    } == {"p-active"}


def test_listings_no_owner_or_tenant_fields() -> None:
    res = _service().list_listings()
    dumped = res.items[0].model_dump()
    assert "tenant_id" not in dumped
    assert "street" not in dumped and "house_number" not in dumped


def test_listings_price_from_resolver() -> None:
    res = _service().list_listings()
    by_id = {i.id: i for i in res.items}
    # p-active hat rate_plan base 120 → price_from 120, currency EUR.
    assert by_id["p-active"].price_from == 120.0
    assert by_id["p-active"].currency == "EUR"
    # p-active2 ohne rate_plan → kein Fallback-Preis.
    assert by_id["p-active2"].price_from is None


def test_listings_no_n_plus_one_without_dates() -> None:
    # Ohne Zeitraum: konstante Query-Zahl, UNABHÄNGIG von der Objektanzahl
    # (Schutz gegen N+1-Regression, die den Marktplatz ins 504 laufen ließ).
    # Erwartet: 1× properties + 1× rate_plans (gebatcht) = 2 DB-Tabellen-Calls.
    db = _DB(
        {
            "properties": _PROPERTIES,
            "availability": [],
            "rate_plans": [
                {"property_id": "p-active", "base_price": 120, "currency": "EUR"}
            ],
            "property_pricing_config": [],
        }
    )
    svc = BookingEngineService(service_client=db)
    svc.list_listings()
    assert db.table_calls.count("rate_plans") == 1
    assert db.table_calls.count("properties") == 1
    assert "property_pricing_config" not in db.table_calls  # kein Resolver/Listing


def test_listings_tenant_filter() -> None:
    res = _service().list_listings(tenant="t2")
    assert {i.id for i in res.items} == {"p-active2"}


def test_listings_property_ids_filter() -> None:
    # Featured-Block: nur die ausgewählten Objekte.
    res = _service().list_listings(property_ids=["p-active"])
    assert {i.id for i in res.items} == {"p-active"}


def test_listings_property_ids_empty_returns_none() -> None:
    # Leere Auswahl = bewusst KEINE Objekte (nicht „alle").
    res = _service().list_listings(property_ids=[])
    assert res.items == [] and res.total == 0


def test_listings_guests_and_query_filter() -> None:
    svc = _service()
    assert {i.id for i in svc.list_listings(guests=4).items} == {"p-active"}
    assert {i.id for i in svc.list_listings(q="loft").items} == {"p-active2"}
    assert {i.id for i in svc.list_listings(q="Berlin").items} == {"p-active2"}


def test_listings_query_findet_land_ueber_namen() -> None:
    """Die Suche nach dem Landesnamen MUSS treffen, obwohl in der DB nur der
    ISO-Code steht („DE"). Vorher verglich der Filter „deutschland" gegen „de"
    und fand nie etwas — die Landessuche war komplett wirkungslos."""
    svc = _service()
    aktive = {"p-active", "p-active2"}
    assert {i.id for i in svc.list_listings(q="Deutschland").items} == aktive
    assert {i.id for i in svc.list_listings(q="Germany").items} == aktive
    # Tipp-Fragment (Präfix) trifft ebenfalls, damit die Vorschläge live filtern.
    assert {i.id for i in svc.list_listings(q="Deutsch").items} == aktive
    # Der Code selbst bleibt gültig.
    assert {i.id for i in svc.list_listings(q="DE").items} == aktive


def test_listings_query_land_ohne_treffer() -> None:
    """Ein anderes Land darf NICHT treffen — kein Ersatzverhalten (Wurzel 4)."""
    assert _service().list_listings(q="Dänemark").items == []


def test_destinations_nur_echte_ziele_mit_anzahl() -> None:
    """Vorgeschlagen wird NUR, was es im Bestand gibt (Bug: hartkodierte Liste
    zeigte Paris/Bangkok/Tokio ohne ein Objekt dort)."""
    res = _service().list_destinations()
    staedte = {z.label: z.count for z in res.items if z.art == "city"}
    laender = {z.label: z.count for z in res.items if z.art == "country"}
    assert staedte == {"Sylt, Deutschland": 1, "Berlin, Deutschland": 1}
    assert laender == {"Deutschland": 2}  # draft zählt nicht mit
    assert all("Paris" not in z.label for z in res.items)
    # Jedes Land trägt SEINE Flagge, nicht ein geteiltes Welt-Symbol.
    land = next(z for z in res.items if z.art == "country")
    assert land.motiv == "land-de"


def test_destinations_query_filtert_stadt_und_land() -> None:
    svc = _service()
    nur_berlin = svc.list_destinations(q="berl")
    assert [z.label for z in nur_berlin.items] == ["Berlin, Deutschland"]
    # Landesname trifft das Land UND seine Städte.
    per_land = svc.list_destinations(q="Deutschland")
    assert {z.label for z in per_land.items} == {
        "Deutschland", "Sylt, Deutschland", "Berlin, Deutschland",
    }
    assert svc.list_destinations(q="Dänemark").items == []


def test_destinations_query_wirft_keine_ziele_ohne_treffer() -> None:
    assert _service().list_destinations(q="Atlantis").items == []


def test_destinations_limit_greift_und_wird_validiert() -> None:
    from src.features.booking_engine.service import BookingEngineError

    svc = _service()
    assert len(svc.list_destinations(limit=1).items) == 1
    for ungueltig in (0, 51):
        try:
            svc.list_destinations(limit=ungueltig)
        except BookingEngineError as exc:
            assert exc.status_code == 422
        else:
            raise AssertionError(f"limit={ungueltig} muss 422 werfen")


def test_destinations_tenant_filter() -> None:
    """White-Label-Seite sieht nur ihre eigenen Ziele."""
    res = _service().list_destinations(tenant="t2")
    assert [z.label for z in res.items if z.art == "city"] == ["Berlin, Deutschland"]


def test_destinations_unbekannter_landcode_ohne_erfundenes_land() -> None:
    """Unbekannter ISO-Code → nur die Stadt, kein geratenes Land, kein nackter
    Code im Gästetext (Wurzel 4)."""
    prop = {
        "id": "p-xx", "tenant_id": "t1", "title": "Haus", "description": None,
        "property_type": "ferienhaus", "city": "Nirgendwo", "country": "XX",
        "lat": None, "lng": None, "max_guests": 2, "amenities": [], "photos": [],
        "type_attributes": {}, "status": "active",
        "listed_on_marketplace": True, "moderation_status": "approved",
    }
    res = _service(properties=[prop]).list_destinations()
    assert [z.label for z in res.items] == ["Nirgendwo"]
    assert all(z.art != "country" for z in res.items)


def test_listing_detail_active_and_rounded_coords() -> None:
    d = _service().listing_detail("p-active")
    assert d.id == "p-active"
    assert d.description == "Schön"
    assert d.lat == 54.12 and d.lng == 8.65  # auf 2 Nachkommastellen gerundet
    assert d.bedrooms == 3 and d.baths == 2


def test_listing_detail_prefers_platform_description() -> None:
    # Eigene Buchungsseite zeigt den Plattform-Text statt des OTA-Texts.
    # Eigene, isolierte Property, damit die Listen-Zählungen unberührt bleiben.
    prop = {
        "id": "p-platform", "tenant_id": "t1", "title": "Villa",
        "description": "OTA-Text", "platform_description": "Eigener Text",
        "property_type": "ferienhaus", "city": "Kampen", "country": "DE",
        "lat": None, "lng": None, "max_guests": 8,
        "amenities": [], "photos": [], "type_attributes": {}, "status": "active",
    }
    d = _service(properties=[prop]).listing_detail("p-platform")
    assert d.description == "Eigener Text"


def test_listing_detail_falls_back_to_canonical_description() -> None:
    # Ohne platform_description bleibt die kanonische description (= OTA-Text).
    d = _service().listing_detail("p-active")
    assert d.description == "Schön"


def test_listing_detail_404_for_draft() -> None:
    from src.features.booking_engine.service import BookingEngineError

    try:
        _service().listing_detail("p-draft")
    except BookingEngineError as exc:
        assert exc.status_code == 404
    else:
        raise AssertionError("draft darf nicht als Listing-Detail erscheinen")


def test_listings_endpoint_public_no_auth() -> None:
    # Ohne Token erreichbar (öffentliche Buchungsstrecke). 200 oder 500 (DB),
    # aber NICHT 401/403. Ohne erreichbare DB (CI) wirft der Handler — mit
    # raise_server_exceptions=False wird daraus die 500, die der Test erlaubt.
    no_raise = TestClient(create_app(), raise_server_exceptions=False)
    resp = no_raise.get("/api/v1/booking-engine/listings")
    assert resp.status_code not in (401, 403)


def test_round_coord_and_opt_int() -> None:
    from src.features.booking_engine.service import _as_opt_int, _round_coord

    assert _round_coord(None) is None
    assert _round_coord(1.23456) == 1.23
    assert _as_opt_int(None) is None
    assert _as_opt_int("4") == 4
    assert _as_opt_int("x") is None


# --- Atomare Gastbuchung (RPC 0104) --------------------------------------------

def test_bezahlte_absicht_bei_konflikt_ohne_buchung(monkeypatch) -> None:  # noqa: ANN001
    """Verliert ein Gast das Buchungs-Race, kommt 409 mit neutraler Meldung —
    die atomare RPC hat nichts geschrieben (kein halber Buchungszustand)."""
    from datetime import date as _date
    from datetime import timedelta as _delta
    from unittest.mock import MagicMock

    from postgrest.exceptions import APIError

    from src.features.booking_engine.schemas import (
        GuestContact,
        PublicBookingRequest,
    )
    from src.features.booking_engine.service import (
        BookingEngineService,
    )

    db = MagicMock(name="supabase")

    def table(name: str) -> MagicMock:
        t = MagicMock(name=f"table:{name}")
        if name in ("availability", "stop_sell"):
            chain = (
                t.select.return_value.eq.return_value.gte.return_value.lt.return_value
            )
            chain.execute.return_value.data = []  # Pre-Checks: frei
        return t

    db.table.side_effect = table
    db.rpc.return_value.execute.side_effect = APIError({
        "message": "Zeitraum enthält bereits belegte/gesperrte Tage.",
        "code": "RS409", "hint": None, "details": None,
    })

    svc = BookingEngineService(service_client=db)
    monkeypatch.setattr(
        svc,
        "_public_property",
        lambda *_a: {"tenant_id": "t-1", "status": "active", "max_guests": 6},
    )
    monkeypatch.setattr(svc, "_upsert_guest", lambda *_a: None)
    # Preis kommt serverseitig aus dem Resolver — Quote mocken.
    from types import SimpleNamespace

    import src.features.pricing.resolver as resolver_mod

    monkeypatch.setattr(
        resolver_mod.PricingResolver, "quote",
        lambda self, req: SimpleNamespace(
            total=300.0, currency="EUR", lines=[],
            priceless=False, unpriced_nights=0,
        ),
    )

    req = PublicBookingRequest(
        property_id="p-1",
        check_in=_date.today() + _delta(days=30),
        check_out=_date.today() + _delta(days=32),
        guests=2,
        total_amount=200.0,
        contact=GuestContact(
            first_name="Max", last_name="Gast", email="max@example.com",
        ),
    )
    # SEIT 0409: Der Konflikt tritt nicht mehr beim Buchen auf, sondern beim
    # EINLÖSEN der bezahlten Absicht — bis dahin ist nichts geschrieben.
    # Zwischen Zahlungsstart und Bestätigung kann ein anderer Gast dieselben
    # Nächte gekauft haben; die Absicht reserviert bewusst nichts.
    #
    # Was dann passiert, ist der Kern dieses Tests: Es entsteht KEINE Buchung
    # (sonst Doppelbelegung), die Absicht wird als fehlgeschlagen markiert, und
    # der Aufrufer (Webhook) erstattet daraufhin. Geld behalten ohne Buchung
    # wäre der schlimmere Fehler.
    from src.features.booking_engine import absicht as absicht_mod

    monkeypatch.setattr(absicht_mod, "anlegen", lambda *_a, **_k: "abs-9")
    monkeypatch.setattr(absicht_mod, "zahlung_vermerken", lambda *_a, **_k: None)
    monkeypatch.setattr(
        absicht_mod, "laden",
        lambda *_a: {
            "status": absicht_mod.OFFEN, "tenant_id": "t-1", "property_id": "p-1",
            "check_in": (_date.today() + _delta(days=30)).isoformat(),
            "check_out": (_date.today() + _delta(days=32)).isoformat(),
            "total_amount": 300.0, "currency": "EUR",
            "daten": {"guests": 2, "contact": {}, "guest_id": None},
        },
    )
    gescheitert: list[str] = []
    monkeypatch.setattr(
        absicht_mod, "als_fehlgeschlagen",
        lambda _db, aid, grund: gescheitert.append(grund),
    )
    monkeypatch.setattr(
        "src.features.payments.service.PaymentsService.create_intent_for_absicht",
        lambda *_a, **_k: {
            "payment_ref": "pi_9", "client_secret": "cs_9",
            "publishable_key": None, "stripe_account": None,
        },
    )

    # Der Buchungsstart selbst gelingt — er schreibt ja nichts.
    antwort = svc.create_public_booking(req)
    assert antwort.zahlung_erforderlich is True

    # Erst das Einlösen läuft in den Konflikt.
    assert svc.absicht_einloesen("abs-9") is None
    assert gescheitert == ["Zeitraum inzwischen vergeben."]


def test_public_booking_includes_addons_in_quote(monkeypatch) -> None:  # noqa: ANN001
    """CRITICAL-Regression: die gewählten Addons MÜSSEN in den Quote fließen, sonst
    enthält total_amount nur die Unterkunft und der spätere Stripe-PaymentIntent
    kassiert die Zusatzleistungen nie. Wir fangen das an quote() übergebene req ab."""
    from datetime import date as _date
    from datetime import timedelta as _delta
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    import src.features.pricing.resolver as resolver_mod
    from src.features.booking_engine.schemas import (
        AddonPick,
        GuestContact,
        PublicBookingRequest,
    )
    from src.features.booking_engine.service import BookingEngineService

    db = MagicMock(name="supabase")

    def table(name: str) -> MagicMock:
        t = MagicMock(name=f"table:{name}")
        if name in ("availability", "stop_sell"):
            chain = (
                t.select.return_value.eq.return_value.gte.return_value.lt.return_value
            )
            chain.execute.return_value.data = []
        elif name == "property_addons":
            # _bookable_addon_selections: a-1 ist für die Buchungsstrecke freigegeben.
            chain = (
                t.select.return_value.eq.return_value.eq.return_value.in_.return_value
            )
            chain.execute.return_value.data = [
                {"id": "a-1", "appears_in": ["booking_engine"]}
            ]
        return t

    db.table.side_effect = table
    # RPC gibt eine gültige Reservierung zurück (kein Konflikt).
    db.rpc.return_value.execute.return_value.data = {
        "reservation": {"id": "res-1"}, "outbox_id": None,
    }

    svc = BookingEngineService(service_client=db)
    monkeypatch.setattr(
        svc, "_public_property",
        lambda *_a: {"tenant_id": "t-1", "status": "active", "max_guests": 6},
    )
    monkeypatch.setattr(svc, "_upsert_guest", lambda *_a: "g-1")
    monkeypatch.setattr(svc, "_push_channex", lambda *_a, **_k: None)
    # Addons anlegen + Loyalty/Recompute neutralisieren (nicht Teil des Asserts).
    import src.features.addons.service as addons_mod
    monkeypatch.setattr(addons_mod, "purchase_addons", lambda *_a, **_k: [])

    captured: dict = {}

    def _fake_quote(_self, req):  # noqa: ANN001, ANN202
        captured["addons"] = list(req.addons)
        return SimpleNamespace(
            total=260.0, currency="EUR", lines=[],
            priceless=False, unpriced_nights=0,
        )

    monkeypatch.setattr(resolver_mod.PricingResolver, "quote", _fake_quote)

    # Der Zahlungsstart (0409) ist für DIESEN Test ohne Belang — geprüft wird
    # allein, ob der Quote die Addons sieht. Stripe wird deshalb abgehängt.
    from src.features.booking_engine import absicht as absicht_mod

    monkeypatch.setattr(absicht_mod, "anlegen", lambda *_a, **_k: "abs-2")
    monkeypatch.setattr(absicht_mod, "zahlung_vermerken", lambda *_a, **_k: None)
    monkeypatch.setattr(
        "src.features.payments.service.PaymentsService.create_intent_for_absicht",
        lambda *_a, **_k: {
            "payment_ref": "pi_2", "client_secret": "cs_2",
            "publishable_key": None, "stripe_account": None,
        },
    )

    req = PublicBookingRequest(
        property_id="p-1",
        check_in=_date.today() + _delta(days=30),
        check_out=_date.today() + _delta(days=32),
        guests=2,
        total_amount=200.0,
        contact=GuestContact(
            first_name="Max", last_name="Gast", email="max@example.com",
        ),
        addons=[AddonPick(addon_id="a-1", qty=1)],
    )
    svc.create_public_booking(req)
    # Der Quote hat die gewählten Addons gesehen (→ total_amount enthält sie).
    assert [a.addon_id for a in captured["addons"]] == ["a-1"]


def test_property_tenant_rejects_non_active() -> None:
    """draft/inactive-Objekte sind nicht öffentlich buchbar → _property_tenant None."""
    from unittest.mock import MagicMock

    from src.features.booking_engine.service import BookingEngineService

    def _svc(status_val: str) -> BookingEngineService:
        db = MagicMock(name="db")
        chain = db.table.return_value.select.return_value.eq.return_value.limit.return_value
        chain.execute.return_value.data = [{"tenant_id": "t-1", "status": status_val}]
        return BookingEngineService(service_client=db)

    assert _svc("active")._property_tenant("p-1") == "t-1"
    assert _svc("draft")._property_tenant("p-1") is None
    assert _svc("inactive")._property_tenant("p-1") is None


def test_public_booking_rejects_overcapacity(monkeypatch) -> None:
    """Mehr Gäste als max_guests → 422, BEVOR Kalender/Reservierung geschrieben wird."""
    from datetime import date as _date
    from unittest.mock import MagicMock

    import pytest

    from src.features.booking_engine.schemas import (
        GuestContact,
        PublicBookingRequest,
    )
    from src.features.booking_engine.service import (
        BookingEngineError,
        BookingEngineService,
    )

    db = MagicMock(name="db")
    svc = BookingEngineService(service_client=db)
    monkeypatch.setattr(
        svc,
        "_public_property",
        lambda *_a: {"tenant_id": "t-1", "status": "active", "max_guests": 4},
    )
    req = PublicBookingRequest(
        property_id="p-1",
        check_in=_date(2099, 8, 1),
        check_out=_date(2099, 8, 3),
        guests=5,
        contact=GuestContact(
            first_name="Max", last_name="Gast", email="max@example.com",
        ),
    )
    with pytest.raises(BookingEngineError) as exc:
        svc.create_public_booking(req)
    assert exc.value.status_code == 422
    # Kein Schreibpfad angefasst (kein RPC, keine availability-Query).
    db.rpc.assert_not_called()


def test_public_booking_rejects_past_check_in(monkeypatch) -> None:
    """Anreise in der Vergangenheit → 422 (keine availability-Zeilen für alte Tage)."""
    from datetime import date as _date
    from unittest.mock import MagicMock

    import pytest

    from src.features.booking_engine.schemas import (
        GuestContact,
        PublicBookingRequest,
    )
    from src.features.booking_engine.service import (
        BookingEngineError,
        BookingEngineService,
    )

    db = MagicMock(name="db")
    svc = BookingEngineService(service_client=db)
    monkeypatch.setattr(
        svc,
        "_public_property",
        lambda *_a: {"tenant_id": "t-1", "status": "active", "max_guests": 4},
    )
    req = PublicBookingRequest(
        property_id="p-1",
        check_in=_date(2000, 1, 1),
        check_out=_date(2000, 1, 3),
        guests=2,
        contact=GuestContact(
            first_name="Max", last_name="Gast", email="max@example.com",
        ),
    )
    with pytest.raises(BookingEngineError) as exc:
        svc.create_public_booking(req)
    assert exc.value.status_code == 422
    db.rpc.assert_not_called()


# --- Q-1: Max-Span-Guard gegen unauth DoS -------------------------------------
def test_availability_rejects_huge_span() -> None:
    from datetime import date

    from src.features.booking_engine.service import (
        BookingEngineError,
        _assert_span,
    )

    # >730 Tage → 422.
    try:
        _assert_span(date(2026, 1, 1), date(9999, 12, 31))
        raise AssertionError("huge span nicht abgelehnt")
    except BookingEngineError as exc:
        assert exc.status_code == 422
    # Genau im Limit ok, None/None ok.
    _assert_span(date(2026, 1, 1), date(2027, 1, 1))
    _assert_span(None, None)
    # Einzelnes Datum unvollständig → 422.
    try:
        _assert_span(date(2026, 1, 1), None)
        raise AssertionError("halber Span nicht abgelehnt")
    except BookingEngineError as exc:
        assert exc.status_code == 422


def test_listings_moderation_gate_central_only() -> None:
    """Ohne Freigabe des Betreibers kein zentraler Marktplatz (0203).

    Die Prüfung gilt bewusst NUR für den eigenen Marktplatz — White-Label-Seiten
    und der Featured-Block kuratiert der Betrieb selbst, und OTA/Website laufen
    ohnehin an dieser Achse vorbei.
    """
    props = [
        # aktiv + gelistet, aber wartet noch auf Freigabe
        {**_PROPERTIES[0], "moderation_status": "pending"},
        _PROPERTIES[1],  # p-active2, freigegeben
    ]
    svc = _service(properties=props)
    # Zentraler Marktplatz: nur das freigegebene Objekt.
    assert {i.id for i in svc.list_listings().items} == {"p-active2"}
    # White-Label-Seite des Tenants: unabhängig von der Freigabe sichtbar.
    assert {i.id for i in svc.list_listings(tenant="t1").items} == {"p-active"}
    # Featured-Block per ID: ebenfalls sichtbar (explizite Kuratierung).
    assert {
        i.id for i in svc.list_listings(property_ids=["p-active"]).items
    } == {"p-active"}


def test_listings_rejected_property_hidden() -> None:
    """Ein abgelehntes Objekt erscheint nicht auf dem zentralen Marktplatz."""
    props = [{**_PROPERTIES[0], "moderation_status": "rejected"}]
    svc = _service(properties=props)
    assert svc.list_listings().items == []


def test_public_booking_writes_num_guests(monkeypatch) -> None:  # noqa: ANN001
    """Regression: die Gästezahl der öffentlichen Buchung MUSS in reservations
    landen. Sie floss vorher nur in den Quote, sodass jede Portal-Buchung mit dem
    Spalten-Default 1 gespeichert wurde — Gast-App, Kalender und Kurtaxe sahen
    eine falsche Belegung."""
    from datetime import date as _date
    from datetime import timedelta as _delta
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    import src.features.pricing.resolver as resolver_mod
    from src.features.booking_engine.schemas import GuestContact, PublicBookingRequest
    from src.features.booking_engine.service import BookingEngineService

    db = MagicMock(name="supabase")

    def table(name: str) -> MagicMock:
        t = MagicMock(name=f"table:{name}")
        if name in ("availability", "stop_sell"):
            chain = (
                t.select.return_value.eq.return_value.gte.return_value.lt.return_value
            )
            chain.execute.return_value.data = []
        return t

    db.table.side_effect = table
    db.rpc.return_value.execute.return_value.data = {
        "reservation": {"id": "res-1"}, "outbox_id": None,
    }

    svc = BookingEngineService(service_client=db)
    monkeypatch.setattr(
        svc, "_public_property",
        lambda *_a: {"tenant_id": "t-1", "status": "active", "max_guests": 6},
    )
    monkeypatch.setattr(svc, "_upsert_guest", lambda *_a: "g-1")
    monkeypatch.setattr(svc, "_push_channex", lambda *_a, **_k: None)
    monkeypatch.setattr(
        resolver_mod.PricingResolver,
        "quote",
        lambda _self, _req: SimpleNamespace(
            total=260.0, currency="EUR", lines=[],
            priceless=False, unpriced_nights=0,
        ),
    )

    # Seit 0409 entsteht die Reservierung ERST beim Einlösen der bezahlten
    # Absicht — `create_public_booking` legt nur die Absicht an. Die Gästezahl
    # muss den Übergang überstehen, sonst landet sie wieder auf dem
    # Spalten-Default 1.
    from src.features.booking_engine import absicht as absicht_mod

    monkeypatch.setattr(absicht_mod, "anlegen", lambda *_a, **_k: "abs-1")
    monkeypatch.setattr(absicht_mod, "zahlung_vermerken", lambda *_a, **_k: None)
    monkeypatch.setattr(
        absicht_mod, "als_eingeloest", lambda *_a, **_k: True
    )
    gespeicherte: dict = {}

    def _laden(_db, _aid):  # noqa: ANN001, ANN202
        return {
            "status": absicht_mod.OFFEN,
            "tenant_id": "t-1",
            "property_id": "p-1",
            "check_in": (_date.today() + _delta(days=30)).isoformat(),
            "check_out": (_date.today() + _delta(days=32)).isoformat(),
            "total_amount": 260.0,
            "currency": "EUR",
            "daten": gespeicherte,
        }

    monkeypatch.setattr(absicht_mod, "laden", _laden)
    monkeypatch.setattr(
        "src.features.payments.service.PaymentsService.create_intent_for_absicht",
        lambda *_a, **_k: {
            "payment_ref": "pi_1", "client_secret": "cs_1",
            "publishable_key": None, "stripe_account": None,
        },
    )

    antwort = svc.create_public_booking(
        PublicBookingRequest(
            property_id="p-1",
            check_in=_date.today() + _delta(days=30),
            check_out=_date.today() + _delta(days=32),
            guests=4,
            contact=GuestContact(
                first_name="Max", last_name="Gast", email="max@example.com",
            ),
        )
    )
    # KEINE Buchung an dieser Stelle — nur die Aufforderung zu zahlen.
    assert antwort.zahlung_erforderlich is True
    assert not any(
        call[0][0] == "create_reservation_atomic" for call in db.rpc.call_args_list
    ), "Vor der Zahlung darf keine Reservierung entstehen (0409)."

    # Jetzt die Zahlung bestätigen — erst hier entsteht die Buchung.
    gespeicherte.update({"guests": 4, "contact": {}, "guest_id": "g-1"})
    monkeypatch.setattr(svc, "_nachlauf", lambda **_k: None)
    svc.absicht_einloesen("abs-1")

    payload = next(
        call[0][1]["p_reservation"]
        for call in db.rpc.call_args_list
        if call[0][0] == "create_reservation_atomic"
    )
    assert payload["num_guests"] == 4
    assert payload["status"] == "confirmed"


def test_pets_allowed_liest_policy_vor_ausstattung() -> None:
    """Die Hotel-Policy ist die ausdrückliche Angabe des Betriebs und gewinnt.
    Ohne Policy zählen die Merkmale; ohne beides gilt NEIN (fail-closed) — sonst
    böte die Buchungsstrecke Tiere an, wo keine erlaubt sind."""
    from src.features.booking_engine.service import _pets_allowed

    policy_nein = {
        "type_attributes": {"policies": {"hotelPolicy": {"petsPolicy": "not_allowed"}}},
        # Merkmal sagt ja — die Policy gewinnt trotzdem.
        "amenities": ["pets_allowed"],
    }
    assert _pets_allowed(policy_nein) is False
    policy_ja = {
        "type_attributes": {"policies": {"hotelPolicy": {"petsPolicy": "allowed"}}},
        "amenities": [],
    }
    assert _pets_allowed(policy_ja) is True
    assert _pets_allowed({"amenities": ["pet_friendly"]}) is True
    assert _pets_allowed({"amenities": ["nd_pets_not_allowed", "pets_allowed"]}) is False
    # Nichts gepflegt → kein Tier.
    assert _pets_allowed({}) is False


def test_public_quote_lehnt_tiere_ohne_erlaubnis_ab(monkeypatch) -> None:  # noqa: ANN001
    """Ein Gast darf keine Tiere buchen, wo keine erlaubt sind — serverseitig,
    nicht nur im Widget (Wurzel 3). Ohne Tiere rechnet dasselbe Objekt normal."""
    from datetime import date as _date
    from datetime import timedelta as _delta
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    import src.features.pricing.resolver as resolver_mod
    from src.features.booking_engine.schemas import PublicQuoteRequest
    from src.features.booking_engine.service import (
        BookingEngineError,
        BookingEngineService,
    )

    svc = BookingEngineService(service_client=MagicMock(name="supabase"))
    monkeypatch.setattr(
        svc,
        "_pets_property",
        lambda *_a: {
            "tenant_id": "t-1", "status": "active", "max_guests": 4,
            "amenities": [], "type_attributes": {},
        },
    )
    monkeypatch.setattr(svc, "_bookable_addon_selections", lambda *_a: [])
    # Buchungskondition ist hier nicht der Prüfgegenstand (eigener Test unten):
    # ohne diesen Patch liefe der Konditions-Lesepfad gegen die MagicMock-DB.
    monkeypatch.setattr(svc, "_konditionen_fuer_gast", lambda **_k: (None, None, None))
    monkeypatch.setattr(
        resolver_mod.PricingResolver,
        "quote",
        lambda _self, _req: SimpleNamespace(
            total=200.0, currency="EUR", lines=[], priceless=False,
            promo_code_applied=False
        ),
    )

    req = {
        "property_id": "p-1",
        "check_in": _date.today() + _delta(days=10),
        "check_out": _date.today() + _delta(days=12),
        "guests": 2,
    }
    with pytest.raises(BookingEngineError) as exc:
        svc.public_quote(PublicQuoteRequest(**req, pets=1))
    assert exc.value.status_code == 422

    antwort = svc.public_quote(PublicQuoteRequest(**req, pets=0))
    assert antwort.pets_allowed is False
    assert antwort.max_guests == 4
    assert antwort.total == 200.0


def test_public_quote_reicht_tiere_an_den_resolver(monkeypatch) -> None:  # noqa: ANN001
    """Die Tierzahl muss im Quote ankommen — sonst zeigte das Widget einen Preis
    ohne Haustiergebühr und die Buchung berechnete einen anderen."""
    from datetime import date as _date
    from datetime import timedelta as _delta
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    import src.features.pricing.resolver as resolver_mod
    from src.features.booking_engine.schemas import PublicQuoteRequest
    from src.features.booking_engine.service import BookingEngineService

    svc = BookingEngineService(service_client=MagicMock(name="supabase"))
    monkeypatch.setattr(
        svc,
        "_pets_property",
        lambda *_a: {
            "tenant_id": "t-1", "status": "active", "max_guests": 4,
            "amenities": ["pets_allowed"], "type_attributes": {},
        },
    )
    monkeypatch.setattr(svc, "_bookable_addon_selections", lambda *_a: [])
    # Buchungskondition ist hier nicht der Prüfgegenstand (eigener Test unten):
    # ohne diesen Patch liefe der Konditions-Lesepfad gegen die MagicMock-DB.
    monkeypatch.setattr(svc, "_konditionen_fuer_gast", lambda **_k: (None, None, None))
    gesehen: dict[str, int] = {}

    def _quote(_self, req):  # noqa: ANN001, ANN202
        gesehen["pets"] = req.pets
        gesehen["guests"] = req.guests
        return SimpleNamespace(
            total=250.0, currency="EUR", lines=[], priceless=False,
            promo_code_applied=False,
        )

    monkeypatch.setattr(resolver_mod.PricingResolver, "quote", _quote)

    antwort = svc.public_quote(
        PublicQuoteRequest(
            property_id="p-1",
            check_in=_date.today() + _delta(days=10),
            check_out=_date.today() + _delta(days=12),
            guests=2,
            pets=2,
        )
    )
    assert gesehen == {"pets": 2, "guests": 2}
    assert antwort.pets_allowed is True
    assert antwort.nights == 2


def test_public_booking_lehnt_teilweise_unbepreiste_naechte_ab(monkeypatch) -> None:  # noqa: ANN001
    """Regression: Nächte ohne hinterlegten Preis überspringt der Quote still —
    `total` deckte dann nur die bepreisten ab. Der Gast buchte sieben Nächte und
    zahlte drei; bei komplett fehlenden Preisen entstand eine 0-€-Buchung.
    `priceless` allein reicht als Schutz nicht: es meldet nur den Totalausfall."""
    from datetime import date as _date
    from datetime import timedelta as _delta
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    import src.features.pricing.resolver as resolver_mod
    from src.features.booking_engine.schemas import GuestContact, PublicBookingRequest
    from src.features.booking_engine.service import (
        BookingEngineError,
        BookingEngineService,
    )

    db = MagicMock(name="supabase")

    def table(name: str) -> MagicMock:
        t = MagicMock(name=f"table:{name}")
        if name in ("availability", "stop_sell"):
            chain = t.select.return_value.eq.return_value.gte.return_value.lt.return_value
            chain.execute.return_value.data = []
        return t

    db.table.side_effect = table
    svc = BookingEngineService(service_client=db)
    monkeypatch.setattr(
        svc, "_public_property",
        lambda *_a: {"tenant_id": "t-1", "status": "active", "max_guests": 6},
    )
    monkeypatch.setattr(svc, "_upsert_guest", lambda *_a: "g-1")
    monkeypatch.setattr(svc, "_push_channex", lambda *_a, **_k: None)
    # 7 Nächte gebucht, nur 3 bepreist.
    monkeypatch.setattr(
        resolver_mod.PricingResolver, "quote",
        lambda _self, _req: SimpleNamespace(
            total=300.0, currency="EUR", lines=[],
            priceless=False, unpriced_nights=4,
        ),
    )

    with pytest.raises(BookingEngineError) as exc:
        svc.create_public_booking(
            PublicBookingRequest(
                property_id="p-1",
                check_in=_date.today() + _delta(days=30),
                check_out=_date.today() + _delta(days=37),
                guests=2,
                contact=GuestContact(
                    first_name="Max", last_name="Gast", email="max@example.com",
                ),
            )
        )
    assert exc.value.status_code == 422
    # Kein Schreibvorgang: die Buchung darf gar nicht erst entstehen.
    db.rpc.assert_not_called()


def test_public_booking_lehnt_zu_langen_aufenthalt_ab(monkeypatch) -> None:  # noqa: ANN001
    """Regression: der öffentliche Buchungs-Endpunkt hatte als einziger des Slices
    keinen Span-Deckel. Ein einzelner Request mit `check_out` weit in der Zukunft
    baute Millionen Tagesobjekte und ebenso viele availability-Zeilen (Wurzel 8)."""
    from datetime import date as _date
    from datetime import timedelta as _delta
    from unittest.mock import MagicMock

    from src.features.booking_engine.schemas import GuestContact, PublicBookingRequest
    from src.features.booking_engine.service import (
        BookingEngineError,
        BookingEngineService,
    )

    db = MagicMock(name="supabase")
    svc = BookingEngineService(service_client=db)
    monkeypatch.setattr(
        svc, "_public_property",
        lambda *_a: {"tenant_id": "t-1", "status": "active", "max_guests": 6},
    )

    with pytest.raises(BookingEngineError) as exc:
        svc.create_public_booking(
            PublicBookingRequest(
                property_id="p-1",
                check_in=_date.today() + _delta(days=1),
                check_out=_date.today() + _delta(days=5000),
                guests=2,
                contact=GuestContact(
                    first_name="Max", last_name="Gast", email="max@example.com",
                ),
            )
        )
    assert exc.value.status_code == 422
    db.rpc.assert_not_called()


# --- Buchungskondition im Gast-Quote (Zahlungsplan · Storno · Kaution) --------
#
# Der Checkout ZEIGT, was der Zahlungspfad EINZIEHT. Beide rechnen über
# `booking_conditions.plan` — dieser Test hält fest, dass der Gast-Quote genau
# die gepflegten Werte ausliefert und nichts erfindet.


def _quote_service(conditions: list[dict], regeln: list[dict]) -> BookingEngineService:
    return BookingEngineService(
        service_client=_DB(
            {
                "properties": _PROPERTIES,
                "booking_conditions": conditions,
                "booking_condition_refund_rules": regeln,
                "rate_plans": [],
            }
        )
    )


def _konditionen(svc: BookingEngineService, total: float = 1000.0):  # noqa: ANN202
    from datetime import date as _date

    return svc._konditionen_fuer_gast(  # noqa: SLF001
        tenant_id="t1", total=total, check_in=_date(2026, 9, 20), priceless=False
    )


def test_quote_ohne_kondition_verspricht_nichts() -> None:
    """Kein gepflegter Datensatz → kein Plan, kein Storno, keine Kaution. Die
    Strecke sagt dann „alles jetzt" statt eine Regel zu erfinden (Wurzel 4)."""
    plan, storno, deposit = _konditionen(_quote_service([], []))
    assert plan is None and storno is None and deposit is None


def test_quote_anzahlung_und_restzahlung_aus_der_kondition() -> None:
    kond = {
        "id": "bc-1", "tenant_id": "t1", "is_default": True, "installments": 2,
        "first_payment_percent": 30, "balance_days_before_arrival": 30,
        "cancellation_mode": "moderate", "deposit_required": False,
    }
    plan, storno, deposit = _konditionen(_quote_service([kond], []))
    assert plan is not None
    assert plan.installments == 2
    assert plan.due_now == 300.0
    assert plan.due_later == 700.0
    # 20.09.2026 minus 30 Tage.
    assert plan.balance_due_date.isoformat() == "2026-08-21"
    assert storno is not None and storno.mode == "moderate"
    assert storno.rules == []
    assert deposit is None


def test_quote_storno_staffel_kommt_sortiert() -> None:
    kond = {
        "id": "bc-2", "tenant_id": "t1", "is_default": True, "installments": 1,
        "cancellation_mode": "flexible", "deposit_required": False,
    }
    regeln = [
        {"condition_id": "bc-2", "days_before_arrival": 7, "refund_percent": 50},
        {"condition_id": "bc-2", "days_before_arrival": 30, "refund_percent": 100},
    ]
    _plan, storno, _deposit = _konditionen(_quote_service([kond], regeln))
    assert storno is not None
    # Weit vor Anreise zuerst — so liest der Gast die Staffel.
    assert [(r.days_before_arrival, r.refund_percent) for r in storno.rules] == [
        (30, 100.0),
        (7, 50.0),
    ]


def test_quote_ohne_split_ist_alles_sofort_faellig() -> None:
    kond = {
        "id": "bc-3", "tenant_id": "t1", "is_default": True, "installments": 1,
        "first_payment_percent": 30, "balance_days_before_arrival": 30,
        "deposit_required": False,
    }
    plan, _storno, _deposit = _konditionen(_quote_service([kond], []))
    assert plan is not None
    # installments=1 schlägt den Prozentsatz: keine Restzahlung, kein Datum.
    assert (plan.due_now, plan.due_later, plan.balance_due_date) == (1000.0, 0.0, None)


def test_quote_prozentuale_kaution_wird_zur_zahl() -> None:
    kond = {
        "id": "bc-4", "tenant_id": "t1", "is_default": True, "installments": 1,
        "deposit_required": True, "deposit_amount": 10,
        "deposit_amount_type": "percent", "deposit_method": "preauth",
        "deposit_currency": "EUR",
    }
    _plan, _storno, deposit = _konditionen(_quote_service([kond], []))
    assert deposit is not None
    assert deposit.amount == 100.0  # 10 % von 1000
    assert (deposit.method, deposit.currency) == ("preauth", "EUR")


def test_quote_kaution_ohne_betrag_wird_nicht_geraten() -> None:
    kond = {
        "id": "bc-5", "tenant_id": "t1", "is_default": True, "installments": 1,
        "deposit_required": True, "deposit_amount": None,
    }
    _plan, _storno, deposit = _konditionen(_quote_service([kond], []))
    assert deposit is None
