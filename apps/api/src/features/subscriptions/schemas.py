"""Schemas für die subscriptions-Domäne (Abo-Billing Tenant → myNextDays).

Preise liegen in Stripe (seed_stripe_prices.py). Die stabilen lookup_keys sind
hier als Konstanten gespiegelt (Quelle der Wahrheit bleibt Stripe) — NICHT die
Beträge, die kommen aus Stripe. Kein €-Hardcode (Wurzel 4).
"""
from __future__ import annotations

from pydantic import BaseModel, Field

# Stabile Stripe-lookup_keys (decken sich mit deploy/billing/seed_stripe_prices.py).
GRUNDTARIF_LOOKUP_KEY = "mnd_grundtarif_month"

# Laenge der kostenlosen Testphase in Tagen — EINE Quelle fuer den Checkout,
# die Erinnerungsmail und die Anzeige der Restlaufzeit. Der Marketing-Text
# nennt dieselbe Zahl; laeuft sie hier weg, wirbt die Seite mit einer anderen
# Dauer als die Rechnung liefert (Wurzel 4: keine zweite Quelle derselben
# Tatsache). Aenderung wirkt nur auf NEUE Testphasen — laufende behaelt Stripe.
TESTPHASE_TAGE = 14

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
    "modul7_avatar": "modul7_flat",
}
# --- Schloss-Anbieter: je Hersteller ein buchbares Modul (0577) ------------
# Der Betrieb bucht genau den Hersteller, dessen Schlösser er besitzt.
# Entscheidung vom 06.09.2026; vorher war eine geräteweise Gebühr (0574)
# gebaut, die damit stillgelegt ist — sonst zahlte der Kunde doppelt.
#
# DIE KENNUNG IST SEAMS PROVIDER-NAME. Damit ist die Verbindung zwischen
# gebuchtem Modul und dem Provider-Filter im Connect Webview eindeutig: ohne
# gebuchtes Modul erscheint der Hersteller dort nicht. Ein eigener Namensraum
# hätte bedeutet, dass eine Marke bei uns anders heißt als bei Seam.
#
# Die Liste ist mit `web/lib/schloss-anbieter.ts` deckungsgleich zu halten;
# `scripts/i18n/schloss-anbieter-pruefen.mjs` erzwingt das.
SCHLOSS_ANBIETER: tuple[str, ...] = (
    # Endkunden-Schlösser (Seams Kategorie `consumer_smartlocks`)
    "igloohome",
    "nuki",
    "ttlock",
    "yale",
    "august",
    "tedee",
    "schlage",
    "kwikset",
    "lockly",
    "smartthings",
    "akiles",
    "ultraloq",
    "wyze",
    "keyincode",
    "korelock",
    "sifely",
    "dusaw",
    "yacan",
    "thirty_three_lock",
    "dormakaba_oracode",
    # Schlüsselboxen
    "keynest",
    # Zutrittssysteme für Gebäude (Seams `access_control_systems`)
    "salto_ks",
    "salto_space",
    "assa_abloy_vostio",
    "assa_abloy_credential_service",
    "dormakaba_ambiance",
    "dormakaba_community",
    "visionline",
    "hotek",
    "latch",
    "brivo",
    "legic_connect",
)

SCHLOSS_MODUL_PREFIX = "schloss_"


def schloss_modul_key(kennung: str) -> str:
    """Modul-Schlüssel eines Anbieters, wie er im Abo steht."""
    return f"{SCHLOSS_MODUL_PREFIX}{kennung}"


def kennung_aus_schloss_modul(module_key: str) -> str | None:
    """Seam-Kennung aus dem Modul-Schlüssel — oder None, wenn kein Schloss-Modul.

    Die EINE Stelle, die diese Zuordnung kennt. Ohne sie müsste jeder Aufrufer
    das Präfix selbst abschneiden, und beim nächsten Umbau macht es einer
    anders.
    """
    if not module_key.startswith(SCHLOSS_MODUL_PREFIX):
        return None
    kennung = module_key[len(SCHLOSS_MODUL_PREFIX) :]
    return kennung if kennung in SCHLOSS_ANBIETER else None


# Stripe-lookup_key je Anbieter-Modul. Angelegt wird der Preis mit
# `scripts/stripe/schloss-preise-anlegen.py`.
SCHLOSS_PRICE_LOOKUP: dict[str, str] = {
    schloss_modul_key(k): f"schloss_{k}_flat" for k in SCHLOSS_ANBIETER
}

