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
# „Dynamische Preise" steht bewusst NICHT hier: das Modul hat keinen festen
# Abo-Preis, sondern wird nachgelagert über den Ledger fakturiert (0,5 % vom
# Buchungsumsatz) — wie Modul 5 und die Provisionen. Buchbar ist es trotzdem
# (MODULE_KEYS + Entitlement steuern den Feature-Zugang).
MODULE_PRICE_LOOKUP: dict[str, str] = {
    "modul3_buchhaltung": "modul3_flat",
    "modul4_mitarbeiter": "modul4_flat",
    "modul6_hotel": "modul6_flat",
}
MODULE_KEYS = frozenset(
    {
        "modul3_buchhaltung",
        "modul4_mitarbeiter",
        "modul5_jobmarkt",
        "modul6_hotel",
        "dynamische_preise",
    }
)

# --- Dynamische Preise: 0,5 % vom Buchungsumsatz (nutzungsabhängig) ---------
# Abgerechnet wird über `dynpricing_ledger` (0277) + monatliches Invoice-Item,
# NICHT über einen Stripe-Billing-Meter: ein Meter ist eine währungslose Zahl
# und würde EUR-, DKK- und GBP-Buchungen zu einer sinnlosen Summe addieren
# (implizit Kurs 1:1). myNextDays verkauft in 24 Ländern → die Währung gehört
# an jede einzelne Zeile (Wurzel 4). Gleiche Mechanik wie die OTA-Provision.
DYNPRICING_MODULE_KEY = "dynamische_preise"
DYNPRICING_RATE = 0.005  # 0,5 % als Faktor (wie commission_ledger.rate)


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
    # Nutzungsabhängige Module (Dynamische Preise) haben KEINEN Monatsbetrag,
    # sondern einen Prozentsatz vom Buchungsumsatz. Dann ist unit_amount 0 und
    # die UI zeigt den Satz — kein erfundener Cent-Betrag (Wurzel 4).
    usage_percent: float | None = None


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

    current_rate: float  # einheitlich 0,5 % (keine Objektzahl-Staffel)
    pending_total: float
    pending_count: int
    currency: str | None = None
    # Monatsdeckel in der Währung der offenen Provisionen (250 €, ggf.
    # umgerechnet). None, solange keine offenen Zeilen existieren — dann gibt es
    # keine Währung, in der ein Deckel benannt werden könnte (Wurzel 4: kein
    # EUR-Ersatzwert). `pending_capped` sagt, ob der Deckel schon greift.
    cap_amount: float | None = None
    pending_capped: bool = False
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

    `period` ist YYYY-MM. `charge_date` ist der 1. des Folgemonats — der Tag,
    an dem die offenen Provisionen dieses Monats FAKTURIERT werden (als
    Stripe-Invoice-Item auf den Kunden gebucht, `bill_pending_commissions`).
    Der tatsächliche EINZUG passiert nicht an diesem Tag: das Invoice-Item
    läuft mit der nächsten regulären Abo-Rechnung des Betriebs mit und wird
    erst mit deren Belastung über die hinterlegte Zahlungsmethode gezogen.
    UI-Texte müssen das so benennen („abgerechnet am …, Einzug mit der
    nächsten Abo-Rechnung") — nicht „wird am 1. eingezogen".

    `status` spiegelt die Ledger-Zeilen. Tragen alle Zeilen des Monats
    denselben Wert, ist es GENAU dieser Wert des DB-Enums
    `public.commission_status` (0006): 'pending' = noch nicht fakturiert,
    'invoiced' = als Stripe-Invoice-Item gebucht, 'paid' = bezahlt.
    Sind die Zeilen uneinheitlich, kommt der zusätzliche Sammelwert 'mixed'
    (kommt vor, wenn im laufenden Monat nachträglich Buchungen eintreffen).
    Wer 'paid' vergisst, baut einen Absturz für den ersten vollständig
    bezahlten Monat — genau das ist im Frontend passiert.
    """

    period: str  # YYYY-MM
    charge_date: str  # ISO-Datum, 1. des Folgemonats = Fakturierung, nicht Einzug
    booking_count: int
    gross_total: float  # Buchungsumsatz der Periode
    commission_total: float
    currency: str | None = None
    # Bewusst `str`, nicht Literal: die Werte kommen 1:1 aus dem DB-Enum
    # commission_status. Ein Literal hier würde bei einem künftig ergänzten
    # Enum-Wert einen 500er werfen (ValidationError) statt ihn durchzureichen.
    status: str  # pending | invoiced | paid (Enum) + mixed (uneinheitlicher Monat)


class CommissionEntry(BaseModel):
    """EINE Buchung in der vorläufigen Aufstellung eines Monats.

    Warum die Einzelposten überhaupt herausgehen: die Monatszeile nennt nur
    eine Summe. Ein Betrieb, der prüfen will, WORAUS die Provision entsteht,
    hat sonst keinen Weg dorthin — die Rechnung kommt erst am 1. des
    Folgemonats, und dort steht ebenfalls nur ein Betrag.

    `rate` ist der Satz, mit dem DIESE Zeile gerechnet wurde (dezimal, 0.005 =
    0,5 %), nicht der heutige Tarifsatz: der Ledger friert ihn je Buchung ein,
    und eine spätere Tarifänderung darf die Vergangenheit nicht umschreiben.

    `property_title` und `check_in` kommen über die Reservierung. Beide sind
    optional, weil die Reservierung gelöscht sein kann, während die
    Provisionszeile bleibt (sie ist eine Forderung). Fehlt sie, bleibt das Feld
    leer — kein Ersatztext, der eine Buchung vortäuscht (Wurzel 4).
    """

    id: str
    channel: str
    currency: str | None = None
    gross_amount: float
    rate: float
    commission_amount: float
    status: str
    booked_at: str  # ISO — wann die Provisionszeile entstand
    property_title: str | None = None
    check_in: str | None = None
    check_out: str | None = None
    guest_name: str | None = None


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
