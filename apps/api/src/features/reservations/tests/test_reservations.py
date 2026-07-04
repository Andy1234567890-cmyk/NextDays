"""Tests für den reservations-Slice (Anlegen + Double-Booking-Schutz)."""
from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.reservations.schemas import (
    GuestContact,
    ReservationChannel,
    ReservationCreate,
)
from src.features.reservations.service import ReservationError, ReservationsService
from src.main import create_app

client = TestClient(create_app())


# --- Health (Smoke) ---

def test_reservations_health() -> None:
    resp = client.get("/api/v1/reservations/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "reservations", "status": "ok"}


# --- Schema-Validierung ---

def test_create_rejects_inverted_dates() -> None:
    with pytest.raises(ValueError):
        ReservationCreate(
            property_id="p1",
            check_in=date(2026, 5, 10),
            check_out=date(2026, 5, 10),
        )


# --- Service: Tenant-Pflicht ---

def test_create_requires_tenant() -> None:
    service = ReservationsService(service_client=MagicMock())
    req = ReservationCreate(
        property_id="p1",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id=None), req)
    assert exc.value.status_code == 400


# --- Service: Double-Booking-Schutz ---

def _service_for_create(
    *,
    property_found: bool,
    taken_days: list[dict[str, str]],
    stopped_days: list[dict[str, str]] | None = None,
) -> ReservationsService:
    """Mockt die im create() benutzten Tabellen-Ketten.

    properties.select…limit → {data: [...]}, availability.select…lt → taken_days,
    stop_sell.select…lt → stopped_days (Stop-Sell-Guard).
    """
    db = MagicMock(name="supabase")

    def table(name: str) -> MagicMock:
        t = MagicMock(name=f"table:{name}")
        if name == "properties":
            chain = (
                t.select.return_value.eq.return_value.eq.return_value.limit.return_value
            )
            chain.execute.return_value.data = (
                [{"id": "p1"}] if property_found else []
            )
        elif name == "rate_plans":
            chain = t.select.return_value.eq.return_value.limit.return_value
            chain.execute.return_value.data = [{"currency": "EUR"}]
        elif name == "availability":
            chain = (
                t.select.return_value.eq.return_value.gte.return_value.lt.return_value
            )
            chain.execute.return_value.data = taken_days
        elif name == "stop_sell":
            chain = (
                t.select.return_value.eq.return_value.gte.return_value.lt.return_value
            )
            chain.execute.return_value.data = stopped_days or []
        return t

    db.table.side_effect = table
    return ReservationsService(service_client=db)


