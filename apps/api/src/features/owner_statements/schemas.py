"""Pydantic-Schemas für den owner_statements-Slice (Owner-Statements + Expenses).

Spiegelt die Hostaway-„Owner Statements": Kopf-Snapshot (PM + Owner), Filter,
Summen, Rental activity (per reservation/listing) und Expenses & Extras.
"""
from datetime import date as date_
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

from src.features.reservations.schemas import ReservationStatus


def _status_werte_pruefen(werte: list[str] | None) -> list[str] | None:
    """Nur Werte des DB-Enums `reservation_status` durchlassen.

    Ein fremder Wert („checked_in") ist bis Postgres eine harmlose Zeichen-
    kette und wird dort zum 22P02 — beim LESEN der Abrechnung, als 500, für
    jeden, der den Beleg öffnet (live 07.09.2026: Demo-Abrechnung mit
    `checked_in`/`checked_out`, Beleg im Portal und in der App tot). Hier
    stirbt er als 422 mit Klartext, bevor er gespeichert ist (Wurzel 5/8).
    """
    if werte is None:
        return None
    gueltig = {s.value for s in ReservationStatus}
    fremd = [w for w in werte if w not in gueltig]
    if fremd:
        msg = (
            f"Unbekannter Reservierungsstatus: {', '.join(fremd)}. "
            f"Erlaubt: {', '.join(sorted(gueltig))}."
        )
        raise ValueError(msg)
    return werte


class StatementBasis(StrEnum):
    check_in = "check_in"
    check_out = "check_out"


class StatementStatus(StrEnum):
    draft = "draft"
    finalized = "finalized"
    cancelled = "cancelled"


class SortKey(StrEnum):
    """Sortierspalte der Buchungszeilen (0604) — deckungsgleich mit dem
    DB-CHECK `owner_statements_sort_key_check`. Die Namen sind die Spalten der
    Buchungstabelle, damit Vorschau und Beleg dieselbe Sprache sprechen."""

    check_in = "check_in"
    check_out = "check_out"
    property = "property"
    guest = "guest"
    channel = "channel"
    gross = "gross"
    owner_payout = "owner_payout"


class SortDir(StrEnum):
    asc = "asc"
    desc = "desc"


class ColumnKey(StrEnum):
    """Spalten der Buchungstabelle (0605) — deckungsgleich mit dem DB-CHECK
    `owner_statements_column_order_check` und den Frontend-Schlüsseln. Die
    Reihenfolge dieser Liste ist zugleich die STANDARD-Reihenfolge."""

    guest = "guest"
    listing = "listing"
    check_in = "check_in"
    check_out = "check_out"
    nights = "nights"
    channel = "channel"
    gross = "gross"
    portal = "portal"
    commission = "commission"
    flat_fee = "flat_fee"
    owner_payout = "owner_payout"


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


