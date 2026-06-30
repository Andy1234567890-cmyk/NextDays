"""Tests für den payments-Slice.

Stripe-Aufrufe gehen gegen die ECHTE Stripe-Test-API (Sandbox), kein Mock —
Voraussetzung ist ein `sk_test_...`-Key in der Umgebung (.env). Ohne Key werden
die netzabhängigen Tests übersprungen (Skip, kein Fake). Die DB ist ein
In-Memory-Fake (gleiches Muster wie der whatsapp-Slice).
"""
import pytest
from fastapi.testclient import TestClient
from stripe import StripeClient

from src.core.config import get_settings
from src.core.security import AuthContext
from src.features.payments.service import PaymentsError, PaymentsService
from src.features.payments.webhook import handle_stripe_event
from src.main import create_app

client = TestClient(create_app())
_CTX = AuthContext(user_id="u", tenant_id="t1")
_OTHER = AuthContext(user_id="u2", tenant_id="t2")


def _stripe_key() -> str | None:
    key = get_settings().stripe_secret_key.get_secret_value()
    return key if key.startswith("sk_test_") else None


_needs_stripe = pytest.mark.skipif(
    _stripe_key() is None, reason="kein sk_test_-Key (Stripe-Sandbox) gesetzt"
)


def _stripe() -> StripeClient | None:
    key = _stripe_key()
    return StripeClient(key) if key else None


def test_payments_health() -> None:
    resp = client.get("/api/v1/payments/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "payments", "status": "ok"}


def test_stripe_not_configured_raises_clean_error(monkeypatch) -> None:  # noqa: ANN001
    """Fehlt der Stripe-Key, muss der Stripe-Zugriff einen klaren PaymentsError
    (503) werfen — nicht mit leerem Key einen kryptischen Auth-Fehler erzeugen.
    Genau dieser Pfad macht „Stripe nicht konfiguriert" im Frontend sichtbar."""
    from src.features.payments import stripe_client as sc

    sc.get_stripe.cache_clear()
    monkeypatch.setattr(
        get_settings().stripe_secret_key, "get_secret_value", lambda: ""
    )
    # Kein injizierter Client → Service muss lazy initialisieren und sauber scheitern.
    svc = PaymentsService(service_client=None, stripe=None)
    with pytest.raises(PaymentsError) as exc:
        svc.get_connect_account_status("acct_does_not_matter")
    assert exc.value.status_code == 503
    assert "nicht konfiguriert" in exc.value.message.lower()
    sc.get_stripe.cache_clear()


def test_stripe_invalid_request_becomes_clean_400() -> None:
    """Ein Stripe-Eingabefehler (z.B. ungültige PLZ, http_status 400) muss als
    sauberer PaymentsError(400) mit der Stripe-Meldung ankommen — NICHT als
    ungefangener 500-Stacktrace."""
    from stripe import InvalidRequestError

    class _RaisingAccounts:
        def update(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
            raise InvalidRequestError(
                "Invalid DE postal code",
                param="individual[address][postal_code]",
                http_status=400,
            )

    class _V1:
        accounts = _RaisingAccounts()

    class _FakeStripe:
        v1 = _V1()

    svc = PaymentsService(service_client=None, stripe=_FakeStripe())
    with pytest.raises(PaymentsError) as exc:
        svc.update_connect_account("acct_x", {"individual": {}})
    assert exc.value.status_code == 400
    assert "postal code" in exc.value.message.lower()


# --- Fake-DB (Insert/Update/Select) -----------------------------------------
class _Res:
    def __init__(self, data) -> None:  # noqa: ANN001
        self.data = data


class _Q:
    def __init__(self, store, name) -> None:  # noqa: ANN001
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._payload = None
        self._op = "select"

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        self._op = "select"
        return self

    def insert(self, payload):  # noqa: ANN001, ANN201
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload):  # noqa: ANN001, ANN201
        self._op = "update"
        self._payload = payload
        return self

    def eq(self, c, v):  # noqa: ANN001, ANN201
        self._eq[c] = v
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        rows = self._store.setdefault(self._name, [])
        if self._op == "insert":
            row = dict(self._payload)
            row.setdefault("id", f"{self._name}-{len(rows) + 1}")
            row.setdefault("created_at", "2026-06-22T00:00:00Z")
            rows.append(row)
            return _Res([row])
        match = [r for r in rows if all(r.get(k) == v for k, v in self._eq.items())]
        if self._op == "update":
            for r in match:
                r.update(self._payload)
            return _Res(match)
        return _Res(match)


class _DB:
    def __init__(self) -> None:
        self.store: dict = {}

    def table(self, name):  # noqa: ANN001, ANN201
        return _Q(self.store, name)


def _db_with_booking(*, charges_enabled: bool, tenant: str = "t1") -> _DB:
    db = _DB()
    db.store["reservations"] = [
        {
            "id": "res-1",
            "tenant_id": tenant,
            "property_id": "prop-1",
            "total_amount": 120.0,
            "currency": "eur",
            "payment_status": "unpaid",
        }
    ]
    db.store["tenant_billing_profile"] = [
        {
            "tenant_id": tenant,
            "stripe_account_id": "acct_test" if charges_enabled else None,
            "stripe_charges_enabled": charges_enabled,
        }
    ]
    db.store["properties"] = [{"id": "prop-1", "deposit_amount": 50.0}]
    return db


# --- Stufe A: Gast-Zahlung --------------------------------------------------

def test_booking_payment_without_onboarded_account_fails() -> None:
    """Ohne freigeschalteten Connected Account → klarer 409, kein Fallback."""
    db = _db_with_booking(charges_enabled=False)
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.create_booking_payment(reservation_id="res-1")
    assert exc.value.status_code == 409


def _make_transfer_ready_account(stripe: StripeClient) -> str:
    """Custom-Test-Account mit vollständiger Test-Persona → transfers sofort
    'active' (Stripe-Test-Verifizierung: id_number 000000000, address-Match)."""
    acct = stripe.v1.accounts.create(
        params={
            "type": "custom",
            "country": "DE",
            "business_type": "individual",
            "capabilities": {
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
            "tos_acceptance": {
                "service_agreement": "full", "date": 1700000000, "ip": "127.0.0.1"
            },
            "business_profile": {"mcc": "5734", "url": "https://accessible.stripe.com"},
            "individual": {
                "first_name": "Test", "last_name": "Host", "email": "host@example.com",
                "phone": "+15555550100",
                "dob": {"day": 1, "month": 1, "year": 1990},
                "address": {
                    "line1": "address_full_match", "city": "Berlin",
                    "postal_code": "10115", "country": "DE",
                },
                "id_number": "000000000",
            },
            "external_account": {
                "object": "bank_account", "country": "DE", "currency": "eur",
                "account_number": "DE89370400440532013000",
            },
        }
    )
    return acct.id


@_needs_stripe
def test_booking_payment_creates_intent_and_row() -> None:
    """Echte Stripe-Test-API: Destination-Charge-PaymentIntent + payments-Row."""
    stripe = _stripe()
    db = _db_with_booking(charges_enabled=True)
    db.store["tenant_billing_profile"][0]["stripe_account_id"] = (
        _make_transfer_ready_account(stripe)
    )
    svc = PaymentsService(service_client=db, stripe=stripe)
    result = svc.create_booking_payment(reservation_id="res-1")
    assert result.client_secret.startswith("pi_")
    assert len(db.store["payments"]) == 1
    row = db.store["payments"][0]
    assert row["type"] == "full" and row["status"] == "pending"
    assert row["gateway"] == "stripe" and row["gateway_ref"].startswith("pi_")
    assert db.store["reservations"][0]["payment_status"] == "pending"


# --- Stufe D: Webhook -------------------------------------------------------

def test_webhook_succeeded_marks_paid() -> None:
    db = _DB()
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "gateway_ref": "pi_abc", "status": "pending"}
    ]
    db.store["reservations"] = [{"id": "res-1", "payment_status": "pending"}]
    event = {
        "id": "evt_1",
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_abc"}},
    }
    handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    assert db.store["payments"][0]["status"] == "succeeded"
    assert db.store["reservations"][0]["payment_status"] == "paid"


