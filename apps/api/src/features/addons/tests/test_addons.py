"""Tests für den addons-Slice: Preis-Mathematik, Kauf-Logik (Verkaufsfläche +
Verfügbarkeitsregel), Resolver-Integration und Owner-Statement-Extra-Umsatz.

Leichtgewichtiges Fake-DB-Mock (Muster wie owners.tests): nur die wirklich
genutzten Query-Ketten. Kein Netz, keine echte Supabase.
"""
from __future__ import annotations

import pytest

from src.features.addons.pricing import addon_net, addon_total, vorbelegte_menge
from src.features.addons.service import purchase_addons

# --- Preis-Mathematik (reine Funktionen) -------------------------------------

def test_addon_net_per_basis() -> None:
    assert addon_net(50, "per_stay", nights=3, qty=1) == 50
    assert addon_net(20, "per_night", nights=3, qty=1) == 60
    assert addon_net(15, "per_unit", nights=3, qty=4) == 60


def test_per_guest_menge_ist_die_personenzahl() -> None:
    """`per_guest` rechnet Preis × MENGE, nicht × Gästezahl × Menge.

    Der reale Fall: eine Buchung über 4 Personen bestellt nur 2 Wäschepakete.
    Mit der alten Regel (× guests × qty) war das unmöglich — qty=2 ergab 8
    Pakete, und die Gästezahl ließ sich nicht unterschreiten.
    """
    assert addon_net(150, "per_guest", nights=2, qty=2) == 300
    assert addon_net(150, "per_guest", nights=2, qty=4) == 600


def test_vorbelegte_menge_folgt_der_basis() -> None:
    assert vorbelegte_menge("per_guest", guests=4) == 4
    assert vorbelegte_menge("per_stay", guests=4) == 1
    assert vorbelegte_menge("per_night", guests=4) == 1
    assert vorbelegte_menge("per_unit", guests=4) == 1
    # Ohne belastbare Gästezahl mindestens 1 — nie 0 (keine Bestellung über nichts).
    assert vorbelegte_menge("per_guest", guests=0) == 1


def test_addon_net_qty_multiplies_per_stay() -> None:
    # qty als Mehrfachkauf auch bei per_stay/per_night/per_guest.
    assert addon_net(50, "per_stay", nights=2, qty=3) == 150


def test_addon_total_applies_tax() -> None:
    net, gross = addon_total(100, "per_stay", 19, nights=2, qty=1)
    assert net == 100.0
    assert gross == 119.0


def test_addon_total_no_tax() -> None:
    net, gross = addon_total(40, "per_night", None, nights=2, qty=1)
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
        # qty=0 heißt „nicht angegeben" → der Server setzt die Vorbelegung der
        # Basis ein (per_guest = Gästezahl).
        selections=[("addon-1", 0)],
        nights=2,
        guests=3,
        check_in_iso="2026-07-01",
        is_before_checkin=True,
    )
    assert len(created) == 1
    # per_guest 12 × Vorbelegung 3 = 36, kein Client-Preis vertraut.
    assert created[0]["total"] == 36.0
    assert created[0]["qty"] == 3
    assert created[0]["status"] == "pending"