class GebuehrZeile(BaseModel):
    """EINE Gebühr oder Zusatzleistung einer Buchung — als eigener Posten.

    Anlass (Betrieb, 02.09.2026): *„Jede Gebühr muss als einzelner Posten
    aufgeschlüsselt werden auf der Abrechnung."* Vorher stand in der Zeile
    nur die Summe `gebuehren_an_eigentuemer`; „Gebühren +725,00" ließ
    niemanden erkennen, ob Resort 225 und Nebenkosten 500 darin stecken.

    `art` ist der interne Schlüssel (`cleaning_fee`, `resort`, `pet_fee`,
    `addon` …), `label` der Text für den Beleg — bei Portal-Gebühren der
    Originaltext des Portals (`GebuehrenBefund.bezeichnungen`), damit der
    Betrieb den Posten im Extranet wiederfindet, sonst der Katalogname
    (`FEE_TYPE_LABEL`), bei Zusatzleistungen der Name der Leistung.

    `betrag` ist `None`, wenn die Rolle ihn nicht sehen darf (§4.2): die
    Gebühren des BETRIEBS (Reinigung) sind Teil seines Verkaufspreises und
    laufen durch dieselbe Maske wie `total_price`. Der Eigentümer sieht die
    Zeile dann mit Label und Zuordnung, aber ohne Zahl — nie eine 0.

    `menge`/`einzelpreis`/`basis` sind nur bei Zusatzleistungen gesetzt
    (`reservation_addons.qty/price/basis`); Portal- und Stammdaten-Gebühren
    kommen als Gesamtbetrag ohne Stückzahl.
    """

    art: str
    label: str
    betrag: float | None
    gehoert_zu: str  # betrieb | eigentuemer | durchlauf
    provisionspflichtig: bool
    quelle: str  # ota | stammdaten | addon
    menge: int | None = None
    einzelpreis: float | None = None
    basis: str | None = None


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
    # DIE KETTE zum Auszahlungsbetrag. `common.Auszahlung` rechnet elf Werte
    # aus, hiervon kamen bis 20.08.2026 nur `netto` und `brutto` an — die
    # uebrigen neun wurden in `_rental_rows` verworfen. Die Folge war kein
    # Rechenfehler, sondern ein unbelegbarer Endbetrag: die Betreiberin fand
    # die vertraglich hinterlegte Pauschale in der Abrechnung nicht und legte
    # sie als Ausgabe NOCH EINMAL an (zwei Posten "Indflytning-gebyr" à 50 DKK,
    # live gefunden) — der Eigentuemerin wurden 100 DKK doppelt abgezogen.
    # Der Klassenkommentar von `Auszahlung` verlangt genau diese Felder:
    # "jede Zwischenzeile ist ein Wert, den die Abrechnung dem Eigentuemer
    # zeigen muss".
    #
    # Alle in QUELLWAEHRUNG wie die uebrigen Betraege der Zeile. `None` heisst
    # "nicht berechenbar" oder "fuer diese Rolle nicht sichtbar" — nie 0
    # (Wurzel 4).
    #
    # `portal_provision` und `bemessungsgrundlage` sind BETRIEBSzahlen: sie
    # legen offen, was das Portal einbehaelt. Sie laufen deshalb durch
    # `mask.amount` wie `total_price`; ein Eigentuemer sieht sie nicht (§4.2),
    # er sieht seine eigene Kette ab `verwaltungsprovision`.
    portal_provision: float | None = None
    bemessungsgrundlage: float | None = None
    verwaltungsprovision: float | None = None
    pauschale: float | None = None
    gebuehren_an_eigentuemer: float | None = None
    # Maschinenlesbar, WARUM die Auszahlung dieser Zeile fehlt: "provision"
    # (kein Vertrag, kein Altsatz), "provision_zeitraum" (Vertrag beginnt erst
    # nach der Abreise, siehe `vertrag_beginnt_am`), "portal_abzug", … Der Name
    # folgt `PayoutUnbekannt.grund`, damit neue Gründe ohne zweite Namenswelt
    # dazukommen können.
    payout_unbekannt: str | None = None
    # WELCHE Sache konkret fehlt — der Klartext aus `PayoutUnbekannt.message`,
    # z. B. „Die Gebührenart „resort" ist nicht zugeordnet".
    #
    # Der Grund allein sagt nur die KLASSE des Mangels. Bei
    # `gebuehr_nicht_zugeordnet` gibt es 49 Gebührenarten; die Meldung „mindestens
    # eine Gebührenart ist nicht zugeordnet" schickt den Betrieb in die
    # Abrechnungsregeln, wo er selbst suchen muss, welche gemeint ist. Der Server
    # WEISS es an jeder Wurfstelle (`gebuehren_quelle.py`) — bis 03.09.2026
    # landete der Text nur im Log, während die Oberfläche ihn nicht bekam.
    #
    # Bewusst der Server-Klartext und KEIN i18n-Key: die Werte sind
    # Datenbezeichner aus Portal-Feeds und Stammdaten („Rengøringsgebyr",
    # „RESORTFEE"), keine feste Aufzählung. Ein Katalog dafür wäre am Tag der
    # ersten unbekannten Art unvollständig, und die UI zeigte dann
    # `MISSING_MESSAGE`. Der übersetzte Satz bleibt in `payout_unbekannt`; das
    # Detail ergänzt ihn.
    payout_unbekannt_detail: str | None = None
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
    # `portal_meldet_keine` | `kein_payload` | `csv_import`). Siehe
    # `gebuehren_quelle._stammdaten_grund` bzw. `_ist_csv_portalbuchung` —
    # nur `portal_meldet_keine` ist überhaupt behebbar, die Importe sind es
    # nicht.
    gebuehren_grund: str | None = None
    # --- Seit 02.09.2026: jede Gebühr ein eigener Posten -------------------
    # An- und Abreise der Buchung (Kalendertage, `date`-Spalten der
    # Reservierung — Termin des Gastes, nicht unsere Uhr, Wurzel 5b).
    check_in: date_ | None = None
    check_out: date_ | None = None
    # Echter Portalname (`reservations.ota_name`, 0031), z. B. "Booking.com";
    # `channel` bleibt der Schlüssel für Farbe/Filter.
    ota_name: str | None = None
    # Die Gebühren und Zusatzleistungen EINZELN — siehe `GebuehrZeile`.
    gebuehren: list[GebuehrZeile] = Field(default_factory=list)
    # Kontrollsummen zur Liste: Σ der Betriebs- bzw. Durchlauf-Gebühren.
    # `gebuehren_an_eigentuemer` (oben) ist die dritte. Die Anzeige rechnet
    # NIE selbst aus der Liste; ein Test erzwingt Σ Liste == Kontrollsumme.
    # Betriebsgebühren maskiert wie `total_price` (§4.2).
    gebuehren_betrieb: float | None = None
    gebuehren_durchlauf: float | None = None
    # Zusatzleistungen der Buchung (Kontrollsumme der `addon`-Zeilen). Sie
    # gehören dem BETRIEB (Entscheidung 02.09.2026) und sind deshalb wie
    # `gebuehren_betrieb` maskiert.
    addon_total: float | None = None
    # Was das Portal zusätzlich zur Provision einbehält (Booking: 1,5 %
    # Zahlungsgebühr). Betriebszahl, maskiert wie `portal_provision`.
    portal_zahlungsgebuehr: float | None = None
    # Gastpreis − Portal-Abzug = was vom Portal beim Betrieb ankommt. Der
    # Beleg zeigt diese Zwischensumme als eigene Zeile; sie kommt vom Server,
    # damit die Anzeige nicht selbst subtrahiert. Maskiert wie `total_price`.
    auszahlungsbasis: float | None = None
    # Der Satz, mit dem DIESE Zeile gerechnet wurde, und woher er stammt.
    # `commission_pct` am Kopf ist bei gemischten Objektverträgen nur der
    # gewichtete Wert und taugt nicht als Beleg für eine einzelne Buchung.
    provisions_pct: float | None = None
    provision_quelle: str | None = None  # vertrag | override | altspalten
    vertrag_gueltig_ab: date_ | None = None
    # NUR bei `payout_unbekannt == "provision_zeitraum"`: am Abreisetag galt
    # kein Abrechnungsvertrag, der nächste beginnt erst an diesem Tag. Live
    # 02.09.2026: Vertrag ab 12.08., Abreise 09.08. — die Meldung lautete
    # „kein Provisionssatz hinterlegt", und der Betrieb suchte in den
    # Stammdaten, wo nichts fehlte. Mit dem Datum zeigt die Zeile auf den
    # Handgriff: Vertragsbeginn zurückdatieren.
    vertrag_beginnt_am: date_ | None = None
    # Hat die Mindestprovision des Vertrags gegriffen? Dann ist
    # `verwaltungsprovision` NICHT `bemessungsgrundlage × Satz`, und der
    # Beleg muss das sagen, sonst sieht der Posten wie ein Rechenfehler aus.
    min_provision_angewandt: bool = False
    # Miteigentumsanteil dieses Eigentümers am Objekt (0601). 100 = allein.
    # Steht in der Zeile und nicht nur im Kopf, weil er je OBJEKT gilt: bei
    # drei Häusern kann er dreimal verschieden sein, und dann wäre eine Zahl
    # im Kopf für zwei davon falsch.
    ownership_share: float | None = None


