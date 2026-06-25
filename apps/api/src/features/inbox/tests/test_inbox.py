import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.inbox.service import InboxError, InboxService
from src.main import create_app

client = TestClient(create_app())


def test_inbox_health() -> None:
    resp = client.get("/api/v1/inbox/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "inbox", "status": "ok"}


# --- Service-Tests mit Fake-DB + Fake-Channex --------------------------------
class _Res:
    def __init__(self, data) -> None:  # noqa: ANN001
        self.data = data


class _FakeChannex:
    def __init__(self, messages=None) -> None:  # noqa: ANN001
        self._messages = messages or []
        self.sent: list[tuple[str, str]] = []

    def get_messages_for_booking(self, cbid):  # noqa: ANN001, ANN201
        return {"data": self._messages}

    def send_message_for_booking(self, cbid, message):  # noqa: ANN001, ANN201
        self.sent.append((cbid, message))
        return {"data": {"id": "m1", "attributes": {"message": message, "sender": "property"}}}


# Berechtigungssätze für die users-Mock-Row.
_PERMS_FULL = [
    "pm_chat", "inbox_view_all", "inbox_reply", "inbox_assign",
    "inbox_manage_config", "view_guest_name", "view_guest_contact",
    "view_booking_source", "pm_booking_total",
]
_PERMS_ASSIGNED_READONLY = ["pm_chat"]  # Zugriff, aber nur eigene + nur lesen


class _FakeDB:
    """Liefert channex_booking + reservations + users je nach Tabelle.

    `user_role`/`user_perms` steuern, was load_inbox_access/guest_mask sehen.
    """

    def __init__(
        self, bookings, reservations,
        *, user_role="admin", user_perms=None, updates=None,
    ) -> None:  # noqa: ANN001
        self._bookings = bookings
        self._reservations = reservations
        self._user_role = user_role
        self._user_perms = _PERMS_FULL if user_perms is None else user_perms
        # Sammelt update()-Patches je Tabelle (für Assertions).
        self.updates = updates if updates is not None else []

    def table(self, name):  # noqa: ANN001, ANN201
        if name == "users":
            rows = [{
                "id": "u", "full_name": "Tester", "email": "t@x.de",
                "role": self._user_role, "permissions": self._user_perms,
            }]
        elif name == "channex_booking":
            rows = self._bookings
        else:
            rows = self._reservations
        return _FakeQuery(name, rows, self.updates)


class _FakeQuery:
    def __init__(self, name, rows, updates) -> None:  # noqa: ANN001
        self._name = name
        self._rows = rows
        self._updates = updates
        self._eq: dict = {}
        self._in: tuple | None = None
        self._patch = None
        self._insert = None

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def update(self, patch):  # noqa: ANN001, ANN201
        self._patch = patch
        return self

    def insert(self, payload):  # noqa: ANN001, ANN201
        self._insert = payload
        return self

    def eq(self, col, val):  # noqa: ANN001, ANN201
        self._eq[col] = val
        return self

    def is_(self, col, _val):  # noqa: ANN001, ANN201
        # unassigned-Filter: assigned_user_id IS NULL
        self._eq[col] = None
        return self

    def in_(self, col, vals):  # noqa: ANN001, ANN201
        self._in = (col, vals)
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def lte(self, col, val):  # noqa: ANN001, ANN201
        self._eq.setdefault("__lte__", (col, val))
        return self

    def _filtered(self):  # noqa: ANN202
        rows = self._rows
        if self._in:
            col, vals = self._in
            rows = [r for r in rows if r.get(col) in vals]
        for col, val in self._eq.items():
            if col == "__lte__":
                continue
            rows = [r for r in rows if r.get(col) == val]
        return rows

    def execute(self):  # noqa: ANN201
        if self._patch is not None:
            affected = self._filtered()
            self._updates.append((self._name, self._patch, affected))
            return _Res(affected)
        if self._insert is not None:
            self._updates.append((self._name, "insert", self._insert))
            return _Res([{**self._insert, "id": "new"}])
        return _Res(self._filtered())


_CTX = AuthContext(user_id="u", tenant_id="t1", role="admin")
_CTX_OWNER = AuthContext(user_id="u", tenant_id="t1", role="owner")


def test_list_threads_links_reservation_id() -> None:
    bookings = [
        {
            "id": "th1",
            "tenant_id": "t1",
            "channex_booking_id": "cx-b1",
            "ota_name": "Booking.com",
            "ota_reservation_code": "ABC",
            "status": "new",
            "arrival_date": "2026-07-01",
            "departure_date": "2026-07-05",
            "customer": {"name": "Lucia", "surname": "Rodriguez", "mail": "l@x.de"},
            "updated_at": "2026-06-22T10:00:00Z",
            "is_archived": False,
            "inbox_status": "active",
            "is_read": True,
            "is_starred": False,
        }
    ]
    reservations = [
        {"id": "res-1", "tenant_id": "t1", "source_channex_booking_id": "cx-b1"}
    ]
    svc = InboxService(service_client=_FakeDB(bookings, reservations), channex=_FakeChannex())
    out = svc.list_threads(_CTX)
    assert out.total == 1
    th = out.items[0]
    assert th.reservation_id == "res-1"  # Verknüpfung Thread ↔ Reservierung
    assert th.guest_name == "Lucia Rodriguez"  # admin: voller Name
    assert th.guest_email == "l@x.de"
    assert th.channex_booking_id == "cx-b1"


def _booking_row() -> dict:
    return {
        "id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1",
        "ota_name": "Booking.com", "ota_reservation_code": "ABC", "status": "new",
        "arrival_date": "2026-07-01", "departure_date": "2026-07-05",
        "customer": {"name": "Lucia", "surname": "Rodriguez", "mail": "l@x.de"},
        "updated_at": "2026-06-22T10:00:00Z", "is_archived": False,
        "inbox_status": "active", "is_read": True, "is_starred": False,
    }


def test_list_threads_owner_sees_only_first_name() -> None:
    # owner mit Zugriff + view_all (sieht Thread), aber ohne Gast-Berechtigungen.
    db = _FakeDB(
        [_booking_row()], [], user_role="owner",
        user_perms=["pm_chat", "inbox_view_all"],
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    th = svc.list_threads(_CTX_OWNER).items[0]
    assert th.guest_name == "Lucia"   # nur Vorname (DSGVO-Daten-Split)
    assert th.guest_email is None     # keine Kontaktdaten
    assert th.ota_name is None        # keine Quelle (kein view_booking_source)


def test_list_threads_unknown_role_fails_closed() -> None:
    ctx = AuthContext(user_id="u", tenant_id="t1", role=None)
    db = _FakeDB(
        [_booking_row()], [], user_role="staff",
        user_perms=["pm_chat", "inbox_view_all"],
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    th = svc.list_threads(ctx).items[0]
    assert th.guest_name == "Lucia"
    assert th.guest_email is None


def test_get_messages_maps_sender(monkeypatch) -> None:  # noqa: ANN001
    # Channex-Pfad testen → Sandbox-Modus aus.
    monkeypatch.setattr(InboxService, "_sandbox_enabled", staticmethod(lambda: False))
    msgs = [
        {"id": "m1", "attributes": {"message": "Hallo", "sender": "guest", "inserted_at": "t"}},
        {"id": "m2", "attributes": {"message": "Hi", "sender": "host"}},
    ]
    bookings = [{"id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1"}]
    svc = InboxService(
        service_client=_FakeDB(bookings, []), channex=_FakeChannex(messages=msgs)
    )
    out = svc.get_messages(_CTX, "th1")
    assert [m.sender for m in out.items] == ["guest", "property"]  # host → property
    assert out.items[0].message == "Hallo"


def test_send_message_rejects_empty() -> None:
    bookings = [{"id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1"}]
    svc = InboxService(service_client=_FakeDB(bookings, []), channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.send_message(_CTX, "th1", "   ")
    assert exc.value.status_code == 422


def test_send_message_calls_channex(monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setattr(InboxService, "_sandbox_enabled", staticmethod(lambda: False))
    bookings = [{"id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1"}]
    fake = _FakeChannex()
    svc = InboxService(service_client=_FakeDB(bookings, []), channex=fake)
    msg = svc.send_message(_CTX, "th1", "Danke!")
    assert fake.sent == [("cx-b1", "Danke!")]
    assert msg.sender == "property" and msg.message == "Danke!"


def test_load_thread_404_when_foreign() -> None:
    svc = InboxService(service_client=_FakeDB([], []), channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.get_messages(_CTX, "does-not-exist")
    assert exc.value.status_code == 404


def test_bulk_update_rejects_unknown_action() -> None:
    svc = InboxService(service_client=_FakeDB([], []), channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.bulk_update(_CTX, "delete", "2026-06-01")
    assert exc.value.status_code == 422


def test_bulk_update_requires_date() -> None:
    svc = InboxService(service_client=_FakeDB([], []), channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.bulk_update(_CTX, "read", "")
    assert exc.value.status_code == 422


def test_add_note_rejects_empty() -> None:
    bookings = [{"id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1"}]
    svc = InboxService(service_client=_FakeDB(bookings, []), channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.add_note(_CTX, "th1", "   ")
    assert exc.value.status_code == 422


def test_schedule_rejects_empty_time() -> None:
    bookings = [{"id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1"}]
    svc = InboxService(service_client=_FakeDB(bookings, []), channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.schedule_message(_CTX, "th1", "Hallo", "")
    assert exc.value.status_code == 422


# --- Enterprise-Access-Modell: Scope / Actions / Zuweisung -------------------

def _thread(assigned_to=None):  # noqa: ANN001, ANN201
    return {
        "id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1",
        "customer": {"name": "Lucia", "surname": "R", "mail": "l@x.de"},
        "inbox_status": "active", "assigned_user_id": assigned_to,
    }


def test_access_no_pm_chat_has_no_access() -> None:
    # InboxAccess.can_access == False ohne pm_chat (Router würde 403 geben).
    db = _FakeDB([], [], user_role="staff", user_perms=[])
    access = InboxService(service_client=db, channex=_FakeChannex()).access(_CTX)
    assert access.can_access is False


def test_scope_assigned_only_filters_foreign_thread_to_404() -> None:
    # assigned-only-Nutzer: fremder (nicht zugewiesener) Thread → 404.
    db = _FakeDB(
        [_thread(assigned_to="someone-else")], [],
        user_role="staff", user_perms=["pm_chat"],  # kein inbox_view_all → assigned
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.get_messages(_CTX, "th1")
    assert exc.value.status_code == 404


def test_scope_assigned_only_sees_own_thread(monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setattr(InboxService, "_sandbox_enabled", staticmethod(lambda: False))
    db = _FakeDB(
        [_thread(assigned_to="u")], [],
        user_role="staff", user_perms=["pm_chat"],
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    out = svc.get_messages(_CTX, "th1")  # eigener Thread → kein 404
    assert out.total >= 0


def test_action_reply_denied_without_permission(monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setattr(InboxService, "_sandbox_enabled", staticmethod(lambda: False))
    db = _FakeDB(
        [_thread(assigned_to="u")], [],
        user_role="staff", user_perms=["pm_chat"],  # kein inbox_reply
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.send_message(_CTX, "th1", "Hallo")
    assert exc.value.status_code == 403


def test_action_reply_allowed_with_permission(monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setattr(InboxService, "_sandbox_enabled", staticmethod(lambda: False))
    db = _FakeDB(
        [_thread(assigned_to="u")], [],
        user_role="staff", user_perms=["pm_chat", "inbox_reply"],
    )
    fake = _FakeChannex()
    svc = InboxService(service_client=db, channex=fake)
    msg = svc.send_message(_CTX, "th1", "Danke!")
    assert fake.sent == [("cx-b1", "Danke!")]
    assert msg.sender == "property"


def test_action_assign_denied_without_permission() -> None:
    db = _FakeDB(
        [_thread()], [], user_role="staff",
        user_perms=["pm_chat", "inbox_view_all"],  # kein inbox_assign
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.assign_thread(_CTX, "th1", "u")
    assert exc.value.status_code == 403


def test_assign_to_user_without_inbox_access_rejected() -> None:
    # Ziel-Nutzer ohne pm_chat → 422 (kann den Thread nie öffnen).
    class _DB(_FakeDB):
        def table(self, name):  # noqa: ANN001, ANN201
            if name == "users":
                # eq("id", val) entscheidet, wessen Row geliefert wird.
                return _UsersQuery(self.updates)
            return super().table(name)

    db = _DB(
        [_thread()], [], user_role="admin", user_perms=_PERMS_FULL,
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.assign_thread(_CTX, "th1", "target-no-chat")
    assert exc.value.status_code == 422


class _UsersQuery:
    """users-Mock, der je nach abgefragter id Caller (voll) oder Ziel (kein chat) liefert."""

    def __init__(self, updates) -> None:  # noqa: ANN001
        self._updates = updates
        self._id = None

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def eq(self, col, val):  # noqa: ANN001, ANN201
        if col == "id":
            self._id = val
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        if self._id == "u":  # der anfragende Nutzer (Caller): voll
            return _Res([{"id": "u", "role": "admin", "permissions": _PERMS_FULL}])
        # Ziel-Nutzer: existiert, aber ohne pm_chat
        return _Res([{"id": self._id, "role": "staff", "permissions": []}])


def test_list_team_excludes_users_without_inbox_access() -> None:
    class _DB(_FakeDB):
        def table(self, name):  # noqa: ANN001, ANN201
            if name == "users":
                return _TeamQuery()
            return super().table(name)

    svc = InboxService(service_client=_DB([], []), channex=_FakeChannex())
    out = svc.list_team(_CTX)
    ids = [m.id for m in out.items]
    assert ids == ["with-chat"]  # nur der mit pm_chat bleibt


class _TeamQuery:
    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def eq(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        return _Res([
            {"id": "with-chat", "full_name": "A", "email": "a@x.de",
             "role": "staff", "permissions": ["pm_chat"]},
            {"id": "no-chat", "full_name": "B", "email": "b@x.de",
             "role": "cleaner", "permissions": []},
        ])


# --- Korrektur-Aktion: Thread → Gast zuordnen --------------------------------
class _StoreQuery:
    """Generische Store-Query (eq/insert/update/upsert) für guests-Tabellen."""

    def __init__(self, store, name, updates) -> None:  # noqa: ANN001
        self._all = store
        self._store = store.setdefault(name, [])
        self._name = name
        self._updates = updates
        self._eq: dict = {}
        self._op = "select"
        self._payload = None

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def insert(self, payload):  # noqa: ANN001, ANN201
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload):  # noqa: ANN001, ANN201
        self._op, self._payload = "update", payload
        return self

    def upsert(self, payload, **_k):  # noqa: ANN001, ANN002, ANN003, ANN201
        self._op, self._payload = "upsert", payload
        return self

    def eq(self, col, val):  # noqa: ANN001, ANN201
        self._eq[col] = val
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        if self._op == "insert":
            row = dict(self._payload)
            row.setdefault("id", f"{self._name}-{len(self._store) + 1}")
            self._store.append(row)
            return _Res([row])
        match = [r for r in self._store if all(r.get(k) == v for k, v in self._eq.items())]
        if self._op == "update":
            for r in match:
                r.update(self._payload)
            self._updates.append((self._name, self._payload, match))
            return _Res(match)
        if self._op == "upsert":
            keys = ("tenant_id", "channel", "external_id")
            ex = [r for r in self._store if all(r.get(k) == self._payload.get(k) for k in keys)]
            if ex:
                ex[0].update(self._payload)
                return _Res([ex[0]])
            row = dict(self._payload)
            row.setdefault("id", f"{self._name}-{len(self._store) + 1}")
            self._store.append(row)
            return _Res([row])
        return _Res(match)


class _LinkDB(_FakeDB):
    """channex_booking + users wie _FakeDB; guests/guest_external_ids als Store."""

    def __init__(self, bookings, guests, **kw) -> None:  # noqa: ANN001, ANN003
        super().__init__(bookings, [], **kw)
        self._store = {"guests": list(guests), "guest_external_ids": []}

    def table(self, name):  # noqa: ANN001, ANN201
        if name in ("guests", "guest_external_ids"):
            return _StoreQuery(self._store, name, self.updates)
        return super().table(name)


def test_link_thread_guest_existing() -> None:
    db = _LinkDB(
        [_thread()],
        [{"id": "g1", "tenant_id": "t1", "name": "Lucia"}],
        user_perms=_PERMS_FULL,
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    out = svc.link_thread_guest(_CTX, "th1", "g1")
    assert out == "g1"
    # channex_booking.guest_id gesetzt.
    patched = [u for u in db.updates if u[0] == "channex_booking"]
    assert patched and patched[-1][1] == {"guest_id": "g1"}


def test_link_thread_guest_foreign_rejected() -> None:
    # Gast eines anderen Tenants darf nicht verknüpft werden.
    db = _LinkDB(
        [_thread()],
        [{"id": "g-foreign", "tenant_id": "t2", "name": "Fremd"}],
        user_perms=_PERMS_FULL,
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.link_thread_guest(_CTX, "th1", "g-foreign")
    assert exc.value.status_code == 404


def test_link_thread_guest_from_thread_creates() -> None:
    # guest_id None → Resolver legt Gast aus customer-JSON an.
    db = _LinkDB([_thread()], [], user_perms=_PERMS_FULL)
    svc = InboxService(service_client=db, channex=_FakeChannex())
    out = svc.link_thread_guest(_CTX, "th1", None)
    assert out is not None
    g = next(r for r in db._store["guests"] if r["id"] == out)
    assert g["email"] == "l@x.de"


def test_link_thread_guest_requires_config_permission() -> None:
    # Ohne INBOX_MANAGE_CONFIG → 403.
    db = _LinkDB(
        [_thread()], [{"id": "g1", "tenant_id": "t1"}],
        user_role="owner", user_perms=["pm_chat", "inbox_view_all"],
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.link_thread_guest(_CTX_OWNER, "th1", "g1")
    assert exc.value.status_code == 403


# --- Automail: Zeitberechnung + Zuweisungs-Matching (reine Logik) ------------
from datetime import UTC, datetime  # noqa: E402


def test_compute_send_at_before_arrival_with_time() -> None:
    th = {"arrival_date": "2026-07-10", "departure_date": "2026-07-14"}
    # 3 Tage vor Anreise um 07:45.
    dt = InboxService._compute_send_at("arrival", -3, "07:45", th)
    assert dt == datetime(2026, 7, 7, 7, 45, tzinfo=UTC)


def test_compute_send_at_after_departure() -> None:
    th = {"arrival_date": "2026-07-10", "departure_date": "2026-07-14"}
    # 1 Tag nach Abreise um 19:30.
    dt = InboxService._compute_send_at("departure", 1, "19:30", th)
    assert dt == datetime(2026, 7, 15, 19, 30, tzinfo=UTC)


def test_compute_send_at_missing_anchor_is_none() -> None:
    # booking-Anker ohne created_at → keine Planung (kein erfundenes Datum).
    assert InboxService._compute_send_at("booking", 0, "12:00", {}) is None


def test_automation_matches_empty_means_all() -> None:
    a = {"property_ids": None, "channels": None}
    assert InboxService._automation_matches(a, "p-1", "Airbnb") is True


def test_automation_matches_house_and_channel_and_logic() -> None:
    a = {"property_ids": ["p-1", "p-2"], "channels": ["airbnb"]}
    # Haus passt UND Kanal passt (case-insensitive).
    assert InboxService._automation_matches(a, "p-1", "Airbnb") is True
    # Haus passt nicht.
    assert InboxService._automation_matches(a, "p-9", "Airbnb") is False
    # Kanal passt nicht (UND-Verknüpfung).
    assert InboxService._automation_matches(a, "p-1", "Booking.com") is False
