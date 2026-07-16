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

    def get_booking_revisions_feed(self, *, page: int = 1, limit: int = 100) -> dict:
        # Wie das echte Channex: der Feed enthält NUR un-geackte Revisionen —
        # ein Ack lässt die dahinterliegenden nachrücken (deshalb holt der
        # Sync dieselbe Seite erneut, solange ge-ackt wurde).
        start = (page - 1) * limit
        return {"data": self._revisions[start:start + limit]}

    def ack_booking_revision(self, revision_id: str) -> dict:
        self.acked.append(revision_id)
        # Geackte Revision verschwindet aus dem Feed (Channex-Semantik).
        self._revisions = [r for r in self._revisions if r.get("id") != revision_id]
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

    def ilike(self, field, value):  # noqa: ANN001, ANN201
        self._filters.append(("ilike", field, value.replace("\\", ""), False))
        return self

    def neq(self, field, value):  # noqa: ANN001, ANN201
        self._filters.append(("neq", field, value, False))
        return self

    def in_(self, field, values):  # noqa: ANN001, ANN201
        self._filters.append(("in", field, values, False))
        return self

    def gte(self, field, value):  # noqa: ANN001, ANN201
        self._filters.append(("gte", field, value, False))
        return self

    def lte(self, field, value):  # noqa: ANN001, ANN201
        self._filters.append(("lte", field, value, False))
        return self

    def lt(self, field, value):  # noqa: ANN001, ANN201
        self._filters.append(("lt", field, value, False))
        return self

    def gt(self, field, value):  # noqa: ANN001, ANN201
        self._filters.append(("gt", field, value, False))
        return self

    def or_(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
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
            elif kind == "ilike":
                ok = str(row.get(field) or "").casefold() == str(value).casefold()
            elif kind == "neq":
                ok = row.get(field) != value
            elif kind == "in":
                ok = row.get(field) in value
            elif kind == "isnull":
                ok = row.get(field) is None
                if neg:
                    ok = not ok
            elif kind == "gte":
                ok = row.get(field) is not None and row.get(field) >= value
            elif kind == "lte":
                ok = row.get(field) is not None and row.get(field) <= value
            elif kind == "lt":
                ok = row.get(field) is not None and row.get(field) < value
            elif kind == "gt":
                ok = row.get(field) is not None and row.get(field) > value
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

    # Nur Andys Buchung gespeichert, Steffens übersprungen. (fetched/skipped
    # zählen über die Abruf-Pässe: nach dem Ack wird dieselbe Seite erneut
    # geholt — Steffens un-ackbare Revision wird dabei nochmals gesehen.)
    assert res.saved == 1
    assert res.skipped >= 1
    assert res.fetched >= 2
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
        fail_restrictions=False,
    ) -> None:
        self.is_configured = True
        self._bookings = bookings or []
        self._availability = availability or {}
        self._restrictions = restrictions or {}
        self._room_types = room_types or []
        self._rate_plans = rate_plans or []
        self._fail_availability = fail_availability
        self._fail_restrictions = fail_restrictions
        self.pushed: list[dict] = []  # update_availability-Aufrufe
        self.restrictions_pushed: list[dict] = []  # update_restrictions-Aufrufe
        self.activated: list[str] = []
        self.deactivated: list[str] = []
        # Content-Sync-Aufzeichnung (create_*-Calls).
        self.created_properties: list[dict] = []
        self.created_room_types: list[dict] = []
        self.created_rate_plans: list[dict] = []
        self._rt_seq = 0
        self._rp_seq = 0

    def update_availability(self, values):  # noqa: ANN001, ANN201
        if self._fail_availability:
            from src.features.channel_manager.channex_client import ChannexError

            raise ChannexError("Channex down", status_code=502)
        self.pushed.extend(values)
        return {"data": values}

    def update_restrictions(self, values):  # noqa: ANN001, ANN201
        if self._fail_restrictions:
            from src.features.channel_manager.channex_client import ChannexError

            raise ChannexError("Channex down", status_code=502)
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

    # -- Content-Sync-Stubs (create_*/update_*): jeden Call aufzeichnen, damit der
    #    Hotel-Pfad-Test die Zuordnung Room-Type ↔ Rate-Plan prüfen kann. --
    def create_group(self, title):  # noqa: ANN001, ANN201
        return {"data": {"id": "cx-group"}}

    def assign_property_to_group(self, group_id, channex_id):  # noqa: ANN001, ANN201
        return {}

    def create_property(self, attrs):  # noqa: ANN001, ANN201
        self.created_properties.append(attrs)
        return {"data": {"id": "cx-prop"}}

    def update_property(self, channex_id, attrs):  # noqa: ANN001, ANN201
        return {"data": {"id": channex_id}}

    def create_room_type(self, attrs):  # noqa: ANN001, ANN201
        self._rt_seq += 1
        cx_id = f"cx-rt-{self._rt_seq}"
        self.created_room_types.append({**attrs, "_cx_id": cx_id})
        return {"data": {"id": cx_id}}

    def update_room_type(self, channex_id, attrs):  # noqa: ANN001, ANN201
        return {"data": {"id": channex_id}}

    def create_rate_plan(self, attrs):  # noqa: ANN001, ANN201
        self._rp_seq += 1
        cx_id = f"cx-rp-{self._rp_seq}"
        # attrs["room_type_id"] = der Channex-Room-Type, an dem der Plan hängt →
        # so lässt sich die korrekte Zuordnung je Kategorie verifizieren.
        self.created_rate_plans.append({**attrs, "_cx_id": cx_id})
        return {"data": {"id": cx_id}}

    def update_rate_plan(self, channex_id, attrs):  # noqa: ANN001, ANN201
        return {"data": {"id": channex_id}}


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
            "ari_restriction_outbox": [],
            "channex_tax_map": [],
            "channex_channel_connection": [],
            "channex_group_map": [],
            "room_types": [],
            "tenant_billing_profile": [],
            "property_photos": [],
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


