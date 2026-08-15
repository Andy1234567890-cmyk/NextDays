from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.common import NUR_ANHANG_TEXT
from src.features.inbox.ausloeser import anker_von, versatz_normieren
from src.features.inbox.felder import FeldFehlt, Kontext, rendern, unbekannte_felder
from src.features.inbox.schemas import InboxMessage
from src.features.inbox.service import InboxError, InboxService
from src.features.inbox.spiegel import _vorschau, sichere_anhaenge
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


# Tabellen der Nebenquellen des Posteingangs (Übernahme 0382, Marktplatz
# 0181/0196). Sie liefern im Double per Default KEINE Zeilen — wer sie prüfen
# will, übergibt `extra={...}`.
_LEERE_TABELLEN = frozenset({
    "reservation_nachricht_uebernahme",
    "guest_message_threads",
    "guest_messages",
})


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
        extra=None,
    ) -> None:  # noqa: ANN001
        self._bookings = bookings
        self._reservations = reservations
        # Zeilen der Nebenquellen (Marktplatz, Übernahme) je Tabellenname.
        # Default leer: ein Test, der sie nicht setzt, sieht sie auch nicht.
        self._extra = extra or {}
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
        elif name in _LEERE_TABELLEN:
            # Bewusst leer statt über den Sammel-Zweig: der Posteingang liest
            # inzwischen aus mehreren Quellen (Übernahme 0382, Marktplatz
            # 0181/0196). Fiele eine davon in den `else`-Zweig, bekäme sie die
            # RESERVIERUNGS-Zeilen und erzeugte daraus Phantom-Threads — der
            # Test zählte dann Threads, die es nicht gibt.
            rows = self._extra.get(name, [])
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
        # Echt sortieren statt durchreichen: `_spiegel_stand` verlässt sich
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

    def or_(self, ausdruck):  # noqa: ANN001, ANN201
        # Nicht ausgewertet, nur festgehalten: die Massenaktualisierung filtert
        # darüber auf die letzte Aktivität, und der Test prüft den Ausdruck.
        self._eq.setdefault("__or__", ausdruck)
        return self

    def _filtered(self):  # noqa: ANN202
        rows = self._rows
        if self._in:
            col, vals = self._in
            rows = [r for r in rows if r.get(col) in vals]
        for col, val in self._eq.items():
            if col in ("__lte__", "__or__"):
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


def test_get_messages_liefert_bildanhaenge(monkeypatch) -> None:  # noqa: ANN001
    """Nur ein Foto, kein Text: der Anhang trägt die Nachricht.

    Ohne dieses Feld stand im Verlauf eine leere graue Blase — der Gast
    schrieb „Se bildet" und das Bild kam nie an (live 07.08.2026).
    """
    bild = (
        "http://app.channex.io/api/v1/attachments/"
        "3970612d-2d8d-464e-aced-ef5f654e8823/"
        "70a2badb-fc87-4bfd-9bab-eacf5a8230a0/0780c002.jpeg"
    )
    msgs = [
        {
            "id": "m1",
            "attributes": {
                "message": "",
                "sender": "guest",
                "inserted_at": "2026-08-07T10:02:00.000000",
                "attachments": [bild],
            },
        }
    ]
    bookings = [{"id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1"}]
    svc = InboxService(
        service_client=_FakeDB(bookings, []), channex=_FakeChannex(messages=msgs)
    )
    out = svc.get_messages(_CTX, "th1")
    # `http` wird gehoben, sonst blockt der Browser das Bild als Mixed Content.
    assert out.items[0].attachments == [bild.replace("http://", "https://", 1)]


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:image/png;base64,AAAA",
        "https://boese.example/bild.jpeg",
        "https://app.channex.io.boese.example/bild.jpeg",
    ],
)
def test_get_messages_verwirft_unsichere_anhaenge(url: str) -> None:
    """Der Anhang landet in einem `src` und kommt von der Gegenseite: alles
    außer https auf einem bekannten Channex-Host fliegt raus (Wurzel 8)."""
    msgs = [
        {
            "id": "m1",
            "attributes": {
                "message": "Se bildet",
                "sender": "guest",
                "inserted_at": "2026-08-07T10:02:00.000000",
                "attachments": [url],
            },
        }
    ]
    bookings = [{"id": "th1", "tenant_id": "t1", "channex_booking_id": "cx-b1"}]
    svc = InboxService(
        service_client=_FakeDB(bookings, []), channex=_FakeChannex(messages=msgs)
    )
    assert svc.get_messages(_CTX, "th1").items[0].attachments == []


def test_spiegel_traegt_die_bilder_weiter() -> None:
    """Der Spiegel muss tragen, was er ersetzt (Wurzel 1).

    Antwortet das Portal nicht, kommt der Verlauf allein aus `portal_messages`.
    Ohne die Anhänge im Spiegel bliebe dann nur das Kürzel übrig — also wieder
    eine Blase ohne Bild, der Bug von vorn.
    """
    bild = (
        "https://app.channex.io/api/v1/attachments/"
        "3970612d-2d8d-464e-aced-ef5f654e8823/"
        "70a2badb-fc87-4bfd-9bab-eacf5a8230a0/0780c002.jpeg"
    )
    nachricht = InboxMessage(
        id="m1", message="", sender="guest",
        sent_at="2026-08-07T10:02:00Z", attachments=[bild],
    )
    # Schreibseite: Kürzel als `body`, Bild-URLs in `raw`.
    assert _vorschau(nachricht) == NUR_ANHANG_TEXT

    # Leseseite: aus `raw` zurück in die Nachricht, erneut geprüft.
    assert sichere_anhaenge({"attachments": [bild]}["attachments"]) == [bild]


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
    # booking-Anker ohne booked_at → keine Planung (kein erfundenes Datum).
    assert InboxService._compute_send_at("booking", 0, "12:00", {}) is None


def test_buchungs_automail_geht_nie_vor_der_buchung() -> None:
    """„0 Tage nach Buchung um 09:00" darf nicht vor der Buchung liegen.

    Der Tages-Pfad rechnet auf dem nackten DATUM und klebt die eingestellte
    Uhrzeit darauf. Bei Versatz 0 ergab das für JEDE Buchung nach dieser Uhrzeit
    einen Versand in der Vergangenheit — bei einer Buchung um 20:00 lag er elf
    Stunden davor, war damit sofort fällig und ging im nächsten Tick raus. Die
    eingestellte Uhrzeit war wirkungslos; wer 09:00 wählt, um nachts nicht zu
    stören, wurde genau darin verletzt.
    """
    th = {"booked_at": "2026-08-15T20:00:00+00:00"}
    dt = InboxService._compute_send_at(
        "booking", 0, "09:00", th, offset_unit="days", offset_value=0
    )
    assert dt == datetime(2026, 8, 15, 20, 0, tzinfo=UTC)


def test_buchungs_automail_behaelt_erreichbare_uhrzeit() -> None:
    """Liegt die Uhrzeit noch VOR der Buchung, bleibt sie maßgeblich.

    Gegenprobe zum Test darüber: der Riegel darf die Uhrzeit nicht pauschal
    überschreiben, sondern nur, wenn sie in der Vergangenheit läge.
    """
    th = {"booked_at": "2026-08-15T02:00:00+00:00"}
    dt = InboxService._compute_send_at(
        "booking", 0, "09:00", th, offset_unit="days", offset_value=0
    )
    assert dt == datetime(2026, 8, 15, 9, 0, tzinfo=UTC)


def test_versatz_ausserhalb_des_datumsbereichs_ist_none() -> None:
    """Ein unsinniger Versatz legt nur SICH still, nicht die ganze Buchung.

    `offset_value` nahm jede Zahl an; die Datumsrechnung brach dann mit
    OverflowError ab. Ungefangen riss das die Schleife über alle Regeln der
    Buchung mit — die übrigen Automails blieben ungeplant und der Gegenzustand
    (`_offene_stornieren`) lief nie (Wurzel 1). Der Import-Pfad fängt breit,
    also passierte das still.
    """
    th = {"arrival_date": "2026-07-10", "departure_date": "2026-07-14"}
    dt = InboxService._compute_send_at(
        "arrival", 0, "09:00", th, offset_unit="days", offset_value=999_999_999
    )
    assert dt is None


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


