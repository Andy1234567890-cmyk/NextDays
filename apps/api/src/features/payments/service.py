"""Service-Schicht für payments — Stripe Connect (Custom/white-label) + Zahlungen.

Geldfluss = Destination Charge: der Gast zahlt über den Plattform-Stripe-Account,
das Geld geht per ``transfer_data.destination`` an den Connected Account des
Tenants (``tenant_billing_profile.stripe_account_id``). Voraussetzung:
``stripe_charges_enabled = true`` — sonst ist Online-Zahlung nicht verfügbar
(klarer Fehler, kein Fallback-Charge auf die Plattform).

Connect ist voll white-label (Custom Accounts): kein Stripe-gehostetes Onboarding/
Branding — die KYC-Daten kommen über die eigene Dashboard-UI und werden per
``Account.update`` / ``external_account`` an Stripe gegeben.

Tenant-scoping: ``_require(ctx)`` erzwingt tenant_id + DB. Beträge gehen in Cent
an Stripe (``int(round(amount * 100))``).
"""
from __future__ import annotations

from typing import Any

from stripe import StripeClient
from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext

from . import stripe_client as sc
from .schemas import (
    BookingPaymentResult,
    ConnectAccountCreate,
    ConnectAccountResponse,
    ConnectAccountStatus,
    SliceHealth,
)
from .stripe_client import get_stripe

log = get_logger("nextdays.payments")


class PaymentsError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _to_cents(amount: float) -> int:
    """Betrag in Cent (Stripe rechnet in der kleinsten Einheit)."""
    return int(round(amount * 100))


