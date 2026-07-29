"""Tests für den subscriptions-Slice (Abo-Billing Tenant → myNextDays).

Stripe-Aufrufe gehen gegen die ECHTE Stripe-Test-API (Sandbox), kein Mock —
Voraussetzung ist ein ``sk_test_...``-Key in der Umgebung (.env). Ohne Key werden
die netzabhängigen Tests übersprungen. Die DB ist ein In-Memory-Fake (Muster wie
der payments-Slice). Prüft: Health, echte Preisliste (PDF-Beträge), Tenant-Scope,
Webhook-Sync (Abo + Modul-Entitlements, Gegenzustand), Idempotenz.
"""
from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from stripe import StripeError as _StripeError

from src.core.config import get_settings
from src.core.security import AuthContext
from src.features.payments.webhook import handle_stripe_event
from src.features.subscriptions.service import (
    SubscriptionsError,
    SubscriptionsService,
)
from src.main import create_app

client = TestClient(create_app())
_CTX = AuthContext(user_id="u", tenant_id="t1")


def _stripe_key() -> str | None:
    key = get_settings().stripe_secret_key.get_secret_value()
    return key if key.startswith("sk_test_") else None


_needs_stripe = pytest.mark.skipif(
    _stripe_key() is None, reason="kein sk_test_-Key (Stripe-Sandbox) gesetzt"
)


# --- Minimaler In-Memory-DB-Fake ------------------------------------------
class _Query:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows
        self._filters: list[tuple[str, Any]] = []
        self._count = False

    def select(self, *_a: Any, count: str | None = None, **_k: Any) -> _Query:
        self._count = count is not None
        return self

    def eq(self, col: str, val: Any) -> _Query:
        self._filters.append((col, val))
        return self

    def limit(self, _n: int) -> _Query:
        return self

    def _matched(self) -> list[dict[str, Any]]:
        out = self._rows
        for col, val in self._filters:
            out = [r for r in out if r.get(col) == val]
        return out

    def execute(self) -> Any:
        matched = self._matched()

        class _Res:
            data = matched
            count = len(matched)

        return _Res()


class _Table:
    def __init__(self, store: dict[str, list[dict[str, Any]]], name: str) -> None:
        self._store = store
        self._name = name

    def _rows(self) -> list[dict[str, Any]]:
        return self._store.setdefault(self._name, [])

    def select(self, *a: Any, **k: Any) -> _Query:
        return _Query(self._rows()).select(*a, **k)

    def upsert(
        self,
        payload: dict[str, Any],
        *,
        on_conflict: str = "",
        ignore_duplicates: bool = False,
        **_k: Any,
    ) -> _Table:
        self._pending = ("upsert", payload, on_conflict, ignore_duplicates)
        return self

    def update(self, payload: dict[str, Any]) -> _Table:
        self._pending = ("update", payload, [])
        return self

    def insert(self, payload: dict[str, Any]) -> _Table:
        self._pending = ("insert", payload, [])
        return self

    def delete(self) -> _Table:
        self._pending = ("delete", None, [])
        return self

    def eq(self, col: str, val: Any) -> _Table:
        pending = getattr(self, "_pending", None)
        if pending and pending[0] in ("update", "delete"):
            pending[2].append((col, val))
        return self

    def is_(self, col: str, _val: str) -> _Table:
        """Nur `is null` wird gebraucht (Guard „customer-ID noch leer")."""
        pending = getattr(self, "_pending", None)
        if pending and pending[0] == "update":
            pending[2].append((col, None))
        return self

    def execute(self) -> Any:
        pending = getattr(self, "_pending", None)
        changed: list[dict[str, Any]] = []
        if pending and pending[0] == "update":
            _, payload, filters = pending
            for r in self._rows():
                if all(r.get(c) == v for c, v in filters):
                    r.update(payload)
                    changed.append(r)
        elif pending and pending[0] == "insert":
            _, payload, _f2 = pending
            new_row = dict(payload)
            # DB-Defaults nachbilden, die Postgres setzt (Fake hat keine DDL):
            # commission_ledger.id DEFAULT gen_random_uuid(), status 'pending'.
            if self._name == "commission_ledger":
                new_row.setdefault("status", "pending")
                new_row.setdefault("id", f"cl_{len(self._rows()) + 1}")
            self._rows().append(new_row)
            changed = [self._rows()[-1]]
        elif pending and pending[0] == "delete":
            _, _p, filters = pending
            keep = [r for r in self._rows() if not all(
                r.get(c) == v for c, v in filters)]
            changed = [r for r in self._rows() if r not in keep]
            self._store[self._name] = keep
        elif pending and pending[0] == "upsert":
            _, payload, on_conflict, ignore_dup = pending
            keys = [c.strip() for c in on_conflict.split(",")] if on_conflict else []
            rows = self._rows()
            match = None
            if keys:
                for r in rows:
                    if all(r.get(k) == payload.get(k) for k in keys):
                        match = r
                        break
            if match is not None:
                if ignore_dup:
                    changed = []  # Duplikat übersprungen (Backstop, Wurzel 2)
                else:
                    match.update(payload)
                    changed = [match]
            else:
                rows.append(dict(payload))
                changed = [rows[-1]]
        self._pending = None

        class _Res:
            data = changed

        return _Res()