class Miteigentuemer(BaseModel):
    """Ein weiterer Eigentümer desselben Objekts (0601, ADR-0028).

    Reine AUSKUNFT für Vorschau und Beleg: „dieses Haus teilst du mit …".
    Ohne diese Angabe steht auf der Abrechnung ein Anteil von 60 %, und
    niemand kann sehen, wem die anderen 40 % gehören — die Zahl wäre dann
    nachvollziehbar falsch, aber nicht überprüfbar.
    """

    listing_id: str
    listing: str | None = None
    name: str
    anteil: float


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
    # --- Je-Objekt-Summen (13.3, 07.09.2026) ------------------------------------
    # Anlass: „Der René ist Eigentümer von 3 Objekten … so dass er einmal für
    # alle Objekte die Abrechnung hat und nach Objekten für jedes einzelne."
    # Die Gesamtabrechnung weist deshalb je Objekt aus, was ihm zusteht, und der
    # Beleg kann daraus einen AUSZUG je Objekt rendern — ohne zweite Rechnung
    # (dieselbe Buchung würde sonst zweimal abgerechnet, siehe
    # `_pruefe_ueberschneidung`). Alle Beträge in Owner-Währung.
    # Σ Eigentümer-Anteile der Buchungen dieses Objekts; None, sobald EINE
    # Zeile keinen Satz hat (Wurzel 4 — dieselbe Regel wie in der Summary).
    owner_payout: float | None = None
    # Verrechnungs- und wiederkehrende Posten, die an DIESEM Objekt hängen
    # (`listing_id`/`property_id`). Posten ohne Objektbezug stehen in
    # `StatementResponse.ohne_objekt`, damit die Zeilen zur Gesamtsumme aufgehen.
    expenses_to_owner: float = 0.0
    expenses_from_owner: float = 0.0
    recurring_to_owner: float = 0.0
    recurring_from_owner: float = 0.0
    # owner_payout + Posten dieses Objekts. None wie `owner_payout`.
    payout: float | None = None


