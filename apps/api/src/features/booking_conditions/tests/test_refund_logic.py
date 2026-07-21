"""Kritische Geldlogik testen: Refund-Prozentsatz + Anzahlungsbetrag aus einer
Buchungs-Kondition. Reine Funktionen (keine DB/Stripe nötig)."""
from __future__ import annotations

from datetime import date

from src.features.payments.service import PaymentsService


def test_non_refundable_is_zero() -> None:
    cond = {"cancellation_mode": "non_refundable"}
    assert PaymentsService._refund_percent_for(cond, 90) == 0.0


def test_refundable_is_full() -> None:
    cond = {"cancellation_mode": "refundable"}
    assert PaymentsService._refund_percent_for(cond, 0) == 100.0


def test_partial_picks_highest_matching_tier() -> None:
    cond = {
        "cancellation_mode": "partial",
        "refund_rules": [
            {"refund_percent": 100, "days_before_arrival": 30},
            {"refund_percent": 50, "days_before_arrival": 14},
        ],
    }
    # 40 Tage vorher → beide Regeln greifen, höchste (100 %) gewinnt.
    assert PaymentsService._refund_percent_for(cond, 40) == 100.0
    # 20 Tage vorher → nur die 14-Tage-Regel greift.
    assert PaymentsService._refund_percent_for(cond, 20) == 50.0
    # 5 Tage vorher → keine Regel greift → 0 %.
    assert PaymentsService._refund_percent_for(cond, 5) == 0.0


def test_partial_without_rules_is_zero() -> None:
    cond = {"cancellation_mode": "partial", "refund_rules": []}
    assert PaymentsService._refund_percent_for(cond, 100) == 0.0


def test_first_payment_full_when_single_installment() -> None:
    cond = {"installments": 1}
    assert PaymentsService._first_payment_amount(cond, 500.0) == 500.0


def test_first_payment_percentage_on_split() -> None:
    cond = {"installments": 2, "first_payment_percent": 10}
    assert PaymentsService._first_payment_amount(cond, 1000.0) == 100.0


def test_first_payment_full_when_percent_missing() -> None:
    # Split ohne Prozentsatz = kein sinnvoller Teilbetrag → voller Betrag.
    cond = {"installments": 2, "first_payment_percent": None}
    assert PaymentsService._first_payment_amount(cond, 800.0) == 800.0


def test_balance_due_at_days_before_arrival() -> None:
    cond = {"balance_days_before_arrival": 45}
    due = PaymentsService._balance_due_at(cond, date(2026, 6, 1))
    assert due is not None
    assert due.date() == date(2026, 4, 17)


def test_balance_due_at_none_when_unset() -> None:
    assert PaymentsService._balance_due_at({}, date(2026, 6, 1)) is None
