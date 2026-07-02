from datetime import date

from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.channel_manager.service import (
    ChannelManagerError,
    ChannelManagerService,
)
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
        fail_availability=False,
    ) -> None:
        self.is_configured = True
        self._bookings = bookings or []
        self._availability = availability or {}
        self._restrictions = restrictions or {}
        self._room_types = room_types or []
        self._rate_plans = rate_plans or []
        self._fail_availability = fail_availability
        self.pushed: list[dict] = []  # update_availability-Aufrufe
        self.restrictions_pushed: list[dict] = []  # update_restrictions-Aufrufe
        self.activated: list[str] = []
        self.deactivated: list[str] = []

    def update_availability(self, values):  # noqa: ANN001, ANN201
        if self._fail_availability:
            from src.features.channel_manager.channex_client import ChannexError

            raise ChannexError("Channex down", status_code=502)
        self.pushed.extend(values)
        return {"data": values}

    def update_restrictions(self, values):  # noqa: ANN001, ANN201
        self.restrictions_pushed.extend(values)
        return {"data": values}

    def activate_channel(self, channel_id):  # noqa: ANN001, ANN201
        self.activated.append(channel_id)
        return {}

    def deactivate_channel(self, channel_id):  # noqa: ANN001, ANN201
        self.deactivated.append(channel_id)
        return {}

    def list_bookings_for_property(self, property_id, *, page=1, limit=100, inserted_after=None):  # noqa: ANN001, ANN201
        # Eine Seite (Tests klein halten).
        return {
            "data": self._bookings,
            "meta": {"total": len(self._bookings), "limit": limit, "page": page},
        }

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
    "channex_tax_map": ("property_id", "local_tax_id"),
    "guest_external_ids": ("tenant_id", "channel", "external_id"),
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
            "guest_external_ids": [],
            "properties": [],
            "rate_plans": [],
            "ari_outbox": [],
            "channex_tax_map": [],
            "channex_channel_connection": [],
            "channex_group_map": [],
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
    # Aktive Kanal-Verbindung: ohne sie greift das An/Aus-Gate und der Push wäre
    # ein No-Op. Das verbundene, AKTIVE Objekt ist der Normalfall der Push-Tests.
    db.tables["channex_channel_connection"].append(
        {"id": "c1", "tenant_id": tenant_id, "property_id": property_id,
         "ota_portal_code": "BookingCom", "is_active": True,
         "channex_channel_id": "cx-chan"}
    )


def test_ota_name_to_channel() -> None:
    f = ChannelManagerService._ota_name_to_channel
    assert f("Booking.com") == "booking"
    assert f("Airbnb") == "airbnb"
    assert f("VRBO") == "vrbo"
    assert f("Expedia") == "portal"
    assert f("Agoda") == "portal"
    assert f(None) == "portal"


def test_channex_property_type_mapping() -> None:
    from src.features.channel_manager.service import _channex_property_type

    # Lokaler deutscher Enum → gültiger Channex-Code.
    assert _channex_property_type("appartement") == "apartment"
    assert _channex_property_type("ferienhaus") == "holiday_home"
    assert _channex_property_type("glamping") == "tent"
    assert _channex_property_type("tiny_house") == "chalet"
    assert _channex_property_type("stellplatz") == "camping"
    assert _channex_property_type("hausboot") == "boat"
    # Unbekannt/leer → None (Feld wird weggelassen, kein ungültiger Wert).
    assert _channex_property_type(None) is None
    assert _channex_property_type("unbekannt") is None


