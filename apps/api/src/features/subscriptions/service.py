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

from datetime import UTC, date, datetime
from typing import Any

from postgrest.exceptions import APIError
from stripe import StripeClient
from stripe import StripeError as _StripeError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows

# EU-Länderliste NICHT zweitkopieren — dieselbe Menge entscheidet über
# Reverse-Charge in den Eigentümer-Abrechnungen (Wurzel 4: eine Quelle).
from src.features.owner_statements.tax import EU_COUNTRIES as _EU_LAENDER

from .dynpricing import DynPricingBillingMixin
from .errors import SubscriptionsConfigError, SubscriptionsError, field
from .preisliste import PreislisteMixin
from .provisionsaufstellung import AufstellungMixin
from .provisionsdeckel import ProvisionsdeckelMixin
from .schemas import (
    COMMISSION_RATE_STANDARD,
    GRUNDTARIF_LOOKUP_KEY,
    MODULE_KEYS,
    MODULE_PRICE_LOOKUP,
    BillingAddress,
    CommissionMonth,
    CommissionRow,
    CommissionSummary,
    InvoiceRow,
    ModuleEntitlement,
    SliceHealth,
    SubscriptionStatusResponse,
)

log = get_logger("nextdays.subscriptions")

_ISO_LAND_LAENGE = 2  # ISO-3166-1 alpha-2
_DEZEMBER = 12  # Jahreswechsel beim Einzugstag
# OTA-Kanäle, für die die externe Provision anfällt (dieselbe Menge wie im
# payments-Slice; eigene/portal-Buchungen sind hier NICHT provisionspflichtig —
# die tragen die 8 % Portal-Fee direkt am Charge).
EXTERNAL_CHANNELS = frozenset(
    {"booking", "airbnb", "vrbo", "ota_other"}
)

# `_f` und `SubscriptionsError` leben in errors.py, damit die ausgelagerten
# Abrechnungs-Mixins sie ohne Zirkelbezug importieren können. Hier nur als
# eingeführte Namen weitergereicht (Router und Tests importieren sie von hier).
_f = field


