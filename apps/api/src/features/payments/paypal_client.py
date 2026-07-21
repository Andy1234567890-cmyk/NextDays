"""PayPal-Client — Complete Payments Platform (Multiparty).

Dünner HTTP-Wrapper um die PayPal-REST-API (synchron via httpx, wie der Rest der
Service-Schicht). Deckt genau die Multiparty-Flows ab, die wir brauchen:

  * OAuth-Token (client_credentials, im Prozess gecacht bis kurz vor Ablauf)
  * Partner-Referral erstellen (Verkäufer-Onboarding, „Connected Path")
  * Merchant-Onboarding-Status lesen (payments_receivable/email_confirmed)
  * Order mit Plattform-Provision anlegen (payee.merchant_id + platform_fees)
  * Order capturen
  * Refund (im Namen des Verkäufers, optional mit anteiliger Provisions-Rückgabe)
  * Webhook-Signatur verifizieren (PayPal-API-Verify — KEIN eigener Fetch auf die
    angreiferkontrollierte cert_url, damit gar kein SSRF-Vektor entsteht, Wurzel 8)

WICHTIG (recherche-belegt, developer.paypal.com):
  * Beträge sind Major-Unit-STRINGS ("230.00") mit currency_code, NICHT Cent wie
    Stripe. Zero-Decimal-Währungen (HUF/JPY/TWD) OHNE Dezimalpunkt. Formatierung
    IMMER über Decimal.quantize (kein float, Wurzel 4).
  * Beim Handeln „im Namen des Verkäufers" braucht es das PayPal-Auth-Assertion-
    JWT (unsigniert, {alg:none}.{iss:partner_client_id,payer_id:seller_merchant_id}.)
    UND den PayPal-Partner-Attribution-Id-Header (BN-Code) — auf create, capture
    und refund.
  * payer_id im Auth-Assertion = die MERCHANT-ID DES VERKÄUFERS (payee.merchant_id),
    nicht die des zahlenden Gastes.
"""
from __future__ import annotations

import base64
import json
import time
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import httpx

from src.core.config import get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.payments.paypal")

_TIMEOUT = 20.0

# Währungen, die PayPal OHNE Nachkommastellen erwartet (ganze Zahl als String).
# Recherche-belegt (developer.paypal.com Currency Codes) — bewusst NICHT die
# Stripe-Zero-Decimal-Liste, die abweicht.
_ZERO_DECIMAL = frozenset({"HUF", "JPY", "TWD"})


class PayPalNotConfiguredError(Exception):
    """Partner-Credentials fehlen → PayPal ist nicht nutzbar (fail-closed 503)."""


