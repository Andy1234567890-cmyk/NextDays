from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.channel_manager.channex_client import ChannexError
from src.features.inbox.felder import FeldFehlt, Kontext, rendern, unbekannte_felder
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
    def __init__(
        self, messages=None,  # noqa: ANN001
        get_error: ChannexError | None = None,
        send_error: ChannexError | None = None,
        # Wie oft der Fehler kommt, bevor der Aufruf gelingt (1 = nur beim
        # ersten Mal → bildet die Selbstheilung ab).
        get_error_mal: int | None = None,
        send_error_mal: int | None = None,
        thread_id: str | None = None,
        thread_messages=None,  # noqa: ANN001
    ) -> None:
        self._messages = messages or []
        self._get_error = get_error
        self._send_error = send_error
        self._get_error_rest = get_error_mal
        self._send_error_rest = send_error_mal
        self._thread_id = thread_id
        self._thread_messages = thread_messages or []
        self.sent: list[tuple[str, str]] = []
        self.installs: list[tuple[str, str]] = []

    def install_application(self, *, channex_property_id, application_code):  # noqa: ANN001, ANN201
        self.installs.append((channex_property_id, application_code))
        return {"data": {"id": "inst-1"}}

    def get_booking(self, cbid):  # noqa: ANN001, ANN201
        if not self._thread_id:
            return {"data": {}}
        return {"data": {"relationships": {
            "message_thread": {"data": {"id": self._thread_id}}
        }}}

    def get_thread_messages(self, thread_id, **_k):  # noqa: ANN001, ANN003, ANN201
        return {"data": self._thread_messages}

    def send_thread_message(self, thread_id, message):  # noqa: ANN001, ANN201
        self.sent.append((thread_id, message))
        return {"data": {}}

    def get_messages_for_booking(self, cbid):  # noqa: ANN001, ANN201
        if self._get_error is not None and self._get_error_rest != 0:
            if self._get_error_rest is not None:
                self._get_error_rest -= 1
            raise self._get_error
        return {"data": self._messages}

    def send_message_for_booking(self, cbid, message):  # noqa: ANN001, ANN201
        if self._send_error is not None and self._send_error_rest != 0:
            if self._send_error_rest is not None:
                self._send_error_rest -= 1
            raise self._send_error
        self.sent.append((cbid, message))
        return {"data": {"id": "m1", "attributes": {"message": message, "sender": "property"}}}


# Berechtigungssätze für die users-Mock-Row. access_pm_features ist das PM-Dach:
# ohne es fallen alle pm_*/inbox_*-Rechte weg (effective_permissions). In der
# echten App kommt pm_chat nie ohne das Dach — die Fixtures bilden das ab.
_PERMS_FULL = [
    "access_pm_features",
    "pm_chat", "inbox_view_all", "inbox_reply", "inbox_assign",
    "inbox_manage_config", "view_guest_name", "view_guest_contact",
    "view_booking_source", "pm_booking_total",
]
_PERMS_ASSIGNED_READONLY = ["access_pm_features", "pm_chat"]  # Zugriff, nur eigene + lesen


class _FakeDB:
    """Liefert channex_booking + reservations + users je nach Tabelle.

    `user_role`/`user_perms` steuern, was load_inbox_access/guest_mask sehen.
    """

    def __init__(
        self, bookings, reservations,
        *, user_role="admin", user_perms=None, updates=None, nachrichten=None,
    ) -> None:  # noqa: ANN001
        self._bookings = bookings
        self._reservations = reservations
        self._user_role = user_role
        self._user_perms = _PERMS_FULL if user_perms is None else user_perms
        # Der lokale Nachrichten-Spiegel (portal_messages) — speist Vorschau,
        # Absender und „letzte Aktivität" der Liste.
        self._nachrichten = nachrichten or []
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
        elif name == "portal_messages":
            rows = self._nachrichten
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
        self._sort: list = []

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

    def order(self, col=None, *, desc=False, **_k):  # noqa: ANN001, ANN003, ANN201
        # Echt sortieren statt durchreichen: `_last_messages` verlässt sich
        # darauf, dass der ERSTE Treffer je Thread der jüngste ist. Ein
        # no-op-`order` täuschte das nur vor.
        if col:
            self._sort.append((col, desc))
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
        for col, desc in reversed(self._sort):
            rows = sorted(rows, key=lambda r, c=col: (r.get(c) is None, r.get(c) or ""),
                          reverse=desc)
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
        user_perms=["access_pm_features", "pm_chat", "inbox_view_all"],
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
        user_perms=["access_pm_features", "pm_chat", "inbox_view_all"],
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    th = svc.list_threads(ctx).items[0]
    assert th.guest_name == "Lucia"
    assert th.guest_email is None