def test_purchase_menge_unterschreitet_die_gaestezahl(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Der Auslöser dieser Änderung: 3 Gäste, aber nur 1 Wäschepaket bestellt."""
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
    # 12 × 1 = 12 — nicht 12 × 3 Gäste × 1 = 36 (alte Regel).
    assert created[0]["total"] == 12.0
    assert created[0]["qty"] == 1


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


# Pflicht-Grund der Storno-/Rücknahme-Aufrufe (0397). Ein realistischer Text,
# kein "x": die Untergrenze von 3 Zeichen wird eigens geprüft.
_GRUND = "Gast hat abbestellt"


def _cancel_db(
    *,
    addon_status: str = "pending",
    invoices: list[dict] | None = None,
    bezahlte_links: bool = False,
) -> _DB:
    """Fake-DB für die Storno-Pfade.

    `bezahlte_links=True` legt einen bezahlten Stripe-Zahlungslink über GENAU
    diese Position an — der Unterschied zwischen „Haken falsch gesetzt"
    (rücknehmbar) und „Karte wurde belastet" (nur per Erstattung korrigierbar).
    """
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
            "addon_payment_links": (
                [
                    {
                        "id": "link-1",
                        "tenant_id": "t-1",
                        "reservation_id": "res-1",
                        "status": "paid",
                    }
                ]
                if bezahlte_links
                else []
            ),
            "addon_payment_link_items": (
                [{"link_id": "link-1", "reservation_addon_id": "ra-1"}]
                if bezahlte_links
                else []
            ),
            "reservation_events": [],
        }
    )


def test_cancel_addon_sets_status_and_drops_from_total() -> None:
    db = _cancel_db()
    svc = AddonsService(service_client=db)
    res = svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND)
    assert res.status == "cancelled"
    # Die Zeile bleibt als Beleg stehen (kein DELETE) …
    assert len(db.tables["reservation_addons"]) == 1
    # … zählt aber nicht mehr zur fälligen Summe der Buchung.
    view = svc.list_for_reservation(_ctx(), "res-1")
    assert view.items[0].status == "cancelled"


def test_cancel_addon_closes_preparation_task() -> None:
    """Wurzel 1: der Gegenzustand (die Vorbereitungs-Aufgabe) muss mit weg."""
    db = _cancel_db()
    AddonsService(service_client=db).cancel_reservation_addon(_ctx(), "ra-1", _GRUND)
    assert db.tables["tasks"][0]["status"] == "cancelled"


def test_cancel_addon_is_idempotent() -> None:
    """Wurzel 2: Doppelklick/Retry darf nicht 404/500 werfen."""
    svc = AddonsService(service_client=_cancel_db(addon_status="cancelled"))
    assert svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND).status == "cancelled"


def test_cancel_manuell_bezahlte_position_erlaubt() -> None:
    """Der Live-Fall (14.08.2026): „Bezahlt" war eine Fehleingabe.

    Vorher warf dieser Pfad 409 und verwies auf eine Rückabwicklung, für die es
    keine Route gab — die Zeile war eine Sackgasse. Es floss kein Geld (kein
    bezahlter Zahlungslink), also ist der Storno der richtige Weg."""
    db = _cancel_db(addon_status="paid")
    svc = AddonsService(service_client=db)
    res = svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND)
    assert res.status == "cancelled"
    assert res.cancel_reason == _GRUND
    assert res.cancelled_by == "u-1"
    assert res.cancelled_at is not None
    # Der Grund steht am Datensatz UND in der Zeitleiste.
    ev = db.tables["reservation_events"][0]
    assert ev["kind"] == "addon_cancelled"
    assert ev["detail"]["reason"] == _GRUND
    assert ev["detail"]["war_bezahlt"] is True
    assert ev["by_user_id"] == "u-1"


def test_cancel_echt_per_karte_bezahlte_position_abgelehnt() -> None:
    """Geld ist wirklich eingegangen → Erstattung, nicht Storno.

    Sonst verschwände ein vereinnahmter Betrag aus Rechnung und Eigentümer-
    Abrechnung, während er auf dem Stripe-Konto liegt."""
    db = _cancel_db(addon_status="paid", bezahlte_links=True)
    svc = AddonsService(service_client=db)
    with pytest.raises(AddonError) as exc:
        svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND)
    assert exc.value.status_code == 409
    assert "erstatten" in exc.value.message
    assert db.tables["reservation_addons"][0]["status"] == "paid"


def test_cancel_bezahlter_link_einer_ANDEREN_position_blockiert_nicht() -> None:
    """Der Link-Check gilt der POSITION, nicht der Buchung.

    Eine Buchung kann mehrere Extras haben, von denen nur eines per Karte
    bezahlt wurde. Ein Filter auf die Reservierung hätte die falsch gehakte
    zweite Position mitgesperrt — die Sackgasse von vorne."""
    db = _cancel_db(addon_status="paid", bezahlte_links=True)
    # Der bezahlte Link deckt eine ANDERE Position derselben Buchung.
    db.tables["addon_payment_link_items"][0]["reservation_addon_id"] = "ra-2"
    svc = AddonsService(service_client=db)
    assert svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND).status == "cancelled"


def test_storno_schliesst_offenen_zahlungslink(monkeypatch: pytest.MonkeyPatch) -> None:
    """Wurzel 1: sonst nimmt eine bezahlbare URL Geld für Storniertes an.

    Der Betragsabgleich in `verbuche_zahlung` würde den Fall nicht auffangen: Er
    vergleicht die bezahlte Summe mit `link.amount_cents` — die stimmt ja noch —,
    während das Positions-Update die stornierte Zeile überspringt."""
    db = _cancel_db()
    db.tables["addon_payment_links"] = [
        {
            "id": "link-1",
            "tenant_id": "t-1",
            "reservation_id": "res-1",
            "status": "open",
            "stripe_payment_link_id": "plink_1",
            "stripe_account_id": "acct_1",
        }
    ]
    db.tables["addon_payment_link_items"] = [
        {"link_id": "link-1", "reservation_addon_id": "ra-1"}
    ]
    deaktiviert: list[str] = []
    monkeypatch.setattr(
        "src.features.payments.stripe_client.deactivate_payment_link",
        lambda pid, acct=None: deaktiviert.append(str(pid)),
    )
    svc = AddonsService(service_client=db)
    assert svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND).status == "cancelled"
    assert deaktiviert == ["plink_1"]
    assert db.tables["addon_payment_links"][0]["status"] == "cancelled"


def test_storno_bricht_ab_wenn_stripe_den_link_nicht_schliesst(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fail-closed (Wurzel 5): lieber Storno abbrechen als offene Zahl-URL.

    Sonst führte die Oberfläche eine stornierte Position, während die URL beim
    Gast weiter Geld annimmt."""
    db = _cancel_db()
    db.tables["addon_payment_links"] = [
        {
            "id": "link-1",
            "tenant_id": "t-1",
            "reservation_id": "res-1",
            "status": "open",
            "stripe_payment_link_id": "plink_1",
            "stripe_account_id": "acct_1",
        }
    ]
    db.tables["addon_payment_link_items"] = [
        {"link_id": "link-1", "reservation_addon_id": "ra-1"}
    ]

    def kaputt(*_a: object, **_k: object) -> None:
        raise RuntimeError("Stripe nicht erreichbar")

    monkeypatch.setattr(
        "src.features.payments.stripe_client.deactivate_payment_link", kaputt
    )
    svc = AddonsService(service_client=db)
    with pytest.raises(AddonError) as exc:
        svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND)
    assert exc.value.status_code == 502
    # Die Position bleibt offen — kein halber Zustand.
    assert db.tables["reservation_addons"][0]["status"] == "pending"