class PayPalError(Exception):
    """Ein PayPal-API-Fehler mit nutzbarer Meldung + HTTP-Status."""

    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def to_amount(value: float | Decimal, currency: str) -> str:
    """Betrag als PayPal-Major-Unit-String. Zero-Decimal-Währungen als ganze Zahl,
    sonst 2 Nachkommastellen. Über Decimal (kein float-Format-Rundungsfehler)."""
    dec = value if isinstance(value, Decimal) else Decimal(str(value))
    if currency.upper() in _ZERO_DECIMAL:
        return str(dec.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return str(dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _b64url(obj: dict[str, Any]) -> str:
    raw = json.dumps(obj, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


class PayPalClient:
    """Synchroner PayPal-Client. Eine Instanz je Request ist ok — das OAuth-Token
    wird auf Klassenebene prozessweit gecacht (spart Token-Calls)."""

    _token: str | None = None
    _token_exp: float = 0.0

    def __init__(self) -> None:
        s = get_settings()
        self._client_id = s.paypal_client_id.get_secret_value()
        self._secret = s.paypal_secret.get_secret_value()
        self._bn = s.paypal_bn_code
        self._platform_merchant_id = s.paypal_platform_merchant_id
        self._webhook_id = s.paypal_webhook_id
        self._base = s.paypal_base_url.rstrip("/")

    # -- Konfig / Auth ---------------------------------------------------------
    def _require_config(self) -> None:
        if not self._client_id or not self._secret:
            raise PayPalNotConfiguredError(
                "PayPal ist nicht konfiguriert (Partner-Credentials fehlen)."
            )

    def _access_token(self) -> str:
        """OAuth-Token (client_credentials, Basic-Auth). Prozessweit gecacht bis
        60 s vor Ablauf."""
        self._require_config()
        now = time.time()
        if PayPalClient._token and now < PayPalClient._token_exp - 60:
            return PayPalClient._token
        try:
            with httpx.Client(timeout=_TIMEOUT) as c:
                resp = c.post(
                    f"{self._base}/v1/oauth2/token",
                    auth=(self._client_id, self._secret),
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    data={"grant_type": "client_credentials"},
                )
        except httpx.HTTPError as exc:
            raise PayPalError("PayPal nicht erreichbar.", status_code=502) from exc
        if resp.status_code != 200:
            raise PayPalError(
                self._error_text(resp, "OAuth fehlgeschlagen"),
                status_code=502,
            )
        body = resp.json()
        PayPalClient._token = body["access_token"]
        PayPalClient._token_exp = now + float(body.get("expires_in", 0))
        return PayPalClient._token

    def _auth_assertion(self, seller_merchant_id: str) -> str:
        """Unsigniertes Auth-Assertion-JWT, das den VERKÄUFER identifiziert, damit
        die Plattform in seinem Namen handeln darf. Format: header.body. (leerer
        dritter Teil, Trailing-Dot). payer_id = merchant_id DES VERKÄUFERS."""
        header = _b64url({"alg": "none", "typ": "JWT"})
        body = _b64url({"iss": self._client_id, "payer_id": seller_merchant_id})
        return f"{header}.{body}."

    def _headers(
        self,
        *,
        seller_merchant_id: str | None = None,
        request_id: str | None = None,
    ) -> dict[str, str]:
        """Standard-Header + (bei Multiparty) BN-Code und Auth-Assertion. Der
        PayPal-Request-Id-Header dient der Idempotenz (Wurzel 2)."""
        headers = {
            "Authorization": f"Bearer {self._access_token()}",
            "Content-Type": "application/json",
        }
        if self._bn:
            headers["PayPal-Partner-Attribution-Id"] = self._bn
        if seller_merchant_id:
            headers["PayPal-Auth-Assertion"] = self._auth_assertion(seller_merchant_id)
        if request_id:
            headers["PayPal-Request-Id"] = request_id
        return headers

    @staticmethod
    def _error_text(resp: httpx.Response, fallback: str) -> str:
        try:
            data = resp.json()
        except (ValueError, json.JSONDecodeError):
            return f"{fallback} ({resp.status_code})."
        msg = data.get("message") or data.get("error_description") or fallback
        details = data.get("details")
        if isinstance(details, list) and details:
            issue = details[0].get("description") or details[0].get("issue")
            if issue:
                msg = f"{msg}: {issue}"
        return f"{msg} ({resp.status_code})."

    def _post(
        self, path: str, payload: dict | None, headers: dict[str, str]
    ) -> dict[str, Any]:
        try:
            with httpx.Client(timeout=_TIMEOUT) as c:
                resp = c.post(f"{self._base}{path}", json=payload or {}, headers=headers)
        except httpx.HTTPError as exc:
            raise PayPalError("PayPal nicht erreichbar.", status_code=502) from exc
        if resp.status_code >= 300:
            code = 400 if 400 <= resp.status_code < 500 else 502
            raise PayPalError(self._error_text(resp, "PayPal-Fehler"), status_code=code)
        return resp.json() if resp.content else {}

    def _get(self, path: str, headers: dict[str, str]) -> dict[str, Any]:
        try:
            with httpx.Client(timeout=_TIMEOUT) as c:
                resp = c.get(f"{self._base}{path}", headers=headers)
        except httpx.HTTPError as exc:
            raise PayPalError("PayPal nicht erreichbar.", status_code=502) from exc
        if resp.status_code >= 300:
            code = 400 if 400 <= resp.status_code < 500 else 502
            raise PayPalError(self._error_text(resp, "PayPal-Fehler"), status_code=code)
        return resp.json() if resp.content else {}

    # -- Onboarding (Partner Referrals) ---------------------------------------
    def create_partner_referral(
        self, *, tracking_id: str, return_url: str
    ) -> dict[str, Any]:
        """Referral erstellen → gibt die action_url zurück, zu der der Verkäufer
        umgeleitet wird. tracking_id = unsere Zuordnung (tenant_id). Der
        PARTNER_FEE-Scope wird über die features PAYMENT+REFUND angefragt, damit
        später platform_fees genutzt werden können (sonst Re-Onboarding)."""
        payload = {
            "tracking_id": tracking_id,
            "partner_config_override": {"return_url": return_url},
            "operations": [
                {
                    "operation": "API_INTEGRATION",
                    "api_integration_preference": {
                        "rest_api_integration": {
                            "integration_method": "PAYPAL",
                            "integration_type": "FIRST_PARTY",
                            "first_party_details": {
                                "features": ["PAYMENT", "REFUND", "PARTNER_FEE"],
                            },
                        }
                    },
                }
            ],
            "products": ["EXPRESS_CHECKOUT"],
            "legal_consents": [{"type": "SHARE_DATA_CONSENT", "granted": True}],
        }
        data = self._post(
            "/v2/customer/partner-referrals", payload, self._headers()
        )
        action_url = next(
            (
                link["href"]
                for link in data.get("links", [])
                if link.get("rel") == "action_url"
            ),
            None,
        )
        if not action_url:
            raise PayPalError("PayPal lieferte keine Onboarding-URL.", status_code=502)
        return {"action_url": action_url}

    def get_merchant_status(self, *, seller_merchant_id: str) -> dict[str, Any]:
        """Onboarding-Status eines Verkäufers lesen. Sellbar NUR wenn
        payments_receivable UND primary_email_confirmed true (fail-closed)."""
        partner = self._platform_merchant_id
        if not partner:
            raise PayPalNotConfiguredError(
                "PayPal-Plattform-Merchant-ID fehlt (Partner-Config)."
            )
        data = self._get(
            f"/v1/customer/partners/{partner}/merchant-integrations/{seller_merchant_id}",
            self._headers(),
        )
        return {
            "merchant_id": data.get("merchant_id") or seller_merchant_id,
            "payments_receivable": bool(data.get("payments_receivable")),
            "primary_email_confirmed": bool(data.get("primary_email_confirmed")),
        }

    # -- Order / Capture / Refund ---------------------------------------------
    def create_order(
        self,
        *,
        seller_merchant_id: str,
        amount: float | Decimal,
        currency: str,
        platform_fee: float | Decimal | None,
        reference: str,
        request_id: str,
    ) -> dict[str, Any]:
        """Order (intent=CAPTURE) im Namen des Verkäufers, optional mit Plattform-
        Provision (platform_fees). Fee-Währung == Transaktionswährung (Wurzel 4)."""
        unit: dict[str, Any] = {
            "amount": {"currency_code": currency, "value": to_amount(amount, currency)},
            "payee": {"merchant_id": seller_merchant_id},
            "custom_id": reference,
        }
        if platform_fee and Decimal(str(platform_fee)) > 0:
            fee_payee = (
                {"merchant_id": self._platform_merchant_id}
                if self._platform_merchant_id
                else {}
            )
            unit["payment_instruction"] = {
                "disbursement_mode": "INSTANT",
                "platform_fees": [
                    {
                        "amount": {
                            "currency_code": currency,
                            "value": to_amount(platform_fee, currency),
                        },
                        **({"payee": fee_payee} if fee_payee else {}),
                    }
                ],
            }
        payload = {"intent": "CAPTURE", "purchase_units": [unit]}
        headers = self._headers(
            seller_merchant_id=seller_merchant_id, request_id=request_id
        )
        data = self._post("/v2/checkout/orders", payload, headers)
        return {"id": data.get("id"), "status": data.get("status")}

    def get_order(self, *, order_id: str, seller_merchant_id: str) -> dict[str, Any]:
        """Order-Status lesen (Idempotenz: schon captured?)."""
        data = self._get(
            f"/v2/checkout/orders/{order_id}",
            self._headers(seller_merchant_id=seller_merchant_id),
        )
        return {"id": data.get("id"), "status": data.get("status")}

    def capture_order(
        self, *, order_id: str, seller_merchant_id: str, request_id: str
    ) -> dict[str, Any]:
        """Order capturen. Gibt Status + capture_id (für den späteren Refund)."""
        headers = self._headers(
            seller_merchant_id=seller_merchant_id, request_id=request_id
        )
        data = self._post(f"/v2/checkout/orders/{order_id}/capture", {}, headers)
        return {
            "id": data.get("id"),
            "status": data.get("status"),
            "capture_id": _extract_capture_id(data),
        }

    def refund_capture(
        self,
        *,
        capture_id: str,
        seller_merchant_id: str,
        amount: float | Decimal | None,
        currency: str | None,
        platform_fee_refund: float | Decimal | None,
        request_id: str,
    ) -> dict[str, Any]:
        """(Teil-)Refund einer Capture im Namen des Verkäufers. amount=None = voll.
        platform_fee_refund gibt anteilig Provision zurück (NICHT automatisch —
        muss explizit angegeben werden; gekappt auf die verfügbare Fee)."""
        payload: dict[str, Any] = {}
        if amount is not None and currency:
            payload["amount"] = {
                "currency_code": currency,
                "value": to_amount(amount, currency),
            }
        if platform_fee_refund and currency and Decimal(str(platform_fee_refund)) > 0:
            payload["payment_instruction"] = {
                "platform_fees": [
                    {
                        "amount": {
                            "currency_code": currency,
                            "value": to_amount(platform_fee_refund, currency),
                        }
                    }
                ]
            }
        headers = self._headers(
            seller_merchant_id=seller_merchant_id, request_id=request_id
        )
        data = self._post(
            f"/v2/payments/captures/{capture_id}/refund", payload or None, headers
        )
        return {"id": data.get("id"), "status": data.get("status")}

    # -- Webhook-Verifikation --------------------------------------------------
    def verify_webhook(self, *, headers: dict[str, str], raw_body: str) -> bool:
        """Signatur über die PayPal-API prüfen (POST /v1/notifications/verify-
        webhook-signature). Bewusst der API-Weg statt lokaler cert_url-Fetch:
        so entsteht KEIN ausgehender Request auf eine angreiferkontrollierte URL
        (SSRF-frei, Wurzel 8). Fehlt die webhook_id → fail-closed (False)."""
        if not self._webhook_id:
            return False

        def _h(name: str) -> str:
            # Header case-insensitiv lesen (Starlette liefert lower-case Keys).
            return headers.get(name) or headers.get(name.lower()) or ""

        transmission_sig = _h("paypal-transmission-sig")
        if not transmission_sig:
            return False
        payload = {
            "auth_algo": _h("paypal-auth-algo"),
            "cert_url": _h("paypal-cert-url"),
            "transmission_id": _h("paypal-transmission-id"),
            "transmission_sig": transmission_sig,
            "transmission_time": _h("paypal-transmission-time"),
            "webhook_id": self._webhook_id,
            "webhook_event": json.loads(raw_body),
        }
        try:
            data = self._post(
                "/v1/notifications/verify-webhook-signature",
                payload,
                self._headers(),
            )
        except (PayPalError, PayPalNotConfiguredError):
            # Verifikation nicht durchführbar → fail-closed (nicht als gültig werten).
            return False
        return data.get("verification_status") == "SUCCESS"


def _extract_capture_id(order_capture_response: dict[str, Any]) -> str | None:
    """capture_id aus der Capture-Antwort ziehen:
    purchase_units[0].payments.captures[0].id."""
    units = order_capture_response.get("purchase_units") or []
    if not units:
        return None
    captures = (units[0].get("payments") or {}).get("captures") or []
    return captures[0].get("id") if captures else None