def test_get_messages_maps_sender(monkeypatch) -> None:  # noqa: ANN001
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
    bookings = [{"id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1"}]
    fake = _FakeChannex()
    svc = InboxService(service_client=_FakeDB(bookings, []), channex=fake)
    msg = svc.send_message(_CTX, "th1", "Danke!")
    assert fake.sent == [("cx-b1", "Danke!")]
    assert msg.sender == "property" and msg.message == "Danke!"


def test_get_messages_invalid_booking_id_falls_back_to_notes(monkeypatch) -> None:  # noqa: ANN001
    bookings = [{"id": "th1", "tenant_id": "t1", "channex_booking_id": "sandbox-invalid"}]
    err = ChannexError(
        "Bad Request",
        status_code=422,
        channex_status=422,
        payload={"code": "bad_request", "details": {"booking_id": ["is invalid"]}},
    )
    svc = InboxService(service_client=_FakeDB(bookings, []), channex=_FakeChannex(get_error=err))
    out = svc.get_messages(_CTX, "th1")
    assert out.total == 0


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
        # ohne inbox_view_all → der Nutzer sieht nur Zugewiesenes
        user_role="staff", user_perms=["access_pm_features", "pm_chat"],
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.get_messages(_CTX, "th1")
    assert exc.value.status_code == 404


