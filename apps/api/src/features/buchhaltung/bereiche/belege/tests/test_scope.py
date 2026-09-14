"""Scope (Wurzel 3/9): jeder per-ID-Zugriff und jede Liste sind tenant-gebunden."""

import pytest

from src.features.buchhaltung.bereiche.belege.schemas import ConvertRequest, RecurringUpdate
from src.features.buchhaltung.bereiche.belege.service import BelegeError

from .conftest import CTX, CTX_FREMD, FREMD, angebot, positionen, rechnung
from .fake_db import FakeDB


def test_liste_zeigt_nur_eigene_belege(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [
        rechnung("eigen"),
        rechnung("fremd", tenant=FREMD, customer_id="k9"),
        rechnung("ls", typ="delivery_note"),
        rechnung("weg", deleted_at="2026-09-01T00:00:00Z"),
    ]
    res = svc.list_documents(CTX, typ="invoice")
    assert [i.id for i in res.items] == ["eigen"]
    assert res.items[0].customer_name == "Gæst A/S"
    assert [i.id for i in svc.list_documents(CTX, typ="delivery_note").items] == ["ls"]


def test_liste_angebote_aus_quotes(svc, db: FakeDB) -> None:
    db.tables["quotes"] = [angebot("a1"), angebot("a2", tenant=FREMD)]
    res = svc.list_documents(CTX, typ="quote")
    assert [i.id for i in res.items] == ["a1"] and res.items[0].type == "quote"
    assert res.items[0].due_date is not None  # valid_until


def test_liste_grenzen(svc) -> None:
    with pytest.raises(BelegeError) as exc:
        svc.list_documents(CTX, typ="invoice", limit=501)
    assert exc.value.status_code == 422
    with pytest.raises(BelegeError) as exc:
        svc.list_documents(CTX, typ="rechnung")
    assert exc.value.status_code == 422


def test_fremder_beleg_ist_404_ueberall(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [rechnung("re1")]
    db.tables["invoice_line_items"] = positionen("re1")
    db.tables["quotes"] = [angebot("an1")]
    for aufruf in (
        lambda: svc.get_document(CTX_FREMD, "re1"),
        lambda: svc.get_document(CTX_FREMD, "an1", typ="quote"),
        lambda: svc.convert(CTX_FREMD, "re1", ConvertRequest(target="credit_note")),
        lambda: svc.convert(
            CTX_FREMD, "an1", ConvertRequest(target="invoice", source_type="quote")
        ),
        lambda: svc.finalize(CTX_FREMD, "re1"),
        lambda: svc.update_recurring(CTX_FREMD, "re1", RecurringUpdate(status="paused")),
    ):
        with pytest.raises(BelegeError) as exc:
            aufruf()
        assert exc.value.status_code == 404
    # Nichts wurde geschrieben.
    assert not db.inserts and not db.updates and not db.rpc_calls


def test_fremder_kunde_beim_anlegen_404(svc) -> None:
    from src.features.buchhaltung.bereiche.belege.schemas import DocumentCreate, PositionInput

    with pytest.raises(BelegeError) as exc:
        svc.create_document(
            CTX,
            typ="invoice",
            body=DocumentCreate(customerId="k9", items=[PositionInput(description="x")]),
        )
    assert exc.value.status_code == 404


def test_lauf_arbeitet_nur_eigene_vorlagen_ab(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [
        rechnung(
            "v_fremd",
            tenant=FREMD,
            typ="recurring",
            status="draft",
            number=None,
            is_recurring_template=True,
            recurring_status="active",
            recurring_interval="monthly",
            recurring_next_at="2026-01-01",
        ),
    ]
    assert svc.run_recurring(CTX).created == 0
