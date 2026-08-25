"""Pydantic-Schemas für den payments-Slice."""
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class PaymentGateway(StrEnum):
    stripe = "stripe"     # primär
    revolut = "revolut"   # sekundär


class PaymentType(StrEnum):
    deposit = "deposit"
    full = "full"
    refund = "refund"


class ChargeRequest(BaseModel):
    reservation_id: str
    amount: float          # glatter Betrag (ADR-0005), Darstellung gerundet
    currency: str
    type: PaymentType = PaymentType.full


class ChargeResult(BaseModel):
    gateway: PaymentGateway
    gateway_ref: str
    status: str


# --- Gast-Zahlung / Kaution / Refund ---------------------------------------

class BookingPaymentResult(BaseModel):
    """Antwort auf die Intent-Erstellung: client_secret für das Payment Element.

    Das client_secret wird NICHT in der DB gespeichert (nur an den Browser für
    die clientseitige Bestätigung)."""

    client_secret: str
    payment_id: str
    publishable_key: str          # Frontend braucht den Stripe-Public-Key


class PaymentRow(BaseModel):
    """Eine Zahlung (gast-/tenant-sichtbar, ohne Stripe-Internas)."""

    id: str
    reservation_id: str
    amount: float
    currency: str | None = None
    type: PaymentType
    status: str
    gateway: PaymentGateway


class RefundRequest(BaseModel):
    """Teil-/Vollerstattung zu einer bestehenden Zahlung. amount=None = voll."""

    amount: float | None = None


class DepositCaptureRequest(BaseModel):
    """Kaution einziehen (Schaden). amount=None = Vollbetrag der Vorautorisierung."""

    amount: float | None = None


# --- Stripe Connect --------------------------------------------------------

class ConnectAccountCreate(BaseModel):
    """Request: Stripe Custom Account für einen Gastgeber anlegen."""
    email: str
    country: str = "DE"          # ISO-3166-1 Alpha-2 (Standard: Deutschland)
    # tenant_id kommt NICHT aus dem Body (Wurzel 3) — der Service setzt sie aus
    # dem Token. "individual" (Einzelperson) oder "company" (Firma) — bestimmt die Stripe-
    # Pflichtfelder. Default individual (häufigster Fall bei Vermietern).
    business_type: str = "individual"

class ConnectAccountResponse(BaseModel):
    """Response nach Account-Erstellung (Custom: KEIN hosted Onboarding-Link —
    die KYC-Erfassung läuft über die eigene Dashboard-UI)."""
    stripe_account_id: str        # acct_...

class ConnectRequirementError(BaseModel):
    """Ein von Stripe ZURÜCKGEWIESENES Feld samt Begründung im Klartext.

    ``requirements.errors`` ist die einzige Quelle, die sagt WARUM eine Angabe
    nicht zählt (z. B. „The provided address could not be verified"). Ohne sie
    wirkt ein Feld gleichzeitig ausgefüllt und offen."""
    requirement: str
    code: str
    reason: str


class ConnectAccountStatus(BaseModel):
    """Status eines verbundenen Gastgeber-Accounts (für die eigene Onboarding-UI).

    ALLE Requirement-Listen einzeln, nicht zu einer verschmolzen: „jetzt fällig",
    „später fällig" und „in Prüfung" verlangen unterschiedliche Reaktionen, und
    eine zusammengeworfene Liste behauptet Handlungsbedarf, wo keiner ist."""
    stripe_account_id: str
    charges_enabled: bool         # kann Zahlungen empfangen
    payouts_enabled: bool         # kann Auszahlungen erhalten
    details_submitted: bool       # KYC vollständig eingereicht
    requirements: list[str]       # currently_due (leer = jetzt nichts offen)
    past_due: list[str] = []      # überfällig → Account schon gesperrt
    eventually_due: list[str] = []        # später fällig (noch keine Frist)
    pending_verification: list[str] = []  # eingereicht, Stripe prüft
    errors: list[ConnectRequirementError] = []
    current_deadline: int | None = None   # Unix-Sekunden, ab wann gesperrt wird
    disabled_reason: str | None = None  # warum der Account (noch) gesperrt ist


