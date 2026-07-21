"""PayPal-Webhook-Eventverarbeitung (Multiparty).

Vom Router aufgerufen, NACHDEM die Signatur über die PayPal-API verifiziert wurde.
Idempotent über die transmission_id (``paypal_webhook_event``): eine zweite
Zustellung derselben ID wird übersprungen (Wurzel 2). Behandelt:

  * MERCHANT.ONBOARDING.COMPLETED   — Verkäufer-Onboarding fertig → Status syncen
  * MERCHANT.PARTNER-CONSENT.REVOKED — Freigabe entzogen → PayPal deaktivieren
  * PAYMENT.CAPTURE.COMPLETED       — Zahlung eingegangen → payments/Reservierung paid
  * PAYMENT.CAPTURE.REFUNDED        — Rückerstattung → Status spiegeln
  * PAYMENT.CAPTURE.DENIED/DECLINED — Capture abgelehnt → payments failed

Tenant-/Zuordnungsbezug entsteht aus der ``payments``-Row (paypal_capture_id bzw.
paypal_order_id) bzw. der merchant_id — nichts wird geraten (Wurzel 3).
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.payments.paypal.webhook")


def _claim(db: Client, event: dict[str, Any], now_iso: str) -> bool:
    """transmission_id atomar reservieren. True = neu (verarbeiten), False =
    Duplikat. INSERT ... ON CONFLICT DO NOTHING statt SELECT-dann-INSERT."""
    transmission_id = event.get("_transmission_id")
    if not transmission_id:
        return False
    resource = event.get("resource") or {}
    res = (
        db.table("paypal_webhook_event")
        .upsert(
            {
                "transmission_id": transmission_id,
                "event_id": event.get("id"),
                "event_type": event.get("event_type"),
                "resource_id": resource.get("id"),
                "received_at": now_iso,
            },
            on_conflict="transmission_id",
            ignore_duplicates=True,
        )
        .execute()
    ).data
    # ignore_duplicates: bei Konflikt kommt eine leere Liste zurück → schon gesehen.
    return bool(res)


def handle_paypal_event(db: Client, event: dict[str, Any], *, now_iso: str) -> None:
    """Ein verifiziertes PayPal-Event verarbeiten (idempotent). Fehler werden
    hochgereicht (Wurzel 5) — der Router entscheidet über Retry; nie still
    verschlucken."""
    if not _claim(db, event, now_iso):
        return
    event_type = event.get("event_type") or ""
    resource = event.get("resource") or {}

    if event_type == "MERCHANT.ONBOARDING.COMPLETED":
        _on_onboarding_completed(db, resource)
    elif event_type == "MERCHANT.PARTNER-CONSENT.REVOKED":
        _on_consent_revoked(db, resource)
    elif event_type == "PAYMENT.CAPTURE.COMPLETED":
        _on_capture(db, resource, "succeeded")
    elif event_type in ("PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.DECLINED"):
        _on_capture(db, resource, "failed")
    elif event_type == "PAYMENT.CAPTURE.REFUNDED":
        _on_refund(db, resource)
    else:
        log.info("paypal_webhook_ignored", event_type=event_type)


def _on_onboarding_completed(db: Client, resource: dict[str, Any]) -> None:
    """Onboarding fertig: den Status frisch von PayPal nachladen (der Webhook-Body
    ist nur Auslöser, die Wahrheit kommt aus dem Status-Call, Wurzel 3)."""
    merchant_id = resource.get("merchant_id") or resource.get("merchant_id_in_paypal")
    tracking_id = resource.get("tracking_id")
    if not merchant_id:
        return
    from .service import PaymentsService  # noqa: PLC0415 (Zyklus vermeiden)

    service = PaymentsService(service_client=db)
    tenant_id = tracking_id or _tenant_by_merchant(db, merchant_id)
    if not tenant_id:
        # merchant_id noch nicht im Profil: erst über tracking_id zuordnen (kommt
        # sonst über den Return-Handler). Ohne Zuordnung nichts spiegeln.
        return
    service.sync_paypal_status(tenant_id=tenant_id, merchant_id=merchant_id)


def _on_consent_revoked(db: Client, resource: dict[str, Any]) -> None:
    merchant_id = resource.get("merchant_id") or resource.get("merchant_id_in_paypal")
    if not merchant_id:
        return
    from .service import PaymentsService  # noqa: PLC0415

    PaymentsService(service_client=db).revoke_paypal(merchant_id=merchant_id)


def _on_capture(db: Client, resource: dict[str, Any], status: str) -> None:
    """PAYMENT.CAPTURE.* → payments-Row über die Order-ID finden, capture_id
    nachtragen und Status setzen. Die Order-ID steht in
    supplementary_data.related_ids.order_id."""
    capture_id = resource.get("id")
    order_id = (
        (resource.get("supplementary_data") or {})
        .get("related_ids", {})
        .get("order_id")
    )
    row = _payment_by_order_or_capture(db, order_id, capture_id)
    if not row:
        return
    patch: dict[str, Any] = {"status": status}
    if capture_id and not row.get("paypal_capture_id"):
        patch["paypal_capture_id"] = capture_id
    db.table("payments").update(patch).eq("id", row["id"]).execute()
    if status == "succeeded":
        _set_reservation_paid(db, row["reservation_id"], "paid")


def _on_refund(db: Client, resource: dict[str, Any]) -> None:
    """PAYMENT.CAPTURE.REFUNDED → Ursprungszahlung als (teil-)erstattet markieren.
    Die erstattete Capture steht in links/related; wir finden die Zahlung über die
    capture_id, falls im Resource-Body vorhanden."""
    links = resource.get("links") or []
    capture_id = next(
        (
            link.get("href", "").rstrip("/").split("/")[-1]
            for link in links
            if link.get("rel") == "up"
        ),
        None,
    )
    if not capture_id:
        return
    row = _payment_by_order_or_capture(db, None, capture_id)
    if not row:
        return
    # Voll-/Teilstatus setzt der aktive Refund-Pfad (refund_payment) selbst; hier
    # nur als Backstop, falls der Refund extern (PayPal-Dashboard) ausgelöst wurde.
    if row.get("status") not in ("refunded", "partially_refunded"):
        db.table("payments").update({"status": "partially_refunded"}).eq(
            "id", row["id"]
        ).execute()


# --- Lookups -----------------------------------------------------------------

def _payment_by_order_or_capture(
    db: Client, order_id: str | None, capture_id: str | None
) -> dict[str, Any] | None:
    """payments-Row über PayPal-Order-ID ODER Capture-ID finden (nur gateway=paypal)."""
    if capture_id:
        rows = (
            db.table("payments")
            .select("id, reservation_id, status, paypal_capture_id")
            .eq("gateway", "paypal")
            .eq("paypal_capture_id", capture_id)
            .limit(1)
            .execute()
        ).data
        if rows:
            return rows[0]
    if order_id:
        rows = (
            db.table("payments")
            .select("id, reservation_id, status, paypal_capture_id")
            .eq("gateway", "paypal")
            .eq("paypal_order_id", order_id)
            .limit(1)
            .execute()
        ).data
        if rows:
            return rows[0]
    return None


def _tenant_by_merchant(db: Client, merchant_id: str) -> str | None:
    rows = (
        db.table("tenant_billing_profile")
        .select("tenant_id")
        .eq("paypal_merchant_id", merchant_id)
        .limit(1)
        .execute()
    ).data
    return rows[0]["tenant_id"] if rows else None


def _set_reservation_paid(db: Client, reservation_id: str, status: str) -> None:
    db.table("reservations").update({"payment_status": status}).eq(
        "id", reservation_id
    ).execute()
