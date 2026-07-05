"""Tests für create_storno_invoice (GoBD-Korrekturweg).

Chain-Mock wie test_reservation_invoice.py: execute() liefert je Tabelle eine
Antwort-Queue (deque) oder statische Daten.
"""
from collections import deque
from types import SimpleNamespace

import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.service import BuchhaltungError, BuchhaltungService

CTX = AuthContext(user_id="u1", tenant_id="t1")


class _Chain:
    def __init__(self, data: object, calls: list[str], inserts: list) -> None:
        self._data = data
        self.calls = calls
        self.inserts = inserts
        self._last_attr = ""

    def __getattr__(self, name: str) -> "_Chain":
        self.calls.append(name)
        object.__setattr__(self, "_last_attr", name)
        return self

    def __call__(self, *args: object, **kwargs: object) -> "_Chain":
        if self._last_attr == "insert" and args:
            self.inserts.append(args[0])
        return self

    def execute(self) -> SimpleNamespace:
        data = self._data
        if isinstance(data, deque):
            data = data.popleft() if data else []
        return SimpleNamespace(data=data)


class _DB:
    def __init__(self, tables: dict[str, object]) -> None:
        self._tables = tables
        self.calls: dict[str, list[str]] = {}
        self.inserts: dict[str, list] = {}

    def table(self, name: str) -> _Chain:
        calls = self.calls.setdefault(name, [])
        inserts = self.inserts.setdefault(name, [])
        return _Chain(self._tables.get(name, []), calls, inserts)

    def rpc(self, name: str, params: dict) -> _Chain:
        return _Chain(
            [{"sequential_number": 3, "formatted_number": "ST-0003"}],
            self.calls.setdefault(f"rpc:{name}", []),
            self.inserts.setdefault(f"rpc:{name}", []),
        )


_ORIGINAL = {
    "id": "i1",
    "tenant_id": "t1",
    "customer_id": "c1",
    "reservation_id": "r1",
    "invoice_number": "RE-0001",
    "invoice_type": "invoice",
    "status": "finalized",
    "currency": "EUR",
    "net_amount": 93.46,
    "tax_amount": 6.54,
    "gross_amount": 100.00,
    "tax_rate": 7,
    "tax_rule": "DE_TAXABLE",
    "is_kleinunternehmer": False,
}


def _service(tables: dict[str, object]) -> tuple[BuchhaltungService, _DB]:
    db = _DB(tables)
    return BuchhaltungService(service_client=db), db  # type: ignore[arg-type]


def test_storno_requires_reason() -> None:
    service, _ = _service({"invoices": [_ORIGINAL]})
    with pytest.raises(BuchhaltungError) as exc:
        service.create_storno_invoice(CTX, "i1", "   ")
    assert exc.value.status_code == 422


def test_storno_rejects_already_cancelled() -> None:
    service, _ = _service(
        {"invoices": [{**_ORIGINAL, "status": "cancelled"}]}
    )
    with pytest.raises(BuchhaltungError) as exc:
        service.create_storno_invoice(CTX, "i1", "falscher Betrag")
    assert exc.value.status_code == 409


def test_storno_rejects_storno_of_storno() -> None:
    service, _ = _service(
        {"invoices": [{**_ORIGINAL, "invoice_type": "storno"}]}
    )
    with pytest.raises(BuchhaltungError) as exc:
        service.create_storno_invoice(CTX, "i1", "grund")
    assert exc.value.status_code == 409


def test_storno_rejects_draft_original() -> None:
    """Ein Entwurf (status='draft', invoice_number=NULL) ist kein Beleg — ein
    Storno darauf würde eine ST-Nummer verbrennen + eine Gutschrift auf einen
    nicht existenten Beleg erzeugen (GoBD). Muss mit 409 abgelehnt werden."""
    service, db = _service(
        {"invoices": [{**_ORIGINAL, "status": "draft", "invoice_number": None}]}
    )
    with pytest.raises(BuchhaltungError) as exc:
        service.create_storno_invoice(CTX, "i1", "grund")
    assert exc.value.status_code == 409
    # KEINE ST-Nummer gezogen, KEIN Storno-Beleg angelegt (kein insert).
    assert "insert" not in db.calls.get("invoices", [])