def test_property_attrs_maps_property_type_for_channex() -> None:
    # Regression: der lokale property_type 'appartement' darf NICHT roh an
    # Channex gehen (422), sondern als 'apartment'.
    attrs = ChannelManagerService._property_attrs(
        {"property_type": "appartement", "country": "DE", "city": "Berlin"}
    )
    assert attrs["property_type"] == "apartment"

    # Unbekannter Typ → property_type fehlt im Payload (statt ungültig).
    attrs2 = ChannelManagerService._property_attrs(
        {"property_type": "raumschiff", "country": "DE"}
    )
    assert "property_type" not in attrs2


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
    # Zurückgelesene OTA-Raten werden NICHT als price_override geschrieben
    # (sonst Echo-Loop, der die dynamischen Engine-Preise verdeckt). Die
    # Preis-Wahrheit ist der pricing-Resolver, nicht der ARI-Reimport.
    assert res["prices"] == 0
    assert db.tables.get("price_overrides", []) == []
    # Verfügbarkeit + stop_sell sind echte OTA-Signale und werden weiter importiert.
    statuses = {a["date"]: a["status"] for a in db.tables["availability"]}
    assert statuses["2026-07-01"] == "blocked" and statuses["2026-07-02"] == "open"
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


# --- Phase 1: Realtime-Verfügbarkeits-Push (Doppelbuchungsschutz) ------------
def _seed_with_room_type(db, tenant_id="t1", channex_pid="cx-prop", property_id="p1"):  # noqa: ANN001, ANN201
    _seed_property(db, tenant_id, channex_pid, property_id)
    db.tables["channex_room_type_map"].append(
        {"id": "rt1", "tenant_id": tenant_id, "property_map_id": "m1",
         "local_unit_ref": property_id, "channex_room_type_id": "cx-rt",
         "deleted_at": None}
    )


def test_push_availability_sets_zero_and_marks_outbox_done() -> None:
    db = _ImportDB()
    _seed_with_room_type(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_availability_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25), 0
    )
    # An Channex gepusht: richtige IDs + Menge 0.
    assert channex.pushed[0]["property_id"] == "cx-prop"
    assert channex.pushed[0]["room_type_id"] == "cx-rt"
    assert channex.pushed[0]["availability"] == 0
    # Outbox-Zeile auf done.
    assert db.tables["ari_outbox"][0]["status"] == "done"


def test_push_availability_no_mapping_is_noop() -> None:
    db = _ImportDB()
    _seed_property(db)  # KEIN room_type → kein Mapping
    channex = _ImportChannex()
    _import_svc(channex, db).push_availability_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25), 0
    )
    assert channex.pushed == [] and db.tables["ari_outbox"] == []


# --- Selektives Kanal-An/Aus pro Objekt --------------------------------------

def _deactivate_all(db, property_id="p1"):  # noqa: ANN001, ANN201
    for row in db.tables["channex_channel_connection"]:
        if row["property_id"] == property_id:
            row["is_active"] = False


def test_push_availability_skipped_when_all_channels_inactive() -> None:
    # Stehen alle Kanäle des Objekts auf Aus, wird NICHT an Channex gepusht.
    db = _ImportDB()
    _seed_with_room_type(db)
    _deactivate_all(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_availability_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25), 0
    )
    assert channex.pushed == []  # Gate greift → kein Verkauf
    assert db.tables["ari_outbox"] == []


def _seed_with_rate_plan(db, tenant_id="t1", property_id="p1"):  # noqa: ANN001, ANN201
    """Volle synthetische Kette property→room_type→rate_plan (für CTA/CTD-Push)."""
    _seed_with_room_type(db, tenant_id, property_id=property_id)
    db.tables["channex_rate_plan_map"].append(
        {"id": "rpm1", "tenant_id": tenant_id, "property_id": property_id,
         "room_type_map_id": "rt1", "channex_rate_plan_id": "cx-rate",
         "deleted_at": None}
    )


def test_push_restrictions_cta_ctd_sends_to_channex() -> None:
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_restrictions_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25),
        closed_to_arrival=True, closed_to_departure=False,
    )
    assert len(channex.restrictions_pushed) == 1
    val = channex.restrictions_pushed[0]
    assert val["property_id"] == "cx-prop"
    assert val["rate_plan_id"] == "cx-rate"
    assert val["closed_to_arrival"] is True
    assert val["closed_to_departure"] is False


def test_push_restrictions_skipped_when_inactive() -> None:
    db = _ImportDB()
    _seed_with_rate_plan(db)
    _deactivate_all(db)  # alle Kanäle aus → Gate greift
    channex = _ImportChannex()
    _import_svc(channex, db).push_restrictions_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25),
        closed_to_arrival=True,
    )
    assert channex.restrictions_pushed == []