def test_storno_laesst_fremden_offenen_link_unberuehrt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Deckt der offene Link diese Position nicht, bleibt sein Betrag richtig."""
    db = _cancel_db()
    db.tables["addon_payment_links"] = [
        {
            "id": "link-1",
            "tenant_id": "t-1",
            "reservation_id": "res-1",
            "status": "open",
            "stripe_payment_link_id": "plink_1",
            "stripe_account_id": "acct_1",
        }
    ]
    # Der Link deckt eine ANDERE Position derselben Buchung.
    db.tables["addon_payment_link_items"] = [
        {"link_id": "link-1", "reservation_addon_id": "ra-2"}
    ]
    deaktiviert: list[str] = []
    monkeypatch.setattr(
        "src.features.payments.stripe_client.deactivate_payment_link",
        lambda pid, acct=None: deaktiviert.append(str(pid)),
    )
    svc = AddonsService(service_client=db)
    assert svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND).status == "cancelled"
    assert deaktiviert == []
    assert db.tables["addon_payment_links"][0]["status"] == "open"


def test_storno_ohne_grund_abgelehnt() -> None:
    """Der Grund ist der Zweck der Änderung — Leertext ist kein Grund.

    Kein Platzhalter („kein Grund angegeben"): ein Ersatztext würde eine
    Auskunft vortäuschen, die es nicht gibt (Wurzel 4)."""
    svc = AddonsService(service_client=_cancel_db())
    for leer in ("", "   ", "ab"):
        with pytest.raises(AddonError) as exc:
            svc.cancel_reservation_addon(_ctx(), "ra-1", leer)
        assert exc.value.status_code == 422


def test_grund_wird_getrimmt_und_gekappt() -> None:
    """Wurzel 8: harte Obergrenze, damit kein unbegrenzter Text in die Zeile läuft."""
    svc = AddonsService(service_client=_cancel_db())
    with pytest.raises(AddonError) as exc:
        svc.cancel_reservation_addon(_ctx(), "ra-1", "x" * 501)
    assert exc.value.status_code == 422
    # Führende/abschließende Leerzeichen landen nicht in der Auskunft.
    svc2 = AddonsService(service_client=_cancel_db())
    assert (
        svc2.cancel_reservation_addon(_ctx(), "ra-1", "  Doppelt erfasst  ").cancel_reason
        == "Doppelt erfasst"
    )


# --- Bezahlt-Markierung zurücknehmen (Fehleingabe) ---------------------------

def test_unmark_paid_setzt_position_zurueck_auf_offen() -> None:
    """Der Live-Fall: falscher Haken, kein Geld geflossen → wieder offen."""
    db = _cancel_db(addon_status="paid")
    db.tables["reservation_addons"][0]["charged_at"] = "2026-08-14T08:00:00+00:00"
    svc = AddonsService(service_client=db)
    res = svc.unmark_paid(_ctx(), "ra-1", "Falsch erfasst")
    assert res.status == "pending"
    # Wurzel 1: der Zahl-Zeitpunkt gehörte zu einer Zahlung, die es nicht gab.
    assert res.charged_at is None
    assert res.cancel_reason == "Falsch erfasst"
    assert db.tables["reservation_events"][0]["kind"] == "addon_unmarked_paid"


def test_unmark_paid_bei_echter_kartenzahlung_abgelehnt() -> None:
    db = _cancel_db(addon_status="paid", bezahlte_links=True)
    svc = AddonsService(service_client=db)
    with pytest.raises(AddonError) as exc:
        svc.unmark_paid(_ctx(), "ra-1", "Falsch erfasst")
    assert exc.value.status_code == 409
    assert db.tables["reservation_addons"][0]["status"] == "paid"


def test_unmark_paid_fragt_stripe_wenn_link_bei_uns_noch_offen_ist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unser Link-Status ist nur unser WISSENSSTAND, nicht der Geldfluss.

    Zahlt der Gast per Karte und der Connect-Webhook stellt nicht zu, steht der
    Link bei uns weiter auf 'open' — genau dafür gibt es den Nachlese-Abgleich.
    Ein Check nur auf status='paid' hätte hier nichts gefunden und die Rücknahme
    durchgelassen: Betrag vereinnahmt, Position wieder offen, kein Fehler
    sichtbar."""
    db = _cancel_db(addon_status="paid")
    db.tables["addon_payment_links"] = [
        {
            "id": "link-1",
            "tenant_id": "t-1",
            "reservation_id": "res-1",
            "status": "open",
            "stripe_payment_link_id": "plink_1",
            "stripe_account_id": "acct_1",
        }
    ]
    db.tables["addon_payment_link_items"] = [
        {"link_id": "link-1", "reservation_addon_id": "ra-1"}
    ]
    monkeypatch.setattr(
        "src.features.payments.stripe_client.find_paid_session",
        lambda pid, acct=None: {"id": "cs_1", "amount_total": 60000},
    )
    svc = AddonsService(service_client=db)
    with pytest.raises(AddonError) as exc:
        svc.unmark_paid(_ctx(), "ra-1", "Falsch erfasst")
    assert exc.value.status_code == 409
    assert "erstatten" in exc.value.message
    assert db.tables["reservation_addons"][0]["status"] == "paid"


def test_unmark_paid_geht_durch_wenn_stripe_keine_zahlung_kennt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Gegenprobe: offener Link, aber bei Stripe ist nichts bezahlt → Fehleingabe."""
    db = _cancel_db(addon_status="paid")
    db.tables["addon_payment_links"] = [
        {
            "id": "link-1",
            "tenant_id": "t-1",
            "reservation_id": "res-1",
            "status": "open",
            "stripe_payment_link_id": "plink_1",
            "stripe_account_id": "acct_1",
        }
    ]
    db.tables["addon_payment_link_items"] = [
        {"link_id": "link-1", "reservation_addon_id": "ra-1"}
    ]
    monkeypatch.setattr(
        "src.features.payments.stripe_client.find_paid_session",
        lambda pid, acct=None: None,
    )
    svc = AddonsService(service_client=db)
    assert svc.unmark_paid(_ctx(), "ra-1", "Falsch erfasst").status == "pending"


def test_unmark_paid_bricht_ab_wenn_stripe_nicht_antwortet(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fail-closed (Wurzel 5): ohne belastbare Auskunft wird nicht zurückgenommen."""
    db = _cancel_db(addon_status="paid")
    db.tables["addon_payment_links"] = [
        {
            "id": "link-1",
            "tenant_id": "t-1",
            "reservation_id": "res-1",
            "status": "open",
            "stripe_payment_link_id": "plink_1",
            "stripe_account_id": "acct_1",
        }
    ]
    db.tables["addon_payment_link_items"] = [
        {"link_id": "link-1", "reservation_addon_id": "ra-1"}
    ]

    def kaputt(*_a: object, **_k: object) -> None:
        raise RuntimeError("Stripe nicht erreichbar")

    monkeypatch.setattr(
        "src.features.payments.stripe_client.find_paid_session", kaputt
    )
    svc = AddonsService(service_client=db)
    with pytest.raises(AddonError) as exc:
        svc.unmark_paid(_ctx(), "ra-1", "Falsch erfasst")
    assert exc.value.status_code == 503
    assert db.tables["reservation_addons"][0]["status"] == "paid"


def test_unmark_paid_bei_festgeschriebener_rechnung_abgelehnt() -> None:
    """GoBD: was auf einer nummerierten Rechnung steht, wird nicht still offen."""
    db = _cancel_db(
        addon_status="paid",
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
        ],
    )
    with pytest.raises(AddonError) as exc:
        AddonsService(service_client=db).unmark_paid(_ctx(), "ra-1", "Falsch erfasst")
    assert exc.value.status_code == 409
    assert db.tables["reservation_addons"][0]["status"] == "paid"


