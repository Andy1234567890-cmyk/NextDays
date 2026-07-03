"""Tests für die USt-IdNr.-Prüfung (VIES, 27 EU-Länder)."""
from unittest.mock import MagicMock

import httpx
import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.service import BuchhaltungError, BuchhaltungService

CTX = AuthContext(user_id="u1", tenant_id="t1")


def _service() -> BuchhaltungService:
    return BuchhaltungService(service_client=MagicMock())


def test_rejects_missing_country_prefix() -> None:
    with pytest.raises(BuchhaltungError) as exc:
        _service().check_vat_id(CTX, "12341234567")
    assert exc.value.status_code == 422
    assert "Länderkürzel" in exc.value.message


def test_rejects_non_eu_country() -> None:
    with pytest.raises(BuchhaltungError) as exc:
        _service().check_vat_id(CTX, "GR123456789")  # Griechenland = EL
    assert exc.value.status_code == 422
    assert "EL" in exc.value.message


def test_rejects_invalid_characters() -> None:
    with pytest.raises(BuchhaltungError) as exc:
        _service().check_vat_id(CTX, "DE12345678!")
    assert exc.value.status_code == 422


def test_valid_response_is_normalized(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_get(url: str, timeout: float) -> MagicMock:
        assert "/ms/DE/vat/123456789" in url
        resp = MagicMock()
        resp.json.return_value = {
            "isValid": True,
            "name": "Muster GmbH",
            "address": "Musterstr. 1, 12345 Berlin",
        }
        return resp

    monkeypatch.setattr(
        "src.features.buchhaltung.vat_check.httpx.get", fake_get
    )
    result = _service().check_vat_id(CTX, "de 123.456-789")
    assert result == {
        "vatId": "DE123456789",
        "valid": True,
        "name": "Muster GmbH",
        "address": "Musterstr. 1, 12345 Berlin",
    }


def test_invalid_number_and_dashes_are_none(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_get(url: str, timeout: float) -> MagicMock:
        resp = MagicMock()
        resp.json.return_value = {"isValid": False, "name": "---", "address": "---"}
        return resp

    monkeypatch.setattr(
        "src.features.buchhaltung.vat_check.httpx.get", fake_get
    )
    result = _service().check_vat_id(CTX, "DE999999999")
    assert result["valid"] is False
    assert result["name"] is None
    assert result["address"] is None


def test_vies_unreachable_maps_to_503(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_get(url: str, timeout: float) -> MagicMock:
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(
        "src.features.buchhaltung.vat_check.httpx.get", fake_get
    )
    with pytest.raises(BuchhaltungError) as exc:
        _service().check_vat_id(CTX, "DE123456789")
    assert exc.value.status_code == 503