def _seed_push_history(db, tenant_id="t1", property_id="p1"):  # noqa: ANN001, ANN201
    """Push-Historie (ari_outbox status=done) für IMPORT-Tests: der Warm-up-Guard
    wertet Channex-qty=0/stop_sell nur als echt, wenn schon mal gepusht wurde.
    Getrennt von _seed_property, damit PUSH-Tests eine leere Outbox behalten."""
    db.tables["ari_outbox"].append(
        {"id": "ob-seed", "tenant_id": tenant_id, "property_id": property_id,
         "status": "done", "date_from": "2020-01-01", "date_to": "2020-01-01"}
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


def test_channex_facility_ids_maps_and_drops_unknown() -> None:
    from src.features.channel_manager.service import _channex_facility_ids

    wifi = "ed553333-7f1f-434a-8c43-eb8fe96c5f54"
    ac = "cc402cc0-696b-4bd6-a5d7-4adb060bc056"
    # Bekannte Slugs → UUIDs (Reihenfolge stabil).
    assert _channex_facility_ids(["wifi", "air_conditioning"]) == [wifi, ac]
    # Unbekannt → weggelassen (kein ungültiger Wert an Channex).
    assert _channex_facility_ids(["wifi", "raumschiff"]) == [wifi]
    # Leer/None → leere Liste (leert Facilities synchron).
    assert _channex_facility_ids([]) == []
    assert _channex_facility_ids(None) == []
    # Duplikate entfernt.
    assert _channex_facility_ids(["wifi", "wifi"]) == [wifi]


def test_property_attrs_includes_facilities() -> None:
    wifi = "ed553333-7f1f-434a-8c43-eb8fe96c5f54"
    attrs = ChannelManagerService._property_attrs(
        {"country": "DE", "amenities": ["wifi"]}
    )
    assert attrs["facilities"] == [wifi]
    # amenities-Key gesetzt, aber leer → facilities=[] (leert bei Channex/OTA).
    attrs_empty = ChannelManagerService._property_attrs(
        {"country": "DE", "amenities": []}
    )
    assert attrs_empty["facilities"] == []
    # amenities gar nicht geladen → facilities-Feld fehlt (kein versehentliches Leeren).
    attrs_none = ChannelManagerService._property_attrs({"country": "DE"})
    assert "facilities" not in attrs_none


def test_availability_settings_maps_valid_channex_keys() -> None:
    from src.features.channel_manager.service import _availability_settings

    out = _availability_settings(
        {
            "cutOffTime": "18:00",
            "cutOffDays": 2,
            "maxDayAdvance": 400,
            "minStayType": "arrival",
            # Autoupdate-Toggles werden BEWUSST ignoriert (PMS = Availability-
            # Master): modification/cancellation sind hart auf false gepinnt,
            # sonst entstünde ein Doppel-Dekrement gegen unseren absoluten Push.
            "autoUpdateOnModification": True,
            "autoUpdateOnCancellation": True,
        }
    )
    assert out == {
        "cut_off_time": "18:00",
        "cut_off_days": 2,
        "max_day_advance": 400,
        "min_stay_type": "arrival",
        "allow_availability_autoupdate_on_modification": False,
        "allow_availability_autoupdate_on_cancellation": False,
    }


def test_availability_settings_drops_invalid_and_empty() -> None:
    from src.features.channel_manager.service import _availability_settings

    # Leerer Block → nur die fest gepinnten Autoupdate-Flags (PMS = Master).
    assert _availability_settings({}) == {
        "allow_availability_autoupdate_on_modification": False,
        "allow_availability_autoupdate_on_cancellation": False,
    }
    # Ungültige Cut-Off-Zeit / negative Zahlen / unbekannter Typ → weglassen.
    out = _availability_settings(
        {
            "cutOffTime": "25:99",
            "cutOffDays": -1,
            "maxDayAdvance": 0,
            "minStayType": "raumschiff",
        }
    )
    assert out == {
        "allow_availability_autoupdate_on_modification": False,
        "allow_availability_autoupdate_on_cancellation": False,
    }
    # cutOffTime="" (Nutzer schaltet aus) ist kein gültiges HH:MM → nicht senden.
    assert "cut_off_time" not in _availability_settings({"cutOffTime": ""})
    # bool ist kein gültiger int für cut_off_days (Python: True == 1) — abweisen.
    # (Die fest gepinnten Autoupdate-Flags bleiben immer im Ergebnis.)
    assert _availability_settings({"cutOffDays": True}) == {
        "allow_availability_autoupdate_on_modification": False,
        "allow_availability_autoupdate_on_cancellation": False,
    }


def test_property_attrs_includes_availability_settings() -> None:
    attrs = ChannelManagerService._property_attrs(
        {
            "country": "DE",
            "type_attributes": {"availability": {"cutOffTime": "20:00"}},
        }
    )
    assert attrs["settings"]["cut_off_time"] == "20:00"
    # state_length = 500 (Channex-Zertifizierung Test 1: 500-Tage-Full-Sync).
    assert attrs["settings"]["state_length"] == 500


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


def test_import_booking_shortened_frees_old_nights() -> None:
    """Regression: eine OTA-Buchung wird verkürzt (10.-13. → 10.-11.). Die durch
    die Änderung geräumten Alt-Nächte (11., 12.) müssen lokal auf 'open' und bei
    Channex auf availability=1 zurückfallen — sonst dauerhafte Phantom-Belegung."""
    db = _ImportDB()
    _seed_property(db)
    svc = _import_svc(_ImportChannex(bookings=[{"attributes": {
        "booking_id": "BK1", "property_id": "cx-prop", "status": "new",
        "ota_name": "Booking.com", "arrival_date": "2026-07-10",
        "departure_date": "2026-07-13", "amount": "300", "currency": "EUR",
        "customer": {"name": "A", "surname": "B"}}}]), db)
    svc.import_bookings_for_property("t1", "cx-prop")
    # Ursprünglich 3 Nächte gesperrt (10., 11., 12.).
    booked = {a["date"] for a in db.tables["availability"] if a["status"] == "booked"}
    assert booked == {"2026-07-10", "2026-07-11", "2026-07-12"}
    # Verkürzung auf 10.-11. (nur noch 1 Nacht: der 10.).
    channex2 = _ImportChannex(bookings=[{"attributes": {
        "booking_id": "BK1", "property_id": "cx-prop", "status": "modified",
        "ota_name": "Booking.com", "arrival_date": "2026-07-10",
        "departure_date": "2026-07-11", "amount": "100", "currency": "EUR",
        "customer": {"name": "A", "surname": "B"}}}])
    _import_svc(channex2, db).import_bookings_for_property("t1", "cx-prop")
    avail = {a["date"]: a["status"] for a in db.tables["availability"]}
    # Die verbliebene Nacht bleibt gesperrt, die geräumten Alt-Nächte sind frei
    # (quellengenau über _free_ota_nights, denselben Pfad wie der Voll-Storno, der
    # die Channex-Freigabe availability=1 bereits abgedeckt hat).
    assert avail["2026-07-10"] == "booked"
    assert avail["2026-07-11"] == "open"
    assert avail["2026-07-12"] == "open"
    # Kein Duplikat — dieselbe Reservierung, neuer Zeitraum.
    assert len(db.tables["reservations"]) == 1
    assert db.tables["reservations"][0]["check_out"] == "2026-07-11"


def test_import_booking_object_change_frees_old_property() -> None:
    """Regression (Wurzel 1): eine OTA-Revision behält die booking_id, ändert aber
    das Objekt (Gast bucht von Objekt A auf B um). Die Alt-Nächte auf Objekt A
    müssen komplett freigegeben werden — sonst bleibt A dauerhaft phantombelegt,
    während die Reservierung + Sperre auf B liegen."""
    db = _ImportDB()
    _seed_property(db, channex_pid="cx-a", property_id="p-a")
    _seed_property(db, channex_pid="cx-b", property_id="p-b")
    # Erstbuchung auf Objekt A (cx-a), 10.-12. (2 Nächte).
    _import_svc(_ImportChannex(bookings=[{"attributes": {
        "booking_id": "BK1", "property_id": "cx-a", "status": "new",
        "ota_name": "Booking.com", "arrival_date": "2026-07-10",
        "departure_date": "2026-07-12", "amount": "200", "currency": "EUR",
        "customer": {"name": "A", "surname": "B"}}}]), db).import_bookings_for_property(
            "t1", "cx-a")
    booked_a = {a["date"] for a in db.tables["availability"]
                if a["property_id"] == "p-a" and a["status"] == "booked"}
    assert booked_a == {"2026-07-10", "2026-07-11"}
    # Objektwechsel: gleiche booking_id, jetzt Objekt B (cx-b), gleicher Zeitraum.
    _import_svc(_ImportChannex(bookings=[{"attributes": {
        "booking_id": "BK1", "property_id": "cx-b", "status": "modified",
        "ota_name": "Booking.com", "arrival_date": "2026-07-10",
        "departure_date": "2026-07-12", "amount": "200", "currency": "EUR",
        "customer": {"name": "A", "surname": "B"}}}]), db).import_bookings_for_property(
            "t1", "cx-b")
    avail = {(a["property_id"], a["date"]): a["status"] for a in db.tables["availability"]}
    # Objekt A: beide Alt-Nächte wieder frei (kein Phantom).
    assert avail[("p-a", "2026-07-10")] == "open"
    assert avail[("p-a", "2026-07-11")] == "open"
    # Objekt B: die neuen Nächte gesperrt.
    assert avail[("p-b", "2026-07-10")] == "booked"
    assert avail[("p-b", "2026-07-11")] == "booked"
    # Dieselbe Reservierung, jetzt auf Objekt B (kein Duplikat).
    assert len(db.tables["reservations"]) == 1
    assert db.tables["reservations"][0]["property_id"] == "p-b"


def test_import_booking_skips_without_property_mapping() -> None:
    db = _ImportDB()  # KEIN seed → kein Mapping
    channex = _ImportChannex(bookings=[{"attributes": {
        "booking_id": "BK1", "property_id": "cx-unknown", "status": "new",
        "arrival_date": "2026-07-01", "departure_date": "2026-07-02"}}])
    res = _import_svc(channex, db).import_bookings_for_property("t1", "cx-unknown")
    assert res["skipped"] == 1 and db.tables["reservations"] == []


def test_import_ari_skipped_when_not_managed() -> None:
    # Nicht bei Channex gemanaged (property_map soft-deleted) → Channex ist nicht
    # die Verfügbarkeits-Wahrheit; der Import darf availability/stop_sell NICHT
    # überschreiben (sonst flächig 'blocked' + anonyme stop_sell-Zeilen aus
    # Channex' Default availability=0). Inaktive Kanäle allein blocken NICHT mehr.
    db = _ImportDB()
    _seed_property(db)
    for row in db.tables["channex_property_map"]:
        row["deleted_at"] = "2026-01-01T00:00:00Z"
    channex = _ImportChannex(
        availability={"cx-rt": {"2026-07-01": 0}},
        restrictions={"cx-rp": {"2026-07-01": {"stop_sell": True}}},
    )
    res = _import_svc(channex, db).import_ari_for_property(
        "t1", "cx-prop", days_ahead=1, today=date(2026, 7, 1)
    )
    assert res == {"prices": 0, "availability": 0, "stop_sell": 0}
    assert db.tables["availability"] == []
    assert db.tables["stop_sell"] == []


def test_import_ari_runs_when_managed_without_channel() -> None:
    # Managed-Objekt ohne aktiven OTA-Kanal: Import läuft und schreibt 'open' für
    # qty>0 (nach der Entkopplung liefert Channex echte Werte statt Default 0).
    db = _ImportDB()
    _seed_property(db)
    for conn in db.tables["channex_channel_connection"]:
        conn["is_active"] = False  # kein aktiver Kanal — darf Import NICHT stoppen
    channex = _ImportChannex(
        availability={"cx-rt": {"2026-07-01": 3}},
    )
    res = _import_svc(channex, db).import_ari_for_property(
        "t1", "cx-prop", days_ahead=1, today=date(2026, 7, 1)
    )
    assert res["availability"] == 1
    statuses = {a["date"]: a["status"] for a in db.tables["availability"]}
    assert statuses["2026-07-01"] == "open"


def test_import_ari_no_push_history_suppresses_default_block() -> None:
    # Warm-up-Guard: ein gemapptes Objekt OHNE Push-Historie meldet bei Channex
    # per Default qty=0 / stop_sell für alle Tage. Das ist Rauschen, kein echter
    # OTA-Zustand → NICHT als 'blocked'/'channex'-stop_sell übernehmen (sonst
    # flächige Sperre über alle 3 Plattformen). qty>0 → 'open' bleibt erlaubt.
    db = _ImportDB()
    _seed_property(db)  # KEIN _seed_push_history → nie gepusht
    channex = _ImportChannex(
        availability={"cx-rt": {"2026-07-01": 0, "2026-07-02": 5}},
        restrictions={"cx-rp": {"2026-07-01": {"stop_sell": True}}},
    )
    res = _import_svc(channex, db).import_ari_for_property(
        "t1", "cx-prop", days_ahead=3, today=date(2026, 7, 1)
    )
    statuses = {a["date"]: a["status"] for a in db.tables["availability"]}
    # qty=0 ohne Push-Historie → KEIN blocked geschrieben.
    assert "2026-07-01" not in statuses
    # qty>0 → open läuft trotzdem ein (echte Freigabe).
    assert statuses.get("2026-07-02") == "open"
    # Channex-Default-stop_sell ohne Push-Historie → nicht importiert.
    assert db.tables["stop_sell"] == []
    assert res["stop_sell"] == 0


def test_import_ari_prices_and_availability() -> None:
    db = _ImportDB()
    _seed_property(db)
    _seed_push_history(db)
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


def test_import_ari_stop_sell_skips_manual_day() -> None:
    # Regression gegen Datenzerstörung: ein manuell gesetzter Stop-Sell (mit
    # agency_id/reason) wird an Channex gepusht und kommt als Echo zurück. Der
    # Import darf die manuelle Zeile NICHT zu source=channex degradieren und
    # agency_id/reason NICHT auf NULL setzen.
    db = _ImportDB()
    _seed_property(db)
    _seed_push_history(db)
    db.tables["stop_sell"].append(
        {"id": "s1", "tenant_id": "t1", "property_id": "p1",
         "date": "2026-07-01", "source": "manual",
         "agency_id": "ag-tui", "reason": "TUI"}
    )
    channex = _ImportChannex(
        restrictions={"cx-rp": {"2026-07-01": {"stop_sell": True}}}
    )
    res = _import_svc(channex, db).import_ari_for_property(
        "t1", "cx-prop", days_ahead=1, today=date(2026, 7, 1)
    )
    assert res["stop_sell"] == 0
    row = db.tables["stop_sell"][0]
    assert row["source"] == "manual"
    assert row["agency_id"] == "ag-tui"
    assert row["reason"] == "TUI"


def test_import_ari_stop_sell_idempotent_channex() -> None:
    # Bestehender channex-Tag: kein zweiter Upsert (kein updated_at-Bump →
    # keine Realtime-Event-Flut).
    db = _ImportDB()
    _seed_property(db)
    _seed_push_history(db)
    db.tables["stop_sell"].append(
        {"id": "s1", "tenant_id": "t1", "property_id": "p1",
         "date": "2026-07-01", "source": "channex"}
    )
    channex = _ImportChannex(
        restrictions={"cx-rp": {"2026-07-01": {"stop_sell": True}}}
    )
    res = _import_svc(channex, db).import_ari_for_property(
        "t1", "cx-prop", days_ahead=1, today=date(2026, 7, 1)
    )
    assert res["stop_sell"] == 0
    assert len(db.tables["stop_sell"]) == 1


def test_import_ari_stop_sell_writes_new_channex_day() -> None:
    # Echter neuer OTA-Stop (kein bestehender Eintrag) → als channex importiert.
    db = _ImportDB()
    _seed_property(db)
    _seed_push_history(db)
    channex = _ImportChannex(
        restrictions={"cx-rp": {"2026-07-01": {"stop_sell": True}}}
    )
    res = _import_svc(channex, db).import_ari_for_property(
        "t1", "cx-prop", days_ahead=1, today=date(2026, 7, 1)
    )
    assert res["stop_sell"] == 1
    row = db.tables["stop_sell"][0]
    assert row["source"] == "channex" and row["date"] == "2026-07-01"


def test_import_ari_stop_sell_skips_booked_day() -> None:
    # Ein gebuchter Tag darf NIE als Stop-Sell importiert werden (der Tag ist
    # verkauft; Stop-Sell darüber verfälscht die Verfügbarkeit).
    db = _ImportDB()
    _seed_property(db)
    _seed_push_history(db)
    db.tables["availability"].append(
        {"id": "a1", "property_id": "p1", "date": "2026-07-01",
         "status": "booked", "source": "direct"}
    )
    channex = _ImportChannex(
        restrictions={"cx-rp": {"2026-07-01": {"stop_sell": True}}}
    )
    res = _import_svc(channex, db).import_ari_for_property(
        "t1", "cx-prop", days_ahead=1, today=date(2026, 7, 1)
    )
    assert res["stop_sell"] == 0
    assert db.tables["stop_sell"] == []


def test_import_ari_stop_sell_dedupes_across_rate_plans() -> None:
    # Derselbe Tag in zwei Rate-Plänen → nur EIN Schreibvorgang (set-Dedup).
    db = _ImportDB()
    _seed_property(db)
    _seed_push_history(db)
    channex = _ImportChannex(
        restrictions={
            "rp-a": {"2026-07-01": {"stop_sell": True}},
            "rp-b": {"2026-07-01": {"stop_sell": True}},
        }
    )
    res = _import_svc(channex, db).import_ari_for_property(
        "t1", "cx-prop", days_ahead=1, today=date(2026, 7, 1)
    )
    assert res["stop_sell"] == 1
    assert len(db.tables["stop_sell"]) == 1


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


def _unmanage(db, property_id="p1"):  # noqa: ANN001, ANN201
    """Objekt „nicht mehr bei Channex gemanaged" machen (property_map soft-delete)
    → das Push-/Import-Gate _is_channex_managed greift."""
    for row in db.tables["channex_property_map"]:
        if row["property_id"] == property_id:
            row["deleted_at"] = "2026-01-01T00:00:00Z"


def test_push_availability_runs_without_active_channel() -> None:
    # Kern-Regression gegen den Deadlock: ein bei Channex gemanagtes Objekt
    # pusht Verfügbarkeit, AUCH wenn kein OTA-Kanal (aktiv) verbunden ist.
    db = _ImportDB()
    _seed_with_room_type(db)
    _deactivate_all(db)  # alle OTA-Kanäle aus — darf den Push NICHT mehr stoppen
    channex = _ImportChannex()
    _import_svc(channex, db).push_availability_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25), 0
    )
    assert channex.pushed != []  # managed → Push läuft trotz inaktiver Kanäle