class PostenOhneObjekt(BaseModel):
    """Posten der Abrechnung, die an KEINEM Objekt hängen (Eigentümer-Ebene).

    Der Rest zwischen Σ `ListingRow.payout` und `summary.owner_payout`. Steht
    in der Gesamtabrechnung als eigene Zeile „ohne Objektbezug"; ein Auszug je
    Objekt nennt ihn nur als Hinweis — er gehört keinem Objekt.
    """

    expenses_to_owner: float = 0.0
    expenses_from_owner: float = 0.0
    recurring_to_owner: float = 0.0
    recurring_from_owner: float = 0.0


# --- Wiederkehrende Posten (Dauervereinbarung, 0365) -------------------------


class WiederkehrenderPosten(BaseModel):
    """Ein wiederkehrender Posten dieser Abrechnung, ausgerechnet.

    `owner_recurring_items` ist eine Dauervereinbarung („50 DKK je Buchung");
    bis 02.09.2026 wertete nur der Bericht (`owner_reporting`) sie aus, die
    Abrechnung nicht — der Betrieb legte denselben Betrag deshalb als
    Verrechnungsposten NOCH EINMAL an (20.08.2026, doppelt abgezogen).

    `anzahl` gehört zum Ergebnis: „3 × 50,00" ist prüfbar, „150,00" nicht.
    `betrag` ist SIGNIERT (negativ bei `abschnitt='ausgaben'`), `einzelbetrag`
    bleibt positiv wie in der DB.
    """

    item_id: str
    label: str
    abschnitt: str  # unterkunftspreis | gebuehren | ausgaben | andere
    modus: str  # je_buchung | je_nacht | je_zeitraum
    einzelbetrag: float
    anzahl: int
    betrag: float
    currency: str
    property_id: str | None = None


# --- Statement-Kopf (Snapshot PM + Owner) ------------------------------------


