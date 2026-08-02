"""Schemas für die subscriptions-Domäne (Abo-Billing Tenant → myNextDays).

Preise liegen in Stripe (seed_stripe_prices.py). Die stabilen lookup_keys sind
hier als Konstanten gespiegelt (Quelle der Wahrheit bleibt Stripe) — NICHT die
Beträge, die kommen aus Stripe. Kein €-Hardcode (Wurzel 4).
"""
from __future__ import annotations

from pydantic import BaseModel, Field

# Stabile Stripe-lookup_keys (decken sich mit deploy/billing/seed_stripe_prices.py).
GRUNDTARIF_LOOKUP_KEY = "mnd_grundtarif_month"

# module_key (DB/Entitlement)  ->  Stripe-lookup_key des Preises.
# Modul 4 und 6 haben je zwei Preisvarianten (flat ODER per-unit) — der Kunde
# wählt eine; hier steht die Default-/Flat-Variante. Modul 5 (Jobmarkt) ist
# nachgelagert (2 % Umsatz) und hat KEINEN festen Preis.
MODULE_PRICE_LOOKUP: dict[str, str] = {
    "modul3_buchhaltung": "modul3_flat",
    "modul4_mitarbeiter": "modul4_flat",
    "modul6_hotel": "modul6_flat",
}
MODULE_KEYS = frozenset(
    {"modul3_buchhaltung", "modul4_mitarbeiter", "modul5_jobmarkt", "modul6_hotel"}
)


class SliceHealth(BaseModel):
    status: str
    slice: str = "subscriptions"


class ModuleEntitlement(BaseModel):
    module_key: str
    active: bool
    active_until: str | None = None


class SubscriptionStatusResponse(BaseModel):
    """Ist-Zustand des Abos für die /konto-UI. Beträge NICHT enthalten — die
    zeigt das Frontend aus den Stripe-Preisen (formatCurrency)."""

    has_subscription: bool
    status: str | None = None
    stripe_customer_id: str | None = None
    property_count: int
    # Die Menge, für die der Kunde bezahlt (Regler beim Abschluss). Sie kann
    # über property_count liegen — wer für 5 bucht, aber erst eines angelegt
    # hat, zahlt für 5. None solange kein Abo besteht.
    billed_property_count: int | None = None
    current_period_end: str | None = None
    cancel_at_period_end: bool = False
    modules: list[ModuleEntitlement] = []


class CheckoutSessionRequest(BaseModel):
    """Startet Stripe Checkout für das Grund-Abo (+ optional Module).

    ``property_count`` ist die Objektzahl, für die der Kunde buchen WILL (der
    Regler auf der Tarifseite). Sie kann über der aktuell angelegten Zahl
    liegen: wer 5 Objekte plant, aber erst eines eingetragen hat, soll auch für
    5 abschließen können. Fehlt sie, gilt die tatsächlich aktive Objektzahl.
    Nach unten begrenzt der Server auf die aktiven Objekte — weniger buchen als
    man betreibt, geht nicht (Wurzel 3: Scope serverseitig erzwingen).
    """

    module_keys: list[str] = []
    success_url: str
    cancel_url: str
    property_count: int | None = Field(default=None, ge=1, le=10000)


class CheckoutSessionResponse(BaseModel):
    checkout_url: str


class QuantityChangeRequest(BaseModel):
    """Gebuchte Objektzahl eines bestehenden Abos ändern.

    Erhöhen wird sofort wirksam und anteilig berechnet; Verkleinern lehnt der
    Server ab, solange mehr Objekte veröffentlicht sind als künftig bezahlt
    werden (422).
    """

    property_count: int = Field(ge=1, le=10000)


class QuantityChangeResponse(BaseModel):
    property_count: int


class ModuleToggleRequest(BaseModel):
    module_key: str


class PortalSessionResponse(BaseModel):
    """Stripe Billing-Portal (Zahlungsmethode/Rechnungen verwalten)."""

    portal_url: str