def test_push_availability_skipped_when_not_managed() -> None:
    # Nicht bei Channex angelegt (property_map soft-deleted) → kein Push.
    db = _ImportDB()
    _seed_with_room_type(db)
    _unmanage(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_availability_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25), 0
    )
    assert channex.pushed == []
    assert db.tables["ari_outbox"] == []


def _seed_with_rate_plan(db, tenant_id="t1", property_id="p1"):  # noqa: ANN001, ANN201
    """Volle synthetische Kette property→room_type→rate_plan (für CTA/CTD-Push)."""
    _seed_with_room_type(db, tenant_id, property_id=property_id)
    db.tables["channex_rate_plan_map"].append(
        {"id": "rpm1", "tenant_id": tenant_id, "property_id": property_id,
         "room_type_map_id": "rt1", "channex_rate_plan_id": "cx-rate",
         "deleted_at": None}
    )


def _seed_hotel_mapping(db, tenant_id="t1", channex_pid="cx-prop", property_id="p1"):  # noqa: ANN001, ANN201
    """HOTEL-Kette: je Zimmerkategorie ein eigener Channex-Room-Type mit
    local_unit_ref = room_type.id (NICHT property_id) — genau die Konstellation, die
    der frühere _resolve_channex_rate_plans nie fand. Zwei Kategorien, je 1 Plan."""
    _seed_property(db, tenant_id, channex_pid, property_id)
    db.tables["channex_room_type_map"].extend([
        {"id": "hrt-a", "tenant_id": tenant_id, "property_map_id": "m1",
         "local_unit_ref": "room-a", "channex_room_type_id": "cx-rt-a",
         "deleted_at": None},
        {"id": "hrt-b", "tenant_id": tenant_id, "property_map_id": "m1",
         "local_unit_ref": "room-b", "channex_room_type_id": "cx-rt-b",
         "deleted_at": None},
    ])
    db.tables["channex_rate_plan_map"].extend([
        {"id": "hrpm-a", "tenant_id": tenant_id, "property_id": property_id,
         "room_type_map_id": "hrt-a", "channex_rate_plan_id": "cx-rp-a",
         "local_rate_plan_id": "rp-a", "deleted_at": None},
        {"id": "hrpm-b", "tenant_id": tenant_id, "property_id": property_id,
         "room_type_map_id": "hrt-b", "channex_rate_plan_id": "cx-rp-b",
         "local_rate_plan_id": "rp-b", "deleted_at": None},
    ])