def test_create_rejects_when_days_taken() -> None:
    service = _service_for_create(
        property_found=True,
        taken_days=[{"date": "2026-05-01", "status": "booked"}],
    )
    req = ReservationCreate(
        property_id="p1",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 409


def test_create_rejects_stop_sell_days() -> None:
    # Ein von Mitarbeitern gesetzter Stop-Sell sperrt den Tag auf ALLEN Kanälen
    # — auch die interne Rezeptions-Buchung (409).
    service = _service_for_create(
        property_found=True,
        taken_days=[],  # availability frei
        stopped_days=[{"date": "2026-05-01"}],  # aber Stop-Sell gesetzt
    )
    req = ReservationCreate(
        property_id="p1",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 409
    assert "Stop-Sell" in exc.value.message


def test_create_rejects_unknown_property() -> None:
    service = _service_for_create(property_found=False, taken_days=[])
    req = ReservationCreate(
        property_id="nope",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 404


def test_guest_contact_defaults_empty() -> None:
    c = GuestContact()
    assert c.first_name == "" and c.email == ""


def test_channel_enum_values() -> None:
    assert ReservationChannel.airbnb.value == "airbnb"


# --- Service: Dashboard ---

# Volle Berechtigungen (Name, Kontakt, Quelle, Beträge sichtbar).
_FULL_PERMS = [
    "view_guest_name", "view_guest_contact", "view_booking_source",
    "pm_booking_total",
]
# Maskiert (owner/staff/cleaner): keine Gast-Berechtigungen.
_NO_PERMS: list[str] = []


def _dashboard_db(
    reservations: list[dict], properties: list[dict],
    *, user_role: str = "admin", user_perms: list[str] | None = None,
) -> MagicMock:
    """Mockt die im dashboard() benutzten Ketten (reservations + properties + users)."""
    db = MagicMock(name="supabase")

    def table(name: str) -> MagicMock:
        t = MagicMock(name=f"table:{name}")
        if name == "reservations":
            chain = t.select.return_value.eq.return_value
            chain.execute.return_value.data = reservations
        elif name == "properties":
            chain = t.select.return_value.eq.return_value.in_.return_value
            chain.execute.return_value.data = properties
        elif name == "users":
            chain = t.select.return_value.eq.return_value.limit.return_value
            perms = _FULL_PERMS if user_perms is None else user_perms
            chain.execute.return_value.data = [
                {"role": user_role, "permissions": perms}
            ]
        return t

    db.table.side_effect = table
    return ReservationsService(service_client=db)


def test_dashboard_buckets_and_kpis() -> None:
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        # heutiger Check-out
        {"id": "r1", "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=3)), "check_out": iso(today),
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
        # heutiger Check-in
        {"id": "r2", "property_id": "p1", "channel": "airbnb", "status": "confirmed",
         "check_in": iso(today), "check_out": iso(today + timedelta(days=2)),
         "total_amount": 200, "guests": {"name": "Bea"}},
        # anstehend
        {"id": "r3", "property_id": "p2", "channel": "direct", "status": "pending",
         "check_in": iso(today + timedelta(days=5)), "check_out": iso(today + timedelta(days=7)),
         "total_amount": 150, "guests": {"name": "Cem"}},
        # storniert → fällt überall raus
        {"id": "r4", "property_id": "p1", "channel": "booking", "status": "cancelled",
         "check_in": iso(today), "check_out": iso(today + timedelta(days=1)),
         "total_amount": 999, "guests": {"name": "X"}},
    ]
    properties = [
        {"id": "p1", "title": "Strandhaus", "currency": "EUR"},
        {"id": "p2", "title": "City Loft", "currency": "EUR"},
    ]
    svc = _dashboard_db(reservations, properties)
    out = svc.dashboard(AuthContext(user_id="u1", tenant_id="t1", role="admin"))

    assert [e.reservation_id for e in out.checkouts_today] == ["r1"]
    assert [e.reservation_id for e in out.checkins_today] == ["r2"]
    assert [e.reservation_id for e in out.upcoming] == ["r3"]
    assert out.checkouts_today[0].property_title == "Strandhaus"
    # admin (VIEW_GUEST_FULL): voller Name
    assert out.checkouts_today[0].guest_name == "Anna"
    # 3 aktive Check-ins in den letzten 30 Tagen (r1,r2 liegen drin; r3 in Zukunft)
    assert out.checkins_30d.value == 2
    assert out.revenue_30d.value == 500  # r1+r2; storno raus, zukünftiges raus
    assert out.confirmed_30d.value == 2
    # keine Vorperiode → ehrlich None statt erfundener 0 %
    assert out.checkins_30d.change_pct is None
    assert out.currency == "EUR"


# --- DSGVO-Daten-Split (§4): Maskierung je Rolle -----------------------------

def _list_db(
    reservations: list[dict], *, user_role: str = "admin",
    user_perms: list[str] | None = None,
) -> ReservationsService:
    """Mockt die in list() benutzten Ketten (reservations mit guests-Join + users)."""
    db = MagicMock(name="supabase")

    def table(name: str) -> MagicMock:
        t = MagicMock(name=f"table:{name}")
        if name == "users":
            chain = t.select.return_value.eq.return_value.limit.return_value
            perms = _FULL_PERMS if user_perms is None else user_perms
            chain.execute.return_value.data = [
                {"role": user_role, "permissions": perms}
            ]
        else:
            chain = t.select.return_value.eq.return_value.order.return_value
            chain.execute.return_value.data = reservations
        return t

    db.table.side_effect = table
    return ReservationsService(service_client=db)


_GUEST_ROW = {
    "id": "r1", "property_id": "p1", "guest_id": "g1", "channel": "booking",
    "check_in": "2026-07-01", "check_out": "2026-07-03", "status": "confirmed",
    "total_amount": 250, "currency": "EUR", "ota_name": "Booking.com",
    "guests": {"name": "Anna Müller"},
}


def test_list_admin_sees_full_name_and_amount() -> None:
    # admin: effective_permissions = ALLE → voller Zugriff (perms egal).
    svc = _list_db([dict(_GUEST_ROW)], user_role="admin", user_perms=_NO_PERMS)
    out = svc.list(AuthContext(user_id="u", tenant_id="t1", role="admin"))
    r = out.items[0]
    assert r.guest_name == "Anna Müller"
    assert r.total_amount == 250.0
    assert r.currency == "EUR"
    assert r.ota_name == "Booking.com"


def test_list_co_admin_with_full_perms() -> None:
    svc = _list_db([dict(_GUEST_ROW)], user_role="co_admin", user_perms=_FULL_PERMS)
    out = svc.list(AuthContext(user_id="u", tenant_id="t1", role="co_admin"))
    r = out.items[0]
    assert r.guest_name == "Anna Müller"
    assert r.total_amount == 250.0


def test_list_owner_sees_only_first_name_no_amount() -> None:
    svc = _list_db([dict(_GUEST_ROW)], user_role="owner", user_perms=_NO_PERMS)
    out = svc.list(AuthContext(user_id="u", tenant_id="t1", role="owner"))
    r = out.items[0]
    assert r.guest_name == "Anna"          # nur Vorname (kein view_guest_name)
    assert r.total_amount is None          # kein Betrag (HIDE_PRICES nicht nötig: …)
    assert r.currency == ""
    assert r.ota_name is None              # keine Quelle (kein view_booking_source)


def test_list_staff_with_hide_prices_overrides_total() -> None:
    # staff mit view_guest_name + pm_booking_total, aber hide_prices →
    # Name voll, Betrag trotz Betrags-Berechtigung weg (hide_prices überstimmt).
    perms = ["view_guest_name", "pm_booking_total", "hide_prices"]
    svc = _list_db([dict(_GUEST_ROW)], user_role="staff", user_perms=perms)
    out = svc.list(AuthContext(user_id="u", tenant_id="t1", role="staff"))
    r = out.items[0]
    assert r.guest_name == "Anna Müller"   # view_guest_name → voller Name
    assert r.total_amount is None          # hide_prices → kein Betrag


def test_list_unknown_role_fails_closed() -> None:
    # Unbekannte/fehlende Rolle ohne Berechtigungen → fail-closed.
    svc = _list_db([dict(_GUEST_ROW)], user_role="cleaner", user_perms=_NO_PERMS)
    out = svc.list(AuthContext(user_id="u", tenant_id="t1", role=None))
    r = out.items[0]
    assert r.guest_name == "Anna"
    assert r.total_amount is None


# --- move/resize: Verschieben + Doppelbuchungs-Schutz ------------------------

from src.features.reservations.schemas import ReservationMove  # noqa: E402


class _MoveQuery:
    """Stateful Query-Stub: Filter werden auf die Tabellenzeilen angewandt;
    upsert/update mutieren den Store (deckt die move()-Ketten ab)."""

    def __init__(self, store: dict, name: str) -> None:
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._neq: dict = {}
        self._is_null: list = []
        self._gte: str | None = None
        self._lt: str | None = None

    def select(self, *_a, **_k) -> "_MoveQuery":
        return self

    def eq(self, col, val) -> "_MoveQuery":  # noqa: ANN001
        self._eq[col] = val
        return self

    def neq(self, col, val) -> "_MoveQuery":  # noqa: ANN001
        self._neq[col] = val
        return self

    def is_(self, col, val) -> "_MoveQuery":  # noqa: ANN001
        # PostgREST: is_("col", "null") — hier nur der Null-Fall (detail()-
        # Rechnungs-Query, 0092).
        if val == "null":
            self._is_null.append(col)
        return self

    def gte(self, _col, val) -> "_MoveQuery":  # noqa: ANN001
        self._gte = val
        return self

    def lt(self, _col, val) -> "_MoveQuery":  # noqa: ANN001
        self._lt = val
        return self

    def order(self, *_a, **_k) -> "_MoveQuery":
        return self

    def limit(self, *_a, **_k) -> "_MoveQuery":
        return self

    def _match(self, r: dict) -> bool:
        for c, v in self._eq.items():
            if r.get(c) != v:
                return False
        for c, v in self._neq.items():
            if r.get(c) == v:
                return False
        for c in self._is_null:
            if r.get(c) is not None:
                return False
        if self._gte is not None and r.get("date", "") < self._gte:
            return False
        if self._lt is not None and r.get("date", "") >= self._lt:
            return False
        return True

    def upsert(self, payload, **_k) -> "_MoveQuery":  # noqa: ANN001
        rows = payload if isinstance(payload, list) else [payload]
        table = self._store.setdefault(self._name, [])
        for row in rows:
            for i, ex in enumerate(table):
                if ex.get("property_id") == row.get("property_id") and ex.get(
                    "date"
                ) == row.get("date"):
                    table[i] = {**ex, **row}
                    break
            else:
                table.append(dict(row))
        return self

    def update(self, payload) -> "_MoveQuery":  # noqa: ANN001
        self._pending_update = payload
        return self

    def insert(self, payload) -> "_MoveQuery":  # noqa: ANN001
        self._pending_insert = payload
        return self

    def execute(self) -> MagicMock:
        if getattr(self, "_pending_insert", None) is not None:
            row = dict(self._pending_insert)
            row.setdefault("id", f"{self._name}-{len(self._store.get(self._name, [])) + 1}")
            self._store.setdefault(self._name, []).append(row)
            res = MagicMock()
            res.data = [row]
            return res
        rows = [r for r in self._store.get(self._name, []) if self._match(r)]
        if getattr(self, "_pending_update", None) is not None:
            for r in rows:
                r.update(self._pending_update)
        res = MagicMock()
        res.data = rows
        return res


def _move_db(store: dict) -> ReservationsService:
    db = MagicMock(name="supabase")
    db.table.side_effect = lambda name: _MoveQuery(store, name)
    return ReservationsService(service_client=db)


def _move_store(*, check_in: str, check_out: str, status: str = "confirmed") -> dict:
    return {
        "users": [{"id": "u", "role": "admin", "permissions": _FULL_PERMS}],
        "properties": [
            {"id": "p1", "tenant_id": "t1", "title": "Apartment 1"},
            {"id": "p2", "tenant_id": "t1", "title": "Apartment 2"},
        ],
        "reservations": [
            {
                "id": "r1", "tenant_id": "t1", "property_id": "p1", "guest_id": "g1",
                "channel": "booking", "check_in": check_in, "check_out": check_out,
                "status": status, "total_amount": 200, "currency": "EUR",
                "ota_name": "Booking.com", "guests": {"name": "Anna"},
            }
        ],
        "availability": [
            {"property_id": "p1", "date": "2026-07-01", "status": "booked",
             "source": "booking"},
            {"property_id": "p1", "date": "2026-07-02", "status": "booked",
             "source": "booking"},
        ],
    }


def test_move_to_other_property_and_dates() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    out = svc.move(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        "r1",
        ReservationMove(
            property_id="p2", check_in=date(2026, 7, 10), check_out=date(2026, 7, 12)
        ),
    )
    assert out.property_id == "p2"
    assert str(out.check_in) == "2026-07-10"
    # Alte Tage freigegeben, neue belegt.
    avail = {(a["property_id"], a["date"]): a["status"] for a in store["availability"]}
    assert avail[("p1", "2026-07-01")] == "open"
    assert avail[("p2", "2026-07-10")] == "booked"


def test_resize_in_place_ignores_own_days() -> None:
    # Verlängern am selben Objekt: die eigenen belegten Tage zählen NICHT als
    # Konflikt; ein zusätzlicher freier Tag wird belegt.
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    out = svc.move(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        "r1",
        ReservationMove(
            property_id="p1", check_in=date(2026, 7, 1), check_out=date(2026, 7, 4)
        ),
    )
    assert str(out.check_out) == "2026-07-04"
    avail = {(a["property_id"], a["date"]): a["status"] for a in store["availability"]}
    assert avail[("p1", "2026-07-03")] == "booked"


def test_move_rejects_conflict_with_foreign_booking() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    # Fremdbelegung am Zielobjekt p2.
    store["availability"].append(
        {"property_id": "p2", "date": "2026-07-10", "status": "booked",
         "source": "airbnb"}
    )
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.move(
            AuthContext(user_id="u", tenant_id="t1", role="admin"),
            "r1",
            ReservationMove(
                property_id="p2", check_in=date(2026, 7, 10),
                check_out=date(2026, 7, 12),
            ),
        )
    assert exc.value.status_code == 409


def test_move_rejects_cancelled() -> None:
    store = _move_store(
        check_in="2026-07-01", check_out="2026-07-03", status="cancelled"
    )
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.move(
            AuthContext(user_id="u", tenant_id="t1", role="admin"),
            "r1",
            ReservationMove(
                property_id="p1", check_in=date(2026, 7, 5), check_out=date(2026, 7, 7)
            ),
        )
    assert exc.value.status_code == 409


def test_move_unknown_reservation_404() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.move(
            AuthContext(user_id="u", tenant_id="t1", role="admin"),
            "does-not-exist",
            ReservationMove(
                property_id="p1", check_in=date(2026, 7, 5), check_out=date(2026, 7, 7)
            ),
        )
    assert exc.value.status_code == 404


# --- detail: vollständige Detailansicht + Maskierung -------------------------

def test_detail_admin_sees_full_amounts_and_quote() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0].update({
        "total_amount": 400, "paid_amount": 100,
        "quote_items": [
            {"label": "Room rate", "amount": 300},
            {"label": "Reinigung", "amount": 100},
        ],
        "num_guests": 4, "adults": 4, "guest_email": "a@x.de",
        "checkin_time": "16:00", "checkout_time": "10:00",
    })
    svc = _move_db(store)
    d = svc.detail(AuthContext(user_id="u", tenant_id="t1", role="admin"), "r1")
    assert d.nights == 2
    assert d.num_guests == 4
    assert d.total_amount == 400
    assert d.due_amount == 300  # total - paid
    assert [q.label for q in d.quote_items] == ["Room rate", "Reinigung"]
    assert d.guest_email == "a@x.de"
    assert d.checkin_time == "16:00"


def test_detail_masks_amounts_and_contact_without_permission() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["users"] = [{"id": "u", "role": "cleaner", "permissions": _NO_PERMS}]
    store["reservations"][0].update({
        "total_amount": 400, "paid_amount": 100,
        "quote_items": [{"label": "Room rate", "amount": 300}],
        "guest_email": "a@x.de",
    })
    svc = _move_db(store)
    d = svc.detail(AuthContext(user_id="u", tenant_id="t1", role=None), "r1")
    assert d.total_amount is None
    assert d.due_amount is None
    assert d.quote_items == []
    assert d.guest_email is None


def test_detail_unknown_404() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.detail(AuthContext(user_id="u", tenant_id="t1", role="admin"), "nope")
    assert exc.value.status_code == 404


# --- Storno (mit Pflicht-Begründung + Audit) ---------------------------------

_CANCEL_CTX = AuthContext(user_id="u", tenant_id="t1", role="admin")


def test_cancel_sets_status_frees_days_and_audits() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    out = svc.cancel(_CANCEL_CTX, "r1", "Gast hat abgesagt")
    assert out.status == "cancelled"
    # Reservierungs-Storno-Felder gesetzt.
    r = next(x for x in store["reservations"] if x["id"] == "r1")
    assert r["status"] == "cancelled"
    assert r["cancel_reason"] == "Gast hat abgesagt"
    assert r["cancelled_by"] == "u"
    assert r["cancelled_at"]
    # Belegte Tage freigegeben.
    avail = {(a["property_id"], a["date"]): a["status"] for a in store["availability"]}
    assert avail[("p1", "2026-07-01")] == "open"
    assert avail[("p1", "2026-07-02")] == "open"
    # Audit-Zeile geschrieben (mit Kanal/OTA dokumentiert).
    log_rows = store.get("reservation_cancellation_log", [])
    assert len(log_rows) == 1
    assert log_rows[0]["reason"] == "Gast hat abgesagt"
    assert log_rows[0]["by_user_id"] == "u"
    assert log_rows[0]["channel"] == "booking"
    assert log_rows[0]["ota_name"] == "Booking.com"


def test_cancel_requires_reason() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.cancel(_CANCEL_CTX, "r1", "   ")
    assert exc.value.status_code == 422
    # Nichts storniert, keine Audit-Zeile.
    assert store["reservations"][0]["status"] == "confirmed"
    assert not store.get("reservation_cancellation_log")


def test_cancel_already_cancelled_409() -> None:
    store = _move_store(
        check_in="2026-07-01", check_out="2026-07-03", status="cancelled"
    )
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.cancel(_CANCEL_CTX, "r1", "nochmal")
    assert exc.value.status_code == 409


def test_cancel_unknown_404() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.cancel(_CANCEL_CTX, "nope", "Grund")
    assert exc.value.status_code == 404


def test_cancel_direct_booking_also_frees_days() -> None:
    # Direktbuchung (eigene Plattform/Wizard): channel=direct, kein OTA.
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0]["channel"] = "direct"
    store["reservations"][0]["ota_name"] = None
    for a in store["availability"]:
        a["source"] = "direct"
    svc = _move_db(store)
    out = svc.cancel(_CANCEL_CTX, "r1", "Storno Direktbuchung")
    assert out.status == "cancelled"
    log_rows = store.get("reservation_cancellation_log", [])
    assert log_rows[0]["channel"] == "direct"
    assert log_rows[0]["ota_name"] is None
