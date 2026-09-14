"""Gemeinsame Bausteine der Belege-Tests: Tenant, Kontexte, Stammdaten."""

from __future__ import annotations

from datetime import date

import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.bereiche.belege.service import BelegeService

from .fake_db import FakeDB

TENANT = "t1"
FREMD = "t2"
CTX = AuthContext(user_id="u", tenant_id=TENANT, role="admin")
CTX_FREMD = AuthContext(user_id="u2", tenant_id=FREMD, role="admin")
HEUTE = date(2026, 9, 12)


def rechnung(
    beleg_id: str = "re1",
    *,
    tenant: str = TENANT,
    status: str = "finalized",
    number: str | None = "RE-0001",
    typ: str = "invoice",
    **extra: object,
) -> dict:
    return {
        "id": beleg_id,
        "tenant_id": tenant,
        "customer_id": "k1",
        "invoice_type": typ,
        "status": status,
        "invoice_number": number,
        "issue_date": "2026-09-01",
        "currency": "DKK",
        "net_amount": "100.00",
        "tax_amount": "25.00",
        "gross_amount": "125.00",
        "tax_rule": "DE_TAXABLE",
        "is_kleinunternehmer": False,
        "is_locked": False,
        "head_text": "Kopf",
        "footer_text": "Fuß",
        "deleted_at": None,
        "created_at": "2026-09-01T00:00:00Z",
        "updated_at": "2026-09-01T00:00:00Z",
        **extra,
    }


def positionen(beleg_id: str, *, schluessel: str = "invoice_id") -> list[dict]:
    return [
        {
            "id": f"{beleg_id}-p1",
            schluessel: beleg_id,
            "position": 1,
            "description": "Übernachtung",
            "quantity": "2",
            "unit": "Nacht",
            "unit_price": "40.00",
            "tax_rate": "25",
            "discount_percent": "0",
            "net_amount": "80.00",
            "tax_amount": "20.00",
            "gross_amount": "100.00",
        },
        {
            "id": f"{beleg_id}-p2",
            schluessel: beleg_id,
            "position": 2,
            "description": "Endreinigung",
            "quantity": "1",
            "unit": "Stk",
            "unit_price": "20.00",
            "tax_rate": "25",
            "discount_percent": "0",
            "net_amount": "20.00",
            "tax_amount": "5.00",
            "gross_amount": "25.00",
        },
    ]


def angebot(quote_id: str = "an1", *, tenant: str = TENANT) -> dict:
    return {
        "id": quote_id,
        "tenant_id": tenant,
        "customer_id": "k1",
        "quote_number": "AN-0001",
        "status": "sent",
        "issue_date": "2026-08-20",
        "valid_until": "2026-09-30",
        "currency": "DKK",
        "net_amount": "100.00",
        "tax_amount": "25.00",
        "gross_amount": "125.00",
        "tax_rule": "DE_TAXABLE",
        "head_text": "Angebotskopf",
        "footer_text": None,
        "notes": None,
        "converted_invoice_id": None,
        "deleted_at": None,
        "created_at": "2026-08-20T00:00:00Z",
        "updated_at": "2026-08-20T00:00:00Z",
    }


class Service(BelegeService):
    """Heute ist fix — Tests dürfen nicht vom Kalender abhängen."""

    @staticmethod
    def _heute() -> date:
        return HEUTE


@pytest.fixture(name="db")
def _db() -> FakeDB:
    return FakeDB(
        tenants=[{"id": TENANT, "currency": "DKK"}, {"id": FREMD, "currency": "EUR"}],
        tenant_billing_profile=[{"tenant_id": TENANT, "is_kleinunternehmer": False}],
        customers=[
            {"id": "k1", "tenant_id": TENANT, "name": "Gæst A/S"},
            {"id": "k9", "tenant_id": FREMD, "name": "Fremd"},
        ],
    )


@pytest.fixture(name="svc")
def _svc(db: FakeDB) -> Service:
    return Service(db)  # type: ignore[arg-type]