class PriceTier(BaseModel):
    up_to: int | None  # None = unbegrenzt (letzter Tier)
    flat_amount: int | None = None  # Cent
    unit_amount: int | None = None  # Cent


class ModulePrice(BaseModel):
    module_key: str
    lookup_key: str
    unit_amount: int  # Cent
    per_unit_label: str | None = None  # z.B. "Nutzer"/"Zimmer" bei per-seat/room
    # Gestaffelte Module (WhatsApp: Stufe nach Objektzahl, tiers_mode=volume)
    # liefern die Stufen mit, damit die UI die Staffel zeigt statt eines
    # einzelnen Betrags. Bei Flat-Modulen None.
    tiers: list[PriceTier] | None = None


class PricingResponse(BaseModel):
    """Echte Stripe-Beträge für die UI (Wurzel 4: nie im Frontend hardcoden).
    Währung wie in Stripe angelegt (EUR-Anker); Adaptive Pricing rechnet im
    Checkout um. Das Frontend rendert mit formatCurrency."""

    currency: str
    grundtarif_tiers: list[PriceTier]
    modules: list[ModulePrice]


class CommissionRow(BaseModel):
    reservation_id: str
    channel: str
    currency: str
    gross_amount: float
    rate: float
    commission_amount: float
    status: str
    period: str | None = None


class CommissionSummary(BaseModel):
    """Provisions-Übersicht (externe OTA-Buchungen) für die Billing-UI."""

    current_rate: float  # aktueller Satz nach Objektzahl-Staffel
    pending_total: float
    pending_count: int
    currency: str | None = None
    rows: list[CommissionRow] = []


class BillCommissionsResult(BaseModel):
    billed_count: int
    period: str


class BillingAddress(BaseModel):
    """Rechnungsadresse des Betriebs — liegt bei Stripe am Customer (Quelle der
    Wahrheit für die Rechnungsstellung), NICHT doppelt in unserer DB.

    `account_type` unterscheidet Privatperson/Unternehmen: nur bei 'company'
    sind Firmenname und USt-IdNr. relevant (Reverse-Charge innerhalb der EU).
    Land als ISO-3166-1 alpha-2 — kein Klartext, damit Stripe es akzeptiert.
    """

    first_name: str | None = None
    last_name: str | None = None
    line1: str | None = None
    line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None  # ISO-3166-1 alpha-2
    email: str | None = None
    account_type: str = "individual"  # individual | company
    company_name: str | None = None
    vat_id: str | None = None  # z.B. DK44179377


class CommissionMonth(BaseModel):
    """Ein Abrechnungsmonat der Portal-Provisionen (Kundensicht).

    `period` ist YYYY-MM. Die Einzugs-Regel steht in der Preisliste: offene
    Provisionen eines Monats werden am 1. des Folgemonats über die hinterlegte
    Zahlungsmethode eingezogen — deshalb `charge_date`, damit der Kunde das
    Datum nicht selbst ausrechnen muss.

    `status` spiegelt die Ledger-Zeilen: 'pending' = noch nicht fakturiert,
    'invoiced' = als Stripe-Invoice-Item gebucht, 'mixed' = beides (kommt vor,
    wenn im laufenden Monat nachträglich Buchungen eintreffen).
    """

    period: str  # YYYY-MM
    charge_date: str  # ISO-Datum, 1. des Folgemonats
    booking_count: int
    gross_total: float  # Buchungsumsatz der Periode
    commission_total: float
    currency: str | None = None
    status: str  # pending | invoiced | mixed


class InvoiceRow(BaseModel):
    """Eine Rechnung aus Stripe. `total` in der Währung der Rechnung (nicht
    umgerechnet) — die UI rendert mit formatCurrency (Wurzel 4)."""

    id: str
    number: str | None = None
    description: str | None = None
    created: str  # ISO-Datum
    total: float
    currency: str
    status: str | None = None
    pdf_url: str | None = None
