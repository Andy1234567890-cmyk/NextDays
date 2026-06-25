"""Tests für die EU-Steuerlogik (tax.compute_tax) — reine Funktionen ohne DB."""
from decimal import Decimal

from src.features.owner_statements.tax import compute_tax


def test_standard_vat_same_country() -> None:
    r = compute_tax(
        taxable_base=Decimal("100"),
        tenant_tax_scheme="vat",
        tenant_default_rate=Decimal("19"),
        seller_country="DE",
        buyer_country="DE",
        buyer_vat_id=None,
    )
    assert r.category == "S"
    assert r.rate == Decimal("19")
    assert r.tax == Decimal("19.00")
    assert r.gross == Decimal("119.00")
    assert r.exemption_reason is None


def test_reverse_charge_cross_border_eu_b2b() -> None:
    # Verkäufer DE, Käufer AT mit USt-ID → Reverse Charge, keine USt.
    r = compute_tax(
        taxable_base=Decimal("100"),
        tenant_tax_scheme="vat",
        tenant_default_rate=Decimal("19"),
        seller_country="DE",
        buyer_country="AT",
        buyer_vat_id="ATU12345678",
    )
    assert r.category == "AE"
    assert r.tax == Decimal("0.00")
    assert r.gross == Decimal("100.00")
    assert "Reverse Charge" in (r.exemption_reason or "")


def test_no_reverse_charge_without_vat_id() -> None:
    # Grenzüberschreitend, aber Käufer ohne USt-ID → kein Reverse Charge.
    r = compute_tax(
        taxable_base=Decimal("100"),
        tenant_tax_scheme="vat",
        tenant_default_rate=Decimal("19"),
        seller_country="DE",
        buyer_country="AT",
        buyer_vat_id=None,
    )
    assert r.category == "S"


def test_small_business_exempt() -> None:
    r = compute_tax(
        taxable_base=Decimal("100"),
        tenant_tax_scheme="small_business",
        tenant_default_rate=Decimal("19"),
        seller_country="DE",
        buyer_country="DE",
        buyer_vat_id=None,
    )
    assert r.category == "E"
    assert r.tax == Decimal("0.00")
    assert "Kleinunternehmer" in (r.exemption_reason or "")


def test_non_eu_buyer_no_reverse_charge() -> None:
    # Käufer außerhalb der EU (z. B. CH) → kein innergem. Reverse Charge nach Art. 196.
    r = compute_tax(
        taxable_base=Decimal("100"),
        tenant_tax_scheme="vat",
        tenant_default_rate=Decimal("19"),
        seller_country="DE",
        buyer_country="CH",
        buyer_vat_id="CHE123456789",
    )
    assert r.category == "S"
