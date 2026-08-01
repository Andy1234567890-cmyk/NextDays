from datetime import UTC, date, datetime, timedelta

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
        if name == "guests":
            # Kontaktlose Feed-Buchung → Platzhaltergast wird angelegt (Härtung):
            # insert liefert eine id, alle Lookups sind leer.
            class _Guests(_FakeQuery):
                def __init__(self) -> None:
                    super().__init__([])

                def insert(self, _payload, **_k):  # noqa: ANN001, ANN002, ANN003, ANN201
                    self._rows = [{"id": "placeholder-guest"}]
                    return self

            return _Guests()
        return _FakeQuery([])


# --- Channex→DB 1:1-Spiegel (reconcile) --------------------------------------
class _ReconcileChannex:
    """Channex-Stub für den Property-Reconcile. list_properties liefert je Group
    eine konfigurierte Property-Liste; raises=True simuliert einen Ausfall."""

    def __init__(
        self, properties: list[dict], *, raises: bool = False,
        channels: list[dict] | None = None, channels_raises: bool = False,
    ) -> None:
        self._properties = properties
        self._raises = raises
        self._channels = channels or []
        self._channels_raises = channels_raises
        self.is_configured = True

    def list_properties(self, *, page=1, limit=100, group_id=None):  # noqa: ANN001, ANN201
        if self._raises:
            from src.features.channel_manager.channex_client import ChannexError

            raise ChannexError("Channex down", status_code=502)
        return {
            "data": self._properties,
            "meta": {"total": len(self._properties), "limit": limit, "page": page},
        }

    def list_channels(self, *, property_id=None):  # noqa: ANN001, ANN201
        # Kanal-Reconcile: liefert die bei Channex existierenden Kanäle. Ausfall
        # (channels_raises) → fail-closed, es darf nichts geschlossen werden.
        if self._channels_raises:
            from src.features.channel_manager.channex_client import ChannexError

            raise ChannexError("Channex down", status_code=502)
        return {"data": self._channels}


