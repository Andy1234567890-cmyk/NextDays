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
from datetime import UTC, date, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.features.addons.zahlung import verbuche_checkout_session
from src.features.donations.service import DonationsService
from src.features.payouts.service import PayoutsService

log = get_logger("nextdays.payments.webhook")

# Wie lange eine Auszahlung bei einem Chargeback eingefroren bleibt. Stripe
# räumt dem Betrieb ~20 Tage zum Widersprechen ein; danach fällt die
# Entscheidung. 45 Tage geben Puffer, ohne das Geld dauerhaft zu blockieren —
# der Hold läuft von selbst ab (gib_holds_frei), niemand muss ihn aufheben.
DISPUTE_HOLD_TAGE = 45


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
    # Bei Events aus einem VERBUNDENEN Konto (Direct Charges, z. B. der
    # Zahlungslink für Zusatzleistungen) trägt das Event `account`. Der Wert
    # entscheidet mit, ob eine Zahlung zu unserem Link gehört (Wurzel 3).
    account = _field(event, "account")
    try:
        result = _dispatch_stripe_event(
            db, event_type, obj, now_iso, account=str(account) if account else None
        )
    except Exception:
        # Verarbeitung fehlgeschlagen → Claim wieder freigeben, damit der
        # Stripe-Retry das Event erneut zustellt (sonst bliebe die Zahlung/
        # Reservierung dauerhaft im falschen Status, weil das Event schon als
        # „gesehen" markiert wäre).
        db.table("stripe_webhook_event").delete().eq("id", event_id).execute()
        raise
    return result or {"status": "ok"}


def _dispatch_stripe_event(
    db: Client,
    event_type: str,
    obj: Mapping[str, Any],
    now_iso: str,
    *,
    account: str | None = None,
) -> dict[str, str] | None:
    match event_type:
        case "checkout.session.completed":
            # Zusatzleistungen, per Zahlungslink im verbundenen Konto bezahlt
            # (0386). Der Aufruf filtert selbst auf seine Metadata und lässt
            # fremde Checkout-Sessions unberührt.
            if not verbuche_checkout_session(db, obj, account=account):
                log.info("stripe_webhook_checkout_fremd", event_type=event_type)
        case "account.updated":
            _handle_account_updated(db, obj, now_iso)
        case "payment_intent.succeeded":
            res_id = _set_payment_status(
                db, obj["id"], "succeeded", reservation="paid"
            )
            ptyp = _zahlungs_typ(db, obj["id"])
            if res_id:
                # Fee-Ledger (0182): pending → charged. Status-Guard macht die
                # Redelivery idempotent (Wurzel 2). Läuft im try des Dispatchers →
                # ein Fehler rollt den Event-Claim zurück (Stripe liefert erneut).
                fee_ref = _field(obj, "application_fee_amount")
                _mark_platform_fee_charged(
                    db, res_id, gateway_fee_ref=str(fee_ref) if fee_ref else None
                )
                # Spende (0216) ist Teil derselben application_fee → gleicher
                # Auslöser wie die Gebühr.
                _mark_donation_collected(db, res_id)
                # Auszahlung planen (0217). Fällig wird sie erst NACH DER
                # ABREISE — hier wird nur der Termin gesetzt, kein Geld bewegt.
                # Die Charge-ID wird mitgegeben: Sie bindet den späteren
                # Transfer an diesen Zahlungseingang (source_transaction, 0218)
                # und macht Auszahlungen in fremder Währung überhaupt möglich.
                _plane_auszahlung(
                    db,
                    res_id,
                    charge_id=_field(obj, "latest_charge"),
                    payment_type=ptyp,
                )
        case "payment_intent.payment_failed":
            res_id = _set_payment_status(db, obj["id"], "failed")
            if res_id:
                _mark_platform_fee_failed(db, res_id)
        case "payment_intent.amount_capturable_updated":
            # Kaution vorautorisiert (Geld ist reserviert, noch nicht eingezogen).
            _set_payment_status(db, obj["id"], "pending", reservation="deposit_held")
        case "charge.dispute.created":
            # Chargeback: Der Gast bestreitet die Zahlung. Solange das offen
            # ist, darf die Auszahlung NICHT rausgehen — sonst zahlt die
            # Plattform den Betrieb aus Geld, das ihr gerade entzogen wird
            # (Stripe belastet den Plattform-Saldo sofort).
            _halte_auszahlung_zurueck(db, _field(obj, "payment_intent"))
        case "charge.dispute.closed":
            # Zugunsten des Betriebs entschieden → Hold läuft reguläre ab
            # (gib_holds_frei). Gegen ihn → der Refund-Pfad hat bereits einen
            # Verrechnungsposten angelegt. Hier ist nichts weiter zu tun; der
            # Fall wird nur festgehalten, damit er im Log auftaucht.
            log.info(
                "stripe_dispute_closed",
                charge=_field(obj, "id"),
                status=_field(obj, "status"),
            )
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
                res_id = _set_payment_status(
                    db, pi_id, status_val, reservation=status_val
                )
                if res_id:
                    # Spende anteilig zurücknehmen (Wurzel 1). Bei voller
                    # Erstattung die ganze Zeile, sonst der erstattete Anteil
                    # am Bruttobetrag — der Service kappt auf den noch
                    # offenen Rest, damit mehrere Teilerstattungen zusammen
                    # nie mehr zurücknehmen als gespendet wurde.
                    anteil = (
                        None
                        if fully
                        else _donation_anteil(db, res_id, refunded, amount)
                    )
                    _reverse_donation(db, res_id, anteil_cents=anteil)
                    # Auszahlung (0217): Ist sie noch nicht geflossen, wird sie
                    # einbehalten. Ist sie schon draußen, entsteht ein
                    # Verrechnungsposten für die nächste — das ist der Kern des
                    # Modells (Airbnb: "wird von den nächsten Auszahlungen
                    # einbehalten"), kein Rückholen vom Bankkonto.
                    _storniere_auszahlung(db, res_id, refunded_cents=refunded)
        case "identity.verification_session.verified" | \
                "identity.verification_session.processing" | \
                "identity.verification_session.requires_input" | \
                "identity.verification_session.canceled":
            _handle_identity_event(db, event_type, obj, now_iso)
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
    return datetime.fromtimestamp(int(value), tz=UTC).isoformat()