# DIE SCHLOSS-PREISE GEHÖREN IN `MODULE_PRICE_LOOKUP`, nicht daneben.
#
# WARUM DIESE ZEILE ENTSCHEIDEND IST: `add_module` entscheidet AN DIESEM DICT,
# ob eine Stripe-Abo-Position entsteht. Ein Modul, das hier fehlt, gilt als
# „nutzungsabhängig" und wird nachgelagert über den Ledger fakturiert. Für die
# Schloss-Module gibt es diesen Ledger-Pfad aber nicht mehr (die Abrechnung je
# Gerät aus 0574 ist mit 0577 stillgelegt) — sie wären also freigeschaltet und
# NIE berechnet, während die Oberfläche „Abgerechnet wird monatlich" verspricht.
#
# Als getrenntes Dict war genau das der Zustand: `SCHLOSS_PRICE_LOOKUP` wurde
# nur von der Preis-ANZEIGE gelesen, nicht vom Buchen, Kündigen oder Checkout.
# Ein zweites Dict derselben Tatsache ist die Wurzel (Wurzel 4) — deshalb steht
# der Bestand jetzt an EINER Stelle und `SCHLOSS_PRICE_LOOKUP` bleibt nur als
# benannte Teilmenge für die Preisliste.
MODULE_PRICE_LOOKUP.update(SCHLOSS_PRICE_LOOKUP)

MODULE_KEYS = frozenset(
    {
        "modul3_buchhaltung",
        "modul4_mitarbeiter",
        "modul5_jobmarkt",
        "modul6_hotel",
        "modul7_avatar",
        "dynamische_preise",
    }
    | {schloss_modul_key(k) for k in SCHLOSS_ANBIETER}
)

# --- Dynamische Preise: 0,5 % vom Buchungsumsatz (nutzungsabhängig) ---------
# Abgerechnet wird über `dynpricing_ledger` (0277) + monatliches Invoice-Item,
# NICHT über einen Stripe-Billing-Meter: ein Meter ist eine währungslose Zahl
# und würde EUR-, DKK- und GBP-Buchungen zu einer sinnlosen Summe addieren
# (implizit Kurs 1:1). myNextDays verkauft in 24 Ländern → die Währung gehört
# an jede einzelne Zeile (Wurzel 4). Gleiche Mechanik wie die OTA-Provision.
# Externe Provision (Preisliste Abschnitt 2) — einheitlich 0,5 %, unabhängig
# von der Objektzahl; die frühere Staffel (1 % bis 100 Objekte, 0,5 % ab 101)
# ist abgeschafft. Liegt hier bei den übrigen Sätzen, damit sowohl die
# Abrechnung (`service.py`) als auch die Preisliste (`preisliste.py`) DENSELBEN
# Wert lesen und kein Zirkelimport entsteht.
COMMISSION_RATE_STANDARD = 0.005

# Standardsatz der myBestDays-Marktplatz-Provision in Basispunkten (800 = 8 %).
# Quelle der Wahrheit für den EINZELNEN Betrieb bleibt `tenants.platform_fee_bps`
# (Migration 0180, Spalten-Default 800) — dieser Wert ist der öffentlich
# beworbene Standard und MUSS mit dem Spalten-Default übereinstimmen. Genau das
# prüft `tests/test_public_pricing.py` gegen die Migration, damit die Preisseite
# nicht irgendwann einen Satz bewirbt, den das System nicht abrechnet.
MARKETPLACE_FEE_BPS_STANDARD = 800