class ObjektKurz(BaseModel):
    """Ein Objekt der Abrechnung — Kennung und Titel (0603).

    Die Antwort trägt die Objekte MIT Namen, weil `property_ids` allein für
    Beleg und Liste nichts sagt: „Objekte: FeWo Lille Vidstrup" ist eine
    Auskunft, eine UUID keine. `listing_rows` reicht dafür nicht — dort stehen
    nur Objekte MIT Buchungen im Zeitraum; ein bewusst ausgewähltes Objekt
    ohne Buchung gehört trotzdem in den Kopf.
    """

    id: str
    title: str | None = None


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

    @field_validator("reservation_statuses")
    @classmethod
    def _statuses(cls, v: list[str]) -> list[str]:
        return _status_werte_pruefen(v) or []

    # 0603: Teilmenge der Objekte des Eigentümers. None oder leer = ALLE.
    # Der Service weist jede ID ab, die nicht diesem Eigentümer gehört (422,
    # Wurzel 3/9) — eine Abrechnung über ein fremdes Objekt wäre sonst eine
    # Zahl, die niemandem auffällt.
    property_ids: list[str] | None = None
    # 0604: Sprache des Belegs. None = Kette aus Eigentümer → Betrieb → en.
    language: str | None = Field(default=None, min_length=2, max_length=5)
    sort_key: SortKey = SortKey.check_in
    sort_dir: SortDir = SortDir.asc
    # 0605: None/leer = Standardreihenfolge.
    column_order: list[ColumnKey] | None = None


class StatementUpdate(BaseModel):
    """Kopf-Daten + Provision (Deduct percentage) + Filter/Zeitraum aktualisieren."""

    header: StatementHeader | None = None
    # 13.4: Kopf aus den Stammdaten NEU übernehmen (Eigentümer UND Betrieb).
    # Rechnungsnummer und Notizen bleiben stehen — sie sind Teil DIESES
    # Belegs, nicht der Stammdaten. Ein Knopf statt einer neuen Route: es ist
    # eine Änderung am Entwurf wie jede andere.
    header_aus_stammdaten: bool = False
    commission_pct: float | None = Field(default=None, ge=0, le=100)
    basis: StatementBasis | None = None
    reservation_statuses: list[str] | None = None
    period_from: date_ | None = None
    period_to: date_ | None = None

    @field_validator("reservation_statuses")
    @classmethod
    def _statuses(cls, v: list[str] | None) -> list[str] | None:
        return _status_werte_pruefen(v)

    # 0603: None = unverändert; LEERE Liste = zurück auf „alle Objekte" (in
    # der DB NULL). Eine leere Liste kann nicht „keine Objekte" heißen — der
    # CHECK verbietet das, und eine leere Abrechnung ergäbe keinen Sinn.
    property_ids: list[str] | None = None
    # 0604: im Entwurf änderbar; finalisiert greift die bestehende 409-Regel.
    language: str | None = Field(default=None, min_length=2, max_length=5)
    sort_key: SortKey | None = None
    sort_dir: SortDir | None = None
    # 0605: None = unverändert; LEERE Liste = zurück auf Standard (NULL).
    column_order: list[ColumnKey] | None = None