def test_webhook_is_idempotent() -> None:
    db = _DB()
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "gateway_ref": "pi_abc", "status": "pending"}
    ]
    db.store["reservations"] = [{"id": "res-1", "payment_status": "pending"}]
    event = {
        "id": "evt_dup",
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_abc"}},
    }
    handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    db.store["payments"][0]["status"] = "pending"  # künstlich zurücksetzen
    out = handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    assert out["status"] == "duplicate"
    assert db.store["payments"][0]["status"] == "pending"


def test_webhook_failed_marks_failed() -> None:
    db = _DB()
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "gateway_ref": "pi_x", "status": "pending"}
    ]
    db.store["reservations"] = [{"id": "res-1", "payment_status": "pending"}]
    event = {
        "id": "evt_2",
        "type": "payment_intent.payment_failed",
        "data": {"object": {"id": "pi_x"}},
    }
    handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    assert db.store["payments"][0]["status"] == "failed"


def test_webhook_account_updated_spiegelt_kyc() -> None:
    db = _DB()
    db.store["tenant_billing_profile"] = [
        {"tenant_id": "t1", "stripe_account_id": "acct_x", "stripe_charges_enabled": False}
    ]
    event = {
        "id": "evt_acc",
        "type": "account.updated",
        "data": {
            "object": {
                "id": "acct_x",
                "charges_enabled": True,
                "payouts_enabled": True,
                "details_submitted": True,
            }
        },
    }
    handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    prof = db.store["tenant_billing_profile"][0]
    assert prof["stripe_charges_enabled"] is True
    assert prof["stripe_details_submitted"] is True
    assert prof["stripe_onboarding_at"] == "2026-06-30T00:00:00Z"


# --- Stufe B: Kaution -------------------------------------------------------

def test_deposit_without_amount_configured_fails() -> None:
    db = _db_with_booking(charges_enabled=True)
    db.store["properties"][0]["deposit_amount"] = None
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.create_deposit_hold(_CTX, reservation_id="res-1")
    assert exc.value.status_code == 422


# --- Tenant-Isolation -------------------------------------------------------

def test_deposit_cross_tenant_is_blocked() -> None:
    db = _db_with_booking(charges_enabled=True, tenant="t1")
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.create_deposit_hold(_OTHER, reservation_id="res-1")
    assert exc.value.status_code == 404


def test_refund_cross_tenant_is_blocked() -> None:
    db = _db_with_booking(charges_enabled=True, tenant="t1")
    db.store["payments"] = [
        {
            "id": "pay-1",
            "reservation_id": "res-1",
            "amount": 120.0,
            "currency": "eur",
            "type": "full",
            "status": "succeeded",
            "gateway_ref": "pi_abc",
        }
    ]
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.refund_payment(_OTHER, "pay-1")
    assert exc.value.status_code == 404