class _DB:
    def __init__(self) -> None:
        self.store: dict[str, list[dict[str, Any]]] = {
            "tenant_subscription": [],
            "tenant_module_entitlement": [],
            "commission_ledger": [],
            "properties": [],
            "tenants": [{"id": "t1", "name": "Test GmbH"}],
        }

    def table(self, name: str) -> _Table:
        return _Table(self.store, name)


# --- Tests -----------------------------------------------------------------
def test_health() -> None:
    resp = client.get("/api/v1/subscriptions/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_status_requires_tenant() -> None:
    svc = SubscriptionsService(service_client=_DB())
    with pytest.raises(SubscriptionsError) as exc:
        svc.get_status(AuthContext(user_id="u", tenant_id=None))
    assert exc.value.status_code == 403


def test_active_property_count_only_active() -> None:
    db = _DB()
    db.store["properties"] = [
        {"id": "p1", "tenant_id": "t1", "status": "active"},
        {"id": "p2", "tenant_id": "t1", "status": "draft"},
        {"id": "p3", "tenant_id": "t1", "status": "inactive"},
        {"id": "p4", "tenant_id": "t2", "status": "active"},  # anderer Tenant
    ]
    svc = SubscriptionsService(service_client=db)
    # nur p1 zählt (active + tenant t1)
    assert svc._active_property_count(db, "t1") == 1  # noqa: SLF001


@_needs_stripe
def test_pricing_matches_pdf() -> None:
    """Die aus Stripe gelesenen Beträge müssen der Preisliste entsprechen
    (Grundtarif graduated 19,90/6/5/4 €; Module). Sonst ist die Preisliste
    nicht/falsch geseedet."""
    svc = SubscriptionsService()
    pr = svc.get_pricing()
    assert pr.currency == "EUR"
    tiers = pr.grundtarif_tiers
    assert tiers[0].flat_amount == 1990
    assert tiers[1].unit_amount == 600
    assert tiers[2].unit_amount == 500
    assert tiers[-1].unit_amount == 400
    by_key = {m.lookup_key: m.unit_amount for m in pr.modules}
    assert by_key["modul3_flat"] == 3000
    assert by_key["modul4_flat"] == 1990
    assert by_key["modul4_per_seat"] == 250
    assert by_key["modul6_flat"] == 60000
    assert by_key["modul6_per_room"] == 150


def _sub_event(event_id: str, status: str, module_lookups: list[str]) -> dict[str, Any]:
    items = [
        {"id": "si_gt", "quantity": 3,
         "price": {"lookup_key": "mnd_grundtarif_month"}},
    ]
    for i, lk in enumerate(module_lookups):
        items.append({"id": f"si_{i}", "quantity": 1, "price": {"lookup_key": lk}})
    return {
        "id": event_id,
        "type": "customer.subscription.updated",
        "data": {"object": {
            "id": "sub_1",
            "status": status,
            "customer": "cus_1",
            "cancel_at_period_end": False,
            "current_period_end": 1893456000,
            "metadata": {"tenant_id": "t1"},
            "items": {"data": items},
        }},
    }


def test_webhook_syncs_subscription_and_modules() -> None:
    db = _DB()
    handle_stripe_event(
        db, _sub_event("evt_1", "active", ["modul3_flat"]), now_iso="2026-07-07T00:00:00Z"
    )
    subs = db.store["tenant_subscription"]
    assert len(subs) == 1
    assert subs[0]["status"] == "active"
    assert subs[0]["reported_property_count"] == 3  # quantity des Grundtarifs
    ents = db.store["tenant_module_entitlement"]
    assert any(e["module_key"] == "modul3_buchhaltung" and e["active"] for e in ents)


def test_webhook_deactivates_removed_module() -> None:
    """Gegenzustand (Wurzel 1): ein Modul, das nicht mehr in der Subscription
    steht, wird deaktiviert — nicht gelöscht."""
    db = _DB()
    handle_stripe_event(
        db, _sub_event("evt_a", "active", ["modul3_flat", "modul6_flat"]),
        now_iso="2026-07-07T00:00:00Z",
    )
    # zweites Event ohne modul6 → modul6 muss inaktiv werden
    handle_stripe_event(
        db, _sub_event("evt_b", "active", ["modul3_flat"]),
        now_iso="2026-07-07T00:01:00Z",
    )
    ents = {e["module_key"]: e["active"] for e in db.store["tenant_module_entitlement"]}
    assert ents["modul3_buchhaltung"] is True
    assert ents["modul6_hotel"] is False  # deaktiviert, nicht gelöscht
    assert "modul6_hotel" in ents  # noch vorhanden (Historie)


def test_checkout_blocked_when_active_subscription() -> None:
    """Kein zweites Abo bei bereits laufendem (Wurzel 2) → 409."""
    db = _DB()
    db.store["tenant_subscription"] = [
        {"tenant_id": "t1", "stripe_customer_id": "cus_1",
         "stripe_subscription_id": "sub_1", "status": "active"},
    ]
    svc = SubscriptionsService(service_client=db)
    with pytest.raises(SubscriptionsError) as exc:
        svc.create_checkout(
            _CTX, module_keys=[], success_url="https://x/ok", cancel_url="https://x/no"
        )
    assert exc.value.status_code == 409


def test_webhook_idempotent_duplicate() -> None:
    """Zweite Zustellung derselben Event-ID wird übersprungen (Wurzel 2)."""
    db = _DB()
    db.store["stripe_webhook_event"] = []
    ev = _sub_event("evt_dup", "active", ["modul3_flat"])
    r1 = handle_stripe_event(db, ev, now_iso="2026-07-07T00:00:00Z")
    r2 = handle_stripe_event(db, ev, now_iso="2026-07-07T00:00:01Z")
    assert r1["status"] == "ok"
    assert r2["status"] == "duplicate"
    # Nur eine Subscription-Zeile trotz zwei Zustellungen.
    assert len(db.store["tenant_subscription"]) == 1


# --- Externe Provision (1 %/0,5 %) -----------------------------------------
def _db_with_properties(active_count: int) -> _DB:
    db = _DB()
    db.store["properties"] = [
        {"id": f"p{i}", "tenant_id": "t1", "status": "active"}
        for i in range(active_count)
    ]
    return db


def test_commission_rate_staffel() -> None:
    """1 % bis 100 Objekte, 0,5 % ab 101 (Preisliste)."""
    svc100 = SubscriptionsService(service_client=_db_with_properties(100))
    assert svc100.commission_rate_for_tenant(svc100._db, "t1") == 0.01  # noqa: SLF001
    svc101 = SubscriptionsService(service_client=_db_with_properties(101))
    assert svc101.commission_rate_for_tenant(svc101._db, "t1") == 0.005  # noqa: SLF001


def test_record_commission_only_external_and_idempotent() -> None:
    db = _db_with_properties(5)  # 1 %
    svc = SubscriptionsService(service_client=db)
    # Portal-Buchung → KEINE Provisionszeile (trägt die 8 % Portal-Fee).
    svc.record_commission("t1", reservation_id="r-portal", channel="portal",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 0
    # OTA-Buchung 200 € → 1 % = 2,00 €.
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 1
    assert db.store["commission_ledger"][0]["commission_amount"] == 2.0
    # Resync derselben Buchung → KEINE zweite Zeile (Idempotenz, Wurzel 2).
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 1


def test_record_commission_updates_amount_while_pending() -> None:
    db = _db_with_properties(5)
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="r1", channel="airbnb",
                          gross_amount=100.0, currency="EUR")
    # OTA-Preisänderung vor Abrechnung → Betrag wird nachgezogen (noch pending).
    svc.record_commission("t1", reservation_id="r1", channel="airbnb",
                          gross_amount=300.0, currency="EUR")
    row = db.store["commission_ledger"][0]
    assert row["gross_amount"] == 300.0
    assert row["commission_amount"] == 3.0


def test_record_commission_removes_line_on_zero_amount() -> None:
    """Gegenzustand (Wurzel 1): fällt der Betrag beim Resync auf 0, muss die
    vorhandene offene Provisionszeile verschwinden (keine falsche Provision)."""
    db = _db_with_properties(5)
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 1
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=0.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 0


def test_record_commission_removes_line_on_channel_switch() -> None:
    """Gegenzustand (Wurzel 1): wird die Buchung von extern auf portal korrigiert,
    muss die externe Provisionszeile weg (portal trägt die 8 % Portal-Fee)."""
    db = _db_with_properties(5)
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 1
    svc.record_commission("t1", reservation_id="r1", channel="portal",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 0


def test_cancel_commission_removes_pending() -> None:
    db = _db_with_properties(5)
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="r1", channel="vrbo",
                          gross_amount=200.0, currency="EUR")
    svc.cancel_commission("t1", reservation_id="r1")
    assert len(db.store["commission_ledger"]) == 0


def test_record_commission_needs_currency() -> None:
    db = _db_with_properties(5)
    svc = SubscriptionsService(service_client=db)
    with pytest.raises(SubscriptionsError) as exc:
        svc.record_commission("t1", reservation_id="r1", channel="booking",
                              gross_amount=200.0, currency="")
    assert exc.value.status_code == 422


def test_bill_mixed_currency_fails() -> None:
    db = _db_with_properties(5)
    db.store["tenant_subscription"] = [
        {"tenant_id": "t1", "stripe_customer_id": "cus_x"}]
    db.store["commission_ledger"] = [
        {"id": "c1", "tenant_id": "t1", "currency": "EUR",
         "commission_amount": 2.0, "status": "pending"},
        {"id": "c2", "tenant_id": "t1", "currency": "DKK",
         "commission_amount": 3.0, "status": "pending"},
    ]
    svc = SubscriptionsService(service_client=db)
    with pytest.raises(SubscriptionsError) as exc:
        svc.bill_pending_commissions("t1", period="2026-07")
    assert exc.value.status_code == 409


@_needs_stripe
def test_bill_commissions_creates_stripe_invoice_item() -> None:
    """E2E gegen echte Stripe-Test-API: offene Provisionen werden als Invoice-Item
    aufs Abo gebucht und die Zeilen auf 'invoiced' gesetzt. Gegengelesen aus
    Stripe (Betrag stimmt), inkl. Idempotenz (zweiter Lauf berechnet nichts neu)."""
    stripe = SubscriptionsService()._stripe  # echter Client aus der Env  # noqa: SLF001
    customer = stripe.v1.customers.create(params={"name": "E2E Provision"})
    db = _db_with_properties(5)
    db.store["tenant_subscription"] = [
        {"tenant_id": "t1", "stripe_customer_id": customer["id"]}]
    db.store["commission_ledger"] = [
        {"id": "c1", "tenant_id": "t1", "currency": "EUR",
         "commission_amount": 2.0, "status": "pending"},
        {"id": "c2", "tenant_id": "t1", "currency": "EUR",
         "commission_amount": 3.5, "status": "pending"},
    ]
    svc = SubscriptionsService(service_client=db, stripe=stripe)
    # period pro Lauf eindeutig (aus der frischen Customer-ID abgeleitet): der
    # deterministische Stripe-idempotency_key comm:t1:<period> darf nicht über
    # Testläufe hinweg mit anderen Parametern (neuer Customer) kollidieren.
    period = f"2026-07-{customer['id'][-8:]}"
    n = svc.bill_pending_commissions("t1", period=period)
    assert n == 2
    # Beide Zeilen jetzt invoiced + Item-ID gesetzt.
    assert all(r["status"] == "invoiced" for r in db.store["commission_ledger"])
    item_id = db.store["commission_ledger"][0]["stripe_invoice_item_id"]
    item = stripe.v1.invoice_items.retrieve(item_id)
    # 2,00 + 3,50 = 5,50 € = 550 Cent, aus Stripe gegengelesen.
    assert item["amount"] == 550
    # Idempotenz: zweiter Lauf findet keine pending mehr → 0.
    assert svc.bill_pending_commissions("t1", period=period) == 0


# --- Verwaiste Stripe-Customer-ID (realer Vorfall) -------------------------
# Die DB hielt cus_UqH4XY0CiBtUjk, bei Stripe war der Kunde gelöscht. Folge:
# /billing-address UND /checkout antworteten dauerhaft mit 400 ("No such
# customer") — der Betrieb kam nicht mehr an sein Abo. Eine gespeicherte ID
# kann immer ins Leere zeigen (Testdaten-Reset, Account-/Key-Wechsel).


class _StripeFehlt(_StripeError):
    """Stellt stripe.InvalidRequestError mit code='resource_missing' nach.
    MUSS von StripeError erben — der Service fängt gezielt diesen Typ."""

    def __init__(self, msg: str = "No such customer") -> None:
        super().__init__(msg)
        self.code = "resource_missing"


class _FakeCustomers:
    def __init__(self, existiert: bool, *, neue_id: str = "cus_neu") -> None:
        self._existiert = existiert
        self._neue_id = neue_id
        self.angelegt: list[dict[str, Any]] = []

    def retrieve(self, cid: str, params: dict | None = None) -> dict:  # noqa: ARG002
        if not self._existiert:
            raise _StripeFehlt
        return {"id": cid, "address": {}, "metadata": {}, "name": None}

    def create(self, params: dict) -> dict:
        self.angelegt.append(params)
        return {"id": self._neue_id}

    def delete(self, cid: str) -> dict:
        return {"id": cid, "deleted": True}


class _FakeStripeV1:
    def __init__(self, customers: _FakeCustomers) -> None:
        self.customers = customers


class _FakeStripe:
    """Nur so viel Stripe, wie die Customer-Heilung berührt."""

    def __init__(self, existiert: bool) -> None:
        self.v1 = _FakeStripeV1(_FakeCustomers(existiert))


def _db_mit_customer(cid: str) -> _DB:
    db = _db_with_properties(1)
    db.store["tenant_subscription"] = [
        {"tenant_id": "t1", "stripe_customer_id": cid}
    ]
    db.store["tenants"] = [{"id": "t1", "name": "Testbetrieb"}]
    return db


def test_billing_address_bei_verwaister_id_ist_leer_statt_fehler() -> None:
    """KRITISCH: der Vorfall. Zeigt die gespeicherte ID ins Leere, muss die
    Seite laden (leere Adresse) statt mit 400 zu blockieren."""
    db = _db_mit_customer("cus_weg")
    svc = SubscriptionsService(service_client=db, stripe=_FakeStripe(False))
    addr = svc.get_billing_address(_CTX)
    assert addr.line1 is None
    assert addr.account_type == "individual"


def test_ensure_customer_legt_bei_verwaister_id_neu_an() -> None:
    """Checkout muss wieder funktionieren: verwaiste ID verwerfen, neuen Kunden
    anlegen und die neue ID persistieren."""
    db = _db_mit_customer("cus_weg")
    stripe = _FakeStripe(False)
    svc = SubscriptionsService(service_client=db, stripe=stripe)
    neue = svc._ensure_customer(db, "t1")  # noqa: SLF001
    assert neue == "cus_neu"
    assert len(stripe.v1.customers.angelegt) == 1
    # Die neue ID steht in der DB — die verwaiste ist weg.
    assert db.store["tenant_subscription"][0]["stripe_customer_id"] == "cus_neu"


def test_ensure_customer_verwendet_existierende_id_wieder() -> None:
    """Gegenprobe: existiert der Kunde, wird KEIN zweiter angelegt (Wurzel 2)."""
    db = _db_mit_customer("cus_ok")
    stripe = _FakeStripe(True)
    svc = SubscriptionsService(service_client=db, stripe=stripe)
    assert svc._ensure_customer(db, "t1") == "cus_ok"  # noqa: SLF001
    assert stripe.v1.customers.angelegt == []


def test_customer_exists_reicht_andere_stripe_fehler_durch() -> None:
    """Ein Netz-/Auth-Fehler darf NICHT als 'Kunde weg' gelten — sonst entstünde
    bei einer Stripe-Störung ein zweiter Kunde für denselben Tenant."""

    class _Kaputt(_StripeError):
        code = "api_error"

    class _CustomersKaputt(_FakeCustomers):
        def retrieve(self, cid: str, params: dict | None = None) -> dict:  # noqa: ARG002
            raise _Kaputt

    stripe = _FakeStripe(True)
    stripe.v1.customers = _CustomersKaputt(True)
    svc = SubscriptionsService(service_client=_db_mit_customer("c"), stripe=stripe)
    with pytest.raises(SubscriptionsError):
        svc._customer_exists("cus_x")  # noqa: SLF001
