"""Tests für require_internal_cron_secret (eigenes Cron-Secret, Fix 0104-Ära).

Das interne Cron-Secret ist bewusst vom CHANNEX_WEBHOOK_SECRET getrennt: das
Webhook-Secret geht outbound an Channex und darf deshalb keine internen,
tenant-übergreifenden Endpunkte autorisieren. Ohne konfiguriertes Secret sind
die Cron-Endpunkte hart deaktiviert (503, kein Fallback).
"""
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from src.core import security


def _settings(secret: str) -> MagicMock:
    s = MagicMock()
    s.internal_cron_secret = SecretStr(secret)
    return s


def test_unconfigured_secret_disables_endpoint(monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setattr(security, "get_settings", lambda: _settings(""))
    with pytest.raises(HTTPException) as exc:
        security.require_internal_cron_secret("egal")
    assert exc.value.status_code == 503


def test_wrong_or_missing_secret_401(monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setattr(security, "get_settings", lambda: _settings("richtig"))
    for provided in (None, "", "falsch"):
        with pytest.raises(HTTPException) as exc:
            security.require_internal_cron_secret(provided)
        assert exc.value.status_code == 401


def test_correct_secret_passes(monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setattr(security, "get_settings", lambda: _settings("richtig"))
    security.require_internal_cron_secret("richtig")  # kein Raise


def test_non_ascii_secret_is_rejected_not_500(monkeypatch) -> None:  # noqa: ANN001
    """Regression: ein nicht-ASCII-Header (angreiferkontrolliert) darf keinen
    TypeError→500 auslösen (secrets.compare_digest verträgt kein Zeichen > 127),
    sondern muss als sauberes 401 abgelehnt werden."""
    monkeypatch.setattr(security, "get_settings", lambda: _settings("richtig"))
    with pytest.raises(HTTPException) as exc:
        security.require_internal_cron_secret("fooé")  # nicht-ASCII
    assert exc.value.status_code == 401


def test_secrets_match_handles_non_ascii() -> None:
    """secrets_match vergleicht byteweise und ist robust gegen nicht-ASCII —
    ergibt False statt zu werfen; identische Werte (auch mit Nicht-ASCII) True."""
    assert security.secrets_match("fooé", "richtig") is False
    assert security.secrets_match("gleiché", "gleiché") is True
    assert security.secrets_match(None, "x") is False
    assert security.secrets_match("x", "") is False


def test_channex_webhook_secret_no_longer_authorizes_cron(monkeypatch) -> None:  # noqa: ANN001
    """Das an Channex ausgeleakte Webhook-Secret darf interne Cron-Endpunkte
    NICHT mehr öffnen — nur das eigene INTERNAL_CRON_SECRET zählt."""
    settings = _settings("cron-geheim")
    settings.channex_webhook_secret = SecretStr("channex-geteilt")
    monkeypatch.setattr(security, "get_settings", lambda: settings)
    with pytest.raises(HTTPException) as exc:
        security.require_internal_cron_secret("channex-geteilt")
    assert exc.value.status_code == 401
