"""Stripe-Webhook-Eventverarbeitung (Stufe D).

Vom Router aufgerufen, nachdem die Signatur geprüft wurde. Idempotent über die
Event-ID (``stripe_webhook_event``): ein zweiter Eingang derselben ID wird
übersprungen. Behandelt:
  * account.updated                     — KYC-Flags in tenant_billing_profile
  * payment_intent.succeeded            — Zahlung paid + Reservierung paid
  * payment_intent.payment_failed       — Zahlung failed
  * payment_intent.amount_capturable_updated — Kaution autorisiert
  * charge.refunded                     — Refund-Status spiegeln

Tenant-Bezug entsteht aus der ``payments``-Row (gateway_ref = PaymentIntent-ID)
bzw. dem Account; nichts wird geraten.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.payments.webhook")


def _field(obj: Any, key: str, default: Any = None) -> Any:  # noqa: ANN401
    """Feld aus dem Event-Objekt lesen — robust für BEIDE Quellen:
    Stripes ``StripeObject`` (Produktion, aus ``construct_event``; hat KEIN
    ``.get()``) und ein Dict (Tests). StripeObject erlaubt Item-Zugriff, wirft
    aber KeyError bei fehlendem Schlüssel → mit try/except auf den Default."""
    if isinstance(obj, Mapping):
        return obj.get(key, default)
    try:
        return obj[key]
    except (KeyError, AttributeError, TypeError):
        return default


def _claim_event(db: Client, event_id: str, event_type: str, now_iso: str) -> bool:
    """Event-ID ATOMAR reservieren. True = neu geclaimt (verarbeiten), False =
    bereits vorhanden (Duplikat überspringen).

    INSERT ... ON CONFLICT DO NOTHING statt SELECT-dann-INSERT: bei nebenläufiger
    Duplikat-Zustellung (Stripe at-least-once) gewinnt genau einer, der Verlierer
    bekommt eine leere Rückgabe — kein PK-Verletzungs-500 an Stripe."""
    inserted = (
        db.table("stripe_webhook_event")
        .upsert(
            {"id": event_id, "type": event_type, "received_at": now_iso},
            on_conflict="id",
            ignore_duplicates=True,
        )
        .execute()
    ).data
    return bool(inserted)


def handle_stripe_event(
    db: Client, event: Mapping[str, Any], *, now_iso: str
) -> dict[str, str]:
    """Dispatcht ein bereits signatur-geprüftes Stripe-Event. Idempotent."""
    event_id: str = event["id"]
    event_type: str = event["type"]
    log.info("stripe_webhook_received", event_type=event_type, event_id=event_id)

    if not _claim_event(db, event_id, event_type, now_iso):
        log.info("stripe_webhook_duplicate_skipped", event_id=event_id)
        return {"status": "duplicate"}

    obj = event["data"]["object"]
    try:
        result = _dispatch_stripe_event(db, event_type, obj, now_iso)
    except Exception:
        # Verarbeitung fehlgeschlagen → Claim wieder freigeben, damit der
        # Stripe-Retry das Event erneut zustellt (sonst bliebe die Zahlung/
        # Reservierung dauerhaft im falschen Status, weil das Event schon als
        # „gesehen" markiert wäre).
        db.table("stripe_webhook_event").delete().eq("id", event_id).execute()
        raise
    return result or {"status": "ok"}


def _dispatch_stripe_event(
    db: Client, event_type: str, obj: Mapping[str, Any], now_iso: str
) -> dict[str, str] | None:
    match event_type:
        case "account.updated":
            _handle_account_updated(db, obj, now_iso)
        case "payment_intent.succeeded":
            _set_payment_status(db, obj["id"], "succeeded", reservation="paid")
        case "payment_intent.payment_failed":
            _set_payment_status(db, obj["id"], "failed")
        case "payment_intent.amount_capturable_updated":
            # Kaution vorautorisiert (Geld ist reserviert, noch nicht eingezogen).
            _set_payment_status(db, obj["id"], "pending", reservation="deposit_held")
        case "charge.refunded":
            pi_id = _field(obj, "payment_intent")
            if pi_id:
                # Stripe feuert charge.refunded auch bei TEILerstattung. Nur bei
                # voller Erstattung die Buchung als 'refunded' markieren, sonst
                # 'partially_refunded' — sonst gilt eine 10-€-Teilerstattung als
                # komplette Rückabwicklung einer 200-€-Buchung.
                amount = int(_field(obj, "amount", 0) or 0)
                refunded = int(_field(obj, "amount_refunded", 0) or 0)
                fully = refunded >= amount > 0
                status_val = "refunded" if fully else "partially_refunded"
                _set_payment_status(db, pi_id, status_val, reservation=status_val)
        case _:
            log.info("stripe_webhook_ignored", event_type=event_type)
    return {"status": "ok"}


def _handle_account_updated(
    db: Client, account: Mapping[str, Any], now_iso: str
) -> None:
    """KYC-Status eines Connected Accounts in tenant_billing_profile spiegeln."""
    stripe_account_id = account["id"]
    charges = bool(_field(account, "charges_enabled", False))
    payouts = bool(_field(account, "payouts_enabled", False))
    details = bool(_field(account, "details_submitted", False))
    update: dict[str, Any] = {
        "stripe_charges_enabled": charges,
        "stripe_payouts_enabled": payouts,
        "stripe_details_submitted": details,
    }
    if details:
        update["stripe_onboarding_at"] = now_iso
    result = (
        db.table("tenant_billing_profile")
        .update(update)
        .eq("stripe_account_id", stripe_account_id)
        .execute()
    )
    if result.data:
        log.info("stripe_account_updated", stripe_account_id=stripe_account_id)
    else:
        log.warning("stripe_account_not_found_in_db", stripe_account_id=stripe_account_id)


def _set_payment_status(
    db: Client,
    payment_intent_id: str,
    payment_status: str,
    *,
    reservation: str | None = None,
) -> None:
    """``payments``-Row (über gateway_ref) auf neuen Status; optional die
    Reservierung mit-aktualisieren."""
    rows = (
        db.table("payments")
        .select("id, reservation_id")
        .eq("gateway_ref", payment_intent_id)
        .limit(1)
        .execute()
    ).data
    if not rows:
        log.warning("stripe_payment_not_found", payment_intent_id=payment_intent_id)
        return
    payment = rows[0]
    db.table("payments").update({"status": payment_status}).eq(
        "id", payment["id"]
    ).execute()
    if reservation:
        db.table("reservations").update({"payment_status": reservation}).eq(
            "id", payment["reservation_id"]
        ).execute()