def test_push_restrictions_noop_without_flags() -> None:
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_restrictions_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25),
    )
    assert channex.restrictions_pushed == []


def test_process_ari_outbox_skips_inactive_as_done() -> None:
    # Outbox-Zeile eines abgeschalteten Objekts: als done abhaken (kein Retry).
    db = _ImportDB()
    _seed_with_room_type(db)
    _deactivate_all(db)
    db.tables["ari_outbox"].append({
        "id": "o1", "tenant_id": "t1", "property_id": "p1",
        "date_from": "2026-06-23", "date_to": "2026-06-25",
        "availability": 0, "status": "pending", "attempts": 0,
    })
    channex = _ImportChannex()
    res = _import_svc(channex, db).process_ari_outbox()
    assert channex.pushed == []
    assert res["done"] == 1
    assert db.tables["ari_outbox"][0]["status"] == "done"


def test_set_connection_active_off_deactivates_channex_channel() -> None:
    db = _ImportDB()
    _seed_with_room_type(db)
    channex = _ImportChannex()
    ctx = AuthContext(user_id="u", tenant_id="t1")
    result = _import_svc(channex, db).set_connection_active(
        ctx, property_id="p1", portal_code="BookingCom", is_active=False
    )
    assert result["is_active"] is False
    assert channex.deactivated == ["cx-chan"]  # Channex-Channel hart aus
    assert db.tables["channex_channel_connection"][0]["is_active"] is False


def test_set_connection_active_on_activates_channex_channel() -> None:
    db = _ImportDB()
    _seed_with_room_type(db)
    _deactivate_all(db)
    channex = _ImportChannex()
    ctx = AuthContext(user_id="u", tenant_id="t1")
    result = _import_svc(channex, db).set_connection_active(
        ctx, property_id="p1", portal_code="BookingCom", is_active=True
    )
    assert result["is_active"] is True
    assert channex.activated == ["cx-chan"]
    assert db.tables["channex_channel_connection"][0]["is_active"] is True


def test_set_connection_active_unknown_connection_404() -> None:
    db = _ImportDB()
    _seed_with_room_type(db)
    channex = _ImportChannex()
    ctx = AuthContext(user_id="u", tenant_id="t1")
    try:
        _import_svc(channex, db).set_connection_active(
            ctx, property_id="p1", portal_code="AirBNB", is_active=False
        )
    except ChannelManagerError as exc:
        assert exc.status_code == 404
    else:
        raise AssertionError("fremder/unbekannter Kanal muss 404 liefern")


class _ResyncChannex(_ImportChannex):
    """Wie _ImportChannex, zeichnet aber den Availability-Pull (Resync) auf."""

    def __init__(self) -> None:
        super().__init__()
        self.availability_pulled = 0

    def get_availability(self, property_id, *, date_from, date_to):  # noqa: ANN001, ANN201
        self.availability_pulled += 1
        return {"data": {}}


def test_resync_property_ari_pulls_from_channex() -> None:
    # Re-Aktivierung stellt frische ARI her (F3.5): import_ari_for_property
    # zieht die Verfügbarkeit erneut von Channex.
    db = _ImportDB()
    _seed_with_room_type(db)
    channex = _ResyncChannex()
    _import_svc(channex, db).resync_property_ari("t1", "p1")
    assert channex.availability_pulled > 0  # Resync hat Channex abgefragt


def test_push_availability_failure_keeps_outbox_pending() -> None:
    db = _ImportDB()
    _seed_with_room_type(db)
    channex = _ImportChannex(fail_availability=True)
    _import_svc(channex, db).push_availability_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25), 0
    )
    # Channex-Ausfall → Outbox bleibt pending (Retry), Buchung NICHT blockiert.
    assert db.tables["ari_outbox"][0]["status"] == "pending"


