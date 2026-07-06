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


def test_raw_update_cannot_finalize_numberless_draft() -> None:
    """update_invoice_raw darf einen nummernlosen Entwurf NICHT auf 'finalized'
    (oder paid/sent) heben — dabei würde keine GoBD-Nummer gezogen → ein
    festgeschriebener Beleg ohne Rechnungsnummer + unrettbar."""
    svc = _service_with_invoice(
        {"is_locked": False, "status": "draft", "invoice_number": None}
    )
    for status in ("finalized", "paid", "sent"):
        with pytest.raises(BuchhaltungError) as exc:
            svc.update_invoice_raw(CTX, "i1", {"status": status})
        assert exc.value.status_code == 409


def test_raw_update_draft_stays_draft_ok() -> None:
    """Ein Entwurf darf über den Roh-Endpunkt weiter im Entwurf bleiben / Notizen
    ändern (kein Statuswechsel weg von draft)."""
    svc = _service_with_invoice(
        {"is_locked": False, "status": "draft", "invoice_number": None}
    )
    # status='draft' + Notiz → erlaubt (kein Raise).
    svc.update_invoice_raw(CTX, "i1", {"status": "draft", "notes": "Hinweis"})
