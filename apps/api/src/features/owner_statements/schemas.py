"""Pydantic-Schemas für den owner_statements-Slice (Owner-Statements + Expenses).

Spiegelt die Hostaway-„Owner Statements": Kopf-Snapshot (PM + Owner), Filter,
Summen, Rental activity (per reservation/listing) und Expenses & Extras.
"""
from datetime import date as date_
from enum import StrEnum

from pydantic import BaseModel, Field


class StatementBasis(StrEnum):
    check_in = "check_in"
    check_out = "check_out"


class StatementStatus(StrEnum):
    draft = "draft"
    finalized = "finalized"
    cancelled = "cancelled"


class StatementKind(StrEnum):
    invoice = "invoice"
    cancellation = "cancellation"


class TaxBreakdown(BaseModel):
    """EN-16931-Steueraufschlüsselung (BG-23) — eingefroren bei Finalisierung."""

    category: str = "S"  # EN BT-118: S | AE | E | Z
    rate: float = 0
    net: float = 0
    tax: float = 0
    gross: float = 0
    exemption_reason: str | None = None


# --- Verrechnungsposten (Expenses & Extras) ----------------------------------


class ExpenseDirection(StrEnum):
    """Richtung eines Verrechnungspostens — die Fachfrage, nicht ein Vorzeichen.

    ``to_owner``   zugunsten des Eigentümers: er bekommt zusätzlich etwas
                   ausgezahlt (z. B. Schadenskompensation).
    ``from_owner`` zulasten des Eigentümers: der Betrieb verrechnet etwas
                   gegen ihn (z. B. Material/Arbeitszeit — Glühbirnen).

    Der Betrag bleibt in BEIDEN Fällen positiv. Vorher hing die Richtung an
    einem Minuszeichen in ``amount``, das beim Eintippen still verlorenging.
    """

    to_owner = "to_owner"
    from_owner = "from_owner"


class ExpenseBase(BaseModel):
    concept: str = Field(min_length=1, max_length=300)
    date: date_
    direction: ExpenseDirection
    category: str | None = None
    listing_id: str | None = None
    reservation_id: str | None = None
    owner_id: str | None = None
    # Immer POSITIV — die Richtung steht in `direction`. `gt=0` statt `ge=0`:
    # ein Posten über 0,00 ist keine Verrechnung, sondern ein Eingabefehler.
    amount: float = Field(gt=0)
    # Währung des Postens (ISO-4217). Optional in der Anfrage: fehlt sie, leitet
    # der Service sie aus Objekt/Eigentümer/Tenant ab und meldet 422, wenn auch
    # das nichts hergibt — nie ein erfundenes "EUR" (Wurzel 4).
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    attachment_url: str | None = None
    hidden_from_owner: bool = False


class ExpenseCreate(ExpenseBase):
    statement_id: str | None = None


class ExpenseUpdate(BaseModel):
    concept: str | None = Field(default=None, min_length=1, max_length=300)
    date: date_ | None = None
    direction: ExpenseDirection | None = None
    category: str | None = None
    listing_id: str | None = None
    reservation_id: str | None = None
    owner_id: str | None = None
    amount: float | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    attachment_url: str | None = None
    hidden_from_owner: bool | None = None


class ExpenseResponse(ExpenseBase):
    id: str
    tenant_id: str
    statement_id: str | None = None
    # Vorzeichenbehafteter Wirkbetrag für die Anzeige/Summe: +amount bei
    # `to_owner`, −amount bei `from_owner`. EINE abgeleitete Zahl an EINER
    # Stelle — sonst rechnete jede Anzeigestelle das Vorzeichen neu.
    signed_amount: float
    # Nachvollziehbarkeit: wer hat den Posten wann angelegt.
    created_by: str | None = None
    created_by_name: str | None = None
    # Beleg im privaten Bucket (Download nur über signierte URL).
    file_name: str | None = None
    has_receipt: bool = False
    created_at: str | None = None
    updated_at: str | None = None


class ExpenseReceiptUrlResponse(BaseModel):
    """Zeitlich begrenzte, signierte Download-URL für den Beleg."""

    url: str
    expires_in: int


# --- Rental activity ---------------------------------------------------------


