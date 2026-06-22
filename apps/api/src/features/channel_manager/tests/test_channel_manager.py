from datetime import date

from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.channel_manager.service import ChannelManagerService
from src.main import create_app

client = TestClient(create_app())


def test_channel_manager_health() -> None:
    resp = client.get("/api/v1/channel-manager/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["slice"] == "channel_manager"
    assert body["status"] == "ok"
    # Feld existiert und ist bool (Wert hängt von der Umgebung/Key-Konfig ab).
    # Neutraler Name (kein Provider-Leck im Response).
    assert isinstance(body["channel_manager_ready"], bool)


def test_webhook_rejects_wrong_secret() -> None:
    # Ohne korrektes Secret → 401 (Webhook ist nicht JWT-gesichert).
    resp = client.post(
        "/api/v1/channel-manager/webhook",
        json={"event": "booking_new"},
        headers={"X-Channex-Webhook-Secret": "falsch"},
    )
    assert resp.status_code == 401


def test_protected_endpoints_require_auth() -> None:
    # Property-Liste ohne JWT → 401.
    resp = client.get("/api/v1/channel-manager/properties")
    assert resp.status_code == 401


# --- Mandantentrennung: kontoweiter Buchungs-Feed darf NICHT durchsickern ----
class _FakeChannex:
    """Simuliert den KONTOWEITEN Channex-Feed: Buchungen mehrerer Tenants."""

    def __init__(self, revisions: list[dict]) -> None:
        self._revisions = revisions
        self.acked: list[str] = []

    def get_booking_revisions_feed(self) -> dict:
        return {"data": self._revisions}

    def ack_booking_revision(self, revision_id: str) -> dict:
        self.acked.append(revision_id)
        return {}


class _FakeQuery:
    """Mini-Query-Builder, der nur channex_property_map für EINEN Tenant kennt."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003
        return self

    def eq(self, *_a, **_k):  # noqa: ANN002, ANN003
        return self

    def is_(self, *_a, **_k):  # noqa: ANN002, ANN003
        return self

    def execute(self):  # noqa: ANN201
        class _R:
            data = self._rows

        return _R()


class _FakeDB:
    """Liefert für channex_property_map nur Andys Property; speichert Buchungen."""

    def __init__(self, own_channex_property_id: str) -> None:
        self._own = own_channex_property_id
        self.saved_bookings: list[dict] = []

    def table(self, name: str):  # noqa: ANN201
        if name == "channex_property_map":
            return _FakeQuery([{"channex_property_id": self._own}])
        if name == "channex_booking":
            outer = self

            class _Upsert:
                def upsert(self, row, **_k):  # noqa: ANN001, ANN002, ANN003, ANN201
                    outer.saved_bookings.append(row)
                    return self

                def execute(self):  # noqa: ANN201
                    class _R:
                        data = []

                    return _R()

            return _Upsert()
        return _FakeQuery([])


# --- Channex→DB 1:1-Spiegel (reconcile) --------------------------------------
class _ReconcileChannex:
    """Channex-Stub für den Property-Reconcile. list_properties liefert je Group
    eine konfigurierte Property-Liste; raises=True simuliert einen Ausfall."""

    def __init__(self, properties: list[dict], *, raises: bool = False) -> None:
        self._properties = properties
        self._raises = raises
        self.is_configured = True

    def list_properties(self, *, page=1, limit=100, group_id=None):  # noqa: ANN001, ANN201
        if self._raises:
            from src.features.channel_manager.channex_client import ChannexError

            raise ChannexError("Channex down", status_code=502)
        return {
            "data": self._properties,
            "meta": {"total": len(self._properties), "limit": limit, "page": page},
        }


class _ReconcileDB:
    """In-Memory-DB für properties + channex_property_map + channex_group_map.
    Unterstützt select/eq/is_/not_/insert/update/upsert für den Reconcile."""

    def __init__(self, tenant_id: str, group_id: str) -> None:
        self.properties: list[dict] = []
        self.maps: list[dict] = []
        self.groups: list[dict] = [
            {"tenant_id": tenant_id, "channex_group_id": group_id}
        ]
        self._seq = 0

    def _next_id(self) -> str:
        self._seq += 1
        return f"prop-{self._seq}"

    def table(self, name: str):  # noqa: ANN201
        store = {
            "properties": self.properties,
            "channex_property_map": self.maps,
            "channex_group_map": self.groups,
        }[name]
        return _ReconcileQuery(self, name, store)


class _ReconcileQuery:
    def __init__(self, db, name, store) -> None:  # noqa: ANN001
        self._db = db
        self._name = name
        self._store = store
        self._filters: list = []
        self._not_next = False
        self._op = None
        self._payload = None

    # -- Filter --
    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    @property
    def not_(self):  # noqa: ANN201
        self._not_next = True
        return self

    def eq(self, field, value):  # noqa: ANN001, ANN201
        self._filters.append(("eq", field, value, False))
        return self

    def in_(self, field, values):  # noqa: ANN001, ANN201
        self._filters.append(("in", field, values, False))
        return self

    def is_(self, field, _value):  # noqa: ANN001, ANN201
        neg = self._not_next
        self._not_next = False
        self._filters.append(("isnull", field, None, neg))
        return self

    # -- Mutationen --
    def insert(self, payload):  # noqa: ANN001, ANN201
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload):  # noqa: ANN001, ANN201
        self._op, self._payload = "update", payload
        return self

    def upsert(self, payload, **_k):  # noqa: ANN001, ANN002, ANN003, ANN201
        self._op, self._payload = "upsert", payload
        return self

    def _match(self, row) -> bool:  # noqa: ANN001
        for kind, field, value, neg in self._filters:
            if kind == "eq":
                ok = row.get(field) == value
            elif kind == "in":
                ok = row.get(field) in value
            elif kind == "isnull":
                ok = row.get(field) is None
                if neg:
                    ok = not ok
            else:
                ok = True
            if not ok:
                return False
        return True

    def execute(self):  # noqa: ANN201
        rows = [r for r in self._store if self._match(r)]
        if self._op == "insert":
            new = dict(self._payload)
            new.setdefault("id", self._db._next_id())
            self._store.append(new)
            return _Result([new])
        if self._op == "update":
            for r in rows:
                r.update(self._payload)
            return _Result(rows)
        if self._op == "upsert":
            key = "channex_property_id"
            existing = [r for r in self._store if r.get(key) == self._payload.get(key)]
            if existing:
                existing[0].update(self._payload)
                return _Result([existing[0]])
            new = dict(self._payload)
            new.setdefault("id", self._db._next_id())
            self._store.append(new)
            return _Result([new])
        return _Result(rows)


class _Result:
    def __init__(self, data) -> None:  # noqa: ANN001
        self.data = data


def _reconcile_svc(channex, db):  # noqa: ANN001, ANN201
    return ChannelManagerService(service_client=db, channex=channex)


def test_reconcile_creates_local_property() -> None:
    db = _ReconcileDB("t1", "grp-1")
    channex = _ReconcileChannex(
        [{"id": "cx-1", "attributes": {"title": "Strandhaus", "city": "Kiel"}}]
    )
    res = _reconcile_svc(channex, db).reconcile_properties_for_tenant("t1")
    assert res["created"] == 1 and res["skipped"] == 0
    assert db.properties[0]["title"] == "Strandhaus"
    assert db.properties[0]["city"] == "Kiel"
    assert db.maps[0]["channex_property_id"] == "cx-1"
    assert db.maps[0]["property_id"] == db.properties[0]["id"]


def test_reconcile_skips_property_without_title() -> None:
    db = _ReconcileDB("t1", "grp-1")
    channex = _ReconcileChannex([{"id": "cx-1", "attributes": {"city": "Kiel"}}])
    res = _reconcile_svc(channex, db).reconcile_properties_for_tenant("t1")
    assert res["skipped"] == 1 and res["created"] == 0
    assert db.properties == []  # KEIN erfundener Titel.


def test_reconcile_no_change_when_channex_down() -> None:
    db = _ReconcileDB("t1", "grp-1")
    # Bestehende Map, die ohne Ausfall gelöscht würde — bei Ausfall NICHT.
    db.properties.append({"id": "p1", "tenant_id": "t1", "title": "Alt"})
    db.maps.append(
        {"id": "m1", "tenant_id": "t1", "property_id": "p1",
         "channex_property_id": "cx-old", "deleted_at": None}
    )
    channex = _ReconcileChannex([], raises=True)
    res = _reconcile_svc(channex, db).reconcile_properties_for_tenant("t1")
    assert res == {"created": 0, "updated": 0, "soft_deleted": 0, "skipped": 0}
    assert db.maps[0]["deleted_at"] is None  # nichts gelöscht


def test_reconcile_soft_deletes_orphan_map() -> None:
    db = _ReconcileDB("t1", "grp-1")
    db.properties.append({"id": "p1", "tenant_id": "t1", "title": "Weg"})
    db.maps.append(
        {"id": "m1", "tenant_id": "t1", "property_id": "p1",
         "channex_property_id": "cx-gone", "deleted_at": None}
    )
    channex = _ReconcileChannex([])  # Channex hat 0 Properties
    res = _reconcile_svc(channex, db).reconcile_properties_for_tenant("t1")
    assert res["soft_deleted"] == 1
    assert db.maps[0]["deleted_at"] is not None


def test_reconcile_updates_existing_content() -> None:
    db = _ReconcileDB("t1", "grp-1")
    db.properties.append({"id": "p1", "tenant_id": "t1", "title": "Alter Titel"})
    db.maps.append(
        {"id": "m1", "tenant_id": "t1", "property_id": "p1",
         "channex_property_id": "cx-1", "deleted_at": None}
    )
    channex = _ReconcileChannex(
        [{"id": "cx-1", "attributes": {"title": "Neuer Titel", "city": "Hamburg"}}]
    )
    res = _reconcile_svc(channex, db).reconcile_properties_for_tenant("t1")
    assert res["updated"] == 1 and res["created"] == 0
    assert db.properties[0]["title"] == "Neuer Titel"
    assert db.properties[0]["city"] == "Hamburg"


def test_booking_feed_isolates_tenants() -> None:
    """Andys Sync zieht den kontoweiten Feed (Andy + Steffen). Steffens Buchung
    darf NICHT unter Andys tenant_id landen und NICHT ge-ackt werden."""
    andy_prop = "andy-channex-prop"
    steffen_prop = "steffen-channex-prop"
    feed = [
        {"id": "rev-andy", "attributes": {
            "property_id": andy_prop, "booking_id": "bk-andy", "status": "new"}},
        {"id": "rev-steffen", "attributes": {
            "property_id": steffen_prop, "booking_id": "bk-steffen", "status": "new"}},
    ]
    fake_channex = _FakeChannex(feed)
    fake_db = _FakeDB(own_channex_property_id=andy_prop)
    svc = ChannelManagerService(service_client=fake_db, channex=fake_channex)
    ctx = AuthContext(user_id="andy", tenant_id="tenant-andy")

    res = svc.sync_bookings(ctx)

    # Nur Andys Buchung gespeichert, Steffens übersprungen.
    assert res.fetched == 2
    assert res.saved == 1
    assert res.skipped == 1
    saved_ids = [b["channex_booking_id"] for b in fake_db.saved_bookings]
    assert saved_ids == ["bk-andy"]
    # Steffens Revision wurde NICHT ge-ackt (sein Tenant braucht sie noch).
    assert fake_channex.acked == ["rev-andy"]


# --- Import Channex → reservations / availability / Preise -------------------
class _ImportChannex:
    """Channex-Stub für den Buchungs-/ARI-Import."""

    def __init__(
        self,
        *,
        bookings=None,
        availability=None,
        restrictions=None,
        room_types=None,
        rate_plans=None,
    ) -> None:
        self.is_configured = True
        self._bookings = bookings or []
        self._availability = availability or {}
        self._restrictions = restrictions or {}
        self._room_types = room_types or []
        self._rate_plans = rate_plans or []

    def list_bookings_for_property(self, property_id, *, page=1, limit=100, inserted_after=None):  # noqa: ANN001, ANN201
        # Eine Seite (Tests klein halten).
        return {"data": self._bookings, "meta": {"total": len(self._bookings), "limit": limit, "page": page}}

    def get_availability(self, property_id, *, date_from, date_to):  # noqa: ANN001, ANN201
        return {"data": self._availability}

    def get_restrictions(self, property_id, *, date_from, date_to, restrictions):  # noqa: ANN001, ANN201
        return {"data": self._restrictions}

    def get_room_types(self, property_id):  # noqa: ANN001, ANN201
        return {"data": self._room_types}

    def get_rate_plans(self, property_id):  # noqa: ANN001, ANN201
        return {"data": self._rate_plans}


# on_conflict-Schlüssel je Tabelle (für das Fake-upsert).
_CONFLICT_KEYS = {
    "channex_property_map": ("channex_property_id",),
    "channex_room_type_map": ("channex_room_type_id",),
    "channex_rate_plan_map": ("channex_rate_plan_id",),
    "channex_booking": ("channex_booking_id",),
    "availability": ("property_id", "date"),
    "price_overrides": ("property_id", "date"),
    "stop_sell": ("property_id", "date"),
}


class _ImportDB:
    """Generische In-Memory-DB für den Import (alle relevanten Tabellen)."""

    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {
            "channex_property_map": [],
            "channex_room_type_map": [],
            "channex_rate_plan_map": [],
            "channex_booking": [],
            "reservations": [],
            "availability": [],
            "price_overrides": [],
            "stop_sell": [],
            "guests": [],
            "properties": [],
            "rate_plans": [],
        }
        self._seq = 0

    def next_id(self) -> str:
        self._seq += 1
        return f"id-{self._seq}"

    def table(self, name):  # noqa: ANN001, ANN201
        return _ImportQuery(self, name, self.tables[name])


class _ImportQuery(_ReconcileQuery):
    """Wie _ReconcileQuery, aber upsert nutzt den tabellenspezifischen Key."""

    def execute(self):  # noqa: ANN201
        rows = [r for r in self._store if self._match(r)]
        if self._op == "insert":
            new = dict(self._payload)
            new.setdefault("id", self._db.next_id())
            self._store.append(new)
            return _Result([new])
        if self._op == "update":
            for r in rows:
                r.update(self._payload)
            return _Result(rows)
        if self._op == "upsert":
            keys = _CONFLICT_KEYS.get(self._name, ("id",))
            match = [
                r for r in self._store
                if all(r.get(k) == self._payload.get(k) for k in keys)
            ]
            if match:
                match[0].update(self._payload)
                return _Result([match[0]])
            new = dict(self._payload)
            new.setdefault("id", self._db.next_id())
            self._store.append(new)
            return _Result([new])
        return _Result(rows)


def _import_svc(channex, db):  # noqa: ANN001, ANN201
    return ChannelManagerService(service_client=db, channex=channex)


def _seed_property(db, tenant_id="t1", channex_pid="cx-prop", property_id="p1"):  # noqa: ANN001, ANN201
    db.tables["properties"].append({"id": property_id, "tenant_id": tenant_id, "title": "Haus"})
    db.tables["channex_property_map"].append(
        {"id": "m1", "tenant_id": tenant_id, "property_id": property_id,
         "channex_property_id": channex_pid, "deleted_at": None}
    )


def test_ota_name_to_channel() -> None:
    f = ChannelManagerService._ota_name_to_channel
    assert f("Booking.com") == "booking"
    assert f("Airbnb") == "airbnb"
    assert f("VRBO") == "vrbo"
    assert f("Expedia") == "portal"
    assert f("Agoda") == "portal"
    assert f(None) == "portal"


def test_import_booking_creates_reservation_and_blocks_calendar() -> None:
    db = _ImportDB()
    _seed_property(db)
    channex = _ImportChannex(bookings=[{"attributes": {
        "booking_id": "BK1", "property_id": "cx-prop", "status": "new",
        "ota_name": "Booking.com", "ota_reservation_code": "R123",
        "arrival_date": "2026-07-01", "departure_date": "2026-07-03",
        "amount": "200.00", "currency": "EUR",
        "customer": {"name": "Max", "surname": "Mustermann", "mail": "m@x.de"}}}])
    res = _import_svc(channex, db).import_bookings_for_property("t1", "cx-prop")
    assert res["saved"] == 1
    r = db.tables["reservations"][0]
    assert r["channel"] == "booking" and r["ota_name"] == "Booking.com"
    assert r["source_channex_booking_id"] == "BK1" and r["status"] == "confirmed"
    # 2 Nächte (01., 02.), Abreisetag exklusiv.
    booked = [a for a in db.tables["availability"] if a["status"] == "booked"]
    assert {a["date"] for a in booked} == {"2026-07-01", "2026-07-02"}
    # Gast angelegt.
    assert db.tables["guests"][0]["email"] == "m@x.de"


def test_import_booking_idempotent() -> None:
    db = _ImportDB()
    _seed_property(db)
    booking = {"attributes": {
        "booking_id": "BK1", "property_id": "cx-prop", "status": "new",
        "ota_name": "Airbnb", "arrival_date": "2026-07-01",
        "departure_date": "2026-07-02", "amount": "100", "currency": "EUR",
        "customer": {"name": "A", "surname": "B"}}}
    svc = _import_svc(_ImportChannex(bookings=[booking]), db)
    svc.import_bookings_for_property("t1", "cx-prop")
    svc.import_bookings_for_property("t1", "cx-prop")
    assert len(db.tables["reservations"]) == 1  # kein Duplikat


def test_import_booking_cancel_frees_calendar() -> None:
    db = _ImportDB()
    _seed_property(db)
    # erst buchen, dann stornieren
    svc = _import_svc(_ImportChannex(bookings=[{"attributes": {
        "booking_id": "BK1", "property_id": "cx-prop", "status": "new",
        "ota_name": "Booking.com", "arrival_date": "2026-07-01",
        "departure_date": "2026-07-02", "amount": "100", "currency": "EUR",
        "customer": {"name": "A", "surname": "B"}}}]), db)
    svc.import_bookings_for_property("t1", "cx-prop")
    svc2 = _import_svc(_ImportChannex(bookings=[{"attributes": {
        "booking_id": "BK1", "property_id": "cx-prop", "status": "cancelled",
        "ota_name": "Booking.com", "arrival_date": "2026-07-01",
        "departure_date": "2026-07-02"}}]), db)
    svc2.import_bookings_for_property("t1", "cx-prop")
    assert db.tables["reservations"][0]["status"] == "cancelled"
    assert db.tables["availability"][0]["status"] == "open"


def test_import_booking_skips_without_property_mapping() -> None:
    db = _ImportDB()  # KEIN seed → kein Mapping
    channex = _ImportChannex(bookings=[{"attributes": {
        "booking_id": "BK1", "property_id": "cx-unknown", "status": "new",
        "arrival_date": "2026-07-01", "departure_date": "2026-07-02"}}])
    res = _import_svc(channex, db).import_bookings_for_property("t1", "cx-unknown")
    assert res["skipped"] == 1 and db.tables["reservations"] == []


def test_import_ari_prices_and_availability() -> None:
    db = _ImportDB()
    _seed_property(db)
    # availability: 1 Tag 0 (blocked), 1 Tag >0 (open)
    channex = _ImportChannex(
        availability={"cx-rt": {"2026-07-01": 0, "2026-07-02": 3}},
        restrictions={"cx-rp": {"2026-07-01": {"rate": "138.00", "stop_sell": True},
                                "2026-07-02": {"rate": "150.00"}}},
    )
    res = _import_svc(channex, db).import_ari_for_property(
        "t1", "cx-prop", days_ahead=3, today=date(2026, 7, 1)
    )
    assert res["prices"] == 2
    statuses = {a["date"]: a["status"] for a in db.tables["availability"]}
    assert statuses["2026-07-01"] == "blocked" and statuses["2026-07-02"] == "open"
    prices = {p["date"]: p["price"] for p in db.tables["price_overrides"]}
    assert prices["2026-07-01"] == 138.0 and prices["2026-07-02"] == 150.0
    assert any(s["date"] == "2026-07-01" for s in db.tables["stop_sell"])


def test_import_ari_never_overrides_booked() -> None:
    db = _ImportDB()
    _seed_property(db)
    db.tables["availability"].append(
        {"id": "a1", "property_id": "p1", "date": "2026-07-01",
         "status": "booked", "source": "booking"}
    )
    channex = _ImportChannex(availability={"cx-rt": {"2026-07-01": 5}})
    _import_svc(channex, db).import_ari_for_property(
        "t1", "cx-prop", days_ahead=1, today=date(2026, 7, 1)
    )
    # bleibt 'booked', nicht von ARI auf 'open' gesetzt
    assert db.tables["availability"][0]["status"] == "booked"