def test_process_ari_outbox_retries_pending() -> None:
    db = _ImportDB()
    _seed_with_room_type(db)
    db.tables["ari_outbox"].append({
        "id": "o1", "tenant_id": "t1", "property_id": "p1",
        "date_from": "2026-06-23", "date_to": "2026-06-25",
        "availability": 0, "status": "pending", "attempts": 1,
    })
    channex = _ImportChannex()
    res = _import_svc(channex, db).process_ari_outbox()
    assert res["done"] == 1
    assert db.tables["ari_outbox"][0]["status"] == "done"
    assert channex.pushed[0]["availability"] == 0


def test_ota_booking_pushes_zero_to_channex() -> None:
    db = _ImportDB()
    _seed_with_room_type(db)
    channex = _ImportChannex(bookings=[{"attributes": {
        "booking_id": "BK1", "property_id": "cx-prop", "status": "new",
        "ota_name": "Booking.com", "arrival_date": "2026-06-23",
        "departure_date": "2026-06-25", "amount": "100", "currency": "EUR",
        "customer": {"name": "A", "surname": "B"}}}])
    _import_svc(channex, db).import_bookings_for_property("t1", "cx-prop")
    # OTA-Buchung sperrt die Property bei Channex (availability 0).
    assert any(p["availability"] == 0 for p in channex.pushed)


# --- Phase 1: Steuern → Channex tax_sets ------------------------------------
class _TaxChannex:
    is_configured = True

    def __init__(self):  # noqa: ANN204
        self.taxes_created: list[dict] = []
        self.sets_created: list[dict] = []

    def create_tax(self, attributes):  # noqa: ANN001, ANN201
        self.taxes_created.append(attributes)
        return {"data": {"id": f"cx-tax-{len(self.taxes_created)}"}}

    def update_tax(self, tax_id, attributes):  # noqa: ANN001, ANN201
        return {"data": {"id": tax_id}}

    def create_tax_set(self, attributes):  # noqa: ANN001, ANN201
        self.sets_created.append(attributes)
        return {"data": {"id": "cx-taxset-1"}}

    def update_tax_set(self, tax_set_id, attributes):  # noqa: ANN001, ANN201
        return {"data": {"id": tax_set_id}}


def test_sync_taxes_creates_tax_and_set() -> None:
    db = _ImportDB()
    channex = _TaxChannex()
    svc = ChannelManagerService(service_client=db, channex=channex)
    prop_row = {
        "id": "p1",
        "type_attributes": {
            "pricing": {
                "taxes": [
                    {"id": "t1", "kind": "vat", "name": "19% USt",
                     "mode": "percent", "value": 19, "includedInPrice": True}
                ]
            }
        },
    }
    svc._sync_taxes(db, "t-1", "p1", "cx-prop", ["cx-rp-1"], "EUR", prop_row)
    # Tax mit korrektem Channex-Format angelegt.
    assert channex.taxes_created[0]["logic"] == "percent"
    assert channex.taxes_created[0]["type"] == "tax"
    assert channex.taxes_created[0]["rate"] == "19"
    assert channex.taxes_created[0]["is_inclusive"] is True
    # tax_set mit dem Rate-Plan verknüpft.
    assert channex.sets_created[0]["associated_rate_plan_ids"] == ["cx-rp-1"]
    assert channex.sets_created[0]["taxes"] == [{"id": "cx-tax-1", "level": 0}]
    # Mapping persistiert (inkl. tax_set_id).
    m = db.tables["channex_tax_map"][0]
    assert m["channex_tax_id"] == "cx-tax-1"
    assert m["channex_tax_set_id"] == "cx-taxset-1"


def test_sync_taxes_noop_without_taxes() -> None:
    db = _ImportDB()
    channex = _TaxChannex()
    svc = ChannelManagerService(service_client=db, channex=channex)
    svc._sync_taxes(db, "t-1", "p1", "cx-prop", ["cx-rp-1"], "EUR", {"type_attributes": {}})
    assert channex.taxes_created == [] and db.tables["channex_tax_map"] == []


# --- Phase 2: Gast-Aufschlag → per_person options ---------------------------
def test_rate_plan_options_per_room_without_surcharge() -> None:
    mode, opts = ChannelManagerService._rate_plan_options(10000, {"max_guests": 4})
    assert mode == "per_room"
    assert opts == [{"occupancy": 2, "is_primary": True, "rate": 10000}]