def _period_end(obj: Mapping[str, Any]) -> Any | None:  # noqa: ANN401
    """Ende der laufenden Periode als Epoch.

    Seit API-Version 2025-03-31 trägt NICHT mehr die Subscription das Feld,
    sondern jede Item-Zeile (Stripe erlaubt seither Positionen mit eigenen
    Perioden). Ältere Versionen liefern es weiterhin oben. Erst oben lesen,
    sonst die früheste Item-Periode nehmen — das ist der Zeitpunkt, zu dem
    als Nächstes abgerechnet wird.
    """
    top = _field(obj, "current_period_end")
    if top:
        return top
    items = _field(_field(obj, "items", {}) or {}, "data", []) or []
    enden = [e for it in items if (e := _field(it, "current_period_end"))]
    return min(enden) if enden else None


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
        "current_period_end": _iso_from_epoch(_period_end(obj)),
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


def _meta_get(meta: Any, key: str) -> str | None:  # noqa: ANN401
    """Metadaten-Wert robust lesen — Stripe liefert ``metadata`` mal als Dict
    (Test), mal als StripeObject OHNE ``.get()`` (Live). Beide Formen erlauben
    Index-Zugriff; fehlt der Key, ist es None (kein Crash, Wurzel 5)."""
    try:
        value = meta[key]
    except (KeyError, TypeError, AttributeError):
        return None
    return str(value) if value is not None else None


# Stripe-Identity-Event → users.identity_status. Event-Typ bestimmt den Status
# 1:1 (kein Fake-Default, Wurzel 5). Reihenfolge der Events ist nicht garantiert
# → wir setzen schlicht den zum Event gehörenden Status.
_IDENTITY_STATUS = {
    "identity.verification_session.verified": "verified",
    "identity.verification_session.processing": "processing",
    "identity.verification_session.requires_input": "requires_input",
    "identity.verification_session.canceled": "unverified",
}


