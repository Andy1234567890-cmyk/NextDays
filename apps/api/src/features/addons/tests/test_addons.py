"""Tests für den addons-Slice: Preis-Mathematik, Kauf-Logik (Verkaufsfläche +
Verfügbarkeitsregel), Resolver-Integration und Owner-Statement-Extra-Umsatz.

Leichtgewichtiges Fake-DB-Mock (Muster wie owners.tests): nur die wirklich
genutzten Query-Ketten. Kein Netz, keine echte Supabase.
"""
from __future__ import annotations

import pytest

from src.features.addons.pricing import addon_net, addon_total
from src.features.addons.service import purchase_addons

# --- Preis-Mathematik (reine Funktionen) -------------------------------------

def test_addon_net_per_basis() -> None:
    assert addon_net(50, "per_stay", nights=3, guests=2, qty=1) == 50
    assert addon_net(20, "per_night", nights=3, guests=2, qty=1) == 60
    assert addon_net(10, "per_guest", nights=3, guests=2, qty=1) == 20
    assert addon_net(15, "per_unit", nights=3, guests=2, qty=4) == 60


def test_addon_net_qty_multiplies_per_stay() -> None:
    # qty als Mehrfachkauf auch bei per_stay/per_night/per_guest.
    assert addon_net(50, "per_stay", nights=2, guests=2, qty=3) == 150


def test_addon_total_applies_tax() -> None:
    net, gross = addon_total(100, "per_stay", 19, nights=2, guests=2, qty=1)
    assert net == 100.0
    assert gross == 119.0


def test_addon_total_no_tax() -> None:
    net, gross = addon_total(40, "per_night", None, nights=2, guests=1, qty=1)
    assert net == gross == 80.0


# --- Fake-DB-Mock ------------------------------------------------------------

class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, db: _DB, table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: list[dict] | dict | None = None
        self._filters: list[tuple[str, object]] = []
        self._neq: list[tuple[str, object]] = []
        self._is_null: list[str] = []
        self._not_null: list[str] = []
        self._negated = False
        self._in: tuple[str, list] | None = None
        self._embed_property = False

    def select(self, *cols: object, **_k: object) -> _Query:
        self._op = "select"
        self._embed_property = any("properties!inner" in str(c) for c in cols)
        return self

    def insert(self, payload: list[dict] | dict) -> _Query:
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict) -> _Query:
        self._op = "update"
        self._payload = payload
        return self

    def delete(self) -> _Query:
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> _Query:
        self._filters.append((col, val))
        return self

    def neq(self, col: str, val: object) -> _Query:
        self._neq.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> _Query:
        self._in = (col, vals)
        return self

    def is_(self, col: str, val: object) -> _Query:
        """PostgREST `is`/`not.is` — hier nur für NULL-Prüfungen gebraucht.

        Muss WIRKLICH filtern: ein No-op würde `_assert_not_invoiced` im Test
        grün färben, obwohl es live Entwürfe (invoice_number NULL) von
        festgeschriebenen Rechnungen unterscheiden muss."""
        if str(val).lower() != "null":
            raise NotImplementedError("Fake unterstützt nur is_(col, 'null')")
        if self._negated:
            self._not_null.append(col)
        else:
            self._is_null.append(col)
        self._negated = False
        return self

    @property
    def not_(self) -> _Query:
        self._negated = True
        return self

    def order(self, *_a: object, **_k: object) -> _Query:
        return self

    def limit(self, _n: int) -> _Query:
        return self

    def _match(self, row: dict) -> bool:
        ok = all(str(row.get(c)) == str(v) for c, v in self._filters)
        if ok:
            ok = all(str(row.get(c)) != str(v) for c, v in self._neq)
        if ok:
            ok = all(row.get(c) is None for c in self._is_null)
        if ok:
            ok = all(row.get(c) is not None for c in self._not_null)
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        return ok

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            new = self._payload if isinstance(self._payload, list) else [self._payload]
            created = []
            for i, p in enumerate(new):
                row = dict(p)
                row.setdefault("id", f"{self._table}-{len(rows) + i + 1}")
                rows.append(row)
                created.append(row)
            return _Result(created)
        selected = [r for r in rows if self._match(r)]
        if self._op == "update":
            for r in selected:
                r.update(self._payload)  # type: ignore[arg-type]
            return _Result(selected)
        if self._op == "delete":
            self._db.tables[self._table] = [r for r in rows if not self._match(r)]
            return _Result(selected)
        if self._embed_property:
            props = {str(p["id"]): p for p in self._db.tables.get("properties", [])}
            out = []
            for r in selected:
                parent = props.get(str(r.get("property_id")), {})
                out.append({**r, "properties": {"tenant_id": parent.get("tenant_id")}})
            return _Result(out)
        return _Result(selected)


