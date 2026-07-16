"""Tests für den calendar-Slice (Herzstück: Double-Booking-Schutz)."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.calendar.schemas import (
    AvailabilityStatus,
    BlockRequest,
    DateRange,
    PriceOverrideRequest,
    RestrictionRow,
    RestrictionRowsRequest,
    StopSellListResponse,
)
from src.features.calendar.service import CalendarError, CalendarService
from src.main import create_app

client = TestClient(create_app())


def _ctx(role: str = "admin", tenant: str | None = "t1") -> AuthContext:
    return AuthContext(user_id="u1", tenant_id=tenant, role=role)


# --- Health (Smoke) ---

def test_calendar_health() -> None:
    resp = client.get("/api/v1/calendar/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "calendar", "status": "ok"}


# --- DateRange ---

def test_daterange_rejects_inverted() -> None:
    with pytest.raises(ValueError):
        DateRange(start=date(2026, 5, 10), end=date(2026, 5, 10))


def test_daterange_nights_excludes_checkout() -> None:
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4))
    assert rng.nights() == [date(2026, 5, 1), date(2026, 5, 2), date(2026, 5, 3)]


# --- In-Memory-Fake-DB (tabellenbewusst; deckt die genutzten Query-Ketten ab) -

class _Res:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    """Minimaler Supabase-Query-Stub: Filter werden ignoriert, execute liefert
    die für die Tabelle hinterlegten Zeilen (bzw. zeichnet upserts auf)."""

    def __init__(self, store: dict, name: str) -> None:
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._in: tuple | None = None
        self._op = "select"

    def select(self, *_a, **_k) -> "_Query":
        return self

    def eq(self, col, val) -> "_Query":  # noqa: ANN001
        self._eq[col] = val
        return self

    def in_(self, col, vals) -> "_Query":  # noqa: ANN001
        self._in = (col, list(vals))
        return self

    def gte(self, *_a, **_k) -> "_Query":
        return self

    def lt(self, *_a, **_k) -> "_Query":
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    def order(self, *_a, **_k) -> "_Query":
        return self

    def limit(self, *_a, **_k) -> "_Query":
        return self

    @property
    def not_(self) -> "_Query":
        return self

    def is_(self, *_a, **_k) -> "_Query":
        return self

    def update(self, payload) -> "_Query":  # noqa: ANN001
        self._store.setdefault("_updates", []).append((self._name, payload))
        return self

    def upsert(self, payload, **_k) -> "_Query":  # noqa: ANN001
        self._store.setdefault("_upserts", []).append((self._name, payload))
        return self

    def execute(self) -> _Res:
        if self._op == "delete":
            self._store.setdefault("_deletes", []).append(self._name)
            # Delete-Filter (source) mitschreiben, damit Tests die Unterscheidung
            # manuell vs. auch-Portal prüfen können.
            self._store.setdefault("_delete_filters", []).append(
                (self._name, dict(self._eq))
            )
            return _Res([])
        rows = list(self._store.get(self._name, []))
        # in_-Filter unterstützen (properties-Tenant-Lookup im bulk_edit).
        if self._in is not None:
            col, vals = self._in
            rows = [r for r in rows if r.get(col) in vals]
        return _Res(rows)


class _FakeDB:
    def __init__(self, store: dict) -> None:
        self._store = store

    def table(self, name: str) -> _Query:
        return _Query(self._store, name)


def _service(**tables: list[dict]) -> tuple[CalendarService, dict]:
    store: dict = dict(tables)
    return CalendarService(client=_FakeDB(store)), store


# --- get_availability: fehlende Tage = offen ---

def test_missing_days_are_open() -> None:
    svc, _ = _service(properties=[{"id": "p1"}])
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    days = svc.get_availability(_ctx(), "p1", rng)
    assert [d.status for d in days] == [
        AvailabilityStatus.open,
        AvailabilityStatus.open,
    ]


# --- get_availability: Preis (Override > Basispreis) + Min-Stay ---

def test_availability_price_override_beats_base_price() -> None:
    svc, _ = _service(
        properties=[{"id": "p1"}],
        rate_plans=[{"base_price": 100.0, "min_stay": 2}],
        price_overrides=[{"date": "2026-05-02", "price": 150.0}],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    days = svc.get_availability(_ctx(), "p1", rng)
    # Tag 1 ohne Override → Basispreis; Tag 2 mit Override.
    assert days[0].price == 100.0
    assert days[1].price == 150.0
    assert all(d.min_stay == 2 for d in days)


def test_availability_no_rate_plan_keeps_price_none() -> None:
    svc, _ = _service(properties=[{"id": "p1"}])  # kein Rate-Plan → kein erfundener Preis
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    days = svc.get_availability(_ctx(), "p1", rng)
    assert days[0].price is None
    assert days[0].min_stay is None


# --- get_availability: fremdes Objekt → 404 (Tenant-Scope) ---

def test_availability_rejects_foreign_property() -> None:
    svc, _ = _service()  # keine eigene property im Store → Gate wirft 404
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    with pytest.raises(CalendarError) as exc:
        svc.get_availability(_ctx(), "p-fremd", rng)
    assert exc.value.status_code == 404


# --- check_availability: Double-Booking erkannt ---

def test_check_detects_conflict() -> None:
    svc, _ = _service(
        properties=[{"id": "p1"}],
        availability=[{"date": "2026-05-02", "status": "booked", "source": "booking"}],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    res = svc.check_availability(_ctx(), "p1", rng)
    assert res.available is False
    assert res.conflicting_days == [date(2026, 5, 2)]


def test_check_all_open_is_available() -> None:
    svc, _ = _service(properties=[{"id": "p1"}])
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 5))
    res = svc.check_availability(_ctx(), "p1", rng)
    assert res.available is True
    assert res.conflicting_days == []


# --- block: gebuchte Tage NICHT überschreiben ---

def test_block_rejects_when_booked() -> None:
    svc, _ = _service(
        properties=[{"id": "p1"}],
        availability=[{"date": "2026-05-02", "status": "booked", "source": "airbnb"}],
    )
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
    )
    with pytest.raises(CalendarError) as exc:
        svc.block("t1", req)
    assert exc.value.status_code == 409


def test_block_open_days_upserts() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4)),
    )
    count = svc.block("t1", req)
    assert count == 3
    upserts = [u for u in store.get("_upserts", []) if u[0] == "availability"]
    assert len(upserts) == 1
    payload = upserts[0][1]
    assert len(payload) == 3
    assert all(p["status"] == "blocked" for p in payload)


# --- price override: setzen und zurücknehmen ---

def test_price_override_set_and_clear() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    svc.set_price_override(
        "t1", PriceOverrideRequest(property_id="p1", date=date(2026, 5, 1), price=120)
    )
    svc.set_price_override(
        "t1", PriceOverrideRequest(property_id="p1", date=date(2026, 5, 1), price=None)
    )
    overrides = [u for u in store.get("_upserts", []) if u[0] == "price_overrides"]
    assert len(overrides) == 2


# --- bulk_edit: mehrere Objekte × Zeitraum ---

def test_bulk_edit_applies_price_and_block_across_properties() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    svc, store = _service(
        properties=[{"id": "p1"}, {"id": "p2"}],
    )
    res = svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1", "p2"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4)),
            price=99.0,
            block=True,
        ),
    )
    assert res.properties == 2
    assert res.days == 3
    assert set(res.applied) == {"price", "block"}
    # price_overrides + availability-Upserts wurden je Objekt geschrieben.
    upsert_tables = [u[0] for u in store.get("_upserts", [])]
    assert upsert_tables.count("availability") == 2  # block je Objekt
    assert upsert_tables.count("price_overrides") == 2


def test_bulk_edit_min_stay_updates_rate_plans() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    svc, store = _service(properties=[{"id": "p1"}])
    svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
            min_stay=3,
        ),
    )
    updates = [u for u in store.get("_updates", []) if u[0] == "rate_plans"]
    assert updates and updates[0][1] == {"min_stay": 3}


def test_bulk_edit_combined_action_is_single_channex_push(monkeypatch) -> None:
    # Zertifizierung Test 8: Preis + Min-Stay + CTA/CTD in EINER Bulk-Aktion
    # ergeben EINEN kombinierten ARI-Job (kind=restrictions, alle Felder).
    from src.features.calendar import service as cal_service
    from src.features.calendar.schemas import BulkEditRequest

    calls: list[tuple[str, dict]] = []
    monkeypatch.setattr(
        cal_service, "try_enqueue_ari",
        lambda _db, _tenant, _pid, kind, fields: calls.append((kind, fields)),
    )
    svc, _ = _service(properties=[{"id": "p1", "tenant_id": "t1"}])
    svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 12, 1), end=date(2027, 5, 1)),
            price=432.0, min_stay=2,
            closed_to_arrival=False, closed_to_departure=False,
        ),
    )
    assert len(calls) == 1
    kind, fields = calls[0]
    assert kind == "restrictions"
    assert fields["rate_cents"] == 43200
    assert fields["min_stay"] == 2
    assert fields["closed_to_arrival"] is False
    assert fields["closed_to_departure"] is False


def test_bulk_edit_price_plus_minstay_without_ctactd_single_push(
    monkeypatch,
) -> None:
    # Test 8, Zeile 2: nur Preis + Min-Stay → EIN Rate-Push mit beiden Feldern.
    from src.features.calendar import service as cal_service
    from src.features.calendar.schemas import BulkEditRequest

    calls: list[tuple[str, dict]] = []
    monkeypatch.setattr(
        cal_service, "try_enqueue_ari",
        lambda _db, _tenant, _pid, kind, fields: calls.append((kind, fields)),
    )
    svc, _ = _service(properties=[{"id": "p1", "tenant_id": "t1"}])
    svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 12, 1), end=date(2027, 5, 1)),
            price=342.0, min_stay=3,
        ),
    )
    assert len(calls) == 1
    kind, fields = calls[0]
    assert kind == "rate"
    assert fields["rate_cents"] == 34200
    assert fields["min_stay"] == 3


def test_bulk_edit_rejects_foreign_property() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    svc, _ = _service(properties=[{"id": "p1"}])  # p2 gehört nicht dem Tenant
    with pytest.raises(CalendarError) as exc:
        svc.bulk_edit(
            "t1",
            BulkEditRequest(
                property_ids=["p1", "p2"],
                range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
                price=50.0,
            ),
        )
    assert exc.value.status_code == 404


def test_bulk_edit_requires_a_change() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    with pytest.raises(ValueError):
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
        )


# --- Teil A: Bulk-Preisanpassung in Prozent ---

def test_bulk_edit_price_pct_increase_writes_overrides() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    # Basispreis 100 → +10 % = 110.0 je Tag, als Override geschrieben.
    svc, store = _service(
        properties=[{"id": "p1"}],
        rate_plans=[{"base_price": 100.0, "min_stay": 1}],
    )
    res = svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
            price_adjust_pct=10,
        ),
    )
    assert res.applied == ["price_pct"]
    overrides = [u for u in store["_upserts"] if u[0] == "price_overrides"]
    assert overrides, "Overrides müssen geschrieben werden"
    prices = {row["date"]: row["price"] for row in overrides[0][1]}
    assert prices == {"2026-05-01": 110.0, "2026-05-02": 110.0}


def test_bulk_edit_price_pct_decrease_rounds() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    # Basispreis 100 → -15 % = 85.0.
    svc, store = _service(
        properties=[{"id": "p1"}],
        rate_plans=[{"base_price": 100.0, "min_stay": 1}],
    )
    svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
            price_adjust_pct=-15,
        ),
    )
    overrides = [u for u in store["_upserts"] if u[0] == "price_overrides"]
    assert overrides[0][1][0]["price"] == 85.0


def test_bulk_edit_price_pct_skips_days_without_price() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    # Kein Rate-Plan → kein auflösbarer Preis → keine Overrides (kein Crash).
    svc, store = _service(properties=[{"id": "p1"}])
    res = svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
            price_adjust_pct=10,
        ),
    )
    assert res.applied == ["price_pct"]
    assert not [u for u in store.get("_upserts", []) if u[0] == "price_overrides"]


def test_bulk_edit_fixed_and_pct_mutually_exclusive() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    with pytest.raises(ValueError):
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
            price=99.0,
            price_adjust_pct=10,
        )


# --- Teil B: CTA/CTD-Restriktionen ---

def test_set_restrictions_upserts_cta_ctd() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    days = svc.set_restrictions(
        "t1", "p1",
        DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
        cta=True, ctd=False,
    )
    assert days == 2
    upserts = [u for u in store["_upserts"] if u[0] == "availability"]
    assert upserts, "availability-Upsert erwartet"
    row = upserts[0][1][0]
    assert row["closed_to_arrival"] is True
    assert row["closed_to_departure"] is False


def test_set_restrictions_only_sets_given_field() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    svc.set_restrictions(
        "t1", "p1",
        DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
        cta=True,  # ctd None → bleibt unverändert (Feld nicht im Payload)
    )
    row = [u for u in store["_upserts"] if u[0] == "availability"][0][1][0]
    assert row["closed_to_arrival"] is True
    assert "closed_to_departure" not in row


def test_set_restrictions_noop_when_both_none() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    days = svc.set_restrictions(
        "t1", "p1", DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
    )
    assert days == 0
    assert not [u for u in store.get("_upserts", []) if u[0] == "availability"]


def test_set_restrictions_rejects_foreign_property() -> None:
    svc, _ = _service()  # keine eigene property
    with pytest.raises(CalendarError) as exc:
        svc.set_restrictions(
            "t1", "p-fremd",
            DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
            cta=True,
        )
    assert exc.value.status_code == 404


def test_get_availability_returns_cta_ctd_flags() -> None:
    svc, _ = _service(
        properties=[{"id": "p1"}],
        availability=[{
            "date": "2026-05-01", "status": "open", "source": "manual",
            "closed_to_arrival": True, "closed_to_departure": False,
        }],
    )
    days = svc.get_availability(
        _ctx(), "p1", DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
    )
    # Tag 1 hat die Flags; Tag 2 (keine Zeile) → Default false.
    assert days[0].closed_to_arrival is True
    assert days[0].closed_to_departure is False
    assert days[1].closed_to_arrival is False


def test_bulk_edit_sets_cta_ctd() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    svc, store = _service(properties=[{"id": "p1"}])
    res = svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
            closed_to_arrival=True,
            closed_to_departure=False,
        ),
    )
    assert "cta_on" in res.applied and "ctd_off" in res.applied
    assert [u for u in store["_upserts"] if u[0] == "availability"]


# --- ohne Client: sauberer Fehler statt Crash ---

def test_db_unavailable_raises_clean_error() -> None:
    svc = CalendarService(client=None)
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    with pytest.raises(CalendarError) as exc:
        svc.get_availability(_ctx(), "p1", rng)
    assert exc.value.status_code == 500


# --- Stop-Sell: Wochentags-Maske, Spannen-Kompression, Schema-Validierung ---

def test_stop_sell_weekday_mask_limits_days() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    # 1.–14. Juni 2027 (1.6. = Dienstag): nur Sa (5) + So (6) sperren.
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 15))
    res = svc.set_stop_sell("t1", "p1", rng, None, [5, 6])
    (_table, payload) = store["_upserts"][0]
    assert res["stopped_days"] == 4
    assert [row["date"] for row in payload] == [
        "2027-06-05", "2027-06-06", "2027-06-12", "2027-06-13",
    ]
    assert all(row["source"] == "manual" for row in payload)


def test_stop_sell_weekday_mask_without_match_is_noop() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    rng = DateRange(start=date(2027, 6, 5), end=date(2027, 6, 7))  # Sa + So
    res = svc.set_stop_sell("t1", "p1", rng, None, [2])  # nur Mittwoch
    assert res["stopped_days"] == 0
    assert "_upserts" not in store  # kein Upsert für leere Auswahl


def test_stop_sell_without_mask_covers_all_nights() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 4))
    res = svc.set_stop_sell("t1", "p1", rng, "Wartung", None)
    (_table, payload) = store["_upserts"][0]
    assert res["stopped_days"] == 3
    assert all(row["reason"] == "Wartung" for row in payload)


def test_stop_sell_skips_booked_days() -> None:
    # Gebuchte Tage dürfen NIE gestoppt werden (der Tag ist verkauft). Sie
    # werden übersprungen und als skipped_booked gemeldet (UI-Hinweis).
    svc, store = _service(
        properties=[{"id": "p1"}],
        availability=[
            {"date": "2027-06-02", "status": "booked", "source": "direct"},
        ],
    )
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 4))
    res = svc.set_stop_sell("t1", "p1", rng, "Wartung", None)
    (_table, payload) = store["_upserts"][0]
    assert res["stopped_days"] == 2
    assert res["skipped_booked"] == 1
    # Der gebuchte 2.6. ist NICHT im Upsert.
    assert [row["date"] for row in payload] == ["2027-06-01", "2027-06-03"]


def test_stop_sell_all_booked_writes_nothing() -> None:
    svc, store = _service(
        properties=[{"id": "p1"}],
        availability=[
            {"date": "2027-06-01", "status": "booked", "source": "direct"},
            {"date": "2027-06-02", "status": "booked", "source": "direct"},
            {"date": "2027-06-03", "status": "booked", "source": "direct"},
        ],
    )
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 4))
    res = svc.set_stop_sell("t1", "p1", rng, None, None)
    assert res["stopped_days"] == 0
    assert res["skipped_booked"] == 3
    assert "_upserts" not in store


def test_clear_stop_sell_with_weekdays_runs_delete() -> None:
    svc, store = _service(
        properties=[{"id": "p1"}],
        stop_sell=[{"date": "2027-06-06"}],  # bleibt (z. B. source=channex)
    )
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 15))
    svc.clear_stop_sell("t1", "p1", rng, [5, 6])
    assert "stop_sell" in store.get("_deletes", [])


def test_clear_stop_sell_default_only_manual() -> None:
    # Standard: nur manuelle Stops löschen → delete filtert auf source=manual,
    # Portal-/Channex-Stops bleiben unangetastet.
    svc, store = _service(properties=[{"id": "p1"}], stop_sell=[])
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 15))
    svc.clear_stop_sell("t1", "p1", rng)
    filters = [f for (n, f) in store.get("_delete_filters", []) if n == "stop_sell"]
    assert filters and all(f.get("source") == "manual" for f in filters)


def test_clear_stop_sell_include_portal_removes_channex() -> None:
    # include_portal=True: KEIN source-Filter → auch Portal-/Channex-Stops werden
    # gelöscht (für versehentlich gesetzte Stops).
    svc, store = _service(properties=[{"id": "p1"}], stop_sell=[])
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 15))
    svc.clear_stop_sell("t1", "p1", rng, include_portal=True)
    filters = [f for (n, f) in store.get("_delete_filters", []) if n == "stop_sell"]
    assert filters and all("source" not in f for f in filters)


def test_reset_all_stop_sell_single_property_deletes_all_sources() -> None:
    # Reset eines Objekts: löscht ALLE zukünftigen Stops (auch Portal). 2099er
    # Datum, damit es sicher in der Zukunft liegt (date.today()-Filter).
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        stop_sell=[
            {"date": "2099-06-01", "property_id": "p1", "source": "channex"},
            {"date": "2099-06-02", "property_id": "p1", "source": "manual"},
        ],
    )
    res = svc.reset_all_stop_sell("t1", "p1")
    assert res["properties"] == 1
    assert res["days"] == 2
    assert "stop_sell" in store.get("_deletes", [])
    # KEIN source-Filter → auch der Channex-/Portal-Stop wird gelöscht.
    filters = [f for (n, f) in store.get("_delete_filters", []) if n == "stop_sell"]
    assert filters and all("source" not in f for f in filters)


def test_reset_all_stop_sell_without_stops_is_noop() -> None:
    # Objekt ohne (zukünftige) Stops → nichts löschen, days=0.
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        stop_sell=[],
    )
    res = svc.reset_all_stop_sell("t1", "p1")
    assert res["days"] == 0
    assert "stop_sell" not in store.get("_deletes", [])


def test_reset_all_stop_sell_rejects_missing_tenant() -> None:
    svc, _ = _service(properties=[{"id": "p1", "tenant_id": "t1"}])
    try:
        svc.reset_all_stop_sell("", "p1")
        raise AssertionError("expected CalendarError")
    except CalendarError as exc:
        assert exc.status_code == 400


def test_date_spans_compresses_consecutive_days() -> None:
    spans = CalendarService._date_spans(
        [date(2027, 6, 5), date(2027, 6, 6), date(2027, 6, 8)]
    )
    assert spans == [
        (date(2027, 6, 5), date(2027, 6, 6)),
        (date(2027, 6, 8), date(2027, 6, 8)),
    ]


def test_stop_sell_request_rejects_invalid_weekday() -> None:
    from src.features.calendar.schemas import StopSellRequest

    with pytest.raises(ValueError):
        StopSellRequest(
            property_id="p1",
            range=DateRange(start=date(2027, 6, 1), end=date(2027, 6, 2)),
            weekdays=[7],
        )


def test_stop_sell_rejects_foreign_agency() -> None:
    # Cross-Tenant-Referenz: fremde agency_id → 404 (Review-Befund P1).
    # Der Fake ignoriert eq-Filter; ein leerer Store simuliert den
    # tenant-gescopten Lookup ohne Treffer.
    svc, _ = _service(properties=[{"id": "p1"}], travel_agencies=[])
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 3))
    with pytest.raises(CalendarError) as exc:
        svc.set_stop_sell("t1", "p1", rng, None, None, "a-fremd")
    assert exc.value.status_code == 404


def test_stop_sell_never_overwrites_channex_days() -> None:
    # Upsert darf source=channex nicht auf manual kippen (Review-Befund P2).
    svc, store = _service(
        properties=[{"id": "p1"}],
        stop_sell=[{"date": "2027-06-02", "source": "channex"}],
    )
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 4))
    res = svc.set_stop_sell("t1", "p1", rng, None, None)
    (_table, payload) = store["_upserts"][0]
    dates = [row["date"] for row in payload]
    assert "2027-06-02" not in dates  # Channex-Tag ausgespart
    assert res["stopped_days"] == 2


def test_stop_sell_response_keeps_agency_name() -> None:
    """Der Reisebüro-Name (travel_agencies-Join) muss durch das Response-Modell
    überleben — sonst zeigt der Kalender-Balken nur „Gesperrt" ohne Adressat."""
    item = {
        "id": "ss1",
        "property_id": "p1",
        "date": "2027-06-02",
        "reason": "Renovierung",
        "source": "manual",
        "agency_id": "ag1",
        "agency_name": "TUI",
    }
    dumped = StopSellListResponse(items=[item], total=1).items[0].model_dump()
    assert dumped["agency_name"] == "TUI"