class ConnectAccountUpdate(BaseModel):
    """Geschäfts-/Inhaberdaten an den Custom-Account (eigene Onboarding-UI).
    ``fields`` ist das Stripe-Account-Update (business_profile/company/individual)."""
    fields: dict[str, object]


class ExternalAccountRequest(BaseModel):
    """Auszahlungs-Bankkonto (IBAN) am Custom-Account hinterlegen."""
    iban: str
    account_holder: str
    country: str = "DE"


# --- Zahlungs-Einstellungen (Tab „Zahlungen") ------------------------------

class PaymentSettings(BaseModel):
    """Zahlungs-Einstellungen des Tenants (aus tenant_billing_profile), wie sie
    das Einstellungen-Tab „Zahlungen" bearbeitet. NUR die Zahlungs-relevanten
    Felder — Steuer/Legal-Felder bleiben dem Buchhaltungs-Profil vorbehalten."""

    # Genau ein aktiver Karten-Acquirer ('none' oder 'stripe').
    active_card_gateway: Literal["none", "stripe"] = "none"
    # PayPal-Kanal (parallel). Leer/None = aus.
    paypal_email: str | None = None
    # Manuelle Zahlungen (Überweisung/Bar/POS) aktiv.
    manual_payments_enabled: bool = False

    # Name des Händlers auf der Kartenabrechnung (Stripe statement descriptor).
    merchant_name: str | None = None

    # Verhaltens-Toggles der Kartenzahlung (Gates über die Split-Payment/
    # Kautions/Storno-Logik).
    auto_charge_first_deposit: bool = True      # erste (Sofort-)Anzahlung belasten
    auto_charge_scheduled: bool = True          # alle folgenden geplanten Zahlungen
    auto_refund_on_cancel: bool = True
    auto_preauth_deposits: bool = False
    verify_card_before_booking: bool = False

    # Bankdaten für manuelle Zahlungen (liegen ebenfalls im billing_profile).
    iban: str | None = None
    bic: str | None = None
    bank_name: str | None = None
    account_holder: str | None = None

    # Zahlungshinweis + Standard-Steuersatz. Beide Spalten wurden schon gelesen
    # (Eigentümer-Abrechnung; Platzhalter `{{payment_text}}` und `{{tax_rate}}`
    # in Nachrichten-Vorlagen), aber von KEINEM Weg geschrieben — die
    # Platzhalter blieben deshalb immer leer und legten jede Vorlage still, die
    # sie benutzte („Feld ohne Wert", gefunden am 14.08.2026).
    default_payment_text: str | None = None
    default_tax_rate: float | None = None


class PaymentSettingsResponse(PaymentSettings):
    """Wie PaymentSettings, plus abgeleiteter Stripe-Verbindungsstatus (read-only)
    — damit das Tab die Stripe-Karte („Aktiviert"/„Verbinden") ohne zweiten Call
    rendern kann."""

    stripe_connected: bool = False        # Account vorhanden
    stripe_charges_enabled: bool = False  # kann wirklich Zahlungen empfangen
    # PayPal-Multiparty-Status (abgeleitet, read-only).
    paypal_onboarding_status: str = "not_started"
    paypal_connected: bool = False        # abrechnungsfähig (receivable&&confirmed)


# --- PayPal (Multiparty) ---------------------------------------------------

class PayPalOnboardingRequest(BaseModel):
    """Start des PayPal-Onboardings. return_url = wohin PayPal den Betrieb nach
    dem Verbinden zurückschickt (unsere Dashboard-Seite)."""

    return_url: str


class PayPalOnboardingResponse(BaseModel):
    action_url: str          # dorthin wird der Betrieb umgeleitet


class PayPalOrderResponse(BaseModel):
    order_id: str
    payment_id: str


class PlatformFeeStatus(StrEnum):
    pending = "pending"    # Charge angelegt, noch nicht bestätigt
    charged = "charged"    # Fee erfolgreich einbehalten
    reversed = "reversed"  # (anteilig) zurückgegeben (Storno/Refund)
    failed = "failed"      # Charge fehlgeschlagen, Fee nie geflossen