def test_resolve_rate_plans_finds_hotel_room_type_plans() -> None:
    # Regression: Hotel-Mappings hängen an local_unit_ref = room_type.id, nicht
    # property_id. Der Resolver muss ALLE Room-Type-Maps einsammeln, sonst bleibt
    # jeder Hotel-Push ewig 'pending' ('Rate-Plan-Mapping fehlt noch').
    db = _ImportDB()
    _seed_hotel_mapping(db)
    svc = _import_svc(_ImportChannex(), db)
    plans = svc._resolve_channex_rate_plans(db, "t1", "p1")
    assert {p["channex_rate_plan_id"] for p in plans} == {"cx-rp-a", "cx-rp-b"}
    assert {p["local_rate_plan_id"] for p in plans} == {"rp-a", "rp-b"}
    assert all(p["channex_property_id"] == "cx-prop" for p in plans)


def test_push_rates_batch_hotel_targets_matching_plan() -> None:
    # Ein rate-plan-genaues Segment (Hotel) geht NUR an den passenden Channex-Plan.
    db = _ImportDB()
    _seed_hotel_mapping(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_rates_batch(
        "t1", "p1",
        [{"date_from": date(2099, 6, 23), "date_to": date(2099, 6, 23),
          "rate_cents": 24100, "rate_plan_id": "rp-a"}],
    )
    assert len(channex.restrictions_pushed) == 1
    assert channex.restrictions_pushed[0]["rate_plan_id"] == "cx-rp-a"


def test_push_rates_batch_hotel_no_plan_id_hits_all() -> None:
    # min_stay-Default (kein rate_plan_id): an ALLE Hotel-Rate-Plans (property-weit).
    db = _ImportDB()
    _seed_hotel_mapping(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_rates_batch(
        "t1", "p1",
        [{"date_from": date(2099, 6, 23), "date_to": date(2099, 6, 23),
          "min_stay": 3}],
    )
    assert {v["rate_plan_id"] for v in channex.restrictions_pushed} == {"cx-rp-a", "cx-rp-b"}


def test_push_restrictions_cta_ctd_sends_to_channex() -> None:
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_restrictions_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25),
        closed_to_arrival=True, closed_to_departure=False,
    )
    # restrictions muss PRO DATUM gesendet werden (date_from/date_to wird von
    # Channex still ignoriert, live verifiziert) → 23.–25. Juni = 3 values.
    assert len(channex.restrictions_pushed) == 3
    dates = {v["date"] for v in channex.restrictions_pushed}
    assert dates == {"2026-06-23", "2026-06-24", "2026-06-25"}
    val = channex.restrictions_pushed[0]
    assert val["property_id"] == "cx-prop"
    assert val["rate_plan_id"] == "cx-rate"
    assert "date_from" not in val  # kein Bereich mehr
    assert val["closed_to_arrival"] is True
    assert val["closed_to_departure"] is False


def test_push_restrictions_runs_without_active_channel() -> None:
    # Managed-Objekt: Restriktionen gehen an Channex, auch ohne aktiven OTA-Kanal.
    db = _ImportDB()
    _seed_with_rate_plan(db)
    _deactivate_all(db)  # alle Kanäle aus — darf den Push NICHT stoppen
    channex = _ImportChannex()
    _import_svc(channex, db).push_restrictions_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25),
        closed_to_arrival=True,
    )
    assert channex.restrictions_pushed != []


def test_push_restrictions_skipped_when_not_managed() -> None:
    db = _ImportDB()
    _seed_with_rate_plan(db)
    _unmanage(db)  # property_map soft-deleted → Gate greift
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


def test_push_max_stay_sends_to_channex() -> None:
    # Channex-Key ist max_stay (NICHT max_stay_arrival — das persistiert Channex
    # nicht; live verifiziert).
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_max_stay_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25), 14
    )
    # Pro Datum (date_from/date_to wird still ignoriert): 23.–25. Juni = 3 values.
    assert len(channex.restrictions_pushed) == 3
    val = channex.restrictions_pushed[0]
    assert val["property_id"] == "cx-prop"
    assert val["rate_plan_id"] == "cx-rate"
    assert val["max_stay"] == 14
    assert "date" in val and "date_from" not in val
    assert "max_stay_arrival" not in val


def test_push_rate_min_stay_expands_per_date() -> None:
    # Regression (der Bug, den der Nutzer sah): min_stay per date_from/date_to
    # wurde von Channex still ignoriert -> Kalender blieb auf 1. Jetzt: ein value
    # PRO Datum mit `date`, min_stay_arrival UND min_stay_through gesetzt.
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_rate_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25), min_stay=3
    )
    assert len(channex.restrictions_pushed) == 3
    for v in channex.restrictions_pushed:
        assert "date" in v and "date_from" not in v
        assert v["min_stay_arrival"] == 3
        assert v["min_stay_through"] == 3


def test_push_max_stay_skipped_when_not_managed() -> None:
    db = _ImportDB()
    _seed_with_rate_plan(db)
    _unmanage(db)  # property_map soft-deleted → Gate greift
    channex = _ImportChannex()
    _import_svc(channex, db).push_max_stay_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25), 14
    )
    assert channex.restrictions_pushed == []


def test_process_ari_outbox_skips_unmanaged_as_done() -> None:
    # Outbox-Zeile eines NICHT bei Channex gemanagten Objekts: als done abhaken
    # (kein Endlos-Retry). Inaktive Kanäle allein stoppen den Push NICHT mehr.
    db = _ImportDB()
    _seed_with_room_type(db)
    _unmanage(db)
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