class StatementFinalizeRequest(BaseModel):
    """Doppelbestätigung vor dem Festschreiben.

    Finalisieren ist unumkehrbar (fortlaufende Rechnungsnummer nach §14 UStG,
    eingefrorene Steuer) UND macht den Beleg für den Eigentümer sichtbar. Ein
    Fehlklick ist damit eine falsche Rechnung beim Eigentümer.

    Bestätigt wird deshalb nicht „ja, wirklich", sondern die ZAHL: der Client
    schickt die Auszahlung zurück, die er dem Nutzer gezeigt hat. Weicht sie vom
    Serverstand ab (Buchung nachgetragen, Verrechnungsposten geändert, Kurs
    aktualisiert), war die Bestätigung für einen anderen Betrag — der Server
    lehnt ab (409). Ein reines Boolean könnte das nicht erkennen.
    """

    # Die dem Nutzer angezeigte Eigentümer-Auszahlung. Fehlt sie, ist die
    # Bestätigung nicht prüfbar → wir lehnen ab (kein „dann halt ohne Prüfung",
    # Wurzel 4/5).
    bestaetigte_auszahlung: float
    # Währung dazu — 13.988,28 DKK ist nicht 13.988,28 EUR (Wurzel 4).
    bestaetigte_waehrung: str = Field(min_length=3, max_length=3)


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
    # Wiederkehrende Posten (0365), beide Richtungen einzeln — PFLICHT ohne
    # Default aus demselben Grund wie die zwei Zeilen darüber: ein Default
    # machte aus „nicht gesetzt" ein plausibles 0,00 (0524).
    recurring_to_owner: float
    recurring_from_owner: float
    # Summe der Vertrags-Pauschalen über alle Zeilen. NUR AUSWEIS: sie steckt
    # bereits in `owner_payout` (je Zeile abgezogen) und darf nicht erneut
    # abgezogen werden. Steht auf dem Beleg, damit die Summe aller Abzüge
    # sichtbar ist — genau das fehlte, als die Betreiberin die Pauschale als
    # Ausgabe ein zweites Mal anlegte. None = nicht berechenbar.
    pauschalen_gesamt: float | None
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
    # Klartext-Detail zum Grund (siehe `StatementRentalRow.payout_unbekannt_detail`)
    # plus die BUCHUNG, an der er hängt. Beides gehört zusammen: die
    # Zusammenfassung nennt bewusst nur EINEN Grund (`_erster_grund`), und ohne
    # den Buchungsbezug sucht der Betrieb ihn in einer Liste von Zeilen, die
    # alle unauffällig aussehen — die betroffene zeigt in ihrer Auszahlungsspalte
    # ja nur „—".
    payout_unbekannt_detail: str | None = None
    # Gast und Anreise der betroffenen Zeile, damit die Meldung auf sie zeigen
    # kann. KEINE ID: die Meldung liest ein Mensch, und eine UUID hilft ihm
    # nicht beim Finden der Zeile in der Tabelle.
    payout_unbekannt_buchung: str | None = None


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
    # Die ANDEREN Eigentümer der abgerechneten Objekte (0601). Leer bei
    # Alleineigentum — dem Normalfall, der dadurch unverändert aussieht.
    miteigentuemer: list[Miteigentuemer] = Field(default_factory=list)
    # 0603: None = alle Objekte des Eigentümers; gesetzt = genau diese.
    property_ids: list[str] | None = None
    # Die Objekte der Abrechnung MIT Titel — alle oder die ausgewählten —
    # für Beleg-Kopf und Liste. Siehe `ObjektKurz`.
    objekte: list[ObjektKurz] = Field(default_factory=list)
    # 0604: immer gesetzt (Kette endet in `en`), auch für Belege von vor 0604.
    language: str
    sort_key: SortKey = SortKey.check_in
    sort_dir: SortDir = SortDir.asc
    # 0605: immer vollständig — Standard, wenn nichts gespeichert. Editor,
    # Vorschau und PDF lesen dieselbe Liste.
    column_order: list[ColumnKey] = Field(default_factory=lambda: list(ColumnKey))
    rental_rows: list[RentalRow] = Field(default_factory=list)
    # Je Objekt der Abrechnung EINE Zeile — auch ohne Buchung im Zeitraum, damit
    # der Auszug je Objekt für jedes Objekt existiert (13.3).
    listing_rows: list[ListingRow] = Field(default_factory=list)
    ohne_objekt: PostenOhneObjekt = Field(default_factory=PostenOhneObjekt)
    expenses: list[ExpenseResponse] = Field(default_factory=list)
    # Wiederkehrende Posten des Eigentümers, ausgerechnet für diesen Zeitraum.
    # Im Storno-Beleg mit negierten Beträgen — dieselbe Regel wie `expenses`.
    recurring: list[WiederkehrenderPosten] = Field(default_factory=list)
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
    # 0603: None = alle Objekte. Die Liste zeigt „alle Objekte" oder die
    # Anzahl — sonst sähen zwei Abrechnungen desselben Zeitraums (eine je
    # Objekt) aus wie ein Duplikat.
    property_ids: list[str] | None = None
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
