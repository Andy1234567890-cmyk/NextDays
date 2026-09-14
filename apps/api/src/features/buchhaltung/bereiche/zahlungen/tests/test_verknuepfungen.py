"""Verknüpfung Umsatz ↔ Rechnung: Zahlungseingang, Rechnungsstatus, Gegenzustand
beim Lösen, Idempotenz, Vorschläge, Bestands-Body."""

from decimal import Decimal

import pytest

from src.core.security import AuthContext

from ..basis import ZahlungenError
from ..schemas import LegacyLinkCreate, TransactionLinkCreate
from ..service import ZahlungenService
from .fake_db import FakeDb

CTX = AuthContext(user_id="u1", tenant_id="t1", role="admin")
STAMP = "2026-09-01T00:00:00Z"


def _tx(**extra: object) -> dict:
    return {
        "id": "tx1",
        "tenant_id": "t1",
        "payment_account_id": "k1",
        "booking_date": "2026-09-05",
        "amount": "1250.00",
        "currency": "DKK",
        "counterpart_name": "Otto Hansen",
        "purpose": "RE-2026-0007 Miete",
        "import_hash": "h1",
        "source": "import",
        "ignored": False,
        "link_count": 0,
        "linked_amount": "0",
        "created_at": STAMP,
        "updated_at": STAMP,
        **extra,
    }


def _rechnung(**extra: object) -> dict:
    return {
        "id": "re1",
        "tenant_id": "t1",
        "invoice_number": "RE-2026-0007",
        "customer_id": "c1",
        "status": "sent",
        "issue_date": "2026-08-20",
        "due_date": "2026-09-03",
        "gross_amount": "1250.00",
        "paid_amount": "0",
        "paid_at": None,
        "currency": "DKK",
        "invoice_type": "invoice",
        "deleted_at": None,
        **extra,
    }


def _db(tx: dict | None = None, rechnung: dict | None = None) -> FakeDb:
    return FakeDb(
        tenants=[{"id": "t1", "currency": "DKK"}],
        payment_accounts=[
            {
                "id": "k1",
                "tenant_id": "t1",
                "name": "Bank",
                "type": "bank",
                "currency": "DKK",
                "is_default": True,
                "active": True,
                "created_at": STAMP,
                "updated_at": STAMP,
            }
        ],
        bank_transactions=[tx or _tx()],
        invoices=[rechnung or _rechnung()],
        customers=[{"id": "c1", "tenant_id": "t1", "name": "Otto Hansen"}],
    )


def _body(**extra: object) -> TransactionLinkCreate:
    return TransactionLinkCreate(
        transaction_id="tx1", document_type="INVOICE", document_id="re1", **extra
    )


def test_vollzahlung_setzt_rechnung_auf_paid_und_zaehlt_gegenzustand() -> None:
    db = _db()
    s = ZahlungenService(db)
    link = s.create_link(CTX, _body())
    assert link.id == "tx1_re1"
    assert link.document_type == "rechnung"
    assert link.amount_allocated == Decimal("1250.00") and link.amount_difference is None
    assert link.document_number == "RE-2026-0007" and link.customer_name == "Otto Hansen"
    assert link.transaction_data["betrag"] == 1250.0 and link.transaction_data["currency"] == "DKK"
    re = db.einzige("invoices")
    assert (
        re["status"] == "paid" and re["paid_amount"] == "1250.00" and re["paid_at"] == "2026-09-05"
    )
    zahlung = db.einzige("invoice_payments")
    assert zahlung["invoice_status_before"] == "sent" and zahlung["method"] == "bank_transfer"
    tx = db.einzige("bank_transactions")
    assert tx["link_count"] == 1 and tx["linked_amount"] == "1250.00"
    assert s.get_transaction(CTX, "tx1").status == "matched"
    assert s.get_transaction(CTX, "tx1").linked_documents[0].document_number == "RE-2026-0007"


def test_zweiter_klick_liefert_dieselbe_verknuepfung() -> None:
    db = _db()
    s = ZahlungenService(db)
    a = s.create_link(CTX, _body())
    b = s.create_link(CTX, _body())
    assert a.id == b.id
    assert len(db.rows("invoice_payments")) == 1 and len(db.rows("transaction_links")) == 1
    assert db.einzige("bank_transactions")["link_count"] == 1