def test_unmark_paid_ist_idempotent() -> None:
    """Wurzel 2: eine schon offene Position bleibt offen, kein 404/500."""
    svc = AddonsService(service_client=_cancel_db(addon_status="pending"))
    assert svc.unmark_paid(_ctx(), "ra-1", "Falsch erfasst").status == "pending"


def test_unmark_paid_ohne_grund_abgelehnt() -> None:
    svc = AddonsService(service_client=_cancel_db(addon_status="paid"))
    with pytest.raises(AddonError) as exc:
        svc.unmark_paid(_ctx(), "ra-1", "  ")
    assert exc.value.status_code == 422


def test_unmark_paid_fremder_tenant_abgelehnt() -> None:
    """Wurzel 3/9: derselbe Scope wie der Listen-Pfad."""
    svc = AddonsService(service_client=_cancel_db(addon_status="paid"))
    fremd = AuthContext(user_id="u-2", tenant_id="t-2", role="admin")
    with pytest.raises(AddonError) as exc:
        svc.unmark_paid(fremd, "ra-1", "Falsch erfasst")
    assert exc.value.status_code == 404


def test_mark_paid_ueberschreibt_kein_storno() -> None:
    """Sonst wäre eine stornierte Position per Klick wieder „bezahlt" —
    mitsamt Storno-Grund und -Datum in der Zeile (Beleg widerspricht sich)."""
    db = _cancel_db(addon_status="cancelled")
    with pytest.raises(AddonError) as exc:
        AddonsService(service_client=db).mark_paid(_ctx(), "ra-1")
    assert exc.value.status_code == 409
    assert db.tables["reservation_addons"][0]["status"] == "cancelled"