class PlatformFeeRow(BaseModel):
    """Eine Plattform-Provisionszeile (0182) für die Abrechnungs-Ansicht des
    Marktplatz-Gastgebers. Beträge in Cent (Ganzzahl)."""

    id: str
    reservation_id: str
    fee_bps: int
    gross_amount_cents: int
    fee_amount_cents: int
    reversed_amount_cents: int = 0
    currency: str            # aus der Buchung; nie Default-EUR (Wurzel 4)
    gateway: str = "stripe"
    status: PlatformFeeStatus
    created_at: str


class PlatformFeeSummary(BaseModel):
    """Aggregat für den Marktplatz-Gastgeber: Summe fällige/eingezogene Fees.
    Gemischte Währungen → currency=None (kein Fallback), je-Zeile-Währung in rows."""

    currency: str | None = None
    total_fee_cents: int = 0
    total_reversed_cents: int = 0
    net_fee_cents: int = 0   # total_fee - total_reversed
    rows: list[PlatformFeeRow] = Field(default_factory=list)


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


# --- Diagnose (sichtbares System-/Stripe-Debugging) -------------------------
class DiagnosticCheck(BaseModel):
    """Ein einzelner Health-Check (Redis/DB/Stripe) mit Klartext-Ergebnis."""

    name: str
    ok: bool
    detail: str
    duration_ms: int | None = None


class StripeAccountDiagnostics(BaseModel):
    """Vollständiger, roher Stripe-Connect-Status DIESES Tenants — damit sichtbar
    ist, was Stripe WIRKLICH verlangt (nicht nur eine Ampel)."""

    account_id: str | None = None
    charges_enabled: bool = False
    payouts_enabled: bool = False
    details_submitted: bool = False
    disabled_reason: str | None = None
    currently_due: list[str] = []
    past_due: list[str] = []
    eventually_due: list[str] = []
    pending_verification: list[str] = []
    errors: list[str] = []


class CountryRequirements(BaseModel):
    """Pflicht-/Zusatzfelder pro Land live aus Stripe country_specs."""

    country: str
    individual_minimum: list[str] = []
    individual_additional: list[str] = []
    company_minimum: list[str] = []
    company_additional: list[str] = []


class PaymentsDiagnostics(BaseModel):
    checks: list[DiagnosticCheck]
    stripe_account: StripeAccountDiagnostics | None = None
    country_requirements: CountryRequirements | None = None


class IdentityVerificationRequest(BaseModel):
    """Start der Ausweis-Verifizierung. Das Frontend liefert die return_url zu
    sich selbst (kein Domain-Hardcode im Backend, Wurzel 4) — das Backend prüft
    sie gegen die erlaubten Origins."""

    return_url: str = Field(max_length=500)


class IdentityVerificationResponse(BaseModel):
    """Nur die Stripe-Hosted-URL, auf die das Frontend weiterleitet."""

    url: str


# --- Nachberechnung (0469) ---------------------------------------------------

class NachberechnungCreate(BaseModel):
    """Nachberechnung einer Website-Buchung, die der Gast per Link zahlt.

    `amount` ist ein VORSCHLAG des Clients, nicht die Wahrheit: der Server prüft
    ihn gegen den offenen Betrag der Buchung und lehnt alles darüber ab
    (Wurzel 3). `grund` ist Pflicht — der Betrag steht später in der Mail an den
    Gast, in der Zeitleiste und in der Rechnung, und eine Forderung ohne
    Begründung ist dort nicht nachvollziehbar (dieselbe Regel wie beim
    Addon-Storno, 0397). Freitext, weil die realen Gründe (Verlängerung,
    Zusatzgast, Schaden, Vertragsänderung) nicht abschließend aufzählbar sind.
    """

    amount: float = Field(gt=0)
    grund: str = Field(min_length=3, max_length=500)


class NachberechnungBezahlt(BaseModel):
    """Rücknahme einer manuellen Bezahlt-Markierung (0470).

    Grund ist Pflicht: Der Betrag fällt aus `paid_amount`, aus der Rechnung und
    aus der Eigentümer-Abrechnung heraus — dasselbe Muster wie beim
    Addon-Storno (0397). Freitext, weil die realen Gründe (falsch erfasst,
    Zahlung kam nicht an, Doppelerfassung) nicht abschließend aufzählbar sind.
    """

    grund: str = Field(min_length=3, max_length=500)


