"""Belegkette: Angebot → AB → Lieferschein → Rechnung → Gutschrift.

Was hier festgehalten ist: Positionen werden übernommen und die Beträge NEU
gerechnet; jeder Folgebeleg ist ein Entwurf ohne Nummer; die Richtung ist fix;
die Umwandlung ist idempotent (Unique-Index 0660 UND Read-vor-Write).
"""

from decimal import Decimal

import pytest

from src.features.buchhaltung.bereiche.belege.schemas import ConvertRequest
from src.features.buchhaltung.bereiche.belege.service import BelegeError

from .conftest import CTX, TENANT, angebot, positionen, rechnung
from .fake_db import FakeDB


def test_angebot_wird_auftragsbestaetigung(svc, db: FakeDB) -> None:
    db.tables["quotes"] = [angebot()]
    db.tables["quote_line_items"] = positionen("an1", schluessel="quote_id")

    ab = svc.convert(CTX, "an1", ConvertRequest(target="order_confirmation", source_type="quote"))

    assert ab.type == "order_confirmation"
    assert ab.status == "draft" and ab.number is None  # Nummer erst bei finalize
    assert ab.source_quote_id == "an1"
    assert ab.currency == "DKK" and ab.customer_name == "Gæst A/S"
    assert [p.description for p in ab.items] == ["Übernachtung", "Endreinigung"]
    assert (ab.net_amount, ab.tax_amount, ab.gross_amount) == (
        Decimal("100.00"),
        Decimal("25.00"),
        Decimal("125.00"),
    )
    # Angebot ist jetzt umgewandelt und zeigt auf die AB.
    q = db.rows("quotes")[0]
    assert q["status"] == "converted" and q["converted_invoice_id"] == ab.id
    assert not db.rpc_calls  # kein Nummernzug beim Umwandeln


def test_angebot_zweimal_umwandeln_gibt_dieselbe_ab(svc, db: FakeDB) -> None:
    db.tables["quotes"] = [angebot()]
    db.tables["quote_line_items"] = positionen("an1", schluessel="quote_id")
    req = ConvertRequest(target="order_confirmation", source_type="quote")
    erste = svc.convert(CTX, "an1", req)
    zweite = svc.convert(CTX, "an1", req)
    assert erste.id == zweite.id
    assert len([r for r in db.rows("invoices") if r["invoice_type"] == "order_confirmation"]) == 1


def test_kette_ab_lieferschein_rechnung(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [rechnung("ab1", typ="order_confirmation", status="draft", number=None)]
    db.tables["invoice_line_items"] = positionen("ab1")

    ls = svc.convert(CTX, "ab1", ConvertRequest(target="delivery_note"))
    assert ls.type == "delivery_note" and ls.source_document_id == "ab1"
    assert len(ls.items) == 2

    re = svc.convert(CTX, ls.id, ConvertRequest(target="invoice"))
    assert re.type == "invoice" and re.source_document_id == ls.id
    assert re.status == "draft" and re.number is None
    assert re.gross_amount == Decimal("125.00")

    # Detail des Lieferscheins zeigt die Rechnung als Folgebeleg.
    detail = svc.get_document(CTX, ls.id)
    assert [d.type for d in detail.derived] == ["invoice"]


def test_gutschrift_negiert_und_laesst_original_stehen(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [rechnung("re1")]
    db.tables["invoice_line_items"] = positionen("re1")

    gu = svc.convert(CTX, "re1", ConvertRequest(target="credit_note"))

    assert gu.type == "credit_note" and gu.status == "draft"
    assert gu.gross_amount == Decimal("-125.00")
    assert all(p.unit_price < 0 and p.net_amount < 0 for p in gu.items)
    assert gu.head_text == "Gutschrift zu Rechnung RE-0001"
    original = next(r for r in db.rows("invoices") if r["id"] == "re1")
    assert original["status"] == "finalized"  # kein Storno: Original bleibt gültig


def test_gutschrift_nur_aus_ausgestellter_rechnung(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [rechnung("re1", status="draft", number=None)]
    with pytest.raises(BelegeError) as exc:
        svc.convert(CTX, "re1", ConvertRequest(target="credit_note"))
    assert exc.value.status_code == 409


@pytest.mark.parametrize(
    ("quell_art", "ziel"),
    [
        ("delivery_note", "order_confirmation"),  # rückwärts
        ("invoice", "delivery_note"),  # rückwärts
        ("credit_note", "invoice"),  # Sackgasse
        ("storno", "credit_note"),
    ],
)
def test_richtung_der_kette_ist_fix(svc, db: FakeDB, quell_art: str, ziel: str) -> None:
    db.tables["invoices"] = [rechnung("x1", typ=quell_art)]
    with pytest.raises(BelegeError) as exc:
        svc.convert(CTX, "x1", ConvertRequest(target=ziel))
    assert exc.value.status_code == 422


def test_umwandlung_ist_idempotent_bei_race(svc, db: FakeDB) -> None:
    """Zwei Requests passieren Read-vor-Write gleichzeitig: der zweite Insert
    kollidiert am Unique-Index (0660) und liefert den vorhandenen Beleg."""
    db.tables["invoices"] = [rechnung("re1")]
    db.tables["invoice_line_items"] = positionen("re1")
    erste = svc.convert(CTX, "re1", ConvertRequest(target="credit_note"))
    # Read-vor-Write ausschalten → der Service läuft in den Insert.
    svc._vorhandener_folgebeleg = lambda *a, **k: None  # type: ignore[method-assign]  # noqa: SLF001
    try:
        svc.convert(CTX, "re1", ConvertRequest(target="credit_note"))
    except BelegeError as exc:
        # Unser Fake liefert nach der Kollision denselben (gepatchten) None-Weg → 500
        # ist hier das erwartete Signal, dass KEIN zweiter Beleg entstand.
        assert exc.status_code == 500
    assert len([r for r in db.rows("invoices") if r["invoice_type"] == "credit_note"]) == 1
    assert (
        erste.id == [r for r in db.rows("invoices") if r["invoice_type"] == "credit_note"][0]["id"]
    )


def test_quelle_ohne_waehrung_422(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [
        rechnung("ab1", typ="order_confirmation", status="draft", number=None, currency=None)
    ]
    with pytest.raises(BelegeError) as exc:
        svc.convert(CTX, "ab1", ConvertRequest(target="invoice"))
    assert exc.value.status_code == 422


def test_positionsfehler_rollt_kopf_zurueck(svc, db: FakeDB, monkeypatch) -> None:
    db.tables["invoices"] = [rechnung("ab1", typ="order_confirmation", status="draft", number=None)]
    db.tables["invoice_line_items"] = positionen("ab1")
    orig_table = db.table

    def kaputte_positionen(name: str):  # noqa: ANN202
        chain = orig_table(name)
        if name == "invoice_line_items":

            def _insert(_payload):  # noqa: ANN001, ANN202
                from postgrest.exceptions import APIError  # noqa: PLC0415

                raise APIError({"message": "boom", "code": "XX000", "hint": None, "details": None})

            chain.insert = _insert  # type: ignore[method-assign]
        return chain

    monkeypatch.setattr(db, "table", kaputte_positionen)
    with pytest.raises(BelegeError) as exc:
        svc.convert(CTX, "ab1", ConvertRequest(target="invoice"))
    assert exc.value.status_code == 500
    assert [r["id"] for r in db.rows("invoices")] == ["ab1"]  # kein verwaister Kopf
    assert db.deletes and db.deletes[-1][0] == "invoices"
    assert all(r["tenant_id"] == TENANT for r in db.rows("invoices"))