# --- Owner-Scope (§4.2): Eigentümer sieht nur zugeordnete Objekte, keine Preise --

def test_owner_sees_only_assigned_property() -> None:
    # Owner u1 ist NUR p1 zugeordnet; p2 gehört demselben Tenant, aber Owner B.
    svc, _ = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}, {"id": "p2", "tenant_id": "t1"}],
        owner_property_assignments=[
            {"tenant_id": "t1", "user_id": "u1", "property_id": "p1"}
        ],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    # Eigenes Objekt: ok.
    svc.get_availability(_ctx(role="owner"), "p1", rng)
    # Fremdes Objekt desselben Tenants: 404 (keine Existenz verraten).
    with pytest.raises(CalendarError) as exc:
        svc.get_availability(_ctx(role="owner"), "p2", rng)
    assert exc.value.status_code == 404


def test_owner_prices_stripped() -> None:
    svc, _ = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[{"base_price": 100.0, "min_stay": 2}],
        price_overrides=[{"date": "2026-05-01", "price": 150.0}],
        owner_property_assignments=[
            {"tenant_id": "t1", "user_id": "u1", "property_id": "p1"}
        ],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    # Admin sieht Preise; Owner nicht (kein Preis-Recht §4.2), aber min_stay bleibt.
    admin_days = svc.get_availability(_ctx(), "p1", rng)
    assert admin_days[0].price == 150.0
    owner_days = svc.get_availability(_ctx(role="owner"), "p1", rng)
    assert all(d.price is None and d.price_source == "none" for d in owner_days)
    assert all(d.min_stay == 2 for d in owner_days)


