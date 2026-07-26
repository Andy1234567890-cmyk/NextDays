"""Service für das Abo-Billing (Tenant → myNextDays).

Getrennt vom Gast→Vermieter-Fluss (features/payments, Stripe Connect). Hier ist
myNextDays der Verkäufer und der Tenant der Kunde: Grundgebühr + graduated
Objekt-Staffel + Zusatzmodule, alles als Stripe-Subscription.

Die Beträge liegen ausschließlich in Stripe (seed_stripe_prices.py) und werden
per lookup_key aufgelöst — NIE hier hardcoded (Wurzel 4). Objektzahl = quantity
des graduated Preises; sie wird bei jeder Property-Änderung nachgezogen, wobei
der Gegenzustand (aktive Objektzahl) neu berechnet statt inkrementiert wird
(Wurzel 1). Customer-Anlage ist idempotent (Wurzel 2). Jeder Zugriff ist
tenant-gescopet (Wurzel 3). Stripe-Fehler werden spezifisch übersetzt (Wurzel 5).
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from stripe import StripeClient
from stripe import StripeError as _StripeError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import (
    GRUNDTARIF_LOOKUP_KEY,
    MODULE_KEYS,
    MODULE_PRICE_LOOKUP,
    CommissionRow,
    CommissionSummary,
    ModuleEntitlement,
    ModulePrice,
    PriceTier,
    PricingResponse,
    SliceHealth,
    SubscriptionStatusResponse,
)

log = get_logger("nextdays.subscriptions")

# Externe Provisions-Staffel (Preisliste Abschnitt 2) — NICHT magisch im Code
# verstreut (Wurzel 4). 1 % bis 100 Objekte, 0,5 % ab 101.
COMMISSION_RATE_STANDARD = 0.01
COMMISSION_RATE_HIGH_VOLUME = 0.005
COMMISSION_HIGH_VOLUME_FROM = 101  # ab dieser Objektzahl gilt der reduzierte Satz
# OTA-Kanäle, für die die externe Provision anfällt (dieselbe Menge wie im
# payments-Slice; eigene/portal-Buchungen sind hier NICHT provisionspflichtig —
# die tragen die 8 % Portal-Fee direkt am Charge).
EXTERNAL_CHANNELS = frozenset(
    {"booking", "airbnb", "vrbo", "ota_other"}
)

# module_key -> (lookup_key, per-unit-Label). Deckt alle im UI wählbaren Preise.
_MODULE_PRICE_VARIANTS: dict[str, tuple[str, str | None]] = {
    "modul3_buchhaltung": ("modul3_flat", None),
    "modul4_mitarbeiter": ("modul4_flat", None),
    "modul4_per_seat": ("modul4_per_seat", "Nutzer"),
    "modul6_hotel": ("modul6_flat", None),
    "modul6_per_room": ("modul6_per_room", "Zimmer"),
}


def _f(obj: Any, key: str, default: Any = None) -> Any:  # noqa: ANN401
    """Feldzugriff robust für Stripe-``StripeObject`` (KEIN ``.get()``) UND Dict.
    StripeObject erlaubt Item-Zugriff, wirft aber bei fehlendem Key — daher
    try/except auf den Default (analog payments/webhook._field)."""
    if isinstance(obj, Mapping):
        return obj.get(key, default)
    try:
        return obj[key]
    except (KeyError, AttributeError, TypeError):
        return default


class SubscriptionsError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class SubscriptionsService:
    slice_name = "subscriptions"

    def __init__(
        self,
        *,
        service_client: Client | None = None,
        stripe: StripeClient | None = None,
    ) -> None:
        self._db = service_client
        self._injected_stripe = stripe

    # -- Infrastruktur ------------------------------------------------------
    @property
    def _stripe(self) -> StripeClient:
        if self._injected_stripe is not None:
            return self._injected_stripe
        # Lazy-Import, damit ein fehlender Key den Slice nicht beim Laden killt.
        from src.features.payments.stripe_client import (
            StripeNotConfiguredError,
            get_stripe,
        )

        try:
            return get_stripe()
        except StripeNotConfiguredError as exc:
            raise SubscriptionsError(str(exc), status_code=503) from exc

    def health(self) -> SliceHealth:
        return SliceHealth(status="ok")

    def _require(self, ctx: AuthContext) -> tuple[Client, str]:
        if not ctx.tenant_id:
            raise SubscriptionsError("Kein Tenant im Token.", status_code=403)
        if self._db is None:
            raise SubscriptionsError("Subscriptions-DB nicht verfügbar.", status_code=500)
        return self._db, ctx.tenant_id

    # -- Stripe-Preis-Auflösung (keine Beträge hardcoden, Wurzel 4) ---------
    def _price_id_by_lookup(self, lookup_key: str) -> str:
        """Stripe-Preis-ID aus stabilem lookup_key. Fehlt der Preis, ist das ein
        Konfig-/Datenfehler → klar fehlschlagen (nicht raten, Wurzel 4)."""
        try:
            res = self._stripe.v1.prices.list(
                params={"lookup_keys": [lookup_key], "active": True, "limit": 1}
            )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        data = getattr(res, "data", None) or []
        if not data:
            raise SubscriptionsError(
                f"Stripe-Preis '{lookup_key}' nicht gefunden. Preisliste seeden "
                "(deploy/billing/seed_stripe_prices.py).",
                status_code=503,
            )
        return data[0]["id"]

    @staticmethod
    def _stripe_err(exc: _StripeError) -> SubscriptionsError:
        msg = getattr(exc, "user_message", None) or str(exc) or "Stripe-Fehler."
        code = 400 if exc.__class__.__name__ == "InvalidRequestError" else 502
        return SubscriptionsError(msg, status_code=code)

    # -- Objektzahl (billable quantity) -------------------------------------
    def _active_property_count(self, db: Client, tenant_id: str) -> int:
        """Zahl der ABRECHENBAREN Objekte = properties mit status='active'.
        draft (noch nicht live) und inactive (stillgelegt) zählen NICHT — sonst
        würden Entwürfe/stillgelegte Objekte berechnet. Serverseitig ermittelt,
        nie aus dem Request übernommen (Wurzel 3)."""
        res = (
            db.table("properties")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .eq("status", "active")
            .execute()
        )
        return int(res.count or 0)

    # -- Customer (idempotent, Wurzel 2) ------------------------------------
    def _load_row(self, db: Client, tenant_id: str) -> dict[str, Any] | None:
        rows = (
            db.table("tenant_subscription")
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return rows[0] if rows else None

    def _ensure_customer(self, db: Client, tenant_id: str) -> str:
        """Stripe-Customer für den Tenant — vorhandenen wiederverwenden (Wurzel 2:
        Doppelklick/Retry legt keinen zweiten Customer an). Der lokale Row-UNIQUE
        auf stripe_customer_id ist der DB-Backstop."""
        row = self._load_row(db, tenant_id)
        if row and row.get("stripe_customer_id"):
            return row["stripe_customer_id"]
        # Tenant-Metadaten für den Customer (nur zur Zuordnung, kein Rateschluss).
        tenant = (
            db.table("tenants").select("name").eq("id", tenant_id).limit(1).execute()
        ).data
        name = tenant[0]["name"] if tenant else None
        try:
            customer = self._stripe.v1.customers.create(
                params={
                    "name": name,
                    "metadata": {"tenant_id": tenant_id},
                }
            )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        new_id = customer["id"]
        # Zeile sicherstellen (INSERT falls neu), ohne eine bereits gesetzte
        # customer-ID zu überschreiben.
        db.table("tenant_subscription").upsert(
            {"tenant_id": tenant_id, "stripe_customer_id": new_id},
            on_conflict="tenant_id",
            ignore_duplicates=True,
        ).execute()
        # Die ID nur setzen, wenn das Feld noch leer ist (is null). Der WHERE-Guard
        # macht das Rennen atomar: bei parallelem Doppelklick / vorab per Webhook
        # angelegter leerer Zeile gewinnt genau einer, der Rest schreibt nichts
        # (Wurzel 2). Danach die verbindliche Wahrheit aus der DB nachlesen.
        db.table("tenant_subscription").update(
            {"stripe_customer_id": new_id}
        ).eq("tenant_id", tenant_id).is_("stripe_customer_id", "null").execute()
        stored = self._load_row(db, tenant_id)
        winner = (stored or {}).get("stripe_customer_id") or new_id
        # Steht in der DB eine ANDERE ID (paralleler Gewinner), ist unser frisch
        # erzeugter Customer verwaist → aufräumen, kein doppelter Stripe-Kunde.
        if winner != new_id:
            try:
                self._stripe.v1.customers.delete(new_id)
            except _StripeError:
                log.warning("orphan_customer_cleanup_failed", customer_id=new_id)
        return winner

    # -- Öffentliche Operationen --------------------------------------------
    def get_status(self, ctx: AuthContext) -> SubscriptionStatusResponse:
        db, tenant_id = self._require(ctx)
        row = self._load_row(db, tenant_id)
        count = self._active_property_count(db, tenant_id)
        modules = [
            ModuleEntitlement(
                module_key=m["module_key"],
                active=bool(m["active"]),
                active_until=m.get("active_until"),
            )
            for m in (
                db.table("tenant_module_entitlement")
                .select("module_key, active, active_until")
                .eq("tenant_id", tenant_id)
                .execute()
            ).data
        ]
        if not row:
            return SubscriptionStatusResponse(
                has_subscription=False, property_count=count, modules=modules
            )
        return SubscriptionStatusResponse(
            has_subscription=bool(row.get("stripe_subscription_id")),
            status=row.get("status"),
            stripe_customer_id=row.get("stripe_customer_id"),
            property_count=count,
            current_period_end=row.get("current_period_end"),
            cancel_at_period_end=bool(row.get("cancel_at_period_end")),
            modules=modules,
        )

    def create_checkout(
        self,
        ctx: AuthContext,
        *,
        module_keys: list[str],
        success_url: str,
        cancel_url: str,
    ) -> str:
        """Stripe-Checkout-Session für Grund-Abo (+ gewählte Module). Adaptive
        Pricing rechnet in die Käuferwährung um (27 EU). quantity des graduated
        Preises = aktuelle abrechenbare Objektzahl."""
        db, tenant_id = self._require(ctx)
        for mk in module_keys:
            if mk not in MODULE_PRICE_LOOKUP:
                raise SubscriptionsError(
                    f"Unbekanntes/nicht buchbares Modul: {mk}", status_code=400
                )
        # Kein zweites Abo, wenn schon eins läuft (Wurzel 2: Doppelklick / bereits
        # abonniert). Sonst legt Checkout eine ZWEITE Subscription an → doppelte
        # Grundgebühr. Änderungen laufen über das Billing-Portal, nicht neuen Checkout.
        existing = self._load_row(db, tenant_id)
        if existing and existing.get("stripe_subscription_id") and existing.get(
            "status"
        ) in ("active", "trialing", "past_due"):
            raise SubscriptionsError(
                "Es besteht bereits ein aktives Abo. Änderungen über die "
                "Abo-Verwaltung (Billing-Portal).",
                status_code=409,
            )
        customer_id = self._ensure_customer(db, tenant_id)
        count = self._active_property_count(db, tenant_id)
        # Grundtarif: quantity = Objektzahl (Stripe rechnet die Staffel selbst).
        # Bei 0 aktiven Objekten trotzdem quantity 1 (Tier-1-Flat = Grundgebühr,
        # das 1. Objekt ist laut Preisliste inklusive).
        line_items: list[dict[str, Any]] = [
            {
                "price": self._price_id_by_lookup(GRUNDTARIF_LOOKUP_KEY),
                "quantity": max(count, 1),
            }
        ]
        for mk in module_keys:
            line_items.append(
                {"price": self._price_id_by_lookup(MODULE_PRICE_LOOKUP[mk]), "quantity": 1}
            )
        try:
            session = self._stripe.v1.checkout.sessions.create(
                params={
                    "mode": "subscription",
                    "customer": customer_id,
                    "line_items": line_items,
                    "success_url": success_url,
                    "cancel_url": cancel_url,
                    "client_reference_id": tenant_id,
                    "subscription_data": {"metadata": {"tenant_id": tenant_id}},
                }
            )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        url = _f(session, "url")
        if not url:
            raise SubscriptionsError("Stripe lieferte keine Checkout-URL.", status_code=502)
        return url

    def create_portal(self, ctx: AuthContext, *, return_url: str) -> str:
        """Stripe Billing-Portal (Zahlungsmethode, Rechnungen, kündigen)."""
        db, tenant_id = self._require(ctx)
        row = self._load_row(db, tenant_id)
        if not row or not row.get("stripe_customer_id"):
            raise SubscriptionsError(
                "Kein Stripe-Kunde vorhanden — zuerst ein Abo abschließen.",
                status_code=409,
            )
        try:
            session = self._stripe.v1.billing_portal.sessions.create(
                params={"customer": row["stripe_customer_id"], "return_url": return_url}
            )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        url = _f(session, "url")
        if not url:
            raise SubscriptionsError("Stripe lieferte keine Portal-URL.", status_code=502)
        return url

    # -- Objektzahl-Sync (Wurzel 1: Gegenzustand neu berechnen) -------------
    def sync_property_quantity(self, ctx: AuthContext) -> int:
        """Nach Anlegen/Aktivieren/Deaktivieren/Löschen eines Objekts aufrufen:
        setzt die graduated-quantity der laufenden Subscription auf die aktuell
        abrechenbare Objektzahl. Neu BERECHNET (nicht ±1 inkrementiert), damit
        Doppelaufrufe/Retries idempotent sind (Wurzel 2) und der Gegenzustand
        stimmt (Wurzel 1). No-op ohne aktive Subscription."""
        _, tenant_id = self._require(ctx)
        return self.sync_quantity_for_tenant(tenant_id)

    def sync_quantity_for_tenant(self, tenant_id: str) -> int:
        """Objektzahl → Stripe-quantity für einen Tenant nachziehen. Öffentlicher
        Einstieg auch für den properties-Slice (best-effort-Hook nach Property-
        Änderungen). Braucht keinen AuthContext, weil der Tenant bereits
        serverseitig feststeht (kein Request-Scope-Bruch, Wurzel 3)."""
        if self._db is None:
            raise SubscriptionsError("Subscriptions-DB nicht verfügbar.", status_code=500)
        return self._sync_quantity(self._db, tenant_id)

    def _sync_quantity(self, db: Client, tenant_id: str) -> int:
        row = self._load_row(db, tenant_id)
        count = self._active_property_count(db, tenant_id)
        if not row or not row.get("stripe_subscription_id"):
            # Kein aktives Abo → nur den lokalen Zähler aktualisieren.
            if row:
                db.table("tenant_subscription").update(
                    {"reported_property_count": count}
                ).eq("tenant_id", tenant_id).execute()
            return count
        try:
            sub = self._stripe.v1.subscriptions.retrieve(row["stripe_subscription_id"])
            item = self._grundtarif_item(sub)
            if item is None:
                raise SubscriptionsError(
                    "Grundtarif-Position in der Subscription nicht gefunden.",
                    status_code=500,
                )
            qty = max(count, 1)
            if int(_f(item, "quantity", 0) or 0) != qty:
                self._stripe.v1.subscription_items.update(
                    _f(item, "id"),
                    params={"quantity": qty, "proration_behavior": "create_prorations"},
                )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        db.table("tenant_subscription").update(
            {"reported_property_count": count}
        ).eq("tenant_id", tenant_id).execute()
        return count

    def _grundtarif_item(self, sub: Any) -> dict[str, Any] | None:  # noqa: ANN401
        """Die Subscription-Position, die den graduated Grundtarif trägt —
        erkannt am lookup_key des Preises (nicht an Reihenfolge geraten)."""
        items = _f(_f(sub, "items", {}) or {}, "data", []) or []
        for it in items:
            price = _f(it, "price", {}) or {}
            if _f(price, "lookup_key") == GRUNDTARIF_LOOKUP_KEY:
                return it
        return None

    # -- Preise für die UI (echte Stripe-Beträge, Wurzel 4) -----------------
    def get_pricing(self) -> PricingResponse:
        """Liest die tatsächlichen Beträge aus Stripe (nie Frontend-Hardcode).
        Grundtarif als Tier-Liste, Module als Einzelpreise. Fehlt ein Preis,
        klar fehlschlagen (Preisliste nicht geseedet)."""
        try:
            res = self._stripe.v1.prices.list(
                params={
                    "lookup_keys": [GRUNDTARIF_LOOKUP_KEY],
                    "active": True,
                    "limit": 1,
                    "expand": ["data.tiers"],
                }
            )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        data = getattr(res, "data", None) or []
        if not data:
            raise SubscriptionsError(
                "Grundtarif-Preis nicht gefunden (Preisliste seeden).",
                status_code=503,
            )
        gt = data[0]
        currency = (_f(gt, "currency", "") or "").upper()
        tiers = [
            PriceTier(
                up_to=_f(t, "up_to"),
                flat_amount=_f(t, "flat_amount"),
                unit_amount=_f(t, "unit_amount"),
            )
            for t in (_f(gt, "tiers", []) or [])
        ]
        modules: list[ModulePrice] = []
        for mkey, (lookup, label) in _MODULE_PRICE_VARIANTS.items():
            try:
                mres = self._stripe.v1.prices.list(
                    params={"lookup_keys": [lookup], "active": True, "limit": 1}
                )
            except _StripeError as exc:
                raise self._stripe_err(exc) from exc
            mdata = getattr(mres, "data", None) or []
            if not mdata:
                continue  # Modul-Preis fehlt → weglassen (nicht raten)
            modules.append(
                ModulePrice(
                    module_key=mkey,
                    lookup_key=lookup,
                    unit_amount=int(_f(mdata[0], "unit_amount", 0) or 0),
                    per_unit_label=label,
                )
            )
        return PricingResponse(
            currency=currency, grundtarif_tiers=tiers, modules=modules
        )

    # -- Modul-Entitlement (serverseitig, Wurzel 3) -------------------------
    def has_module(self, ctx: AuthContext, module_key: str) -> bool:
        """Feature-Gate: ist das Modul für diesen Tenant aktiv? Serverseitig
        erzwungen — nie nur im Frontend ausblenden."""
        db, tenant_id = self._require(ctx)
        if module_key not in MODULE_KEYS:
            raise SubscriptionsError(f"Unbekanntes Modul: {module_key}", status_code=400)
        rows = (
            db.table("tenant_module_entitlement")
            .select("active")
            .eq("tenant_id", tenant_id)
            .eq("module_key", module_key)
            .eq("active", True)
            .limit(1)
            .execute()
        ).data
        return bool(rows)

    # -- Externe Provision (OTA-Buchungen, nachgelagert) --------------------
    def get_commission_summary(self, ctx: AuthContext) -> CommissionSummary:
        """Provisions-Übersicht für die Billing-UI: aktueller Satz + offene
        (pending) Provisionen. Tenant-gescopet (Wurzel 3)."""
        db, tenant_id = self._require(ctx)
        rate = self.commission_rate_for_tenant(db, tenant_id)
        rows = (
            db.table("commission_ledger")
            .select("reservation_id, channel, currency, gross_amount, rate, "
                    "commission_amount, status, period")
            .eq("tenant_id", tenant_id)
            .eq("status", "pending")
            .execute()
        ).data
        total = round(sum(float(r["commission_amount"]) for r in rows), 2)
        currency = rows[0]["currency"] if rows else None
        return CommissionSummary(
            current_rate=rate,
            pending_total=total,
            pending_count=len(rows),
            currency=currency,
            rows=[CommissionRow(**r) for r in rows],
        )

    def commission_rate_for_tenant(self, db: Client, tenant_id: str) -> float:
        """Provisions-Satz nach Objektzahl-Staffel (Preisliste): 1 % bis 100
        Objekte, 0,5 % ab 101. Dieselbe abrechenbare Objektzahl wie das Abo
        (status='active'), damit Abo und Provision konsistent sind (Wurzel 4:
        Satz aus den Daten, nicht geraten)."""
        count = self._active_property_count(db, tenant_id)
        if count >= COMMISSION_HIGH_VOLUME_FROM:
            return COMMISSION_RATE_HIGH_VOLUME
        return COMMISSION_RATE_STANDARD

    def record_commission(
        self,
        tenant_id: str,
        *,
        reservation_id: str,
        channel: str,
        gross_amount: float,
        currency: str,
    ) -> None:
        """Provisionszeile für eine EXTERNE OTA-Buchung anlegen/aktualisieren.
        Idempotent über UNIQUE(reservation_id) (Wurzel 2: OTA-Resync/Redelivery
        erzeugt keine zweite Zeile). Nur solange die Zeile noch 'pending' ist wird
        der Betrag nachgezogen (eine bereits fakturierte Provision bleibt fix —
        sonst würde eine nachträgliche OTA-Preisänderung eine gestellte Rechnung
        verfälschen). Nur externe Kanäle; eigene/portal ignorieren."""
        if self._db is None:
            raise SubscriptionsError("Subscriptions-DB nicht verfügbar.", status_code=500)
        db = self._db
        # Kein Provisionsgrund (mehr): eigener/portal-Kanal ODER 0-Umsatz. Falls
        # aus einer FRÜHEREN Revision noch eine offene Provisionszeile existiert
        # (Kanalwechsel extern→eigen, oder Betrag per Resync auf 0), muss die weg
        # (Gegenzustand, Wurzel 1) — sonst bliebe eine falsche Provision stehen.
        if channel not in EXTERNAL_CHANNELS or gross_amount <= 0:
            self.cancel_commission(tenant_id, reservation_id=reservation_id)
            return
        if not currency:
            raise SubscriptionsError(
                "Währung der Buchung fehlt — keine Provision ohne Währung.",
                status_code=422,
            )
        rate = self.commission_rate_for_tenant(db, tenant_id)
        commission = round(gross_amount * rate, 2)
        existing = (
            db.table("commission_ledger")
            .select("id, status")
            .eq("reservation_id", reservation_id)
            .limit(1)
            .execute()
        ).data
        payload = {
            "tenant_id": tenant_id,
            "reservation_id": reservation_id,
            "channel": channel,
            "currency": currency,
            "gross_amount": gross_amount,
            "rate": rate,
            "commission_amount": commission,
        }
        if existing:
            if existing[0]["status"] != "pending":
                return  # schon fakturiert/bezahlt → nicht mehr anfassen
            db.table("commission_ledger").update(payload).eq(
                "id", existing[0]["id"]
            ).execute()
        else:
            db.table("commission_ledger").insert(payload).execute()

    def cancel_commission(self, tenant_id: str, *, reservation_id: str) -> None:
        """Storno einer OTA-Buchung → offene Provisionszeile entfernen
        (Gegenzustand, Wurzel 1). Eine bereits fakturierte Provision bleibt
        bestehen (die Rechnung wurde gestellt); die wird ggf. separat gutgeschrieben."""
        if self._db is None:
            raise SubscriptionsError("Subscriptions-DB nicht verfügbar.", status_code=500)
        self._db.table("commission_ledger").delete().eq(
            "tenant_id", tenant_id
        ).eq("reservation_id", reservation_id).eq("status", "pending").execute()

    def bill_commissions_for_ctx(self, ctx: AuthContext, *, period: str) -> int:
        """ctx-basierter Einstieg für den API-Endpunkt (Tenant aus dem Token,
        Wurzel 3). Delegiert an die tenant-basierte Abrechnung."""
        _, tenant_id = self._require(ctx)
        return self.bill_pending_commissions(tenant_id, period=period)

    def bill_pending_commissions(self, tenant_id: str, *, period: str) -> int:
        """Monats-Worker: alle 'pending'-Provisionen eines Tenants als EIN
        Stripe-Invoice-Item auf das laufende Abo buchen, dann auf 'invoiced'
        setzen. Idempotent: bereits fakturierte Zeilen (period gesetzt) werden
        nicht erneut berechnet (Wurzel 2). Gibt die Zahl der abgerechneten Zeilen
        zurück. Kein Abo → klar fehlschlagen, nicht still verschlucken (Wurzel 5)."""
        if self._db is None:
            raise SubscriptionsError("Subscriptions-DB nicht verfügbar.", status_code=500)
        db = self._db
        pending = (
            db.table("commission_ledger")
            .select("id, commission_amount, currency")
            .eq("tenant_id", tenant_id)
            .eq("status", "pending")
            .execute()
        ).data
        if not pending:
            return 0
        # Alle offenen Provisionen müssen dieselbe Währung haben (ein Invoice-Item
        # hat genau eine Währung). Gemischt → klar fehlschlagen statt raten.
        currencies = {row["currency"] for row in pending}
        if len(currencies) > 1:
            raise SubscriptionsError(
                f"Provisionen in gemischten Währungen ({currencies}) — nicht in "
                "einer Rechnung abrechenbar.",
                status_code=409,
            )
        currency = currencies.pop()
        total = round(sum(float(row["commission_amount"]) for row in pending), 2)
        if total <= 0:
            return 0
        sub_row = self._load_row(db, tenant_id)
        if not sub_row or not sub_row.get("stripe_customer_id"):
            raise SubscriptionsError(
                "Kein Stripe-Kunde/Abo — Provision nicht abrechenbar.",
                status_code=409,
            )
        # Idempotenz (Wurzel 2): Worker und manueller Endpoint können parallel
        # laufen; beide lesen dieselben pending-Zeilen. Ein deterministischer
        # idempotency_key aus tenant+period sorgt dafür, dass Stripe bei einem
        # zweiten Lauf DASSELBE Invoice-Item zurückgibt statt ein zweites zu
        # erzeugen (keine Doppel-Belastung). Der anschließende Ledger-Update ist
        # ohnehin idempotent (Status pending→invoiced einmalig wirksam).
        idem_key = f"comm:{tenant_id}:{period}"
        try:
            item = self._stripe.v1.invoice_items.create(
                params={
                    "customer": sub_row["stripe_customer_id"],
                    "amount": int(round(total * 100)),
                    "currency": currency.lower(),
                    "description": f"OTA-Provision {period}",
                    "metadata": {"tenant_id": tenant_id, "period": period},
                },
                options={"idempotency_key": idem_key},
            )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        item_id = _f(item, "id")
        ids = [row["id"] for row in pending]
        for row_id in ids:
            db.table("commission_ledger").update(
                {"status": "invoiced", "period": period,
                 "stripe_invoice_item_id": item_id}
            ).eq("id", row_id).execute()
        log.info(
            "commissions_billed", tenant_id=tenant_id, period=period,
            count=len(ids), total=total, currency=currency,
        )
        return len(ids)
