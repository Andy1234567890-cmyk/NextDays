"""Tests für create_invoice_from_bestand (Buchhaltungs-Bestand → GoBD-Rechnung).

Fokus:
  * die fortlaufende GoBD-Nummer wird ERST nach aller Validierung gezogen —
    scheitert die Reservierungs-/Kundenprüfung, wird KEINE Nummer verbrannt
    (sonst entstünde eine dauerhafte Lücke im Nummernkreis);
  * eine client-übergebene customer_id, die einem FREMDEN Tenant gehört, wird
    abgelehnt (404) statt in den Beleg geschrieben.
"""
from decimal import Decimal
from types import SimpleNamespace

import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.service import BuchhaltungError, BuchhaltungService

TENANT = "t1"


class _Chain:
    """Query-Ketten-Mock: Filter/select geben die Kette zurück; execute() liefert
    die für die Tabelle hinterlegten Zeilen (nach eq-Filtern gefiltert). insert
    schneidet den Payload mit."""

    def __init__(self, table: "_Table") -> None:
        self._t = table
        self._filters: list[tuple[str, object]] = []
        self._op: str | None = None
        self._payload: object = None

    def select(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def order(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def eq(self, field: str, value: object) -> "_Chain":
        self._filters.append((field, value))
        return self

    def insert(self, payload: object) -> "_Chain":
        self._op, self._payload = "insert", payload
        return self

    def execute(self) -> SimpleNamespace:
        if self._op == "insert":
            self._t.inserts.append(self._payload)
            new = {**self._payload, "id": "inv-1"} if isinstance(self._payload, dict) else {}
            return SimpleNamespace(data=[new])
        rows = [
            r for r in self._t.rows
            if all(r.get(f) == v for f, v in self._filters)
        ]
        return SimpleNamespace(data=rows)


class _Table:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.inserts: list = []


class _DB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables = {name: _Table(rows) for name, rows in tables.items()}
        self.rpc_calls = 0

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.setdefault(name, _Table([])))

    def rpc(self, name: str, params: dict) -> SimpleNamespace:  # noqa: ARG002
        self.rpc_calls += 1
        return SimpleNamespace(
            execute=lambda: SimpleNamespace(
                data=[{"sequential_number": 7, "formatted_number": "RE-0007"}]
            )
        )


def _ctx() -> AuthContext:
    return AuthContext(user_id="u", tenant_id=TENANT, role="admin")


def _payload(**overrides: object) -> dict:
    base = {
        "status": "finalized",
        "items": [
            {"quantity": 1, "unitPrice": 100.0, "taxRate": 19.0},
        ],
        "currency": "EUR",
    }
    base.update(overrides)
    return base


def test_foreign_customer_id_rejected_with_404() -> None:
    """Eine customer_id eines anderen Tenants darf nicht in den Beleg gelangen."""
    db = _DB(customers=[])  # kein Kunde dieses Tenants → 404
    svc = BuchhaltungService(service_client=db)
    with pytest.raises(BuchhaltungError) as exc:
        svc.create_invoice_from_bestand(_ctx(), _payload(customerId="c-foreign"))
    assert exc.value.status_code == 404
    # Kein Beleg geschrieben, KEINE Nummer gezogen.
    assert db.tables.get("invoices", _Table([])).inserts == []
    assert db.rpc_calls == 0


def test_own_customer_id_accepted() -> None:
    """Eigener Debitor (tenant-eigen) wird akzeptiert und in den Beleg geschrieben."""
    db = _DB(customers=[{"id": "c1", "tenant_id": TENANT}])
    svc = BuchhaltungService(service_client=db)
    svc.create_invoice_from_bestand(_ctx(), _payload(customerId="c1"))
    inserts = db.tables["invoices"].inserts
    assert len(inserts) == 1
    assert inserts[0]["customer_id"] == "c1"
    assert inserts[0]["invoice_number"] == "RE-0007"


def test_number_not_burned_when_reservation_missing() -> None:
    """Scheitert die Reservierungsvalidierung, wird KEINE GoBD-Nummer gezogen."""
    db = _DB(reservations=[])  # Buchung nicht gefunden → 404
    svc = BuchhaltungService(service_client=db)
    with pytest.raises(BuchhaltungError) as exc:
        svc.create_invoice_from_bestand(
            _ctx(), _payload(reservationId="r-missing")
        )
    assert exc.value.status_code == 404
    assert db.rpc_calls == 0  # Nummer NICHT verbrannt
    assert db.tables.get("invoices", _Table([])).inserts == []


def test_number_not_burned_when_reservation_cancelled() -> None:
    """Stornierte Buchung → 409, ohne dass eine Nummer verbrannt wird."""
    db = _DB(reservations=[
        {"id": "r1", "tenant_id": TENANT, "status": "cancelled",
         "checked_in_at": "2026-07-01T12:00:00+00:00"},
    ])
    svc = BuchhaltungService(service_client=db)
    with pytest.raises(BuchhaltungError) as exc:
        svc.create_invoice_from_bestand(_ctx(), _payload(reservationId="r1"))
    assert exc.value.status_code == 409
    assert db.rpc_calls == 0


def test_client_isstorno_flag_does_not_create_storno_beleg() -> None:
    """Ein Client-Flag isStorno darf über diesen Pfad KEINEN storno-Beleg mit
    positiven Beträgen und ohne Original-Verweis fabrizieren — immer 'invoice'."""
    db = _DB()
    svc = BuchhaltungService(service_client=db)
    svc.create_invoice_from_bestand(_ctx(), _payload(isStorno=True))
    inserts = db.tables["invoices"].inserts
    assert len(inserts) == 1
    assert inserts[0]["invoice_type"] == "invoice"
    # Positive Beträge (kein Storno-Negat), kein Original-Verweis.
    assert "original_invoice_id" not in inserts[0]


def test_kleinunternehmer_head_tax_rate_forced_to_zero() -> None:
    """§19: bei is_kleinunternehmer MUSS der Kopf-Satz 0 sein (nicht 19 aus dem
    Payload), passend zu tax_amount=0 — sonst §19-Inkonsistenz im Beleg/PDF."""
    db = _DB()
    svc = BuchhaltungService(service_client=db)
    svc.create_invoice_from_bestand(
        _ctx(), _payload(isSmallBusiness=True, items=[
            {"quantity": 1, "unitPrice": 100.0, "taxRate": 19.0},
        ])
    )
    head = db.tables["invoices"].inserts[0]
    assert head["is_kleinunternehmer"] is True
    assert str(head["tax_amount"]) == "0"
    assert str(head["tax_rate"]) == "0"
    # Positionen tragen ebenfalls Satz 0.
    line = db.tables["invoice_line_items"].inserts[0][0]
    assert Decimal(str(line["tax_rate"])) == Decimal("0")


def test_snake_case_positions_match_header() -> None:
    """snake_case-Positionsfelder (unit_price/tax_rate) werden gelesen — sonst
    fiele jede Position auf 0 und Σ Positionen ≠ Kopf (GoBD-Widerspruch)."""
    db = _DB()
    svc = BuchhaltungService(service_client=db)
    svc.create_invoice_from_bestand(
        _ctx(), _payload(items=[
            {"quantity": 1, "unit_price": 100.0, "tax_rate": 19.0},
        ])
    )
    head = db.tables["invoices"].inserts[0]
    line = db.tables["invoice_line_items"].inserts[0][0]
    # Kopf-Netto = Positions-Netto (beide 100), nicht Kopf 100 / Position 0.
    assert str(head["net_amount"]) == "100.00"
    assert str(line["net_amount"]) == "100.00"
