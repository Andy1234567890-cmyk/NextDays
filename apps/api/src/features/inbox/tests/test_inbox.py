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


class _FakeDB:
    """Liefert channex_booking + reservations je nach Tabelle."""

    def __init__(self, bookings, reservations) -> None:  # noqa: ANN001
        self._bookings = bookings
        self._reservations = reservations

    def table(self, name):  # noqa: ANN001, ANN201
        rows = self._bookings if name == "channex_booking" else self._reservations
        return _FakeQuery(name, rows)


class _FakeQuery:
    def __init__(self, name, rows) -> None:  # noqa: ANN001
        self._name = name
        self._rows = rows
        self._eq: dict = {}
        self._in: tuple | None = None

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def eq(self, col, val):  # noqa: ANN001, ANN201
        self._eq[col] = val
        return self

    def in_(self, col, vals):  # noqa: ANN001, ANN201
        self._in = (col, vals)
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        rows = self._rows
        if self._in:
            col, vals = self._in
            rows = [r for r in rows if r.get(col) in vals]
        for col, val in self._eq.items():
            rows = [r for r in rows if r.get(col) == val]
        return _Res(rows)


_CTX = AuthContext(user_id="u", tenant_id="t1")


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
    assert th.guest_name == "Lucia Rodriguez"
    assert th.channex_booking_id == "cx-b1"


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