def test_process_ari_outbox_pushes_when_managed_without_channel() -> None:
    # Managed-Objekt ohne aktiven Kanal: Outbox wird verarbeitet (Push läuft).
    db = _ImportDB()
    _seed_with_room_type(db)
    _deactivate_all(db)
    db.tables["ari_outbox"].append({
        "id": "o1", "tenant_id": "t1", "property_id": "p1",
        "date_from": "2026-06-23", "date_to": "2026-06-25",
        "availability": 1, "status": "pending", "attempts": 0,
    })
    channex = _ImportChannex()
    res = _import_svc(channex, db).process_ari_outbox()
    assert channex.pushed != []
    assert res["done"] == 1


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


def test_connect_property_rejects_foreign_channex_id() -> None:
    """Eine channex_property_id, die einem FREMDEN Tenant gehört, darf nicht per
    client-übergebener external_property_ref übernommen/überschrieben werden (409)."""
    from src.features.channel_manager.schemas import PropertyConnectRequest

    db = _ImportDB()
    # Eigenes Objekt von t1.
    db.tables["properties"].append(
        {"id": "p1", "tenant_id": "t1", "title": "Haus", "currency": "EUR"}
    )
    # Fremdes, bereits verbundenes Mapping von t2 mit derselben Channex-ID.
    db.tables["channex_property_map"].append(
        {"id": "m-foreign", "tenant_id": "t2", "property_id": "p-foreign",
         "channex_property_id": "cx-shared", "deleted_at": None}
    )
    ctx = AuthContext(user_id="u", tenant_id="t1")
    channex = _ImportChannex()
    req = PropertyConnectRequest(property_id="p1", external_property_ref="cx-shared")
    try:
        _import_svc(channex, db).connect_property(ctx, req)
    except ChannelManagerError as exc:
        assert exc.status_code == 409
    else:
        raise AssertionError("fremde channex_property_id muss 409 liefern")
    # Das fremde Mapping bleibt unverändert bei t2 (nicht übernommen).
    foreign = db.tables["channex_property_map"][0]
    assert foreign["tenant_id"] == "t2"
    # Kein neues Mapping für t1 entstanden.
    assert len(db.tables["channex_property_map"]) == 1


def test_connect_property_reuses_own_channex_id() -> None:
    """Dieselbe channex_property_id des EIGENEN Tenants ist erlaubt (Re-Connect)."""
    from src.features.channel_manager.schemas import PropertyConnectRequest

    db = _ImportDB()
    db.tables["properties"].append(
        {"id": "p1", "tenant_id": "t1", "title": "Haus", "currency": "EUR"}
    )
    db.tables["channex_property_map"].append(
        {"id": "m1", "tenant_id": "t1", "property_id": "p1",
         "channex_property_id": "cx-own", "deleted_at": None}
    )
    ctx = AuthContext(user_id="u", tenant_id="t1")
    channex = _ImportChannex()
    req = PropertyConnectRequest(property_id="p1", external_property_ref="cx-own")
    res = _import_svc(channex, db).connect_property(ctx, req)
    assert res.property_id == "p1"
    assert len(db.tables["channex_property_map"]) == 1


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


class _RatePlanChannex:
    """Channex-Stub, der die beim Rate-Plan-Anlegen gesendeten attrs festhält."""

    is_configured = True

    def __init__(self) -> None:
        self.created: list[dict] = []

    def create_rate_plan(self, attrs):  # noqa: ANN001, ANN201
        self.created.append(attrs)
        return {"data": {"id": "cx-rp-new"}}


def test_rate_plan_sync_sends_min_stay_to_channex() -> None:
    # Regression: rate_plans.min_stay=3 MUSS als min_stay_arrival/through an
    # Channex gehen (7er-Array Mo–So). Ohne den Fix blieb Channex bei Default 1
    # (live verifiziert). Der Bug: _upsert_channex_rate_plan schrieb min_stay
    # nicht in die attrs.
    db = _ImportDB()
    _seed_with_room_type(db)
    rt_map = db.tables["channex_room_type_map"][0]
    channex = _RatePlanChannex()
    svc = _import_svc(channex, db)
    svc._upsert_channex_rate_plan(
        db, "t1", rt_map["id"], "cx-prop", "cx-rt",
        {"id": "rp1", "name": "Standard", "base_price": 129, "min_stay": 3},
        "EUR",
    )
    assert channex.created, "create_rate_plan wurde nicht aufgerufen"
    sent = channex.created[0]
    assert sent["min_stay_arrival"] == [3, 3, 3, 3, 3, 3, 3]
    assert sent["min_stay_through"] == [3, 3, 3, 3, 3, 3, 3]


def test_rate_plan_sync_omits_min_stay_when_unset() -> None:
    # min_stay=1 (Default) oder fehlend → keine min_stay-Felder senden (Channex
    # bleibt auf seinem Default, kein überflüssiger Push). 1×7 wäre auch ok, aber
    # wir senden nur, was der Nutzer über 1 hinaus gesetzt hat.
    db = _ImportDB()
    _seed_with_room_type(db)
    rt_map = db.tables["channex_room_type_map"][0]
    channex = _RatePlanChannex()
    svc = _import_svc(channex, db)
    svc._upsert_channex_rate_plan(
        db, "t1", rt_map["id"], "cx-prop", "cx-rt",
        {"id": "rp2", "name": "Standard", "base_price": 99, "min_stay": None},
        "EUR",
    )
    sent = channex.created[0]
    assert "min_stay_arrival" not in sent


# --- Room-Type-Belegung aus echten Objektdaten (occ_*, count_of_rooms) --------
def test_room_type_occupancy_from_object_data() -> None:
    occ = ChannelManagerService._room_type_occupancy(
        {
            "max_guests": 4,
            "type_attributes": {"occupancy": {"children": 2, "infants": 1, "rooms": 3}},
        }
    )
    assert occ["occ_adults"] == 4
    assert occ["default_occupancy"] == 4
    assert occ["occ_children"] == 2
    assert occ["occ_infants"] == 1
    assert occ["count_of_rooms"] == 3


def test_room_type_occupancy_defaults_when_missing() -> None:
    # Ohne occupancy-Block: Kinder/Kleinkinder 0, mind. 1 Zimmer, occ_adults ≥ 1.
    occ = ChannelManagerService._room_type_occupancy({"max_guests": 1})
    assert occ == {
        "count_of_rooms": 1,
        "occ_adults": 1,
        "occ_children": 0,
        "occ_infants": 0,
        "default_occupancy": 1,
    }
    # Gar keine Objektdaten → sichere Mindestwerte (occ_adults 2 = Default).
    assert ChannelManagerService._room_type_occupancy(None)["occ_adults"] == 2


# --- Phase 4: Property-Settings (state_length + min/max price) ---------------
def test_property_attrs_includes_settings() -> None:
    attrs = ChannelManagerService._property_attrs(
        {"city": "Kiel", "type_attributes": {"pricing": {"minPrice": 50, "maxPrice": 0}}}
    )
    assert attrs["settings"]["state_length"] == 500
    assert attrs["settings"]["min_price"] == 50
    # maxPrice=0 → NICHT gesendet (kein erfundener Wert).
    assert "max_price" not in attrs["settings"]


def test_property_attrs_settings_without_pricing() -> None:
    attrs = ChannelManagerService._property_attrs({"city": "Kiel"})
    # Inventartage + fest gepinnte Autoupdate-Flags (PMS = Master); keine Preisgrenzen.
    assert attrs["settings"] == {
        "state_length": 500,
        "allow_availability_autoupdate_on_modification": False,
        "allow_availability_autoupdate_on_cancellation": False,
    }


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


# --- Kontoweites Channex-Budget: PRO-CALL-Gate (Bypass-Fix) ------------------
# Regression für den Batch-Bypass: früher zog der Worker EIN Token vor dem
# Handler; ein Batch-Job (process_ari_outbox mit bis zu 200 Zeilen, reconcile
# über hunderte Objekte) feuerte danach N Channex-Calls für dieses 1 Token und
# umging das kontoweite Limit. Der Fix zieht ein Token PRO ECHTEM HTTP-CALL im
# ChannexClient (before_call-Callback); erschöpftes Budget → ChannexBudgetExhausted.

