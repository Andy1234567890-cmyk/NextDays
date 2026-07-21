"""Tests für die reine PayPal-Logik (kein Netz): Geldformat, Auth-Assertion-JWT,
Capture-ID-Extraktion. Netzabhängige Flows (Order/Capture/Refund/Onboarding)
werden gegen die Sandbox manuell verifiziert, nicht hier gemockt."""
import base64
import json

from src.features.payments.paypal_client import (
    PayPalClient,
    _extract_capture_id,
    to_amount,
)


def test_to_amount_two_decimals() -> None:
    assert to_amount(230, "EUR") == "230.00"
    assert to_amount(230.5, "USD") == "230.50"
    assert to_amount(0.1, "GBP") == "0.10"


def test_to_amount_rounds_half_up() -> None:
    assert to_amount(1.005, "EUR") == "1.01"


def test_to_amount_zero_decimal_currencies() -> None:
    # HUF/JPY/TWD ohne Nachkommastellen (PayPal-Regel).
    assert to_amount(5000, "JPY") == "5000"
    assert to_amount(5000.0, "HUF") == "5000"
    assert to_amount(1234.7, "TWD") == "1235"


def test_auth_assertion_shape() -> None:
    """Unsigniertes JWT: header.body. mit Trailing-Dot; payer_id = Verkäufer."""
    client = PayPalClient()
    token = client._auth_assertion("SELLER_MERCHANT_ID")  # noqa: SLF001
    parts = token.split(".")
    assert len(parts) == 3
    assert parts[2] == ""  # leere Signatur (Trailing-Dot)
    # Body dekodieren (base64url ohne Padding).
    padded = parts[1] + "=" * (-len(parts[1]) % 4)
    body = json.loads(base64.urlsafe_b64decode(padded))
    assert body["payer_id"] == "SELLER_MERCHANT_ID"
    assert "iss" in body
    header = json.loads(
        base64.urlsafe_b64decode(parts[0] + "=" * (-len(parts[0]) % 4))
    )
    assert header["alg"] == "none"


def test_extract_capture_id() -> None:
    response = {
        "purchase_units": [
            {"payments": {"captures": [{"id": "CAP-123", "status": "COMPLETED"}]}}
        ]
    }
    assert _extract_capture_id(response) == "CAP-123"


def test_extract_capture_id_missing() -> None:
    assert _extract_capture_id({"purchase_units": [{}]}) is None
    assert _extract_capture_id({}) is None
