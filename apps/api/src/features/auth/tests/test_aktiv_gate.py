"""Tests für den Riegel gegen deaktivierte Zugänge (0356).

Der Riegel ist die Stelle, an der ein SCHON ausgestelltes Access-Token seine
Gültigkeit verliert. Der GoTrue-Bann allein reicht nicht: er stoppt neue
Anmeldungen und das Erneuern, nicht das Token in der Hand des Gesperrten.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from src.core.security import AuthContext
from src.features.auth.aktiv_gate import aktiv_zugang_pruefen


def _client(rows: list | Exception) -> MagicMock:
    client = MagicMock()
    kette = (
        client.table.return_value.select.return_value.eq.return_value
        .limit.return_value.execute
    )
    if isinstance(rows, Exception):
        kette.side_effect = rows
    else:
        kette.return_value = MagicMock(data=rows)
    return client


def test_aktiver_zugang_kommt_durch() -> None:
    with patch(
        "src.features.auth.aktiv_gate.get_service_client",
        return_value=_client([{"deactivated_at": None}]),
    ):
        aktiv_zugang_pruefen(AuthContext(user_id="u-1", tenant_id="t-1", role="staff"))


def test_deaktivierter_zugang_bekommt_401() -> None:
    with patch(
        "src.features.auth.aktiv_gate.get_service_client",
        return_value=_client([{"deactivated_at": "2026-08-10T09:00:00+00:00"}]),
    ):
        with pytest.raises(HTTPException) as exc:
            aktiv_zugang_pruefen(
                AuthContext(user_id="u-1", tenant_id="t-1", role="staff")
            )
    assert exc.value.status_code == 401


def test_lesefehler_ist_stoerung_keine_sperre() -> None:
    # Ein DB-Ausfall darf nicht als Kontosperre ausgegeben werden (503, nicht 401):
    # sonst sperrt ein Infrastrukturproblem jeden Nutzer aus und behauptet dabei
    # etwas Falsches über sein Konto.
    with patch(
        "src.features.auth.aktiv_gate.get_service_client",
        return_value=_client(RuntimeError("DB weg")),
    ):
        with pytest.raises(HTTPException) as exc:
            aktiv_zugang_pruefen(
                AuthContext(user_id="u-1", tenant_id="t-1", role="staff")
            )
    assert exc.value.status_code == 503


def test_api_client_token_wird_uebersprungen() -> None:
    # Hinter einem Client-Credentials-Token steht kein users-Zugang, den man
    # deaktivieren könnte — es darf auch keine DB-Abfrage auslösen.
    client = _client([])
    with patch(
        "src.features.auth.aktiv_gate.get_service_client", return_value=client
    ):
        aktiv_zugang_pruefen(
            AuthContext(user_id="c-1", tenant_id="t-1", role=None, api_scopes=[])
        )
    client.table.assert_not_called()