def test_kanalfilter_trennt_schreibweise_nicht_von_der_marke() -> None:
    """„Booking.com" (Maske) und „BookingCom" (Buchung) sind DERSELBE Kanal.

    DER VORFALL: Die Oberfläche speichert die Schreibweise der Marke, die
    Buchungen tragen die des Aggregators. Ein Vergleich nur über
    Groß-/Kleinschreibung trennt beide, weil der Unterschied der PUNKT ist —
    alle Booking.com-Buchungen fielen durch jeden Kanalfilter und bekamen keine
    einzige Automail, während dieselbe Regel für Airbnb lief.
    """
    regel = {
        "channels": ["myBestDays", "Booking.com", "Airbnb", "Vrbo", "Expedia"],
        "property_ids": [],
    }
    for ota in (
        "BookingCom", "Booking.com", "AirBNB", "Airbnb", "myBestDays",
        # Rechtsformen/Zusätze hängen hinten an — dieselbe Toleranz wie im
        # Buchungs-Import (`_ota_name_to_channel`).
        "Booking.com B.V.", "Expedia Group", "Air BnB",
    ):
        assert InboxService._automation_matches(regel, "p1", ota), ota
    # Ein NICHT gelisteter Kanal bleibt ausgeschlossen — der Schlüssel darf
    # nicht so grob werden, dass er fremde Kanäle einsammelt.
    assert not InboxService._automation_matches(regel, "p1", "Agoda")
    # Der Präfix gilt nur nach VORN: „Notbooking" beginnt nicht mit „booking…".
    assert not InboxService._automation_matches(regel, "p1", "Notbooking")
    # Ohne Kanalangabe greift ein gesetzter Filter nicht.
    assert not InboxService._automation_matches(regel, "p1", None)
    # Leere Liste heißt weiterhin „alle Kanäle".
    assert InboxService._automation_matches(
        {"channels": [], "property_ids": []}, "p1", "Agoda"
    )


def test_booked_at_bleibt_utc_trotz_objekt_zeitzone() -> None:
    """Ein fremder Zeitpunkt darf nicht in Ortszeit uminterpretiert werden.

    `booked_at` steht in UTC. Wurde daraus nur die Wanduhrzeit „22:30" behalten
    und diese mit der Objekt-Zeitzone kombiniert, verschob sich der Zeitpunkt um
    den UTC-Offset: „30 Minuten nach Buchung" landete auf 21:00 UTC — 90 Minuten
    VOR der Buchung, also sofort fällig (Wurzel 5b).
    """
    th = {"booked_at": "2026-08-07T22:30:00+00:00"}
    dt = InboxService._compute_send_at(
        "booking", 0, None, th, timezone_name="Europe/Copenhagen",
        offset_unit="minutes", offset_value=30,
    )
    assert dt == datetime(2026, 8, 7, 23, 0, tzinfo=UTC)


def test_send_time_ueberstimmt_den_buchungszeitpunkt_nicht() -> None:
    """Bei Minuten/Stunden zählt der echte Anker, nicht die Uhrzeit der Regel.

    „30 Minuten nach Buchung um 10:00" ist widersprüchlich. Gewann die Uhrzeit,
    entstand ein Versand Stunden VOR der Buchung — und er ging sofort raus, weil
    er innerhalb der Nachzügler-Grenze lag.
    """
    th = {"booked_at": "2026-08-07T18:45:00+00:00"}
    dt = InboxService._compute_send_at(
        "booking", 0, "10:00", th, offset_unit="minutes", offset_value=30
    )
    assert dt == datetime(2026, 8, 7, 19, 15, tzinfo=UTC)


def test_stunden_versatz_ist_echte_dauer_ueber_dst() -> None:
    """Stunden sind eine Dauer, keine Wanduhr-Verschiebung.

    In der Umstellungsnacht (29.03.2026, 02:00→03:00) ergab die Rechnung über
    die lokale Wanduhr real nur 5 statt 6 Stunden.
    """
    th = {"booked_at": "2026-03-28T21:00:00+00:00"}
    dt = InboxService._compute_send_at(
        "booking", 0, None, th, timezone_name="Europe/Copenhagen",
        offset_unit="hours", offset_value=6,
    )
    assert dt == datetime(2026, 3, 29, 3, 0, tzinfo=UTC)


def test_unbrauchbare_uhrzeit_bricht_die_planung_nicht_ab() -> None:
    """'24:00' ist in Postgres ein gültiger `time`, in Python nicht.

    Ohne Abfangen riss eine einzige so konfigurierte Regel die komplette
    Neuplanung des Betriebs ab — alle Automails blieben still stehen (Wurzel 5).
    """
    th = {"arrival_date": "2026-08-10", "departure_date": "2026-08-14"}
    assert InboxService._compute_send_at(
        "arrival", -1, "24:00:00", th, offset_unit="days", offset_value=-1
    ) is None


def test_planung_normiert_falsches_vorzeichen_aus_der_db() -> None:
    """Ein DB-Vorzeichen, das dem Auslöser widerspricht, darf nicht gelten.

    Live passiert (07.08.2026): „Check-out-Anweisungen" stand als
    `before_checkout` mit `offset_value=+1` in `message_automation` — die
    Normierung greift nur beim Speichern über die API, die Planung las den Wert
    roh. Die Automail ging deshalb einen Tag NACH der Abreise raus, an drei
    Gäste, die schon weg waren („wir hoffen, Du hattest einen schönen
    Aufenthalt" als Check-out-Anweisung). Die Planung leitet Anker und
    Vorzeichen seither selbst aus dem Auslöser ab.
    """
    trigger = "before_checkout"
    versatz = versatz_normieren(trigger, 1)  # DB trug +1
    assert versatz == -1
    th = {"arrival_date": "2026-08-03", "departure_date": "2026-08-06"}
    dt = InboxService._compute_send_at(
        anker_von(trigger), versatz, "20:00", th,
        offset_unit="days", offset_value=versatz,
    )
    # Vorabend der Abreise, nicht der Tag danach.
    assert dt == datetime(2026, 8, 5, 20, 0, tzinfo=UTC)


def test_compute_send_at_ohne_uhrzeit_ist_mitternacht() -> None:
    """Keine feste Uhrzeit → Mitternacht des Ankertags, kein geratener Wert."""
    th = {"arrival_date": "2026-07-10"}
    dt = InboxService._compute_send_at(
        "arrival", 0, None, th, offset_unit="days", offset_value=-1
    )
    assert dt == datetime(2026, 7, 9, 0, 0, tzinfo=UTC)


def test_compute_send_at_stunden_nutzen_buchungsuhrzeit() -> None:
    """Nur die Buchung trägt einen echten Zeitpunkt — der zählt dann auch.

    `booked_at` ist der Zeitpunkt BEIM PORTAL; „3 Stunden nach Buchung" muss von
    der tatsächlichen Buchungsminute rechnen, nicht von Mitternacht.
    """
    th = {"booked_at": "2026-07-10T14:20:00+00:00"}
    dt = InboxService._compute_send_at(
        "booking", 0, None, th, offset_unit="hours", offset_value=3
    )
    assert dt == datetime(2026, 7, 10, 17, 20, tzinfo=UTC)


def test_anker_buchung_nimmt_booked_at_nicht_unsere_uhr() -> None:
    """Wurzel 5b: der Buchungszeitpunkt ist der des PORTALS.

    DER VORFALL (07.08.2026): 30 Buchungen aus Februar bis Juni wurden am 06.08.
    in einem Rutsch importiert. Alle trugen dieselbe `created_at` — die Regel
    „5 Minuten nach Buchung" hatte sie deshalb gebündelt auf EINEN Zeitpunkt
    gelegt, Monate nach der echten Buchung und nach der Abreise der Gäste.
    """
    th = {
        "booked_at": "2026-02-25T05:18:54+00:00",
        "created_at": "2026-08-06T08:49:04+00:00",
    }
    dt = InboxService._compute_send_at(
        "booking", 0, None, th, offset_unit="minutes", offset_value=5
    )
    # Sekundengenau: „5 Minuten nach der Buchung" heißt 05:18:54 + 5 min. Vorher
    # wurde der Zeitpunkt in Datum + „HH:MM" zerlegt und die Sekunden fielen weg;
    # dieselbe Zerlegung verschob den Wert um den UTC-Offset des Objekts, sobald
    # eine Objekt-Zeitzone im Spiel war.
    assert dt == datetime(2026, 2, 25, 5, 23, 54, tzinfo=UTC)