def _budget_client(*, allow: bool):  # noqa: ANN202
    """Realer ChannexClient mit gesetztem before_call. `allow=False` verweigert
    jedes Token (deny-all), damit KEIN echter HTTP-Call passiert. api_key gesetzt
    → is_configured, damit die Handler nicht schon am Konfig-Gate no-oppen.

    retry_after=0 bei Ablehnung: kein Kurz-Wait (die Waits sind für „Fenster
    gleich frei"-Fälle da), damit der Test ohne echte time.sleep-Wartezeit
    genau EINEN before_call-Aufruf je HTTP-Call sieht."""
    from src.features.channel_manager.channex_client import ChannexClient
    from src.jobs.channex_budget import BudgetDecision

    calls: list[str | None] = []

    def before_call(channex_property_id):  # noqa: ANN001, ANN202
        calls.append(channex_property_id)
        return BudgetDecision(allowed=allow, retry_after=0)

    client = ChannexClient(
        api_key="test-key", base_url="https://channex.test/api/v1",
        before_call=before_call,
    )
    return client, calls


def test_channex_client_raises_when_budget_exhausted_without_http() -> None:
    from unittest.mock import patch

    from src.features.channel_manager.channex_client import ChannexBudgetExhausted

    client, calls = _budget_client(allow=False)
    # httpx darf gar nicht erst aufgerufen werden — der Budget-Gate schlägt davor zu.
    with patch("httpx.Client") as httpx_client:
        try:
            client.update_availability(
                [{"property_id": "cx-prop", "room_type_id": "cx-rt",
                  "date_from": "2026-06-23", "date_to": "2026-06-25", "availability": 0}]
            )
        except ChannexBudgetExhausted as exc:
            assert exc.retry_after >= 1
        else:
            raise AssertionError("erschöpftes Budget muss ChannexBudgetExhausted werfen")
    httpx_client.assert_not_called()  # KEIN Channex-Call trotz Aufruf
    # Property-Ebene: die channex_property_id aus values[] wurde durchgereicht.
    assert calls == ["cx-prop"]


def test_process_ari_outbox_stops_at_first_call_when_budget_exhausted() -> None:
    from src.features.channel_manager.channex_client import ChannexBudgetExhausted

    db = _ImportDB()
    _seed_with_room_type(db)
    # Mehrere offene Outbox-Zeilen mit DISJUNKTEN Zeiträumen (keine supersedet die
    # andere) → alle drei sind echte Push-Kandidaten. OHNE das Pro-Call-Gate würden
    # alle drei gepusht (3 Channex-Calls für 1 Vorab-Token = der frühere Bypass).
    for i in range(3):
        db.tables["ari_outbox"].append({
            "id": f"o{i}", "tenant_id": "t1", "property_id": "p1",
            "date_from": f"2026-0{6 + i}-10", "date_to": f"2026-0{6 + i}-12",
            "availability": 0, "status": "pending", "attempts": 0,
        })
    client, calls = _budget_client(allow=False)
    svc = _import_svc(client, db)
    # Erschöpftes Budget → beim ERSTEN Push-Versuch ChannexBudgetExhausted, das
    # (bewusst KEIN ChannexError) nicht vom outbox-internen except geschluckt wird,
    # sondern bis zum Worker durchschlägt → der ganze Job wird verzögert.
    try:
        svc.process_ari_outbox()
    except ChannexBudgetExhausted:
        pass
    else:
        raise AssertionError("erschöpftes Budget muss den Batch abbrechen")
    # Genau EIN Token-Versuch (deny), danach Abbruch — keine N Calls.
    assert len(calls) == 1
    # KEINE Zeile wurde als fehlgeschlagen markiert (Budget ≠ Push-Fehler): alle
    # bleiben pending und laufen nach retry_after erneut.
    assert all(r["status"] == "pending" for r in db.tables["ari_outbox"])


def test_channex_client_allows_and_hits_http_when_budget_free() -> None:
    """Gegenprobe zum Bypass-Fix: erlaubt das Budget, geht der Call durch bis
    httpx (ein Token je Call gezogen), statt zu werfen."""
    from unittest.mock import MagicMock, patch

    client, calls = _budget_client(allow=True)
    resp = MagicMock()
    resp.status_code = 200
    resp.is_success = True
    resp.content = b"{}"
    resp.json.return_value = {"data": []}
    with patch("httpx.Client") as httpx_client:
        httpx_client.return_value.__enter__.return_value.request.return_value = resp
        client.update_availability(
            [{"property_id": "cx-prop", "room_type_id": "cx-rt",
              "date_from": "2026-06-23", "date_to": "2026-06-25", "availability": 0}]
        )
    httpx_client.assert_called_once()  # Budget frei → echter Call läuft
    assert calls == ["cx-prop"]  # genau ein Token für diesen einen Call


# --- Restriktions-Outbox: dauerhafter Backstop (BUG 2) + BUG 9 ---------------
# Vor 0115 hatte NUR der Availability-Push (ari_outbox) einen persistenten Retry-
# Backstop. Stop-Sell/Rate/CTA-CTD schrieben nichts → nach Job-Tod war der Wert
# verloren (Überbuchung trotz Sperre). Jetzt: Absicht VOR dem Channex-Call in
# ari_restriction_outbox, bei Fehler 'pending', Cron zieht nach.

def test_stop_sell_success_marks_restriction_outbox_done() -> None:
    # Erfolgsfall: Push geht durch, Outbox-Zeile wird 'done'.
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex()
    result = _import_svc(channex, db).push_stop_sell_for_property(
        "t1", "p1", [(date(2099, 6, 23), date(2099, 6, 25))], stop_sell=True
    )
    assert result is False  # kein Fehler
    assert channex.restrictions_pushed != []  # an Channex gepusht
    assert len(db.tables["ari_restriction_outbox"]) == 1
    row = db.tables["ari_restriction_outbox"][0]
    assert row["status"] == "done" and row["kind"] == "stop_sell"


def test_stop_sell_channex_failure_keeps_outbox_pending() -> None:
    # BUG 2: Channex-Ausfall → Outbox bleibt 'pending' (Backstop), Rückgabe True
    # (Worker-Handler wirft → Job-Retry). Ohne diese Zeile wäre der Verkaufsstopp
    # nach Job-Tod endgültig verloren.
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex(fail_restrictions=True)
    result = _import_svc(channex, db).push_stop_sell_for_property(
        "t1", "p1", [(date(2099, 6, 23), date(2099, 6, 25))], stop_sell=True
    )
    assert result is True  # Fehler signalisiert
    assert db.tables["ari_restriction_outbox"][0]["status"] == "pending"


def test_stop_sell_managed_without_rate_plan_stays_pending() -> None:
    # BUG 9: channex-managed, aber KEIN Rate-Plan-Mapping (Import noch nicht
    # gelaufen). Der Push darf NICHT still als Erfolg (False) enden — die Zeile
    # bleibt 'pending' (Cron zieht sie nach) und die Rückgabe ist True (Job-Retry).
    db = _ImportDB()
    _seed_with_room_type(db)  # room_type, aber KEIN rate_plan_map
    channex = _ImportChannex()
    result = _import_svc(channex, db).push_stop_sell_for_property(
        "t1", "p1", [(date(2099, 6, 23), date(2099, 6, 25))], stop_sell=True
    )
    assert result is True  # NICHT still Erfolg
    assert channex.restrictions_pushed == []  # nichts gepusht (kein Plan)
    assert db.tables["ari_restriction_outbox"][0]["status"] == "pending"


def test_stop_sell_not_managed_is_noop_no_outbox() -> None:
    # Nicht bei Channex angelegt → echter No-op: keine Outbox-Zeile, kein Push,
    # kein Fehler (der Cron soll nichts für ein nicht-verbundenes Objekt retryen).
    db = _ImportDB()
    _seed_with_rate_plan(db)
    _unmanage(db)
    channex = _ImportChannex()
    result = _import_svc(channex, db).push_stop_sell_for_property(
        "t1", "p1", [(date(2099, 6, 23), date(2099, 6, 25))], stop_sell=True
    )
    assert result is False
    assert db.tables["ari_restriction_outbox"] == []
    assert channex.restrictions_pushed == []


def test_push_rate_managed_without_rate_plan_stays_pending() -> None:
    # BUG 9 auch für Preis/Restrictions-Pfad (_push_restriction_values_all_plans).
    db = _ImportDB()
    _seed_with_room_type(db)  # KEIN rate_plan_map
    channex = _ImportChannex()
    result = _import_svc(channex, db).push_rate_for_property(
        "t1", "p1", date(2099, 6, 23), date(2099, 6, 25), rate_cents=13800
    )
    assert result is True  # nicht still Erfolg
    assert db.tables["ari_restriction_outbox"][0]["status"] == "pending"


