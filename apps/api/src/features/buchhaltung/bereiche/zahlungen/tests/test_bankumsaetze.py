"""Bankumsätze: CSV-Import mit Dubletten, Handbuchung idempotent, Kasse nie
negativ, Listenfilter mit Obergrenzen."""

import base64
from datetime import date
from decimal import Decimal

import pytest

from src.core.security import AuthContext

from ..basis import ZahlungenError
from ..schemas import (
    BankTransactionCreate,
    BankTransactionUpdate,
    CsvImportRequest,
    CsvMapping,
    CsvPreviewRequest,
)
from ..service import ZahlungenService
from .fake_db import FakeDb

CTX = AuthContext(user_id="u1", tenant_id="t1", role="admin")
STAMP = "2026-09-01T00:00:00Z"


def _konto(**extra: object) -> dict:
    return {
        "id": "k1",
        "tenant_id": "t1",
        "name": "Bank",
        "type": "bank",
        "currency": "DKK",
        "opening_balance": "0",
        "is_default": True,
        "active": True,
        "created_at": STAMP,
        "updated_at": STAMP,
        **extra,
    }


def _db(**tables: list[dict]) -> FakeDb:
    return FakeDb(tenants=[{"id": "t1", "currency": "DKK"}], payment_accounts=[_konto()], **tables)


CSV = (
    "Buchungstag;Betrag;Verwendungszweck;Name\n"
    "01.09.2026;1.250,00;RE-2026-0007 Otto;Otto Hansen\n"
    "02.09.2026;-49,90;Gebühr;Bank\n"
    "02.09.2026;-49,90;Gebühr;Bank\n"  # Dublette in der Datei
    "03.09.2026;abc;kaputt;X\n"  # Zeilenfehler
)


def _import(inhalt: str = CSV, **extra: object) -> CsvImportRequest:
    return CsvImportRequest(
        payment_account_id="k1",
        file_name="auszug.csv",
        content_base64=base64.b64encode(inhalt.encode("utf-8")).decode(),
        mapping=CsvMapping(date=0, amount=1, purpose=2, name=3),
        **extra,
    )


def test_preview_liefert_kopf_und_vorschlag() -> None:
    s = ZahlungenService(_db())
    p = s.preview_csv(
        CTX,
        CsvPreviewRequest(
            file_name="a.csv", content_base64=base64.b64encode(CSV.encode()).decode()
        ),
    )
    assert p.header == ["Buchungstag", "Betrag", "Verwendungszweck", "Name"]
    assert p.row_count == 4
    assert p.suggested_mapping is not None and p.suggested_mapping.amount == 1


def test_import_zaehlt_importiert_dubletten_fehler() -> None:
    db = _db()
    s = ZahlungenService(db)
    r = s.import_csv(CTX, _import())
    assert (r.row_count, r.imported_count, r.duplicate_count, r.error_count) == (4, 2, 1, 1)
    assert r.errors[0].row == 5
    umsaetze = db.rows("bank_transactions")
    assert {u["amount"] for u in umsaetze} == {"1250.00", "-49.90"}
    assert all(u["currency"] == "DKK" and u["source"] == "import" for u in umsaetze)
    batch = db.einzige("bank_import_batches")
    assert batch["imported_count"] == 2 and batch["duplicate_count"] == 1

    # Derselbe Auszug noch einmal: alles Dubletten, nichts gebucht (Wurzel 2).
    r2 = s.import_csv(CTX, _import())
    assert (r2.imported_count, r2.duplicate_count) == (0, 3)
    assert len(db.rows("bank_transactions")) == 2


def test_import_binaer_422() -> None:
    s = ZahlungenService(_db())
    body = _import()
    body.content_base64 = base64.b64encode(b"%PDF-1.4 xyz").decode()
    with pytest.raises(ZahlungenError) as exc:
        s.import_csv(CTX, body)
    assert exc.value.status_code == 422