class RentalRow(BaseModel):
    """Eine Zeile der Rental activity (Per reservation).

    Beträge in der QUELLWÄHRUNG der Buchung (currency). owner_payout ist der
    Buchungssatz = Auszahlung − Provision in Quellwährung. Liegt die Owner-
    Zielwährung anders, trägt owner_payout_converted den in Owner-Währung
    umgerechneten Betrag samt verwendetem Tageskurs (fx_rate) und Stichtag
    (fx_date, Check-out). Bei gleicher Währung bleibt fx_rate = 1.
    """

    reservation_id: str
    guest: str | None = None
    nights: int
    listing_id: str
    listing: str | None = None
    channel: str
    # GAST-Bruttopreis (total_amount + Extras). Läuft durch dieselbe Maske wie
    # `guest`: ein Eigentümer hat keine Betrags-Sicht auf Gastdaten (§4.2) und
    # bekommt `None` — die Zeile zeigt ihm dann „—", nie eine Null. Vorher ging
    # der Wert ungefiltert durch und stand im Abrechnungs-PDF des Eigentümers.
    total_price: float | None = None
    total_payout: float
    currency: str = "EUR"
    # None = für dieses Objekt steht KEIN Provisionssatz fest (weder
    # `owner_properties.commission_override_pct` noch
    # `owners.default_commission_pct`). Bis 09.08.2026 stand hier eine 0.0, die
    # aus dem fehlenden Satz eine Auszahlung von 100 % an den Eigentümer machte
    # — eine Falschaussage über Geld, die plausibel aussah (Wurzel 4). Die UI
    # zeigt „—" und benennt den Grund, statt eine Zahl zu erfinden.
    owner_payout: float | None = None
    owner_payout_converted: float | None = None
    fx_rate: float = 1.0
    fx_date: date_ | None = None
    # Maschinenlesbar, WARUM die Auszahlung dieser Zeile fehlt. Heute nur
    # "provision"; der Name folgt `PayoutUnbekannt.grund`, damit neue Gründe
    # ohne zweite Namenswelt dazukommen können.
    payout_unbekannt: str | None = None
    # WOHER die Gebühren dieser Zeile kommen: "ota" (das Portal hat sie
    # gemeldet — Tatsache), "ota_ohne_aufstellung" (Portal-Buchung, deren
    # Payload keine Aufstellung trägt: es werden KEINE Gebühren angesetzt) oder
    # "stammdaten" (keine Portal-Buchung, die gepflegten Objekt-Gebühren gelten).
    #
    # Ohne diese Angabe ist die häufigste Rückfrage der Buchhaltung nicht
    # beantwortbar: „warum steht bei dieser Buchung keine Reinigung?" Am
    # 11.08.2026 kostete genau diese Frage einen halben Tag Fehlersuche — beim
    # Mapping, beim Tax Set, im eigenen Rechencode — und die Antwort lag im
    # Eingangsweg der Buchung. Die Zeile sagt es künftig selbst.
    gebuehren_quelle: str | None = None
    # Bei "ota_ohne_aufstellung": der Grund (`channex_import` |
    # `portal_meldet_keine` | `kein_payload`). Siehe
    # `gebuehren_quelle._stammdaten_grund` — nur `portal_meldet_keine` ist
    # überhaupt behebbar, die Channex-Importe sind es nicht.
    gebuehren_grund: str | None = None


class ListingRow(BaseModel):
    """Eine Zeile der Rental activity (Per listing, aggregiert)."""

    listing_id: str
    listing: str | None = None
    nights: int
    reservations: int
    # Gast-Bruttopreis je Objekt — dieselbe Maske wie `RentalRow.total_price`.
    # Ohne sie wäre die Objekt-Aggregation das Schlupfloch für genau die Zahl,
    # die die Zeilen-Maske gerade verbirgt.
    total_price: float | None = None
    total_payout: float


# --- Statement-Kopf (Snapshot PM + Owner) ------------------------------------


class StatementHeader(BaseModel):
    pm_name: str | None = None
    pm_email: str | None = None
    pm_phone: str | None = None
    pm_address: str | None = None
    pm_tax_id: str | None = None
    pm_logo_url: str | None = None
    owner_name: str | None = None
    owner_email: str | None = None
    owner_phone: str | None = None
    owner_address: str | None = None
    owner_tax_id: str | None = None
    invoice_number: str | None = None
    notes: str | None = None


# --- Statement: erzeugen / aktualisieren / Antwort ---------------------------


class StatementGenerateRequest(BaseModel):
    """Statement erzeugen: Owner + Zeitraum + Filter. PM/Owner-Kopf wird aus den
    Stammdaten vorbefüllt (überschreibbar per Update)."""

    owner_id: str
    period_from: date_
    period_to: date_
    basis: StatementBasis = StatementBasis.check_in
    reservation_statuses: list[str] = Field(default_factory=list)
    commission_pct: float | None = Field(default=None, ge=0, le=100)


class StatementUpdate(BaseModel):
    """Kopf-Daten + Provision (Deduct percentage) + Filter/Zeitraum aktualisieren."""

    header: StatementHeader | None = None
    commission_pct: float | None = Field(default=None, ge=0, le=100)
    basis: StatementBasis | None = None
    reservation_statuses: list[str] | None = None
    period_from: date_ | None = None
    period_to: date_ | None = None


class CurrencyAmount(BaseModel):
    """Betrag mit Währung — für je-Währung getrennte Summen (keine Mischsumme)."""

    currency: str
    amount: float