def test_mark_paid_raeumt_die_ruecknahme_spuren_ab() -> None:
    """Wurzel 1: Der Grund gehörte zum VORIGEN Vorgang und muss weg.

    Zwei normale Klicks: Bezahlt-Markierung zurücknehmen („falsch erfasst"),
    dann zahlt der Gast bar → als bezahlt markieren. Bliebe der Grund stehen,
    zeigte die bezahlte Zeile „Grund: falsch erfasst" (Falschaussage am Beleg)
    und `addon-storno-pruefen.sh` meldete für diesen Ablauf einen
    DB-Direktzugriff."""
    db = _cancel_db(addon_status="paid")
    svc = AddonsService(service_client=db)
    svc.unmark_paid(_ctx(), "ra-1", "Falsch erfasst")
    res = svc.mark_paid(_ctx(), "ra-1")
    assert res.status == "paid"
    assert res.cancel_reason is None
    assert res.cancelled_by is None
    assert res.cancelled_at is None
    zeile = db.tables["reservation_addons"][0]
    assert zeile["cancel_reason"] is None


def test_mark_paid_zweiter_klick_verschiebt_charged_at_nicht() -> None:
    """Wurzel 2: real kommt alles doppelt."""
    db = _cancel_db(addon_status="paid")
    db.tables["reservation_addons"][0]["charged_at"] = "2026-08-01T10:00:00+00:00"
    res = AddonsService(service_client=db).mark_paid(_ctx(), "ra-1")
    assert res.charged_at == "2026-08-01T10:00:00+00:00"


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
        svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND)
    assert exc.value.status_code == 409
    assert "RE-2026-0001" in exc.value.message
    assert db.tables["reservation_addons"][0]["status"] == "pending"


