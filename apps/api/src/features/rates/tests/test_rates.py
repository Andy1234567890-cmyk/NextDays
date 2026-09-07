"""Tests für den rates-Slice (rate_plan CRUD + Channex-Sync-Trigger)."""
from datetime import date

from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.dates import merge_day_ranges
from src.core.security import AuthContext
from src.features.rates.schemas import RatePlanCreate, RatePlanPriceSet
from src.features.rates.service import (
    RateError,
    RatesService,
    _weekday_filtered,
)
from src.main import create_app

client = TestClient(create_app())


def test_rates_health() -> None:
    resp = client.get("/api/v1/rates/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "rates", "status": "ok"}


def _ctx(tenant: str | None = "t-1") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="owner")


class _Query:
    def __init__(self, db, name) -> None:  # noqa: ANN001
        self._db = db
        self._name = name
        self._op = None
        self._payload = None

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def eq(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def in_(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def gte(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def lt(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    @property
    def not_(self):  # noqa: ANN201
        return self

    def is_(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def insert(self, payload):  # noqa: ANN001, ANN201
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload):  # noqa: ANN001, ANN201
        self._op, self._payload = "update", payload
        return self

    def upsert(self, payload, **_k):  # noqa: ANN001, ANN003, ANN201
        self._op, self._payload = "upsert", payload
        return self

    def delete(self):  # noqa: ANN201
        self._op = "delete"
        return self

    def execute(self):  # noqa: ANN201
        class _R:
            pass

        r = _R()
        if self._op == "insert":
            row = dict(self._payload)
            row.setdefault("id", "rp-new")
            self._db.inserted.setdefault(self._name, []).append(row)
            r.data = [row]
        elif self._op == "update":
            self._db.updated.setdefault(self._name, []).append(dict(self._payload))
            r.data = self._db.canned.get(self._name, [])
        elif self._op == "upsert":
            self._db.upserted.setdefault(self._name, []).extend(self._payload)
            r.data = list(self._payload)
        elif self._op == "delete":
            self._db.deleted.append(self._name)
            r.data = []
        else:
            r.data = self._db.canned.get(self._name, [])
        return r


class _FakeDB:
    def __init__(self, canned) -> None:  # noqa: ANN001
        self.canned = canned
        self.inserted: dict = {}
        self.updated: dict = {}
        self.upserted: dict = {}
        self.deleted: list = []

    def table(self, name):  # noqa: ANN001, ANN201
        return _Query(self, name)


def _svc(canned) -> RatesService:  # noqa: ANN001
    return RatesService(service_client=_FakeDB(canned))


def test_set_base_price_multi_plan_409() -> None:
    # Objekt mit mehreren Plänen: der Objekt-Grundpreis-Upsert darf NIE einen der
    # Pläne überschreiben (früher: ältester Plan wurde auf „Standard" umbenannt).
    svc = _svc({
        "properties": [{"id": "p-1", "title": "Objekt"}],
        "rate_plans": [
            {"id": "rp-1"},
            {"id": "rp-2"},
        ],
    })
    try:
        svc.set_base_price(
            _ctx(), RatePlanCreate(property_id="p-1", base_price=50, currency="USD")
        )
        raise AssertionError("sollte 409 werfen")
    except RateError as exc:
        assert exc.status_code == 409


def test_set_base_price_updates_only_price_and_currency() -> None:
    # Ein property-weiter Plan: Update fasst NUR base_price + currency an —
    # Name und min_stay sind fremde Pflege-Zustände (Wurzel 1).
    canned = {
        "properties": [{"id": "p-1", "title": "Villa"}],
        "rate_plans": [{
            "id": "rp-1", "property_id": "p-1", "name": "Sommer",
            "base_price": 80, "currency": "USD", "min_stay": 3,
        }],
    }
    svc = _svc(canned)
    svc.set_base_price(
        _ctx(), RatePlanCreate(property_id="p-1", base_price=99, currency="USD")
    )
    db = svc._db()  # noqa: SLF001 — Test prüft den geschriebenen Patch
    assert db.updated["rate_plans"] == [{"base_price": 99.0, "currency": "USD"}]


def test_create_rate_plan_writes_row() -> None:
    svc = _svc({"properties": [{"id": "p-1", "title": "Villa"}]})
    res = svc.create(
        _ctx(),
        RatePlanCreate(property_id="p-1", base_price=120, currency="EUR", min_stay=2),
    )
    assert res.base_price == 120 and res.currency == "EUR" and res.min_stay == 2


def test_create_rate_plan_inherits_object_currency() -> None:
    # Objekt hat eine zentrale Währung (0161) → der neue Plan übernimmt sie,
    # auch wenn der Request eine (gleiche) mitschickt.
    svc = _svc({"properties": [{"id": "p-1", "title": "Villa", "currency": "EUR"}]})
    res = svc.create(
        _ctx(),
        RatePlanCreate(property_id="p-1", base_price=100, currency="EUR"),
    )
    assert res.currency == "EUR"


def test_create_rate_plan_rejects_mismatched_currency_422() -> None:
    # Zentrale Objektwährung EUR, Request will USD → 422 (kein stilles Übernehmen).
    svc = _svc({"properties": [{"id": "p-1", "title": "Villa", "currency": "EUR"}]})
    try:
        svc.create(
            _ctx(),
            RatePlanCreate(property_id="p-1", base_price=100, currency="USD"),
        )
        raise AssertionError("sollte 422 werfen")
    except RateError as exc:
        assert exc.status_code == 422


def test_set_base_price_backfills_object_currency() -> None:
    # Objekt ohne zentrale Währung: set_base_price setzt sie aus dem Request am
    # Objekt (properties.currency wird befüllt — die eine Wahrheit).
    canned = {
        "properties": [{"id": "p-1", "title": "Villa"}],
        "rate_plans": [],
    }
    svc = _svc(canned)
    svc.set_base_price(
        _ctx(), RatePlanCreate(property_id="p-1", base_price=99, currency="EUR")
    )
    db = svc._db()  # noqa: SLF001 — Test prüft den geschriebenen Patch
    assert {"currency": "EUR"} in db.updated.get("properties", [])


def test_set_base_price_enforces_object_currency_422() -> None:
    # Objekt hat zentrale Währung EUR, Preis-Request will USD → 422.
    canned = {
        "properties": [{"id": "p-1", "title": "Villa", "currency": "EUR"}],
        "rate_plans": [{"id": "rp-1", "property_id": "p-1"}],
    }
    svc = _svc(canned)
    try:
        svc.set_base_price(
            _ctx(), RatePlanCreate(property_id="p-1", base_price=50, currency="USD")
        )
        raise AssertionError("sollte 422 werfen")
    except RateError as exc:
        assert exc.status_code == 422


def test_list_reports_sync_status_per_plan() -> None:
    # Plan mit Datumspreisen + in_sync=True → 'synced'; ohne Preise → None.
    svc = _svc({
        "properties": [{"id": "p-1", "title": "Objekt"}],
        "rate_plans": [
            {"id": "rp-1", "property_id": "p-1", "name": "BAR", "base_price": 100,
             "currency": "USD", "min_stay": 1},
        ],
        "rate_plan_price_overrides": [{"rate_plan_id": "rp-1"}],
        "rate_plan_sync_state": [{"rate_plan_id": "rp-1", "in_sync": True}],
    })
    res = svc.list(_ctx(), "p-1")
    assert res.items[0].date_price_count == 1
    assert res.items[0].sync_status == "synced"


def test_list_sync_status_pending_when_drift() -> None:
    svc = _svc({
        "properties": [{"id": "p-1", "title": "Objekt"}],
        "rate_plans": [
            {"id": "rp-1", "property_id": "p-1", "name": "BAR", "base_price": 100,
             "currency": "USD", "min_stay": 1},
        ],
        "rate_plan_price_overrides": [{"rate_plan_id": "rp-1"}],
        "rate_plan_sync_state": [{"rate_plan_id": "rp-1", "in_sync": False}],
    })
    res = svc.list(_ctx(), "p-1")
    assert res.items[0].sync_status == "pending"


def test_list_sync_status_none_without_date_prices() -> None:
    svc = _svc({
        "properties": [{"id": "p-1", "title": "Objekt"}],
        "rate_plans": [
            {"id": "rp-1", "property_id": "p-1", "name": "BAR", "base_price": 100,
             "currency": "USD", "min_stay": 1},
        ],
        "rate_plan_price_overrides": [],
        "rate_plan_sync_state": [],
    })
    res = svc.list(_ctx(), "p-1")
    assert res.items[0].sync_status is None


def test_resync_prices_enqueues_reconcile(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod

    calls: list = []
    monkeypatch.setattr(svc_mod, "enqueue", lambda *a, **k: calls.append((a, k)))
    monkeypatch.setattr(svc_mod, "dedup_key", lambda *a, **k: "dk")
    svc = _svc(_OWN_PLAN)
    svc.resync_prices(_ctx(), "rp-1")
    assert len(calls) == 1
    _args, kw = calls[0]
    assert _args[1] == "reconcile_rate_plan_prices"
    # Eine Speicherung SENDET — sie vergleicht nicht mit dem Schatten des letzten
    # Pushs (der war live falsch, Snerlebo 06.09.2026). Eigener Dedup-Schlüssel,
    # damit ein offener Differenz-Job des Ticks sie nicht verschluckt.
    assert kw["payload"]["erzwingen"] is True
    assert kw["payload"]["property_id"] == "p-1"


def test_resync_prices_foreign_plan_404() -> None:
    svc = _svc({"rate_plans": []})
    try:
        svc.resync_prices(_ctx(), "rp-x")
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404


def test_create_rate_plan_foreign_property_404() -> None:
    svc = _svc({"properties": []})  # Property gehört nicht dem Tenant
    try:
        svc.create(_ctx(), RatePlanCreate(property_id="p-x", base_price=100, currency="USD"))
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404


def test_create_rate_plan_requires_tenant() -> None:
    svc = _svc({"properties": [{"id": "p-1", "title": "Villa"}]})
    try:
        svc.create(
            _ctx(tenant=None),
            RatePlanCreate(property_id="p-1", base_price=100, currency="USD"),
        )
        raise AssertionError("sollte fehlschlagen")
    except RateError as exc:
        assert exc.status_code == 400


# --- Datumsgenaue Preise pro Rate-Plan (Hotel) ------------------------------

# Das Objekt muss mitgeliefert werden: der Content-Sync geht nur für ein
# veröffentlichtes Objekt raus (portalfreigabe). Ein Entwurf bliebe liegen —
# richtig so, aber dann prüfte der Test die Einreihung nicht mehr.
_OWN_PLAN = {
    "rate_plans": [
        {"id": "rp-1", "property_id": "p-1", "properties": {"tenant_id": "t-1"}}
    ],
    "properties": [{"id": "p-1", "tenant_id": "t-1", "status": "active"}],
}


def test_set_rate_plan_prices_upserts_and_enqueues(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanPriceSet

    enqueued: list = []
    monkeypatch.setattr(
        svc_mod, "try_enqueue_ari",
        lambda *a, **k: enqueued.append((a, k)),
    )
    svc = _svc(_OWN_PLAN)
    svc.set_prices(
        _ctx(), "rp-1",
        RatePlanPriceSet(start="2026-11-21", end="2026-11-22", price=333),
    )
    # Ein Tag upserted, und genau EIN rate-plan-genaues Segment eingereiht.
    assert svc._db().canned  # sanity
    assert len(enqueued) == 1
    _args, _kw = enqueued[0]
    # kind="rate", segments mit rate_plan_id + rate_cents in Cent.
    kind = _args[3]
    fields = _args[4]
    assert kind == "rate"
    seg = fields["segments"][0]
    assert seg["rate_plan_id"] == "rp-1"
    assert seg["rate_cents"] == 33300
    assert seg["date_from"] == "2026-11-21" and seg["date_to"] == "2026-11-21"


def test_set_rate_plan_prices_foreign_plan_404(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanPriceSet

    monkeypatch.setattr(svc_mod, "try_enqueue_ari", lambda *a, **k: None)
    svc = _svc({"rate_plans": []})  # Plan gehört nicht dem Tenant
    try:
        svc.set_prices(
            _ctx(), "rp-x",
            RatePlanPriceSet(start="2026-11-21", end="2026-11-22", price=333),
        )
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404


# --- Datumsgenauer Mindestaufenthalt pro Rate-Plan (Zert #5) -----------------

def test_set_rate_plan_min_stays_upserts_and_enqueues(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanMinStaySet

    enqueued: list = []
    monkeypatch.setattr(
        svc_mod, "try_enqueue_ari",
        lambda *a, **k: enqueued.append((a, k)),
    )
    svc = _svc(_OWN_PLAN)
    svc.set_min_stays(
        _ctx(), "rp-1",
        RatePlanMinStaySet(start="2026-11-23", end="2026-11-24", min_stay=3),
    )
    assert len(enqueued) == 1
    _args, _kw = enqueued[0]
    kind = _args[3]
    fields = _args[4]
    assert kind == "rate"
    seg = fields["segments"][0]
    assert seg["rate_plan_id"] == "rp-1"
    assert seg["min_stay"] == 3
    assert seg["date_from"] == "2026-11-23" and seg["date_to"] == "2026-11-23"
    assert "rate_cents" not in seg  # reiner Min-Stay-Push, kein Preis


def test_set_min_stays_weekday_mask_sends_one_request(monkeypatch) -> None:  # noqa: ANN001
    """Wochentagsmaske → MEHRERE Bereiche, aber GENAU EIN Channex-Request.

    Channex-Zertifizierung 17.07.2026, „Min Stay Update — Failed": erwartet
    wurde genau ein Property.UpdateRestrictions, gesendet wurden drei. Ursache
    war ein Enqueue je zusammenhängendem Bereich; die Bereiche gehören in EIN
    segments-Array.
    """
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanMinStaySet

    enqueued: list = []
    monkeypatch.setattr(
        svc_mod, "try_enqueue_ari",
        lambda *a, **k: enqueued.append((a, k)),
    )
    svc = _svc(_OWN_PLAN)
    # Nur montags im November 2026 → 2., 9., 16., 23., 30. = fünf Einzelbereiche.
    svc.set_min_stays(
        _ctx(), "rp-1",
        RatePlanMinStaySet(
            start="2026-11-01", end="2026-12-01", min_stay=2, weekdays=[0]
        ),
    )
    assert len(enqueued) == 1, "je Bereich ein Request wäre der Zert-Fehler"
    segments = enqueued[0][0][4]["segments"]
    assert len(segments) == 5
    assert all(s["min_stay"] == 2 for s in segments)
    assert all(s["rate_plan_id"] == "rp-1" for s in segments)
    # Einzeltage bleiben Einzeltage (date_from == date_to), keine Lücken-Brücke.
    assert [s["date_from"] for s in segments] == [
        "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30",
    ]
    assert all(s["date_from"] == s["date_to"] for s in segments)


def test_set_restrictions_weekday_mask_sends_one_request(monkeypatch) -> None:  # noqa: ANN001
    """Wie oben für CTA/CTD/Max-Stay: ein Request mit mehreren `rows`."""
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanRestrictionSet

    enqueued: list = []
    monkeypatch.setattr(
        svc_mod, "try_enqueue_ari",
        lambda *a, **k: enqueued.append((a, k)),
    )
    svc = _svc(_OWN_PLAN)
    svc.set_restrictions(
        _ctx(), "rp-1",
        RatePlanRestrictionSet(
            start="2026-11-01", end="2026-12-01",
            weekdays=[0], closed_to_arrival=True,
        ),
    )
    assert len(enqueued) == 1
    rows = enqueued[0][0][4]["rows"]
    assert len(rows) == 5
    assert all(r["closed_to_arrival"] is True for r in rows)


def test_clear_rate_plan_min_stays_deletes(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanMinStaySet

    monkeypatch.setattr(svc_mod, "try_enqueue_ari", lambda *a, **k: None)
    monkeypatch.setattr(svc_mod, "try_enqueue_content_sync", lambda *a, **k: None)
    db = _FakeDB(_OWN_PLAN)
    svc = RatesService(service_client=db)
    svc.set_min_stays(
        _ctx(), "rp-1",
        RatePlanMinStaySet(start="2026-11-23", end="2026-11-25", min_stay=None),
    )
    assert "rate_plan_min_stay_overrides" in db.deleted
    assert not db.upserted.get("rate_plan_min_stay_overrides")


def test_set_rate_plan_min_stays_foreign_plan_404(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanMinStaySet

    monkeypatch.setattr(svc_mod, "try_enqueue_ari", lambda *a, **k: None)
    svc = _svc({"rate_plans": []})
    try:
        svc.set_min_stays(
            _ctx(), "rp-x",
            RatePlanMinStaySet(start="2026-11-23", end="2026-11-24", min_stay=3),
        )
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404


def test_clear_rate_plan_prices_deletes(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanPriceSet

    monkeypatch.setattr(svc_mod, "try_enqueue_ari", lambda *a, **k: None)
    monkeypatch.setattr(svc_mod, "try_enqueue_content_sync", lambda *a, **k: None)
    db = _FakeDB(_OWN_PLAN)
    svc = RatesService(service_client=db)
    svc.set_prices(
        _ctx(), "rp-1",
        RatePlanPriceSet(start="2026-11-21", end="2026-11-23", price=None),
    )
    # Zurücknehmen löscht die Datumspreis-Zeilen (kein Upsert).
    assert "rate_plan_price_overrides" in db.deleted
    assert not db.upserted.get("rate_plan_price_overrides")


def test_clear_all_rate_plan_prices(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod

    synced: list = []
    monkeypatch.setattr(
        svc_mod, "try_enqueue_content_sync",
        lambda *a, **k: synced.append((a, k)),
    )
    db = _FakeDB(_OWN_PLAN)
    svc = RatesService(service_client=db)
    svc.clear_all_prices(_ctx(), "rp-1")
    # Alle Zeilen des Plans gelöscht + Content-Sync (Basispreis zurück) eingereiht.
    assert "rate_plan_price_overrides" in db.deleted
    assert len(synced) == 1


def test_clear_all_rate_plan_prices_foreign_404() -> None:
    svc = _svc({"rate_plans": []})  # Plan gehört nicht dem Tenant
    try:
        svc.clear_all_prices(_ctx(), "rp-x")
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404


# --- Restriktionen (CTA/CTD/Max-Stay) pro Rate-Plan (0153) -------------------

def test_set_rate_plan_restrictions_upserts_and_pushes(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanRestrictionSet

    enqueued: list = []
    monkeypatch.setattr(
        svc_mod, "try_enqueue_ari",
        lambda *a, **k: enqueued.append((a, k)),
    )
    db = _FakeDB(_OWN_PLAN)
    svc = RatesService(service_client=db)
    svc.set_restrictions(
        _ctx(), "rp-1",
        RatePlanRestrictionSet(
            start="2026-11-01", end="2026-11-03",
            closed_to_arrival=True, closed_to_departure=False, max_stay=4,
        ),
    )
    rows = db.upserted["rate_plan_restriction_overrides"]
    assert len(rows) == 2  # 2 Nächte, end exklusiv
    assert rows[0] == {
        "rate_plan_id": "rp-1", "date": "2026-11-01",
        "closed_to_arrival": True, "closed_to_departure": False, "max_stay": 4,
    }
    # Push: restriction_rows an GENAU diesen Plan mit expliziten Endwerten.
    _args, _kw = enqueued[0]
    assert _args[3] == "restriction_rows"
    row = _args[4]["rows"][0]
    assert row["rate_plan_id"] == "rp-1"
    assert row["closed_to_arrival"] is True
    assert row["closed_to_departure"] is False
    assert row["max_stay"] == 4
    assert row["date_from"] == "2026-11-01" and row["date_to"] == "2026-11-02"


def test_clear_rate_plan_restrictions_deletes_and_opens(monkeypatch) -> None:  # noqa: ANN001
    # Alle drei None = Override zurücknehmen: Zeilen löschen UND explizit
    # offen/kein Limit pushen (der Portal-Stand folgt der Rücknahme, Wurzel 1).
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanRestrictionSet

    enqueued: list = []
    monkeypatch.setattr(
        svc_mod, "try_enqueue_ari",
        lambda *a, **k: enqueued.append((a, k)),
    )
    db = _FakeDB(_OWN_PLAN)
    svc = RatesService(service_client=db)
    svc.set_restrictions(
        _ctx(), "rp-1",
        RatePlanRestrictionSet(start="2026-11-01", end="2026-11-03"),
    )
    assert "rate_plan_restriction_overrides" in db.deleted
    assert not db.upserted.get("rate_plan_restriction_overrides")
    row = enqueued[0][0][4]["rows"][0]
    assert row["closed_to_arrival"] is False
    assert row["closed_to_departure"] is False
    assert row["max_stay"] == 0


def test_set_rate_plan_restrictions_foreign_plan_404(monkeypatch) -> None:  # noqa: ANN001
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanRestrictionSet

    monkeypatch.setattr(svc_mod, "try_enqueue_ari", lambda *a, **k: None)
    svc = _svc({"rate_plans": []})
    try:
        svc.set_restrictions(
            _ctx(), "rp-x",
            RatePlanRestrictionSet(start="2026-11-01", end="2026-11-02", max_stay=2),
        )
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404


# --- Abgeleitete Rate-Pläne: Service-Guards ---------------------------------

def test_create_derived_without_parent_422() -> None:
    svc = _svc({"properties": [{"id": "p-1", "title": "Objekt"}]})
    try:
        svc.create(_ctx(), RatePlanCreate(
            property_id="p-1", base_price=0, currency="EUR",
            rate_mode="derived",
        ))
        raise AssertionError("sollte 422 werfen")
    except RateError as exc:
        assert exc.status_code == 422


def test_create_derived_parent_missing_422() -> None:
    # Parent-Lookup liefert leer (rate_plans leer) → 422.
    svc = _svc({"properties": [{"id": "p-1", "title": "Objekt"}], "rate_plans": []})
    try:
        svc.create(_ctx(), RatePlanCreate(
            property_id="p-1", base_price=0, currency="EUR",
            rate_mode="derived", derived_from_rate_plan_id="rp-x",
        ))
        raise AssertionError("sollte 422 werfen")
    except RateError as exc:
        assert exc.status_code == 422


def test_create_derived_parent_is_derived_422() -> None:
    # Kaskade verboten: Parent selbst derived → 422.
    svc = _svc({
        "properties": [{"id": "p-1", "title": "Objekt"}],
        "rate_plans": [{"id": "rp-parent", "property_id": "p-1",
                        "currency": "EUR", "base_price": 100,
                        "rate_mode": "derived"}],
    })
    try:
        svc.create(_ctx(), RatePlanCreate(
            property_id="p-1", base_price=0, currency="EUR",
            rate_mode="derived", derived_from_rate_plan_id="rp-parent",
            offset_amount=25,
        ))
        raise AssertionError("sollte 422 werfen")
    except RateError as exc:
        assert exc.status_code == 422


def test_create_derived_inherits_parent_currency() -> None:
    # Kind erbt Parent-Währung + Basis (kein zweiter Währungs-Wert).
    svc = _svc({
        "properties": [{"id": "p-1", "title": "Objekt"}],
        "rate_plans": [{"id": "rp-bar", "property_id": "p-1",
                        "currency": "GBP", "base_price": 100,
                        "rate_mode": "manual"}],
    })
    svc.create(_ctx(), RatePlanCreate(
        property_id="p-1", base_price=0, currency="EUR",  # EUR wird ignoriert
        rate_mode="derived", derived_from_rate_plan_id="rp-bar",
        offset_amount=25,
    ))
    written = svc._db().inserted["rate_plans"][0]  # noqa: SLF001
    assert written["currency"] == "GBP"
    assert written["rate_mode"] == "derived"
    assert written["derived_from_rate_plan_id"] == "rp-bar"


def test_set_prices_on_derived_plan_422() -> None:
    svc = _svc({
        "properties": [{"id": "p-1", "title": "Objekt"}],
        "rate_plans": [{"id": "rp-d", "property_id": "p-1",
                        "rate_mode": "derived",
                        "properties": {"tenant_id": "t-1"}}],
    })
    try:
        svc.set_prices(_ctx(), "rp-d", RatePlanPriceSet(
            start=date(2026, 7, 1), end=date(2026, 7, 3), price=100,
        ))
        raise AssertionError("sollte 422 werfen")
    except RateError as exc:
        assert exc.status_code == 422


def test_delete_parent_with_children_409() -> None:
    svc = _svc({
        "rate_plans": [{"id": "rp-child", "property_id": "p-1",
                        "properties": {"tenant_id": "t-1"}}],
    })
    try:
        svc.delete(_ctx(), "rp-parent")
        raise AssertionError("sollte 409 werfen")
    except RateError as exc:
        assert exc.status_code == 409


def test_weekday_filtered_and_ranges() -> None:
    # Mo(13) Di(14) Mi(15) … So(19): nur Mo+Mi.
    days = _weekday_filtered(date(2026, 7, 13), date(2026, 7, 20), [0, 2])
    assert [d.day for d in days] == [13, 15]
    # Zusammenhängende Bereiche bündeln.
    # `end_exclusive=False`: hier ist das Ende INKLUSIV — ein ARI-Segment
    # deckt den letzten Tag mit ab.
    ranges = merge_day_ranges(
        [date(2026, 7, 1), date(2026, 7, 2), date(2026, 7, 5)],
        end_exclusive=False,
    )
    assert ranges == [(date(2026, 7, 1), date(2026, 7, 2)),
                      (date(2026, 7, 5), date(2026, 7, 5))]


# -- Regressionstests zu den Review-Befunden (Wurzel 1/4/8) -------------------


def test_bulk_set_span_over_limit_422() -> None:
    # Wurzel 8: ohne Obergrenze expandiert 100 Jahre × Wochentagsmaske zu
    # zehntausenden Zeilen UND ebenso vielen ARI-Jobs (ein Request flutet die
    # Queue). Alle drei Bulk-Schemas müssen den Bereich hart begrenzen.
    from src.features.rates.schemas import (
        RatePlanMinStaySet,
        RatePlanPriceSet,
        RatePlanRestrictionSet,
    )

    for model, extra in (
        (RatePlanPriceSet, {"price": 100}),
        (RatePlanMinStaySet, {"min_stay": 2}),
        (RatePlanRestrictionSet, {"max_stay": 5}),
    ):
        try:
            model(start=date(2026, 1, 1), end=date(2126, 1, 1),
                  weekdays=[0, 2, 4], **extra)
            raise AssertionError(f"{model.__name__} sollte den Bereich ablehnen")
        except ValidationError:
            pass
    # Knapp innerhalb der Grenze bleibt erlaubt.
    ok = RatePlanPriceSet(start=date(2026, 1, 1), end=date(2027, 1, 1), price=100)
    assert (ok.end - ok.start).days == 365


def test_set_prices_on_parent_propagates_to_children(monkeypatch) -> None:  # noqa: ANN001
    # Wurzel 1: Preis am Basis-Plan ändern verschiebt die Kurve der Kinder sofort
    # → es MUSS ein Reconcile für das Objekt eingereiht werden, sonst behalten die
    # OTAs den alten Kind-Preis bis zum nächsten 15-min-Tick.
    from src.features.rates import service as svc_mod
    from src.features.rates.schemas import RatePlanPriceSet

    jobs: list = []
    monkeypatch.setattr(svc_mod, "try_enqueue_ari", lambda *a, **k: None)
    monkeypatch.setattr(svc_mod, "enqueue", lambda *a, **k: jobs.append((a, k)))
    svc = _svc({
        "properties": [{"id": "p-1", "title": "Objekt"}],
        "rate_plans": [
            {"id": "rp-1", "property_id": "p-1",
             "properties": {"tenant_id": "t-1"}},
            # Kind, das von rp-1 ableitet (Query .eq(derived_from_rate_plan_id)).
            {"id": "rp-kid", "property_id": "p-1"},
        ],
    })
    svc.set_prices(
        _ctx(), "rp-1",
        RatePlanPriceSet(start="2026-11-21", end="2026-11-22", price=333),
    )
    assert any(a[1] == "reconcile_rate_plan_prices" for a, _k in jobs), (
        "Kind-Propagation fehlt: kein Reconcile für das Objekt eingereiht"
    )


def test_update_derived_rejects_own_currency() -> None:
    # Wurzel 4: ein abgeleiteter Plan hat keine eigene Währung — ein PATCH ohne
    # rate_mode lief sonst an der Ableitungs-Prüfung vorbei und entkoppelte das
    # Kind von seinem Parent (Kind USD, Parent EUR).
    from src.features.rates.schemas import RatePlanUpdate

    svc = _svc({
        "rate_plans": [{"id": "rp-d", "property_id": "p-1",
                        "rate_mode": "derived", "currency": "EUR",
                        "properties": {"tenant_id": "t-1", "title": "Objekt"}}],
    })
    try:
        svc.update(_ctx(), "rp-d", RatePlanUpdate(currency="USD"))
        raise AssertionError("sollte 422 werfen")
    except RateError as exc:
        assert exc.status_code == 422


def test_update_lehnt_fremde_buchungsbedingung_ab() -> None:
    # Wurzel 3: die ID kommt aus dem Request. Ohne Mandanten-Prüfung hinge die
    # Bedingung eines FREMDEN Betriebs am eigenen Preisplan — und mit ihr dessen
    # Storno- und Zahlungsregeln.
    from src.features.rates.schemas import RatePlanUpdate

    # Die Fake-DB wertet `.eq()` nicht aus — eine fremde Zeile käme hier trotz
    # Mandanten-Filter zurück. Geprüft wird deshalb der Zustand, den der Filter
    # in der echten DB ERZEUGT: kein Treffer. Dass der Filter selbst gesetzt
    # ist, sieht nur ein Lauf gegen eine echte Datenbank.
    svc = _svc({
        "rate_plans": [{"id": "rp-1", "property_id": "p-1", "currency": "EUR",
                        "properties": {"tenant_id": "t-1", "title": "Objekt"}}],
        "booking_conditions": [],
    })
    try:
        svc.update(_ctx(), "rp-1", RatePlanUpdate(booking_condition_id="bc-fremd"))
        raise AssertionError("sollte 404 werfen")
    except RateError as exc:
        assert exc.status_code == 404


def test_update_loest_die_buchungsbedingung_mit_null() -> None:
    # `null` ist eine Angabe, kein fehlender Wert: ohne diesen Pfad ließe sich
    # eine einmal gesetzte Bedingung nie wieder lösen (Gegenzustand, Wurzel 1).
    from src.features.rates.schemas import RatePlanUpdate

    svc = _svc({
        "rate_plans": [{"id": "rp-1", "property_id": "p-1", "currency": "EUR",
                        "booking_condition_id": "bc-1",
                        "properties": {"tenant_id": "t-1", "title": "Objekt"}}],
        "booking_conditions": [{"id": "bc-1", "tenant_id": "t-1"}],
    })
    svc.update(_ctx(), "rp-1", RatePlanUpdate(booking_condition_id=None))
    geschrieben = svc._db().updated["rate_plans"]  # noqa: SLF001 — der Schreibvorgang ist der Prüfpunkt
    assert any("booking_condition_id" in p for p in geschrieben)
    assert all(
        p["booking_condition_id"] is None
        for p in geschrieben
        if "booking_condition_id" in p
    )


def test_resolver_derived_cycle_fails_closed() -> None:
    # Fehldaten A→B→A (der DB-CHECK verbietet nur die Selbstreferenz): der
    # Resolver muss den Zyklus erkennen und fail-closed 422 werfen, statt endlos
    # zu rekursieren.
    from src.features.pricing.resolver import PricingError, PricingResolver

    class _CycleDb:
        def table(self, name):  # noqa: ANN001, ANN202
            return self

        def select(self, *_a, **_k):  # noqa: ANN202
            return self

        def eq(self, *_a, **_k):  # noqa: ANN202
            return self

        def lt(self, *_a, **_k):  # noqa: ANN202
            return self

        def gte(self, *_a, **_k):  # noqa: ANN202
            return self

        def not_(self):  # noqa: ANN202
            return self

        def limit(self, *_a, **_k):  # noqa: ANN202
            return self

        def order(self, *_a, **_k):  # noqa: ANN202
            return self

        def execute(self):  # noqa: ANN202
            raise AssertionError("nicht erreicht")

    # Direkt die Kurven-Rekursion prüfen: Meta-Lookup gibt einen Zyklus zurück.
    resolver = PricingResolver(service_client=_CycleDb())
    metas = {
        "a": ("derived", "b"),
        "b": ("derived", "a"),
    }

    def _fake_meta(_prop, plan_id):  # noqa: ANN001, ANN202
        from src.features.pricing.resolver import _RatePlanMeta

        mode, parent = metas[plan_id]
        return _RatePlanMeta(base=100.0, currency="EUR", rate_mode=mode,
                             parent_id=parent, offset_amount=10.0,
                             offset_percent=None)

    resolver._load_rate_plan_meta = _fake_meta  # noqa: SLF001
    try:
        resolver._rate_plan_curve(  # noqa: SLF001
            "p-1", "a", [date(2026, 7, 1)], date(2026, 7, 1), date(2026, 7, 2),
            {}, {}, None,
        )
        raise AssertionError("sollte PricingError werfen")
    except PricingError as exc:
        assert exc.status_code == 422


def test_update_derived_to_manual_with_own_price_allowed() -> None:
    # Gegenprobe zum stays_derived-Guard: derived → manual MIT eigenem Grundpreis
    # ist der normale Rückweg („Plan soll wieder eigene Preise haben") und MUSS
    # erlaubt bleiben. Nur ein Plan, der derived BLEIBT, darf keine eigene
    # Währung/Basis bekommen.
    from src.features.rates.schemas import RatePlanUpdate

    svc = _svc({
        "rate_plans": [{"id": "rp-d", "property_id": "p-1",
                        "rate_mode": "derived", "currency": "EUR",
                        "base_price": 100,
                        "properties": {"tenant_id": "t-1", "title": "Objekt"}}],
    })
    out = svc.update(_ctx(), "rp-d", RatePlanUpdate(
        rate_mode="manual", base_price=99, currency="EUR",
    ))
    assert out is not None
