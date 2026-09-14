"""Zahlungskonten: Währung aus dem Betrieb, Standardkonto, Anfangsbestand als
erste Buchung, Deaktivieren."""

from datetime import date
from decimal import Decimal

import pytest

from src.core.security import AuthContext

from ..basis import ZahlungenError
from ..schemas import PaymentAccountCreate, PaymentAccountUpdate
from ..service import ZahlungenService
from .fake_db import FakeDb

CTX = AuthContext(user_id="u1", tenant_id="t1", role="admin")


def _db(**tables: list[dict]) -> FakeDb:
    return FakeDb(tenants=[{"id": "t1", "currency": "DKK"}], **tables)


def test_waehrung_kommt_aus_dem_betrieb_und_erstes_konto_ist_standard() -> None:
    db = _db()
    konto = ZahlungenService(db).create_account(
        CTX, PaymentAccountCreate(name="Kasse", type="cash")
    )
    assert konto.currency == "DKK"
    assert konto.is_default is True
    assert konto.balance == Decimal("0")
    assert db.rows("bank_transactions") == []  # kein Anfangsbestand bei 0


def test_ohne_waehrung_422() -> None:
    db = FakeDb(tenants=[{"id": "t1", "currency": None}])
    with pytest.raises(ZahlungenError) as exc:
        ZahlungenService(db).create_account(CTX, PaymentAccountCreate(name="Bank", type="bank"))
    assert exc.value.status_code == 422


def test_anfangsbestand_ist_erste_buchung() -> None:
    db = _db()
    konto = ZahlungenService(db).create_account(
        CTX,
        PaymentAccountCreate(
            name="Kasse",
            type="cash",
            opening_balance=Decimal("150.00"),
            opening_date=date(2026, 9, 1),
        ),
    )
    buchung = db.einzige("bank_transactions")
    assert buchung["source"] == "opening"
    assert buchung["amount"] == "150.00"
    assert buchung["booking_date"] == "2026-09-01"
    assert buchung["currency"] == "DKK"
    assert konto.balance == Decimal("150.00")
    assert konto.transaction_count == 1


def test_zweites_standardkonto_loest_das_erste_ab() -> None:
    db = _db()
    s = ZahlungenService(db)
    a = s.create_account(CTX, PaymentAccountCreate(name="A", type="bank"))
    b = s.create_account(CTX, PaymentAccountCreate(name="B", type="bank", is_default=True))
    konten = {k.id: k for k in s.list_accounts(CTX)}
    assert konten[a.id].is_default is False
    assert konten[b.id].is_default is True


def test_standardkonto_nicht_deaktivierbar_und_deaktivieren_idempotent() -> None:
    db = _db()
    s = ZahlungenService(db)
    a = s.create_account(CTX, PaymentAccountCreate(name="A", type="bank"))
    b = s.create_account(CTX, PaymentAccountCreate(name="B", type="bank"))
    with pytest.raises(ZahlungenError) as exc:
        s.deactivate_account(CTX, a.id)
    assert exc.value.status_code == 422
    s.deactivate_account(CTX, b.id)
    s.deactivate_account(CTX, b.id)  # No-Op
    assert [k.id for k in s.list_accounts(CTX)] == [a.id]
    assert len(s.list_accounts(CTX, include_inactive=True)) == 2


def test_fremdes_konto_404() -> None:
    db = _db(
        payment_accounts=[
            {
                "id": "k9",
                "tenant_id": "t2",
                "name": "X",
                "type": "bank",
                "currency": "EUR",
                "is_default": True,
                "active": True,
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
            }
        ]
    )
    with pytest.raises(ZahlungenError) as exc:
        ZahlungenService(db).update_account(CTX, "k9", PaymentAccountUpdate(name="Y"))
    assert exc.value.status_code == 404