def test_cancel_addon_allowed_with_draft_invoice() -> None:
    """Ein Entwurf ohne Nummer darf sich noch ändern → Storno erlaubt.

    Und er wird dabei MITGEPFLEGT: `_finalize_reservation_draft` zieht beim
    Check-out nur die Nummer und übernimmt Positionen und Beträge unverändert —
    ohne Neuaufbau stünde die stornierte Position als nummerierte GoBD-Position
    auf der Rechnung (Fund vom 14.08.2026)."""
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
                "gross_amount": "1150.00",
                "paid_amount": "0",
                "currency": "DKK",
            }
        ]
    )
    # Der Neuaufbau rechnet echte Positionen — dafür braucht er Profil, Währung
    # und einen Steuersatz (nichts davon wird erfunden, Wurzel 4).
    db.tables["reservations"][0]["total_amount"] = 1000.0
    db.tables["reservations"][0]["currency"] = "DKK"
    db.tables["reservations"][0]["checked_in_at"] = None
    db.tables["tenant_billing_profile"] = [
        {
            "tenant_id": "t-1",
            "legal_name": "Testbetrieb",
            "is_kleinunternehmer": False,
            "lodging_tax_rate": "25.00",
            "default_payment_days": 14,
        }
    ]
    db.tables["property_pricing_config"] = [
        {"property_id": "prop-1", "taxes": [], "currency": "DKK"}
    ]
    db.tables["invoice_line_items"] = [
        {"invoice_id": "inv-1", "position": 1, "description": "Wäschepaket"}
    ]
    svc = AddonsService(service_client=db)
    assert svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND).status == "cancelled"
    # Die Positionen wurden ersetzt — die stornierte ist nicht mehr dabei.
    beschreibungen = [
        str(r.get("description") or "") for r in db.tables["invoice_line_items"]
    ]
    assert not any("Wäschepaket" in b for b in beschreibungen)
    # Und die Summe des Entwurfs steht auf dem neuen Stand (nur Unterkunft).
    assert db.tables["invoices"][0]["gross_amount"] == "1000.00"


def test_storno_ueberschreibt_keinen_handgeschriebenen_beleg() -> None:
    """Nur ein echter Entwurf (draft, keine Nummer, nicht gesperrt) wird neu gebaut.

    „Rechnung aus Buchung" erlaubt eigene Beschreibungen, Rabatte und manuelle
    Beträge und trägt dieselbe reservation_id. Ein Gate nur auf die
    Rechnungsnummer hätte diese Positionen beim Addon-Storno gelöscht und aus dem
    Bestand neu erzeugt — ohne Warnung, während der Nutzer nur eine
    Zusatzleistung storniert hat."""
    for abweichung in (
        {"status": "sent"},
        {"status": "draft", "is_locked": True},
    ):
        db = _cancel_db(
            invoices=[
                {
                    "id": "inv-1",
                    "tenant_id": "t-1",
                    "reservation_id": "res-1",
                    "invoice_type": "invoice",
                    "invoice_number": None,
                    "deleted_at": None,
                    **abweichung,
                }
            ]
        )
        db.tables["invoice_line_items"] = [
            {
                "invoice_id": "inv-1",
                "position": 1,
                "description": "Handgeschriebene Position",
            }
        ]
        svc = AddonsService(service_client=db)
        assert svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND).status == "cancelled"
        # Der Beleg ist unangetastet.
        assert db.tables["invoice_line_items"] == [
            {
                "invoice_id": "inv-1",
                "position": 1,
                "description": "Handgeschriebene Position",
            }
        ], abweichung