def test_teilzahlung_laesst_rechnung_offen() -> None:
    db = _db(tx=_tx(amount="500.00"))
    s = ZahlungenService(db)
    link = s.create_link(CTX, _body())
    assert link.amount_allocated == Decimal("500.00") and link.amount_difference == Decimal(
        "750.00"
    )
    re = db.einzige("invoices")
    assert re["status"] == "sent" and re["paid_amount"] == "500.00"


def test_differenzgrund_erledigt_rechnung_trotz_rest() -> None:
    db = _db(tx=_tx(amount="1200.00"))
    s = ZahlungenService(db)
    link = s.create_link(CTX, _body(amount_difference_reason="Skonto 4 %"))
    assert link.amount_difference == Decimal("50.00")
    assert db.einzige("invoices")["status"] == "paid"


def test_ueberzahlung_ohne_grund_422_und_waehrung_422() -> None:
    s = ZahlungenService(_db(tx=_tx(amount="1300.00")))
    with pytest.raises(ZahlungenError) as exc:
        s.create_link(CTX, _body(amount_allocated=Decimal("1300")))
    assert exc.value.status_code == 422
    s2 = ZahlungenService(_db(rechnung=_rechnung(currency="EUR")))
    with pytest.raises(ZahlungenError) as exc2:
        s2.create_link(CTX, _body())
    assert exc2.value.status_code == 422


def test_ausgang_nicht_auf_rechnung_und_entwurf_nicht_zahlbar() -> None:
    with pytest.raises(ZahlungenError) as exc:
        ZahlungenService(_db(tx=_tx(amount="-100"))).create_link(CTX, _body())
    assert exc.value.status_code == 422
    with pytest.raises(ZahlungenError) as exc2:
        ZahlungenService(_db(rechnung=_rechnung(status="draft"))).create_link(CTX, _body())
    assert exc2.value.status_code == 422


def test_loesen_stellt_rechnung_und_zaehler_wieder_her() -> None:
    db = _db()
    s = ZahlungenService(db)
    s.create_link(CTX, _body())
    s.delete_link(CTX, "tx1_re1")
    re = db.einzige("invoices")
    assert re["status"] == "sent" and re["paid_amount"] == "0.00" and re["paid_at"] is None
    assert db.rows("invoice_payments") == [] and db.rows("transaction_links") == []
    tx = db.einzige("bank_transactions")
    assert tx["link_count"] == 0 and tx["linked_amount"] == "0.00"
    s.delete_link(CTX, "tx1_re1")  # No-Op


def test_bestands_body_wird_auf_kennungen_reduziert() -> None:
    db = _db()
    s = ZahlungenService(db)
    link = s.create_link_legacy(
        CTX,
        LegacyLinkCreate(
            transaction_id="tx1",
            document_id="re1",
            document_type="rechnung",
            amount_difference=Decimal("999"),  # Browserwert — wird ignoriert
        ),
    )
    assert link.amount_difference is None
    assert db.einzige("invoices")["status"] == "paid"
    status = s.set_booking_status(CTX, link.id, "open")
    assert status.booking_status == "open" and status.booked_at is None


def test_vorschlaege_bewerten_betrag_nummer_name() -> None:
    db = _db()
    db.rows("invoices").append(
        _rechnung(id="re2", invoice_number="RE-2026-0008", gross_amount="99.00", customer_id=None)
    )
    db.rows("invoices").append(_rechnung(id="re3", currency="EUR"))
    v = ZahlungenService(db).suggestions(CTX, "tx1")
    assert [x.invoice_id for x in v] == ["re1"]
    assert v[0].score == 210 and set(v[0].reasons) == {
        "amount_exact",
        "number_in_purpose",
        "name_match",
    }


def test_ausgaben_tabelle_fehlt_503() -> None:
    db = _db(tx=_tx(amount="-100"))
    db.fehlende_tabellen.add("expenses")
    with pytest.raises(ZahlungenError) as exc:
        ZahlungenService(db).create_link(
            CTX,
            TransactionLinkCreate(transaction_id="tx1", document_type="EXPENSE", document_id="a1"),
        )
    assert exc.value.status_code == 503


def test_fremder_tenant_sieht_nichts() -> None:
    fremd = AuthContext(user_id="u2", tenant_id="t2", role="admin")
    s = ZahlungenService(_db())
    with pytest.raises(ZahlungenError) as exc:
        s.create_link(fremd, _body())
    assert exc.value.status_code == 404
    assert s.list_links(fremd) == []
