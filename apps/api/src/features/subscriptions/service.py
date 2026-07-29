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
from datetime import UTC, datetime
from typing import Any

from stripe import StripeClient
from stripe import StripeError as _StripeError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

# EU-Länderliste NICHT zweitkopieren — dieselbe Menge entscheidet über
# Reverse-Charge in den Eigentümer-Abrechnungen (Wurzel 4: eine Quelle).
from src.features.owner_statements.tax import EU_COUNTRIES as _EU_LAENDER

from .schemas import (
    GRUNDTARIF_LOOKUP_KEY,
    MODULE_PRICE_LOOKUP,
    BillingAddress,
    CommissionRow,
    CommissionSummary,
    InvoiceRow,
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
_ISO_LAND_LAENGE = 2  # ISO-3166-1 alpha-2
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

    def _customer_exists(self, customer_id: str) -> bool:
        """Existiert der Customer bei Stripe noch? Eine gespeicherte ID kann ins
        Leere zeigen — gelöschter Testkunde, Wechsel des Stripe-Accounts oder
        Test-/Live-Key-Tausch. Dann ist JEDER Aufruf mit dieser ID ein 404 und
        der Betrieb kommt weder an seine Rechnungsadresse noch durch den
        Checkout. Nur 'resource_missing' gilt als 'weg'; alle anderen Fehler
        (Netz, Auth, Rate-Limit) dürfen NICHT zum Neuanlegen führen, sonst
        entstünde bei einer Stripe-Störung ein Doppelkunde (Wurzel 5)."""
        try:
            cus = self._stripe.v1.customers.retrieve(customer_id)
        except _StripeError as exc:
            if getattr(exc, "code", None) == "resource_missing":
                return False
            raise self._stripe_err(exc) from exc
        # Ein bei Stripe gelöschter Kunde wird weiterhin ausgeliefert, ist aber
        # als deleted markiert und für Checkout/Update unbrauchbar.
        return not _f(cus, "deleted", False)

    def _ensure_customer(self, db: Client, tenant_id: str) -> str:
        """Stripe-Customer für den Tenant — vorhandenen wiederverwenden (Wurzel 2:
        Doppelklick/Retry legt keinen zweiten Customer an). Der lokale Row-UNIQUE
        auf stripe_customer_id ist der DB-Backstop.

        Zeigt die gespeicherte ID ins Leere, wird sie verworfen und ein neuer
        Customer angelegt — sonst bliebe der Tenant dauerhaft blockiert."""
        row = self._load_row(db, tenant_id)
        vorhanden = (row or {}).get("stripe_customer_id")
        if vorhanden:
            if self._customer_exists(vorhanden):
                return vorhanden
            # Verwaiste ID entfernen, damit der WHERE-Guard unten (is null)
            # greifen kann und die neue ID geschrieben wird.
            log.warning(
                "stripe_customer_verwaist_neu_angelegt",
                tenant_id=tenant_id,
                alte_customer_id=vorhanden,
            )
            db.table("tenant_subscription").update(
                {"stripe_customer_id": None}
            ).eq("tenant_id", tenant_id).eq(
                "stripe_customer_id", vorhanden
            ).execute()
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
            # Verwaiste ID: das Portal kann nichts anzeigen. Statt des rohen
            # Stripe-Texts ("No such customer") sagen, was zu tun ist — den
            # Kunden legt der nächste Checkout/Adress-Speichern neu an.
            if getattr(exc, "code", None) == "resource_missing":
                raise SubscriptionsError(
                    "Der hinterlegte Zahlungskunde existiert bei Stripe nicht "
                    "mehr. Bitte das Abo neu abschließen.",
                    status_code=409,
                ) from exc
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

    # -- Rechnungsadresse + Rechnungen (Quelle: Stripe) ---------------------
    def get_billing_address(self, ctx: AuthContext) -> BillingAddress:
        """Rechnungsadresse aus dem Stripe-Customer. Existiert noch kein
        Customer, liefern wir eine LEERE Adresse statt einen anzulegen: ein
        reiner Lesezugriff darf keinen Kunden bei Stripe erzeugen (Wurzel 2)."""
        db, tenant_id = self._require(ctx)
        row = self._load_row(db, tenant_id)
        customer_id = (row or {}).get("stripe_customer_id")
        if not customer_id:
            return BillingAddress()
        try:
            cus = self._stripe.v1.customers.retrieve(
                customer_id, params={"expand": ["tax_ids"]}
            )
        except _StripeError as exc:
            # Verwaiste ID (gelöschter Kunde, Account-/Key-Wechsel): wie „noch
            # keine Adresse" behandeln statt die Seite mit 400 zu blockieren.
            # Der Schreibpfad legt beim Speichern einen frischen Customer an.
            if getattr(exc, "code", None) == "resource_missing":
                return BillingAddress()
            raise self._stripe_err(exc) from exc
        return self._billing_address_from_customer(cus)

    @staticmethod
    def _billing_address_from_customer(cus: Any) -> BillingAddress:  # noqa: ANN401
        """Stripe-Customer → BillingAddress. Vor-/Nachname liegen bei Stripe nur
        als EIN `name`-Feld; wir teilen am ERSTEN Leerzeichen (der Rest ist
        Nachname), damit mehrteilige Nachnamen wie 'van der Berg' heil bleiben."""
        addr = _f(cus, "address") or {}
        meta = _f(cus, "metadata") or {}
        konto_typ = _f(meta, "account_type") or "individual"
        voller_name = (_f(cus, "name") or "").strip()
        firma = _f(meta, "company_name")
        if konto_typ == "company":
            # Bei Unternehmen trägt `name` den Firmennamen — die Personennamen
            # stehen in den Metadaten, sonst gingen sie beim Speichern verloren.
            vorname = _f(meta, "first_name")
            nachname = _f(meta, "last_name")
            firma = firma or voller_name or None
        else:
            vorname, _, nachname = voller_name.partition(" ")
            vorname = vorname or None
            nachname = nachname.strip() or None
        steuer = _f(cus, "tax_ids") or {}
        steuer_daten = _f(steuer, "data") or []
        return BillingAddress(
            first_name=vorname,
            last_name=nachname,
            line1=_f(addr, "line1"),
            line2=_f(addr, "line2"),
            city=_f(addr, "city"),
            state=_f(addr, "state"),
            postal_code=_f(addr, "postal_code"),
            country=_f(addr, "country"),
            email=_f(cus, "email"),
            account_type=konto_typ,
            company_name=firma,
            vat_id=_f(steuer_daten[0], "value") if steuer_daten else None,
        )

    def update_billing_address(
        self, ctx: AuthContext, addr: BillingAddress
    ) -> BillingAddress:
        """Rechnungsadresse am Stripe-Customer setzen. Anders als beim Lesen legen
        wir hier bei Bedarf einen Customer an — der Nutzer will ja gerade seine
        Rechnungsdaten hinterlegen."""
        db, tenant_id = self._require(ctx)
        customer_id = self._ensure_customer(db, tenant_id)
        if addr.account_type not in ("individual", "company"):
            raise SubscriptionsError(
                "Konto-Typ muss 'individual' oder 'company' sein.", status_code=422
            )
        if addr.account_type == "company" and not (addr.company_name or "").strip():
            raise SubscriptionsError(
                "Für ein Unternehmen ist der Firmenname nötig.", status_code=422
            )
        land = (addr.country or "").strip().upper()
        if land and len(land) != _ISO_LAND_LAENGE:
            raise SubscriptionsError(
                "Land muss als 2-stelliger ISO-Code angegeben werden.", status_code=422
            )
        person = " ".join(
            t for t in ((addr.first_name or "").strip(), (addr.last_name or "").strip()) if t
        )
        ist_firma = addr.account_type == "company"
        params: dict[str, Any] = {
            "name": (addr.company_name or "").strip() if ist_firma else (person or None),
            "email": (addr.email or "").strip() or None,
            "address": {
                "line1": (addr.line1 or "").strip() or None,
                "line2": (addr.line2 or "").strip() or None,
                "city": (addr.city or "").strip() or None,
                "state": (addr.state or "").strip() or None,
                "postal_code": (addr.postal_code or "").strip() or None,
                "country": land or None,
            },
            # Personennamen und Konto-Typ überleben nur in den Metadaten: Stripe
            # kennt am Customer kein getrenntes Vor-/Nachname-Feld.
            "metadata": {
                "account_type": addr.account_type,
                "first_name": (addr.first_name or "").strip(),
                "last_name": (addr.last_name or "").strip(),
                "company_name": (addr.company_name or "").strip(),
            },
        }
        try:
            self._stripe.v1.customers.update(customer_id, params=params)
            self._sync_vat_id(customer_id, addr.vat_id, land)
            cus = self._stripe.v1.customers.retrieve(
                customer_id, params={"expand": ["tax_ids"]}
            )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        return self._billing_address_from_customer(cus)

    def _sync_vat_id(self, customer_id: str, vat_id: str | None, land: str) -> None:
        """USt-IdNr. am Customer pflegen. Stripe erlaubt kein Ändern einer
        tax_id — nur Anlegen/Löschen. Unverändert lassen wir sie stehen, damit
        eine bereits von Stripe VALIDIERTE Nummer ihren Status behält."""
        gewuenscht = (vat_id or "").strip().upper()
        vorhandene = self._stripe.v1.customers.tax_ids.list(
            customer_id, params={"limit": 100}
        )
        for eintrag in _f(vorhandene, "data") or []:
            if (_f(eintrag, "value") or "").upper() == gewuenscht:
                return  # schon gesetzt → nicht anfassen
            self._stripe.v1.customers.tax_ids.delete(
                customer_id, _f(eintrag, "id")
            )
        if not gewuenscht:
            return
        # EU-Länder → eu_vat; alles andere überlassen wir Stripes Autoerkennung
        # nicht, sondern lehnen es ab (falscher Typ erzeugt stumme Fehlrechnungen).
        if land not in _EU_LAENDER:
            raise SubscriptionsError(
                "USt-IdNr. wird derzeit nur für EU-Länder unterstützt.",
                status_code=422,
            )
        self._stripe.v1.customers.tax_ids.create(
            customer_id, params={"type": "eu_vat", "value": gewuenscht}
        )

    def list_invoices(self, ctx: AuthContext, *, limit: int = 24) -> list[InvoiceRow]:
        """Rechnungsverlauf aus Stripe. Ohne Customer gibt es nichts zu zeigen —
        leere Liste statt Fehler (der Betrieb hat schlicht noch nie gezahlt)."""
        db, tenant_id = self._require(ctx)
        row = self._load_row(db, tenant_id)
        customer_id = (row or {}).get("stripe_customer_id")
        if not customer_id:
            return []
        try:
            res = self._stripe.v1.invoices.list(
                params={"customer": customer_id, "limit": max(1, min(limit, 100))}
            )
        except _StripeError as exc:
            # Verwaiste ID → keine Rechnungen, kein Fehler (s. get_billing_address).
            if getattr(exc, "code", None) == "resource_missing":
                return []
            raise self._stripe_err(exc) from exc
        zeilen: list[InvoiceRow] = []
        for inv in _f(res, "data") or []:
            erstellt = _f(inv, "created")
            zeilen.append(
                InvoiceRow(
                    id=_f(inv, "id"),
                    number=_f(inv, "number"),
                    description=self._invoice_description(inv),
                    created=datetime.fromtimestamp(
                        int(erstellt or 0), tz=UTC
                    ).date().isoformat(),
                    # Stripe liefert Cent (kleinste Einheit) → in die Anzeige-
                    # Einheit umrechnen, die Währung kommt mit (kein €-Hardcode).
                    total=int(_f(inv, "total", 0) or 0) / 100,
                    currency=(_f(inv, "currency") or "").upper(),
                    status=_f(inv, "status"),
                    pdf_url=_f(inv, "invoice_pdf"),
                )
            )
        return zeilen

    @staticmethod
    def _invoice_description(inv: Any) -> str | None:  # noqa: ANN401
        """Sprechende Zeile für die Tabelle: die erste Position der Rechnung."""
        zeilen = _f(_f(inv, "lines") or {}, "data") or []
        if not zeilen:
            return _f(inv, "description")
        return _f(zeilen[0], "description") or _f(inv, "description")

    # -- Modul-Entitlement (serverseitig, Wurzel 3) -------------------------
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