def test_scope_assigned_only_sees_own_thread(monkeypatch) -> None:  # noqa: ANN001
    db = _FakeDB(
        [_thread(assigned_to="u")], [],
        user_role="staff", user_perms=["access_pm_features", "pm_chat"],
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    out = svc.get_messages(_CTX, "th1")  # eigener Thread → kein 404
    assert out.total >= 0


def test_action_reply_denied_without_permission(monkeypatch) -> None:  # noqa: ANN001
    db = _FakeDB(
        [_thread(assigned_to="u")], [],
        user_role="staff", user_perms=["access_pm_features", "pm_chat"],  # kein inbox_reply
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.send_message(_CTX, "th1", "Hallo")
    assert exc.value.status_code == 403


def test_action_reply_allowed_with_permission(monkeypatch) -> None:  # noqa: ANN001
    db = _FakeDB(
        [_thread(assigned_to="u")], [],
        user_role="staff", user_perms=["access_pm_features", "pm_chat", "inbox_reply"],
    )
    fake = _FakeChannex()
    svc = InboxService(service_client=db, channex=fake)
    msg = svc.send_message(_CTX, "th1", "Danke!")
    assert fake.sent == [("cx-b1", "Danke!")]
    assert msg.sender == "property"


def test_action_assign_denied_without_permission() -> None:
    db = _FakeDB(
        [_thread()], [], user_role="staff",
        user_perms=["access_pm_features", "pm_chat", "inbox_view_all"],  # kein inbox_assign
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
             "role": "staff", "permissions": ["access_pm_features", "pm_chat"]},
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
        self._ilike: dict = {}
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

    def ilike(self, col, val):  # noqa: ANN001, ANN201
        self._ilike[col] = val.replace("\\", "")
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        if self._op == "insert":
            row = dict(self._payload)
            row.setdefault("id", f"{self._name}-{len(self._store) + 1}")
            self._store.append(row)
            return _Res([row])
        match = [
            r
            for r in self._store
            if all(r.get(k) == v for k, v in self._eq.items())
            and all(
                str(r.get(k) or "").casefold() == str(v).casefold()
                for k, v in self._ilike.items()
            )
        ]
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
        user_role="owner", user_perms=["access_pm_features", "pm_chat", "inbox_view_all"],
    )
    svc = InboxService(service_client=db, channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.link_thread_guest(_CTX_OWNER, "th1", "g1")
    assert exc.value.status_code == 403


# --- Automail: Zeitberechnung + Zuweisungs-Matching (reine Logik) ------------
from datetime import UTC  # noqa: E402


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


def test_compute_send_at_stunden_vor_anreise() -> None:
    """Stunden rechnen vom Bezugszeitpunkt, nicht vom Kalendertag.

    An-/Abreise sind beim Portal reine DATEN (`arrival_date` ist eine
    `date`-Spalte, live geprüft). Bezug ist deshalb die eingestellte Uhrzeit —
    hier 16:00 Check-in, minus 2 Stunden.
    """
    th = {"arrival_date": "2026-07-10", "departure_date": "2026-07-14"}
    dt = InboxService._compute_send_at(
        "arrival", 0, "16:00", th, offset_unit="hours", offset_value=-2
    )
    assert dt == datetime(2026, 7, 10, 14, 0, tzinfo=UTC)


def test_compute_send_at_minuten_nach_abreise() -> None:
    """Minuten dürfen über die Tagesgrenze laufen."""
    th = {"arrival_date": "2026-07-10", "departure_date": "2026-07-14"}
    dt = InboxService._compute_send_at(
        "departure", 0, "23:30", th, offset_unit="minutes", offset_value=45
    )
    assert dt == datetime(2026, 7, 15, 0, 15, tzinfo=UTC)


def test_compute_send_at_ohne_uhrzeit_ist_mitternacht() -> None:
    """Keine feste Uhrzeit → Mitternacht des Ankertags, kein geratener Wert."""
    th = {"arrival_date": "2026-07-10"}
    dt = InboxService._compute_send_at(
        "arrival", 0, None, th, offset_unit="days", offset_value=-1
    )
    assert dt == datetime(2026, 7, 9, 0, 0, tzinfo=UTC)


def test_compute_send_at_stunden_nutzen_buchungsuhrzeit() -> None:
    """Nur die Buchung trägt einen echten Zeitpunkt — der zählt dann auch.

    `created_at` ist ein Zeitstempel; „3 Stunden nach Buchung" muss von der
    tatsächlichen Buchungsminute rechnen, nicht von Mitternacht.
    """
    th = {"created_at": "2026-07-10T14:20:00+00:00"}
    dt = InboxService._compute_send_at(
        "booking", 0, None, th, offset_unit="hours", offset_value=3
    )
    assert dt == datetime(2026, 7, 10, 17, 20, tzinfo=UTC)


def test_compute_send_at_altbestand_rechnet_unveraendert() -> None:
    """Ohne offset_value gilt offset_days — der Bestand darf nicht verrutschen."""
    th = {"arrival_date": "2026-07-10"}
    dt = InboxService._compute_send_at("arrival", -3, "07:45", th)
    assert dt == datetime(2026, 7, 7, 7, 45, tzinfo=UTC)


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


# --- Platzhalter (felder.py) --------------------------------------------------
def test_platzhalter_ersetzt_bekannte_felder() -> None:
    k = Kontext(guest_name="Anna Meier", check_in="2026-08-14", property_name="Haus 1")
    out = rendern(
        "Hallo {{guest_first_name}}, {{property_name}} erwartet Sie am {{check_in}}.", k
    )
    assert out == "Hallo Anna, Haus 1 erwartet Sie am 14.08.2026."


def test_platzhalter_ohne_wert_bricht_ab_statt_luecke_zu_senden() -> None:
    # „Hallo ," ist kein akzeptabler Ersatz — der Versand muss scheitern (Wurzel 4).
    with pytest.raises(FeldFehlt) as exc:
        rendern("Hallo {{guest_name}}, Code {{door_code}}", Kontext())
    assert set(exc.value.felder) == {"guest_name", "door_code"}


def test_platzhalter_null_kinder_ist_ein_wert_kein_fehler() -> None:
    assert rendern("{{children}} Kinder", Kontext(children=0)) == "0 Kinder"


def test_platzhalter_unbekanntes_feld_bleibt_stehen_statt_zu_werfen() -> None:
    # Beim Speichern längst abgewiesen; ein von Hand getipptes {{...}} darf den
    # Versand trotzdem nicht kippen.
    assert rendern("Preis {{foo}}", Kontext()) == "Preis {{foo}}"


def test_unbekannte_felder_findet_tippfehler() -> None:
    assert unbekannte_felder("{{guest_nmae}} und {{guest_name}}") == ["guest_nmae"]


def test_betrag_ohne_waehrungszeichen() -> None:
    # Kein hartkodiertes € (Wurzel 4) — die Währung ist ein eigenes Feld.
    out = rendern("{{total_amount}} {{currency}}", Kontext(total_amount=1132, currency="DKK"))
    assert out == "1132,00 DKK"


# --- Sendezeit in der Zeitzone des Objekts ------------------------------------
def test_sendezeit_nutzt_objekt_zeitzone() -> None:
    thread = {"arrival_date": "2026-08-14"}
    utc = InboxService._compute_send_at("arrival", 0, "10:00", thread)
    athen = InboxService._compute_send_at(
        "arrival", 0, "10:00", thread, timezone_name="Europe/Athens"
    )
    # 10:00 in Athen (UTC+3 im August) ist 07:00 UTC — ohne Zone wären es 10:00 UTC.
    assert utc.isoformat() == "2026-08-14T10:00:00+00:00"
    assert athen.isoformat() == "2026-08-14T07:00:00+00:00"


def test_unbekannte_zeitzone_faellt_klar_durch_statt_auf_utc() -> None:
    with pytest.raises(InboxError):
        InboxService._compute_send_at(
            "arrival", 0, "10:00", {"arrival_date": "2026-08-14"},
            timezone_name="Europe/Kopenhagen",
        )


# --- Zeitfenster der Abwesenheitsantwort --------------------------------------
def _zeitpunkt(tag: str, uhr: str) -> datetime:
    return datetime.fromisoformat(f"{tag}T{uhr}:00+00:00")


def test_zeitfenster_ohne_angabe_immer_offen() -> None:
    assert InboxService._im_zeitfenster({}, _zeitpunkt("2026-08-05", "03:00")) is True


def test_zeitfenster_ueber_mitternacht() -> None:
    # 22:00–06:00 ist die Vereinigung beider Teilstücke, nicht ihr leerer Schnitt.
    a = {"window_from": "22:00", "window_to": "06:00"}
    assert InboxService._im_zeitfenster(a, _zeitpunkt("2026-08-05", "23:30")) is True
    assert InboxService._im_zeitfenster(a, _zeitpunkt("2026-08-05", "02:00")) is True
    assert InboxService._im_zeitfenster(a, _zeitpunkt("2026-08-05", "12:00")) is False


def test_zeitfenster_am_tag() -> None:
    a = {"window_from": "09:00", "window_to": "17:00"}
    assert InboxService._im_zeitfenster(a, _zeitpunkt("2026-08-05", "12:00")) is True
    assert InboxService._im_zeitfenster(a, _zeitpunkt("2026-08-05", "18:00")) is False


def test_zeitfenster_wochentage() -> None:
    # 2026-08-05 ist ein Mittwoch (weekday 2).
    nur_wochenende = {"window_days": [5, 6]}
    assert InboxService._im_zeitfenster(nur_wochenende, _zeitpunkt("2026-08-05", "12:00")) is False
    assert InboxService._im_zeitfenster(nur_wochenende, _zeitpunkt("2026-08-08", "12:00")) is True


# --- Anhänge: Typerkennung über Magic-Bytes ------------------------------------
def test_anhang_typ_aus_magic_bytes_nicht_aus_content_type() -> None:
    assert InboxService._dateityp(b"%PDF-1.7 ...") == ("pdf", "application/pdf")
    assert InboxService._dateityp(b"\x89PNG\r\n\x1a\n rest") == ("png", "image/png")
    # Als Bild deklariertes HTML bleibt HTML → abgelehnt.
    assert InboxService._dateityp(b"<html><script>alert(1)</script>") is None


def test_anhang_dateiname_ohne_pfadanteile() -> None:
    assert InboxService._dateiname_saeubern("../../etc/passwd", "pdf") == "passwd.pdf"
    assert InboxService._dateiname_saeubern("Haus\nordnung.pdf", "pdf") == "Haus_ordnung.pdf"


# --- Buchungs-Ereignisse: jede Angabe stammt von der Gegenseite ----------------
def test_buchungsereignis_nimmt_ota_zeit_nicht_unsere_importzeit() -> None:
    row = {
        "id": "th1", "ota_name": "BookingCom", "ota_reservation_code": "4711",
        "arrival_date": "2026-08-10", "departure_date": "2026-08-11",
        "status": "new",
        # Unsere Uhr: der Feed-Nachlauf lief erst Wochen später.
        "created_at": "2026-08-01T11:47:17.365761+00:00",
        "ota_inserted_at": "2026-05-11T21:08:40Z",
        "raw": {
            "inserted_at": "2026-05-11T21:08:40.123456",
            # Booking.com reicht die Originalmeldung durch (JSON-Text).
            "raw_message": '{"id":"6887445125","date":"2026-05-11","time":"23:08:36"}',
        },
    }
    ereignis = InboxService(service_client=None, channex=None)._booking_events(row)[0]
    assert ereignis.sent_at == "2026-05-11T21:08:40Z"   # nicht created_at
    assert ereignis.event_channel == "BookingCom"
    fakten = {f.label: f.value for f in ereignis.event_facts}
    assert fakten["reservationCode"] == "4711"
    assert fakten["bookedAtOta"] == "2026-05-11 23:08:36"
    assert "importedAt" not in fakten


def test_buchungsereignis_ohne_ota_zeit_weist_importzeit_aus() -> None:
    row = {
        "id": "th1", "ota_name": "Booking.com", "status": "new",
        "created_at": "2026-06-22T10:00:00Z",
    }
    ereignis = InboxService(service_client=None, channex=None)._booking_events(row)[0]
    assert ereignis.sent_at == "2026-06-22T10:00:00Z"
    # Kein stiller Ersatz: dass es die IMPORT-Zeit ist, steht sichtbar dabei.
    assert {f.label for f in ereignis.event_facts} == {"importedAt"}


def test_statuswechsel_nimmt_zeit_der_revision() -> None:
    row = {
        "id": "th1", "ota_name": "BookingCom", "status": "cancelled",
        "created_at": "2026-05-11T21:08:40Z",
        "ota_inserted_at": "2026-05-11T21:08:40Z",
        "updated_at": "2026-08-01T11:47:17Z",          # unsere Schreibzeit
        "raw": {"inserted_at": "2026-07-30T09:15:00"},  # Eingang der Storno-Revision
    }
    ereignisse = InboxService(service_client=None, channex=None)._booking_events(row)
    storno = [e for e in ereignisse if e.event_title == "statusChanged"][0]
    assert storno.sent_at == "2026-07-30T09:15:00Z"
    assert storno.event_detail == "cancelled"


def test_ota_zeiten_kennen_arrival_hour() -> None:
    # Channex nennt die erwartete Ankunft `arrival_hour` — beide Leser (Detail-
    # spalte und Platzhalter der Automationen) müssen sie finden.
    assert InboxService._ota_zeiten({"arrival_hour": "16:00"}) == ("16:00", None)
    assert InboxService._ota_zeiten({"occupancy": {"checkin_time": "15:00"}}) == (
        "15:00", None,
    )


def test_fehlende_chat_app_wird_beim_lesen_selbst_geheilt(monkeypatch) -> None:  # noqa: ANN001
    # Verbundenes Objekt = Chat geht. Fehlt die Anwendung trotzdem (Objekt von
    # vor der Automatik), zieht der Server sie nach und liest erneut — der
    # Benutzer bekommt den Verlauf, nicht eine Aufforderung.
    bookings = [{
        "id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1",
        "ota_name": "BookingCom", "status": "new",
        "created_at": "2026-06-22T10:00:00Z",
        "raw": {"property_id": "cx-prop-1"},
    }]
    err = ChannexError(
        "Forbidden", status_code=403, channex_status=403,
        payload={"errors": {"code": "forbidden", "title": "Forbidden"}},
    )
    channex = _FakeChannex(
        messages=[{"id": "m1", "attributes": {"message": "Hallo", "sender": "guest"}}],
        get_error=err, get_error_mal=1,
    )
    svc = InboxService(service_client=_FakeDB(bookings, []), channex=channex)
    out = svc.get_messages(_CTX, "th1")
    assert channex.installs == [("cx-prop-1", "channex_messages")]
    assert out.unavailable is None
    assert [m.message for m in out.items if m.sender == "guest"] == ["Hallo"]


def test_senden_heilt_die_fehlende_chat_app_ebenfalls(monkeypatch) -> None:  # noqa: ANN001
    # Sonst wäre der Chat lesbar (Lesen heilt sich), aber nicht beantwortbar.
    bookings = [{
        "id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1",
        "raw": {"property_id": "cx-prop-1"},
    }]
    err = ChannexError("Forbidden", status_code=403, channex_status=403, payload={})
    channex = _FakeChannex(send_error=err, send_error_mal=1)
    svc = InboxService(service_client=_FakeDB(bookings, []), channex=channex)
    msg = svc.send_message(_CTX, "th1", "Danke!")
    assert channex.installs == [("cx-prop-1", "channex_messages")]
    assert channex.sent == [("cx-b1", "Danke!")]
    assert msg.sender == "property"


def test_verlauf_ueber_den_thread_wenn_der_buchungspfad_nichts_hergibt(monkeypatch) -> None:  # noqa: ANN001
    # Die Buchung verweist über relationships.message_thread auf ihren Thread —
    # der zweite, belegte Weg zum Verlauf (u. a. Airbnb-Anfragen).
    bookings = [{"id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1"}]
    err = ChannexError("Not found", status_code=404, channex_status=404, payload={})
    channex = _FakeChannex(
        get_error=err,
        thread_id="thr-9",
        thread_messages=[{"id": "m9", "attributes": {"message": "Vom Thread", "sender": "guest"}}],
    )
    svc = InboxService(service_client=_FakeDB(bookings, []), channex=channex)
    out = svc.get_messages(_CTX, "th1")
    assert [m.message for m in out.items if m.sender == "guest"] == ["Vom Thread"]


def test_kanal_ohne_chat_bricht_die_ansicht_nicht(monkeypatch) -> None:  # noqa: ANN001
    # Staging-Realität: Testbuchungen laufen über einen Kanal, den die
    # Nachrichten-API nicht unterstützt (422 not_supported). Der Verlauf muss
    # trotzdem stehen — mit Grund statt Fehlerseite.
    bookings = [{
        "id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1",
        "ota_name": "BookingCom", "status": "new", "created_at": "2026-06-22T10:00:00Z",
    }]
    err = ChannexError(
        "Method not supported", status_code=422, channex_status=422,
        payload={"errors": {"code": "not_supported", "title": "Method not supported"}},
    )
    svc = InboxService(service_client=_FakeDB(bookings, []), channex=_FakeChannex(get_error=err))
    out = svc.get_messages(_CTX, "th1")
    assert out.unavailable == "channel_no_chat"
    assert [m.event_title for m in out.items] == ["bookingReceived"]


def test_letzte_aktivitaet_ist_der_portal_zeitpunkt() -> None:
    """Die Listenzeit kommt vom Portal, nie von unserer Schreibzeit.

    DER VORFALL (06.08.2026): Der Feed holte 22 Airbnb-Buchungen in einem
    Rutsch; alle trugen dieselbe `updated_at`-Sekunde. Die Liste zeigte damit
    Buchungen aus März, Juni und Juli einheitlich als „vor 24 m" und sortierte
    sie zufällig. Der Fehler saß nicht in der Formatierung, sondern darin, dass
    die Anzeige überhaupt ein Feld las, das UNSERE Verarbeitung beschreibt.
    """
    row = _booking_row()
    row["booked_at"] = "2026-03-23T15:24:55Z"
    row["updated_at"] = "2026-08-06T08:48:59Z"  # unsere Schreibzeit
    svc = InboxService(service_client=_FakeDB([row], []), channex=_FakeChannex())
    th = svc.list_threads(_CTX).items[0]
    assert th.letzte_aktivitaet == "2026-03-23T15:24:55Z"


def test_ohne_portal_zeitpunkt_bleibt_die_listenzeit_leer() -> None:
    """Kein Rückfall auf `updated_at` — lieber keine Zeit als eine falsche.

    Genau dieser Rückfall erzeugte den Vorfall. Ein leeres Feld lässt die
    Oberfläche die Zeitangabe weglassen; ein plausibler Ersatzwert behauptet
    eine Handlung des Gastes, die es nie gab (Wurzel 4/5b).
    """
    row = _booking_row()
    row["booked_at"] = None
    row["updated_at"] = "2026-08-06T08:48:59Z"
    svc = InboxService(service_client=_FakeDB([row], []), channex=_FakeChannex())
    th = svc.list_threads(_CTX).items[0]
    assert th.letzte_aktivitaet is None


def test_nachricht_schlaegt_den_buchungszeitpunkt() -> None:
    """„Letzte Aktivität" ist die letzte HANDLUNG, nicht die Buchung.

    DER VORFALL (07.08.2026): Dietmar Sperle schrieb am 06.08.; im Posteingang
    stand er auf Platz 5 mit „10. Juli" — seinem Buchungsdatum. Über ihm drei
    Threads, in denen seit Wochen nichts passiert war. Die Spalte hieß „letzte
    Aktivität" und zeigte etwas anderes.
    """
    row = _booking_row()
    row["booked_at"] = "2026-07-10T11:15:29+00:00"
    nachrichten = [{
        "tenant_id": "t1", "thread_ref": row["id"], "sender": "property",
        "body": "Liebe(r) Dietmar", "sent_at": "2026-08-06T14:55:55+00:00",
    }]
    svc = InboxService(
        service_client=_FakeDB([row], [], nachrichten=nachrichten),
        channex=_FakeChannex(),
    )
    th = svc.list_threads(_CTX).items[0]
    assert th.letzte_aktivitaet == "2026-08-06T14:55:55+00:00"


def test_liste_sortiert_nach_letzter_aktivitaet() -> None:
    """Der Thread mit der jüngsten Nachricht steht oben — nicht der jüngst gebuchte.

    Die Datenbank kann das nicht sortieren: der Zeitpunkt steckt in
    `portal_messages`. Ohne die Nachsortierung im Dienst blieb die Reihenfolge
    die der Buchungen, egal was der Frontend-Filter anbot.
    """
    alt = {**_booking_row(), "id": "th-alt", "booked_at": "2026-07-10T11:15:29+00:00"}
    neu = {**_booking_row(), "id": "th-neu", "booked_at": "2026-07-22T17:44:06+00:00"}
    nachrichten = [{
        "tenant_id": "t1", "thread_ref": "th-alt", "sender": "guest",
        "body": "Neue Frage", "sent_at": "2026-08-06T14:55:55+00:00",
    }]
    svc = InboxService(
        service_client=_FakeDB([neu, alt], [], nachrichten=nachrichten),
        channex=_FakeChannex(),
    )
    assert [t.id for t in svc.list_threads(_CTX).items] == ["th-alt", "th-neu"]


def test_gemischte_zonenschreibweisen_sortieren_richtig() -> None:
    """„Z" und „+00:00" meinen dasselbe — ein Zeichenvergleich nicht.

    Im Zeichenvergleich ist „Z" > „+", also gewann die `Z`-Form immer, egal
    welche Sekunde sie trug. Hier ist die `+00:00`-Nachricht die jüngere und
    muss gewinnen.
    """
    row = _booking_row()
    row["booked_at"] = "2026-08-06T20:00:00Z"
    nachrichten = [{
        "tenant_id": "t1", "thread_ref": row["id"], "sender": "guest",
        "body": "später", "sent_at": "2026-08-06T21:00:00+00:00",
    }]
    svc = InboxService(
        service_client=_FakeDB([row], [], nachrichten=nachrichten),
        channex=_FakeChannex(),
    )
    assert svc.list_threads(_CTX).items[0].letzte_aktivitaet == "2026-08-06T21:00:00+00:00"


def test_ohne_nachricht_bleibt_es_der_buchungszeitpunkt() -> None:
    """Kein Spiegel-Eintrag → die Buchung ist die letzte bekannte Handlung."""
    row = _booking_row()
    row["booked_at"] = "2026-03-23T15:24:55Z"
    svc = InboxService(service_client=_FakeDB([row], []), channex=_FakeChannex())
    assert svc.list_threads(_CTX).items[0].letzte_aktivitaet == "2026-03-23T15:24:55Z"


def test_nachrichtenzeit_traegt_immer_eine_zone() -> None:
    """Channex' Zeitstempel kommen OHNE Zone, meinen aber UTC.

    Roh durchgereicht deutet der Browser „2026-08-06T07:19:55.000000" als
    ORTSZEIT und rechnet zwei Stunden ab (CEST). Für die reine Anzeige fiel das
    kaum auf; beim Lesestand-Vergleich (0297) hätte es das Häkchen an
    Nachrichten gesetzt, die der Gast nie gesehen hat — die Zeiten wären
    scheinbar VOR seinem Lesestand gelegen.
    """
    m = InboxService.zu_nachricht(
        {"id": "m1", "attributes": {"message": "x", "sender": "property",
                                    "inserted_at": "2026-08-06T07:19:55.000000"}}
    )
    assert m.sent_at == "2026-08-06T07:19:55.000000Z"


def test_vorhandene_zone_bleibt_unveraendert() -> None:
    """Ein Wert, der schon eine Zone trägt, wird nicht ein zweites Mal ergänzt."""
    m = InboxService.zu_nachricht(
        {"id": "m1", "attributes": {"message": "x", "sender": "guest",
                                    "inserted_at": "2026-08-06T07:19:55+02:00"}}
    )
    assert m.sent_at == "2026-08-06T07:19:55+02:00"


def test_lodgify_platzhalter_wird_uebersetzt() -> None:
    """Aus Lodgify übernommene Vorlagen nutzen `{{WifiInformation}}`.

    DER VORFALL (06.08.2026): Das Muster erfasste nur Kleinbuchstaben — der Name
    galt gar nicht als Platzhalter. Kein 422 beim Speichern, keine Meldung beim
    Senden; der Gast hätte wörtlich „{{WifiInformation}}" gelesen. Was wir nicht
    erkennen, können wir auch nicht beanstanden.
    """
    from src.features.inbox.felder import Kontext, rendern, unbekannte_felder

    text = "Internet: {{WifiInformation}}"
    assert unbekannte_felder(text) == []
    k = Kontext(wifi_ssid="AirSmil-Gast", wifi_password="sommer2026")
    assert rendern(text, k) == "Internet: AirSmil-Gast / sommer2026"


def test_wlan_ohne_passwort_nennt_nur_das_netz() -> None:
    """Nur das, was da ist — kein „Netz / None"."""
    from src.features.inbox.felder import Kontext, rendern

    assert rendern("{{wifi}}", Kontext(wifi_ssid="Nur-Netz")) == "Nur-Netz"


def test_echter_tippfehler_bleibt_ein_fehler() -> None:
    """Die Alt-Namen-Tabelle darf kein Freibrief für alles Unbekannte sein."""
    from src.features.inbox.felder import unbekannte_felder

    assert unbekannte_felder("{{QuatschFeld}}") == ["QuatschFeld"]


def test_ohne_wlan_wird_nicht_gesendet() -> None:
    """Ist nichts gepflegt, schlägt der Versand fehl statt „Internet: " zu senden."""
    import pytest as _pytest

    from src.features.inbox.felder import FeldFehlt, Kontext, rendern

    with _pytest.raises(FeldFehlt):
        rendern("Internet: {{WifiInformation}}", Kontext())


def test_richtext_wird_klartext_mit_gliederung() -> None:
    """Die Objekt-Texte kommen als HTML aus dem Editor, der Chat kann nur Text.

    Reines Tag-Strippen ergäbe eine Wand: eine zwölfpunktige Hausordnung
    verklebte zu einem Absatz. Die GLIEDERUNG ist hier die Information.
    """
    from src.features.inbox.felder import html_zu_text

    roh = (
        "<p><strong>Hausregeln</strong></p><ul>"
        "<li><p>Nicht rauchen</p></li><li><p>Ruhe ab 22&nbsp;Uhr</p></li></ul>"
    )
    assert html_zu_text(roh) == "Hausregeln\n\n- Nicht rauchen\n\n- Ruhe ab 22 Uhr"


def test_entitaeten_werden_aufgeloest() -> None:
    """„&amp;" im Text ist ein „&" — sonst liest der Gast das Markup mit."""
    from src.features.inbox.felder import html_zu_text

    assert html_zu_text("<p>Spülmaschine &amp; Geschirr</p>") == (
        "Spülmaschine & Geschirr"
    )


def test_gastsprache_gewinnt_sonst_fallback() -> None:
    """Gepflegt wird mehrsprachig — gesendet wird die Sprache des GASTES.

    Fehlt sie, lieber Englisch/Deutsch als gar nichts: ein dänischer Gast liest
    den deutschen Text lieber als „{{RentalRules}}" im Klartext.
    """
    prop = {
        "type_attributes": {
            "messaging": {
                "rules": {"de": "<p>Deutsche Regeln</p>", "en": "<p>Rules</p>",
                          "da": "<p>Danske regler</p>"},
                "wifi": {"de": "<p>Nur Deutsch</p>", "en": "", "da": ""},
            }
        }
    }
    da = InboxService._messaging_texte(prop, "da")
    assert da["house_rules"] == "Danske regler"
    # Nur Deutsch gepflegt → Fallback statt leer.
    assert da["wifi_text"] == "Nur Deutsch"
    assert InboxService._messaging_texte(prop, "fr")["house_rules"] == "Rules"


def test_ohne_gepflegten_text_bleibt_das_feld_leer() -> None:
    """Kein Text → kein Eintrag; der Versand meldet dann „Feld ohne Wert"."""
    assert InboxService._messaging_texte({"type_attributes": {}}, "de") == {}
    assert InboxService._messaging_texte(None, "de") == {}
