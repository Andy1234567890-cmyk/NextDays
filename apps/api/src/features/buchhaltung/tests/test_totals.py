"""Tests für die serverseitige Summenbildung (_compute_totals).

Rabatt-Positionen (category='discount') kommen aus dem Formular POSITIV und
müssen serverseitig ABGEZOGEN werden — sonst weicht der GoBD-Beleg von der
angezeigten Rechnung ab (Review-Befund Hotel-Umbau).
"""
from decimal import Decimal
from unittest.mock import MagicMock

from src.features.buchhaltung.service import BuchhaltungService


def _service() -> BuchhaltungService:
    return BuchhaltungService(service_client=MagicMock())


def test_totals_plain_item() -> None:
    net, tax, gross = _service()._compute_totals(
        [{"quantity": 1, "unitPrice": 100, "taxRate": 19}]
    )
    assert (net, tax, gross) == (Decimal("100.00"), Decimal("19.00"), Decimal("119.00"))


def test_totals_discount_reduces_base_and_tax() -> None:
    """100 € à 19 % + 10 € Gesamtrabatt (19 %) → 90 / 17,10 / 107,10."""
    net, tax, gross = _service()._compute_totals(
        [
            {"quantity": 1, "unitPrice": 100, "taxRate": 19},
            {"quantity": 1, "unitPrice": 10, "taxRate": 19,
             "category": "discount"},
        ]
    )
    assert (net, tax, gross) == (Decimal("90.00"), Decimal("17.10"), Decimal("107.10"))


def test_totals_zero_rate_item_stays_zero() -> None:
    """0 % ist ein gültiger Satz (Kurtaxe aus Buchungsrechnungen)."""
    net, tax, gross = _service()._compute_totals(
        [
            {"quantity": 1, "unitPrice": 93.46, "taxRate": 7},
            {"quantity": 1, "unitPrice": 20, "taxRate": 0},
        ]
    )
    assert net == Decimal("113.46")
    assert tax == Decimal("6.54")
    assert gross == Decimal("120.00")