# --- Schlösser: Preis je verwaltetem Gerät und Monat (0574) ----------------
# FESTGELEGT je Währung, NICHT umgerechnet. Unser Einkauf bei Seam ist in USD
# (5 USD/Gerät/Monat), die Rechnung des Betriebs läuft in seiner Währung. Ein
# aus dem Tageskurs abgeleiteter Preis wäre ein erfundener Wert (Wurzel 4) und
# würde sich monatlich ändern, ohne dass der Kunde etwas davon versteht.
#
# 3,00 EUR ist eine ENTSCHEIDUNG DES BETREIBERS (06.09.2026), nicht aus den
# Kosten abgeleitet: Seam kostet uns 5 USD je Gerät und Monat, also rund
# 4,60 EUR. Die Differenz ist ein bewusster Zuschuss — der Marktvergleich
# (Lodgify 7 USD / 6 EUR, Smoobu 4 EUR) liegt deutlich darüber. Wer diesen
# Wert später ändert, sollte wissen, dass er unter dem Einkauf liegt; die
# bereits erfassten Ledger-Zeilen bleiben davon unberührt (sie tragen ihren
# Betrag als Tatsache).
#
# Die übrigen Währungen sind der EUR-Wert in grober Kaufkraftparität, ebenfalls
# fest — nicht tageskursabhängig.
#
# Eine Währung, die hier FEHLT, führt bewusst dazu, dass keine Gebühr erfasst
# wird (mit ERROR im Log) — lieber eine Gebühr verlieren als einen geschätzten
# Betrag stellen.
SCHLOSS_PREIS_JE_GERAET: dict[str, float] = {
    "EUR": 3.00,
    "DKK": 22.00,
    "SEK": 34.00,
    "NOK": 34.00,
    "PLN": 13.00,
    "CZK": 75.00,
    "CHF": 3.00,
    "GBP": 2.50,
    "USD": 3.50,
}

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


class PublicPricingResponse(BaseModel):
    """Preisliste für die ÖFFENTLICHE Marketing-Preisseite (kein Login).

    Erweitert `PricingResponse` um die Konditionen, die auf der Preisseite
    genannt werden müssen und NICHT in Stripe liegen: die beiden
    Provisionssätze und der Monatsdeckel der Portal-Provision. Ohne sie müsste
    die Marketing-App „8 %"/„0,5 %"/„50 €" selbst hinschreiben — genau der
    Hardcode, den Wurzel 4 verbietet.

    Der Deckel trägt seine Währung mit (EUR-Anker, `COMMISSION_CAP_CURRENCY`):
    ein Betrag ohne Währung wäre in 24 Ländern eine andere Zahl.
    """

    currency: str
    grundtarif_tiers: list[PriceTier]
    modules: list[ModulePrice]
    # Provision des myBestDays-Marktplatzes: wird direkt beim Zahlungseingang
    # als Stripe-application_fee einbehalten (payments-Slice), erscheint also
    # nie im Ledger.
    commission_marketplace_percent: float
    # Provision externer Portale (Booking/Airbnb/Expedia & Co.), nachgelagert
    # über den Ledger fakturiert.
    commission_external_percent: float
    commission_external_cap_amount: float
    commission_external_cap_currency: str


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
    # Monatsdeckel in der Währung der offenen Provisionen (50 €, ggf.
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
    # Der Monatsdeckel und der davon tatsaechlich berechnete Betrag.
    #
    # `commission_total` ist die ENTSTANDENE Provision — bei erreichtem Deckel
    # NICHT die Zahl, die der Betrieb zahlt. Die Tabelle zeigte bis zum
    # 30.08.2026 nur sie, fett, und wies den Deckel in einer Fussnote unter der
    # Tabelle aus; welcher Betrag wirklich faellig wird, stand nirgends. Beide
    # Felder sind optional: der Deckel braucht einen ECB-Kurs (Fremdwaehrung),
    # und ist keiner beschaffbar, bleibt das Feld leer, statt einen Kurs zu
    # raten (Wurzel 4). Bei gemischten Waehrungen im Monat gibt es keine
    # Bezugswaehrung — dann ebenfalls leer.
    cap_amount: float | None = None
    billed_total: float | None = None


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
    # ZWEI verschiedene Zeitpunkte, bewusst getrennt (Wurzel 5b): `erfasst_am`
    # ist UNSERE Verarbeitung (wann die Provisionszeile entstand), `booked_at`
    # der echte Buchungszeitpunkt beim Portal. Beim Bestandsimport liegen sie
    # ein Jahr auseinander — bis 30.08.2026 trug das Feld `booked_at` den
    # Import-Zeitstempel und die Oberfläche schrieb „gebucht am" darüber. Das
    # ist eine Falschaussage, die niemand als Bug erkennt, weil sie plausibel
    # aussieht. `booked_at` ist optional: drei Einlesewege (CSV, Lodgify,
    # manuelles Anlegen) bringen ihn nicht mit — dann bleibt er leer statt auf
    # unsere Uhr zurückzufallen (Wurzel 4).
    erfasst_am: str  # ISO — wann die Provisionszeile bei uns entstand
    booked_at: str | None = None  # ISO — echter Buchungszeitpunkt beim Portal
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
