"""Tests für den booking_engine-Slice — inkl. öffentliche Listings.

Verifiziert: nur status='active' erscheint, draft/inactive nie; Output enthält
KEINE Tenant-/Eigentümer-Felder; price_from kommt aus dem Pricing-Resolver;
Default tenant-übergreifend, mit tenant-Filter nur dieser Mandant; Detail 404
für nicht-active.
"""
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
    },
    {
        "id": "p-active2", "tenant_id": "t2", "title": "City Loft",
        "description": None, "property_type": "appartement", "city": "Berlin",
        "country": "DE", "lat": None, "lng": None, "max_guests": 2,
        "amenities": [], "photos": [], "type_attributes": {}, "status": "active",
    },
    {
        "id": "p-draft", "tenant_id": "t1", "title": "Entwurf", "description": None,
        "property_type": "ferienhaus", "city": "X", "country": "DE", "lat": None,
        "lng": None, "max_guests": 4, "amenities": [], "photos": [],
        "type_attributes": {}, "status": "draft",
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
    # aber NICHT 401/403.
    resp = client.get("/api/v1/booking-engine/listings")
    assert resp.status_code not in (401, 403)


def test_round_coord_and_opt_int() -> None:
    from src.features.booking_engine.service import _as_opt_int, _round_coord

    assert _round_coord(None) is None
    assert _round_coord(1.23456) == 1.23
    assert _as_opt_int(None) is None
    assert _as_opt_int("4") == 4
    assert _as_opt_int("x") is None


# --- Atomare Gastbuchung (RPC 0104) --------------------------------------------

def test_public_booking_maps_rpc_conflict_to_409(monkeypatch) -> None:  # noqa: ANN001
    """Verliert ein Gast das Buchungs-Race, kommt 409 mit neutraler Meldung —
    die atomare RPC hat nichts geschrieben (kein halber Buchungszustand)."""
    from datetime import date as _date
    from unittest.mock import MagicMock

    from postgrest.exceptions import APIError

    from src.features.booking_engine.schemas import (
        GuestContact,
        PublicBookingRequest,
    )
    from src.features.booking_engine.service import (
        BookingEngineError,
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
        lambda self, req: SimpleNamespace(total=300.0, currency="EUR", lines=[]),
    )

    req = PublicBookingRequest(
        property_id="p-1",
        check_in=_date(2026, 8, 1),
        check_out=_date(2026, 8, 3),
        guests=2,
        total_amount=200.0,
        contact=GuestContact(
            first_name="Max", last_name="Gast", email="max@example.com",
        ),
    )
    import pytest

    with pytest.raises(BookingEngineError) as exc:
        svc.create_public_booking(req)
    assert exc.value.status_code == 409
    assert exc.value.message == "Zeitraum ist nicht mehr verfügbar."


def test_public_booking_includes_addons_in_quote(monkeypatch) -> None:  # noqa: ANN001
    """CRITICAL-Regression: die gewählten Addons MÜSSEN in den Quote fließen, sonst
    enthält total_amount nur die Unterkunft und der spätere Stripe-PaymentIntent
    kassiert die Zusatzleistungen nie. Wir fangen das an quote() übergebene req ab."""
    from datetime import date as _date
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
        return SimpleNamespace(total=260.0, currency="EUR", lines=[])

    monkeypatch.setattr(resolver_mod.PricingResolver, "quote", _fake_quote)

    req = PublicBookingRequest(
        property_id="p-1",
        check_in=_date(2026, 8, 1),
        check_out=_date(2026, 8, 3),
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