class _ReconcileDB:
    """In-Memory-DB für properties + channex_property_map + channex_group_map.
    Unterstützt select/eq/is_/not_/insert/update/upsert für den Reconcile."""

    def __init__(self, tenant_id: str, group_id: str) -> None:
        self.properties: list[dict] = []
        self.maps: list[dict] = []
        self.groups: list[dict] = [
            {"tenant_id": tenant_id, "channex_group_id": group_id}
        ]
        self.connections: list[dict] = []
        self._seq = 0

    def _next_id(self) -> str:
        self._seq += 1
        return f"prop-{self._seq}"

    def table(self, name: str):  # noqa: ANN201
        store = {
            "properties": self.properties,
            "channex_property_map": self.maps,
            "channex_group_map": self.groups,
            "channex_channel_connection": self.connections,
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

    def delete(self):  # noqa: ANN201
        self._op = "delete"
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
        if self._op == "delete":
            for r in rows:
                self._store.remove(r)
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


def test_reconcile_own_tenant_uses_ctx_tenant() -> None:
    # Onboarding-Import-Route: Tenant kommt aus dem JWT-Kontext, nicht aus dem
    # Request-Body — reconcile_own_tenant delegiert an den ctx-Tenant.
    db = _ReconcileDB("t1", "grp-1")
    channex = _ReconcileChannex(
        [{"id": "cx-1", "attributes": {"title": "Strandhaus"}}]
    )
    res = _reconcile_svc(channex, db).reconcile_own_tenant(
        AuthContext(user_id="u", tenant_id="t1")
    )
    assert res["created"] == 1
    assert db.maps[0]["channex_property_id"] == "cx-1"


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


def test_reconcile_keeps_local_title_mirrors_other_fields() -> None:
    # title/description führt der NUTZER lokal (Wurzel 1) — der Reverse-Reconcile
    # darf sie NIE mit dem Channex-Wert überschreiben (der „Unbenannt"-Bug), spiegelt
    # aber die von Channex geführten Felder (z. B. city) weiter.
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
    # Titel bleibt lokal, city wird gespiegelt.
    assert db.properties[0]["title"] == "Alter Titel"
    assert db.properties[0]["city"] == "Hamburg"


def test_reconcile_noop_run_writes_nothing() -> None:
    # Realtime-Loop-Regression: /channels lauscht per RealtimeRefresh auf
    # channex_property_map — jeder Write lädt die Seite neu, deren GET reiht
    # wieder einen Reconcile ein. Ein Lauf OHNE echte Änderung (Spiegel gleich,
    # ok-Stempel frisch) muss deshalb komplett schreibfrei bleiben.
    db = _ReconcileDB("t1", "grp-1")
    fresh = datetime.now(UTC).isoformat()
    db.properties.append(
        {"id": "p1", "tenant_id": "t1", "title": "Haus", "city": "Kiel"}
    )
    db.maps.append(
        {"id": "m1", "tenant_id": "t1", "property_id": "p1",
         "channex_property_id": "cx-1", "deleted_at": None,
         "last_sync_at": fresh, "last_sync_status": "ok"}
    )
    channex = _ReconcileChannex(
        [{"id": "cx-1", "attributes": {"title": "Haus", "city": "Kiel"}}]
    )
    res = _reconcile_svc(channex, db).reconcile_properties_for_tenant("t1")
    assert res["updated"] == 1
    assert db.maps[0]["last_sync_at"] == fresh  # KEIN neuer Stempel
    assert db.properties[0]["city"] == "Kiel"


def test_reconcile_stale_ok_stamp_is_refreshed() -> None:
    # Der ok-Stempel darf sich auffrischen, wenn er älter als das 15-min-
    # Dedup-Fenster ist (UI zeigt „zuletzt synchronisiert") — nur nicht bei
    # jedem Lauf (sonst Realtime-Endlosschleife, siehe Test oben).
    db = _ReconcileDB("t1", "grp-1")
    old = "2020-01-01T00:00:00+00:00"
    db.properties.append(
        {"id": "p1", "tenant_id": "t1", "title": "Haus", "city": "Kiel"}
    )
    db.maps.append(
        {"id": "m1", "tenant_id": "t1", "property_id": "p1",
         "channex_property_id": "cx-1", "deleted_at": None,
         "last_sync_at": old, "last_sync_status": "ok"}
    )
    channex = _ReconcileChannex(
        [{"id": "cx-1", "attributes": {"title": "Haus", "city": "Kiel"}}]
    )
    _reconcile_svc(channex, db).reconcile_properties_for_tenant("t1")
    assert db.maps[0]["last_sync_at"] != old
    assert db.maps[0]["last_sync_status"] == "ok"


def test_reconcile_closes_orphan_channel_connection() -> None:
    # Gegenzustand (Wurzel 1): ein bei Channex verschwundener OTA-Kanal (z. B.
    # aufgeräumter Test-Kanal) MUSS die lokale Verbindung schließen — sonst zeigt
    # der Channel-Manager „verbunden" für einen Kanal, den es nicht mehr gibt
    # (der reale „Sie haben noch keine Portale"-Fall nach der Zertifizierung).
    db = _ReconcileDB("t1", "grp-1")
    db.properties.append({"id": "p1", "tenant_id": "t1", "title": "Haus"})
    db.maps.append(
        {"id": "m1", "tenant_id": "t1", "property_id": "p1",
         "channex_property_id": "cx-1", "deleted_at": None}
    )
    db.connections.append(
        {"id": "conn-1", "tenant_id": "t1", "property_id": "p1",
         "ota_portal_code": "BookingCom", "channex_channel_id": "cx-chan-gone",
         "is_active": True}
    )
    # Channex kennt die Property (kein Property-Orphan), aber KEINEN Kanal mehr.
    channex = _ReconcileChannex(
        [{"id": "cx-1", "attributes": {"title": "Haus"}}], channels=[]
    )
    _reconcile_svc(channex, db).reconcile_properties_for_tenant("t1")
    assert db.connections[0]["is_active"] is False
    assert db.connections[0]["channex_channel_id"] is None


def test_reconcile_closes_orphan_channel_even_without_live_properties() -> None:
    # Realer Staging-Fall (Deploy-Verify): Channex kennt WEDER Properties NOCH
    # Kanäle mehr („Sie haben noch keine Portale"), aber die lokale Verbindung
    # blieb aktiv. Die Kanal-Bereinigung MUSS laufen, auch wenn der Property-
    # Reconcile nichts zu tun hat / am Budget hängt — sie darf nicht hinter dem
    # teuren Property-/ARI-Teil eingeklemmt sein (der eigentliche Bug).
    db = _ReconcileDB("t1", "grp-1")
    db.properties.append({"id": "p1", "tenant_id": "t1", "title": "Haus"})
    db.maps.append(
        {"id": "m1", "tenant_id": "t1", "property_id": "p1",
         "channex_property_id": "cx-1", "deleted_at": None}
    )
    db.connections.append(
        {"id": "conn-1", "tenant_id": "t1", "property_id": "p1",
         "ota_portal_code": "BookingCom", "channex_channel_id": "cx-chan-gone",
         "is_active": True}
    )
    # Channex liefert KEINE Property und KEINEN Kanal (leerer Account).
    channex = _ReconcileChannex([], channels=[])
    _reconcile_svc(channex, db).reconcile_properties_for_tenant("t1")
    assert db.connections[0]["is_active"] is False
    assert db.connections[0]["channex_channel_id"] is None


def test_reconcile_keeps_channel_connection_when_still_live() -> None:
    # Der Kanal existiert bei Channex weiter → lokale Verbindung bleibt unberührt.
    db = _ReconcileDB("t1", "grp-1")
    db.properties.append({"id": "p1", "tenant_id": "t1", "title": "Haus"})
    db.maps.append(
        {"id": "m1", "tenant_id": "t1", "property_id": "p1",
         "channex_property_id": "cx-1", "deleted_at": None}
    )
    db.connections.append(
        {"id": "conn-1", "tenant_id": "t1", "property_id": "p1",
         "ota_portal_code": "BookingCom", "channex_channel_id": "cx-chan-live",
         "is_active": True}
    )
    channex = _ReconcileChannex(
        [{"id": "cx-1", "attributes": {"title": "Haus"}}],
        channels=[{"id": "cx-chan-live", "attributes": {"is_active": True}}],
    )
    _reconcile_svc(channex, db).reconcile_properties_for_tenant("t1")
    assert db.connections[0]["is_active"] is True
    assert db.connections[0]["channex_channel_id"] == "cx-chan-live"


def test_reconcile_channel_connection_fail_closed_on_channex_down() -> None:
    # FAIL-CLOSED (Wurzel 5): kann die Channex-Kanalliste NICHT gelesen werden,
    # darf die lokale Verbindung NIE geschlossen werden (ein Netzfehler würde
    # sonst alle Kanäle kappen). Nichts anfassen.
    db = _ReconcileDB("t1", "grp-1")
    db.properties.append({"id": "p1", "tenant_id": "t1", "title": "Haus"})
    db.maps.append(
        {"id": "m1", "tenant_id": "t1", "property_id": "p1",
         "channex_property_id": "cx-1", "deleted_at": None}
    )
    db.connections.append(
        {"id": "conn-1", "tenant_id": "t1", "property_id": "p1",
         "ota_portal_code": "BookingCom", "channex_channel_id": "cx-chan",
         "is_active": True}
    )
    channex = _ReconcileChannex(
        [{"id": "cx-1", "attributes": {"title": "Haus"}}], channels_raises=True
    )
    _reconcile_svc(channex, db).reconcile_properties_for_tenant("t1")
    assert db.connections[0]["is_active"] is True  # NICHT geschlossen
    assert db.connections[0]["channex_channel_id"] == "cx-chan"


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
        self.pushed: list[dict] = []  # update_availability-Werte, flach
        # Je update_availability-Aufruf eine Liste — belegt die Zert-Forderung
        # „1 API call" für den gebündelten Full Sync (Test 1).
        self.availability_calls: list[list[dict]] = []
        self.restrictions_pushed: list[dict] = []  # alle Werte, flach
        # Je update_restrictions-Aufruf eine Liste — belegt die Zert-Forderung
        # „1 API call" (die flache Liste allein zeigt Bündelung nicht).
        self.restriction_calls: list[list[dict]] = []
        self.activated: list[str] = []
        self.deactivated: list[str] = []
        # Content-Sync-Aufzeichnung (create_*-Calls).
        self.created_properties: list[dict] = []
        self.created_room_types: list[dict] = []
        self.created_rate_plans: list[dict] = []
        self.updated_rate_plans: list[tuple[str, dict]] = []
        self.deleted_room_types: list[str] = []
        self.deleted_rate_plans: list[str] = []
        self._rt_seq = 0
        self._rp_seq = 0

    def list_channel_catalog(self):  # noqa: ANN201
        # Live-Portal-Katalog (channels/list): die real verbindbaren Kern-OTAs.
        # _portal_catalog() leitet daraus die angebotenen Kanäle ab.
        return {"data": [
            {"code": "BookingCom", "params": {
                "hotel_id": {"type": "string", "title": "Hotel ID", "position": 0},
            }},
            {"code": "AirBNB", "params": {
                "code": {"type": "hidden", "title": "Token Code", "position": 0},
            }},
            {"code": "Expedia", "params": {
                "hotel_id": {"type": "string", "title": "Hotel ID", "position": 0},
            }},
        ]}

    def update_availability(self, values):  # noqa: ANN001, ANN201
        if self._fail_availability:
            from src.features.channel_manager.channex_client import ChannexError

            raise ChannexError("Channex down", status_code=502)
        self.pushed.extend(values)
        self.availability_calls.append(list(values))
        return {"data": values}

    def update_restrictions(self, values):  # noqa: ANN001, ANN201
        if self._fail_restrictions:
            from src.features.channel_manager.channex_client import ChannexError

            raise ChannexError("Channex down", status_code=502)
        self.restrictions_pushed.extend(values)
        self.restriction_calls.append(list(values))
        return {"data": values}

    def activate_channel(self, channel_id):  # noqa: ANN001, ANN201
        self.activated.append(channel_id)
        return {}

    def deactivate_channel(self, channel_id):  # noqa: ANN001, ANN201
        self.deactivated.append(channel_id)
        return {}

    def list_bookings_for_property(  # noqa: ANN001, ANN201
        self, property_id, *, page=1, limit=100, inserted_after=None, arrival_from=None
    ):
        # Eine Seite (Tests klein halten). Merkt sich den arrival_from-Filter,
        # damit der Bestandsimport-Test „nur zukünftige vs. auch Vergangenheit"
        # belegen kann.
        self.last_arrival_from = arrival_from
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
        self.updated_rate_plans.append((channex_id, attrs))
        return {"data": {"id": channex_id}}

    def delete_room_type(self, channex_id, **_k):  # noqa: ANN001, ANN003, ANN201
        self.deleted_room_types.append(channex_id)
        return {}

    def delete_rate_plan(self, channex_id, **_k):  # noqa: ANN001, ANN003, ANN201
        self.deleted_rate_plans.append(channex_id)
        return {}


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
    "tenant_pinned_channel": ("tenant_id", "portal_code"),
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
            "tenants": [{"id": "t1", "name": "Test-Betrieb"}],
            "room_types": [],
            "tenant_billing_profile": [],
            "property_photos": [],
            "rate_plan_price_overrides": [],
            "rate_plan_min_stay_overrides": [],
            "rate_plan_restriction_overrides": [],
            "external_calendar": [],
            "tenant_pinned_channel": [],
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
        if self._op == "delete":
            for r in rows:
                self._store.remove(r)
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
    """OTA-Namen → Kanal. NIEMALS 'portal'.

    'portal' trägt laut Preisliste §2 die 8 % all-in und macht uns zum Merchant
    of Record. Eine über den Channel-Manager eingegangene Buchung ist per
    Definition fremd — sie dort einzuordnen würde die geschuldete 1 % nie
    fakturieren UND uns die Chargeback-Haftung ohne Erlös aufladen.
    """
    f = ChannelManagerService._ota_name_to_channel
    assert f("Booking.com") == "booking"
    assert f("Airbnb") == "airbnb"
    assert f("VRBO") == "vrbo"
    # Namensvarianten dürfen nicht durchrutschen.
    assert f("booking") == "booking"
    # Unbekannte/weitere OTAs → externer Sammelkanal, nicht 'portal'.
    assert f("Expedia") == "ota_other"
    assert f("Agoda") == "ota_other"
    assert f("Booking.com B.V.") == "ota_other"
    assert f(None) == "ota_other"
    # Der Kernschutz, explizit:
    for name in (None, "", "Expedia", "Agoda", "irgendwas"):
        assert f(name) != "portal"


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


def test_room_facility_ids_uses_own_catalogue() -> None:
    """Zimmer-Facilities haben EIGENE UUIDs — der Objekt-Katalog gilt hier nicht.

    Live gegen /room_facilities verifiziert: 30 Titel kommen in beiden Katalogen
    vor, alle 30 mit unterschiedlicher UUID. Eine Objekt-UUID an einem Room-Type
    wäre ungültig, deshalb sind es zwei getrennte Maps."""
    from src.features.channel_manager.common import (
        _CHANNEX_FACILITY,
        _CHANNEX_ROOM_FACILITY,
        _channex_room_facility_ids,
    )

    klima = "9f5726e2-f979-4b6b-a69e-cbca387bc7ea"  # Airconditioning (Zimmer)
    balkon = "363c2057-2cdf-4cbc-af98-069c2d573952"  # Balcony (Zimmer)
    assert _channex_room_facility_ids(["airconditioning"]) == [klima]
    assert _channex_room_facility_ids(["airconditioning", "balcony"]) == [klima, balkon]
    # Unbekannt → weglassen statt 422 zu riskieren.
    assert _channex_room_facility_ids(["gibt_es_nicht"]) == []
    assert _channex_room_facility_ids([]) == []
    assert _channex_room_facility_ids(None) == []
    # Duplikate entfernt, Reihenfolge stabil.
    assert _channex_room_facility_ids(["balcony", "balcony"]) == [balkon]
    # Kein gemeinsamer Slug darf dieselbe UUID tragen wie im Objekt-Katalog.
    gemeinsam = set(_CHANNEX_FACILITY) & set(_CHANNEX_ROOM_FACILITY)
    assert gemeinsam, "Erwartet: einige Slugs gibt es in beiden Katalogen"
    assert all(_CHANNEX_FACILITY[s] != _CHANNEX_ROOM_FACILITY[s] for s in gemeinsam)


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


def test_csv_import_creates_reservation_and_blocks_calendar() -> None:
    db = _ImportDB()
    _seed_property(db)  # properties: id=p1, title="Haus"
    csv_text = (
        "property,guest_first_name,guest_last_name,arrival,departure,"
        "total_amount,currency,source,external_id\n"
        "Haus,Max,Mustermann,2026-09-01,2026-09-03,200.00,EUR,Direkt,ABC1\n"
    )
    svc = _import_svc(_ImportChannex(), db)
    res = svc.import_bookings_csv(
        AuthContext(user_id="u", tenant_id="t1"), content=csv_text
    )
    assert res.total_rows == 1 and res.imported == 1 and res.failed == 0
    r = db.tables["reservations"][0]
    assert r["property_id"] == "p1" and r["status"] == "confirmed"
    assert r["source_channex_booking_id"] == "csv:ABC1"
    booked = {a["date"] for a in db.tables["availability"] if a["status"] == "booked"}
    assert booked == {"2026-09-01", "2026-09-02"}


def test_csv_import_dedup_and_bad_rows() -> None:
    db = _ImportDB()
    _seed_property(db)
    header = (
        "property,guest_first_name,guest_last_name,arrival,departure,external_id\n"
    )
    svc = _import_svc(_ImportChannex(), db)
    # Erst-Import: eine gute Zeile.
    svc.import_bookings_csv(
        AuthContext(user_id="u", tenant_id="t1"),
        content=header + "Haus,A,B,2026-09-10,2026-09-12,X1\n",
    )
    first = len(db.tables["reservations"])
    # Zweiter Lauf: dieselbe Zeile (Dedup) + Fehlerzeilen (Objekt fehlt,
    # kaputtes Datum, Abreise vor Anreise).
    res = svc.import_bookings_csv(
        AuthContext(user_id="u", tenant_id="t1"),
        content=header
        + "Haus,A,B,2026-09-10,2026-09-12,X1\n"       # Duplikat → update, kein Neu
        + "Unbekannt,C,D,2026-09-10,2026-09-12,X2\n"   # Objekt fehlt → failed
        + "Haus,E,F,2026-13-01,2026-09-12,X3\n"        # kaputtes Datum → failed
        + "Haus,G,H,2026-09-12,2026-09-10,X4\n",       # Abreise<Anreise → failed
    )
    assert res.total_rows == 4
    assert res.failed == 3 and len(res.errors) == 3
    # Kein neuer Datensatz durch das Duplikat (Dedup über csv:X1).
    assert len(db.tables["reservations"]) == first


def test_import_cancelled_booking_creates_record_without_block() -> None:
    # Bestandsimport: eine bereits stornierte, unbekannte Buchung wird als
    # cancelled angelegt (Historie), blockiert aber KEINE Kalendernächte.
    db = _ImportDB()
    _seed_property(db)  # property p1
    attrs = {
        "booking_id": "lodgify:77",
        "property_id": "p1",
        "arrival_date": "2026-10-01",
        "departure_date": "2026-10-03",
        "status": "cancelled",
        "ota_name": "Airbnb",
        "ota_reservation_code": "77",
        "amount": "150.00",
        "currency": "EUR",
        "customer": {"name": "Lea", "surname": "K", "mail": "l@k.de"},
    }
    svc = _import_svc(_ImportChannex(), db)
    ok = svc._project_booking_to_reservation(
        db, "t1", attrs, local_property_id="p1"
    )
    assert ok is True
    r = db.tables["reservations"][0]
    assert r["status"] == "cancelled" and r["source_channex_booking_id"] == "lodgify:77"
    # KEINE gebuchten Nächte durch eine stornierte Buchung.
    assert not [a for a in db.tables["availability"] if a["status"] == "booked"]


def test_lodgify_booking_to_attrs_maps_core_fields() -> None:
    # Belegte Roh-Feldnamen (köpferl): id/arrival/departure/total_amount/guest.name.
    attrs = ChannelManagerService._lodgify_booking_to_attrs({
        "id": 5512,
        "arrival": "2026-08-01",
        "departure": "2026-08-04",
        "total_amount": 420.0,
        "currency_code": "CHF",
        "source": "Booking.com",
        "status": "Booked",
        "property_id": 991,
        "guest": {"name": "Anna Meier", "email": "a@m.ch"},
        "rooms": [{"people": 3}],
    })
    assert attrs is not None
    assert attrs["booking_id"] == "lodgify:5512"
    assert attrs["currency"] == "CHF"  # kein EUR-Fallback (Wurzel 4)
    assert attrs["customer"]["name"] == "Anna" and attrs["customer"]["surname"] == "Meier"
    assert attrs["_lodgify_status"] == "booked"


def test_lodgify_booking_to_attrs_skips_incomplete() -> None:
    # Fehlt arrival → None (kein erfundener Zeitraum).
    assert ChannelManagerService._lodgify_booking_to_attrs(
        {"id": 1, "departure": "2026-08-04"}
    ) is None


def _switch_booking(cx_id="cx-prop"):  # noqa: ANN001, ANN201
    return {"attributes": {
        "booking_id": "BK9", "property_id": cx_id, "status": "new",
        "ota_name": "Booking.com", "ota_reservation_code": "R9",
        "arrival_date": "2026-08-01", "departure_date": "2026-08-02",
        "amount": "100.00", "currency": "EUR",
        "customer": {"name": "Eva", "surname": "T", "mail": "e@t.de"}}}


def test_import_existing_bookings_future_only_uses_arrival_filter() -> None:
    # Onboarding-Bestandsimport (Standard): filtert auf Anreise ab HEUTE.
    db = _ImportDB()
    _seed_property(db)
    channex = _ImportChannex(bookings=[_switch_booking()])
    res = _import_svc(channex, db).import_existing_bookings(
        AuthContext(user_id="u", tenant_id="t1"), include_past=False
    )
    assert res.saved == 1
    # arrival_from gesetzt (nicht None) → nur künftige Buchungen.
    assert channex.last_arrival_from is not None


def test_import_existing_bookings_include_past_no_arrival_filter() -> None:
    # „Auch Vergangenheit": kein Anreise-Filter → alles, was Channex kennt.
    db = _ImportDB()
    _seed_property(db)
    channex = _ImportChannex(bookings=[_switch_booking()])
    res = _import_svc(channex, db).import_existing_bookings(
        AuthContext(user_id="u", tenant_id="t1"), include_past=True
    )
    assert res.saved == 1
    assert channex.last_arrival_from is None


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
    # Lokale Pläne für den Reconciler (Soll-Kurve über den Resolver). Basispreis
    # None = keine durchgehende Kurve, nur Datumspreise (Tests setzen ihn bei
    # Bedarf, siehe test_reconcile_pushes_continuous_base_price).
    db.tables["rate_plans"].extend([
        {"id": "rp-a", "property_id": property_id, "base_price": None,
         "currency": "USD", "created_at": "2026-01-01T00:00:00Z"},
        {"id": "rp-b", "property_id": property_id, "base_price": None,
         "currency": "USD", "created_at": "2026-01-02T00:00:00Z"},
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


def test_resolve_room_type_falls_back_on_shared_property() -> None:
    # Regression: Bei geteilter Channex-Property (Hotel) trägt die Room-Type-Map
    # local_unit_ref = room_type.id, nicht property_id. Der frühere harte Filter
    # fand nichts → das Zimmer fiel still aus dem Verfügbarkeits-Push
    # (Zertifizierung: „Availability update has no data for room type(s)").
    db = _ImportDB()
    _seed_hotel_mapping(db)
    svc = _import_svc(_ImportChannex(), db)
    rt = svc._resolve_channex_room_type(db, "t1", "p1")
    assert rt is not None, "ohne Fallback bleibt das Zimmer unversorgt"
    assert rt["channex_property_id"] == "cx-prop"
    assert rt["channex_room_type_id"] in {"cx-rt-a", "cx-rt-b"}


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


def test_restriction_rows_hotel_stop_sell_targets_own_plans_one_call() -> None:
    # Zertifizierung Test 6 (Stop Sell Update): drei Stop-Sells auf DREI
    # verschiedene Rate-Plans an drei Daten — in EINEM Channex-Call. Jede Zeile
    # darf nur ihren eigenen Plan treffen (BAR-Sperre darf B&B nicht mitsperren).
    db = _ImportDB()
    _seed_hotel_mapping(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_restriction_rows_for_property(
        "t1", "p1",
        [
            {"date_from": "2099-11-14", "date_to": "2099-11-14",
             "rate_plan_id": "rp-a", "stop_sell": True},
            {"date_from": "2099-11-16", "date_to": "2099-11-16",
             "rate_plan_id": "rp-b", "stop_sell": True},
            {"date_from": "2099-11-20", "date_to": "2099-11-20",
             "rate_plan_id": "rp-b", "stop_sell": True},
        ],
    )
    # EIN gebündelter Request (Zert: „1 API call") mit genau 3 Werten.
    assert len(channex.restriction_calls) == 1
    assert [
        (v["rate_plan_id"], v["date"], v["stop_sell"])
        for v in channex.restrictions_pushed
    ] == [
        ("cx-rp-a", "2099-11-14", True),
        ("cx-rp-b", "2099-11-16", True),
        ("cx-rp-b", "2099-11-20", True),
    ]
    assert db.tables["ari_restriction_outbox"][0]["status"] == "done"


def test_restriction_rows_cron_retry_keeps_rate_plan_targeting() -> None:
    # Der Cron-Backstop baut die values aus dem persistierten payload NEU auf —
    # ohne rate_plan_id im Payload spiegelte er die Sperre an ALLE Pläne zurück.
    db = _ImportDB()
    _seed_hotel_mapping(db)
    db.tables["ari_restriction_outbox"].append({
        "id": "r1", "tenant_id": "t1", "property_id": "p1",
        "kind": "restriction_rows",
        "payload": {"rows": [
            {"date_from": "2099-11-14", "date_to": "2099-11-14",
             "rate_plan_id": "rp-a", "stop_sell": True},
        ]},
        "date_from": "2099-11-14", "date_to": "2099-11-14",
        "status": "pending", "attempts": 0,
    })
    channex = _ImportChannex()
    _import_svc(channex, db).process_restriction_outbox()
    assert [v["rate_plan_id"] for v in channex.restrictions_pushed] == ["cx-rp-a"]


# --- Desired-State-Reconciler: DB-Soll ↔ Channex-Ist ------------------------

def test_channex_rate_to_cents_normalizes_decimal_string() -> None:
    # Channex-Asymmetrie: geschrieben Cent-Integer, zurück Dezimal-String.
    svc = _import_svc(_ImportChannex(), _ImportDB())
    assert svc._channex_rate_to_cents("138.00") == 13800
    assert svc._channex_rate_to_cents("312.66") == 31266
    assert svc._channex_rate_to_cents(None) is None
    assert svc._channex_rate_to_cents("nonsense") is None


def _future_iso(days_ahead=30):  # noqa: ANN001, ANN201
    return (date.today() + timedelta(days=days_ahead)).isoformat()


def test_reconcile_pushes_drift_and_skips_in_sync() -> None:
    # Zwei Datumspreise in der DB. Channex hat einen korrekt (kein Push), beim
    # anderen weicht die Rate ab (Drift → genau dieser eine wird gepusht).
    db = _ImportDB()
    _seed_hotel_mapping(db)
    d1, d2 = _future_iso(10), _future_iso(11)
    db.tables["rate_plan_price_overrides"].extend([
        {"rate_plan_id": "rp-a", "date": d1, "price": 241.00},
        {"rate_plan_id": "rp-a", "date": d2, "price": 241.00},
    ])
    # Channex-Ist: d1 stimmt (241.00), d2 falsch (200.00) → nur d2 ist Drift.
    channex = _ImportChannex(restrictions={
        "cx-rp-a": {d1: {"rate": "241.00"}, d2: {"rate": "200.00"}},
    })
    res = _import_svc(channex, db).reconcile_rate_plan_prices("t1", "p1")
    assert res["checked"] == 2 and res["drift"] == 1
    assert len(channex.restrictions_pushed) == 1
    v = channex.restrictions_pushed[0]
    assert v["rate_plan_id"] == "cx-rp-a" and v["rate"] == 24100
    # gepusht wurde GENAU der driftende Tag d2.
    assert v["date"] == d2


def test_reconcile_pushes_when_channex_missing_the_date() -> None:
    # Preis in DB, aber Channex kennt den Tag gar nicht (nie angekommen, z. B. der
    # Alt-'superseded'-Fall) → Drift, wird nachgepusht.
    db = _ImportDB()
    _seed_hotel_mapping(db)
    d = _future_iso(15)
    db.tables["rate_plan_price_overrides"].append(
        {"rate_plan_id": "rp-b", "date": d, "price": 111.00}
    )
    channex = _ImportChannex(restrictions={"cx-rp-b": {}})  # Channex leer
    res = _import_svc(channex, db).reconcile_rate_plan_prices("t1", "p1")
    assert res["drift"] == 1
    assert len(channex.restrictions_pushed) == 1
    assert channex.restrictions_pushed[0]["rate"] == 11100
    assert channex.restrictions_pushed[0]["rate_plan_id"] == "cx-rp-b"


def test_full_sync_restriction_rows_carry_all_declared_restrictions() -> None:
    # Zertifizierung Test 1 (Full Sync): JEDER Restriktions-Wert trägt ALLE
    # deklarierten Restriktionen (min_stay arrival+through über min_stay,
    # max_stay, CTA, CTD, stop_sell) UND den Preis — pro Rate-Plan, RLE-gebündelt
    # (uniformer Horizont = EIN Range je Plan).
    db = _ImportDB()
    _seed_hotel_mapping(db)
    for rp in db.tables["rate_plans"]:
        rp["base_price"] = 100.00 if rp["id"] == "rp-a" else 120.00
        rp["min_stay"] = 2
    svc = _import_svc(_ImportChannex(), db)
    start = date.today() + timedelta(days=1)
    rows = svc._full_sync_restriction_rows(db, "p1", start, start + timedelta(days=3))
    assert len(rows) == 2  # je Plan EIN durchgehendes RLE-Segment
    by_plan = {r["rate_plan_id"]: r for r in rows}
    assert by_plan["rp-a"]["rate_cents"] == 10000
    assert by_plan["rp-b"]["rate_cents"] == 12000
    for r in rows:
        assert r["min_stay"] == 2
        assert r["max_stay"] == 0  # keine Obergrenze (Channex-Semantik)
        assert r["closed_to_arrival"] is False
        assert r["closed_to_departure"] is False
        assert r["stop_sell"] is False
        assert r["date_from"] == start.isoformat()
        assert r["date_to"] == (start + timedelta(days=3)).isoformat()


def test_full_sync_restriction_rows_pick_up_overrides_and_stop_sell() -> None:
    # Overrides zerschneiden den Run: min_stay-Override, plan-genauer CTA-Override
    # und ein Objekt-Stop-Sell-Tag erscheinen mit ihren echten Werten (Wurzel 4:
    # Wahrheit aus den Quelltabellen, keine erfundenen Defaults).
    db = _ImportDB()
    _seed_hotel_mapping(db)
    for rp in db.tables["rate_plans"]:
        rp["base_price"] = 100.00
    start = date.today() + timedelta(days=1)
    d1 = (start + timedelta(days=1)).isoformat()
    db.tables["rate_plan_min_stay_overrides"].append(
        {"rate_plan_id": "rp-a", "date": d1, "min_stay": 5}
    )
    db.tables["rate_plan_restriction_overrides"].append(
        {"rate_plan_id": "rp-a", "date": d1, "closed_to_arrival": True,
         "closed_to_departure": None, "max_stay": 7}
    )
    db.tables["stop_sell"].append(
        {"property_id": "p1", "date": d1, "rate_plan_id": None, "scope": "all"}
    )
    svc = _import_svc(_ImportChannex(), db)
    rows = svc._full_sync_restriction_rows(db, "p1", start, start + timedelta(days=2))
    over = [r for r in rows if r["rate_plan_id"] == "rp-a" and r["date_from"] == d1]
    assert len(over) == 1
    assert over[0]["min_stay"] == 5
    assert over[0]["max_stay"] == 7
    assert over[0]["closed_to_arrival"] is True
    assert over[0]["closed_to_departure"] is False
    assert over[0]["stop_sell"] is True
    # Objekt-Stop (rate_plan_id null) trifft AUCH den zweiten Plan.
    over_b = [r for r in rows if r["rate_plan_id"] == "rp-b" and r["date_from"] == d1]
    assert over_b and over_b[0]["stop_sell"] is True
    assert over_b[0]["min_stay"] == 1  # kein Override für rp-b


def test_stop_sell_weekday_mask_uses_native_days_field() -> None:
    # Wochentags-Stop über einen Range: EIN Range-value mit nativem Channex-
    # `days`-Feld (ARI-Doku), NICHT mehr ein value pro Tag.
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_stop_sell_for_property(
        "t1", "p1", [(date(2099, 6, 22), date(2099, 6, 28))],
        stop_sell=True, days=["sa", "su"],
    )
    assert len(channex.restrictions_pushed) == 1
    v = channex.restrictions_pushed[0]
    assert v["date_from"] == "2099-06-22" and v["date_to"] == "2099-06-28"
    assert v["days"] == ["sa", "su"]
    assert v["stop_sell"] is True


def _seed_shared_hotel(db):  # noqa: ANN001, ANN201
    """ZWEI Zimmer (p-twin/p-double) teilen sich EINE Channex-Property (0158):
    je Zimmer eine eigene Map-Zeile auf cx-prop, ein eigener Room-Type und ein
    gemappter Rate-Plan — das Zertifizierungs-Setup (Twin/Double unter einer
    Property)."""
    rooms = (
        ("p-twin", "m-twin", "rtm-twin", "cx-rt-twin",
         "rpm-twin", "cx-rp-twin", "rp-twin", "2026-01-01T00:00:00Z"),
        ("p-double", "m-double", "rtm-double", "cx-rt-double",
         "rpm-double", "cx-rp-double", "rp-double", "2026-01-02T00:00:00Z"),
    )
    for pid, mid, rtm, cx_rt, rpm, cx_rp, rp_local, created in rooms:
        db.tables["properties"].append(
            {"id": pid, "tenant_id": "t1", "title": pid}
        )
        db.tables["channex_property_map"].append(
            {"id": mid, "tenant_id": "t1", "property_id": pid,
             "channex_property_id": "cx-prop", "deleted_at": None,
             "created_at": created}
        )
        db.tables["channex_room_type_map"].append(
            {"id": rtm, "tenant_id": "t1", "property_map_id": mid,
             "local_unit_ref": pid, "channex_room_type_id": cx_rt,
             "deleted_at": None}
        )
        db.tables["channex_rate_plan_map"].append(
            {"id": rpm, "tenant_id": "t1", "room_type_map_id": rtm,
             "channex_rate_plan_id": cx_rp, "local_rate_plan_id": rp_local,
             "deleted_at": None}
        )
        db.tables["rate_plans"].append(
            {"id": rp_local, "property_id": pid, "base_price": 100.00,
             "currency": "USD", "created_at": "2026-01-01T00:00:00Z"}
        )


def test_restriction_rows_multi_one_call_across_shared_property() -> None:
    # Zertifizierung Tests 3-8: eine Aktion über MEHRERE Zimmer (Twin+Double,
    # geteilte Channex-Property) → EIN POST /restrictions, plan-genaues Targeting,
    # Outbox je Objekt abgeschlossen.
    db = _ImportDB()
    _seed_shared_hotel(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_restriction_rows_multi("t1", {
        "p-twin": [{"date_from": "2099-11-23", "date_to": "2099-11-23",
                    "rate_plan_id": "rp-twin", "min_stay": 3}],
        "p-double": [{"date_from": "2099-11-25", "date_to": "2099-11-25",
                      "rate_plan_id": "rp-double", "min_stay": 2}],
    })
    assert len(channex.restriction_calls) == 1
    assert {
        (v["rate_plan_id"], v["date"], v["min_stay_arrival"])
        for v in channex.restrictions_pushed
    } == {("cx-rp-twin", "2099-11-23", 3), ("cx-rp-double", "2099-11-25", 2)}
    outbox = db.tables["ari_restriction_outbox"]
    assert len(outbox) == 2
    assert all(r["status"] == "done" for r in outbox)


def test_full_sync_shared_property_is_two_calls() -> None:
    # Zertifizierung Test 1: geteilte Channex-Property → EIN Availability-Call
    # (beide Room-Types) + EIN Restrictions-Call (alle Rate-Plans), und JEDER
    # Restriktions-Wert trägt alle deklarierten Restrictions.
    db = _ImportDB()
    _seed_shared_hotel(db)
    channex = _ImportChannex()
    res = _import_svc(channex, db).full_sync_property("t1", "p-twin")
    assert len(channex.availability_calls) == 1
    assert {v["room_type_id"] for v in channex.pushed} == {
        "cx-rt-twin", "cx-rt-double"
    }
    assert res["availability_values"] == 2  # je Zimmer EIN durchgehender Range
    assert len(channex.restriction_calls) == 1
    assert {v["rate_plan_id"] for v in channex.restrictions_pushed} == {
        "cx-rp-twin", "cx-rp-double"
    }
    declared = ("rate", "min_stay_arrival", "min_stay_through", "max_stay",
                "closed_to_arrival", "closed_to_departure", "stop_sell")
    for v in channex.restrictions_pushed:
        for key in declared:
            assert key in v


def test_sync_content_single_vacation_object_creates_full_mapping() -> None:
    # Ferienobjekt = der NICHT-geteilte Normalfall (1 property = 1 Channex-
    # Property = 1 synthetischer Room-Type = Rate-Plans daran). Der geteilte-
    # Property-Umbau (0158) ist überall nur eine Verzweigung ab sibling_count > 1;
    # dieser End-to-End-Test der Erstanlage sichert ab, dass der Einzelfall
    # dabei nicht kaputtgeht: Property/Room-Type/Rate-Plan werden angelegt, der
    # Property-Titel bleibt der OBJEKTname (nicht der Tenant-Name), und alle drei
    # Map-Ebenen zeigen aufs eine Objekt.
    db = _ImportDB()
    db.tables["properties"].append({
        "id": "p1", "tenant_id": "t1", "title": "Ferienhaus am See",
        "property_type": "ferienhaus", "country": "DE", "city": "Kiel",
        "max_guests": 4,
    })
    db.tables["rate_plans"].append({
        "id": "rp1", "property_id": "p1", "name": "Standardpreis",
        "base_price": 120.00, "currency": "EUR", "min_stay": 1,
        "created_at": "2026-01-01T00:00:00Z",
    })
    channex = _ImportChannex()
    out = _import_svc(channex, db).sync_content("t1", property_id="p1")

    assert out == {
        "channex_property_id": "cx-prop", "channex_room_type_id": "cx-rt-1"
    }
    # Property: Objektname als Titel (kein Tenant-Name-Override beim Einzelobjekt),
    # Ferientyp korrekt gemappt.
    assert len(channex.created_properties) == 1
    assert channex.created_properties[0]["title"] == "Ferienhaus am See"
    assert channex.created_properties[0]["property_type"] == "holiday_home"
    # Genau EIN synthetischer Room-Type am Objekt (local_unit_ref = property_id).
    assert [rt["title"] for rt in channex.created_room_types] == ["Ferienhaus am See"]
    rt_maps = [r for r in db.tables["channex_room_type_map"] if not r.get("deleted_at")]
    assert len(rt_maps) == 1 and rt_maps[0]["local_unit_ref"] == "p1"
    # Rate-Plan hängt am synthetischen Room-Type.
    assert [(rp["title"], rp["room_type_id"]) for rp in channex.created_rate_plans] == [
        ("Standardpreis", "cx-rt-1")
    ]
    # Alle drei Map-Ebenen zeigen aufs eine Objekt.
    prop_maps = [r for r in db.tables["channex_property_map"] if not r.get("deleted_at")]
    assert len(prop_maps) == 1
    assert prop_maps[0]["property_id"] == "p1"
    assert prop_maps[0]["channex_property_id"] == "cx-prop"
    rp_maps = [r for r in db.tables["channex_rate_plan_map"] if not r.get("deleted_at")]
    assert len(rp_maps) == 1 and rp_maps[0]["local_rate_plan_id"] == "rp1"


def test_channel_overview_aggregates_ota_marketplace_ical() -> None:
    # Kanal-Übersicht für die Channel-Manager-Seite: je OTA-Portal die Zahl der
    # AKTIV verbundenen Objekte, der Marktplatz-Count (status=active AND
    # listed_on_marketplace) und die iCal-Objekte (aktiver externer Kalender).
    # Alles tenant-lokal aus der DB — keine erfundenen Zahlen.
    db = _ImportDB()
    # Zwei Objekte: p1 aktiv+gelistet, p2 aktiv aber NICHT gelistet.
    db.tables["properties"].append(
        {"id": "p1", "tenant_id": "t1", "title": "A", "status": "active",
         "listed_on_marketplace": True}
    )
    db.tables["properties"].append(
        {"id": "p2", "tenant_id": "t1", "title": "B", "status": "active",
         "listed_on_marketplace": False}
    )
    # OTA-Verbindungen: Booking an p1 aktiv + p2 aktiv (=2), Airbnb an p1 inaktiv (=0).
    db.tables["channex_channel_connection"].extend([
        {"tenant_id": "t1", "property_id": "p1",
         "ota_portal_code": "BookingCom", "is_active": True},
        {"tenant_id": "t1", "property_id": "p2",
         "ota_portal_code": "BookingCom", "is_active": True},
        {"tenant_id": "t1", "property_id": "p1",
         "ota_portal_code": "AirBNB", "is_active": False},
    ])
    # iCal: p1 hat einen aktiven externen Kalender.
    db.tables["external_calendar"].append(
        {"tenant_id": "t1", "property_id": "p1", "is_active": True}
    )

    ov = _import_svc(_ImportChannex(), db).channel_overview(
        AuthContext(user_id="u", tenant_id="t1")
    )

    by_code = {c["code"]: c for c in ov["ota"]}
    assert by_code["BookingCom"]["connected_count"] == 2
    assert by_code["AirBNB"]["connected_count"] == 0  # inaktive Verbindung zählt nicht
    assert by_code["AirBNB"]["connection_type"] == "oauth"
    assert by_code["BookingCom"]["connection_type"] == "credential"
    # Marktplatz: nur p1 (aktiv + gelistet), p2 nicht (unlisted).
    assert ov["marketplace"]["listed_count"] == 1
    # iCal: ein Objekt mit aktivem Kalender.
    assert ov["ical"]["synced_count"] == 1


def test_channel_detail_lists_all_objects_connected_and_unconnected() -> None:
    # Kanal-Detailfläche (SiteMinder/Hostaway-Muster): eine Zeile JE aktivem
    # Objekt — verbundene mit Status, nicht verbundene mit connected=False (im UI
    # der „Verbinden"-Button). Fremde Portale/Objekte bleiben außen vor.
    db = _ImportDB()
    db.tables["properties"].extend([
        {"id": "p1", "tenant_id": "t1", "title": "Twin Room", "status": "active"},
        {"id": "p2", "tenant_id": "t1", "title": "Double Room", "status": "active"},
        # p3 ist aktiv, aber noch NICHT mit Booking verbunden → Zeile ohne Hotel-ID.
        {"id": "p3", "tenant_id": "t1", "title": "Suite", "status": "active"},
        # p4 ist inaktiv (nicht buchbar) → keine Zeile.
        {"id": "p4", "tenant_id": "t1", "title": "Archiv", "status": "inactive"},
    ])
    db.tables["channex_property_map"].extend([
        {"id": "m1", "tenant_id": "t1", "property_id": "p1", "deleted_at": None,
         "sync_enabled": True, "last_sync_status": "ok", "last_sync_error": None},
        {"id": "m2", "tenant_id": "t1", "property_id": "p2", "deleted_at": None,
         "sync_enabled": True, "last_sync_status": "error",
         "last_sync_error": "boom"},
    ])
    db.tables["channex_channel_connection"].extend([
        {"tenant_id": "t1", "property_id": "p1", "ota_portal_code": "BookingCom",
         "ota_hotel_id": "10485037", "is_active": True, "last_error": None},
        {"tenant_id": "t1", "property_id": "p2", "ota_portal_code": "BookingCom",
         "ota_hotel_id": "10485038", "is_active": False, "last_error": None},
        # Anderes Portal (Airbnb) darf die Booking-Zeile NICHT beeinflussen.
        {"tenant_id": "t1", "property_id": "p1", "ota_portal_code": "AirBNB",
         "ota_hotel_id": "999", "is_active": True, "last_error": None},
    ])

    detail = _import_svc(_ImportChannex(), db).channel_detail(
        AuthContext(user_id="u", tenant_id="t1"), "BookingCom"
    )

    assert detail["portal"] == "Booking.com"
    assert detail["connected"] is True
    assert detail["connected_count"] == 1  # nur p1 aktiv verbunden
    assert detail["total_count"] == 3      # p1, p2, p3 (p4 inaktiv fällt raus)
    rows = {m["property_id"]: m for m in detail["mappings"]}
    assert set(rows) == {"p1", "p2", "p3"}
    # p1: verbunden + aktiv.
    assert rows["p1"]["ota_hotel_id"] == "10485037"
    assert rows["p1"]["connected"] is True
    assert rows["p1"]["is_active"] is True
    # p2: Verbindung existiert, aber pausiert.
    assert rows["p2"]["connected"] is True
    assert rows["p2"]["is_active"] is False
    assert rows["p2"]["last_sync_error"] == "boom"
    # p3: KEINE Booking-Verbindung → „Verbinden"-Zeile.
    assert rows["p3"]["connected"] is False
    assert rows["p3"]["ota_hotel_id"] is None


def test_channel_detail_scopes_to_tenant() -> None:
    # Wurzel 3: Verbindungen eines FREMDEN Tenants dürfen nicht durchsickern.
    db = _ImportDB()
    db.tables["properties"].append(
        {"id": "p1", "tenant_id": "t2", "title": "Fremd", "status": "active"}
    )
    db.tables["channex_channel_connection"].append(
        {"tenant_id": "t2", "property_id": "p1", "ota_portal_code": "BookingCom",
         "ota_hotel_id": "x", "is_active": True, "last_error": None}
    )

    detail = _import_svc(_ImportChannex(), db).channel_detail(
        AuthContext(user_id="u", tenant_id="t1"), "BookingCom"
    )

    assert detail["mappings"] == []
    assert detail["connected"] is False


def test_pin_and_unpin_channel_roundtrip() -> None:
    # Kanal in die Sidebar holen (Dropdown „Kanal hinzufügen") und wieder
    # entfernen. Idempotent: doppeltes Pinnen bleibt eine Zeile.
    db = _ImportDB()
    svc = _import_svc(_OAuthChannex(), db)
    ctx = AuthContext(user_id="u", tenant_id="t1")

    svc.pin_channel(ctx, "BookingCom")
    svc.pin_channel(ctx, "BookingCom")  # idempotent
    assert svc.list_pinned_channels(ctx) == ["BookingCom"]
    assert len(db.tables["tenant_pinned_channel"]) == 1

    svc.unpin_channel(ctx, "BookingCom")
    assert svc.list_pinned_channels(ctx) == []


def test_pin_channel_rejects_unknown_portal() -> None:
    # Nur real verbindbare Kanäle (Live-Katalog) dürfen gepinnt werden.
    db = _ImportDB()
    ctx = AuthContext(user_id="u", tenant_id="t1")
    try:
        _import_svc(_OAuthChannex(), db).pin_channel(ctx, "TotalErfunden")
        raise AssertionError("erwartete ChannelManagerError")
    except ChannelManagerError as exc:
        assert exc.status_code == 400


def test_pinned_channels_are_tenant_scoped() -> None:
    # Wurzel 3: fremde Pins dürfen nicht durchsickern.
    db = _ImportDB()
    db.tables["tenant_pinned_channel"].append(
        {"tenant_id": "t2", "portal_code": "Expedia"}
    )
    got = _import_svc(_OAuthChannex(), db).list_pinned_channels(
        AuthContext(user_id="u", tenant_id="t1")
    )
    assert got == []


def test_channel_overview_marks_pinned() -> None:
    # overview.ota[].pinned spiegelt tenant_pinned_channel (Sidebar-Zusatzzeilen).
    db = _ImportDB()
    db.tables["tenant_pinned_channel"].append(
        {"tenant_id": "t1", "portal_code": "Expedia"}
    )
    ov = _import_svc(_ImportChannex(), db).channel_overview(
        AuthContext(user_id="u", tenant_id="t1")
    )
    by_code = {c["code"]: c for c in ov["ota"]}
    assert by_code["Expedia"]["pinned"] is True
    assert by_code["BookingCom"]["pinned"] is False


def test_import_rooms_rates_never_rehomes_shared_maps() -> None:
    # Live-Bug (Booking.com-Connect, 17.07.): import_rooms_rates_for_property
    # löste die property_map per limit(1) auf und hängte per Upsert die
    # Double-Room-Map aufs Twin-Zimmer um (local_unit_ref+property_map_id) —
    # Full Sync und Delta-Pushes übersprangen Double danach still. Bestehende
    # Maps dürfen NIE umgehängt werden; unbekannte Room-Types einer GETEILTEN
    # Channex-Property lassen sich keinem Zimmer zuordnen → überspringen.
    db = _ImportDB()
    _seed_shared_hotel(db)
    channex = _ImportChannex(
        room_types=[
            {"id": "cx-rt-twin", "attributes": {"title": "Twin Room"}},
            {"id": "cx-rt-double", "attributes": {"title": "Double Room"}},
            {"id": "cx-rt-fremd", "attributes": {"title": "Unbekannt"}},
        ],
        rate_plans=[
            {"id": "cx-rp-twin",
             "attributes": {"room_type_id": "cx-rt-twin", "title": "Twin BAR"}},
            {"id": "cx-rp-double",
             "attributes": {"room_type_id": "cx-rt-double",
                            "title": "Double BAR"}},
        ],
    )
    _import_svc(channex, db).import_rooms_rates_for_property("t1", "cx-prop")
    by_cx = {
        r["channex_room_type_id"]: r
        for r in db.tables["channex_room_type_map"]
    }
    assert by_cx["cx-rt-twin"]["local_unit_ref"] == "p-twin"
    assert by_cx["cx-rt-twin"]["property_map_id"] == "m-twin"
    assert by_cx["cx-rt-double"]["local_unit_ref"] == "p-double"
    assert by_cx["cx-rt-double"]["property_map_id"] == "m-double"
    # Unbekannter Room-Type: bei geteilter Property KEINE geratene Zuordnung.
    assert "cx-rt-fremd" not in by_cx
    # Rate-Plan-Maps unangetastet, keine neuen lokalen Pläne erfunden.
    assert {
        r["channex_rate_plan_id"]: r["room_type_map_id"]
        for r in db.tables["channex_rate_plan_map"]
    } == {"cx-rp-twin": "rtm-twin", "cx-rp-double": "rtm-double"}
    assert len(db.tables["rate_plans"]) == 2


def test_free_ota_nights_pushes_days_already_freed_by_release_path() -> None:
    # Live-Bug (Cert Test 11): _release_nights hatte 2 von 3 Storno-Nächten schon
    # geöffnet → _free_ota_nights pushte nur die verbliebene 'booked'-Nacht, die
    # OTAs behielten die übrigen Tage dauerhaft gesperrt. Jetzt zählt der ECHTE
    # Kalenderstand NACH der Freigabe: EIN Range-Push über alle offenen Nächte.
    db = _ImportDB()
    _seed_with_room_type(db)
    db.tables["availability"].extend([
        {"property_id": "p1", "date": "2026-12-03", "status": "booked",
         "source": "portal"},
        {"property_id": "p1", "date": "2026-12-04", "status": "open",
         "source": "manual"},
        {"property_id": "p1", "date": "2026-12-05", "status": "open",
         "source": "manual"},
    ])
    channex = _ImportChannex()
    svc = _import_svc(channex, db)
    svc._free_ota_nights(
        db, "t1", "p1", "portal", ["2026-12-03", "2026-12-04", "2026-12-05"]
    )
    assert [
        (v["date_from"], v["date_to"], v["availability"]) for v in channex.pushed
    ] == [("2026-12-03", "2026-12-05", 1)]


def test_free_ota_nights_keeps_foreign_blocked_day_closed() -> None:
    # Ein Tag mit Fremd-Belegung (anderer Kanal/manueller Block) darf NICHT als
    # frei an Channex gehen — der Range wird um ihn herum zerschnitten.
    db = _ImportDB()
    _seed_with_room_type(db)
    db.tables["availability"].extend([
        {"property_id": "p1", "date": "2026-12-03", "status": "booked",
         "source": "portal"},
        {"property_id": "p1", "date": "2026-12-04", "status": "booked",
         "source": "direct"},
        {"property_id": "p1", "date": "2026-12-05", "status": "booked",
         "source": "portal"},
    ])
    channex = _ImportChannex()
    svc = _import_svc(channex, db)
    svc._free_ota_nights(
        db, "t1", "p1", "portal", ["2026-12-03", "2026-12-04", "2026-12-05"]
    )
    assert [
        (v["date_from"], v["date_to"], v["availability"]) for v in channex.pushed
    ] == [("2026-12-03", "2026-12-03", 1), ("2026-12-05", "2026-12-05", 1)]


def test_exclude_superseded_days_splits_ranges() -> None:
    # Range-values werden um superseded Tage ZERSCHNITTEN — ein reiner
    # `date`-Filter ließe den Tag im Range und überschriebe den neueren Wert.
    from src.features.channel_manager.ari_push import _exclude_superseded_days

    values = [{"property_id": "cx", "rate_plan_id": "rp", "rate": 100,
               "date_from": "2099-06-20", "date_to": "2099-06-26"}]
    out = _exclude_superseded_days(values, {"2099-06-23"})
    assert [(v.get("date"), v.get("date_from"), v.get("date_to")) for v in out] == [
        (None, "2099-06-20", "2099-06-22"),
        (None, "2099-06-24", "2099-06-26"),
    ]
    # Einzeltag-Kollaps prüft die Wochentags-Maske lokal (kein days-Feld am date).
    masked = [{"rate": 1, "days": ["mo", "tu", "we", "th", "fr", "sa", "su"],
               "date_from": "2099-06-22", "date_to": "2099-06-24"}]
    out2 = _exclude_superseded_days(masked, {"2099-06-23"})
    assert [v["date"] for v in out2] == ["2099-06-22", "2099-06-24"]
    assert all("days" not in v for v in out2)


def test_reconcile_pushes_continuous_base_price() -> None:
    # Der DURCHGEHENDE Plan-Basispreis ist Teil des Solls (nicht nur die
    # Datumspreise): Channex kennt gar keine Preise → JEDER Tag des Horizonts
    # ist Drift und wird mit dem Basispreis dieses Plans nachgepusht — nie mit
    # dem eines anderen Plans (B&B ≠ BAR).
    db = _ImportDB()
    _seed_hotel_mapping(db)
    for rp in db.tables["rate_plans"]:
        if rp["id"] == "rp-a":
            rp["base_price"] = 120.00
    channex = _ImportChannex(restrictions={"cx-rp-a": {}, "cx-rp-b": {}})
    res = _import_svc(channex, db).reconcile_rate_plan_prices(
        "t1", "p1", horizon_days=5
    )
    # 6 Tage (heute..+5) nur für rp-a — rp-b hat keinen Basispreis, kein Soll.
    assert res["drift"] == 6
    # Alle 6 Tage tragen denselben Basispreis → EIN date_range statt sechs
    # Einzeltag-Objekten (Channex-Zertifizierung 17.07.2026: „Use date_range
    # syntax with merged sequences instead of single-date objects").
    assert len(channex.restrictions_pushed) == 1
    val = channex.restrictions_pushed[0]
    assert val["rate"] == 12000
    assert val["rate_plan_id"] == "cx-rp-a"
    assert "date" not in val
    assert val["date_from"] < val["date_to"]


def test_reconcile_noop_when_all_in_sync() -> None:
    # DB und Channex identisch → kein Push (der teure Push wird vermieden).
    db = _ImportDB()
    _seed_hotel_mapping(db)
    d = _future_iso(20)
    db.tables["rate_plan_price_overrides"].append(
        {"rate_plan_id": "rp-a", "date": d, "price": 312.66}
    )
    channex = _ImportChannex(restrictions={"cx-rp-a": {d: {"rate": "312.66"}}})
    res = _import_svc(channex, db).reconcile_rate_plan_prices("t1", "p1")
    assert res["drift"] == 0
    assert channex.restrictions_pushed == []


def test_push_restrictions_cta_ctd_sends_to_channex() -> None:
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_restrictions_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25),
        closed_to_arrival=True, closed_to_departure=False,
    )
    # Range-Syntax: 23.–25. Juni = EIN value mit date_from/date_to (Zertifizierung:
    # merged date_range statt Einzeltag-Objekten; live per PUT+Readback verifiziert).
    assert len(channex.restrictions_pushed) == 1
    val = channex.restrictions_pushed[0]
    assert val["date_from"] == "2026-06-23" and val["date_to"] == "2026-06-25"
    assert "date" not in val
    assert val["property_id"] == "cx-prop"
    assert val["rate_plan_id"] == "cx-rate"
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
    # Range-Syntax: 23.–25. Juni = EIN value mit date_from/date_to.
    assert len(channex.restrictions_pushed) == 1
    val = channex.restrictions_pushed[0]
    assert val["property_id"] == "cx-prop"
    assert val["rate_plan_id"] == "cx-rate"
    assert val["max_stay"] == 14
    assert val["date_from"] == "2026-06-23" and val["date_to"] == "2026-06-25"
    assert "date" not in val
    assert "max_stay_arrival" not in val


def test_push_rate_min_stay_sends_merged_range() -> None:
    # Zertifizierungsvorgabe („use date_range syntax with merged sequences"):
    # EIN Range-value für den Zeitraum, min_stay_arrival UND min_stay_through
    # gesetzt. Range-Schreibweise ist live per PUT+Readback verifiziert.
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_rate_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 25), min_stay=3
    )
    assert len(channex.restrictions_pushed) == 1
    v = channex.restrictions_pushed[0]
    assert v["date_from"] == "2026-06-23" and v["date_to"] == "2026-06-25"
    assert "date" not in v
    assert v["min_stay_arrival"] == 3
    assert v["min_stay_through"] == 3


def test_push_rate_single_day_uses_date_key() -> None:
    # Einzeltag bleibt ein `date`-value (Single-Date-Update-Format der Tests 2/3).
    db = _ImportDB()
    _seed_with_rate_plan(db)
    channex = _ImportChannex()
    _import_svc(channex, db).push_rate_for_property(
        "t1", "p1", date(2026, 6, 23), date(2026, 6, 23), rate_cents=13800
    )
    assert len(channex.restrictions_pushed) == 1
    v = channex.restrictions_pushed[0]
    assert v["date"] == "2026-06-23"
    assert "date_from" not in v and "date_to" not in v


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


def test_rate_plan_reuse_only_at_same_room_type_map() -> None:
    # Container-Rückbau: der lokale Plan rp1 hat eine aktive Map an der ALTEN
    # Kategorie-room_type_map (rt-old). Am synthetischen Room-Type (rt1) darf NICHT
    # umgehängt werden (room_type_id ist bei Channex immutable → PUT 422). Der Sync
    # legt am synthetischen Room-Type NEU an; die Alt-Map wird ignoriert (sie wird
    # separat von _prune_orphan_room_types samt Room-Type gelöscht).
    db = _ImportDB()
    _seed_with_room_type(db)  # synthetischer Room-Type rt1 (local_unit_ref=p1)
    db.tables["channex_room_type_map"].append(
        {"id": "rt-old", "tenant_id": "t1", "property_map_id": "m1",
         "local_unit_ref": "old-cat", "channex_room_type_id": "cx-rt-old",
         "deleted_at": None}
    )
    db.tables["channex_rate_plan_map"].append(
        {"id": "rpm-old", "tenant_id": "t1", "room_type_map_id": "rt-old",
         "local_rate_plan_id": "rp1", "title": "Standard",
         "channex_rate_plan_id": "cx-rp-existing", "deleted_at": None}
    )
    channex = _ImportChannex()
    svc = _import_svc(channex, db)
    result = svc._upsert_channex_rate_plan(
        db, "t1", "rt1", "cx-prop", "cx-rt",
        {"id": "rp1", "name": "Standard", "base_price": 129},
        "EUR",
    )
    # NEU angelegt am synthetischen Room-Type (kein Umhäng-PUT auf die Alt-Map).
    assert channex.created_rate_plans, "create_rate_plan wurde nicht aufgerufen"
    assert result == channex.created_rate_plans[0]["_cx_id"]
    assert not channex.updated_rate_plans, "es darf kein Umhäng-PUT geben"
    assert channex.created_rate_plans[0]["room_type_id"] == "cx-rt"
    # Die Alt-Map bleibt unangetastet (Prune räumt sie separat).
    assert db.tables["channex_rate_plan_map"][0]["room_type_map_id"] == "rt-old"


def test_rate_plan_update_when_already_at_synthetic_room_type() -> None:
    # Ist der Plan bereits am synthetischen Room-Type gemappt → reines Update
    # (kein Neuanlegen, kein immutable-Konflikt).
    db = _ImportDB()
    _seed_with_room_type(db)  # rt1 = synthetischer Room-Type
    db.tables["channex_rate_plan_map"].append(
        {"id": "rpm1", "tenant_id": "t1", "room_type_map_id": "rt1",
         "local_rate_plan_id": "rp1", "title": "Standard",
         "channex_rate_plan_id": "cx-rp1", "deleted_at": None}
    )
    channex = _ImportChannex()
    svc = _import_svc(channex, db)
    result = svc._upsert_channex_rate_plan(
        db, "t1", "rt1", "cx-prop", "cx-rt",
        {"id": "rp1", "name": "Standard", "base_price": 140},
        "EUR",
    )
    assert result == "cx-rp1"
    assert channex.updated_rate_plans and not channex.created_rate_plans


def test_prune_orphan_room_type_deletes_and_softdeletes_children() -> None:
    # Alte Kategorie-room_type_maps (rt-old-a/b) werden geprunt: Channex-Room-Type
    # gelöscht (kaskadiert die Rate-Plans) UND die untergeordneten
    # channex_rate_plan_map-Zeilen soft-deleted (Gegenzustand, Wurzel 1). Der
    # synthetische Room-Type (local_unit_ref=p1) bleibt.
    db = _ImportDB()
    _seed_with_room_type(db)  # rt1 = synthetisch (local_unit_ref=p1)
    db.tables["channex_room_type_map"].append(
        {"id": "rt-old", "tenant_id": "t1", "property_map_id": "m1",
         "local_unit_ref": "cat-a", "channex_room_type_id": "cx-rt-old",
         "deleted_at": None}
    )
    db.tables["channex_rate_plan_map"].append(
        {"id": "rpm-old", "tenant_id": "t1", "room_type_map_id": "rt-old",
         "local_rate_plan_id": "rp1", "channex_rate_plan_id": "cx-rp-old",
         "deleted_at": None}
    )
    channex = _ImportChannex()
    svc = _import_svc(channex, db)
    # Scope = die Map-Zeile des Objekts (m1) — bei geteilter Channex-Property
    # (0158) darf der Prune die Room-Types der Geschwister-Zimmer nicht anfassen.
    svc._prune_orphan_room_types(db, "t1", "m1", {"p1"})
    # Kind-Rate-Plan ZUERST explizit bei Channex gelöscht (delete_room_type
    # entwaist ihn nur — er würde sonst per Titel das Neuanlegen blockieren).
    assert "cx-rp-old" in channex.deleted_rate_plans
    # Alter Kategorie-Room-Type geprunt (Channex-Delete + Map + Kind soft-deleted).
    assert "cx-rt-old" in channex.deleted_room_types
    old_rt = next(r for r in db.tables["channex_room_type_map"] if r["id"] == "rt-old")
    assert old_rt["deleted_at"] is not None
    orphan = next(r for r in db.tables["channex_rate_plan_map"] if r["id"] == "rpm-old")
    assert orphan["deleted_at"] is not None
    # Der synthetische Room-Type rt1 bleibt aktiv.
    assert "cx-rt" not in channex.deleted_room_types
    syn = next(r for r in db.tables["channex_room_type_map"] if r["id"] == "rt1")
    assert syn["deleted_at"] is None


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

    def get_channel_mapping_details(self, *, channel, settings):  # noqa: ANN001, ANN201
        # OTA-Zimmer mit je einer Rate — die Zuordnung ist zimmer-basiert, die
        # Rate wird serverseitig expandiert.
        return {"data": {"rooms": [
            {"id": 11, "title": "OTA Zimmer", "rates": [
                {"id": 22, "title": "Standard", "max_persons": 2},
            ]},
        ]}}

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
        # Echter Katalog-Shape (live verifiziert): Airbnb hat nur `email` als
        # sichtbares String-Feld (→ OAuth); Booking.com hat hotel_id UND email
        # (beide Pflicht); ein fiktiver Mehrfeld-Kanal (zwei IDs, wie die
        # Autovermieter) prüft, dass ALLE Credential-Felder abgefragt werden.
        return {"data": [
            {"code": "AirBNB", "params": {
                "code": {"type": "hidden", "title": "Token Code", "position": 0},
                "email": {"type": "string", "title": "Property Email",
                          "rules": True, "position": 3},
            }},
            {"code": "BookingCom", "params": {
                "hotel_id": {"type": "string", "title": "Hotel ID", "position": 0},
                "email": {"type": "string", "title": "Property Email",
                          "rules": True, "position": 3},
                "machine_account": {"type": "hidden", "title": "Machine Account",
                                    "position": 1},
            }},
            {"code": "Avis", "params": {
                "agent_id": {"type": "string", "title": "Agent ID", "position": 0},
                "station_code": {"type": "string", "title": "Station Code",
                                 "position": 1},
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
    db.tables["channex_room_type_map"].append(
        {"id": "rtm1", "tenant_id": tenant_id, "property_map_id": "m1",
         "channex_room_type_id": "cx-rt", "local_unit_ref": "p1",
         "deleted_at": None}
    )
    db.tables["channex_rate_plan_map"].append(
        {"id": "rpm1", "tenant_id": tenant_id, "property_id": "p1",
         "room_type_map_id": "rtm1", "channex_rate_plan_id": "cx-rate",
         "created_at": "2026-01-01T00:00:00Z", "deleted_at": None}
    )


def test_supported_portals_marks_airbnb_oauth() -> None:
    db = _ImportDB()
    svc = _import_svc(_OAuthChannex(), db)
    portals = {p["code"]: p for p in svc.list_supported_portals()}
    # Airbnb: OAuth — hat nur `email` (kein Credential-Login) → keine Felder.
    assert portals["AirBNB"]["connection_type"] == "oauth"
    assert portals["AirBNB"]["fields"] == []
    # Booking.com: credential-basiert. ALLE sichtbaren Pflichtfelder werden
    # abgefragt — hotel_id UND Property-E-Mail (früher fiel email raus).
    assert portals["BookingCom"]["connection_type"] == "credential"
    keys = [f["key"] for f in portals["BookingCom"]["fields"]]
    assert keys == ["hotel_id", "email"]  # nach Position sortiert
    email_field = next(f for f in portals["BookingCom"]["fields"] if f["key"] == "email")
    assert email_field["type"] == "email"
    # `machine_account` ist hidden → nie abgefragt.
    assert "machine_account" not in keys


def test_supported_portals_asks_all_credential_fields() -> None:
    # Mehrfeld-Kanal (wie Autovermieter Avis: Agent-ID + Station-Code): ALLE
    # sichtbaren String-Felder müssen abgefragt werden, nicht nur das erste.
    db = _ImportDB()
    portals = {p["code"]: p for p in _import_svc(_OAuthChannex(), db).list_supported_portals()}
    assert portals["Avis"]["connection_type"] == "credential"
    assert [f["key"] for f in portals["Avis"]["fields"]] == ["agent_id", "station_code"]


def test_supported_portals_is_catalog_driven_no_hardcoded_vrbo() -> None:
    # Die Portal-LISTE kommt live aus dem Channex-Katalog. Vrbo ist NICHT im
    # (Test-)Katalog → darf nicht als tote Karte erscheinen. Nur echte Codes.
    db = _ImportDB()
    codes = {p["code"] for p in _import_svc(_OAuthChannex(), db).list_supported_portals()}
    assert codes == {"AirBNB", "BookingCom", "Avis"}
    assert "VRBO" not in codes


def test_supported_portals_carries_setup_hint() -> None:
    # Bekannte OTAs bekommen die VERIFIZIERTE Vorab-Anleitung. Belegte Ausnahme:
    # der Booking-Extranet-Provider heißt real „Channex" und MUSS im Hint stehen
    # (sonst findet der Hotelier den Eintrag nicht) — freigegebene Ausnahme zur
    # „nie Channex im Kundentext"-Regel.
    db = _ImportDB()
    portals = {p["code"]: p for p in _import_svc(_OAuthChannex(), db).list_supported_portals()}
    assert portals["BookingCom"]["setup_hint"]
    assert "Channex" in portals["BookingCom"]["setup_hint"]
    assert "XML Service Agreement" in portals["BookingCom"]["setup_hint"]
    # Unbekannter Kanal (Avis) hat KEINEN erfundenen Hint.
    assert portals["Avis"]["setup_hint"] is None


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
            "local_property_id": "p1", "room_type_code": 11, "occupancy": 2,
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
    # Range-komprimiert: 23.–25. = EIN value, stop_sell gesetzt.
    assert len(channex.restrictions_pushed) == 1
    v = channex.restrictions_pushed[0]
    assert v["stop_sell"] is True
    assert v["date_from"] == "2099-06-23" and v["date_to"] == "2099-06-25"


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
    assert len(channex.restrictions_pushed) == 1  # 23.–24. = EIN Range-value
    v = channex.restrictions_pushed[0]
    assert v["rate"] == 15000
    assert v["date_from"] == "2099-06-23" and v["date_to"] == "2099-06-24"


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
# Hotel-Kategorie-Content-Sync entfernt (1 Objekt = 1 Einheit): ein Objekt mit
# mehreren Rate-Plänen wird über EINEN synthetischen Channex-Room-Type gepusht;
# das deckt der FeWo-Content-Sync-Test ab.


# --- Onboarding-Gate: Channex-Account fail-CLOSED ----------------------------
def test_ensure_channex_account_returns_group_id() -> None:
    # Erfolgsfall: Group wird angelegt, group_id zurückgegeben.
    db = _ImportDB()
    svc = _import_svc(_ImportChannex(), db)
    ctx = AuthContext(user_id="u", tenant_id="t1")
    assert svc.ensure_channex_account(ctx) == "cx-group"


def test_ensure_channex_account_fail_closed_when_not_configured() -> None:
    # Channex nicht konfiguriert → HARTER Fehler (503), NIE stilles Weitermachen.
    # So bleibt das Onboarding unvollständig statt fälschlich „completed".
    channex = _ImportChannex()
    channex.is_configured = False
    svc = _import_svc(channex, _ImportDB())
    ctx = AuthContext(user_id="u", tenant_id="t1")
    try:
        svc.ensure_channex_account(ctx)
        raise AssertionError("sollte fail-closed werfen")
    except ChannelManagerError as exc:
        assert exc.status_code == 503
