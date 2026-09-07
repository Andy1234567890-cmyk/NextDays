"""Status-Filter der Abrechnung: nur Werte des DB-Enums `reservation_status`.

Live 07.09.2026: eine Abrechnung trug `checked_in`/`checked_out` im Filter —
Werte, die es im Enum nie gab. Postgres antwortete 22P02, der Beleg starb im
Portal und in der App mit 500. Zwei Riegel: 422 beim Schreiben, Aussieben
beim Lesen.
"""
from datetime import date

import pytest

from src.features.owner_statements.schemas import (
    StatementGenerateRequest,
    StatementUpdate,
)
from src.features.owner_statements.service import gueltige_status


def test_generate_request_weist_fremden_status_ab() -> None:
    with pytest.raises(ValueError, match="checked_in"):
        StatementGenerateRequest(
            owner_id="o-1",
            period_from=date(2026, 1, 1),
            period_to=date(2026, 1, 31),
            reservation_statuses=["confirmed", "checked_in"],
        )


def test_generate_request_nimmt_enum_werte() -> None:
    req = StatementGenerateRequest(
        owner_id="o-1",
        period_from=date(2026, 1, 1),
        period_to=date(2026, 1, 31),
        reservation_statuses=["confirmed", "completed"],
    )
    assert req.reservation_statuses == ["confirmed", "completed"]


def test_update_weist_fremden_status_ab_und_laesst_none() -> None:
    with pytest.raises(ValueError, match="Erlaubt"):
        StatementUpdate(reservation_statuses=["checked_out"])
    assert StatementUpdate().reservation_statuses is None


def test_gueltige_status_siebt_fremdwerte_aus() -> None:
    assert gueltige_status(["confirmed", "checked_in", "completed"]) == [
        "confirmed",
        "completed",
    ]
    assert gueltige_status([]) == []
