"""Zählt die ERFOLGREICH vergebenen Channex-Token eines Jobs.

Ausgelagert aus `worker.py`: die Klasse ist reine Buchführung über ein Budget
und gehört nicht in den Claim-Loop. Der Worker ist ein bekanntes God-File
(siehe `pyproject.toml`, TODO(god-files)); jede Einheit, die klar für sich
steht, wandert bei Berührung heraus, statt die Modulgrenze weiter zu heben.
"""
from __future__ import annotations

from src.jobs.channex_budget import BudgetDecision, ChannexBudget


class ProgressBudget:
    """Dünner Wrapper um ein ChannexBudget, der die ERFOLGREICH vergebenen Token
    zählt (= echte Channex-Calls, die durchgingen). So erkennt _run_job, ob ein
    Batch-Job vor einem ChannexBudgetExhausted schon Fortschritt gemacht hat, und
    setzt dann den defer_count-Livelock-Zähler zurück. Erfüllt das before_call-
    Kontrakt (try_consume) transparent — der ChannexClient merkt keinen Unterschied."""

    def __init__(self, inner: ChannexBudget) -> None:
        self._inner = inner
        self.granted = 0

    def try_consume(
        self, channex_property_id: str | None, kind: str = "other"
    ) -> BudgetDecision:
        decision = self._inner.try_consume(channex_property_id, kind)
        if decision.allowed:
            self.granted += 1
        return decision
