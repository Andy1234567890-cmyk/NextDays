"""Tests für den subscriptions-Slice (Abo-Billing Tenant → myNextDays).

Stripe-Aufrufe gehen gegen die ECHTE Stripe-Test-API (Sandbox), kein Mock —
Voraussetzung ist ein ``sk_test_...``-Key in der Umgebung (.env). Ohne Key werden
die netzabhängigen Tests übersprungen. Die DB ist ein In-Memory-Fake (Muster wie
der payments-Slice). Prüft: Health, echte Preisliste (PDF-Beträge), Tenant-Scope,
Webhook-Sync (Abo + Modul-Entitlements, Gegenzustand), Idempotenz.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from stripe import StripeError as _StripeError

from src.core.config import get_settings
from src.core.security import AuthContext
from src.features.payments.webhook import handle_stripe_event
from src.features.subscriptions.gratismonat import gratismonat_ende
from src.features.subscriptions.schemas import TESTPHASE_TAGE
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
        self._in: list[tuple[str, set[Any]]] = []
        self._range: tuple[int, int] | None = None
        self._count = False

    def select(self, *_a: Any, count: str | None = None, **_k: Any) -> _Query:
        self._count = count is not None
        return self

    def eq(self, col: str, val: Any) -> _Query:
        self._filters.append((col, val))
        return self

    def in_(self, col: str, werte: list[Any]) -> _Query:
        """Mengenfilter — die Aufstellung lädt die Reservierungen so nach."""
        self._in.append((col, set(werte)))
        return self

    def order(self, _col: str, *, desc: bool = False, **_k: Any) -> _Query:
        """Sortierung wird nicht nachgebaut: die Aufstellung gruppiert und
        summiert, das Ergebnis hängt nicht an der Reihenfolge. Die Methode muss
        aber existieren, sonst bricht die Kette."""
        return self

    def limit(self, _n: int) -> _Query:
        return self

    def range(self, von: int, bis: int) -> _Query:
        """Seitenweises Lesen, wie `fetch_all_rows` es fährt (beide Enden
        inklusiv). Echt umgesetzt, nicht als No-op: gäbe der Fake bei jeder
        Seite dieselben Zeilen zurück, liefe die Schleife dort ewig."""
        self._range = (von, bis)
        return self

    def _matched(self) -> list[dict[str, Any]]:
        out = self._rows
        for col, val in self._filters:
            out = [r for r in out if r.get(col) == val]
        for col, werte in self._in:
            out = [r for r in out if r.get(col) in werte]
        if self._range is not None:
            von, bis = self._range
            out = out[von : bis + 1]
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
            if self._name == "dynpricing_ledger":
                new_row.setdefault("status", "pending")
                new_row.setdefault("id", f"dl_{len(self._rows()) + 1}")
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
    # Nutzungsabhängiges Modul: KEIN Monatsbetrag, sondern ein Prozentsatz.
    # Die UI muss den Satz zeigen können, ohne einen Cent-Betrag zu erfinden.
    dyn = next(m for m in pr.modules if m.module_key == "dynamische_preise")
    assert dyn.unit_amount == 0
    assert dyn.usage_percent == 0.5


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


# --- Externe Provision (0,5 %) ---------------------------------------------
def _db_with_properties(active_count: int) -> _DB:
    db = _DB()
    db.store["properties"] = [
        {"id": f"p{i}", "tenant_id": "t1", "status": "active"}
        for i in range(active_count)
    ]
    return db


ABO_BEGINN = "2026-01-01T00:00:00+00:00"


def _mit_reservierung(
    db: _DB,
    reservation_id: str,
    *,
    property_status: str = "active",
    check_in: str = "2026-06-15",
    abo_beginn: str | None = ABO_BEGINN,
) -> _DB:
    """Reservierung + Objekt + Abo anlegen. Provision hängt an DREI Dingen:
    Objektstatus (nur veröffentlichte Objekte), Aufenthalt ab Abo-Beginn (0504)
    und Kanal/Betrag. Jeder record_commission-Test braucht diese Kette —
    fehlt eine Stufe, greift fail-closed und es entsteht keine Zeile.

    `check_in` liegt per Vorgabe NACH `abo_beginn`, damit die bestehenden
    Tests genau das prüfen, wofür sie geschrieben wurden. Die Grenze selbst
    hat eigene Tests."""
    prop_id = f"prop-{reservation_id}"
    db.store.setdefault("properties", []).append(
        {"id": prop_id, "tenant_id": "t1", "status": property_status}
    )
    db.store.setdefault("reservations", []).append(
        {
            "id": reservation_id,
            "tenant_id": "t1",
            "property_id": prop_id,
            "check_in": check_in,
        }
    )
    if abo_beginn is not None and not db.store.get("tenant_subscription"):
        db.store["tenant_subscription"] = [
            {"tenant_id": "t1", "subscription_started_at": abo_beginn}
        ]
    return db


# --- Modul „Dynamische Preise" (0,5 %) — Mehrwährung ------------------------


def _db_mit_modul(*, aktiv: bool = True) -> _DB:
    db = _db_with_properties(5)
    db.store["tenant_module_entitlement"] = [
        {"tenant_id": "t1", "module_key": "dynamische_preise", "active": aktiv}
    ]
    return db


def test_dynpricing_ohne_modul_keine_zeile() -> None:
    """Ohne gebuchtes Modul entsteht keine Gebühr (fail-closed)."""
    db = _db_with_properties(5)  # gar keine Entitlement-Zeile
    svc = SubscriptionsService(service_client=db)
    svc.record_dynpricing_usage("t1", reservation_id="r1",
                                gross_amount=400.0, currency="EUR")
    assert db.store.get("dynpricing_ledger", []) == []
    # Gekündigtes Modul (active=False) zählt wie nicht gebucht.
    db2 = _db_mit_modul(aktiv=False)
    SubscriptionsService(service_client=db2).record_dynpricing_usage(
        "t1", reservation_id="r1", gross_amount=400.0, currency="EUR")
    assert db2.store.get("dynpricing_ledger", []) == []


def test_dynpricing_erfasst_waehrung_je_buchung() -> None:
    """Die Währung der BUCHUNG landet in der Zeile — nicht die des Abos.
    Genau das kann ein Stripe-Meter nicht (er ist währungslos)."""
    db = _db_mit_modul()
    svc = SubscriptionsService(service_client=db)
    svc.record_dynpricing_usage("t1", reservation_id="r-eur",
                                gross_amount=400.0, currency="EUR")
    svc.record_dynpricing_usage("t1", reservation_id="r-dkk",
                                gross_amount=3000.0, currency="DKK")
    zeilen = {z["reservation_id"]: z for z in db.store["dynpricing_ledger"]}
    assert zeilen["r-eur"]["currency"] == "EUR"
    assert zeilen["r-eur"]["fee_amount"] == 2.0     # 0,5 % von 400
    assert zeilen["r-dkk"]["currency"] == "DKK"
    assert zeilen["r-dkk"]["fee_amount"] == 15.0    # 0,5 % von 3000
    # KEINE Vermischung: die Beträge bleiben in ihrer eigenen Währung stehen.
    assert len(db.store["dynpricing_ledger"]) == 2


def test_dynpricing_idempotent_und_storno() -> None:
    """Resync erzeugt keine zweite Zeile (Wurzel 2); Storno entfernt die
    offene Zeile (Wurzel 1)."""
    db = _db_mit_modul()
    svc = SubscriptionsService(service_client=db)
    svc.record_dynpricing_usage("t1", reservation_id="r1",
                                gross_amount=400.0, currency="EUR")
    svc.record_dynpricing_usage("t1", reservation_id="r1",
                                gross_amount=500.0, currency="EUR")
    assert len(db.store["dynpricing_ledger"]) == 1
    # Solange pending, wird der Betrag nachgezogen (Preisänderung vor Rechnung).
    assert db.store["dynpricing_ledger"][0]["fee_amount"] == 2.5
    svc.cancel_dynpricing_usage("t1", reservation_id="r1")
    assert db.store["dynpricing_ledger"] == []


def test_dynpricing_fakturierte_zeile_unveraendert() -> None:
    """Eine bereits gestellte Gebühr wird weder geändert noch storniert —
    sonst verfälschte eine späte Preisänderung eine gestellte Rechnung."""
    db = _db_mit_modul()
    db.store["dynpricing_ledger"] = [
        {"id": "d1", "tenant_id": "t1", "reservation_id": "r1", "currency": "EUR",
         "gross_amount": 400.0, "rate": 0.005, "fee_amount": 2.0,
         "status": "invoiced"}
    ]
    svc = SubscriptionsService(service_client=db)
    svc.record_dynpricing_usage("t1", reservation_id="r1",
                                gross_amount=9999.0, currency="EUR")
    assert db.store["dynpricing_ledger"][0]["fee_amount"] == 2.0
    svc.cancel_dynpricing_usage("t1", reservation_id="r1")
    assert len(db.store["dynpricing_ledger"]) == 1


def test_dynpricing_ohne_waehrung_faellt_klar_durch() -> None:
    """Fehlende Währung ist ein Datenfehler → 422, kein EUR-Fallback (Wurzel 4)."""
    db = _db_mit_modul()
    svc = SubscriptionsService(service_client=db)
    with pytest.raises(SubscriptionsError) as exc:
        svc.record_dynpricing_usage("t1", reservation_id="r1",
                                    gross_amount=400.0, currency="")
    assert exc.value.status_code == 422


def test_commission_rate_einheitlich() -> None:
    """Einheitlich 0,5 %, unabhängig von der Objektzahl (Preisliste) — die
    frühere Staffel (1 % bis 100 Objekte) ist abgeschafft."""
    assert SubscriptionsService.commission_rate() == 0.005


def test_record_commission_only_external_and_idempotent() -> None:
    db = _db_with_properties(5)  # 0,5 %
    _mit_reservierung(db, "r-portal")
    _mit_reservierung(db, "r1")
    svc = SubscriptionsService(service_client=db)
    # Portal-Buchung → KEINE Provisionszeile (trägt die 8 % Portal-Fee).
    svc.record_commission("t1", reservation_id="r-portal", channel="portal",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 0
    # OTA-Buchung 200 € → 0,5 % = 1,00 €.
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 1
    assert db.store["commission_ledger"][0]["commission_amount"] == 1.0
    # Resync derselben Buchung → KEINE zweite Zeile (Idempotenz, Wurzel 2).
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 1


def test_record_commission_updates_amount_while_pending() -> None:
    db = _mit_reservierung(_db_with_properties(5), "r1")
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="r1", channel="airbnb",
                          gross_amount=100.0, currency="EUR")
    # OTA-Preisänderung vor Abrechnung → Betrag wird nachgezogen (noch pending).
    svc.record_commission("t1", reservation_id="r1", channel="airbnb",
                          gross_amount=300.0, currency="EUR")
    row = db.store["commission_ledger"][0]
    assert row["gross_amount"] == 300.0
    assert row["commission_amount"] == 1.5


def test_record_commission_removes_line_on_zero_amount() -> None:
    """Gegenzustand (Wurzel 1): fällt der Betrag beim Resync auf 0, muss die
    vorhandene offene Provisionszeile verschwinden (keine falsche Provision)."""
    db = _mit_reservierung(_db_with_properties(5), "r1")
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
    db = _mit_reservierung(_db_with_properties(5), "r1")
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 1
    svc.record_commission("t1", reservation_id="r1", channel="portal",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 0


def test_cancel_commission_removes_pending() -> None:
    db = _mit_reservierung(_db_with_properties(5), "r1")
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="r1", channel="vrbo",
                          gross_amount=200.0, currency="EUR")
    svc.cancel_commission("t1", reservation_id="r1")
    assert len(db.store["commission_ledger"]) == 0


def test_record_commission_needs_currency() -> None:
    db = _mit_reservierung(_db_with_properties(5), "r1")
    svc = SubscriptionsService(service_client=db)
    with pytest.raises(SubscriptionsError) as exc:
        svc.record_commission("t1", reservation_id="r1", channel="booking",
                              gross_amount=200.0, currency="")
    assert exc.value.status_code == 422


def test_record_commission_nur_veroeffentlichte_objekte() -> None:
    """Provision NUR für veröffentlichte Objekte (status='active'). Ein Entwurf
    ist nicht im Verkauf — eine OTA-Buchung darauf kostet keine Provision."""
    for status in ("draft", "inactive"):
        db = _mit_reservierung(_DB(), "r1", property_status=status)
        svc = SubscriptionsService(service_client=db)
        svc.record_commission("t1", reservation_id="r1", channel="booking",
                              gross_amount=200.0, currency="EUR")
        assert db.store["commission_ledger"] == []


def test_record_commission_entfernt_zeile_wenn_objekt_zurueckgezogen() -> None:
    """Gegenzustand (Wurzel 1): wird ein Objekt nach der Buchung zurückgezogen,
    muss die offene Provisionszeile beim nächsten Resync verschwinden."""
    db = _mit_reservierung(_DB(), "r1")
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 1
    for prop in db.store["properties"]:
        prop["status"] = "draft"  # Objekt zurückgezogen
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert db.store["commission_ledger"] == []


def test_provision_erst_ab_abo_beginn() -> None:
    """Aufenthalte VOR dem Abo-Beginn tragen keine Provision (0504).

    Der reale Anlass (30.08.2026): beim Verbinden des Portals zog ein Betrieb
    seine ganze Buchungshistorie mit — 25 Aufenthalte aus 2025 landeten in der
    August-Rechnung 2026, weil `record_commission` keine Datumsgrenze kannte.
    """
    db = _mit_reservierung(_DB(), "alt", check_in="2025-07-23")
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="alt", channel="booking",
                          gross_amount=2229.25, currency="DKK")
    assert db.store["commission_ledger"] == []


def test_provision_ab_dem_starttag_selbst() -> None:
    """Wer AM Starttag anreist, ist drin. Verglichen wird auf Tagesebene: der
    Abo-Beginn trägt eine Uhrzeit (Stripe-Zeitstempel), die Anreise ist ein
    reines Datum — die Uhrzeit des Vertragsabschlusses darf nicht darüber
    entscheiden, ob ein Aufenthalt zählt."""
    db = _mit_reservierung(
        _DB(), "r1", check_in="2026-08-07", abo_beginn="2026-08-07T18:27:39+00:00"
    )
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 1


def test_provision_ohne_abo_beginn_fail_closed() -> None:
    """Fehlt der Abo-Beginn oder der Aufenthalt, entsteht KEINE Provision
    (Wurzel 5). Ein fehlender Wert ist keine Erlaubnis — lieber nichts
    berechnen als etwas in Rechnung stellen, das wir nicht belegen können."""
    # (a) kein Abo hinterlegt
    ohne_abo = _mit_reservierung(_DB(), "r1", abo_beginn=None)
    SubscriptionsService(service_client=ohne_abo).record_commission(
        "t1", reservation_id="r1", channel="booking",
        gross_amount=200.0, currency="EUR")
    assert ohne_abo.store.get("commission_ledger", []) == []

    # (b) Abo da, aber die Reservierung trägt kein check_in (CSV-Import,
    #     Lodgify-Migration und manuelle Erfassung liefern Lücken).
    ohne_anreise = _mit_reservierung(_DB(), "r1")
    for res in ohne_anreise.store["reservations"]:
        res["check_in"] = None
    SubscriptionsService(service_client=ohne_anreise).record_commission(
        "t1", reservation_id="r1", channel="booking",
        gross_amount=200.0, currency="EUR")
    assert ohne_anreise.store.get("commission_ledger", []) == []


def test_provision_entfernt_zeile_bei_verschiebung_vor_abo_beginn() -> None:
    """Gegenzustand (Wurzel 1): wird ein Aufenthalt nachträglich in die Zeit
    VOR dem Abo verschoben, muss die offene Zeile verschwinden — dieselbe
    Linie wie beim zurückgezogenen Objekt."""
    db = _mit_reservierung(_DB(), "r1")
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert len(db.store["commission_ledger"]) == 1
    for res in db.store["reservations"]:
        res["check_in"] = "2025-03-03"  # zurück in die Zeit vor dem Abo
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert db.store["commission_ledger"] == []


def test_record_commission_fremder_tenant_bekommt_keine_provision() -> None:
    """Wurzel 3: service_role umgeht RLS. Eine Reservierung eines FREMDEN
    Tenants darf keine Provisionszeile erzeugen (fail-closed)."""
    db = _mit_reservierung(_DB(), "r1")
    for res in db.store["reservations"]:
        res["tenant_id"] = "t2"
    svc = SubscriptionsService(service_client=db)
    svc.record_commission("t1", reservation_id="r1", channel="booking",
                          gross_amount=200.0, currency="EUR")
    assert db.store["commission_ledger"] == []


def test_deckel_gleiche_waehrung_ohne_kurs() -> None:
    """250-€-Monatsdeckel: bei EUR wird kein Wechselkurs gebraucht."""
    svc = SubscriptionsService(service_client=_DB())
    assert svc.cap_for_currency(svc._db, "EUR", "2026-08") == 250.0  # noqa: SLF001


def test_deckel_stichtag_ist_monatserster() -> None:
    """Der Kurs-Stichtag folgt der Periode, nicht `heute` — sonst bekäme ein
    Wiederholungslauf einen anderen Deckel (Wurzel 2)."""
    assert SubscriptionsService.cap_stichtag("2026-08") == date(2026, 8, 1)


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


@_needs_stripe
def test_dynpricing_billing_je_waehrung_getrennt() -> None:
    """E2E gegen die echte Stripe-API: EUR- und DKK-Buchungen ergeben ZWEI
    getrennte Invoice-Items in ihrer jeweiligen Währung. Nichts wird
    umgerechnet (Wurzel 4) — der Kern der 24-Länder-Anforderung."""
    stripe = SubscriptionsService()._stripe  # noqa: SLF001
    customer = stripe.v1.customers.create(params={"name": "E2E DynPricing"})
    db = _db_mit_modul()
    db.store["tenant_subscription"] = [
        {"tenant_id": "t1", "stripe_customer_id": customer["id"]}]
    db.store["dynpricing_ledger"] = [
        {"id": "d1", "tenant_id": "t1", "currency": "EUR",
         "fee_amount": 2.0, "status": "pending"},
        {"id": "d2", "tenant_id": "t1", "currency": "EUR",
         "fee_amount": 3.5, "status": "pending"},
        {"id": "d3", "tenant_id": "t1", "currency": "DKK",
         "fee_amount": 15.0, "status": "pending"},
    ]
    svc = SubscriptionsService(service_client=db, stripe=stripe)
    period = f"2026-07-{customer['id'][-8:]}"
    assert svc.bill_pending_dynpricing("t1", period=period) == 3
    assert all(r["status"] == "invoiced" for r in db.store["dynpricing_ledger"])
    # Zwei verschiedene Items — eines je Währung.
    items = {r["currency"]: r["stripe_invoice_item_id"]
             for r in db.store["dynpricing_ledger"]}
    assert items["EUR"] != items["DKK"]
    # Aus Stripe gegengelesen: Beträge UND Währungen stimmen.
    eur = stripe.v1.invoice_items.retrieve(items["EUR"])
    dkk = stripe.v1.invoice_items.retrieve(items["DKK"])
    assert (eur["amount"], eur["currency"]) == (550, "eur")   # 2,00 + 3,50
    assert (dkk["amount"], dkk["currency"]) == (1500, "dkk")  # 15,00
    # Idempotenz: zweiter Lauf findet keine pending mehr.
    assert svc.bill_pending_dynpricing("t1", period=period) == 0


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


# --- Objektzahl aus dem Tarifrechner an Stripe durchreichen ----------------
# Realer Befund: Der Regler stand auf 5 (43,90 €), Stripe-Checkout zeigte
# 19,90 €. Grund: quantity kam aus _active_property_count statt aus dem
# Wunsch des Kunden. Wer 5 Objekte plant, muss auch für 5 abschliessen können.


class _CheckoutStripeStub:
    """Faengt die Checkout-Parameter ab, statt Stripe zu rufen."""

    def __init__(self) -> None:
        self.params: dict[str, Any] | None = None
        self.v1 = self

    # -- v1.prices.list -- der Service liest .data per getattr, nicht als Key.
    @property
    def prices(self):  # noqa: ANN202
        class _Res:
            data = [{"id": "price_x"}]

        class _P:
            @staticmethod
            def list(params: dict) -> _Res:  # noqa: ARG004
                return _Res()

        return _P

    @property
    def customers(self):  # noqa: ANN202
        class _C:
            @staticmethod
            def retrieve(cid: str, params: dict | None = None) -> dict:  # noqa: ARG004
                return {"id": cid, "address": {}, "metadata": {}}

        return _C

    @property
    def checkout(self):  # noqa: ANN202
        stub = self

        class _S:
            @staticmethod
            def create(params: dict) -> dict:
                stub.params = params
                return {"url": "https://checkout.test/x"}

        class _Checkout:
            sessions = _S

        return _Checkout

    def _menge(self) -> int:
        return (self.params or {})["line_items"][0]["quantity"]


def _checkout_svc(aktive_objekte: int):  # noqa: ANN202
    db = _db_with_properties(aktive_objekte)
    db.store["tenant_subscription"] = [
        {"tenant_id": "t1", "stripe_customer_id": "cus_ok"}
    ]
    stripe = _CheckoutStripeStub()
    return SubscriptionsService(service_client=db, stripe=stripe), stripe


def _start(svc, anzahl: int | None) -> None:  # noqa: ANN001
    svc.create_checkout(
        _CTX,
        module_keys=[],
        success_url="https://x/ok",
        cancel_url="https://x/no",
        property_count=anzahl,
    )


def test_checkout_nutzt_gewuenschte_objektzahl() -> None:
    """KRITISCH: der Vorfall. 1 aktives Objekt, Regler auf 5 -> quantity 5,
    damit Stripe denselben Betrag zeigt wie die Tarifseite (43,90 €)."""
    svc, stripe = _checkout_svc(aktive_objekte=1)
    _start(svc, 5)
    assert stripe._menge() == 5  # noqa: SLF001


def test_checkout_nimmt_nie_weniger_als_die_aktiven_objekte() -> None:
    """Wurzel 3: Der Client darf den Scope nicht nach unten druecken — wer 20
    Objekte betreibt, kann nicht fuer 1 abschliessen."""
    svc, stripe = _checkout_svc(aktive_objekte=20)
    _start(svc, 1)
    assert stripe._menge() == 20  # noqa: SLF001


def test_checkout_ohne_wunsch_nimmt_aktive_objektzahl() -> None:
    """Rueckwaertskompatibel: ohne property_count gilt die reale Objektzahl."""
    svc, stripe = _checkout_svc(aktive_objekte=7)
    _start(svc, None)
    assert stripe._menge() == 7  # noqa: SLF001


def test_checkout_mindestens_eins_bei_null_objekten() -> None:
    """Tier-1-Flat ist die Grundgebuehr — quantity 0 gaebe es bei Stripe nicht."""
    svc, stripe = _checkout_svc(aktive_objekte=0)
    _start(svc, None)
    assert stripe._menge() == 1  # noqa: SLF001


# -- change_quantity: Verkleinern nur mit genug deaktivierten Objekten -------
def test_change_quantity_ohne_abo_ist_422() -> None:
    """Ohne Abo gibt es keine Menge zu ändern."""
    svc = SubscriptionsService(service_client=_DB())
    with pytest.raises(SubscriptionsError) as exc:
        svc.change_quantity(_CTX, property_count=3)
    assert exc.value.status_code == 422


def test_change_quantity_unter_aktive_objekte_ist_422() -> None:
    """5 Objekte live, aber nur 3 buchen wollen → abgelehnt, sonst stünden
    zwei veröffentlichte Objekte über dem Kontingent (Wurzel 1)."""
    db = _db_with_properties(5)
    db.store["tenant_subscription"] = [
        {
            "tenant_id": "t1",
            "stripe_subscription_id": "sub_1",
            "status": "active",
            "reported_property_count": 5,
        }
    ]
    svc = SubscriptionsService(service_client=db)
    with pytest.raises(SubscriptionsError) as exc:
        svc.change_quantity(_CTX, property_count=3)
    assert exc.value.status_code == 422
    assert "5" in str(exc.value)


def test_sync_quantity_reduziert_bezahlte_menge_nicht() -> None:
    """Wer für 5 zahlt und nur 1 Objekt aktiv hat, behält 5 — der Sync zieht
    ausschliesslich nach OBEN nach."""
    db = _db_with_properties(1)
    db.store["tenant_subscription"] = [
        {
            "tenant_id": "t1",
            "stripe_subscription_id": "sub_1",
            "status": "active",
            "reported_property_count": 5,
        }
    ]
    svc = SubscriptionsService(service_client=db)
    assert svc.sync_quantity_for_tenant("t1") == 5
    assert db.store["tenant_subscription"][0]["reported_property_count"] == 5


def test_change_quantity_rechnet_nur_beim_erweitern_sofort_ab() -> None:
    """Erweitern erzeugt sofort eine Rechnung, Reduzieren nicht (dort entsteht
    eine Gutschrift, die auf der nächsten regulären Rechnung bleibt)."""
    gerufen: list[int] = []

    class _Svc(SubscriptionsService):
        def _invoice_prorations_now(  # noqa: PLR0913
            self, sub_id: str, customer_id: str, tenant_id: str, *, quantity: int
        ) -> None:
            gerufen.append(quantity)

        def _grundtarif_item(self, sub: Any) -> dict[str, Any] | None:
            return {"id": "si_1", "quantity": 5}

        @property
        def _stripe(self) -> Any:
            return _Stripe()

    class _Stripe:
        class v1:  # noqa: N801
            class subscriptions:  # noqa: N801
                @staticmethod
                def retrieve(_id: str) -> dict[str, Any]:
                    return {"id": "sub_1", "items": {"data": []}}

            class subscription_items:  # noqa: N801
                @staticmethod
                def update(_id: str, **_k: Any) -> None:
                    return None

    db = _db_with_properties(1)
    db.store["tenant_subscription"] = [
        {
            "tenant_id": "t1",
            "stripe_customer_id": "cus_1",
            "stripe_subscription_id": "sub_1",
            "status": "active",
            "reported_property_count": 5,
        }
    ]
    svc = _Svc(service_client=db)

    svc.change_quantity(_CTX, property_count=8)
    assert gerufen == [8], "Erweitern muss sofort abrechnen"

    gerufen.clear()
    svc.change_quantity(_CTX, property_count=3)
    assert gerufen == [], "Reduzieren darf keine Rechnung erzeugen"


# -- Rechnungsadresse: Vorbelegung aus dem Betriebsprofil --------------------
_PROFIL = [
    {
        "tenant_id": "t1",
        "legal_name": "Villa zur Sonne",
        "company_street": "Hauptstr. ",  # Leerzeichen wie im echten Profil
        "company_house_number": "12",
        "company_postal_code": "15749",
        "company_city": "Mittenwalde",
        "company_country": "DE",
        "company_state": None,
        "email": "info@villa.de",
        "vat_id": "DE123456789",
        "account_type": "company",
        "managing_director_first_name": "Max ",
        "managing_director_last_name": "Mustermann",
    }
]


def test_billing_address_ohne_customer_kommt_aus_profil() -> None:
    """Ohne Stripe-Customer wird das Formular aus dem Betriebsprofil vorbelegt,
    statt den Betrieb alles erneut eintippen zu lassen."""
    db = _DB()
    db.store["tenant_billing_profile"] = _PROFIL
    svc = SubscriptionsService(service_client=db)
    addr = svc.get_billing_address(_CTX)
    assert addr.line1 == "Hauptstr. 12"
    assert addr.postal_code == "15749"
    assert addr.city == "Mittenwalde"
    assert addr.country == "DE"
    assert addr.company_name == "Villa zur Sonne"
    assert addr.first_name == "Max"


def test_billing_address_ohne_profil_bleibt_leer() -> None:
    """Kein Profil → nichts erfinden (Wurzel 4)."""
    svc = SubscriptionsService(service_client=_DB())
    addr = svc.get_billing_address(_CTX)
    assert addr.line1 is None
    assert addr.city is None


def test_merge_address_stripe_gewinnt_profil_fuellt_luecken() -> None:
    """Vorhandene Stripe-Werte bleiben; nur leere Felder kommen aus dem Profil."""
    from src.features.subscriptions.schemas import BillingAddress as _BA

    stripe_addr = _BA(
        city="Berlin",
        first_name="myNextDays",   # aus dem Checkout: der TENANT-Name
        email="developer@example.com",
        account_type="individual",
    )
    vorschlag = _BA(
        city="Mittenwalde",
        postal_code="15749",
        first_name="Max",
        email="admin@villa.de",
        account_type="company",
    )
    zus = SubscriptionsService._merge_address(stripe_addr, vorschlag)  # noqa: SLF001
    assert zus.city == "Berlin", "Anschrift: Stripe-Wert gewinnt"
    assert zus.postal_code == "15749", "Leeres Feld wird ergänzt"
    assert zus.account_type == "individual", "Konto-Typ bleibt der Stripe-Wert"
    # Name/E-Mail: das Profil gewinnt, sonst stünde der Firmenname als Vorname.
    assert zus.first_name == "Max"
    assert zus.email == "admin@villa.de"


# --- Buchen des nutzungsabhängigen Moduls (Erweiterungen-Fläche) ------------


def test_modul_dynamische_preise_ohne_abo_nicht_buchbar() -> None:
    """Nutzungsabhängige Module setzen ein laufendes Abo voraus (422).

    Ohne Stripe-Kunde könnte der Monatslauf das Invoice-Item nicht stellen
    (`bill_pending_dynpricing` → 409) — das Modul wäre freigeschaltet, die
    Nutzung aber nie abrechenbar. Fail-CLOSED beim Buchen statt später beim
    Abrechnen.
    """
    db = _DB()  # kein tenant_subscription-Eintrag
    svc = SubscriptionsService(service_client=db)
    with pytest.raises(SubscriptionsError) as exc:
        svc.add_module(_CTX, module_key="dynamische_preise")
    assert exc.value.status_code == 422
    assert db.store["tenant_module_entitlement"] == []


def test_modul_dynamische_preise_buchen_und_kuendigen() -> None:
    """Mit laufendem Abo: Buchen setzt das Entitlement OHNE Abo-Position (der
    Betrag entsteht erst je Buchung im Ledger); Kündigen entzieht den Zugang
    sofort, weil nichts vorausbezahlt wurde."""
    db = _DB()
    db.store["tenant_subscription"] = [
        {
            "tenant_id": "t1",
            "status": "active",
            "stripe_customer_id": "cus_1",
            "stripe_subscription_id": "sub_1",
        }
    ]
    svc = SubscriptionsService(service_client=db)
    ent = svc.add_module(_CTX, module_key="dynamische_preise")
    assert ent.active is True
    zeilen = db.store["tenant_module_entitlement"]
    assert [(z["module_key"], z["active"]) for z in zeilen] == [
        ("dynamische_preise", True)
    ]
    # Idempotent (Doppelklick, Wurzel 2): keine zweite Zeile.
    svc.add_module(_CTX, module_key="dynamische_preise")
    assert len(db.store["tenant_module_entitlement"]) == 1
    # Kündigen: sofort inaktiv, Zeile bleibt (Historie), kein active_until.
    weg = svc.remove_module(_CTX, module_key="dynamische_preise")
    assert weg.active is False
    assert db.store["tenant_module_entitlement"][0]["active"] is False


# --- Vorläufige Aufstellung eines Monats (Einzelposten) ---------------------

def _mit_provisionszeile(
    db: _DB,
    *,
    zeile_id: str,
    periode_created: str,
    period: str | None = None,
    tenant_id: str = "t1",
    reservation_id: str = "r1",
    currency: str = "DKK",
) -> _DB:
    db.store.setdefault("commission_ledger", []).append(
        {
            "id": zeile_id,
            "tenant_id": tenant_id,
            "reservation_id": reservation_id,
            "channel": "booking",
            "currency": currency,
            "gross_amount": 2810.0,
            "rate": 0.005,
            "commission_amount": 14.05,
            "status": "pending",
            "period": period,
            "created_at": periode_created,
        }
    )
    return db


def test_aufstellung_nimmt_offene_zeilen_ueber_created_at() -> None:
    """Eine noch nicht fakturierte Zeile hat kein `period` — sie muss über den
    Monat der Erfassung gefunden werden.

    Genau so gruppiert `get_commission_months` die Monatssumme. Rechneten die
    beiden Wege verschieden, zeigte die aufgeklappte Liste andere Zeilen, als
    die Summe darüber zusammenfasst — der Kunde sähe eine Aufstellung, die
    seine eigene Zwischensumme nicht ergibt.
    """
    db = _mit_provisionszeile(_DB(), zeile_id="c1", periode_created="2026-08-14T10:00:00Z")
    eintraege = SubscriptionsService(service_client=db).get_commission_entries(
        _CTX, "2026-08"
    )
    assert [e.id for e in eintraege] == ["c1"]
    assert eintraege[0].commission_amount == 14.05


def test_aufstellung_bevorzugt_period_vor_created_at() -> None:
    """Ist die Zeile fakturiert, zählt `period` — nicht der Erfassungsmonat.

    Eine im September nacherfasste August-Buchung gehört in den August; nach
    `created_at` fiele sie in den falschen Monat.
    """
    db = _mit_provisionszeile(
        _DB(), zeile_id="c1", periode_created="2026-09-02T10:00:00Z", period="2026-08"
    )
    svc = SubscriptionsService(service_client=db)
    assert [e.id for e in svc.get_commission_entries(_CTX, "2026-08")] == ["c1"]
    assert svc.get_commission_entries(_CTX, "2026-09") == []


def test_aufstellung_zeigt_nur_den_eigenen_betrieb() -> None:
    """Wurzel 3: der Tenant steckt in der Abfrage.

    Die Aufstellung trägt Gastnamen und Objekttitel — sie ist die feinere
    Auflösung derselben Daten, nicht eine harmlosere.
    """
    db = _mit_provisionszeile(_DB(), zeile_id="eigen", periode_created="2026-08-14T10:00:00Z")
    _mit_provisionszeile(
        db, zeile_id="fremd", periode_created="2026-08-14T10:00:00Z", tenant_id="t2"
    )
    eintraege = SubscriptionsService(service_client=db).get_commission_entries(
        _CTX, "2026-08"
    )
    assert [e.id for e in eintraege] == ["eigen"]


def test_aufstellung_uebernimmt_den_eingefrorenen_satz() -> None:
    """Der Satz kommt aus der ZEILE, nicht aus `commission_rate()`.

    Der Ledger friert ihn je Buchung ein. Läse die Aufstellung den heutigen
    Tarif, schriebe eine spätere Satzänderung die Vergangenheit um — die alte
    Rechnung und ihre Aufstellung wichen dann voneinander ab.
    """
    db = _DB()
    db.store["commission_ledger"] = [
        {
            "id": "c1", "tenant_id": "t1", "reservation_id": "r1",
            "channel": "booking", "currency": "DKK", "gross_amount": 1000.0,
            "rate": 0.01,  # alter Satz, heute gilt 0,005
            "commission_amount": 10.0, "status": "invoiced",
            "period": "2026-08", "created_at": "2026-08-14T10:00:00Z",
        }
    ]
    eintraege = SubscriptionsService(service_client=db).get_commission_entries(
        _CTX, "2026-08"
    )
    assert eintraege[0].rate == 0.01
    assert SubscriptionsService.commission_rate() == 0.005


def test_aufstellung_haelt_geloeschte_reservierung_aus() -> None:
    """Die Provisionszeile ist eine Forderung und überlebt ihre Buchung.

    Fehlt die Reservierung, bleiben Objekt und Gast leer — kein Ersatztext,
    der eine Buchung vortäuscht (Wurzel 4), und vor allem kein Absturz, der
    die ganze Aufstellung unlesbar macht.
    """
    db = _mit_provisionszeile(
        _DB(), zeile_id="c1", periode_created="2026-08-14T10:00:00Z",
        reservation_id="weg",
    )
    eintraege = SubscriptionsService(service_client=db).get_commission_entries(
        _CTX, "2026-08"
    )
    assert eintraege[0].property_title is None
    assert eintraege[0].guest_name is None
    assert eintraege[0].commission_amount == 14.05


def test_aufstellung_summe_deckt_sich_mit_der_monatszeile() -> None:
    """Die aufgeklappte Liste muss die Summe darüber ergeben.

    Beide Wege laufen über dieselbe Periodenrechnung; dieser Test hält sie
    aneinander fest, damit eine Änderung an einer Seite nicht unbemerkt
    auseinanderläuft.
    """
    db = _DB()
    for i in range(3):
        _mit_provisionszeile(
            db, zeile_id=f"c{i}", periode_created="2026-08-14T10:00:00Z",
            reservation_id=f"r{i}",
        )
    svc = SubscriptionsService(service_client=db)
    monate = svc.get_commission_months(_CTX)
    august = next(m for m in monate if m.period == "2026-08")
    eintraege = svc.get_commission_entries(_CTX, "2026-08")

    assert august.booking_count == len(eintraege)
    assert august.commission_total == round(
        sum(e.commission_amount for e in eintraege), 2
    )


# --- Kostenlose Testphase (0488) ---------------------------------------------
# Die Marketing-Seite wirbt an 14 Stellen je Sprache mit "14 Tage kostenlos
# testen". Gebaut war davon NICHTS: der Checkout schickte keinen
# `trial_period_days`, Stripe zog also sofort ein. Der Status `trialing` stand
# zwar im Enum und wurde von jeder Schranke akzeptiert, aber nie ERZEUGT.
# Diese Tests halten beide Halften zusammen.


def _checkout_svc_mit_abo(zeile: dict):  # noqa: ANN001, ANN202
    """Checkout-Dienst mit einer vorgegebenen tenant_subscription-Zeile."""
    db = _db_with_properties(1)
    db.store["tenant_subscription"] = [zeile]
    stripe = _CheckoutStripeStub()
    return SubscriptionsService(service_client=db, stripe=stripe), stripe


def test_erster_checkout_bekommt_die_testphase() -> None:
    """Der beworbene Fall: wer noch nie ein Abo hatte, testet 14 Tage frei."""
    svc, stripe = _checkout_svc_mit_abo({
        "tenant_id": "t1", "stripe_customer_id": "cus_ok",
    })
    _start(svc, 1)
    sub = (stripe.params or {})["subscription_data"]
    assert sub["trial_period_days"] == TESTPHASE_TAGE
    assert sub["trial_period_days"] == 14


def test_testphase_endet_fail_closed_ohne_zahlungsmittel() -> None:
    """Faellt die Karte bis zum Ablauf weg, endet das Abo — statt in einen
    unbezahlten Dauerzustand zu kippen (Wurzel 5)."""
    svc, stripe = _checkout_svc_mit_abo({
        "tenant_id": "t1", "stripe_customer_id": "cus_ok",
    })
    _start(svc, 1)
    sub = (stripe.params or {})["subscription_data"]
    assert sub["trial_settings"]["end_behavior"]["missing_payment_method"] == "cancel"


def test_zweite_testphase_gibt_es_nicht() -> None:
    """Wurzel 2: ohne Riegel kuendigt man am vorletzten Tag und schliesst neu
    ab — beliebig oft kostenlos. `trial_used_at` verhindert genau das."""
    svc, stripe = _checkout_svc_mit_abo({
        "tenant_id": "t1",
        "stripe_customer_id": "cus_ok",
        "trial_used_at": "2026-08-01T10:00:00+00:00",
    })
    _start(svc, 1)
    sub = (stripe.params or {})["subscription_data"]
    assert "trial_period_days" not in sub
    assert "trial_settings" not in sub


def test_tenant_id_bleibt_auch_mit_testphase_erhalten() -> None:
    """Die Metadaten tragen die Tenant-Zuordnung — ohne sie findet der Webhook
    den Betrieb nicht mehr. Beim Umbau auf `subscription_data` als Variable
    war genau das die Stelle, an der man sie verlieren kann."""
    svc, stripe = _checkout_svc_mit_abo({
        "tenant_id": "t1", "stripe_customer_id": "cus_ok",
    })
    _start(svc, 1)
    sub = (stripe.params or {})["subscription_data"]
    assert sub["metadata"]["tenant_id"] == "t1"


def test_geworbener_betrieb_bekommt_gratismonat_als_trial_end() -> None:
    """Master-Strategie 02.09.2026: Partner-Zuordnung → 14 Tage + 1 Monat als
    verlaengerte Testphase (`trial_end`), KEIN `trial_period_days`, kein Coupon."""
    svc, stripe = _checkout_svc_mit_abo({
        "tenant_id": "t1", "stripe_customer_id": "cus_ok",
    })
    svc._db.store["affiliate_referrals"] = [  # noqa: SLF001
        {"tenant_id": "t1", "status": "pending", "affiliate_id": "a1"}
    ]
    vorher = datetime.now(UTC)
    _start(svc, 1)
    sub = (stripe.params or {})["subscription_data"]
    assert "trial_period_days" not in sub
    ende = datetime.fromtimestamp(sub["trial_end"], tz=UTC)
    # Mindestens 14 Tage + 28 Tage, hoechstens 14 Tage + 31 Tage.
    assert timedelta(days=42) <= ende - vorher <= timedelta(days=45, minutes=1)
    assert sub["trial_settings"]["end_behavior"]["missing_payment_method"] == "cancel"


def test_abgelehnte_zuordnung_gibt_keinen_gratismonat() -> None:
    svc, stripe = _checkout_svc_mit_abo({
        "tenant_id": "t1", "stripe_customer_id": "cus_ok",
    })
    svc._db.store["affiliate_referrals"] = [  # noqa: SLF001
        {"tenant_id": "t1", "status": "rejected", "affiliate_id": "a1"}
    ]
    _start(svc, 1)
    sub = (stripe.params or {})["subscription_data"]
    assert sub["trial_period_days"] == TESTPHASE_TAGE and "trial_end" not in sub


def test_gratismonat_ende_kappt_monatsende() -> None:
    # 17.01. + 14 T. = 31.01.; + 1 Monat → 28.02. (kein 31.02.)
    ende = gratismonat_ende(datetime(2026, 1, 17, 12, 0, tzinfo=UTC))
    assert (ende.month, ende.day) == (2, 28)


def test_testphase_offen_ohne_zeile() -> None:
    """Kein Abo je gehabt = Testphase steht zu (fail-open ist hier richtig:
    der Riegel schuetzt vor Wiederholung, nicht vor dem ersten Mal)."""
    assert SubscriptionsService._testphase_offen(None) is True  # noqa: SLF001
    assert SubscriptionsService._testphase_offen({}) is True  # noqa: SLF001
    assert (  # noqa: SLF001
        SubscriptionsService._testphase_offen({"trial_used_at": "2026-08-01T10:00:00Z"})
        is False
    )