def test_storno_rejects_original_without_number() -> None:
    """Auch ein sonst 'finalized', aber unnummerierter Beleg ist nicht stornierbar."""
    service, _ = _service(
        {"invoices": [{**_ORIGINAL, "invoice_number": None}]}
    )
    with pytest.raises(BuchhaltungError) as exc:
        service.create_storno_invoice(CTX, "i1", "grund")
    assert exc.value.status_code == 409


def test_storno_duplicate_is_idempotent_and_repairs_original() -> None:
    """Retry nach Teilfehler: bestehender Storno-Beleg wird zurückgegeben und
    das Original sicher auf 'cancelled' gesetzt (kein Sackgassen-409)."""
    existing = {
        "id": "s1",
        "invoice_number": "ST-0001",
        "invoice_type": "storno",
        "customer_id": "c1",
        "gross_amount": -100.0,
    }
    # invoices: Original → existierender Storno → Repair-Update des Originals.
    service, db = _service(
        {
            "invoices": deque([[_ORIGINAL], [existing], [_ORIGINAL]]),
            "invoice_line_items": [],
            "customers": [{"id": "c1", "name": "Max Muster", "email": "m@x.de"}],
        }
    )
    result = service.create_storno_invoice(CTX, "i1", "grund")
    assert result["invoiceNumber"] == "ST-0001"
    assert "update" in db.calls["invoices"]


def test_storno_negates_amounts_and_cancels_original() -> None:
    storno_row = {
        "id": "s9",
        "tenant_id": "t1",
        "customer_id": "c1",
        "reservation_id": "r1",
        "invoice_number": "ST-0003",
        "invoice_type": "storno",
        "status": "finalized",
        "currency": "EUR",
        "net_amount": -93.46,
        "tax_amount": -6.54,
        "gross_amount": -100.00,
        "original_invoice_id": "i1",
    }
    # invoices: Original → kein bestehender Storno → Insert-Ergebnis → Update.
    service, db = _service(
        {
            "invoices": deque([[_ORIGINAL], [], [storno_row], [storno_row]]),
            "invoice_line_items": deque(
                [
                    [{"position": 1, "description": "Übernachtung",
                      "quantity": 1, "unit": "pauschal", "unit_price": 93.46,
                      "tax_rate": 7, "discount_percent": 0,
                      "net_amount": 93.46, "tax_amount": 6.54,
                      "gross_amount": 100.00}],
                    [],
                ]
            ),
            "customers": [{"id": "c1", "name": "Max Muster"}],
        }
    )
    result = service.create_storno_invoice(CTX, "i1", "falscher Betrag")
    assert result["invoiceNumber"] == "ST-0003"
    assert result["isStorno"] is True
    assert result["total"] == -100.0
    assert "insert" in db.calls["invoices"]
    assert "update" in db.calls["invoices"]
    assert "insert" in db.calls["invoice_line_items"]


def test_storno_inherits_document_language() -> None:
    """Der Storno-Beleg erbt die Dokumentsprache des Originals (0099) —
    sonst italienische Positionen unter deutschem PDF/head_text."""
    storno_row = {"id": "s9", "invoice_number": "ST-0003", "invoice_type": "storno",
                  "gross_amount": -100.0, "net_amount": -93.46, "tax_amount": -6.54}
    service, db = _service(
        {
            "invoices": deque(
                [[{**_ORIGINAL, "language": "it"}], [], [storno_row], [storno_row]]
            ),
            "invoice_line_items": deque([[], []]),
            "customers": [{"id": "c1", "name": "Max Muster"}],
        }
    )
    service.create_storno_invoice(CTX, "i1", "falscher Betrag")
    inserted = db.inserts["invoices"][0]
    assert inserted["language"] == "it"
