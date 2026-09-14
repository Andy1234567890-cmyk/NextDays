"""Kassenbuch: Monatsansicht mit Anfangsbestand, laufendem Saldo, Summen;
nur Kassen; Einträge über die Kassenregel."""

from datetime import date
from decimal import Decimal

import pytest

from src.core.security import AuthContext

from ..basis import ZahlungenError
from ..schemas import CashbookEntryCreate
from ..service import ZahlungenService
from .fake_db import FakeDb

CTX = AuthContext(user_id="u1", tenant_id="t1", role="admin")
STAMP = "2026-09-01T00:00:00Z"


def _db() -> FakeDb:
    return FakeDb(
        tenants=[{"id": "t1", "currency": "DKK"}],
        payment_accounts=[
            {
                "id": "kasse",
                "tenant_id": "t1",
                "name": "Kasse",
                "type": "cash",
                "currency": "DKK",
                "opening_balance": "100",
                "is_default": True,
                "active": True,
                "created_at": STAMP,
                "updated_at": STAMP,
            },
            {
                "id": "bank",
                "tenant_id": "t1",
                "name": "Bank",
                "type": "bank",
                "currency": "DKK",
                "opening_balance": "0",
                "is_default": False,
                "active": True,
                "created_at": STAMP,
                "updated_at": STAMP,
            },
        ],
        bank_transactions=[
            {
                "id": "o",
                "tenant_id": "t1",
                "payment_account_id": "kasse",
                "booking_date": "2026-08-01",
                "amount": "100.00",
                "currency": "DKK",
                "purpose": "Anfangsbestand",
                "source": "opening",
                "import_hash": "o",
                "created_at": STAMP,
                "updated_at": STAMP,
            },
        ],
    )


def test_monat_mit_anfangsbestand_und_laufendem_saldo() -> None:
    db = _db()
    s = ZahlungenService(db)
    s.create_cashbook_entry(
        CTX,
        CashbookEntryCreate(
            payment_account_id="kasse",
            booking_date=date(2026, 9, 2),
            amount=Decimal("40"),
            purpose="Kaffee-Kasse",
        ),
    )
    s.create_cashbook_entry(
        CTX,
        CashbookEntryCreate(
            payment_account_id="kasse",
            booking_date=date(2026, 9, 3),
            amount=Decimal("-25.5"),
            purpose="Reinigungsmittel",
        ),
    )
    kb = s.get_cashbook(CTX, "kasse", "2026-09")
    assert kb.opening_balance == Decimal("100.00")
    assert [e.running_balance for e in kb.entries] == [Decimal("140.00"), Decimal("114.50")]
    assert kb.sum_in == Decimal("40.00") and kb.sum_out == Decimal("-25.50")
    assert kb.closing_balance == Decimal("114.50")
    assert kb.account.balance == Decimal("114.50")
    # Vormonat: nur der Anfangsbestand.
    august = s.get_cashbook(CTX, "kasse", "2026-08")
    assert august.opening_balance == Decimal("0") and august.closing_balance == Decimal("100.00")
    assert august.entries[0].source == "opening"


def test_auszahlung_ueber_bestand_422() -> None:
    s = ZahlungenService(_db())
    with pytest.raises(ZahlungenError) as exc:
        s.create_cashbook_entry(
            CTX,
            CashbookEntryCreate(
                payment_account_id="kasse",
                booking_date=date(2026, 9, 2),
                amount=Decimal("-100.01"),
                purpose="x",
            ),
        )
    assert exc.value.status_code == 422
    assert "negativ" in exc.value.message


def test_nur_kassen_und_monatsformat() -> None:
    s = ZahlungenService(_db())
    with pytest.raises(ZahlungenError) as exc:
        s.get_cashbook(CTX, "bank", "2026-09")
    assert exc.value.status_code == 422
    with pytest.raises(ZahlungenError) as exc2:
        s.get_cashbook(CTX, "kasse", "2026-13")
    assert exc2.value.status_code == 422