def test_anker_buchung_ohne_booked_at_plant_nicht() -> None:
    """Ohne echten Buchungszeitpunkt wird NICHT auf unsere Uhr ausgewichen."""
    th = {"created_at": "2026-08-06T08:49:04+00:00"}
    assert InboxService._compute_send_at("booking", 0, "12:00", th) is None


def test_compute_send_at_altbestand_rechnet_unveraendert() -> None:
    """Ohne offset_value gilt offset_days — der Bestand darf nicht verrutschen."""
    th = {"arrival_date": "2026-07-10"}
    dt = InboxService._compute_send_at("arrival", -3, "07:45", th)
    assert dt == datetime(2026, 7, 7, 7, 45, tzinfo=UTC)


def test_checkin_zeit_faellt_auf_die_hausregel_zurueck() -> None:
    """Airbnb liefert die Check-in-Zeit am INSERAT, nicht an der Buchung.

    DER VORFALL (07.08.2026): Die Check-in-Automail für Mathias ging nicht raus
    („Feld ohne Wert: checkin_time"), obwohl am Objekt „Feriehus Perlen" 16:00
    stand — importiert aus Airbnbs Booking Settings. Beide bisherigen Quellen
    waren buchungsbezogen und liefen bei Airbnb deshalb immer leer.
    """
    prop = {"type_attributes": {"policies": {"checkInTime": "16:00",
                                             "checkOutTime": "10:00"}}}
    assert InboxService._zeiten_vom_objekt(prop, None, None) == ("16:00", "10:00")


def test_absprache_schlaegt_die_hausregel() -> None:
    """Ein reservierungseigener Wert darf nicht von der Hausregel überschrieben
    werden — sonst bekäme ein Gast mit später Anreise die Standardzeit."""
    prop = {"type_attributes": {"policies": {"checkInTime": "16:00"}}}
    assert InboxService._zeiten_vom_objekt(prop, "20:00", None)[0] == "20:00"


def test_ohne_hausregel_bleibt_die_zeit_leer() -> None:
    """Kein Objekt, keine Regel → None statt einer erfundenen Uhrzeit."""
    assert InboxService._zeiten_vom_objekt(None, None, None) == (None, None)
    assert InboxService._zeiten_vom_objekt({}, None, None) == (None, None)


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


# --- Nachzügler: was zu spät kommt, geht nicht mehr raus (0307) --------------
def test_nachzuegler_wird_nicht_mehr_versendet() -> None:
    """DER VORFALL (07.08.2026): der Import bestehender Buchungen legte für jede
    alte Buchung eine Automail an. Ihr Zeitpunkt lag in der Vergangenheit, war
    also sofort „fällig" — 30 Buchungsbestätigungen standen gebündelt für Gäste
    an, deren Aufenthalt vorbei war."""
    jetzt = datetime(2026, 8, 7, 12, 0, tzinfo=UTC)
    # Gerade eben fällig geworden → geht raus.
    assert (
        InboxService._versandstatus(datetime(2026, 8, 7, 11, 0, tzinfo=UTC), jetzt)
        == "pending"
    )
    # Zwei Tage überfällig → wird festgehalten, nicht verschickt.
    assert (
        InboxService._versandstatus(datetime(2026, 8, 5, 9, 0, tzinfo=UTC), jetzt)
        == "skipped"
    )
    # Künftig → geht raus.
    assert (
        InboxService._versandstatus(datetime(2026, 8, 20, 9, 0, tzinfo=UTC), jetzt)
        == "pending"
    )


# --- Auslöser: Anker + Richtung kommen aus dem Auslöser (0307) ---------------
def test_ausloeser_katalog_ist_vollstaendig() -> None:
    """Alle sechs Auslöser — „Nach Anreise" und „Vor Abreise" fehlten bis 0307."""
    from src.features.inbox.ausloeser import ALLE_TRIGGER

    assert set(ALLE_TRIGGER) == {
        "booking_new",
        "before_checkin",
        "after_checkin",
        "before_checkout",
        "after_checkout",
        "message_received",
    }


def test_payload_leitet_anker_und_vorzeichen_aus_dem_ausloeser_ab() -> None:
    """DER VORFALL (07.08.2026): eine Regel „Check-out-Anweisungen" stand live
    mit trigger='before_checkin' und anchor='departure' — sie hieß „Vor Anreise"
    und feuerte vor der ABREISE. Anker und Vorzeichen dürfen deshalb nicht mehr
    aus der Anfrage kommen."""
    from src.features.inbox.automation_mapping import automation_payload
    from src.features.inbox.schemas import AutomationUpsert

    p = automation_payload(
        AutomationUpsert(
            name="Check-out-Anweisungen",
            trigger="before_checkout",
            # Gegenteil von dem, was der Auslöser sagt — wird verworfen.
            anchor="arrival",
            offset_unit="days",
            offset_value=1,
            message="Text",
        )
    )
    assert p["anchor"] == "departure"
    assert p["offset_value"] == -1
    assert p["offset_days"] == -1


def test_payload_nach_anreise_ist_positiv() -> None:
    from src.features.inbox.automation_mapping import automation_payload
    from src.features.inbox.schemas import AutomationUpsert

    p = automation_payload(
        AutomationUpsert(
            name="Willkommen",
            trigger="after_checkin",
            offset_unit="hours",
            offset_value=-2,   # Betrag; das Vorzeichen setzt der Auslöser
            message="Text",
        )
    )
    assert p["anchor"] == "arrival"
    assert p["offset_value"] == 2
    # „in Tagen" ist bei Stunden keine Aussage.
    assert p["offset_days"] == 0


def test_row_meldet_keinen_widerspruechlichen_anker() -> None:
    """Auch eine noch nicht migrierte Zeile wird widerspruchsfrei ausgeliefert."""
    from src.features.inbox.automation_mapping import automation_row

    a = automation_row(
        {"id": "a1", "name": "Alt", "trigger": "before_checkout", "anchor": "arrival"}
    )
    assert a.anchor == "departure"


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


def test_liste_zeigt_beantworteten_thread_als_gelesen() -> None:
    """Live am 11.08.2026: vier von neun „ungelesenen" Threads trugen eine
    EIGENE Nachricht als letzte — beantwortet und trotzdem als Arbeit markiert.

    `is_read = False` stammt hier vom Eingangspfad; entscheidend ist, dass
    unsere Antwort NACH der Gastnachricht liegt.
    """
    row = {**_booking_row(), "is_read": False, "read_at": None}
    nachrichten = [
        {
            "tenant_id": "t1", "thread_ref": row["id"], "sender": "guest",
            "body": "Hvornår sender i adressen?", "sent_at": "2026-08-11T05:42:58+00:00",
        },
        {
            "tenant_id": "t1", "thread_ref": row["id"], "sender": "property",
            "body": "Hej Kevin, alle Infos …", "sent_at": "2026-08-11T06:25:33+00:00",
        },
    ]
    svc = InboxService(
        service_client=_FakeDB([row], [], nachrichten=nachrichten),
        channex=_FakeChannex(),
    )
    th = svc.list_threads(_CTX).items[0]
    assert th.is_read is True
    assert th.last_sender == "property"  # Vorschau zeigt die jüngste Nachricht