def test_push_rate_success_marks_outbox_done() -> None:
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex()
    result = _import_svc(channex, db).push_rate_for_property(
        "t1", "p1", date(2099, 6, 23), date(2099, 6, 25), rate_cents=13800
    )
    assert result is False
    assert db.tables["ari_restriction_outbox"][0]["status"] == "done"


def test_cta_ctd_failure_keeps_outbox_pending() -> None:
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex(fail_restrictions=True)
    result = _import_svc(channex, db).push_restrictions_for_property(
        "t1", "p1", date(2099, 6, 23), date(2099, 6, 25), closed_to_arrival=True
    )
    assert result is True
    row = db.tables["ari_restriction_outbox"][0]
    assert row["status"] == "pending" and row["kind"] == "cta_ctd"


def test_process_restriction_outbox_retries_stop_sell() -> None:
    # Cron zieht eine offene stop_sell-Zeile nach und pusht sie an Channex.
    db = _ImportDB()
    _seed_with_rate_plan(db)
    db.tables["ari_restriction_outbox"].append({
        "id": "r1", "tenant_id": "t1", "property_id": "p1", "kind": "stop_sell",
        "payload": {"spans": [["2099-06-23", "2099-06-25"]],
                    "stop_sell": True, "days": None},
        "date_from": "2099-06-23", "date_to": "2099-06-25",
        "status": "pending", "attempts": 1,
    })
    channex = _ImportChannex()
    res = _import_svc(channex, db).process_restriction_outbox()
    assert res["done"] == 1
    assert db.tables["ari_restriction_outbox"][0]["status"] == "done"
    # Pro Datum expandiert (23.–25. = 3 values), stop_sell gesetzt.
    assert len(channex.restrictions_pushed) == 3
    assert all(v["stop_sell"] is True for v in channex.restrictions_pushed)


def test_process_restriction_outbox_self_heals_when_rate_plan_appears() -> None:
    # BUG-9-Selbstheilung: eine Zeile, die OHNE Rate-Plan pending blieb, wird vom
    # Cron gepusht, SOBALD der Rate-Plan-Import das Mapping angelegt hat.
    db = _ImportDB()
    _seed_with_room_type(db)  # zunächst KEIN rate_plan_map
    db.tables["ari_restriction_outbox"].append({
        "id": "r1", "tenant_id": "t1", "property_id": "p1", "kind": "stop_sell",
        "payload": {"spans": [["2099-06-23", "2099-06-24"]],
                    "stop_sell": True, "days": None},
        "date_from": "2099-06-23", "date_to": "2099-06-24",
        "status": "pending", "attempts": 0,
    })
    channex = _ImportChannex()
    svc = _import_svc(channex, db)
    # Erster Cron-Lauf: noch kein Mapping → bleibt pending (attempts hochgezählt).
    res1 = svc.process_restriction_outbox()
    assert res1["done"] == 0
    assert db.tables["ari_restriction_outbox"][0]["status"] == "pending"
    assert channex.restrictions_pushed == []
    # Rate-Plan-Import läuft nach → Mapping erscheint.
    db.tables["channex_rate_plan_map"].append(
        {"id": "rpm1", "tenant_id": "t1", "property_id": "p1",
         "room_type_map_id": "rt1", "channex_rate_plan_id": "cx-rate",
         "deleted_at": None}
    )
    # Zweiter Lauf: jetzt heilt es sich und pusht.
    res2 = svc.process_restriction_outbox()
    assert res2["done"] == 1
    assert db.tables["ari_restriction_outbox"][0]["status"] == "done"
    assert channex.restrictions_pushed != []


def test_process_restriction_outbox_skips_unmanaged_as_done() -> None:
    # Nicht (mehr) bei Channex gemanaged → als done abhaken (kein Endlos-Retry).
    db = _ImportDB()
    _seed_with_rate_plan(db)
    _unmanage(db)
    db.tables["ari_restriction_outbox"].append({
        "id": "r1", "tenant_id": "t1", "property_id": "p1", "kind": "stop_sell",
        "payload": {"spans": [["2099-06-23", "2099-06-24"]],
                    "stop_sell": True, "days": None},
        "date_from": "2099-06-23", "date_to": "2099-06-24",
        "status": "pending", "attempts": 0,
    })
    channex = _ImportChannex()
    res = _import_svc(channex, db).process_restriction_outbox()
    assert res["done"] == 1
    assert channex.restrictions_pushed == []
    assert db.tables["ari_restriction_outbox"][0]["status"] == "done"


def test_process_restriction_outbox_gives_up_after_max_attempts() -> None:
    # Dauerhaft ohne Rate-Plan (10. Versuch) → 'failed', kein Endlos-Retry.
    db = _ImportDB()
    _seed_with_room_type(db)  # KEIN rate_plan_map
    db.tables["ari_restriction_outbox"].append({
        "id": "r1", "tenant_id": "t1", "property_id": "p1", "kind": "stop_sell",
        "payload": {"spans": [["2099-06-23", "2099-06-24"]],
                    "stop_sell": True, "days": None},
        "date_from": "2099-06-23", "date_to": "2099-06-24",
        "status": "pending", "attempts": 9,
    })
    channex = _ImportChannex()
    res = _import_svc(channex, db).process_restriction_outbox()
    assert res["failed"] == 1
    assert db.tables["ari_restriction_outbox"][0]["status"] == "failed"


def _rate_outbox_row(rid, rp_id, cents, created_at, status="pending"):  # noqa: ANN001, ANN201
    return {
        "id": rid, "tenant_id": "t1", "property_id": "p1", "kind": "rate",
        "payload": {"segments": [{
            "date_from": "2026-11-01", "date_to": "2026-11-20",
            "rate_cents": cents, "rate_plan_id": rp_id,
        }]},
        "date_from": "2026-11-01", "date_to": "2026-11-20",
        "status": status, "attempts": 0, "created_at": created_at,
    }


def test_superseded_separates_by_rate_plan() -> None:
    # Ein neuerer Datumspreis für Rate-Plan A darf einen älteren Preis für Rate-Plan
    # B NICHT verdrängen (Hotel: rate-plan-genau). Sonst wird B nie gepusht.
    db = _ImportDB()
    older_b = _rate_outbox_row("b", "rp-b", 11100, "2026-07-16T05:00:00Z")
    newer_a = _rate_outbox_row("a", "rp-a", 24100, "2026-07-16T05:30:00Z")
    db.tables["ari_restriction_outbox"].extend([older_b, newer_a])
    svc = _import_svc(_ImportChannex(), db)
    # B (rp-b) darf durch A (rp-a) NICHT superseded werden → keine überdeckten Tage.
    assert svc._superseded_restriction_days(db, older_b) == set()


def test_superseded_same_rate_plan_still_covers() -> None:
    # Gleicher Rate-Plan: die neuere Zeile supersediert die überlappenden Tage der
    # älteren weiterhin (unveränderte Tag-genau-Logik, kein doppelter Stale-Push).
    db = _ImportDB()
    older = _rate_outbox_row("o", "rp-a", 20000, "2026-07-16T05:00:00Z")
    newer = _rate_outbox_row("n", "rp-a", 24100, "2026-07-16T05:30:00Z")
    db.tables["ari_restriction_outbox"].extend([older, newer])
    svc = _import_svc(_ImportChannex(), db)
    covered = svc._superseded_restriction_days(db, older)
    assert len(covered) == 20  # 01.–20.11. voll überdeckt


def test_superseded_property_wide_covers_all_plans() -> None:
    # Ein property-weites Segment (rate_plan_id None, z. B. min_stay) supersediert
    # plan-übergreifend — es gilt für alle Rate-Plans.
    db = _ImportDB()
    older_plan = _rate_outbox_row("p", "rp-a", 20000, "2026-07-16T05:00:00Z")
    newer_wide = _rate_outbox_row("w", None, None, "2026-07-16T05:30:00Z")
    newer_wide["payload"]["segments"][0]["min_stay"] = 3
    db.tables["ari_restriction_outbox"].extend([older_plan, newer_wide])
    svc = _import_svc(_ImportChannex(), db)
    assert len(svc._superseded_restriction_days(db, older_plan)) == 20