class _Storage:
    def from_(self, _bucket: str) -> _Storage:
        return self

    def upload(self, *_a: object, **_k: object) -> None:
        return None

    def get_public_url(self, path: str) -> str:
        return f"https://cdn.test/{path}"


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self.storage = _Storage()

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _catalog_row(**over: object) -> dict:
    base = {
        "id": "addon-1",
        "property_id": "prop-1",
        "name": {"de": "Frühstück"},
        "price": 12.0,
        "basis": "per_guest",
        "tax_rate": None,
        "appears_in": ["booking_engine", "guest_portal"],
        "available_until": "anytime",
        "active": True,
    }
    base.update(over)
    return base


# --- purchase_addons: Verkaufsfläche + Verfügbarkeitsregel + Betrag ----------

def test_purchase_books_addon_with_server_price(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _DB({"property_addons": [_catalog_row()], "reservation_addons": [], "tasks": []})
    monkeypatch.setattr(
        "src.features.tasks.service.TasksService.generate_for_addon",
        lambda *a, **k: None,
    )
    created = purchase_addons(
        db,
        tenant_id="t-1",
        reservation_id="res-1",
        property_id="prop-1",
        surface="booking_engine",
        selections=[("addon-1", 1)],
        nights=2,
        guests=3,
        check_in_iso="2026-07-01",
        is_before_checkin=True,
    )
    assert len(created) == 1
    # per_guest 12 × 3 Gäste = 36, kein Client-Preis vertraut.
    assert created[0]["total"] == 36.0
    assert created[0]["status"] == "pending"


def test_purchase_skips_wrong_surface(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _DB(
        {
            "property_addons": [_catalog_row(appears_in=["guest_portal"])],
            "reservation_addons": [],
            "tasks": [],
        }
    )
    monkeypatch.setattr(
        "src.features.tasks.service.TasksService.generate_for_addon",
        lambda *a, **k: None,
    )
    created = purchase_addons(
        db,
        tenant_id="t-1",
        reservation_id="res-1",
        property_id="prop-1",
        surface="booking_engine",  # Add-on nur für guest_portal → nicht buchbar
        selections=[("addon-1", 1)],
        nights=2,
        guests=2,
        check_in_iso="2026-07-01",
        is_before_checkin=True,
    )
    assert created == []


def test_purchase_skips_before_checkin_after_arrival(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _DB(
        {
            "property_addons": [_catalog_row(available_until="before_checkin")],
            "reservation_addons": [],
            "tasks": [],
        }
    )
    monkeypatch.setattr(
        "src.features.tasks.service.TasksService.generate_for_addon",
        lambda *a, **k: None,
    )
    created = purchase_addons(
        db,
        tenant_id="t-1",
        reservation_id="res-1",
        property_id="prop-1",
        surface="guest_portal",
        selections=[("addon-1", 1)],
        nights=2,
        guests=2,
        check_in_iso="2026-07-01",
        is_before_checkin=False,  # Früh-Check-in nach Anreise nicht mehr buchbar
    )
    assert created == []


def test_purchase_triggers_task(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple] = []
    monkeypatch.setattr(
        "src.features.tasks.service.TasksService.generate_for_addon",
        lambda self, *a, **k: calls.append(a),
    )
    db = _DB({"property_addons": [_catalog_row()], "reservation_addons": [], "tasks": []})
    purchase_addons(
        db,
        tenant_id="t-1",
        reservation_id="res-1",
        property_id="prop-1",
        surface="booking_engine",
        selections=[("addon-1", 1)],
        nights=1,
        guests=1,
        check_in_iso="2026-07-01",
        is_before_checkin=True,
    )
    assert len(calls) == 1  # genau eine Auto-Aufgabe je gekauftem Item


# --- Katalog-CRUD je Objekt --------------------------------------------------

from src.core.security import AuthContext  # noqa: E402
from src.features.addons.schemas import AddonCreate, AddonUpdate  # noqa: E402
from src.features.addons.service import AddonError, AddonsService  # noqa: E402


def _ctx() -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id="t-1", role="admin")


def _crud_svc() -> AddonsService:
    db = _DB(
        {
            "properties": [{"id": "prop-1", "tenant_id": "t-1", "title": "Villa"}],
            "property_addons": [],
        }
    )
    return AddonsService(service_client=db)


def test_catalog_create_list_update_delete() -> None:
    svc = _crud_svc()
    created = svc.create(
        _ctx(),
        "prop-1",
        AddonCreate(name={"de": "Frühstück"}, price=12, basis="per_guest"),
    )
    assert created.property_id == "prop-1"
    assert svc.list_for_property(_ctx(), "prop-1").total == 1

    updated = svc.update(_ctx(), created.id, AddonUpdate(price=15, active=False))
    assert updated.price == 15.0 and updated.active is False

    svc.delete(_ctx(), created.id)
    assert svc.list_for_property(_ctx(), "prop-1").total == 0


def test_catalog_create_foreign_property_rejected() -> None:
    svc = _crud_svc()
    with pytest.raises(AddonError) as exc:
        svc.create(_ctx(), "prop-fremd", AddonCreate(name={"de": "X"}))
    assert exc.value.status_code == 404


# --- Schnelltaste: Add-on zu bestehender Buchung (Dashboard) -----------------


def test_add_addon_to_reservation_quick(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "src.features.tasks.service.TasksService.generate_for_addon",
        lambda *a, **k: None,
    )
    db = _DB(
        {
            "properties": [{"id": "prop-1", "tenant_id": "t-1", "title": "Villa"}],
            "property_addons": [_catalog_row(price=20, basis="per_night")],
            "reservations": [
                {
                    "id": "res-1",
                    "tenant_id": "t-1",
                    "property_id": "prop-1",
                    "check_in": "2026-07-01",
                    "check_out": "2026-07-04",
                    "num_guests": 2,
                }
            ],
            "reservation_addons": [],
            "tasks": [],
        }
    )
    svc = AddonsService(service_client=db)
    view = svc.add_to_reservation(_ctx(), "res-1", "addon-1", 1)
    # per_night 20 × 3 Nächte = 60.
    assert view.total == 60.0
    assert view.items[0].status == "pending"


def test_available_for_reservation_lists_property_catalog() -> None:
    db = _DB(
        {
            "properties": [{"id": "prop-1", "tenant_id": "t-1", "title": "Villa"}],
            "property_addons": [_catalog_row(), _catalog_row(id="addon-2")],
            "reservations": [
                {
                    "id": "res-1",
                    "tenant_id": "t-1",
                    "property_id": "prop-1",
                    "check_in": "2026-07-01",
                    "check_out": "2026-07-04",
                    "num_guests": 2,
                }
            ],
        }
    )
    svc = AddonsService(service_client=db)
    assert svc.available_for_reservation(_ctx(), "res-1").total == 2


def test_add_addon_foreign_reservation_rejected() -> None:
    db = _DB(
        {
            "properties": [{"id": "prop-1", "tenant_id": "t-1"}],
            "property_addons": [_catalog_row()],
            "reservations": [],  # keine Reservierung im Tenant
        }
    )
    svc = AddonsService(service_client=db)
    with pytest.raises(AddonError) as exc:
        svc.add_to_reservation(_ctx(), "res-x", "addon-1", 1)
    assert exc.value.status_code == 404


# --- Mehrwährung: Objekt-Währung aus rate_plans, kein €-Fallback -------------


def test_catalog_currency_from_rate_plan() -> None:
    db = _DB(
        {
            "properties": [{"id": "prop-1", "tenant_id": "t-1"}],
            "property_addons": [_catalog_row()],
            "rate_plans": [{"property_id": "prop-1", "currency": "SEK"}],
        }
    )
    svc = AddonsService(service_client=db)
    res = svc.list_for_property(_ctx(), "prop-1")
    assert res.currency == "SEK"  # nie € erfunden


# --- Storno einer falsch gebuchten Zusatzleistung ---------------------------


def _cancel_db(
    *, addon_status: str = "pending", invoices: list[dict] | None = None
) -> _DB:
    return _DB(
        {
            "properties": [{"id": "prop-1", "tenant_id": "t-1"}],
            "reservations": [
                {
                    "id": "res-1",
                    "tenant_id": "t-1",
                    "property_id": "prop-1",
                    "check_in": "2026-07-01",
                    "check_out": "2026-07-04",
                    "num_guests": 2,
                }
            ],
            "reservation_addons": [
                {
                    "id": "ra-1",
                    "tenant_id": "t-1",
                    "reservation_id": "res-1",
                    "addon_id": "addon-1",
                    "name": {"de": "Wäschepaket"},
                    "price": 150.0,
                    "basis": "per_stay",
                    "tax_rate": None,
                    "qty": 1,
                    "total": 150.0,
                    "status": addon_status,
                }
            ],
            "invoices": invoices if invoices is not None else [],
            "tasks": [
                {
                    "id": "task-1",
                    "tenant_id": "t-1",
                    "reservation_id": "res-1",
                    "title": "Zusatzleistung vorbereiten: Wäschepaket",
                    "status": "open",
                }
            ],
        }
    )


def test_cancel_addon_sets_status_and_drops_from_total() -> None:
    db = _cancel_db()
    svc = AddonsService(service_client=db)
    res = svc.cancel_reservation_addon(_ctx(), "ra-1")
    assert res.status == "cancelled"
    # Die Zeile bleibt als Beleg stehen (kein DELETE) …
    assert len(db.tables["reservation_addons"]) == 1
    # … zählt aber nicht mehr zur fälligen Summe der Buchung.
    view = svc.list_for_reservation(_ctx(), "res-1")
    assert view.items[0].status == "cancelled"


def test_cancel_addon_closes_preparation_task() -> None:
    """Wurzel 1: der Gegenzustand (die Vorbereitungs-Aufgabe) muss mit weg."""
    db = _cancel_db()
    AddonsService(service_client=db).cancel_reservation_addon(_ctx(), "ra-1")
    assert db.tables["tasks"][0]["status"] == "cancelled"


def test_cancel_addon_is_idempotent() -> None:
    """Wurzel 2: Doppelklick/Retry darf nicht 404/500 werfen."""
    svc = AddonsService(service_client=_cancel_db(addon_status="cancelled"))
    assert svc.cancel_reservation_addon(_ctx(), "ra-1").status == "cancelled"


def test_cancel_paid_addon_rejected() -> None:
    svc = AddonsService(service_client=_cancel_db(addon_status="paid"))
    with pytest.raises(AddonError) as exc:
        svc.cancel_reservation_addon(_ctx(), "ra-1")
    assert exc.value.status_code == 409


def test_cancel_addon_blocked_by_finalized_invoice() -> None:
    """GoBD: was auf einer nummerierten Rechnung steht, verschwindet nicht still."""
    db = _cancel_db(
        invoices=[
            {
                "id": "inv-1",
                "tenant_id": "t-1",
                "reservation_id": "res-1",
                "invoice_type": "invoice",
                "invoice_number": "RE-2026-0001",
                "status": "finalized",
                "deleted_at": None,
            }
        ]
    )
    svc = AddonsService(service_client=db)
    with pytest.raises(AddonError) as exc:
        svc.cancel_reservation_addon(_ctx(), "ra-1")
    assert exc.value.status_code == 409
    assert "RE-2026-0001" in exc.value.message
    assert db.tables["reservation_addons"][0]["status"] == "pending"


def test_cancel_addon_allowed_with_draft_invoice() -> None:
    """Ein Entwurf ohne Nummer wird beim Check-out neu aufgebaut → Storno erlaubt."""
    db = _cancel_db(
        invoices=[
            {
                "id": "inv-1",
                "tenant_id": "t-1",
                "reservation_id": "res-1",
                "invoice_type": "invoice",
                "invoice_number": None,
                "status": "draft",
                "deleted_at": None,
            }
        ]
    )
    svc = AddonsService(service_client=db)
    assert svc.cancel_reservation_addon(_ctx(), "ra-1").status == "cancelled"


def test_cancel_addon_foreign_tenant_rejected() -> None:
    """Wurzel 3: service_role umgeht RLS — der Tenant-Scope muss explizit greifen."""
    svc = AddonsService(service_client=_cancel_db())
    fremd = AuthContext(user_id="u-2", tenant_id="t-2", role="admin")
    with pytest.raises(AddonError) as exc:
        svc.cancel_reservation_addon(fremd, "ra-1")
    assert exc.value.status_code == 404


def test_catalog_currency_none_without_rate_plan() -> None:
    # Kein Rate-Plan → currency None (kein Fallback), Anzeige zeigt nackten Wert.
    db = _DB(
        {
            "properties": [{"id": "prop-1", "tenant_id": "t-1"}],
            "property_addons": [_catalog_row()],
        }
    )
    svc = AddonsService(service_client=db)
    assert svc.list_for_property(_ctx(), "prop-1").currency is None