class NachberechnungLink(BaseModel):
    """Stripe-Zahlungslink über eine Nachberechnung.

    Beträge in Cent (kleinste Einheit), damit nichts über Float-Rundung
    verloren geht. `application_fee_cents` ist bei Website-Buchungen 0 — sie
    sind provisionsfrei (0380); das Feld steht trotzdem am Beleg, damit der
    historische Satz ablesbar bleibt.
    """

    id: str
    reservation_id: str
    # None bei einer Nachberechnung, die der Betrieb direkt als bezahlt erfasst
    # hat (bar/Überweisung, 0470) — dafür entsteht kein Stripe-Link.
    url: str | None = None
    currency: str
    amount_cents: int
    application_fee_cents: int
    fee_bps: int
    status: str
    grund: str
    # true = der Betrieb hat die Zahlung von Hand bestätigt; false = per Stripe
    # eingegangen. Nur eine manuelle Markierung lässt sich zurücknehmen.
    bezahlt_manuell: bool = False
    paid_at: str | None = None
    created_at: str | None = None
    # `total_amount` der Buchung bei Erstellung. Weicht es vom aktuellen Stand
    # ab, wurde der Buchungsbetrag danach erneut geändert und der Link lautet
    # auf einen veralteten Stand — die Oberfläche warnt dann (Wurzel 1).
    basis_total_amount: float
    betrag_veraltet: bool = False
    # Erstattung (0473). Cent, weil Öre-Beträge (DKK) sonst gerundet anders
    # aussehen als der Betrag, den Stripe zurückgezahlt hat. 0 = nichts
    # erstattet.
    refunded_cents: int = 0
    refunded_at: str | None = None
    refund_reason: str | None = None


class NachberechnungRefund(BaseModel):
    """Grund für die Erstattung einer per Karte bezahlten Nachberechnung (0473).

    Getrennt von `NachberechnungBezahlt`, obwohl das Feld gleich aussieht: Das
    eine korrigiert eine FEHLEINGABE (kein Geld geflossen, Beleg wird gelöscht),
    das andere ist eine echte GELDBEWEGUNG (Beleg bleibt, Erstattungszeile kommt
    dazu). Ein gemeinsames Schema hätte die beiden Wege optisch gleichgesetzt —
    und sie sind buchhalterisch das Gegenteil voneinander.

    Kein Betragsfeld: Der Gast bekommt immer 100 % dessen, was er gezahlt hat
    (Entscheidung vom 25.08.2026). Ein Client-Betrag wäre eine zweite Wahrheit
    über eine Geldbewegung (Wurzel 3).
    """

    grund: str = Field(min_length=3, max_length=500)


class NachberechnungStatus(BaseModel):
    """Was die Buchungsansicht über die Nachberechnung wissen muss — in EINEM
    Aufruf, damit die Oberfläche den Knopf nicht aus drei Quellen zusammenrät.

    `moeglich=False` heißt: für diese Buchung gibt es diesen Weg nicht (falscher
    Kanal, storniert, nichts offen). `hinweis` benennt den Grund im Klartext,
    statt den Knopf ohne Erklärung auszugrauen.
    """

    moeglich: bool
    hinweis: str | None = None
    currency: str
    # Offener Betrag der Buchung (total − bezahlt). None = nicht bestimmbar.
    offen_amount: float | None = None
    # Vorbelegung: die Differenz aus der letzten Preis-Neuberechnung. None,
    # wenn sie sich nicht belegen lässt (Altbestand ohne `previous_total` am
    # Ereignis) — dann bleibt das Feld leer, statt eine Zahl zu erfinden
    # (Wurzel 4).
    vorschlag_amount: float | None = None
    link: NachberechnungLink | None = None
    # Bereits bezahlte Nachberechnungen dieser Buchung, neueste zuerst. Ohne sie
    # verschwand nach der Zahlung jede Spur aus der Buchungsansicht: sichtbar
    # blieb allein ein gestiegenes `paid_amount`, dem niemand ansieht, wofür es
    # gestiegen ist.
    bezahlt: list[NachberechnungLink] = []