def test_owner_board_filters_and_strips() -> None:
    svc, _ = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}, {"id": "p2", "tenant_id": "t1"}],
        rate_plans=[{"property_id": "p1", "base_price": 100.0, "min_stay": 1}],
        price_overrides=[{"property_id": "p1", "date": "2026-05-01", "price": 90.0}],
        owner_property_assignments=[
            {"tenant_id": "t1", "user_id": "u1", "property_id": "p1"}
        ],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    board = svc.get_board(_ctx(role="owner"), ["p1", "p2"], rng)
    # Nur das zugeordnete p1, ohne Preise.
    assert [i.property_id for i in board.items] == ["p1"]
    assert all(d.price is None for d in board.items[0].days)


# --- bulk_restrictions: lokaler stop_sell-Spiegel (Wurzel 1) -----------------

def _row_req(**kw) -> RestrictionRowsRequest:
    rng = DateRange(start=date(2026, 11, 14), end=date(2026, 11, 15))
    return RestrictionRowsRequest(
        property_id="p1", rows=[RestrictionRow(range=rng, **kw)]
    )


def test_bulk_restrictions_plan_stop_sell_mirrors_locally() -> None:
    # Hotel-Stopp (Zert Test 6): die Zeile spiegelt in stop_sell MIT
    # rate_plan_id — sonst blieben eigene Plattform/Rezeption offen.
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[{"id": "rp-a", "property_id": "p1"}],
        stop_sell=[],
    )
    n = svc.bulk_restrictions("t1", _row_req(rate_plan_id="rp-a", stop_sell=True))
    assert n == 1
    mirrored = [p for t, p in store.get("_upserts", []) if t == "stop_sell"]
    assert mirrored and mirrored[0][0]["rate_plan_id"] == "rp-a"
    assert mirrored[0][0]["source"] == "manual"
    assert mirrored[0][0]["date"] == "2026-11-14"


def test_bulk_restrictions_plan_stop_sell_false_deletes_plan_rows() -> None:
    # Aufheben trifft NUR den Plan (eq rate_plan_id) und nur manuelle Stops.
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[{"id": "rp-a", "property_id": "p1"}],
        stop_sell=[],
    )
    svc.bulk_restrictions("t1", _row_req(rate_plan_id="rp-a", stop_sell=False))
    filters = [
        f for t, f in store.get("_delete_filters", []) if t == "stop_sell"
    ]
    assert filters == [
        {"property_id": "p1", "source": "manual", "rate_plan_id": "rp-a"}
    ]


def test_bulk_restrictions_rejects_foreign_rate_plan() -> None:
    # Fremde/erfundene Plan-ID → 422, KEIN stiller Fallback auf alle Pläne.
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[],  # kein eigener Plan
        stop_sell=[],
    )
    with pytest.raises(CalendarError) as exc:
        svc.bulk_restrictions("t1", _row_req(rate_plan_id="rp-x", stop_sell=True))
    assert exc.value.status_code == 422
    assert not store.get("_upserts")