class StatementSummary(BaseModel):
    # Gast-Mieteinnahmen (Brutto). Wie `RentalRow.total_price` maskiert: der
    # Eigentümer sieht seine Auszahlung, nicht den Verkaufspreis (§4.2).
    total_price: float | None = None
    total_payout: float
    # Netto-Wirkung aller Verrechnungsposten auf die Auszahlung: Σ(zugunsten) −
    # Σ(zulasten). Negativ heißt „unterm Strich wird abgezogen".
    expenses_total: float
    # Die beiden Richtungen zusätzlich EINZELN, damit die Abrechnung sie
    # getrennt ausweisen kann. Eine Nettozahl allein verbirgt, dass 500 an
    # Kompensation und 500 an Material gegeneinander stehen.
    #
    # PFLICHTFELDER, bewusst OHNE Default: ein Default macht aus „dieser Pfad
    # hat den Wert nicht gesetzt" ein plausibel aussehendes „0,00" (Wurzel 4).
    # Genau daran meldete der Snapshot-Pfad (finalisiert/storniert) beide
    # Richtungen als 0, obwohl Verrechnungsposten vorlagen — im Dokument, das
    # der Eigentümer tatsächlich bekommt. Ohne Default schlägt ein neuer Pfad,
    # der sie vergisst, sofort und laut fehl statt still falsch zu liefern.
    expenses_to_owner: float
    expenses_from_owner: float
    # None = für mindestens ein betroffenes Objekt steht kein Provisionssatz
    # fest, die Auszahlung ist damit nicht berechenbar (`payout_unbekannt`
    # nennt den Grund). Bis 09.08.2026 stand hier zwingend eine Zahl, und ein
    # fehlender Satz kam als volle Auszahlung an den Eigentümer heraus.
    owner_payout: float | None = None
    # Auszahlung der VERWALTUNG (Provisionsanteil der Agentur). Das ist ihr
    # Ertrag, kein Posten des Eigentümers — er läuft durch dieselbe Maske und
    # ist für den Eigentümer `None`. Er stand vorher im PDF, das er selbst aus
    # dem Portal herunterlädt.
    pm_payout: float | None = None
    currency: str
    booking_count: int
    # Owner-Zielwährung (aus Herkunftsland). owner_payout ist in DIESER Währung
    # (Summe der umgerechneten Buchungssätze).
    owner_currency: str = "EUR"
    # Verwaltungs-Auszahlung bleibt in der jeweiligen Quellwährung — je Währung
    # getrennt, da Beträge verschiedener Währungen nicht addiert werden dürfen.
    # Für den Eigentümer LEER (siehe `pm_payout`): sonst stünde derselbe
    # Agentur-Ertrag, nur je Währung aufgeschlüsselt, wieder in seinem PDF.
    pm_payout_by_currency: list[CurrencyAmount] = Field(default_factory=list)
    # Auszahlung je Quellwährung (Anzeige; keine Mischsumme). Das sind
    # Auszahlungs-, keine Gastpreis-Summen und bleiben daher sichtbar.
    totals_by_currency: list[CurrencyAmount] = Field(default_factory=list)
    # Maschinenlesbarer Grund, warum `owner_payout`/`pm_payout` fehlen — heute
    # nur "provision" (kein Satz hinterlegt). Die UI macht daraus den Hinweis,
    # WAS zu tun ist; ohne ihn wäre das „—" eine stumme Lücke (Wurzel 5).
    payout_unbekannt: str | None = None


class StatementResponse(BaseModel):
    id: str
    tenant_id: str
    owner_id: str
    period_from: date_
    period_to: date_
    basis: StatementBasis
    reservation_statuses: list[str]
    status: StatementStatus
    kind: StatementKind = StatementKind.invoice
    # None = kein Provisionssatz vereinbart (weder je Objekt noch als
    # Owner-Standard). Die Maske zeigt dafür „—" und den Hinweis, dass der
    # Satz zu pflegen ist — nie eine erfundene 0 (Wurzel 4).
    commission_pct: float | None = None
    header: StatementHeader
    summary: StatementSummary
    # Beleg-/Steuer-Metadaten (EN 16931) — bei Finalisierung gesetzt.
    invoice_date: date_ | None = None
    due_date: date_ | None = None
    supply_country: str | None = None
    buyer_vat_id: str | None = None
    tax: TaxBreakdown = Field(default_factory=TaxBreakdown)
    # Storno-Verknüpfung.
    cancels_statement_id: str | None = None
    cancelled_by_statement_id: str | None = None
    rental_rows: list[RentalRow] = Field(default_factory=list)
    listing_rows: list[ListingRow] = Field(default_factory=list)
    expenses: list[ExpenseResponse] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class StatementListItem(BaseModel):
    id: str
    owner_id: str
    owner_name: str | None = None
    period_from: date_
    period_to: date_
    status: StatementStatus
    # None = nicht berechenbar (kein Provisionssatz hinterlegt), siehe
    # StatementSummary.owner_payout. Die Liste zeigt dann „—" statt 0,00.
    owner_payout: float | None = None
    # Agentur-Ertrag — für den Eigentümer `None` (siehe StatementSummary).
    pm_payout: float | None = None
    currency: str
    invoice_number: str | None = None
    created_at: str | None = None


class StatementListResponse(BaseModel):
    items: list[StatementListItem]
    total: int


class AutoStatementRunResponse(BaseModel):
    generated: int
    owners: int


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