class SubscriptionsService(
    DynPricingBillingMixin,
    ProvisionsdeckelMixin,
    AufstellungMixin,
    PreislisteMixin,
):
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
            # Eigener Typ, damit die Monatsläufe den Betriebsmangel nicht wie
            # einen kaputten Datensatz je Betrieb wegisolieren (siehe
            # SubscriptionsConfigError).
            raise SubscriptionsConfigError(str(exc), status_code=503) from exc

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
            billed_property_count=row.get("reported_property_count"),
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
        property_count: int | None = None,
    ) -> str:
        """Stripe-Checkout-Session für Grund-Abo (+ gewählte Module). Adaptive
        Pricing rechnet in die Käuferwährung um (27 EU).

        quantity des graduated Preises = die Objektzahl, für die gebucht wird.
        ``property_count`` ist der Wunsch des Kunden (Regler auf der Tarifseite)
        und darf ÜBER der aktuell angelegten Zahl liegen — sonst zeigte der
        Checkout einen anderen Betrag als die Tarifseite. Nach unten gewinnt
        immer die tatsächliche Objektzahl: wer 20 Objekte betreibt, kann nicht
        für 1 abschließen (Wurzel 3 — der Client bestimmt den Scope nicht)."""
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
        aktiv = self._active_property_count(db, tenant_id)
        # Grundtarif: quantity = Objektzahl (Stripe rechnet die Staffel selbst).
        # Der Wunsch des Kunden zählt, mindestens aber die tatsächlich aktiven
        # Objekte und mindestens 1 (Tier-1-Flat = Grundgebühr, das 1. Objekt ist
        # laut Preisliste inklusive). Der Webhook zieht die quantity später
        # ohnehin auf die reale Objektzahl nach (_sync_quantity).
        menge = max(property_count or 0, aktiv, 1)
        line_items: list[dict[str, Any]] = [
            {
                "price": self._price_id_by_lookup(GRUNDTARIF_LOOKUP_KEY),
                "quantity": menge,
            }
        ]
        for mk in module_keys:
            line_items.append(
                {
                    "price": self._price_id_by_lookup(MODULE_PRICE_LOOKUP[mk]),
                    "quantity": 1,
                }
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
        """Menge nach OBEN nachziehen, wenn mehr Objekte aktiv sind als bezahlt.

        Die gebuchte Menge ist das, was der Kunde bestellt hat — sie wird hier
        NIE nach unten korrigiert: wer für fünf zahlt und nur eines aktiv hat,
        behält sein Kontingent von fünf. Kleiner buchen geht ausschließlich über
        ``change_quantity`` (bewusste Entscheidung des Kunden).
        """
        row = self._load_row(db, tenant_id)
        count = self._active_property_count(db, tenant_id)
        if not row or not row.get("stripe_subscription_id"):
            # Kein aktives Abo → nur den lokalen Zähler aktualisieren.
            if row:
                db.table("tenant_subscription").update(
                    {"reported_property_count": count}
                ).eq("tenant_id", tenant_id).execute()
            return count
        gebucht = int(row.get("reported_property_count") or 0)
        qty = max(count, gebucht, 1)
        if qty == gebucht:
            return gebucht
        try:
            sub = self._stripe.v1.subscriptions.retrieve(row["stripe_subscription_id"])
            item = self._grundtarif_item(sub)
            if item is None:
                raise SubscriptionsError(
                    "Grundtarif-Position in der Subscription nicht gefunden.",
                    status_code=500,
                )
            if int(_f(item, "quantity", 0) or 0) != qty:
                self._stripe.v1.subscription_items.update(
                    _f(item, "id"),
                    params={"quantity": qty, "proration_behavior": "create_prorations"},
                )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        db.table("tenant_subscription").update(
            {"reported_property_count": qty}
        ).eq("tenant_id", tenant_id).execute()
        return qty

    def change_quantity(self, ctx: AuthContext, *, property_count: int) -> int:
        """Gebuchte Objektzahl ändern — Erweitern sofort, Verkleinern mit Riegel.

        Beim ERWEITERN wird der anteilige Differenzbetrag unmittelbar in
        Rechnung gestellt und eingezogen: der Kunde bekommt sofort ein
        Dokument im Rechnungsverlauf, statt bis zum Monatsende auf einen
        stillen Rechnungsposten zu warten. Beim REDUZIEREN entsteht eine
        Gutschrift — die bleibt auf der nächsten regulären Rechnung, es wäre
        sinnlos, eine Rechnung über einen negativen Betrag zu erzeugen.

        Verkleinern ist nur erlaubt, solange nicht mehr Objekte aktiv sind als
        künftig bezahlt werden — sonst stünden live geschaltete Objekte über
        dem Kontingent (422, Wurzel 1: der Gegenzustand muss mitgepflegt
        werden).
        """
        db, tenant_id = self._require(ctx)
        row = self._load_row(db, tenant_id)
        sub_id = row.get("stripe_subscription_id") if row else None
        if not row or not sub_id:
            raise SubscriptionsError(
                "Es besteht kein aktives Abo, das geändert werden könnte.",
                status_code=422,
            )
        aktiv = self._active_property_count(db, tenant_id)
        if property_count < aktiv:
            raise SubscriptionsError(
                f"Sie haben {aktiv} veröffentlichte Objekte. Bitte zuerst "
                f"Objekte deaktivieren, dann auf {property_count} reduzieren.",
                status_code=422,
            )
        vorher = int(row.get("reported_property_count") or 0)
        try:
            sub = self._stripe.v1.subscriptions.retrieve(sub_id)
            item = self._grundtarif_item(sub)
            if item is None:
                raise SubscriptionsError(
                    "Grundtarif-Position in der Subscription nicht gefunden.",
                    status_code=500,
                )
            if int(_f(item, "quantity", 0) or 0) != property_count:
                self._stripe.v1.subscription_items.update(
                    _f(item, "id"),
                    params={
                        "quantity": property_count,
                        "proration_behavior": "create_prorations",
                    },
                )
            if property_count > vorher and row.get("stripe_customer_id"):
                self._invoice_prorations_now(
                    sub_id,
                    row["stripe_customer_id"],
                    tenant_id,
                    quantity=property_count,
                )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        # Lokal spiegeln, damit das Kontingent sofort greift — der Webhook
        # bestätigt denselben Wert gleich noch einmal (idempotent, Wurzel 2).
        db.table("tenant_subscription").update(
            {"reported_property_count": property_count}
        ).eq("tenant_id", tenant_id).execute()
        log.info(
            "subscription_quantity_changed",
            tenant_id=tenant_id,
            quantity=property_count,
        )
        return property_count

    def _invoice_prorations_now(
        self, sub_id: str, customer_id: str, tenant_id: str, *, quantity: int
    ) -> None:
        """Die offenen Proration-Posten sofort als Rechnung stellen und einziehen.

        Ohne diesen Schritt bliebe die Erweiterung ein unsichtbarer Posten bis
        zum Monatsende — der Kunde hätte im Rechnungsverlauf keinen Beleg für
        den Vorgang, obwohl er ihn gerade bezahlt hat.

        Idempotent über einen Schlüssel aus Abo + Zielmenge: Doppelklick oder
        Retry liefern dieselbe Rechnung zurück statt eine zweite zu erzeugen
        (Wurzel 2 — geldbewegende Operation). Gibt es nichts abzurechnen,
        antwortet Stripe mit ``invoice_no_customer_line_items``; das ist kein
        Fehler, sondern der Normalfall bei unveränderter Menge.

        ``finalize`` macht aus dem Entwurf sofort eine echte Rechnung, damit
        sie unmittelbar im Verlauf erscheint; den Einzug übernimmt Stripe
        danach selbst (``auto_advance``).
        """
        schluessel = f"proration:{sub_id}:{quantity}"
        try:
            inv = self._stripe.v1.invoices.create(
                params={
                    "customer": customer_id,
                    "subscription": sub_id,
                    "auto_advance": True,
                },
                options={"idempotency_key": schluessel},
            )
        except _StripeError as exc:
            if getattr(exc, "code", "") == "invoice_no_customer_line_items":
                log.info("proration_invoice_leer", tenant_id=tenant_id)
                return
            raise
        inv_id = _f(inv, "id")
        if _f(inv, "status") == "draft":
            self._stripe.v1.invoices.finalize_invoice(
                inv_id, options={"idempotency_key": f"{schluessel}:final"}
            )
        log.info(
            "proration_invoice_erstellt",
            tenant_id=tenant_id,
            invoice_id=inv_id,
            total=_f(inv, "total"),
        )

    # -- Zusatzmodule am laufenden Abo --------------------------------------
    def add_module(self, ctx: AuthContext, *, module_key: str) -> ModuleEntitlement:
        """Ein Zusatzmodul zu einem BESTEHENDEN Abo hinzufügen.

        Nicht über Checkout: ein zweiter Checkout würde eine zweite Subscription
        anlegen und die Grundgebühr doppelt berechnen (Wurzel 2). Stattdessen
        kommt eine weitere Position an die laufende Subscription.

        Idempotent (Wurzel 2 — Doppelklick, Retry): trägt die Subscription das
        Modul schon, wird die vorhandene Position wiederverwendet und nur der
        lokale Zustand bestätigt, statt eine zweite Position anzulegen.
        """
        if module_key not in MODULE_KEYS:
            raise SubscriptionsError(
                f"Unbekanntes/nicht buchbares Modul: {module_key}", status_code=400
            )
        db, tenant_id = self._require(ctx)
        # Nutzungsabhängige Module (Dynamische Preise 0,5 %) haben KEINE
        # Abo-Position — sie werden nachgelagert über den Ledger fakturiert.
        # Buchen heißt hier: Entitlement setzen, sonst nichts.
        if module_key not in MODULE_PRICE_LOOKUP:
            # Ein laufendes Abo ist trotzdem Pflicht: der Monatslauf stellt das
            # Invoice-Item am Stripe-Kunden des Abos (`bill_pending_dynpricing`
            # → 409 ohne Kunde). Ohne Abo wäre das Modul freigeschaltet, aber
            # die Nutzung nie abrechenbar — genau die stillschweigend erbrachte
            # Leistung, die das Feature-Gate verhindern soll (Wurzel 5).
            row = self._load_row(db, tenant_id)
            if not row or not row.get("stripe_customer_id") or row.get(
                "status"
            ) not in ("active", "trialing", "past_due"):
                raise SubscriptionsError(
                    "Zusatzmodule setzen ein laufendes Abo voraus. Bitte zuerst "
                    "das Abo abschließen.",
                    status_code=422,
                )
            db.table("tenant_module_entitlement").upsert(
                {
                    "tenant_id": tenant_id,
                    "module_key": module_key,
                    "active": True,
                    "active_until": None,
                },
                on_conflict="tenant_id,module_key",
            ).execute()
            log.info("modul_gebucht_nutzungsbasiert",
                     tenant_id=tenant_id, module_key=module_key)
            return ModuleEntitlement(module_key=module_key, active=True)
        row = self._load_row(db, tenant_id)
        sub_id = row.get("stripe_subscription_id") if row else None
        if not row or not sub_id or row.get("status") not in (
            "active",
            "trialing",
            "past_due",
        ):
            raise SubscriptionsError(
                "Zusatzmodule setzen ein laufendes Abo voraus. Bitte zuerst das "
                "Abo abschließen.",
                status_code=422,
            )
        lookup = MODULE_PRICE_LOOKUP[module_key]
        try:
            sub = self._stripe.v1.subscriptions.retrieve(sub_id)
            vorhanden = self._item_by_lookup(sub, lookup)
            if vorhanden is None:
                self._stripe.v1.subscription_items.create(
                    params={
                        "subscription": sub_id,
                        "price": self._price_id_by_lookup(lookup),
                        "quantity": 1,
                        "proration_behavior": "create_prorations",
                    },
                    options={"idempotency_key": f"mod:{tenant_id}:{module_key}"},
                )
                if row.get("stripe_customer_id"):
                    self._invoice_prorations_now(
                        sub_id, row["stripe_customer_id"], tenant_id, quantity=1
                    )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        # Lokal spiegeln, damit das Feature-Gate sofort greift; der Webhook
        # bestätigt denselben Zustand gleich noch einmal (idempotent).
        db.table("tenant_module_entitlement").upsert(
            {
                "tenant_id": tenant_id,
                "module_key": module_key,
                "active": True,
                "active_until": None,
            },
            on_conflict="tenant_id,module_key",
        ).execute()
        log.info("modul_gebucht", tenant_id=tenant_id, module_key=module_key)
        return ModuleEntitlement(module_key=module_key, active=True)

    def remove_module(self, ctx: AuthContext, *, module_key: str) -> ModuleEntitlement:
        """Ein Zusatzmodul kündigen — Zugang bleibt bis Periodenende.

        Die Stripe-Position wird ohne Gutschrift entfernt
        (``proration_behavior='none'``), weil die laufende Periode bereits
        bezahlt ist. Genau deshalb bleibt das Entitlement bis
        ``current_period_end`` gültig (Wurzel 1: zur entfernten Position gehört
        der Gegenzustand „läuft noch bis…"), statt den Zugang sofort zu kappen.
        """
        if module_key not in MODULE_KEYS:
            raise SubscriptionsError(
                f"Unbekanntes Modul: {module_key}", status_code=400
            )
        db, tenant_id = self._require(ctx)
        # Nutzungsabhängig (0,5 %): nichts vorausbezahlt, also endet der Zugang
        # SOFORT — anders als bei den Monatsmodulen, deren Periode schon
        # bezahlt ist. Bereits erfasste Ledger-Zeilen bleiben und werden im
        # nächsten Lauf fakturiert (Leistung wurde erbracht).
        if module_key not in MODULE_PRICE_LOOKUP:
            db.table("tenant_module_entitlement").upsert(
                {
                    "tenant_id": tenant_id,
                    "module_key": module_key,
                    "active": False,
                    "active_until": None,
                },
                on_conflict="tenant_id,module_key",
            ).execute()
            log.info("modul_gekuendigt_nutzungsbasiert",
                     tenant_id=tenant_id, module_key=module_key)
            return ModuleEntitlement(module_key=module_key, active=False)
        row = self._load_row(db, tenant_id)
        sub_id = row.get("stripe_subscription_id") if row else None
        if not row or not sub_id:
            raise SubscriptionsError(
                "Es besteht kein Abo, aus dem ein Modul entfernt werden könnte.",
                status_code=422,
            )
        lookup = MODULE_PRICE_LOOKUP[module_key]
        try:
            sub = self._stripe.v1.subscriptions.retrieve(sub_id)
            item = self._item_by_lookup(sub, lookup)
            if item is not None:
                self._stripe.v1.subscription_items.delete(
                    _f(item, "id"), params={"proration_behavior": "none"}
                )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        bis = row.get("current_period_end")
        db.table("tenant_module_entitlement").upsert(
            {
                "tenant_id": tenant_id,
                "module_key": module_key,
                "active": bool(bis),
                "active_until": bis,
            },
            on_conflict="tenant_id,module_key",
        ).execute()
        log.info(
            "modul_gekuendigt",
            tenant_id=tenant_id,
            module_key=module_key,
            active_until=bis,
        )
        return ModuleEntitlement(
            module_key=module_key, active=bool(bis), active_until=bis
        )

    def _item_by_lookup(
        self, sub: Any, lookup: str  # noqa: ANN401
    ) -> dict[str, Any] | None:
        """Subscription-Position anhand des Preis-lookup_key finden."""
        for it in _f(_f(sub, "items", {}) or {}, "data", []) or []:
            if _f(_f(it, "price", {}) or {}, "lookup_key") == lookup:
                return it
        return None

    def _grundtarif_item(self, sub: Any) -> dict[str, Any] | None:  # noqa: ANN401
        """Die Subscription-Position, die den graduated Grundtarif trägt —
        erkannt am lookup_key des Preises (nicht an Reihenfolge geraten)."""
        items = _f(_f(sub, "items", {}) or {}, "data", []) or []
        for it in items:
            price = _f(it, "price", {}) or {}
            if _f(price, "lookup_key") == GRUNDTARIF_LOOKUP_KEY:
                return it
        return None

    # -- Rechnungsadresse + Rechnungen (Quelle: Stripe) ---------------------
    def get_billing_address(self, ctx: AuthContext) -> BillingAddress:
        """Rechnungsadresse aus dem Stripe-Customer, ergänzt aus dem Betriebsprofil.

        Stripe ist die Quelle der Wahrheit für die Rechnungsstellung und hat
        daher Vorrang. Felder, die dort noch fehlen, werden aus dem im Konto
        gepflegten Betriebsprofil VORGESCHLAGEN — sonst müsste der Betrieb seine
        Anschrift ein zweites Mal eintippen. Existiert noch kein Customer,
        legen wir keinen an: ein Lesezugriff darf keinen Kunden erzeugen
        (Wurzel 2).
        """
        db, tenant_id = self._require(ctx)
        row = self._load_row(db, tenant_id)
        customer_id = (row or {}).get("stripe_customer_id")
        vorschlag = self._address_from_billing_profile(db, tenant_id)
        if not customer_id:
            return vorschlag
        try:
            cus = self._stripe.v1.customers.retrieve(
                customer_id, params={"expand": ["tax_ids"]}
            )
        except _StripeError as exc:
            # Verwaiste ID (gelöschter Kunde, Account-/Key-Wechsel): wie „noch
            # keine Adresse" behandeln statt die Seite mit 400 zu blockieren.
            # Der Schreibpfad legt beim Speichern einen frischen Customer an.
            if getattr(exc, "code", None) == "resource_missing":
                return vorschlag
            raise self._stripe_err(exc) from exc
        return self._merge_address(self._billing_address_from_customer(cus), vorschlag)

    # Felder, bei denen das Betriebsprofil VORRANG hat. Stripes `name` und
    # `email` stammen beim Erstkauf aus dem Tenant (Betriebsname, Entwickler-
    # Adresse) und sind deshalb keine belastbare Personenangabe — stünde Stripe
    # hier vorn, erschiene der Firmenname als „Vorname". Die eigentliche
    # Anschrift (line1, city, …) gewinnt umgekehrt aus Stripe: dort hat der
    # Nutzer sie zuletzt bewusst für die Rechnungsstellung bestätigt.
    _PROFIL_HAT_VORRANG = ("first_name", "last_name", "email")

    @classmethod
    def _merge_address(
        cls, stripe_addr: BillingAddress, vorschlag: BillingAddress
    ) -> BillingAddress:
        """Stripe und Betriebsprofil zusammenführen.

        Grundregel: Stripe gewinnt, leere Felder kommen aus dem Profil. Für
        Personenname und E-Mail gilt das Gegenteil (siehe
        ``_PROFIL_HAT_VORRANG``). ``account_type`` bleibt der Stripe-Wert — er
        entscheidet über die Pflichtfelder im Formular.
        """
        ergaenzt: dict[str, Any] = {}
        for k, v in stripe_addr.model_dump().items():
            if k == "account_type":
                continue
            aus_profil = getattr(vorschlag, k, None)
            if k in cls._PROFIL_HAT_VORRANG:
                ergaenzt[k] = aus_profil or v
            else:
                ergaenzt[k] = v if v not in (None, "") else aus_profil
        ergaenzt["account_type"] = stripe_addr.account_type
        return BillingAddress(**ergaenzt)

    def _address_from_billing_profile(
        self, db: Client, tenant_id: str
    ) -> BillingAddress:
        """Vorbelegung aus dem Betriebsprofil (`tenant_billing_profile`).

        Solange am Stripe-Customer noch keine Rechnungsadresse hängt, stünde im
        Formular alles leer — obwohl der Betrieb seine Anschrift im Konto längst
        gepflegt hat. Diese Daten werden deshalb als VORSCHLAG geladen; sie
        werden erst zu Stripe geschrieben, wenn der Nutzer speichert. Fehlt das
        Profil, bleibt die Adresse leer (nichts erfinden, Wurzel 4).
        """
        rows = (
            db.table("tenant_billing_profile")
            .select(
                "legal_name, company_street, company_house_number, "
                "company_postal_code, company_city, company_country, "
                "company_state, email, vat_id, account_type, "
                "managing_director_first_name, managing_director_last_name"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            return BillingAddress()
        p = rows[0]

        def feld(name: str) -> str | None:
            """Getrimmter Wert oder None — im Profil stehen teils Leerzeichen am
            Ende ("Max "), die sonst auf der Rechnung landen."""
            wert = (p.get(name) or "").strip()
            return wert or None

        # Straße und Hausnummer stehen getrennt, Stripe kennt nur eine Zeile.
        strasse = " ".join(
            t for t in (feld("company_street"), feld("company_house_number")) if t
        )
        typ = "company" if p.get("account_type") == "company" else "individual"
        return BillingAddress(
            first_name=feld("managing_director_first_name"),
            last_name=feld("managing_director_last_name"),
            line1=strasse or None,
            city=feld("company_city"),
            state=feld("company_state"),
            postal_code=feld("company_postal_code"),
            country=feld("company_country"),
            email=feld("email"),
            account_type=typ,
            company_name=feld("legal_name"),
            vat_id=feld("vat_id"),
        )

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
        rate = self.commission_rate()
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
        # Deckel nur zur ANZEIGE. Anders als in bill_pending_commissions darf ein
        # nicht beschaffbarer Kurs die Übersicht nicht kippen — dann bleibt das
        # Feld leer (die UI zeigt keinen Deckel), statt einen geratenen zu nennen.
        cap: float | None = None
        if currency:
            # Offene Zeilen gehören zum LAUFENDEN Monat — deshalb dessen Periode
            # als Kurs-Stichtag, nicht die des letzten Abrechnungslaufs.
            heute = datetime.now(UTC).date()
            try:
                cap = self.cap_for_currency(db, currency, f"{heute:%Y-%m}")
            except SubscriptionsError as exc:
                log.warning("commission_cap_unavailable", error=str(exc))
        return CommissionSummary(
            current_rate=rate,
            pending_total=total,
            pending_count=len(rows),
            currency=currency,
            cap_amount=cap,
            pending_capped=cap is not None and total > cap,
            rows=[CommissionRow(**r) for r in rows],
        )

    def get_commission_months(
        self, ctx: AuthContext, *, limit: int = 24
    ) -> list[CommissionMonth]:
        """Provisionen nach Abrechnungsmonat, neueste zuerst.

        Die Periode kommt aus `period`, sobald fakturiert wurde; bei noch
        offenen Zeilen gibt es die Spalte nicht — dort zählt der Monat der
        Buchungserfassung (`created_at`). Sonst fielen alle offenen Provisionen
        in einen namenlosen Topf, und genau die will der Kunde ja vorab sehen.

        Gemischte Währungen innerhalb eines Monats werden NICHT addiert (das
        wäre ein erfundener Kurs, Wurzel 4) — die Währung ist dann None und die
        UI weist den Monat als uneindeutig aus.
        """
        db, tenant_id = self._require(ctx)
        rows = fetch_all_rows(
            db.table("commission_ledger")
            .select("channel, currency, gross_amount, commission_amount, "
                    "status, period, created_at")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
        )
        gruppen: dict[str, list[dict[str, Any]]] = {}
        for r in rows:
            periode = (r.get("period") or "")[:7] or str(r.get("created_at") or "")[:7]
            if not periode:
                continue  # ohne Datum keine Zuordnung — nicht raten
            gruppen.setdefault(periode, []).append(r)

        monate: list[CommissionMonth] = []
        for periode in sorted(gruppen, reverse=True)[:limit]:
            zeilen = gruppen[periode]
            waehrungen = {z["currency"] for z in zeilen if z.get("currency")}
            zustaende = {z.get("status") for z in zeilen}
            monate.append(
                CommissionMonth(
                    period=periode,
                    charge_date=self._einzugstag(periode),
                    booking_count=len(zeilen),
                    gross_total=round(
                        sum(float(z["gross_amount"]) for z in zeilen), 2
                    ),
                    commission_total=round(
                        sum(float(z["commission_amount"]) for z in zeilen), 2
                    ),
                    currency=waehrungen.pop() if len(waehrungen) == 1 else None,
                    status=(
                        zustaende.pop()
                        if len(zustaende) == 1
                        else "mixed"
                    ),
                )
            )
        return monate

    @staticmethod
    def _einzugstag(periode: str) -> str:
        """1. des Folgemonats — FAKTURIERUNGS-, nicht Belastungstag: dann bucht
        `bill_pending_commissions` das Invoice-Item, eingezogen wird es mit der
        nächsten Abo-Rechnung (Details dort). In der UI deshalb NIE „wird
        eingezogen" — das wäre eine Falschaussage gegenüber dem Kunden."""
        jahr, monat = (int(t) for t in periode.split("-")[:2])
        return (
            f"{jahr + 1}-01-01" if monat == _DEZEMBER else f"{jahr}-{monat + 1:02d}-01"
        )

    @staticmethod
    def commission_rate() -> float:
        """Provisions-Satz (Preisliste): einheitlich 0,5 %, unabhängig von der
        Objektzahl. Bleibt eine eigene Methode, damit der Satz an EINER Stelle
        bestimmt wird (Wurzel 4)."""
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
        erzeugt keine zweite Zeile); SELECT und INSERT liegen nicht in einer
        Transaktion, den Race deckt derselbe Backstop ab (23505 → UPDATE). Nur
        solange die Zeile noch 'pending' ist wird der Betrag nachgezogen (eine
        bereits fakturierte Provision bleibt fix — sonst würde eine nachträgliche
        OTA-Preisänderung eine gestellte Rechnung verfälschen). Nur externe
        Kanäle; eigene/portal ignorieren. Und nur für VERÖFFENTLICHTE Objekte
        (status='active') — ein Entwurf ist nicht im Verkauf."""
        if self._db is None:
            raise SubscriptionsError("Subscriptions-DB nicht verfügbar.", status_code=500)
        db = self._db
        # Kein Provisionsgrund (mehr): eigener/portal-Kanal ODER 0-Umsatz. Eine
        # aus einer FRÜHEREN Revision noch offene Zeile (Kanalwechsel
        # extern→eigen, Betrag per Resync auf 0) muss weg (Gegenzustand,
        # Wurzel 1) — sonst bliebe eine falsche Provision stehen.
        if channel not in EXTERNAL_CHANNELS or gross_amount <= 0:
            self.cancel_commission(tenant_id, reservation_id=reservation_id)
            return
        # Provision NUR für veröffentlichte Objekte (status='active'): ein
        # Entwurf ist nicht im Verkauf — auch dann nicht, wenn über das
        # verknüpfte OTA-Inserat noch Buchungen eingehen. Wird ein Objekt später
        # zurückgezogen, muss eine offene Zeile verschwinden (Wurzel 1) —
        # deshalb derselbe cancel-Pfad wie oben, nicht bloß ein `return`.
        if not self._objekt_veroeffentlicht(db, tenant_id, reservation_id):
            self.cancel_commission(tenant_id, reservation_id=reservation_id)
            return
        if not currency:
            raise SubscriptionsError(
                "Währung der Buchung fehlt — keine Provision ohne Währung.",
                status_code=422,
            )
        rate = self.commission_rate()
        payload = {
            "tenant_id": tenant_id,
            "reservation_id": reservation_id,
            "channel": channel,
            "currency": currency,
            "gross_amount": gross_amount,
            "rate": rate,
            "commission_amount": round(gross_amount * rate, 2),
        }
        if self._provision_nachziehen(db, payload):
            return
        try:
            db.table("commission_ledger").insert(payload).execute()
        except APIError as exc:
            # 23505 = UNIQUE(reservation_id) aus 0118: ein paralleler Aufruf
            # (Doppelklick, move+reprice neben dem OTA-Resync) hat zwischen
            # SELECT und INSERT eingefügt. Der Verlierer darf nicht scheitern,
            # sonst bliebe SEIN Betrag ungeschrieben — zurück in den UPDATE-Pfad.
            if getattr(exc, "code", None) != "23505":
                raise
            if not self._provision_nachziehen(db, payload):
                raise

    @staticmethod
    def _provision_nachziehen(db: Client, payload: dict[str, Any]) -> bool:
        """Bestehende Ledger-Zeile aktualisieren. True = erledigt (Zeile war da),
        False = es gibt keine, der Aufrufer muss einfügen. Nur 'pending' wird
        nachgezogen — eine fakturierte bleibt fix, gilt aber als erledigt. Beide
        Zugriffe sind auf den Tenant gescopet (Wurzel 3: service_role umgeht RLS
        — ein Fremdscope darf auch bei fremder reservation_id nicht greifen)."""
        tenant_id = payload["tenant_id"]
        existing = (
            db.table("commission_ledger")
            .select("id, status")
            .eq("reservation_id", payload["reservation_id"])
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not existing:
            return False
        if existing[0]["status"] == "pending":
            db.table("commission_ledger").update(payload).eq(
                "id", existing[0]["id"]
            ).eq("tenant_id", tenant_id).execute()
        return True

    def _objekt_veroeffentlicht(
        self, db: Client, tenant_id: str, reservation_id: str
    ) -> bool:
        """Gehört diese Reservierung zu einem VERÖFFENTLICHTEN Objekt?

        Veröffentlicht = ``properties.status='active'`` (genau das, was
        ``publish()`` setzt und ``unpublish()`` zurücknimmt). Entwürfe und
        stillgelegte Objekte sind nicht im Verkauf und tragen keine Provision.
        Beide Zugriffe sind auf den Tenant gescopet (Wurzel 3: service_role
        umgeht RLS). Fail-CLOSED (Wurzel 5): fehlt die Reservierung, das Objekt
        oder der Status, wird KEINE Provision erfasst — lieber nichts berechnen
        als einem Betrieb etwas in Rechnung stellen, das wir nicht belegen können.
        """
        res = (
            db.table("reservations")
            .select("property_id")
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        property_id = res[0].get("property_id") if res else None
        if not property_id:
            return False
        prop = (
            db.table("properties")
            .select("status")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return bool(prop) and prop[0].get("status") == "active"

    def cancel_commission(self, tenant_id: str, *, reservation_id: str) -> None:
        """Storno einer OTA-Buchung → offene Provisionszeile entfernen
        (Gegenzustand, Wurzel 1). Eine bereits fakturierte Provision bleibt
        bestehen (die Rechnung wurde gestellt); die wird ggf. separat gutgeschrieben."""
        if self._db is None:
            raise SubscriptionsError("Subscriptions-DB nicht verfügbar.", status_code=500)
        self._db.table("commission_ledger").delete().eq(
            "tenant_id", tenant_id
        ).eq("reservation_id", reservation_id).eq("status", "pending").execute()

    @staticmethod
    def abgelaufene_periode(heute: date) -> str:
        """Die Periode, die am Monatsersten fällig wird = der VORMONAT.

        Am 1. August wird der Juli abgerechnet. Ein eigener Helfer, damit der
        Jahreswechsel (1. Januar → Dezember des Vorjahres) genau eine Stelle hat.
        """
        if heute.month == 1:
            return f"{heute.year - 1}-12"
        return f"{heute.year}-{heute.month - 1:02d}"

    def bill_all_tenants_for_period(self, *, period: str) -> dict[str, int]:
        """Monatslauf über ALLE Betriebe mit offenen Provisionen.

        Fehler eines Betriebs (kein Abo, gemischte Währungen, Stripe-Ausfall)
        dürfen die übrigen NICHT stoppen — sonst blieben bei einem einzigen
        kaputten Datensatz alle anderen unabgerechnet. Deshalb je Tenant
        isoliert; der Zähler `fehler` macht das im Log sichtbar, statt es still
        zu verschlucken (Wurzel 5).

        Idempotent über den deterministischen Stripe-idempotency_key in
        `bill_pending_commissions`: ein zweiter Lauf derselben Periode erzeugt
        KEIN zweites Invoice-Item (Wurzel 2).
        """
        if self._db is None:
            raise SubscriptionsError(
                "Subscriptions-DB nicht verfügbar.", status_code=500
            )
        offene = fetch_all_rows(
            self._db.table("commission_ledger")
            .select("tenant_id")
            .eq("status", "pending")
        )
        tenant_ids = sorted({r["tenant_id"] for r in offene if r.get("tenant_id")})
        bilanz = {"tenants": len(tenant_ids), "abgerechnet": 0, "zeilen": 0, "fehler": 0}
        for tid in tenant_ids:
            try:
                anzahl = self.bill_pending_commissions(tid, period=period)
            except SubscriptionsConfigError:
                # Kein Datensatz-, sondern ein Betriebsmangel: er trifft JEDEN
                # Betrieb gleich. Die Schleife fortzusetzen erzeugte nur N-mal
                # dieselbe Warnung und verdeckte die eine behebbare Ursache —
                # der Aufrufer (Worker) meldet sie stattdessen laut.
                log.error(
                    "commission_billing_nicht_konfiguriert",
                    period=period, offene_tenants=len(tenant_ids),
                )
                raise
            except SubscriptionsError as exc:
                bilanz["fehler"] += 1
                log.warning(
                    "commission_billing_failed",
                    tenant_id=tid, period=period, error=exc.message,
                )
                continue
            if anzahl:
                bilanz["abgerechnet"] += 1
                bilanz["zeilen"] += anzahl
        if tenant_ids:
            log.info("commission_billing_run", period=period, **bilanz)
        return bilanz

    def bill_commissions_for_ctx(self, ctx: AuthContext, *, period: str) -> int:
        """ctx-basierter Einstieg für den API-Endpunkt (Tenant aus dem Token,
        Wurzel 3). Delegiert an die tenant-basierte Abrechnung."""
        _, tenant_id = self._require(ctx)
        return self.bill_pending_commissions(tenant_id, period=period)

    def bill_pending_commissions(self, tenant_id: str, *, period: str) -> int:
        """Monats-Worker: alle 'pending'-Provisionen eines Tenants als EIN
        Stripe-Invoice-Item auf das laufende Abo buchen, dann auf 'invoiced'
        setzen. Die Summe wird beim Monatsdeckel (250 €, in Rechnungswährung
        umgerechnet) gekappt. Idempotent: bereits fakturierte Zeilen (period
        gesetzt) werden nicht erneut berechnet (Wurzel 2). Gibt die Zahl der
        abgerechneten Zeilen zurück. Kein Abo → klar fehlschlagen, nicht still
        verschlucken (Wurzel 5).

        FAKTURIEREN ≠ EINZIEHEN — bewusst so, kein vergessener Schritt: der Lauf
        macht NUR `invoice_items.create`, kein `invoices.create`/`finalize`/`pay`.
        Das Item bleibt offen und läuft mit der NÄCHSTEN Abo-Rechnung mit, erst
        deren Einzug belastet (Erneuerung am 17. → Belastung am 17., nicht am 1.).
        Anders als `_invoice_prorations_now` (create+finalize, sofort), denn eine
        eigene Rechnung am 1. ergäbe zwei Belastungen im Monat. Für die UI:
        `charge_date` ist der Fakturierungstag, „wird eingezogen" wäre falsch."""
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
        # Monatsdeckel (250 €): alles darüber ist 0 %. Bewusst HIER und nicht in
        # record_commission — der Deckel gilt für die PERIODE, nicht je Buchung;
        # die einzelne Ledger-Zeile behält ihren ungekappten Wert, damit
        # nachvollziehbar bleibt, wie viel Provision entstanden wäre.
        gedeckelt = self.cap_for_currency(db, currency, period)
        if total > gedeckelt:
            log.info(
                "commissions_capped", tenant_id=tenant_id, period=period,
                total=total, cap=gedeckelt, currency=currency,
            )
            total = gedeckelt
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