def test_rate_plan_options_per_person_with_surcharge() -> None:
    prop = {
        "max_guests": 3,
        "type_attributes": {"pricing": {"extraGuestCharge": 20, "extraGuestFrom": 1}},
    }
    mode, opts = ChannelManagerService._rate_plan_options(10000, prop)
    assert mode == "per_person"
    # occ1 primär = Basispreis; occ2 = +1×2000; occ3 = +2×2000.
    by_occ = {o["occupancy"]: o for o in opts}
    assert by_occ[1]["is_primary"] and by_occ[1]["rate"] == 10000
    assert by_occ[2]["derived_option"]["rate"] == [["increase_by_amount", "2000"]]
    assert by_occ[3]["derived_option"]["rate"] == [["increase_by_amount", "4000"]]


# --- Phase 4: Property-Settings (state_length + min/max price) ---------------
def test_property_attrs_includes_settings() -> None:
    attrs = ChannelManagerService._property_attrs(
        {"city": "Kiel", "type_attributes": {"pricing": {"minPrice": 50, "maxPrice": 0}}}
    )
    assert attrs["settings"]["state_length"] == 365
    assert attrs["settings"]["min_price"] == 50
    # maxPrice=0 → NICHT gesendet (kein erfundener Wert).
    assert "max_price" not in attrs["settings"]


def test_property_attrs_settings_without_pricing() -> None:
    attrs = ChannelManagerService._property_attrs({"city": "Kiel"})
    assert attrs["settings"] == {"state_length": 365}  # nur Inventartage, keine Preisgrenzen


# --- Hotel-ID-Persistierung (channex_channel_connection) ---------------------
def test_extract_hotel_id_prefers_known_keys() -> None:
    # Booking.com & Co: hotel_id; Sandbox: hotel_code.
    assert ChannelManagerService._extract_hotel_id({"hotel_id": "12345"}) == "12345"
    assert ChannelManagerService._extract_hotel_id({"hotel_code": "abc"}) == "abc"
    # Zahlen werden zu String normalisiert.
    assert ChannelManagerService._extract_hotel_id({"hotel_id": 999}) == "999"


def test_extract_hotel_id_none_without_match() -> None:
    # Kein Fallback/Raten: ohne passenden Schlüssel → None.
    assert ChannelManagerService._extract_hotel_id({}) is None
    assert ChannelManagerService._extract_hotel_id({"foo": "bar"}) is None
    assert ChannelManagerService._extract_hotel_id({"hotel_id": ""}) is None