def _handle_identity_event(
    db: Client, event_type: str, session: Mapping[str, Any], now_iso: str
) -> None:
    """Ausweis-Verifizierungs-Status auf den Gastgeber schreiben.

    Zuordnung über metadata{user_id,tenant_id} (serverseitig gesetzt) — dem
    Client wird NICHT vertraut (Wurzel 3). Scope: der Nutzer muss zum Tenant aus
    der Session-Metadata gehören, sonst wird nichts geschrieben. Es werden KEINE
    Ausweisdaten gespeichert, nur der Status + Zeitpunkt (DSGVO/DE).
    """
    status_val = _IDENTITY_STATUS.get(event_type)
    if status_val is None:
        return
    meta = _field(session, "metadata", {}) or {}
    user_id = _meta_get(meta, "user_id")
    tenant_id = _meta_get(meta, "tenant_id")
    session_id = _field(session, "id")
    if not user_id or not tenant_id:
        log.warning("identity_event_without_metadata", session_id=session_id)
        return

    update: dict[str, Any] = {"identity_status": status_val}
    if status_val == "verified":
        update["identity_verified_at"] = now_iso
    if session_id:
        update["identity_session_id"] = session_id

    # Scope-Guard: nur die Zeile dieses Nutzers UND dieses Tenants (Wurzel 3).
    result = (
        db.table("users")
        .update(update)
        .eq("id", user_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if result.data:
        log.info("identity_status_set", user_id=user_id, status=status_val)
    else:
        log.warning("identity_user_not_found", user_id=user_id, tenant_id=tenant_id)


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


def _mark_donation_collected(db: Client, reservation_id: str) -> None:
    """Spendenzeile (0216) 'pending' → 'collected', sobald die Zahlung durch ist.

    Der Betrag steckt in der application_fee und liegt damit auf dem
    Plattform-Saldo. Status-Guard im Service macht die Redelivery idempotent
    (Wurzel 2). Best effort: eine fehlende Spendenzeile darf den Webhook nicht
    kippen, sonst liefert Stripe endlos neu aus.
    """
    try:
        DonationsService(db=db).markiere_eingesammelt(reservation_id)
    except Exception as exc:  # noqa: BLE001 — Webhook darf nicht kippen
        log.warning(
            "donation_collect_failed",
            reservation_id=reservation_id,
            error=str(exc)[:200],
        )


def _storniere_auszahlung(
    db: Client, reservation_id: str, *, refunded_cents: int
) -> None:
    """Gegenzustand der Auszahlung bei Erstattung (Wurzel 1).

    Zwei Fälle, klar getrennt:

    * **Noch nicht ausgezahlt** → Zeile auf 'withheld'. Es fließt nie Geld,
      nichts muss zurückgeholt werden. Der Regelfall, weil wir erst nach der
      Abreise auszahlen.
    * **Schon ausgezahlt** → Verrechnungsposten. Er wird von der nächsten
      Auszahlung einbehalten. Rückholen vom Bankkonto scheitert, sobald der
      Betrieb das Geld abgehoben hat — genau deshalb machen Airbnb und Booking
      es so.

    Best effort (Wurzel 5): Der Geld-Refund ist bereits passiert.
    """
    try:
        rows = (
            db.table("payouts")
            .select("id, tenant_id, status, net_amount_cents, currency")
            .eq("reservation_id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            return
        zeile = rows[0]
        service = PayoutsService(db=db)

        if zeile["status"] != "paid":
            service.storniere(reservation_id)
            return

        # Bereits ausgezahlt: nur bis zur Höhe der Auszahlung verrechnen —
        # Provision und Spende hat der Betrieb nie bekommen, sie dürfen ihm
        # auch nicht abgezogen werden.
        betrag = min(refunded_cents, int(zeile["net_amount_cents"]))
        service.verrechne_storno(
            reservation_id=reservation_id,
            tenant_id=zeile["tenant_id"],
            betrag_cents=betrag,
            currency=zeile["currency"],
            kind="refund",
        )
    except Exception as exc:  # noqa: BLE001 — Webhook darf nicht kippen
        log.error(
            "payout_reverse_failed",
            reservation_id=reservation_id,
            error=str(exc)[:200],
        )


def _halte_auszahlung_zurueck(db: Client, payment_intent_id: str | None) -> None:
    """Bei einem Chargeback die Auszahlung der Buchung einfrieren.

    Stripe belastet den Plattform-Saldo sofort mit dem strittigen Betrag. Ginge
    die Auszahlung trotzdem raus, zahlte die Plattform den Betrieb aus Geld,
    das ihr gerade entzogen wird — und müsste es danach zurückholen.

    Der Hold läuft nach ``DISPUTE_HOLD_TAGE`` automatisch ab
    (``gib_holds_frei``), damit eine vergessene Freigabe das Geld nicht
    dauerhaft blockiert. Best effort (Wurzel 5): Der Webhook darf davon nicht
    kippen, sonst liefert Stripe endlos neu aus.
    """
    if not payment_intent_id:
        return
    try:
        rows = (
            db.table("payments")
            .select("reservation_id")
            .eq("gateway_ref", payment_intent_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return
        reservation_id = rows[0]["reservation_id"]
        zeilen = (
            db.table("payouts")
            .select("id, status")
            .eq("reservation_id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen or zeilen[0].get("status") == "paid":
            # Schon ausgezahlt: Ein Hold hilft nicht mehr. Der Betrag kommt
            # über den Verrechnungsposten des Refund-Pfads zurück.
            log.info(
                "dispute_payout_bereits_ausgezahlt",
                reservation_id=reservation_id,
            )
            return
        PayoutsService(db=db).halte_zurueck(
            payout_id=zeilen[0]["id"],
            reason="dispute",
            expires_at=datetime.now(UTC) + timedelta(days=DISPUTE_HOLD_TAGE),
            note=f"Chargeback zu {payment_intent_id}",
        )
        log.info("dispute_payout_gehalten", reservation_id=reservation_id)
    except Exception as exc:  # noqa: BLE001 — Webhook darf nicht kippen
        log.error(
            "dispute_hold_failed",
            payment_intent_id=payment_intent_id,
            error=str(exc)[:200],
        )


def _zahlungs_typ(db: Client, payment_intent_id: str) -> str | None:
    """Typ der Zahlung hinter einem Intent ('full', 'deposit', 'balance', …).

    Entscheidet, ob eine Auszahlung geplant werden darf: Eine Kaution ist kein
    Umsatz des Betriebs und darf die Auszahlungszeile der Buchung nicht
    anfassen. None, wenn nicht auffindbar — dann wird nicht gefiltert.
    """
    rows = (
        db.table("payments")
        .select("type")
        .eq("gateway_ref", payment_intent_id)
        .limit(1)
        .execute()
    ).data or []
    return rows[0].get("type") if rows else None


def _ist_portal_buchung(res: dict) -> bool:
    """Kam die Buchung über unser myBestDays-Portal (8 % all-in)?

    Gleiche Regel wie ``PaymentsService._ist_portal_buchung``: Der KANAL
    entscheidet, nicht der Kontotyp (Preisliste §2). Nur Portal-Buchungen
    laufen über unser Konto und brauchen deshalb eine Auszahlung.

    Fail-closed (Wurzel 5): Fehlt der Kanal, gilt sie NICHT als Portal-Buchung.
    """
    return (res.get("channel") or "").lower() == "portal"


def _plane_auszahlung(
    db: Client,
    reservation_id: str,
    *,
    charge_id: str | None = None,
    payment_type: str | None = None,
) -> None:
    """Auszahlungszeile anlegen, sobald die Zahlung durch ist (0217).

    Fällig wird sie erst nach der Abreise — hier wird nur der Termin gesetzt.
    Die Beträge werden aus den bereits festgeschriebenen Ledgern gelesen
    (platform_fees, donations, cohost_payouts), NICHT neu gerechnet: Sonst
    könnte ein zwischenzeitlich geänderter Satz die Aufteilung verschieben.

    Best effort (Wurzel 5): Der Gast hat bezahlt — ein Fehler beim Planen darf
    den Webhook nicht kippen, sonst liefert Stripe endlos neu aus. Die Zeile
    lässt sich nachträglich erzeugen.
    """
    # KAUTIONEN NIE. Beim Einzug einer Kaution feuert Stripe ebenfalls
    # payment_intent.succeeded. Ohne diesen Filter würde der Upsert die
    # bestehende Auszahlungszeile der Buchung überschreiben: status fiele auf
    # 'scheduled' zurück (auch eine bereits stornierte/einbehaltene Zeile wäre
    # wieder scharf) und source_charge_id zeigte auf die KAUTIONS-Charge —
    # der spätere Transfer hinge am falschen Zahlungseingang.
    if payment_type == "deposit":
        return
    try:
        res = (
            db.table("reservations")
            .select(
                "id, tenant_id, total_amount, currency, check_out,"
                " checked_out_at, channel"
            )
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            return
        r = res[0]
        if not _ist_portal_buchung(r):
            # Direct Charge (eigene Website des Betriebs oder OTA): Das Geld
            # ging direkt an ihn, es existiert kein Plattform-Saldo, aus dem
            # ausgezahlt werden könnte. Eine Zeile hier wäre eine Auszahlung
            # ins Leere (oder, mit umgelegtem Flag, eine zweite Zahlung).
            log.info(
                "payout_plan_skipped_direct_charge",
                reservation_id=reservation_id,
                channel=r.get("channel"),
            )
            return
        currency = r.get("currency")
        if not currency or not r.get("total_amount"):
            # Ohne Betrag oder Währung keine Auszahlung planen — nichts raten
            # (Wurzel 4). Fällt im Monitoring auf.
            log.warning("payout_plan_skipped_incomplete", reservation_id=reservation_id)
            return

        brutto = int(round(float(r["total_amount"]) * 100))
        plattform = _summe(db, "platform_fees", reservation_id, "fee_amount_cents")
        spende = _summe(db, "donations", reservation_id, "amount_cents")
        # Spalte heißt payout_amount_cents (0214) — NICHT amount_cents wie bei
        # platform_fees/donations. Mit dem falschen Namen kam still 0 zurück und
        # der Co-Gastgeber-Anteil blieb im Netto des Gastgebers stehen: doppelt
        # ausgezahlt, sobald der Cohost-Transfer separat lief.
        cohost = _summe(db, "cohost_payouts", reservation_id, "payout_amount_cents")

        PayoutsService(db=db).plane_auszahlung(
            reservation_id=reservation_id,
            tenant_id=r["tenant_id"],
            brutto_cents=brutto,
            plattform_cents=plattform,
            spende_cents=spende,
            cohost_cents=cohost,
            currency=currency,
            checked_out_at=_als_datum(r.get("checked_out_at")),
            check_out=_als_tag(r.get("check_out")),
            source_charge_id=charge_id,
        )
    except Exception as exc:  # noqa: BLE001 — Webhook darf nicht kippen
        log.error(
            "payout_plan_failed",
            reservation_id=reservation_id,
            error=str(exc)[:200],
        )


def _summe(db: Client, tabelle: str, reservation_id: str, spalte: str) -> int:
    """Summe einer Cent-Spalte für eine Buchung. 0, wenn nichts vorliegt."""
    rows = (
        db.table(tabelle)
        .select(spalte)
        .eq("reservation_id", reservation_id)
        .execute()
    ).data or []
    return sum(int(r.get(spalte) or 0) for r in rows)


def _als_datum(wert: str | datetime | None) -> datetime | None:
    """ISO-String aus der DB in datetime — None bleibt None."""
    if not wert:
        return None
    if isinstance(wert, datetime):
        return wert
    return datetime.fromisoformat(str(wert).replace("Z", "+00:00"))


def _als_tag(wert: str | date | None) -> date | None:
    """ISO-Datum aus der DB in date — None bleibt None."""
    if not wert:
        return None
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert)[:10])


def _donation_anteil(
    db: Client, reservation_id: str, refunded_cents: int, gross_cents: int
) -> int | None:
    """Wie viel Spende bei einer TEILerstattung zurückzunehmen ist.

    Anteilig zum erstatteten Betrag, gerechnet auf dem EINGEFRORENEN
    Spendenbetrag der Buchung — nicht auf dem aktuellen Satz des Betriebs, der
    sich seit der Buchung geändert haben kann (Wurzel 4).

    ``None`` bei fehlender Zeile oder unbrauchbaren Zahlen: Der Aufrufer nimmt
    dann nichts zurück, statt einen geratenen Betrag zu buchen.
    """
    if refunded_cents <= 0 or gross_cents <= 0:
        return None
    rows = (
        db.table("donations")
        .select("amount_cents")
        .eq("reservation_id", reservation_id)
        .limit(1)
        .execute()
    ).data
    if not rows:
        return None
    gespendet = int(rows[0]["amount_cents"] or 0)
    if gespendet <= 0:
        return None
    # Abrunden zugunsten der Organisation: lieber einen Cent zu wenig
    # zurücknehmen als einen zu viel.
    return gespendet * refunded_cents // gross_cents


def _reverse_donation(
    db: Client, reservation_id: str, *, anteil_cents: int | None = None
) -> None:
    """Gegenzustand bei Erstattung (Wurzel 1): Spende anteilig zurücknehmen.

    Der Spendenbetrag steckt in der application_fee und liegt auf dem
    Plattform-Saldo. Bei einer Erstattung wurde die zugehörige Nacht nie
    bewohnt — es gibt also nichts zu spenden. Die Ledger-Zeile wird
    zurückgenommen, damit der Betrag NICHT an die Organisation ausgezahlt wird.

    Kein Geldereignis: Das Geld hat unseren Saldo nie verlassen. Genau deshalb
    genügt hier die Buchung.
    """
    try:
        DonationsService(db=db).markiere_storniert(
            reservation_id, anteil_cents=anteil_cents
        )
    except Exception as exc:  # noqa: BLE001 — Webhook darf nicht kippen
        log.warning(
            "donation_reverse_failed",
            reservation_id=reservation_id,
            error=str(exc)[:200],
        )


def _mark_platform_fee_failed(db: Client, reservation_id: str) -> None:
    """Fee-Zeile 'pending' → 'failed' (Charge endgültig fehlgeschlagen, Fee nie
    geflossen)."""
    db.table("platform_fees").update({"status": "failed"}).eq(
        "reservation_id", reservation_id
    ).eq("status", "pending").execute()