def test_process_restriction_outbox_retries_rate_batch() -> None:
    # push_rates_batch-Ursprung (segments im payload) wird vom Cron neu aufgebaut.
    db = _ImportDB()
    _seed_with_rate_plan(db)
    db.tables["ari_restriction_outbox"].append({
        "id": "r1", "tenant_id": "t1", "property_id": "p1", "kind": "rate",
        "payload": {"segments": [
            {"date_from": "2099-06-23", "date_to": "2099-06-24", "rate_cents": 15000},
        ]},
        "date_from": "2099-06-23", "date_to": "2099-06-24",
        "status": "pending", "attempts": 0,
    })
    channex = _ImportChannex()
    res = _import_svc(channex, db).process_restriction_outbox()
    assert res["done"] == 1
    assert len(channex.restrictions_pushed) == 2  # 23.+24. = 2 values
    assert all(v["rate"] == 15000 for v in channex.restrictions_pushed)


def test_push_rates_batch_failure_keeps_outbox_pending() -> None:
    # push_rates_batch (best-effort) persistiert die Absicht ebenfalls; Ausfall →
    # Outbox pending.
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex(fail_restrictions=True)
    _import_svc(channex, db).push_rates_batch(
        "t1", "p1",
        [{"date_from": date(2099, 6, 23), "date_to": date(2099, 6, 24),
          "rate_cents": 15000}],
    )
    assert db.tables["ari_restriction_outbox"][0]["status"] == "pending"


def _seed_two_rate_plan_maps(db, tenant_id="t1", property_id="p1"):  # noqa: ANN001, ANN201
    """Kette mit ZWEI gemappten Rate-Plans (lokale IDs rp-a/rp-b), damit die
    rate-plan-genaue Ziel-Selektion in push_rates_batch prüfbar ist."""
    _seed_with_room_type(db, tenant_id, property_id=property_id)
    db.tables["channex_rate_plan_map"].extend([
        {"id": "rpm-a", "tenant_id": tenant_id, "property_id": property_id,
         "room_type_map_id": "rt1", "channex_rate_plan_id": "cx-a",
         "local_rate_plan_id": "rp-a", "deleted_at": None},
        {"id": "rpm-b", "tenant_id": tenant_id, "property_id": property_id,
         "room_type_map_id": "rt1", "channex_rate_plan_id": "cx-b",
         "local_rate_plan_id": "rp-b", "deleted_at": None},
    ])


def test_push_rates_batch_targets_only_matching_rate_plan() -> None:
    # Hotel-Kern: ein Segment mit rate_plan_id geht NUR an den passenden Channex-
    # Rate-Plan (cx-b), nicht an beide. Genau ein value (ein Tag × ein Plan).
    db = _ImportDB()
    _seed_two_rate_plan_maps(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_rates_batch(
        "t1", "p1",
        [{"date_from": date(2099, 6, 23), "date_to": date(2099, 6, 23),
          "rate_cents": 33300, "rate_plan_id": "rp-b"}],
    )
    assert len(channex.restrictions_pushed) == 1
    v = channex.restrictions_pushed[0]
    assert v["rate_plan_id"] == "cx-b" and v["rate"] == 33300


def test_push_rates_batch_without_rate_plan_id_hits_all() -> None:
    # Ohne rate_plan_id (FeWo/DP) bleibt das Spiegeln an ALLE Pläne — ein Tag ×
    # zwei Pläne = zwei values (kein Verhaltensbruch).
    db = _ImportDB()
    _seed_two_rate_plan_maps(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_rates_batch(
        "t1", "p1",
        [{"date_from": date(2099, 6, 23), "date_to": date(2099, 6, 23),
          "rate_cents": 20000}],
    )
    assert len(channex.restrictions_pushed) == 2
    assert {v["rate_plan_id"] for v in channex.restrictions_pushed} == {"cx-a", "cx-b"}


# --- Hotel-Content-Sync: n Room-Types + Rate-Plans je Kategorie (Teil 2) ---
def _seed_hotel_property(db, tenant_id="t1", property_id="p1"):  # noqa: ANN001, ANN201
    """Property mit 2 Zimmerkategorien + je 2 Rate-Plans (mit room_type_id)."""
    db.tables["properties"].append({
        "id": property_id, "tenant_id": tenant_id, "title": "Test Hotel",
        "description": None, "property_type": "hotel", "street": None,
        "house_number": None, "postal_code": None, "city": None, "country": None,
        "lat": None, "lng": None, "max_guests": 2, "amenities": None,
        "type_attributes": None,
    })
    db.tables["room_types"].extend([
        {"id": "rt-double", "property_id": property_id, "title": "Double Room",
         "count_of_rooms": 1, "occ_adults": 2, "occ_children": 0, "occ_infants": 0,
         "default_occupancy": 2, "position": 0, "created_at": "2026-01-01"},
        {"id": "rt-twin", "property_id": property_id, "title": "Twin Room",
         "count_of_rooms": 1, "occ_adults": 2, "occ_children": 0, "occ_infants": 0,
         "default_occupancy": 2, "position": 1, "created_at": "2026-01-02"},
    ])
    db.tables["rate_plans"].extend([
        {"id": "rp-d-bar", "property_id": property_id, "room_type_id": "rt-double",
         "name": "Best Available Rate", "base_price": 100, "currency": "USD",
         "min_stay": 1, "created_at": "2026-01-01"},
        {"id": "rp-d-bnb", "property_id": property_id, "room_type_id": "rt-double",
         "name": "Bed & Breakfast", "base_price": 120, "currency": "USD",
         "min_stay": 1, "created_at": "2026-01-02"},
        {"id": "rp-t-bar", "property_id": property_id, "room_type_id": "rt-twin",
         "name": "Best Available Rate", "base_price": 100, "currency": "USD",
         "min_stay": 1, "created_at": "2026-01-03"},
        {"id": "rp-t-bnb", "property_id": property_id, "room_type_id": "rt-twin",
         "name": "Bed & Breakfast", "base_price": 120, "currency": "USD",
         "min_stay": 1, "created_at": "2026-01-04"},
    ])


def test_hotel_content_sync_pushes_all_rate_plans_per_category() -> None:
    # Regression: rate_plans.room_type_id MUSS geladen werden, sonst landen alle
    # Pläne im Orphan-Zweig und NICHTS wird gepusht (Hotel-only-Bug).
    db = _ImportDB()
    _seed_hotel_property(db)
    channex = _ImportChannex()
    _import_svc(channex, db).sync_content("t1", property_id="p1")

    # 2 Room-Types + 4 Rate-Plans bei Channex angelegt.
    assert len(channex.created_room_types) == 2
    assert len(channex.created_rate_plans) == 4
    # 4 Rate-Plan-Maps in der DB, korrekt je Room-Type verteilt (2 + 2).
    rp_maps = db.tables["channex_rate_plan_map"]
    assert len(rp_maps) == 4
    rt_maps = {m["local_unit_ref"]: m["id"] for m in db.tables["channex_room_type_map"]}
    per_rt: dict[str, int] = {}
    for m in rp_maps:
        per_rt[m["room_type_map_id"]] = per_rt.get(m["room_type_map_id"], 0) + 1
    assert per_rt[rt_maps["rt-double"]] == 2
    assert per_rt[rt_maps["rt-twin"]] == 2


def test_hotel_content_sync_fails_closed_when_all_plans_orphan() -> None:
    # Fail-closed (Wurzel 5): sind Pläne vorhanden, aber keiner einer Kategorie
    # zugeordnet (room_type_id fehlt/falsch), MUSS der Sync scheitern statt still
    # "done" — sonst geht die Property ohne Preise an die Portale. sync_content
    # fängt die ChannexError und re-raist sie als ChannelManagerError (markiert
    # dabei last_sync_status=error) — beide zählen als "geworfen".
    from src.features.channel_manager.channex_client import ChannexError
    from src.features.channel_manager.common import ChannelManagerError as _CMErr

    db = _ImportDB()
    _seed_hotel_property(db)
    for rp in db.tables["rate_plans"]:
        rp["room_type_id"] = None  # alle verwaisen
    channex = _ImportChannex()
    raised = False
    try:
        _import_svc(channex, db).sync_content("t1", property_id="p1")
    except (ChannexError, _CMErr):
        raised = True
    assert raised
    # Kein Rate-Plan gepusht; keine verwaisten Maps entstanden.
    assert channex.created_rate_plans == []
    assert db.tables["channex_rate_plan_map"] == []