def test_import_fremdwaehrung_zeile_ist_fehler() -> None:
    inhalt = "Datum;Betrag;Zweck;Name;Whg\n01.09.2026;10,00;x;y;EUR\n02.09.2026;10,00;x;y;DKK\n"
    body = _import(inhalt)
    body.mapping = CsvMapping(date=0, amount=1, purpose=2, name=3, currency=4)
    r = ZahlungenService(_db()).import_csv(CTX, body)
    assert (r.imported_count, r.error_count) == (1, 1)
    assert "EUR" in r.errors[0].message


def test_handbuchung_idempotent() -> None:
    db = _db()
    s = ZahlungenService(db)
    body = BankTransactionCreate(
        payment_account_id="k1",
        booking_date=date(2026, 9, 5),
        amount=Decimal("100"),
        purpose="Miete",
        counterpart_name="Otto",
    )
    a = s.create_transaction(CTX, body)
    b = s.create_transaction(CTX, body)  # Doppelklick
    assert a.id == b.id
    assert len(db.rows("bank_transactions")) == 1
    assert a.source == "manual" and a.currency == "DKK" and a.status == "unmatched"


def test_kasse_nie_negativ_auch_rueckwirkend() -> None:
    db = _db()
    db.rows("payment_accounts").append(
        _konto(id="kasse", type="cash", name="Kasse", is_default=False)
    )
    s = ZahlungenService(db)
    s.create_transaction(
        CTX,
        BankTransactionCreate(
            payment_account_id="kasse", booking_date=date(2026, 9, 5), amount=Decimal("50")
        ),
    )
    with pytest.raises(ZahlungenError) as exc:
        s.create_transaction(
            CTX,
            BankTransactionCreate(
                payment_account_id="kasse", booking_date=date(2026, 9, 6), amount=Decimal("-60")
            ),
        )
    assert exc.value.status_code == 422
    # Rückwirkend VOR der Einzahlung wäre der Bestand am 3.9. negativ.
    with pytest.raises(ZahlungenError):
        s.create_transaction(
            CTX,
            BankTransactionCreate(
                payment_account_id="kasse", booking_date=date(2026, 9, 3), amount=Decimal("-10")
            ),
        )
    ok = s.create_transaction(
        CTX,
        BankTransactionCreate(
            payment_account_id="kasse", booking_date=date(2026, 9, 6), amount=Decimal("-50")
        ),
    )
    assert ok.amount == Decimal("-50.00")
    # Bank darf ins Minus (Kontokorrent) — die Regel gilt nur der Kasse.
    s.create_transaction(
        CTX,
        BankTransactionCreate(
            payment_account_id="k1", booking_date=date(2026, 9, 6), amount=Decimal("-500")
        ),
    )


def test_liste_filter_und_obergrenzen() -> None:
    db = _db()
    s = ZahlungenService(db)
    s.import_csv(CTX, _import())
    alle = s.list_transactions(CTX)
    assert (
        alle.total == 2 and alle.sum_in == Decimal("1250.00") and alle.sum_out == Decimal("-49.90")
    )
    offen = s.list_transactions(CTX, status="unmatched", search="RE-2026")
    assert offen.total == 1 and offen.items[0].purpose.startswith("RE-2026")
    with pytest.raises(ZahlungenError) as exc:
        s.list_transactions(CTX, date_from=date(2025, 1, 1), date_to=date(2026, 9, 1))
    assert exc.value.status_code == 422
    with pytest.raises(ZahlungenError):
        s.list_transactions(CTX, status="egal")


def test_ignorieren_und_notiz() -> None:
    db = _db()
    s = ZahlungenService(db)
    r = s.import_csv(CTX, _import())
    assert r.imported_count == 2
    tx = s.list_transactions(CTX, status="unmatched").items[1]
    geaendert = s.update_transaction(
        CTX, tx.id, BankTransactionUpdate(ignored=True, note="Bankgebühr")
    )
    assert geaendert.status == "ignored" and geaendert.note == "Bankgebühr"
    assert s.list_transactions(CTX, status="ignored").total == 1
    # Verknüpfter Umsatz lässt sich nicht beiseitelegen.
    db.rows("bank_transactions")[0]["link_count"] = 1
    with pytest.raises(ZahlungenError) as exc:
        s.update_transaction(
            CTX, db.rows("bank_transactions")[0]["id"], BankTransactionUpdate(ignored=True)
        )
    assert exc.value.status_code == 409