def test_storno_gilt_auch_wenn_der_rechnungsentwurf_nicht_neu_gebaut_werden_kann(
) -> None:
    """Kein halber Zustand nach außen: Das Storno ist geschrieben, bevor der
    Entwurf angefasst wird (der Neuaufbau BRAUCHT den neuen Stand). Scheitert er
    — hier: kein Firmenprofil —, darf der Nutzer keinen Fehler-Toast über eine
    Aktion sehen, die stattgefunden hat, sonst löst er sie erneut aus."""
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
    # tenant_billing_profile fehlt bewusst → rebuild wirft 422.
    svc = AddonsService(service_client=db)
    res = svc.cancel_reservation_addon(_ctx(), "ra-1", _GRUND)
    assert res.status == "cancelled"
    assert res.cancel_reason == _GRUND
    assert db.tables["reservation_addons"][0]["status"] == "cancelled"


def test_cancel_addon_foreign_tenant_rejected() -> None:
    """Wurzel 3: service_role umgeht RLS — der Tenant-Scope muss explizit greifen."""
    svc = AddonsService(service_client=_cancel_db())
    fremd = AuthContext(user_id="u-2", tenant_id="t-2", role="admin")
    with pytest.raises(AddonError) as exc:
        svc.cancel_reservation_addon(fremd, "ra-1", _GRUND)
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


# --- Verteilung: Bibliothek + „Zu anderen Objekten hinzufügen" ---------------
#
# Das Gegenstück zu Gebühren/Steuern für Zusatzleistungen: dieselbe Leistung
# auf mehreren Objekten pflegen, ohne sie achtzehnmal abzutippen.


def _verteil_db(**over: object) -> _DB:
    """Zwei Objekte in EUR, eines in DKK, eines ganz ohne Rate-Plan."""
    tables: dict[str, list[dict]] = {
        "properties": [
            {"id": "prop-1", "tenant_id": "t-1", "title": "Villa"},
            {"id": "prop-2", "tenant_id": "t-1", "title": "Ferienhaus"},
            {"id": "prop-dkk", "tenant_id": "t-1", "title": "Kornblomst"},
            {"id": "prop-ohne", "tenant_id": "t-1", "title": "Neubau"},
            {"id": "prop-fremd", "tenant_id": "t-2", "title": "Fremd"},
        ],
        "rate_plans": [
            {"property_id": "prop-1", "currency": "EUR"},
            {"property_id": "prop-2", "currency": "EUR"},
            {"property_id": "prop-dkk", "currency": "DKK"},
            {"property_id": "prop-fremd", "currency": "EUR"},
        ],
        "property_addons": [_catalog_row(price=12.0, basis="per_guest")],
    }
    tables.update(over)  # type: ignore[arg-type]
    return _DB(tables)


def test_apply_addon_copies_to_other_property() -> None:
    db = _verteil_db()
    svc = AddonsService(service_client=db)
    res = svc.apply_addon_to_properties(_ctx(), "addon-1", ["prop-2"])
    assert res["applied_to"] == ["prop-2"]
    ziel = svc.list_for_property(_ctx(), "prop-2")
    assert ziel.total == 1
    kopie = ziel.items[0]
    # Kopie, keine Verknüpfung: eigene Kennung, gleicher Inhalt.
    assert kopie.id != "addon-1"
    assert kopie.price == 12.0 and kopie.basis == "per_guest"
    assert kopie.name == {"de": "Frühstück"}


def test_apply_addon_is_idempotent() -> None:
    """Wurzel 2: Doppelklick legt keine zweite „Frühstück"-Zeile an."""
    db = _verteil_db()
    svc = AddonsService(service_client=db)
    svc.apply_addon_to_properties(_ctx(), "addon-1", ["prop-2"])
    svc.apply_addon_to_properties(_ctx(), "addon-1", ["prop-2"])
    assert svc.list_for_property(_ctx(), "prop-2").total == 1


def test_apply_addon_rejects_other_currency_before_writing() -> None:
    """Wurzel 4: 12 EUR sind nicht 12 DKK — und kein Ziel wird halb beschrieben."""
    db = _verteil_db()
    svc = AddonsService(service_client=db)
    with pytest.raises(AddonError) as exc:
        svc.apply_addon_to_properties(_ctx(), "addon-1", ["prop-2", "prop-dkk"])
    assert exc.value.status_code == 422
    # prop-2 stand VOR dem DKK-Objekt in der Liste und darf trotzdem leer sein.
    assert svc.list_for_property(_ctx(), "prop-2").total == 0


