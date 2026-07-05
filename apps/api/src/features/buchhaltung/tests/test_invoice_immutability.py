"""GoBD: festgeschriebene Rechnungen sind unlösch- und unveränderbar.

is_locked allein reicht als Gate NICHT (Default false, wird nie gesetzt) — der
Guard prüft zusätzlich status (nur 'draft' änderbar) und invoice_number.
"""
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.service import BuchhaltungError, BuchhaltungService

CTX = AuthContext(user_id="u1", tenant_id="t1", role="admin")


def _service_with_invoice(row: dict) -> BuchhaltungService:
    db = MagicMock(name="db")
    tbl = db.table.return_value
    sel = tbl.select.return_value.eq.return_value.eq.return_value.limit.return_value
    sel.execute.return_value = SimpleNamespace(data=[row])
    # update-Kette (falls es bis dahin käme) neutralisieren
    upd = tbl.update.return_value.eq.return_value.eq.return_value
    upd.execute.return_value = SimpleNamespace(data=[row])
    return BuchhaltungService(service_client=db)


def test_finalized_invoice_not_deletable() -> None:
    svc = _service_with_invoice(
        {"is_locked": False, "status": "finalized", "invoice_number": "RE-0007"}
    )
    with pytest.raises(BuchhaltungError) as exc:
        svc.delete_invoice(CTX, "i1")
    assert exc.value.status_code == 409


def test_numbered_paid_invoice_not_deletable() -> None:
    svc = _service_with_invoice(
        {"is_locked": False, "status": "paid", "invoice_number": "RE-0008"}
    )
    with pytest.raises(BuchhaltungError) as exc:
        svc.delete_invoice(CTX, "i1")
    assert exc.value.status_code == 409


def test_draft_without_number_deletable() -> None:
    svc = _service_with_invoice(
        {"is_locked": False, "status": "draft", "invoice_number": None}
    )
    svc.delete_invoice(CTX, "i1")  # kein Raise → Soft-Delete erlaubt