class _ConnDB:
    """Fake-DB für channex_channel_connection: speichert Upserts, liefert Selects."""

    def __init__(self, rows: list[dict] | None = None) -> None:
        self.rows = rows or []
        self.upserts: list[dict] = []
        self.updates: list[dict] = []

    def table(self, name: str):  # noqa: ANN201
        assert name == "channex_channel_connection"
        outer = self

        class _Q:
            def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
                return self

            def eq(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
                return self

            def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
                return self

            def upsert(self, row, **_k):  # noqa: ANN001, ANN002, ANN003, ANN201
                outer.upserts.append(row)
                return self

            def update(self, row, **_k):  # noqa: ANN001, ANN002, ANN003, ANN201
                outer.updates.append(row)
                return self

            def execute(self):  # noqa: ANN201
                return _Result(outer.rows)

        return _Q()


def test_save_channel_connection_persists_white_label_fields() -> None:
    db = _ConnDB()
    svc = ChannelManagerService(service_client=db, channex=_FakeChannex([]))
    svc._save_channel_connection(
        db, "tenant-1",
        property_id="prop-1",
        channex_property_id="cx-1",
        portal_code="BookingCom",
        settings={"hotel_id": "777"},
        channel_id="chan-1",
        is_active=True,
        last_error=None,
    )
    assert len(db.upserts) == 1
    row = db.upserts[0]
    assert row["ota_hotel_id"] == "777"
    assert row["channex_channel_id"] == "chan-1"
    assert row["is_active"] is True
    assert row["property_id"] == "prop-1"
    assert row["ota_portal_code"] == "BookingCom"


def test_save_channel_connection_skips_without_hotel_id() -> None:
    # Kein Raten: ohne Hotel-ID wird nichts gespeichert.
    db = _ConnDB()
    svc = ChannelManagerService(service_client=db, channex=_FakeChannex([]))
    svc._save_channel_connection(
        db, "tenant-1",
        property_id="prop-1",
        channex_property_id="cx-1",
        portal_code="BookingCom",
        settings={},
        channel_id="chan-1",
        is_active=True,
        last_error=None,
    )
    assert db.upserts == []


def test_list_channel_connections_white_label_only() -> None:
    db = _ConnDB(
        [
            {
                "ota_portal_code": "BookingCom",
                "ota_hotel_id": "777",
                "channex_channel_id": "chan-1",
                "is_active": True,
                "last_error": None,
                "updated_at": "2026-06-22T10:00:00Z",
            }
        ]
    )
    svc = ChannelManagerService(service_client=db, channex=_FakeChannex([]))
    ctx = AuthContext(user_id="u", tenant_id="tenant-1")
    out = svc.list_channel_connections(ctx, "prop-1")
    assert len(out) == 1
    item = out[0]
    # White-label: menschlicher Portal-Name, Hotel-ID, Status — keine Credentials.
    assert item["portal"] == "Booking.com"
    assert item["hotel_id"] == "777"
    assert item["is_active"] is True
    assert set(item.keys()) == {
        "portal_code", "portal", "hotel_id", "channel_id",
        "is_active", "last_error", "updated_at",
    }


# --- Airbnb-OAuth (white-label, ohne iFrame) --------------------------------
class _OAuthChannex(_ImportChannex):
    """Channex-Stub für den Airbnb-OAuth-Flow: zeichnet die OAuth-/Channel-Calls
    auf und liefert den Verbindungsstatus (settings.tokens.user_id)."""

    def __init__(self, *, channel_settings=None, **kw) -> None:  # noqa: ANN003, ANN001
        super().__init__(**kw)
        self._channel_settings = channel_settings  # für get_channel
        self.created_channels: list[dict] = []
        self.updated_channels: list[tuple[str, dict]] = []
        self.connection_link_bodies: list[dict] = []
        self.one_time_args: list[dict] = []

    def create_channel(self, attributes):  # noqa: ANN001, ANN201
        self.created_channels.append(attributes)
        return {"data": {"id": "cx-airbnb", "attributes": {"is_active": False}}}

    def update_channel(self, channel_id, attributes):  # noqa: ANN001, ANN201
        self.updated_channels.append((channel_id, attributes))
        return {"data": {"id": channel_id, "attributes": attributes}}

    def get_channel(self, channel_id):  # noqa: ANN001, ANN201
        return {"data": {"attributes": {"settings": self._channel_settings or {}}}}

    def create_one_time_token(self, *, property_id, group_id, username):  # noqa: ANN001, ANN201
        self.one_time_args.append(
            {"property_id": property_id, "group_id": group_id, "username": username}
        )
        return "ott-123"

    def exchange_one_time_token(self, one_time_token):  # noqa: ANN001, ANN201
        assert one_time_token == "ott-123"
        return "jwt-abc"

    def create_airbnb_connection_link(self, *, jwt, connection_link):  # noqa: ANN001, ANN201
        assert jwt == "jwt-abc"
        self.connection_link_bodies.append(connection_link)
        return "https://www.airbnb.com/oauth2/auth?state=x&client_id=y"

    def list_channel_catalog(self):  # noqa: ANN201
        # Echter Katalog-Shape (verifiziert): Airbnb-`code` ist hidden (kein
        # Credential), Booking.com hat ein sichtbares hotel_id-Feld.
        return {"data": [
            {"code": "AirBNB", "params": {
                "code": {"type": "hidden", "title": "Token Code", "position": 0},
            }},
            {"code": "BookingCom", "params": {
                "hotel_id": {"type": "string", "title": "Hotel ID", "position": 0},
            }},
        ]}


def _seed_oauth(db, tenant_id="t1"):  # noqa: ANN001, ANN201
    """Property-Mapping + Group + Rate-Plan-Map für den OAuth-Flow (kein
    channex_channel_connection — den legt begin_channel_oauth selbst an)."""
    db.tables["properties"].append(
        {"id": "p1", "tenant_id": tenant_id, "title": "Haus"}
    )
    db.tables["channex_property_map"].append(
        {"id": "m1", "tenant_id": tenant_id, "property_id": "p1",
         "channex_property_id": "cx-prop", "deleted_at": None}
    )
    db.tables["channex_group_map"].append(
        {"id": "g1", "tenant_id": tenant_id, "channex_group_id": "cx-group"}
    )
    db.tables["channex_rate_plan_map"].append(
        {"id": "rpm1", "tenant_id": tenant_id, "property_id": "p1",
         "channex_rate_plan_id": "cx-rate", "deleted_at": None}
    )


def test_supported_portals_marks_airbnb_oauth() -> None:
    db = _ImportDB()
    svc = _import_svc(_OAuthChannex(), db)
    portals = {p["code"]: p for p in svc.list_supported_portals()}
    # Airbnb: OAuth, KEIN Credential-Feld.
    assert portals["AirBNB"]["connection_type"] == "oauth"
    assert portals["AirBNB"]["fields"] == []
    # Booking.com bleibt credential-basiert mit Hotel-ID-Feld.
    assert portals["BookingCom"]["connection_type"] == "credential"
    assert len(portals["BookingCom"]["fields"]) == 1


def test_begin_channel_oauth_creates_inactive_channel_and_returns_url() -> None:
    db = _ImportDB()
    _seed_oauth(db)
    channex = _OAuthChannex()
    ctx = AuthContext(user_id="andy", tenant_id="t1")
    res = _import_svc(channex, db).begin_channel_oauth(
        ctx, property_id="p1", portal_code="AirBNB", title="Mein Airbnb"
    )
    assert res["oauth_url"].startswith("https://www.airbnb.com/oauth2/auth")
    assert res["channel_id"] == "cx-airbnb"
    assert res["status"] == "pending"
    # Channel inaktiv angelegt, OHNE rate_plans (Mapping kommt später).
    assert channex.created_channels[0]["is_active"] is False
    assert "rate_plans" not in channex.created_channels[0]
    # username = user_id (kein PII-Leck), connection_link snake_case + group_id.
    assert channex.one_time_args[0]["username"] == "andy"
    body = channex.connection_link_bodies[0]
    assert body["group_id"] == "cx-group"
    assert body["channel_id"] == "cx-airbnb"
    # Verbindung persistiert (inaktiv, noch kein host_id).
    conn = db.tables["channex_channel_connection"][0]
    assert conn["ota_portal_code"] == "AirBNB"
    assert conn["is_active"] is False
    assert conn["ota_hotel_id"] is None


def test_begin_channel_oauth_rejects_credential_portal() -> None:
    db = _ImportDB()
    _seed_oauth(db)
    ctx = AuthContext(user_id="u", tenant_id="t1")
    try:
        _import_svc(_OAuthChannex(), db).begin_channel_oauth(
            ctx, property_id="p1", portal_code="BookingCom", title=None
        )
    except ChannelManagerError as exc:
        assert exc.status_code == 400
    else:
        raise AssertionError("credential-Portal darf keinen OAuth-Begin erlauben")


def test_refresh_oauth_status_connected_writes_host_id() -> None:
    db = _ImportDB()
    _seed_oauth(db)
    db.tables["channex_channel_connection"].append(
        {"id": "c1", "tenant_id": "t1", "property_id": "p1",
         "ota_portal_code": "AirBNB", "is_active": False,
         "channex_channel_id": "cx-airbnb", "ota_hotel_id": None}
    )
    channex = _OAuthChannex(channel_settings={"tokens": {"user_id": "HOST-9"}})
    ctx = AuthContext(user_id="u", tenant_id="t1")
    res = _import_svc(channex, db).refresh_channel_oauth_status(
        ctx, property_id="p1", portal_code="AirBNB"
    )
    assert res["connected"] is True
    assert res["host_id"] == "HOST-9"
    # host_id persistiert (Realtime) — aber is_active bleibt false bis finalize.
    conn = db.tables["channex_channel_connection"][0]
    assert conn["ota_hotel_id"] == "HOST-9"
    assert conn["is_active"] is False


def test_refresh_oauth_status_not_connected() -> None:
    db = _ImportDB()
    _seed_oauth(db)
    db.tables["channex_channel_connection"].append(
        {"id": "c1", "tenant_id": "t1", "property_id": "p1",
         "ota_portal_code": "AirBNB", "is_active": False,
         "channex_channel_id": "cx-airbnb", "ota_hotel_id": None}
    )
    channex = _OAuthChannex(channel_settings={})  # noch keine tokens
    ctx = AuthContext(user_id="u", tenant_id="t1")
    res = _import_svc(channex, db).refresh_channel_oauth_status(
        ctx, property_id="p1", portal_code="AirBNB"
    )
    assert res["connected"] is False
    assert res["host_id"] is None


def test_finalize_oauth_channel_maps_and_activates() -> None:
    db = _ImportDB()
    _seed_oauth(db)
    db.tables["channex_channel_connection"].append(
        {"id": "c1", "tenant_id": "t1", "property_id": "p1",
         "ota_portal_code": "AirBNB", "is_active": False,
         "channex_channel_id": "cx-airbnb", "ota_hotel_id": "HOST-9"}
    )
    channex = _OAuthChannex()
    ctx = AuthContext(user_id="u", tenant_id="t1")
    res = _import_svc(channex, db).finalize_oauth_channel(
        ctx, property_id="p1", portal_code="AirBNB",
        mappings=[{
            "rate_plan_map_id": "rpm1", "room_type_code": 11,
            "rate_plan_code": 22, "occupancy": 2,
        }],
    )
    assert res["is_active"] is True
    # Mapping per update_channel auf den BESTEHENDEN Channel + activate.
    assert channex.updated_channels[0][0] == "cx-airbnb"
    assert channex.updated_channels[0][1]["rate_plans"][0]["rate_plan_id"] == "cx-rate"
    assert channex.activated == ["cx-airbnb"]
    # Erst jetzt is_active true.
    assert db.tables["channex_channel_connection"][0]["is_active"] is True


def test_finalize_oauth_channel_requires_mappings() -> None:
    db = _ImportDB()
    _seed_oauth(db)
    db.tables["channex_channel_connection"].append(
        {"id": "c1", "tenant_id": "t1", "property_id": "p1",
         "ota_portal_code": "AirBNB", "is_active": False,
         "channex_channel_id": "cx-airbnb"}
    )
    ctx = AuthContext(user_id="u", tenant_id="t1")
    try:
        _import_svc(_OAuthChannex(), db).finalize_oauth_channel(
            ctx, property_id="p1", portal_code="AirBNB", mappings=[]
        )
    except ChannelManagerError as exc:
        assert exc.status_code == 422
    else:
        raise AssertionError("finalize ohne Mapping muss 422 liefern")


def test_to_booking_masks_customer_via_mixin() -> None:
    """Regression für den Mixin-Split: _to_booking referenziert _mask_customer
    über BookingsSyncMixin (einzige Nicht-Verbatim-Stelle des Splits)."""
    from src.features.auth.guest_masking import GuestMask

    mask = GuestMask(
        full_name=False, contact=False, amounts=True, source=True, id_docs=False
    )
    row = {
        "id": "b1",
        "channex_booking_id": "cx-1",
        "status": "new",
        "customer": {"name": "Max Mustermann", "mail": "max@example.com"},
    }
    booking = ChannelManagerService._to_booking(row, mask)
    assert booking.id == "b1"
    assert booking.external_id == "cx-1"
    # Maskierung greift: voller Name/Kontakt sind ohne Rechte nicht sichtbar.
    assert booking.customer.get("mail") is None or booking.customer.get("mail") == ""
