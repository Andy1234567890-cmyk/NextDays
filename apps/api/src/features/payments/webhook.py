"""Stripe-Webhook-Eventverarbeitung (Stufe D).

Vom Router aufgerufen, nachdem die Signatur geprüft wurde. Idempotent über die
Event-ID (``stripe_webhook_event``): ein zweiter Eingang derselben ID wird
übersprungen. Behandelt:
  * account.updated                     — KYC-Flags in tenant_billing_profile
  * payment_intent.succeeded            — Zahlung paid + Reservierung paid
  * payment_intent.payment_failed       — Zahlung failed
  * payment_intent.amount_capturable_updated — Kaution autorisiert
  * charge.refunded                     — Refund-Status spiegeln

Zusätzlich Abo-Billing (features/subscriptions):
  * customer.subscription.created/updated/deleted — tenant_subscription-Status
  * invoice.paid / invoice.payment_failed        — Abo-Zahlstatus

Tenant-Bezug entsteht aus der ``payments``-Row (gateway_ref = PaymentIntent-ID)
bzw. dem Account; nichts wird geraten. Für Abo-Events kommt der Tenant aus der
``subscription.metadata.tenant_id`` bzw. der lokalen ``tenant_subscription``-Row
(Customer-ID) — ebenfalls nicht geraten.
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
            res_id = _set_payment_status(
                db, obj["id"], "succeeded", reservation="paid"
            )
            if res_id:
                # Fee-Ledger (0182): pending → charged. Status-Guard macht die
                # Redelivery idempotent (Wurzel 2). Läuft im try des Dispatchers →
                # ein Fehler rollt den Event-Claim zurück (Stripe liefert erneut).
                fee_ref = _field(obj, "application_fee_amount")
                _mark_platform_fee_charged(
                    db, res_id, gateway_fee_ref=str(fee_ref) if fee_ref else None
                )
        case "payment_intent.payment_failed":
            res_id = _set_payment_status(db, obj["id"], "failed")
            if res_id:
                _mark_platform_fee_failed(db, res_id)
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
        case "customer.subscription.created" | "customer.subscription.updated" | \
                "customer.subscription.deleted":
            _handle_subscription_event(db, obj)
        case "invoice.paid" | "invoice.payment_failed":
            _handle_invoice_event(db, event_type, obj)
        case _:
            log.info("stripe_webhook_ignored", event_type=event_type)
    return {"status": "ok"}


def _resolve_sub_tenant(db: Client, obj: Mapping[str, Any]) -> str | None:
    """Tenant einer Abo-Subscription bestimmen — nichts raten (Wurzel 3):
    zuerst subscription.metadata.tenant_id, sonst über die lokale
    tenant_subscription-Row (customer-ID). Gibt None, wenn nicht auflösbar."""
    meta = _field(obj, "metadata", {}) or {}
    tenant_id = meta.get("tenant_id") if isinstance(meta, Mapping) else None
    if tenant_id:
        return tenant_id
    customer_id = _field(obj, "customer")
    if not customer_id:
        return None
    rows = (
        db.table("tenant_subscription")
        .select("tenant_id")
        .eq("stripe_customer_id", customer_id)
        .limit(1)
        .execute()
    ).data
    return rows[0]["tenant_id"] if rows else None


def _grundtarif_quantity(obj: Mapping[str, Any]) -> int | None:
    """Gemeldete Objektzahl = quantity der Grundtarif-Position (lookup_key). Nur
    zum Spiegeln in reported_property_count; None wenn nicht auffindbar."""
    items = _field(_field(obj, "items", {}) or {}, "data", []) or []
    for it in items:
        price = _field(it, "price", {}) or {}
        if _field(price, "lookup_key") == "mnd_grundtarif_month":
            return int(_field(it, "quantity", 0) or 0)
    return None


def _iso_from_epoch(value: Any) -> str | None:  # noqa: ANN401
    if not value:
        return None
    from datetime import UTC, datetime
    return datetime.fromtimestamp(int(value), tz=UTC).isoformat()


def _handle_subscription_event(db: Client, obj: Mapping[str, Any]) -> None:
    """tenant_subscription mit dem Stripe-Subscription-Zustand spiegeln.
    Upsert auf tenant_id (idempotent, Wurzel 2). deleted → status canceled."""
    tenant_id = _resolve_sub_tenant(db, obj)
    if not tenant_id:
        log.warning("subscription_tenant_unresolved", sub_id=_field(obj, "id"))
        return
    update: dict[str, Any] = {
        "tenant_id": tenant_id,
        "stripe_subscription_id": _field(obj, "id"),
        "status": _field(obj, "status"),
        "cancel_at_period_end": bool(_field(obj, "cancel_at_period_end", False)),
        "current_period_end": _iso_from_epoch(_field(obj, "current_period_end")),
    }
    if _field(obj, "customer"):
        update["stripe_customer_id"] = _field(obj, "customer")
    qty = _grundtarif_quantity(obj)
    if qty is not None:
        update["reported_property_count"] = qty
    db.table("tenant_subscription").upsert(update, on_conflict="tenant_id").execute()
    _sync_module_entitlements(db, tenant_id, obj)
    log.info("subscription_synced", tenant_id=tenant_id, status=update["status"])


def _sync_module_entitlements(
    db: Client, tenant_id: str, obj: Mapping[str, Any]
) -> None:
    """Aktive Zusatzmodule aus den Subscription-Items ableiten und in
    tenant_module_entitlement spiegeln. Gegenzustand pflegen (Wurzel 1): ein
    Modul, das nicht mehr in den Items steht, wird deaktiviert — nicht gelöscht,
    damit die Historie bleibt."""
    price_to_module = {
        "modul3_flat": "modul3_buchhaltung",
        "modul4_flat": "modul4_mitarbeiter",
        "modul4_per_seat": "modul4_mitarbeiter",
        "modul6_flat": "modul6_hotel",
        "modul6_per_room": "modul6_hotel",
    }
    sub_active = _field(obj, "status") in ("active", "trialing", "past_due")
    items = _field(_field(obj, "items", {}) or {}, "data", []) or []
    present: dict[str, str] = {}
    for it in items:
        price = _field(it, "price", {}) or {}
        lk = _field(price, "lookup_key")
        mod = price_to_module.get(lk)
        if mod:
            present[mod] = _field(it, "id")
    # Aktive Module setzen/aktualisieren.
    for mod, item_id in present.items():
        db.table("tenant_module_entitlement").upsert(
            {
                "tenant_id": tenant_id,
                "module_key": mod,
                "stripe_subscription_item_id": item_id,
                "active": sub_active,
                "active_until": None,
            },
            on_conflict="tenant_id,module_key",
        ).execute()
    # Module, die nicht mehr in der Subscription sind → deaktivieren (Gegenzustand).
    existing = (
        db.table("tenant_module_entitlement")
        .select("module_key")
        .eq("tenant_id", tenant_id)
        .eq("active", True)
        .execute()
    ).data
    for row in existing:
        if row["module_key"] not in present:
            db.table("tenant_module_entitlement").update({"active": False}).eq(
                "tenant_id", tenant_id
            ).eq("module_key", row["module_key"]).execute()


def _handle_invoice_event(
    db: Client, event_type: str, obj: Mapping[str, Any]
) -> None:
    """Abo-Rechnung bezahlt/fehlgeschlagen → Status der tenant_subscription
    nachziehen. Der MASSGEBLICHE Status kommt aus customer.subscription.*; hier
    nur die zwei sicheren Übergänge, ohne einen frischeren Subscription-Status zu
    überschreiben (sonst würde eine spät zugestellte alte invoice.paid ein
    inzwischen canceled/past_due fälschlich auf active zurücksetzen)."""
    customer_id = _field(obj, "customer")
    if not customer_id:
        return
    rows = (
        db.table("tenant_subscription")
        .select("status")
        .eq("stripe_customer_id", customer_id)
        .limit(1)
        .execute()
    ).data
    if not rows:
        log.warning("invoice_tenant_not_found", customer_id=customer_id)
        return
    current = rows[0].get("status")
    if event_type == "invoice.payment_failed":
        new_status = "past_due"
    elif current == "past_due":
        new_status = "active"  # Erholung nach erfolgreicher Zahlung
    else:
        return  # kein Übergang nötig — Subscription-Event führt den Status
    db.table("tenant_subscription").update({"status": new_status}).eq(
        "stripe_customer_id", customer_id
    ).execute()


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
) -> str | None:
    """``payments``-Row (über gateway_ref) auf neuen Status; optional die
    Reservierung mit-aktualisieren. Gibt die reservation_id zurück (für die
    Fee-Ledger-Kopplung), None wenn keine Zahlung gefunden."""
    rows = (
        db.table("payments")
        .select("id, reservation_id")
        .eq("gateway_ref", payment_intent_id)
        .limit(1)
        .execute()
    ).data
    if not rows:
        log.warning("stripe_payment_not_found", payment_intent_id=payment_intent_id)
        return None
    payment = rows[0]
    db.table("payments").update({"status": payment_status}).eq(
        "id", payment["id"]
    ).execute()
    if reservation:
        db.table("reservations").update({"payment_status": reservation}).eq(
            "id", payment["reservation_id"]
        ).execute()
    return payment["reservation_id"]


def _mark_platform_fee_charged(
    db: Client, reservation_id: str, *, gateway_fee_ref: str | None = None
) -> None:
    """Fee-Zeile (0182) einer Buchung 'pending' → 'charged'. Nur aus 'pending'
    (Status-Guard) → Webhook-Redelivery ist ein No-op (Wurzel 2)."""
    patch: dict[str, Any] = {"status": "charged"}
    if gateway_fee_ref:
        patch["gateway_fee_ref"] = gateway_fee_ref
    db.table("platform_fees").update(patch).eq(
        "reservation_id", reservation_id
    ).eq("status", "pending").execute()


def _mark_platform_fee_failed(db: Client, reservation_id: str) -> None:
    """Fee-Zeile 'pending' → 'failed' (Charge endgültig fehlgeschlagen, Fee nie
    geflossen)."""
    db.table("platform_fees").update({"status": "failed"}).eq(
        "reservation_id", reservation_id
    ).eq("status", "pending").execute()