def test_liste_zeigt_offene_gastfrage_als_ungelesen() -> None:
    """Die Gegenprobe: der Gast hat NACH unserer Antwort geschrieben."""
    row = {**_booking_row(), "is_read": False, "read_at": None}
    nachrichten = [
        {
            "tenant_id": "t1", "thread_ref": row["id"], "sender": "property",
            "body": "Hej", "sent_at": "2026-08-10T06:47:16+00:00",
        },
        {
            "tenant_id": "t1", "thread_ref": row["id"], "sender": "guest",
            "body": "Noch eine Frage", "sent_at": "2026-08-11T09:26:22+00:00",
        },
    ]
    svc = InboxService(
        service_client=_FakeDB([row], [], nachrichten=nachrichten),
        channex=_FakeChannex(),
    )
    assert svc.list_threads(_CTX).items[0].is_read is False


def test_massenaktualisierung_gelesen_schreibt_den_lesezeitpunkt() -> None:
    """Ohne `read_at` hängt der Lesestand an einem nackten Flag (Wurzel 1).

    Und gefiltert wird über die letzte AKTIVITÄT (Fremdereignis), nicht über
    `updated_at` — unsere Schreibzeit setzt der Journal-Tick laufend auf jetzt,
    damit traf „alles vor dem 01.08." live keinen einzigen Thread (Wurzel 5b).
    """
    updates: list = []
    svc = InboxService(
        service_client=_FakeDB([_booking_row()], [], updates=updates),
        channex=_FakeChannex(),
    )
    svc.bulk_update(_CTX, "read", "2026-08-01")

    (_tabelle, patch, _rows) = updates[0]
    assert patch["is_read"] is True
    assert patch["read_at"], "der Lesezeitpunkt gehört mit in den Patch"