class PaymentsService:
    slice_name = "payments"

    def __init__(
        self,
        service_client: Client | None = None,
        stripe: StripeClient | None = None,  # injizierbar für Tests
    ) -> None:
        self._db = service_client
        self._stripe = stripe or get_stripe()

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require(self, ctx: AuthContext) -> tuple[Client, str]:
        if not ctx.tenant_id:
            raise PaymentsError("Kein Tenant im Token.", status_code=403)
        if self._db is None:
            raise PaymentsError("Payments-DB nicht verfügbar.", status_code=500)
        return self._db, ctx.tenant_id

    def _db_or_fail(self) -> Client:
        """DB ohne Tenant-Pflicht (public Pfade: Gast-Zahlung über Reservierung)."""
        if self._db is None:
            raise PaymentsError("Payments-DB nicht verfügbar.", status_code=500)
        return self._db

    # --- Stripe Connect (Custom, voll white-label) --------------------------

    def create_connect_account(
        self, req: ConnectAccountCreate
    ) -> ConnectAccountResponse:
        """Legt einen Stripe **Custom** Account für den Gastgeber an (kein Express,
        kein Stripe-Branding). Die KYC-Erfassung läuft anschließend über die eigene
        Dashboard-UI (``update_connect_account`` / ``set_external_account``).

        ``tos_acceptance.service_agreement='full'``: die Plattform (myNextDays)
        übernimmt die Stripe-Services-Vereinbarung gegenüber dem Connected Account
        — Voraussetzung für vollständiges White-Label bei Custom Accounts.
        """
        account = self._stripe.v1.accounts.create(
            params={
                "type": "custom",
                "country": req.country,
                "email": req.email,
                # Einzelperson oder Firma — bestimmt die KYC-Pflichtfelder.
                "business_type": req.business_type,
                # Branchencode 7011 = Lodging/Unterkünfte (für Vermietung passend);
                # ist sonst ein offenes Requirement und blockiert charges_enabled.
                "business_profile": {"mcc": "7011"},
                "capabilities": {
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
                "tos_acceptance": {"service_agreement": "full"},
                "metadata": {"tenant_id": req.tenant_id},
            }
        )
        return ConnectAccountResponse(stripe_account_id=account.id)

    def get_connect_account_status(
        self, stripe_account_id: str
    ) -> ConnectAccountStatus:
        """Liest KYC-/Aktivierungsstatus + offene Requirements (für die eigene UI)."""
        account = self._stripe.v1.accounts.retrieve(stripe_account_id)
        requirements: list[str] = list(account.requirements.currently_due or [])
        return ConnectAccountStatus(
            stripe_account_id=account.id,
            charges_enabled=bool(account.charges_enabled),
            payouts_enabled=bool(account.payouts_enabled),
            details_submitted=bool(account.details_submitted),
            requirements=requirements,
            disabled_reason=account.requirements.disabled_reason,
        )

    def update_connect_account(
        self, stripe_account_id: str, fields: dict[str, Any]
    ) -> ConnectAccountStatus:
        """Geschäfts-/Inhaber-/Vertreterdaten an den Custom-Account senden
        (eigene Onboarding-UI statt Stripe-hosted). ``fields`` ist das von der UI
        zusammengestellte Stripe-Account-Update (business_profile, company,
        individual, …)."""
        self._stripe.v1.accounts.update(stripe_account_id, params=fields)
        return self.get_connect_account_status(stripe_account_id)

    def accept_tos(
        self, stripe_account_id: str, *, ip: str, when: int
    ) -> ConnectAccountStatus:
        """Stripe-Services-Vereinbarung für den Connected Account akzeptieren.
        ``ip``/``when`` müssen die ECHTE Nutzer-IP + der Zeitpunkt der Zustimmung
        sein (Compliance-Nachweis) — nie geraten. Erst danach kann der Account
        ``charges_enabled`` werden."""
        if not ip:
            raise PaymentsError("IP für die ToS-Akzeptanz fehlt.", status_code=422)
        self._stripe.v1.accounts.update(
            stripe_account_id,
            params={"tos_acceptance": {"date": when, "ip": ip}},
        )
        return self.get_connect_account_status(stripe_account_id)

    def set_external_account(
        self, stripe_account_id: str, *, iban: str, account_holder: str, country: str
    ) -> ConnectAccountStatus:
        """Auszahlungs-Bankkonto (IBAN) am Custom-Account hinterlegen."""
        self._stripe.v1.accounts.update(
            stripe_account_id,
            params={
                "external_account": {
                    "object": "bank_account",
                    "country": country,
                    "currency": _currency_for_country(country),
                    "account_holder_name": account_holder,
                    "account_number": iban,
                }
            },
        )
        return self.get_connect_account_status(stripe_account_id)

    # --- Gast-Zahlung (Stufe A) ---------------------------------------------

    def _load_reservation(self, db: Client, reservation_id: str) -> dict:
        res = (
            db.table("reservations")
            .select("id, tenant_id, total_amount, currency, payment_status")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise PaymentsError("Buchung nicht gefunden.", status_code=404)
        return res[0]

    def _connected_account(self, db: Client, tenant_id: str) -> str:
        """Connected Account des Tenants — nur wenn er Zahlungen empfangen darf."""
        prof = (
            db.table("tenant_billing_profile")
            .select("stripe_account_id, stripe_charges_enabled")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        acct = prof[0]["stripe_account_id"] if prof else None
        enabled = bool(prof[0]["stripe_charges_enabled"]) if prof else False
        if not acct or not enabled:
            raise PaymentsError(
                "Online-Zahlung nicht verfügbar (Konto nicht freigeschaltet).",
                status_code=409,
            )
        return acct

    def _fee_cents(self, amount_cents: int) -> int:
        pct = get_settings().stripe_platform_fee_pct
        if pct <= 0:
            return 0
        return int(round(amount_cents * pct / 100.0))

    def create_booking_payment(self, *, reservation_id: str) -> BookingPaymentResult:
        """PaymentIntent (Destination Charge) für eine Gastbuchung erzeugen und
        eine ``payments``-Row (pending) anlegen. Public-Pfad: Tenant kommt aus der
        Reservierung, nicht aus dem JWT (Gäste zahlen ohne Login)."""
        db = self._db_or_fail()
        res = self._load_reservation(db, reservation_id)
        tenant_id = res["tenant_id"]
        amount = float(res["total_amount"] or 0)
        if amount <= 0:
            raise PaymentsError("Buchungsbetrag fehlt.", status_code=422)
        currency = res["currency"]
        if not currency:
            raise PaymentsError("Währung der Buchung fehlt.", status_code=422)

        acct = self._connected_account(db, tenant_id)
        amount_cents = _to_cents(amount)
        intent = sc.create_payment_intent(
            amount_cents=amount_cents,
            currency=currency,
            destination_acct=acct,
            application_fee_cents=self._fee_cents(amount_cents),
            metadata={"reservation_id": reservation_id, "tenant_id": tenant_id},
            client=self._stripe,
        )
        payment = self._insert_payment(
            db,
            reservation_id=reservation_id,
            amount=amount,
            currency=currency,
            ptype="full",
            gateway_ref=intent["id"],
            status="pending",
        )
        self._set_reservation_payment_status(db, reservation_id, "pending")
        return BookingPaymentResult(
            client_secret=intent["client_secret"],
            payment_id=payment["id"],
            publishable_key=get_settings().stripe_publishable_key,
        )

    # --- Kaution (Stufe B) ---------------------------------------------------

    def create_deposit_hold(self, ctx: AuthContext, *, reservation_id: str) -> dict:
        """Manual-capture PaymentIntent über den Kautionsbetrag des Objekts
        (Vorautorisierung). Tenant-geschützt (Gastgeber löst die Kaution aus)."""
        db, tenant_id = self._require(ctx)
        res = self._load_reservation(db, reservation_id)
        if res["tenant_id"] != tenant_id:
            raise PaymentsError("Buchung nicht gefunden.", status_code=404)
        amount = self._deposit_amount(db, reservation_id)
        currency = res["currency"]
        if not currency:
            raise PaymentsError("Währung der Buchung fehlt.", status_code=422)
        acct = self._connected_account(db, tenant_id)
        amount_cents = _to_cents(amount)
        intent = sc.create_payment_intent(
            amount_cents=amount_cents,
            currency=currency,
            destination_acct=acct,
            application_fee_cents=0,  # auf Kautionen keine Plattform-Fee
            capture_method="manual",
            metadata={"reservation_id": reservation_id, "type": "deposit"},
            client=self._stripe,
        )
        payment = self._insert_payment(
            db,
            reservation_id=reservation_id,
            amount=amount,
            currency=currency,
            ptype="deposit",
            gateway_ref=intent["id"],
            status="pending",
        )
        return {
            "client_secret": intent["client_secret"],
            "payment_id": payment["id"],
            "publishable_key": get_settings().stripe_publishable_key,
        }

    def capture_deposit(
        self, ctx: AuthContext, payment_id: str, amount: float | None = None
    ) -> dict:
        """Kaution (teilweise) einziehen — bei Schaden."""
        db, tenant_id = self._require(ctx)
        payment = self._load_payment(db, payment_id, tenant_id, expect_type="deposit")
        amount_cents = _to_cents(amount) if amount is not None else None
        result = sc.capture_payment_intent(
            payment["gateway_ref"], amount_cents, client=self._stripe
        )
        self._update_payment(db, payment_id, {"status": "succeeded"})
        return {"payment_id": payment_id, "status": result["status"]}

    def release_deposit(self, ctx: AuthContext, payment_id: str) -> dict:
        """Kaution freigeben (Vorautorisierung stornieren) — kein Geldfluss."""
        db, tenant_id = self._require(ctx)
        payment = self._load_payment(db, payment_id, tenant_id, expect_type="deposit")
        result = sc.cancel_payment_intent(payment["gateway_ref"], client=self._stripe)
        self._update_payment(db, payment_id, {"status": "refunded"})
        return {"payment_id": payment_id, "status": result["status"]}

    # --- Refund (Stufe C) ----------------------------------------------------

    def refund_payment(
        self, ctx: AuthContext, payment_id: str, amount: float | None = None
    ) -> dict:
        """Zahlung (teilweise) erstatten. Schreibt eine ``refund``-Row und
        markiert die Ursprungszahlung als (teil-)erstattet."""
        db, tenant_id = self._require(ctx)
        payment = self._load_payment(db, payment_id, tenant_id)
        amount_cents = _to_cents(amount) if amount is not None else None
        result = sc.refund(payment["gateway_ref"], amount_cents, client=self._stripe)
        self._insert_payment(
            db,
            reservation_id=payment["reservation_id"],
            amount=amount if amount is not None else float(payment["amount"]),
            currency=payment.get("currency"),
            ptype="refund",
            gateway_ref=result["id"],
            status="succeeded",
        )
        self._update_payment(db, payment_id, {"status": "refunded"})
        self._set_reservation_payment_status(
            db, payment["reservation_id"], "refunded"
        )
        return {"payment_id": payment_id, "refund_id": result["id"]}

    # --- Helfer (DB) ---------------------------------------------------------

    def _insert_payment(
        self,
        db: Client,
        *,
        reservation_id: str,
        amount: float,
        currency: str | None,
        ptype: str,
        gateway_ref: str,
        status: str,
    ) -> dict:
        row: dict[str, Any] = {
            "reservation_id": reservation_id,
            "amount": amount,
            "type": ptype,
            "gateway": "stripe",
            "gateway_ref": gateway_ref,
            "status": status,
        }
        if currency:
            row["currency"] = currency
        ins = db.table("payments").insert(row).execute().data
        return ins[0] if ins else row

    def _update_payment(self, db: Client, payment_id: str, patch: dict) -> None:
        db.table("payments").update(patch).eq("id", payment_id).execute()

    def _load_payment(
        self,
        db: Client,
        payment_id: str,
        tenant_id: str,
        *,
        expect_type: str | None = None,
    ) -> dict:
        """Zahlung tenant-sicher laden (Tenant über die Reservierung)."""
        rows = (
            db.table("payments")
            .select("id, reservation_id, amount, currency, type, status, gateway_ref")
            .eq("id", payment_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise PaymentsError("Zahlung nicht gefunden.", status_code=404)
        payment = rows[0]
        # Tenant-Check über die Reservierung (payments hat keine tenant_id-Spalte).
        res = self._load_reservation(db, payment["reservation_id"])
        if res["tenant_id"] != tenant_id:
            raise PaymentsError("Zahlung nicht gefunden.", status_code=404)
        if expect_type and payment["type"] != expect_type:
            raise PaymentsError(
                f"Zahlung ist keine {expect_type}-Zahlung.", status_code=422
            )
        return payment

    def _deposit_amount(self, db: Client, reservation_id: str) -> float:
        """Kautionsbetrag aus dem Objekt der Reservierung (keine Erfindung)."""
        res = (
            db.table("reservations")
            .select("property_id")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise PaymentsError("Buchung nicht gefunden.", status_code=404)
        prop = (
            db.table("properties")
            .select("deposit_amount")
            .eq("id", res[0]["property_id"])
            .limit(1)
            .execute()
        ).data
        amount = prop[0]["deposit_amount"] if prop else None
        if not amount or float(amount) <= 0:
            raise PaymentsError(
                "Für dieses Objekt ist keine Kaution hinterlegt.", status_code=422
            )
        return float(amount)

    def _set_reservation_payment_status(
        self, db: Client, reservation_id: str, status: str
    ) -> None:
        db.table("reservations").update({"payment_status": status}).eq(
            "id", reservation_id
        ).execute()


def _currency_for_country(country: str) -> str:
    """Auszahlungswährung des Bankkontos. EU/SEPA → EUR; sonst klar fehlschlagen
    statt zu raten (keine Fallback-Erfindung)."""
    sepa_eur = {
        "DE", "AT", "FR", "ES", "IT", "NL", "BE", "PT", "IE", "FI", "GR",
        "LU", "SK", "SI", "EE", "LV", "LT", "CY", "MT",
    }
    if country.upper() in sepa_eur:
        return "eur"
    raise PaymentsError(
        f"Auszahlungswährung für Land {country} nicht bestimmbar.", status_code=422
    )