def test_apply_addon_rejects_property_without_currency() -> None:
    db = _verteil_db()
    svc = AddonsService(service_client=db)
    with pytest.raises(AddonError) as exc:
        svc.apply_addon_to_properties(_ctx(), "addon-1", ["prop-ohne"])
    assert exc.value.status_code == 422


def test_apply_addon_foreign_property_rejected() -> None:
    """Wurzel 3: service_role umgeht RLS — jede Ziel-ID einzeln gescopt."""
    db = _verteil_db()
    svc = AddonsService(service_client=db)
    with pytest.raises(AddonError) as exc:
        svc.apply_addon_to_properties(_ctx(), "addon-1", ["prop-fremd"])
    assert exc.value.status_code == 404
    assert db.tables["property_addons"] == [
        r for r in db.tables["property_addons"] if str(r["property_id"]) == "prop-1"
    ]


def test_apply_addon_foreign_addon_rejected() -> None:
    db = _verteil_db()
    svc = AddonsService(service_client=db)
    fremd = AuthContext(user_id="u-2", tenant_id="t-2", role="admin")
    with pytest.raises(AddonError) as exc:
        svc.apply_addon_to_properties(fremd, "addon-1", ["prop-fremd"])
    assert exc.value.status_code == 404


def test_apply_addon_skips_source_property() -> None:
    """Das Quellobjekt in der Zielliste ist ein No-op, kein Duplikat."""
    db = _verteil_db()
    svc = AddonsService(service_client=db)
    res = svc.apply_addon_to_properties(_ctx(), "addon-1", ["prop-1"])
    assert res["applied_to"] == []
    assert svc.list_for_property(_ctx(), "prop-1").total == 1


def test_addon_library_lists_other_properties_same_currency() -> None:
    db = _verteil_db(
        property_addons=[
            _catalog_row(price=12.0, basis="per_guest"),
            _catalog_row(
                id="addon-dkk",
                property_id="prop-dkk",
                name={"de": "Wäschepaket"},
                price=795.0,
                basis="per_stay",
            ),
        ]
    )
    svc = AddonsService(service_client=db)
    lib = svc.addon_library(_ctx(), "prop-2")
    assert lib["currency"] == "EUR"
    # Nur das EUR-Objekt; die DKK-Leistung ist kein übernehmbarer Betrag.
    assert [e["addon"]["name"] for e in lib["items"]] == [{"de": "Frühstück"}]
    assert lib["items"][0]["property_title"] == "Villa"


def test_addon_library_hides_what_target_already_has() -> None:
    db = _verteil_db(
        property_addons=[
            _catalog_row(price=12.0, basis="per_guest"),
            _catalog_row(id="addon-2", property_id="prop-2", price=12.0, basis="per_guest"),
        ]
    )
    svc = AddonsService(service_client=db)
    assert svc.addon_library(_ctx(), "prop-2")["items"] == []


def test_addon_library_dedupes_same_service_across_properties() -> None:
    """Dieselbe Leistung auf zwei Objekten erscheint EINMAL in der Auswahl."""
    db = _verteil_db(
        property_addons=[
            _catalog_row(price=12.0, basis="per_guest"),
            _catalog_row(id="addon-2", property_id="prop-2", price=12.0, basis="per_guest"),
        ]
    )
    svc = AddonsService(service_client=db)
    # prop-ohne hat keine Währung → leer; also über ein drittes EUR-Objekt prüfen.
    db.tables["rate_plans"].append({"property_id": "prop-ohne", "currency": "EUR"})
    lib = svc.addon_library(_ctx(), "prop-ohne")
    assert len(lib["items"]) == 1


def test_addon_library_empty_without_target_currency() -> None:
    """Ohne Währung am Ziel gibt es nichts zu übernehmen — kein geratenes EUR."""
    db = _verteil_db()
    svc = AddonsService(service_client=db)
    lib = svc.addon_library(_ctx(), "prop-ohne")
    assert lib["currency"] is None and lib["items"] == []


def test_addon_library_foreign_property_rejected() -> None:
    db = _verteil_db()
    svc = AddonsService(service_client=db)
    with pytest.raises(AddonError) as exc:
        svc.addon_library(_ctx(), "prop-fremd")
    assert exc.value.status_code == 404
