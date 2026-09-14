"""Nummernkreis je Belegart und Festschreibung.

Ein Entwurf hat keine Nummer. `finalize` zieht sie aus dem Kreis SEINER Art
(AB-/LS-/RE-/GU-) über `next_document_number` — und danach ist der Beleg
festgeschrieben (identische Regel wie ../../tests/test_invoice_immutability.py).
"""

import pytest

from src.features.buchhaltung.bereiche.belege.schemas import DocumentCreate, PositionInput
from src.features.buchhaltung.bereiche.belege.service import BelegeError, festgeschrieben

from .conftest import CTX, positionen, rechnung
from .fake_db import FakeDB


@pytest.mark.parametrize(
    ("typ", "doc_type", "prefix"),
    [
        ("order_confirmation", "order_confirmation", "AB-"),
        ("delivery_note", "delivery_note", "LS-"),
        ("invoice", "invoice", "RE-"),
        ("credit_note", "credit_note", "GU-"),
    ],
)
def test_finalize_zieht_nummer_aus_dem_kreis_der_art(
    svc, db: FakeDB, typ: str, doc_type: str, prefix: str
) -> None:
    db.tables["invoices"] = [rechnung("d1", typ=typ, status="draft", number=None, issue_date=None)]
    db.tables["invoice_line_items"] = positionen("d1")

    fertig = svc.finalize(CTX, "d1")

    assert db.rpc_calls == [{"p_tenant_id": "t1", "p_doc_type": doc_type, "p_prefix": prefix}]
    assert fertig.number == f"{prefix}0001" and fertig.status == "finalized"
    assert fertig.issue_date is not None  # Ausstellungsdatum = heute, wenn leer
    row = db.rows("invoices")[0]
    assert festgeschrieben(row)


def test_zwei_arten_zwei_zaehler(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [
        rechnung("a", typ="order_confirmation", status="draft", number=None),
        rechnung("b", typ="delivery_note", status="draft", number=None),
        rechnung("c", typ="order_confirmation", status="draft", number=None),
    ]
    db.tables["invoice_line_items"] = positionen("a") + positionen("b") + positionen("c")
    assert svc.finalize(CTX, "a").number == "AB-0001"
    assert svc.finalize(CTX, "b").number == "LS-0001"
    assert svc.finalize(CTX, "c").number == "AB-0002"


def test_festgeschriebener_beleg_nicht_erneut_finalisierbar(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [rechnung("re1")]
    with pytest.raises(BelegeError) as exc:
        svc.finalize(CTX, "re1")
    assert exc.value.status_code == 409
    assert not db.rpc_calls  # keine Nummer verbrannt


@pytest.mark.parametrize(
    "row",
    [
        pytest.param({"status": "draft", "number": None, "is_locked": True}, id="gesperrt"),
        pytest.param({"status": "sent", "number": None}, id="status_nicht_draft"),
        pytest.param({"status": "draft", "number": "RE-0009"}, id="nummer_vergeben"),
    ],
)
def test_festschreibung_regel_wie_im_bestand(svc, db: FakeDB, row: dict) -> None:
    db.tables["invoices"] = [rechnung("x", **row)]
    db.tables["invoice_line_items"] = positionen("x")
    with pytest.raises(BelegeError) as exc:
        svc.finalize(CTX, "x")
    assert exc.value.status_code == 409


def test_beleg_ohne_positionen_wird_nicht_ausgestellt(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [rechnung("leer", status="draft", number=None)]
    with pytest.raises(BelegeError) as exc:
        svc.finalize(CTX, "leer")
    assert exc.value.status_code == 422
    assert not db.rpc_calls


def test_vorlage_wird_nie_festgeschrieben(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [
        rechnung("v", typ="recurring", status="draft", number=None, is_recurring_template=True)
    ]
    with pytest.raises(BelegeError) as exc:
        svc.finalize(CTX, "v")
    assert exc.value.status_code == 409


def test_editor_legt_entwurf_ohne_nummer_an_und_rechnet_selbst(svc, db: FakeDB) -> None:
    body = DocumentCreate(
        customerId="k1",
        items=[
            PositionInput(description="Miete", quantity=3, unitPrice="100", taxRate="25"),
            PositionInput(
                description="Rabatt", quantity=1, unitPrice="50", taxRate="25", category="discount"
            ),
        ],
    )
    beleg = svc.create_document(CTX, typ="order_confirmation", body=body)
    assert beleg.status == "draft" and beleg.number is None
    assert beleg.currency == "DKK"  # aus dem Mandanten, nicht erfunden
    assert str(beleg.net_amount) == "250.00" and str(beleg.tax_amount) == "62.50"
    assert str(beleg.gross_amount) == "312.50"
    assert beleg.items[1].unit_price < 0  # Rabatt negativ persistiert
    assert not db.rpc_calls


def test_editor_ohne_mandantenwaehrung_422(svc, db: FakeDB) -> None:
    db.tables["tenants"] = [{"id": "t1", "currency": None}]
    with pytest.raises(BelegeError) as exc:
        svc.create_document(
            CTX,
            typ="invoice",
            body=DocumentCreate(items=[PositionInput(description="x", unitPrice="1")]),
        )
    assert exc.value.status_code == 422


def test_editor_storno_und_vorlage_nicht_direkt(svc) -> None:
    for typ in ("storno", "recurring", "quote"):
        with pytest.raises(BelegeError) as exc:
            svc.create_document(
                CTX, typ=typ, body=DocumentCreate(items=[PositionInput(description="x")])
            )
        assert exc.value.status_code == 422