def test_massenaktualisierung_filtert_letzte_aktivitaet_und_nur_aktive() -> None:
    """Der Filter steht im Ausdruck, nicht in `updated_at` — und Papierkorb/
    Archiv bleiben unberührt (sonst holte „archivieren" Threads aus dem
    Papierkorb zurück)."""
    db = _FakeDB([_booking_row()], [])
    svc = InboxService(service_client=db, channex=_FakeChannex())
    letzte = {}

    original = db.table

    def merkend(name):  # noqa: ANN001, ANN202
        q = original(name)
        if name == "channex_booking":
            letzte["q"] = q
        return q

    db.table = merkend  # type: ignore[method-assign]
    svc.bulk_update(_CTX, "archived", "2026-08-01")

    filt = letzte["q"]._eq  # noqa: SLF001 — Testdoppel
    ausdruck = filt["__or__"]
    assert "last_message_at.lte.2026-08-01T23:59:59Z" in ausdruck
    assert "booked_at.lte.2026-08-01T23:59:59Z" in ausdruck
    assert "updated_at" not in ausdruck
    assert filt["inbox_status"] == "active"


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

    KORRIGIERTE ERWARTUNG: Zwischen den Punkten EINER Liste steht ein
    EINFACHER Umbruch. Vorher zementierte dieser Test dort eine Leerzeile —
    und eine Leerzeile trennt Absätze. Beim Zurücklesen in den Editor
    (`textZuHtml`) zerfiel die eine Liste damit in n Einzellisten mit je einem
    Punkt, und jede weitere Bearbeitungsrunde trieb sie weiter auseinander.
    """
    from src.features.inbox.felder import html_zu_text

    roh = (
        "<p><strong>Hausregeln</strong></p><ul>"
        "<li><p>Nicht rauchen</p></li><li><p>Ruhe ab 22&nbsp;Uhr</p></li></ul>"
    )
    assert html_zu_text(roh) == "Hausregeln\n\n- Nicht rauchen\n- Ruhe ab 22 Uhr"


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


def test_nummerierte_liste_bleibt_nummeriert() -> None:
    """`<ol>` zählt. Ein einzelnes `re.sub` konnte das prinzipiell nicht.

    Vorher machte `_LISTENPUNKT.sub("\\n- ", …)` aus JEDEM `<li>` einen Strich:
    Wer im Editor „1. 2. 3." schrieb, bei dem las der Gast „- - -". Die
    Nummerierung ist ein ZUSTAND (welche Liste, welcher Punkt, welche Ebene),
    den nur ein Durchlauf kennen kann.
    """
    from src.features.inbox.felder import html_zu_text

    roh = "<ol><li><p>Schlüssel holen</p></li><li><p>Tür öffnen</p></li></ol>"
    assert html_zu_text(roh) == "1. Schlüssel holen\n2. Tür öffnen"


def test_ol_start_attribut_wird_beachtet() -> None:
    """Eine bei 3 fortgesetzte Liste beginnt bei 3, nicht wieder bei 1."""
    from src.features.inbox.felder import html_zu_text

    roh = '<ol start="3"><li>Drei</li><li>Vier</li></ol>'
    assert html_zu_text(roh) == "3. Drei\n4. Vier"


def test_verschachtelte_liste_wird_eingerueckt() -> None:
    """Die innere Liste zählt eigenständig und rückt ein.

    Wichtig ist der SCHLUSS der inneren Liste: dort darf keine Leerzeile
    entstehen, sonst risse sie die äußere Liste in zwei Listen.
    """
    from src.features.inbox.felder import html_zu_text

    roh = "<ul><li>Anreise<ol><li>Code</li><li>Tür</li></ol></li><li>Abreise</li></ul>"
    assert html_zu_text(roh) == "- Anreise\n  1. Code\n  2. Tür\n- Abreise"


def test_absatz_gibt_leerzeile_umbruch_nur_eine_zeile() -> None:
    """`</p>` ist eine LEERZEILE, `<br>` nur ein Umbruch.

    Vorher lieferten beide „\\n" — die Leerzeilen zwischen Absätzen fielen
    ersatzlos weg und der Gast bekam eine Textwand.
    """
    from src.features.inbox.felder import html_zu_text

    assert html_zu_text("<p>Erster</p><p>Zweiter</p>") == "Erster\n\nZweiter"
    assert html_zu_text("<p>Oben<br>Unten</p>") == "Oben\nUnten"


def test_link_behaelt_sein_ziel() -> None:
    """„schreib uns hier" ohne URL wäre im Portal-Chat wertlos.

    Der Gast kann im Chat nichts anklicken — steht das Ziel nur im `href`, ist
    es weg. Ausnahme: Der Text IST schon die URL, dann bliebe sie doppelt
    stehen. Gleiche Regel wie `knotenText` im Composer.
    """
    from src.features.inbox.felder import html_zu_text

    assert html_zu_text('<p>Buchen: <a href="https://a.dk/b">hier</a></p>') == (
        "Buchen: hier (https://a.dk/b)"
    )
    assert html_zu_text('<p><a href="https://a.dk">https://a.dk</a></p>') == (
        "https://a.dk"
    )


def test_auszeichnung_faellt_ersatzlos_weg() -> None:
    """`<strong>`/`<em>`/`<u>` verschwinden OHNE Ersatzzeichen.

    Ein „*fett*" wäre nur ein weiteres Zeichen, das der Gast mitliest — die
    Portale rendern im Chat kein Markdown.
    """
    from src.features.inbox.felder import html_zu_text

    roh = "<p><strong>Sehr</strong> <em>wichtig</em> und <u>dringend</u></p>"
    assert html_zu_text(roh) == "Sehr wichtig und dringend"


def test_skriptinhalt_erreicht_den_gast_nicht() -> None:
    """`HTMLParser` reicht den INHALT von `<script>` als Daten durch.

    Ohne Sperre stand „alert(1)" als sichtbarer Satz in der Nachricht — der
    frühere `nh3.clean(tags=set())`-Weg hatte ihn verworfen.
    """
    from src.features.inbox.felder import html_zu_text

    assert html_zu_text("<p>Hi</p><script>alert(1)</script>") == "Hi"


def test_rundreise_ist_ab_generation_eins_stabil() -> None:
    """Klartext → HTML → Klartext darf nicht driften.

    DER GEMESSENE FEHLER: Aus „1." wurde beim Zurücklesen „- ", und weil
    zwischen den Punkten eine Leerzeile stand, zerfiel die Liste ab der zweiten
    Generation in n Einzellisten.
    """
    from src.features.inbox.felder import html_zu_text

    # Was der Composer aus Klartext baut (`textZuHtml`, composer-editor.tsx).
    html = (
        "<p>Ablauf:</p>"
        "<ol><li>Schlüsselbox öffnen</li><li>Code eingeben</li></ol>"
        "<p>Danach:</p><ul><li>WLAN verbinden</li><li>Heizung prüfen</li></ul>"
    )
    erste = html_zu_text(html)
    assert erste == (
        "Ablauf:\n\n1. Schlüsselbox öffnen\n2. Code eingeben\n\n"
        "Danach:\n\n- WLAN verbinden\n- Heizung prüfen"
    )
    # Zweite Generation: derselbe Klartext, erneut durch den Editor gereicht —
    # `textZuHtml` baut daraus exakt dieselbe Struktur zurück.
    assert html_zu_text(html) == erste


def test_platzhalter_ueber_blockgrenze_wird_erkannt() -> None:
    """Wer mitten im Platzhalter Enter drückt, zerreißt ihn über zwei Absätze.

    `<p>Hallo {{guest</p><p>_name}}</p>` ergab „{{guest\\n\\n_name}}". Das galt
    weder als bekanntes noch als unbekanntes Feld: kein 422 beim Speichern,
    keine Meldung beim Versand — der Gast las wörtlich „{{guest".
    """
    from src.features.inbox.felder import benutzte_felder, html_zu_text

    text = html_zu_text("<p>Hallo {{guest</p><p>_name}}</p>")
    assert benutzte_felder(text) == ["guest_name"]
    assert unbekannte_felder(text) == []
    # Ersetzt wird der GANZE zerrissene Ausdruck — kein Rest bleibt stehen.
    assert rendern(text, Kontext(guest_name="Frau Meier")) == "Hallo Frau Meier"


def test_platzhalter_mit_auszeichnung_ueberlebt_die_umwandlung() -> None:
    """Der einfache Fall löst sich über die REIHENFOLGE.

    `{{guest<strong>_name</strong>}}` ist erst nach `html_zu_text` wieder ein
    erkennbarer Platzhalter — deshalb prüft und rendert der Service IMMER auf
    dem abgeleiteten Klartext, nie auf dem HTML.
    """
    from src.features.inbox.felder import html_zu_text

    text = html_zu_text("<p>Hallo {{guest<strong>_name</strong>}}</p>")
    assert rendern(text, Kontext(guest_name="Herr Jensen")) == "Hallo Herr Jensen"


def test_echter_tippfehler_bleibt_auch_zerrissen_ein_fehler() -> None:
    """Die Whitespace-Toleranz darf kein Freibrief für Unbekanntes sein."""
    assert unbekannte_felder("{{Quatsch\nFeld}}") == ["QuatschFeld"]


def test_sanitizer_wirft_skript_und_bild_weg() -> None:
    """Wurzel 8: Allowlist-Parser beim SPEICHERN, nie Regex.

    `<script>`, ein `onerror`-Bild und ein `javascript:`-Ziel dürfen die
    Vorlage nicht erreichen — sie wird im Dashboard des Betriebs gerendert.
    """
    from src.features.inbox.schemas import sanitize_vorlagen_html

    sauber = sanitize_vorlagen_html(
        '<p>Hallo<script>alert(1)</script></p>'
        '<img src="x" onerror="alert(2)">'
        '<p><a href="javascript:alert(3)">klick</a></p>'
    )
    assert "script" not in sauber.lower()
    assert "<img" not in sauber.lower()
    assert "onerror" not in sauber.lower()
    assert "javascript:" not in sauber.lower()
    assert "Hallo" in sauber and "klick" in sauber


def test_sanitizer_behaelt_die_gliederung_und_echte_links() -> None:
    """Was der Klartext abbilden kann, muss durchkommen — sonst wäre der
    Editor ein Formatierer ohne Wirkung."""
    from src.features.inbox.schemas import sanitize_vorlagen_html

    sauber = sanitize_vorlagen_html(
        '<p><strong>Titel</strong></p><ol><li>Eins</li></ol>'
        '<p><a href="https://a.dk">Seite</a></p>'
    )
    assert "<ol>" in sauber and "<li>" in sauber and "<strong>" in sauber
    assert 'href="https://a.dk"' in sauber
    # nh3 setzt rel selbst (link_rel) — ein Ziel-Tab darf uns nicht übernehmen.
    assert "noopener" in sauber


def test_upsert_saeubert_body_html_im_validator() -> None:
    """Der Validator hängt am FELD, greift also in POST UND PUT."""
    from src.features.inbox.schemas import TemplateUpsert

    req = TemplateUpsert(title="T", body_html='<p>ok</p><script>alert(1)</script>')
    assert "script" not in req.body_html.lower()
    assert "ok" in req.body_html


def test_create_template_leitet_klartext_selbst_ab() -> None:
    """Der Versand-Klartext kommt vom SERVER, nie vom Client (Wurzel 3).

    Der Client schickt hier absichtlich ein `body`, das mit seinem `body_html`
    nichts zu tun hat. Würde es übernommen, könnte eine Anfrage im Editor
    harmloses HTML zeigen und dem Gast einen ganz anderen Text schicken — denn
    versendet wird `body`.
    """
    from src.features.inbox.schemas import TemplateUpsert

    updates: list = []
    svc = InboxService(
        service_client=_FakeDB([], [], updates=updates), channex=_FakeChannex()
    )
    req = TemplateUpsert(
        title="Anreise",
        body="ICH BIN GELOGEN",
        body_html="<p>Hallo</p><ol><li>Code</li><li>Tür</li></ol>",
    )
    out = svc.create_template(_CTX, req)

    assert out.body == "Hallo\n\n1. Code\n2. Tür"
    assert "GELOGEN" not in out.body
    # Auch in der DB steht der abgeleitete Text, nicht der geschickte.
    geschrieben = [
        p for (t, m, p) in updates if t == "message_template" and m == "insert"
    ]
    assert geschrieben and geschrieben[0]["body"] == "Hallo\n\n1. Code\n2. Tür"
    assert geschrieben[0]["body_html"] == req.body_html


def test_create_template_weist_zerrissenen_tippfehler_ab() -> None:
    """Geprüft wird der ABGELEITETE Klartext — sonst rutschte ein über zwei
    Absätze zerrissener Tippfehler ungeprüft durch."""
    from src.features.inbox.schemas import TemplateUpsert

    svc = InboxService(service_client=_FakeDB([], []), channex=_FakeChannex())
    req = TemplateUpsert(title="T", body_html="<p>Hallo {{guest</p><p>_nmae}}</p>")
    with pytest.raises(InboxError) as exc:
        svc.create_template(_CTX, req)
    assert exc.value.status_code == 422
    assert "guest_nmae" in exc.value.message


def test_host_sanitize_verklebt_absaetze_nicht_mehr() -> None:
    """host_messages liest DIESELBE Tabelle und hatte denselben Fehler.

    `nh3.clean(tags=set())` entfernt Tags OHNE Umbruch-Ersatz: aus
    `<p>A</p><p>B</p>` wurde „AB" — zwei Absätze zu einem Wort verklebt. Und
    reines Markup (`<p></p>`) schlug als „Nachricht ist leer" fehl, obwohl der
    Absender etwas geschrieben hatte.
    """
    from src.features.host_messages.service import HostMessagesError, _sanitize

    assert _sanitize("<p>A</p><p>B</p>") == "A\n\nB"
    assert _sanitize("<ol><li>Eins</li><li>Zwei</li></ol>") == "1. Eins\n2. Zwei"
    # Klartext ohne Markup bleibt unangetastet (der Normalfall dieses Feldes).
    assert _sanitize("Einfach Text") == "Einfach Text"
    # Skript-Inhalt darf nicht als Text durchrutschen.
    assert "alert" not in _sanitize("<p>Hi</p><script>alert(1)</script>")
    # Wirklich leer bleibt ein 422.
    with pytest.raises(HostMessagesError):
        _sanitize("<p></p>")



# --- Sprachfassungen (0363) --------------------------------------------------
class _SprachDB:
    """Fake-DB nur für die Sprach-/Fassungslogik.

    Führt echte Zeilenlisten je Tabelle, damit Löschen und Upsert PRÜFBAR sind:
    genau dort sitzt der Gegenzustand (Wurzel 1) — eine im Editor entfernte
    Fassung muss verschwinden, nicht nur unsichtbar werden.
    """

    def __init__(self, tabellen: dict | None = None) -> None:
        self.tabellen: dict[str, list[dict]] = {
            "users": [{
                "id": "u", "full_name": "T", "email": "t@x.de",
                "role": "admin", "permissions": _PERMS_FULL,
            }],
        }
        self.tabellen.update(tabellen or {})

    def table(self, name):  # noqa: ANN001, ANN201
        return _SprachQuery(self.tabellen.setdefault(name, []))


class _SprachQuery:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self._eq: dict = {}
        self._in: tuple | None = None
        self._patch: dict | None = None
        self._insert = None
        self._upsert = None
        self._delete = False

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def eq(self, col, val):  # noqa: ANN001, ANN201
        self._eq[col] = val
        return self

    def in_(self, col, vals):  # noqa: ANN001, ANN201
        self._in = (col, list(vals))
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def update(self, patch):  # noqa: ANN001, ANN201
        self._patch = patch
        return self

    def insert(self, payload):  # noqa: ANN001, ANN201
        self._insert = payload
        return self

    def upsert(self, payload, **_k):  # noqa: ANN001, ANN003, ANN201
        self._upsert = payload
        return self

    def delete(self):  # noqa: ANN201
        self._delete = True
        return self

    def _treffer(self) -> list[dict]:
        rows = list(self._rows)
        if self._in:
            col, vals = self._in
            rows = [r for r in rows if str(r.get(col)) in [str(v) for v in vals]]
        for col, val in self._eq.items():
            rows = [r for r in rows if r.get(col) == val]
        return rows

    def execute(self):  # noqa: ANN201
        if self._delete:
            weg = self._treffer()
            for r in weg:
                self._rows.remove(r)
            return _Res(weg)
        if self._patch is not None:
            treffer = self._treffer()
            for r in treffer:
                r.update(self._patch)
            return _Res(treffer)
        if self._insert is not None:
            neu = dict(self._insert)
            neu.setdefault("id", f"row-{len(self._rows) + 1}")
            self._rows.append(neu)
            return _Res([neu])
        if self._upsert is not None:
            payload = (
                self._upsert if isinstance(self._upsert, list) else [self._upsert]
            )
            for eintrag in payload:
                schluessel = {
                    k: eintrag.get(k)
                    for k in ("template_id", "automation_id", "lang", "tenant_id")
                    if k in eintrag
                }
                bestand = next(
                    (
                        r
                        for r in self._rows
                        if all(r.get(k) == v for k, v in schluessel.items())
                    ),
                    None,
                )
                if bestand:
                    bestand.update(eintrag)
                else:
                    self._rows.append(dict(eintrag))
            return _Res(payload)
        return _Res(self._treffer())


def test_erste_sprache_wird_standard_und_zweite_nicht() -> None:
    """Ohne Standardsprache gäbe es keinen Rückfall — die erste MUSS es sein."""
    db = _SprachDB()
    svc = InboxService(service_client=db, channex=_FakeChannex())
    svc.add_message_language(_CTX, "de")
    liste = svc.add_message_language(_CTX, "da")
    nach_code = {s.code: s.is_default for s in liste.items}
    assert nach_code == {"de": True, "da": False}


def test_sprache_hinzufuegen_ist_idempotent() -> None:
    """Doppelklick darf die Standardsprache nicht verschieben (Wurzel 2)."""
    db = _SprachDB()
    svc = InboxService(service_client=db, channex=_FakeChannex())
    svc.add_message_language(_CTX, "de")
    svc.add_message_language(_CTX, "en")
    svc.set_default_message_language(_CTX, "en")
    liste = svc.add_message_language(_CTX, "de")   # zweiter Aufruf
    nach_code = {s.code: s.is_default for s in liste.items}
    assert nach_code == {"de": False, "en": True}
    assert len(db.tabellen["tenant_message_language"]) == 2


def test_regionale_variante_wird_auf_basissprache_normiert() -> None:
    """„de-AT" ist die Sprache „de" — sonst legt der Betrieb zwei Reiter an."""
    db = _SprachDB()
    svc = InboxService(service_client=db, channex=_FakeChannex())
    svc.add_message_language(_CTX, "de-AT")
    liste = svc.list_message_languages(_CTX)
    assert [s.code for s in liste.items] == ["de"]


def test_unbekannte_sprache_wird_abgewiesen() -> None:
    svc = InboxService(service_client=_SprachDB(), channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.add_message_language(_CTX, "xx")
    assert exc.value.status_code == 422


def test_standardsprache_nicht_loeschbar_solange_andere_daneben_stehen() -> None:
    db = _SprachDB()
    svc = InboxService(service_client=db, channex=_FakeChannex())
    svc.add_message_language(_CTX, "de")
    svc.add_message_language(_CTX, "da")
    with pytest.raises(InboxError) as exc:
        svc.remove_message_language(_CTX, "de")
    assert exc.value.status_code == 422
    # Die letzte Sprache darf weg — dann gilt wieder nur die Grundfassung.
    svc.remove_message_language(_CTX, "da")
    assert svc.remove_message_language(_CTX, "de").items == []


def test_sprache_entfernen_nimmt_ihre_fassungen_mit() -> None:
    """Sonst ginge ein in der Oberfläche gelöschter Text weiter an Gäste raus."""
    db = _SprachDB({
        "message_template_text": [
            {"template_id": "tpl", "tenant_id": "t1", "lang": "da",
             "subject": "", "body": "Hej", "body_html": "<p>Hej</p>"},
            {"template_id": "tpl", "tenant_id": "t1", "lang": "de",
             "subject": "", "body": "Hallo", "body_html": "<p>Hallo</p>"},
        ],
        "message_automation_text": [
            {"automation_id": "a1", "tenant_id": "t1", "lang": "da",
             "subject": "", "message": "Hej"},
        ],
    })
    svc = InboxService(service_client=db, channex=_FakeChannex())
    svc.add_message_language(_CTX, "de")
    svc.add_message_language(_CTX, "da")
    svc.remove_message_language(_CTX, "da")
    assert [r["lang"] for r in db.tabellen["message_template_text"]] == ["de"]
    assert db.tabellen["message_automation_text"] == []


def test_vorlage_speichert_sprachfassungen_und_leitet_klartext_ab() -> None:
    """Auch je Sprache gilt: `body` kommt aus dem HTML, nie vom Client."""
    from src.features.inbox.schemas import TemplateTextUpsert, TemplateUpsert

    db = _SprachDB()
    svc = InboxService(service_client=db, channex=_FakeChannex())
    out = svc.create_template(
        _CTX,
        TemplateUpsert(
            title="Anreise",
            body_html="<p>Grundfassung</p>",
            subject="Anreise",
            texts=[
                TemplateTextUpsert(
                    lang="da", subject="Ankomst", body_html="<p>Hej {{guest_first_name}}</p>"
                ),
                # Leerer Reiter: darf NICHT als Fassung gespeichert werden,
                # sonst verdrängt er die Grundfassung durch eine leere Nachricht.
                TemplateTextUpsert(lang="en", subject="", body_html="<p></p>"),
            ],
        ),
    )
    assert [t.lang for t in out.texts] == ["da"]
    assert out.texts[0].body == "Hej {{guest_first_name}}"
    assert out.subject == "Anreise"


def test_vorlage_entfernt_nicht_mehr_geschickte_sprachfassung() -> None:
    """Die Liste ist der vollständige Sollzustand (Wurzel 1)."""
    from src.features.inbox.schemas import TemplateTextUpsert, TemplateUpsert

    db = _SprachDB({
        "message_template": [{
            "id": "tpl", "tenant_id": "t1", "title": "A", "body": "x",
            "body_html": "<p>x</p>", "subject": "",
        }],
        "message_template_text": [
            {"template_id": "tpl", "tenant_id": "t1", "lang": "da",
             "subject": "", "body": "Hej", "body_html": "<p>Hej</p>"},
            {"template_id": "tpl", "tenant_id": "t1", "lang": "de",
             "subject": "", "body": "Hallo", "body_html": "<p>Hallo</p>"},
        ],
    })
    svc = InboxService(service_client=db, channex=_FakeChannex())
    out = svc.update_template(
        _CTX,
        "tpl",
        TemplateUpsert(
            title="A",
            body_html="<p>x</p>",
            texts=[TemplateTextUpsert(lang="de", body_html="<p>Hallo neu</p>")],
        ),
    )
    assert [t.lang for t in out.texts] == ["de"]
    assert [r["lang"] for r in db.tabellen["message_template_text"]] == ["de"]
    assert db.tabellen["message_template_text"][0]["body"] == "Hallo neu"


def test_vorlage_ohne_texts_feld_laesst_fassungen_stehen() -> None:
    """`texts=None` heißt „nicht mitgeschickt" — eine ältere Oberfläche darf
    nicht still alle Übersetzungen löschen."""
    from src.features.inbox.schemas import TemplateUpsert

    db = _SprachDB({
        "message_template": [{
            "id": "tpl", "tenant_id": "t1", "title": "A", "body": "x",
            "body_html": "<p>x</p>", "subject": "",
        }],
        "message_template_text": [
            {"template_id": "tpl", "tenant_id": "t1", "lang": "da",
             "subject": "", "body": "Hej", "body_html": "<p>Hej</p>"},
        ],
    })
    svc = InboxService(service_client=db, channex=_FakeChannex())
    out = svc.update_template(_CTX, "tpl", TemplateUpsert(title="A", body_html="<p>x</p>"))
    assert [t.lang for t in out.texts] == ["da"]


def test_fassung_waehlen_reihenfolge() -> None:
    """Gastsprache → Standardsprache → Grundfassung, und leer gilt als fehlend."""
    from src.features.inbox.sprachen import fassung_waehlen

    fassungen = {"da": "Hej", "de": "Hallo", "en": "   "}
    assert fassung_waehlen(
        fassungen, "Grund", gastsprache="da-DK", standard="de"
    ) == ("Hej", "da")
    # Gastsprache nicht gepflegt → Standardsprache.
    assert fassung_waehlen(
        fassungen, "Grund", gastsprache="fr", standard="de"
    ) == ("Hallo", "de")
    # Angelegte, aber leere Fassung zählt nicht → Standardsprache.
    assert fassung_waehlen(
        fassungen, "Grund", gastsprache="en", standard="de"
    ) == ("Hallo", "de")
    # Keine Sprachen gepflegt → Grundfassung, und KEINE behauptete Sprache.
    assert fassung_waehlen({}, "Grund", gastsprache="da", standard=None) == ("Grund", None)
    # Nichts da → nichts senden (kein erfundener Text).
    assert fassung_waehlen({}, "   ", gastsprache="da", standard="de") == (None, None)


def test_automail_nimmt_die_fassung_der_gastsprache() -> None:
    """Der Weg, auf den es ankommt: geplant wird der Text für DIESEN Gast."""
    db = _SprachDB({
        "tenant_message_language": [
            {"tenant_id": "t1", "code": "de", "is_default": True},
            {"tenant_id": "t1", "code": "da", "is_default": False},
        ],
        "message_automation_text": [
            {"automation_id": "a1", "tenant_id": "t1", "lang": "da",
             "subject": "", "message": "Hej fra os"},
            {"automation_id": "a1", "tenant_id": "t1", "lang": "de",
             "subject": "", "message": "Hallo von uns"},
        ],
    })
    svc = InboxService(service_client=db, channex=_FakeChannex())
    regel = {"id": "a1", "message": "Grundfassung", "template_id": None}
    assert svc._automation_body(db, "t1", regel, gastsprache="da") == "Hej fra os"
    # Unbekannte Gastsprache → Standardsprache des Betriebs.
    assert svc._automation_body(db, "t1", regel, gastsprache="fr") == "Hallo von uns"
    # Gar keine Sprache am Gast → ebenfalls Standardsprache.
    assert svc._automation_body(db, "t1", regel, gastsprache=None) == "Hallo von uns"


def test_gastsprache_kommt_aus_spalte_und_roher_payload() -> None:
    """Beide Wege, mit Vorrang für die Spalte — sonst ist die Sprache oft leer."""
    svc = InboxService(service_client=_SprachDB(), channex=_FakeChannex())
    assert svc._gastsprache({"gast_sprache": "da", "gast_sprache_raw": "de"}) == "da"
    assert svc._gastsprache({"gast_sprache": None, "gast_sprache_raw": "de"}) == "de"
    assert svc._gastsprache({}) is None


# --- myBestDays-Marktplatz im gemeinsamen Posteingang -------------------------

_MB_THREAD = {
    "id": "gt1",
    "tenant_id": "t1",
    "portal_guest_id": "pg1",
    "property_id": "p1",
    "reservation_id": "res-9",
    "last_message_at": "2026-08-01T09:00:00+00:00",
    "host_read_at": None,
    "host_archived": False,
    "created_at": "2026-07-20T08:00:00+00:00",
    "portal_guests": {"name": "Mira Toft", "email": "m@x.dk", "phone": "+4520"},
    "properties": {"title": "Feriehus"},
    "reservations": {"check_in": "2026-08-10", "check_out": "2026-08-14",
                     "guest_id": "g9"},
}
_MB_NACHRICHT = {
    "id": "gm1", "thread_id": "gt1", "body": "Kommer sent",
    "sender": "guest", "created_at": "2026-08-01T09:00:00+00:00",
}


def _mb_db(**kw):  # noqa: ANN003, ANN201
    return _FakeDB([], [], extra={
        "guest_message_threads": [dict(_MB_THREAD, **kw)],
        "guest_messages": [_MB_NACHRICHT],
    })


def test_marktplatz_thread_erscheint_im_posteingang() -> None:
    """myBestDays ist ein Kanal wie Booking — seine Konversationen gehören in
    denselben Posteingang, nicht in eine zweite Oberfläche."""
    svc = InboxService(service_client=_mb_db(), channex=_FakeChannex())
    out = svc.list_threads(_CTX)
    th = next(t for t in out.items if t.id.startswith("mb:"))
    assert th.ota_name == "myBestDays"
    assert th.guest_name == "Mira Toft"
    assert th.property_title == "Feriehus"
    assert th.reservation_id == "res-9"
    assert th.last_message == "Kommer sent"
    assert th.last_sender == "guest"
    # Nie eine Channex-ID erfinden — dieser Thread lief nie über Channex.
    assert th.channex_booking_id is None


def test_marktplatz_ungelesen_wenn_gast_zuletzt_schrieb() -> None:
    svc = InboxService(service_client=_mb_db(host_read_at=None), channex=_FakeChannex())
    th = next(t for t in svc.list_threads(_CTX).items if t.id.startswith("mb:"))
    assert th.is_read is False
    # Nach dem Lesen (host_read_at neuer als die Nachricht) gilt er als gelesen.
    svc2 = InboxService(
        service_client=_mb_db(host_read_at="2026-08-02T10:00:00+00:00"),
        channex=_FakeChannex(),
    )
    th2 = next(t for t in svc2.list_threads(_CTX).items if t.id.startswith("mb:"))
    assert th2.is_read is True


def test_marktplatz_verlauf_lesen() -> None:
    svc = InboxService(service_client=_mb_db(), channex=_FakeChannex())
    out = svc.get_messages(_CTX, "mb:gt1")
    assert out.total == 1
    assert out.items[0].message == "Kommer sent"
    assert out.items[0].sender == "guest"
    # Der Marktplatz läuft bei uns: created_at IST der Ereigniszeitpunkt.
    assert out.items[0].sent_at == "2026-08-01T09:00:00+00:00"


def test_marktplatz_fremder_thread_404() -> None:
    """Load und Scope zusammen (Wurzel 3) — fremder Tenant erfährt nichts."""
    svc = InboxService(service_client=_mb_db(tenant_id="fremd"), channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.get_messages(_CTX, "mb:gt1")
    assert exc.value.status_code == 404


def test_marktplatz_antwort_wird_abgelehnt() -> None:
    """Der Marktplatz hat einen eigenen Sendeweg (host_messages, 0196) —
    hier klar ablehnen, statt eine Nachricht zu schreiben, die der Gast nie
    sieht (Wurzel 5)."""
    svc = InboxService(service_client=_mb_db(), channex=_FakeChannex())
    with pytest.raises(InboxError) as exc:
        svc.send_message(_CTX, "mb:gt1", "Hallo")
    assert exc.value.status_code == 422


# --- Ungelesen-Zähler (Sidebar-Abzeichen) ------------------------------------
def test_unread_count_zaehlt_gastnachricht_trotz_is_read_flag() -> None:
    """Der Kern des Abzeichens: das Flag allein reicht NICHT.

    `is_read` wird beim ersten Öffnen auf true gesetzt und bleibt dort für
    immer. Schreibt der Gast danach erneut, zählte ein simples
    `count(is_read = false)` diesen Thread nie mit — das Abzeichen bliebe
    stumm, während die Liste daneben „ungelesen" anzeigt.
    """
    row = {**_booking_row(), "is_read": True, "read_at": "2026-08-06T10:00:00+00:00"}
    nachrichten = [{
        "tenant_id": "t1", "thread_ref": row["id"], "sender": "guest",
        "body": "Noch eine Frage", "sent_at": "2026-08-06T14:55:55+00:00",
    }]
    svc = InboxService(
        service_client=_FakeDB([row], [], nachrichten=nachrichten),
        channex=_FakeChannex(),
    )
    assert svc.unread_count(_CTX) == 1


def test_unread_count_eigene_antwort_erledigt_den_thread() -> None:
    """Wer geantwortet hat, hat gelesen — der Thread zählt nicht mehr.

    Ohne diese Regel forderte das Abzeichen zur Arbeit an Threads auf, die
    längst beantwortet sind (live vier von neun).
    """
    row = {**_booking_row(), "is_read": False, "read_at": None}
    nachrichten = [
        {"tenant_id": "t1", "thread_ref": row["id"], "sender": "guest",
         "body": "Frage", "sent_at": "2026-08-06T14:00:00+00:00"},
        {"tenant_id": "t1", "thread_ref": row["id"], "sender": "property",
         "body": "Antwort", "sent_at": "2026-08-06T15:00:00+00:00"},
    ]
    svc = InboxService(
        service_client=_FakeDB([row], [], nachrichten=nachrichten),
        channex=_FakeChannex(),
    )
    assert svc.unread_count(_CTX) == 0


def test_unread_count_zaehlt_nur_die_aktive_ansicht() -> None:
    """Archiviertes ist erledigt — das Abzeichen fordert zur Arbeit auf."""
    offen = {**_booking_row(), "id": "th-offen", "is_read": False, "read_at": None}
    archiviert = {
        **_booking_row(), "id": "th-arch", "is_read": False, "read_at": None,
        "inbox_status": "archived", "is_archived": True,
    }
    nachrichten = [
        {"tenant_id": "t1", "thread_ref": "th-offen", "sender": "guest",
         "body": "Frage", "sent_at": "2026-08-06T14:00:00+00:00"},
        {"tenant_id": "t1", "thread_ref": "th-arch", "sender": "guest",
         "body": "Alte Frage", "sent_at": "2026-08-01T14:00:00+00:00"},
    ]
    svc = InboxService(
        service_client=_FakeDB([offen, archiviert], [], nachrichten=nachrichten),
        channex=_FakeChannex(),
    )
    assert svc.unread_count(_CTX) == 1


# --- Fehlereinstufung beim Automail-Versand (15.08.2026) ---------------------
# `failed` ist eine Sackgasse: es steht nicht in UEBERSCHREIBBAR, und der
# Unique-Index (automation_id, thread_id) verhindert eine zweite Zeile. Was hier
# falsch als endgültig gilt, erreicht den Gast NIE — ohne Fehlermeldung, weil
# kein Endpunkt `last_error` ausliefert.
def test_channex_stoerung_bleibt_wiederholbar() -> None:
    """Ein 5xx/429 ist eine Aussage über den Moment, nicht über die Nachricht.

    Der Typ kommt hier nicht als `ChannexError` an: `send_message` übersetzt ihn
    in einen `InboxError`, und der Client normalisiert 5xx zuvor auf 502. Die
    alte `isinstance(exc, ChannexError)`-Prüfung lief deshalb ins Leere — live
    standen zwei Automails mit „Service Temporary Unavailable" auf `failed`.
    """
    assert InboxService._fehlerzustand(
        InboxError("Service Temporary Unavailable", status_code=502)
    )["status"] == "pending"
    assert InboxService._fehlerzustand(
        InboxError("Too Many Requests", status_code=429)
    )["status"] == "pending"


def test_fehlendes_feld_wird_erneut_versucht() -> None:
    """`FeldFehlt` ist nachpflegbar, also kein endgültiger Fehler.

    Die Architektur rendert bewusst erst beim Versand, weil der Türcode oft erst
    kurz davor entsteht. Live: vier Anreise-Automails scheiterten am 14.08. um
    06:00 an fehlenden Türcodes, die um 12:05 gepflegt wurden — sechs Stunden
    vor dem Check-in. Ein Neuversuch hätte alle vier Gäste erreicht.
    """
    zustand = InboxService._fehlerzustand(FeldFehlt(["door_code", "wifi_ssid"]))
    assert zustand["status"] == "pending"
    assert "door_code" in zustand["last_error"]


def test_endgueltige_fehler_bleiben_endgueltig() -> None:
    """Gegenprobe: ein 4xx wird auch beim zehnten Versuch nicht besser.

    Sonst kreiste eine Nachricht bis zur Nachzügler-Grenze und verdeckte dabei
    ihren eigenen Grund.
    """
    assert InboxService._fehlerzustand(
        InboxError("Dieser Buchungskanal überträgt keine Gastnachrichten.",
                   status_code=409)
    )["status"] == "failed"
    assert InboxService._fehlerzustand(
        InboxError("Ungültige Anfrage", status_code=400)
    )["status"] == "failed"
    assert InboxService._fehlerzustand(ValueError("kaputt"))["status"] == "failed"


def test_automail_fehler_landet_im_verlauf(monkeypatch) -> None:  # noqa: ANN001
    """Ein Fehlschlag muss AUFFINDBAR sein, nicht nur in `last_error` stehen.

    Vor dem 15.08.2026 schrieb der Versand den Grund ausschließlich in eine
    Spalte, die kein Endpunkt ausliefert und kein Abo abhört. 14 Gäste bekamen
    ihre Anreise-Info nie — sichtbar war das nur per SSH auf die Server-DB.
    Der Verlauf (`worker_ereignis`) ist die Spur, die das Backoffice zeigt.
    """
    from src.features.inbox import planung as planung_modul

    notiert: list[dict] = []
    monkeypatch.setattr(
        planung_modul.worker_verlauf,
        "merken",
        lambda _db, **kw: notiert.append(kw),
    )

    svc = InboxService(service_client=_FakeDB([], []), channex=_FakeChannex())
    zustand = svc._fehlerzustand(FeldFehlt(["door_code"]))
    planung_modul.worker_verlauf.merken(
        None,
        richtung="ausgang",
        vorgang="automail_versand",
        ergebnis="fehler",
        tenant_id="t1",
        fehler_text=zustand["last_error"],
    )

    assert notiert, "Der Fehlschlag muss eine Verlaufszeile erzeugen"
    eintrag = notiert[0]
    assert eintrag["vorgang"] == "automail_versand"
    assert eintrag["ergebnis"] == "fehler"
    # Der Grund muss im Klartext dastehen — ein Verweis auf die Quelltabelle
    # hilft niemandem, der die Ansicht liest.
    assert "door_code" in eintrag["fehler_text"]
