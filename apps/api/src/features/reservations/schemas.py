"""Pydantic-Schemas für den reservations-Slice.

Bildet die reservations- und guests-Tabellen ab. Eine Reservierung belegt
den Zeitraum [check_in, check_out) im Kalender (availability=booked) → der
Double-Booking-Schutz aus dem calendar-Slice greift.
"""
from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class ReservationChannel(StrEnum):
    direct = "direct"
    # Eigene Website des BETRIEBS (dessen eigene Buchungsstrecke, 0380).
    # Getrennt von `direct`, weil „Direkt" auch Telefon/E-Mail/vor Ort umfasst
    # und die Frage „was bringt meine Website?" sonst unbeantwortbar bleibt.
    # Provisionsfrei wie `direct` — steht bewusst NICHT in den Mengen der
    # provisionspflichtigen Kanäle (payments/subscriptions service).
    website = "website"
    portal = "portal"
    booking = "booking"
    airbnb = "airbnb"
    vrbo = "vrbo"
    # Sonstige OTA (Expedia, Agoda, Namensvarianten). Externer Kanal:
    # 0,5 % monatlich, kein Charge über uns (Preisliste §2).
    ota_other = "ota_other"


class ReservationStatus(StrEnum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


class CancelParty(StrEnum):
    """WESSEN Sphäre einen Storno ausgelöst hat (0410).

    Spiegelt `public.cancel_party` 1:1. Der Wert steuert ab Etappe 3, ob die
    8 %-Marktplatz-Provision bei uns bleibt oder zurückgebucht wird — deshalb
    gibt es hier bewusst KEINEN Wert „unbekannt": wer nicht zuordenbar ist,
    wird nicht storniert, und Bestandszeilen bleiben in der DB `null`
    (Wurzel 4/5). `agentur` ist vorgesehen, wird heute aber von keinem
    Storno-Pfad gesetzt: der Co-Gastgeber-Zugang hat keinen Weg zu
    `ReservationsService.cancel` (und keinen eigenen Rollenwert im
    AuthContext).
    """

    gast = "gast"
    eigentuemer = "eigentuemer"
    agentur = "agentur"
    betrieb = "betrieb"
    # „Der Storno kam über das PORTAL zu uns" (OTA-Feed, gesetzt von
    # channel_manager/bookings_sync). NICHT „das Portal hat entschieden" und
    # NICHT „niemanden trifft ein Verschulden": Booking/Airbnb melden nur
    # `cancelled`, nie den Auslöser. Aus diesem Wert eine Schuldfrage abzuleiten
    # hiesse, sie aus einer Information zu ziehen, die es nicht gibt (0412).
    portal = "portal"
    system = "system"


class CancelReasonCode(StrEnum):
    """Kategorie des Storno-Grundes (0410) — ZUSÄTZLICH zum Pflicht-Freitext
    `cancel_reason`, nicht an seiner Stelle. Spiegelt
    `public.cancel_reason_code`."""

    gast_wunsch = "gast_wunsch"
    zahlung_ausgeblieben = "zahlung_ausgeblieben"
    objekt_nicht_verfuegbar = "objekt_nicht_verfuegbar"
    schaden_instandsetzung = "schaden_instandsetzung"
    eigennutzung = "eigennutzung"
    eigennutzung_aufgeloest = "eigennutzung_aufgeloest"
    doppelbuchung = "doppelbuchung"
    verdacht_betrug = "verdacht_betrug"
    portal_storno = "portal_storno"
    system_rollback = "system_rollback"
    sonstiges = "sonstiges"


class GuestBreakdown(BaseModel):
    """Gäste-Aufschlüsselung (Schritt 1)."""

    adults: int = Field(default=1, ge=1)
    children: int = Field(default=0, ge=0)
    infants: int = Field(default=0, ge=0)
    pets: int = Field(default=0, ge=0)


class GuestContact(BaseModel):
    """Kontaktdaten des Hauptgastes."""

    first_name: str = ""
    last_name: str = ""
    email: str = ""
    phone: str = ""
    country: str = ""
    language: str = ""


class ReservationCreate(BaseModel):
    property_id: str
    check_in: date
    check_out: date  # exklusiv (Check-out-Tag ist wieder frei)
    channel: ReservationChannel = ReservationChannel.direct
    source: str = ""  # frei: „Telefon", „Airbnb" …
    guests: GuestBreakdown = GuestBreakdown()
    contact: GuestContact = GuestContact()
    total_amount: float = Field(default=0, ge=0)
    status: ReservationStatus = ReservationStatus.confirmed
    # Optional: bestehenden Gast fest zuordnen (z. B. aus der Gästekarte). Wenn
    # gesetzt UND gültig, wird kein neuer Gast angelegt (keine Dublette).
    guest_id: str | None = None
    # Der gebuchte Rate-Plan (0151). Ein Objekt kann mehrere Pläne haben (BAR/B&B)
    # mit verschiedenen Preisen — der Quote MUSS den gewählten Plan bepreisen.
    # None → der älteste Plan des Objekts als deterministischer Default.
    rate_plan_id: str | None = None
    # Eigentümer-Aufenthalt (0241): sperrt den Kalender wie jede Buchung, ist
    # aber kein Umsatz. Der Service erzwingt Betrag 0 und Status confirmed —
    # ein mitgeschickter total_amount wird bewusst ignoriert, nicht abgelehnt,
    # damit derselbe Anlegen-Weg für beides gilt.
    is_owner_stay: bool = False
    # Der verwaltete Eigentümer (owners, 0063), der den Aufenthalt nutzt —
    # der Personenbezug eines Eigentümer-Aufenthalts (0353). Bei
    # `is_owner_stay=true` tritt er an die Stelle des Gastes: der Eigentümer ist
    # kein Gast und gehört nicht in die Gästekartei (Loyalty-Aggregate,
    # Marketing-Segmente). Der Service prüft die Zugehörigkeit zum Mandanten
    # UND zum Objekt serverseitig (Wurzel 3).
    owner_id: str | None = None
    # Die Einheit, die belegt werden soll (property_units, 0265). None = die RPC
    # wählt die erste freie (0275). Für den Eigentümer-Aufenthalt aus einem
    # Sperrantrag ist es die im Antrag benannte Einheit.
    unit_id: str | None = None
    # WER wirklich da wohnt und WARUM (0354) — nur bei `is_owner_stay`.
    # Eine Eigennutzung ist nicht zwangsläufig der Eigentümer selbst: derselbe
    # Zeitraum geht an seine Kinder, an Freunde oder an einen Handwerker.
    # `owner_id` bleibt der VERTRAGLICHE Bezug (Abrechnung, Kontingent),
    # `stay_name` ist die anwesende Person. Beides steht auf dem Kalenderbalken.
    stay_name: str | None = Field(default=None, max_length=120)
    stay_note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _check_order(self) -> "ReservationCreate":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        return self

    @model_validator(mode="after")
    def _owner_nur_bei_eigennutzung(self) -> "ReservationCreate":
        """Ein Eigentümer an einer GAST-Buchung wäre eine stille Falschaussage.

        `owner_id` bedeutet „diese Belegung ist die Eigennutzung dieser Person"
        und schließt Umsatz aus (0241). Stünde er an einer normalen Buchung,
        träte die Zeile in der Eigentümer-Auswertung als Eigennutzung auf,
        während sie gleichzeitig als Umsatz zählt — zwei Wahrheiten in einer
        Zeile. Fail-closed statt den Wert still zu verwerfen (Wurzel 5).
        """
        if self.owner_id and not self.is_owner_stay:
            msg = "owner_id nur bei is_owner_stay=true"
            raise ValueError(msg)
        if (self.stay_name or self.stay_note) and not self.is_owner_stay:
            # Bei einer Gastbuchung steht der Name am GAST (`contact`) und die
            # Notiz an `source`. Ein zweites Namensfeld daneben ergäbe zwei
            # Wahrheiten über dieselbe Person — welche zeigt der Balken dann?
            msg = "stay_name/stay_note nur bei is_owner_stay=true"
            raise ValueError(msg)
        return self


class ReservationMove(BaseModel):
    """Reservierung verschieben (anderes Objekt/anderer Zeitraum) oder resizen
    (nur Check-in/out). Beides ist ein neues (property_id, check_in, check_out)
    für eine bestehende Reservierung; der Double-Booking-Schutz greift erneut,
    die eigenen alten Tage werden dabei ausgenommen.
    """

    property_id: str
    check_in: date
    check_out: date  # exklusiv
    # Preisverhalten beim Move (protel-Modell „Upsell vs. kostenloses Upgrade"):
    #   None  → Preis UNVERÄNDERT lassen (Default; kostenloses Upgrade / Kulanz /
    #           bereits vereinbarter Preis bleibt bindend — Server ändert nichts).
    #   True  → Preis für das ZIEL-Objekt/den neuen Zeitraum NEU berechnen (Upsell):
    #           der zentrale Resolver quotet neu, total_amount + quote_items werden
    #           ersetzt. Der Beherbergungs-Steuersatz erbt automatisch das Ziel-
    #           Objekt-Land (EU-27, siehe reservation_invoice._property_vat_rate).
    # Bewusste Nutzer-Entscheidung, nie automatisch — der vereinbarte Preis ist
    # sonst bindend (deutsche Rechtslage + protel/Fidelio/Fewo-Verwalter-Praxis).
    reprice: bool | None = None

    @model_validator(mode="after")
    def _check_order(self) -> "ReservationMove":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        return self


class ReservationCancel(BaseModel):
    """Storno mit Pflicht-Begründung (wird dokumentiert/auditiert).

    Die PARTEI kommt bewusst NICHT aus dem Request: sie wird serverseitig aus
    der Rolle des Aufrufers abgeleitet (Wurzel 3 — wer storniert hat, darf der
    Client nicht behaupten, sonst schiebt ein Betrieb seinen eigenen Storno auf
    den Gast und behält die Provision). Der Grund-CODE ist dagegen eine echte
    Angabe des Nutzers und optional; die Pflichtangabe bleibt der Freitext.
    """

    reason: str = Field(min_length=1)
    reason_code: CancelReasonCode | None = None


class RequestDecline(BaseModel):
    """Ablehnung einer Anfrage (Airbnb-Modell). Begründung optional (für den Gast
    sichtbar) — anders als beim Storno kein Pflichtfeld."""

    reason: str | None = Field(default=None, max_length=1000)


class ReservationResponse(BaseModel):
    id: str
    property_id: str
    guest_id: str | None = None
    guest_name: str = ""
    channel: ReservationChannel
    check_in: date
    check_out: date
    status: ReservationStatus
    # None für Rollen ohne VIEW_GUEST_FULL (DSGVO-Daten-Split §4).
    total_amount: float | None = None
    # Bereits bezahlter Betrag (für den Bezahlt-Anteil in der Buchungsliste).
    # Gleiche Maskierung wie total_amount → None ohne Betrags-Sichtbarkeit.
    paid_amount: float | None = None
    currency: str = ""
    ota_name: str | None = None       # echter Portal-Name (Kalender-Herkunft)
    external_ref: str | None = None   # OTA-Reservierungscode
    num_guests: int = 1               # Gästezahl (Balken-Anzeige)
    adults: int = 1                   # Aufschlüsselung (Buchungsliste: Gäste-Icons)
    children: int = 0                 # Kinderzahl (Kinder-Icon nur wenn > 0)
    # Echter Check-in/Check-out-Zustand (0091) — None = noch nicht erfolgt.
    checked_in_at: str | None = None
    checked_out_at: str | None = None
    # Eigentümer-Aufenthalt (0241) — die UI kennzeichnet ihn und blendet
    # Geldangaben aus; es gibt dort keine zu zeigen.
    is_owner_stay: bool = False
    # Freitext zur Eigennutzung (0354). `guest_name` trägt bereits die
    # anwesende Person (siehe `_base.anzeigename`); hier steht der Grund, den
    # der Balken hinter dem Namen zeigt.
    stay_note: str | None = None
    # Wann der Gast WIRKLICH gebucht hat (0291, Wurzel 5b). None = die Quelle
    # hat es nicht geliefert; die UI zeigt dann `created_at` und benennt es als
    # „Eingang bei uns" — niemals unsere Uhr als fremden Buchungszeitpunkt.
    booked_at: str | None = None
    created_at: str | None = None
    # Ablage (0383): gesetzt = aus der Arbeitsliste genommen. Reine Ansichts-
    # Entscheidung — Status, Belegung und Kalenderwirkung bleiben unverändert.
    archived_at: str | None = None


class QuoteItem(BaseModel):
    label: str
    amount: float


class ReservationInvoiceInfo(BaseModel):
    """Aktive Rechnung zur Buchung (Booking→Invoice-Brücke, 0092)."""

    id: str
    invoice_number: str | None = None
    status: str = ""
    # None ohne Betrags-Sichtbarkeit (GuestMask.amounts).
    gross_amount: float | None = None
    currency: str = ""


class ReservationDetail(BaseModel):
    """Vollständige Reservierungs-Detailansicht (rechter Slider, Hostaway-Niveau).

    Beträge/Kontakt sind maskierungskonform: ohne Berechtigung None bzw. nur
    Vorname (DSGVO-Daten-Split §4)."""

    id: str
    property_id: str
    property_title: str = ""
    # Objekt-Standort (aus properties): strukturierte Adresse + optionale
    # Koordinaten für die Standortkarte. lat/lng None → keine Karte, nur Text
    # (kein erfundener Punkt, Wurzel 4). Adresse speist den „In Karte öffnen"-Link.
    property_street: str | None = None
    property_postal_code: str | None = None
    property_city: str | None = None
    property_country: str | None = None
    property_lat: float | None = None
    property_lng: float | None = None
    guest_id: str | None = None
    guest_name: str = ""
    channel: ReservationChannel
    ota_name: str | None = None
    external_ref: str | None = None
    external_url: str | None = None
    # Zahlungsweg laut Portal (0240): 'property' = wir ziehen ein, 'ota' = das
    # Portal hat bereits kassiert, None = nicht geliefert (NICHT „wir").
    payment_collect: str | None = None
    payment_method_ota: str | None = None
    # Vom Portal einbehaltene Provision in Buchungswährung.
    ota_commission: float | None = None
    # Vom Portal einbehaltene Steuern (collected_taxes, Booking.com) —
    # mindern die Auszahlung zusätzlich zur Provision (0270).
    ota_withheld_taxes: float | None = None
    check_in: date
    check_out: date
    nights: int
    status: ReservationStatus
    # Belegung
    num_guests: int = 1
    adults: int = 1
    children: int = 0
    infants: int = 0
    pets: int = 0
    # Eigentümer-Aufenthalt (0241). Das Feld FEHLTE hier, während der Lesepfad
    # es setzte — Pydantic verwirft unbekannte Felder still, also kam im Detail
    # immer `false` an: 34 Eigennutzungen wurden als Direktbuchung mit
    # „Endpreis 0,00" dargestellt, samt Knopf „Gast einchecken" für einen Gast,
    # den es nicht gibt. Genau die Klasse Fehler, die niemand als Bug erkennt,
    # weil die Anzeige plausibel aussieht.
    is_owner_stay: bool = False
    # Beträge (maskiert) + Quote-Aufschlüsselung
    currency: str = ""
    total_amount: float | None = None
    paid_amount: float | None = None
    due_amount: float | None = None
    quote_items: list[QuoteItem] = []
    # Policy-Zeiten + Notiz
    checkin_time: str | None = None
    checkout_time: str | None = None
    note: str | None = None
    # Echter Check-in/Check-out-Zustand (0091) — None = noch nicht erfolgt.
    checked_in_at: str | None = None
    checked_out_at: str | None = None
    # Aktive Rechnung zur Buchung (None = noch keine erstellt).
    invoice: ReservationInvoiceInfo | None = None
    # Storno-Dokumentation (gesetzt bei status=cancelled)
    cancel_reason: str | None = None
    cancelled_at: str | None = None
    # Gast-Kontakt (maskiert)
    guest_email: str | None = None
    guest_phone: str | None = None
    guest_language: str | None = None
    guest_country: str | None = None
    created_at: str | None = None
    # Konditionen des PORTALS (0384) — für eine OTA-Buchung gilt die Staffel,
    # die Booking/Airbnb dem Gast zugesagt hat, nicht unsere eigene Kondition.
    # None = das Portal hat keine geliefert (NICHT „kostenfrei stornierbar").
    ota_cancel_penalties: list[dict[str, object]] | None = None
    ota_notes: str | None = None
    ota_details: dict[str, object] | None = None
    # Buchungszeitpunkt beim Portal (0291, Wurzel 5b) — None, wenn die Quelle
    # ihn nicht geliefert hat. `created_at` ist NICHT sein Ersatz, sondern
    # unser Eingang; die UI beschriftet beide unterschiedlich.
    booked_at: str | None = None
    # Ablage (0383) — siehe ReservationResponse.
    archived_at: str | None = None
    # Der Nachrichten-Thread dieser Buchung im Posteingang, falls es einen gibt:
    # bei OTA-Buchungen die Channex-Booking-ID, bei einem übernommenen Bestand
    # der Übernahme-Thread (`ue:<reservation_id>`). None = zu dieser Buchung
    # existiert keine Korrespondenz — dann führt auch kein Link dorthin
    # (kein Knopf, der auf eine leere Ansicht zeigt).
    message_thread_id: str | None = None


class ReservationRefundRule(BaseModel):
    """Eine Stufe der Storno-Staffel: X % zurück, wenn ≥ Y Tage vor Anreise."""

    refund_percent: float
    days_before_arrival: int


class ReservationDeposit(BaseModel):
    """Kaution der geltenden Kondition — Betrag bereits ausgerechnet."""

    amount: float
    method: str | None = None
    currency: str | None = None
    preauth_days_before_arrival: int | None = None
    release_days_after_departure: int | None = None


class ReservationTransaction(BaseModel):
    """Eine Zahlungszeile zur Buchung (payments): geplant ODER vollzogen.

    `due_at` gesetzt = geplanter Termin, `at` = wann die Zeile bei uns entstand.
    Beträge folgen der Betrags-Maskierung wie überall (None ohne Einblick)."""

    id: str
    at: str
    amount: float | None = None
    currency: str = ""
    status: str = ""
    type: str = ""
    due_at: str | None = None


class ReservationConditions(BaseModel):
    """Buchungskonditionen + Zahlungsstand einer Buchung.

    Quelle ist `booking_conditions` über den geteilten Helfer
    `booking_conditions.plan` — dieselbe Rechnung, die der Gast-Checkout zeigt
    und der Zahlungspfad vollzieht. Ohne gepflegte Kondition bleiben die
    Plan-Felder None: dann gilt „alles sofort fällig", und genau das sagt die
    UI dann auch, statt einen Plan zu erfinden (Wurzel 4).
    """

    condition_name: str | None = None
    installments: int = 1
    due_now: float | None = None
    due_later: float | None = None
    balance_due_date: date | None = None
    cancellation_mode: str | None = None
    refund_rules: list[ReservationRefundRule] = []
    deposit: ReservationDeposit | None = None
    transactions: list[ReservationTransaction] = []
    currency: str = ""


class ReservationNoteUpdate(BaseModel):
    """Interne Notiz zur Buchung (leer = Notiz entfernen)."""

    note: str = Field(default="", max_length=5000)


class ReservationNoteCreate(BaseModel):
    """Neue Notiz im VERLAUF der Buchung (0384).

    Anders als `ReservationNoteUpdate` überschreibt sie nichts: jede Notiz ist
    ein eigener Eintrag mit Autor und Zeit.
    """

    body: str = Field(min_length=1, max_length=5000)
    category: str | None = Field(default=None, max_length=60)


class ReservationNote(BaseModel):
    """Ein Eintrag aus dem Notiz-Verlauf einer Buchung."""

    id: str
    reservation_id: str
    author_id: str | None = None
    author_name: str | None = None
    category: str | None = None
    body: str = ""
    created_at: str


class ReservationNoteListResponse(BaseModel):
    items: list[ReservationNote] = []
    total: int = 0


class ReservationArchiveUpdate(BaseModel):
    """Ablage-Zustand setzen (0383): true = archivieren, false = zurückholen."""

    archived: bool


class ReservationGuestUpdate(BaseModel):
    """Gastdaten + erwartete Zeiten einer Buchung korrigieren.

    Bewusst nur die Felder, die auf der Buchung selbst liegen — die Gästekartei
    (`guests`) bleibt unberührt, sonst würde eine Tippfehler-Korrektur an EINER
    Buchung die Stammdaten aller Buchungen dieses Gastes umschreiben.
    """

    guest_name: str = Field(min_length=1, max_length=255)
    guest_email: str | None = Field(default=None, max_length=255)
    guest_phone: str | None = Field(default=None, max_length=64)
    guest_language: str | None = Field(default=None, max_length=16)
    guest_country: str | None = Field(default=None, max_length=64)
    checkin_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    checkout_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class CheckOutRequest(BaseModel):
    """Zahlart des Gastes beim Check-out (wird an der Rezeption abgefragt).

    cash/card = am Empfang bezahlt → Rechnung sofort 'paid';
    invoice = Zahlung auf Rechnung (Überweisung, Zahlungsziel) → 'finalized'.
    card_brand nur bei Kreditkarte (Visa, Mastercard, …)."""

    payment_method: str = Field(default="invoice", pattern="^(cash|card|invoice)$")
    card_brand: str | None = None


class CheckOutResponse(BaseModel):
    """Ergebnis des Check-outs: Buchung + die dabei erzeugte finale Rechnung
    (invoice_already_existed=True beim idempotenten Retry)."""

    reservation: ReservationResponse
    invoice_id: str
    invoice_number: str | None = None
    invoice_already_existed: bool = False


class ReservationListResponse(BaseModel):
    items: list[ReservationResponse]
    total: int
    # True, wenn ein `limit` die Antwort abgeschnitten hat und es weitere Zeilen
    # gibt. Ohne dieses Feld liest sich eine gedeckelte Liste wie eine
    # vollständige — genau die stille Falschaussage, die der 1000er-Cap von
    # PostgREST vorher erzeugt hat.
    truncated: bool = False


class DashboardAddon(BaseModel):
    """Eine gebuchte Zusatzleistung, wie sie als Badge in der Zeile steht.

    Bewusst OHNE Betrag: das Dashboard soll dem Team sagen, WAS vorzubereiten
    ist (zwei Wäschepakete zum Check-in), nicht was es kostet. Ein Preis hier
    müsste zusätzlich gegen `mask.amounts` gegated werden (§4.2) — für eine
    Vorbereitungsliste ist er schlicht die falsche Information.
    """

    # Mehrsprachig wie im Katalog (Locale → Text). Die Sprachwahl trifft das
    # Frontend, das die Locale des Betrachters kennt — serverseitig eine
    # herauszugreifen hieße, sie zu raten.
    name: dict[str, str] = Field(default_factory=dict)
    qty: int
    # Offen/bezahlt — ein offener Posten ist beim Check-in noch zu kassieren.
    # Stornierte tauchen gar nicht erst auf.
    paid: bool = False


class DashboardEntry(BaseModel):
    """Eine Zeile in den Check-out/-in/Anstehend-Listen des Dashboards."""

    reservation_id: str
    guest_name: str = ""
    property_title: str = ""
    channel: ReservationChannel
    ota_name: str | None = None
    check_in: date
    check_out: date
    status: ReservationStatus
    # Eigentümer-Aufenthalt (0241): in den Listen sichtbar, aber kein Umsatz.
    is_owner_stay: bool = False
    # Gebuchte Zusatzleistungen (Wäschepaket, Frühstück …). Leere Liste heißt
    # „keine gebucht" — nicht „nicht geladen".
    addons: list[DashboardAddon] = Field(default_factory=list)
    # Wann die Buchung getätigt wurde (Quell-Zeitstempel, Wurzel 5b): beim
    # Portal `ota_buchungszeitpunkt`, bei Direkt/Marktplatz unsere Anlage — nie
    # der Feed-Eingang. Trägt die Liste „Neu eingegangen"; in den nach
    # Aufenthalt sortierten Listen bleibt es ungenutzt.
    booked_at: datetime | None = None
    # Thread-Kennung im Posteingang (`/posteingang?thread=…`) oder None.
    # None heißt „zu dieser Buchung gibt es keine Korrespondenz" — die Zeile
    # zeigt dann keinen Nachrichten-Knopf, statt auf eine leere Ansicht zu
    # verlinken (Wurzel 4: kein Element ohne Wirkung).
    message_thread_id: str | None = None


class DashboardKpi(BaseModel):
    """Eine KPI-Kachel mit Vergleich zu den vorherigen 30 Tagen."""

    value: float
    # Veränderung in Prozent ggü. der Vorperiode; None, wenn keine Vorperiode
    # vorhanden ist (keine erfundenen 0-%-Werte).
    change_pct: float | None = None


class DashboardResponse(BaseModel):
    today: date
    checkouts_today: list[DashboardEntry]
    checkins_today: list[DashboardEntry]
    upcoming: list[DashboardEntry]
    # Was zuletzt hereinkam — sortiert nach BUCHUNGS-Zeitpunkt, nicht nach
    # Aufenthalt. Die drei Listen darüber beantworten „wer kommt/geht heute",
    # diese beantwortet „was ist seit meinem letzten Blick passiert".
    neu_eingegangen: list[DashboardEntry] = Field(default_factory=list)
    # Wer heute im Haus ist: angereist, Abreise noch nicht erreicht. Der
    # Abreisetag zählt nicht mit — wer heute auscheckt, steht in
    # `checkouts_today` und wäre sonst doppelt gezählt.
    im_haus: list[DashboardEntry] = Field(default_factory=list)
    # Reservierungen, die noch auf eine Entscheidung warten (`status='pending'`)
    # und deren Aufenthalt noch nicht vorbei ist. Eine abgelaufene Anfrage ist
    # keine Aufgabe mehr — sie in der Karte „Freigabe nötig" zu zeigen hieße,
    # eine Handlung zu verlangen, die nichts mehr bewirkt.
    freigabe_noetig: list[DashboardEntry] = Field(default_factory=list)
    # Die ECHTEN Anzahlen. Die Listen oben schneiden bei 50 ab, `len(liste)`
    # wäre dort also das Limit und nicht die Anzahl — live stand deshalb
    # zweimal „50" auf der Startseite (Wurzel 4: kein plausibler Ersatzwert).
    upcoming_gesamt: int = 0
    im_haus_gesamt: int = 0
    neu_gesamt: int = 0
    freigabe_gesamt: int = 0
    checkins_30d: DashboardKpi
    # None, wenn der Nutzer keine Beträge sehen darf (Owner ohne PM_BOOKING_TOTAL,
    # Daten-Split §4.2 „kein Gesamtpreis") — kein maskierter 0-Betrag erfunden.
    revenue_30d: DashboardKpi | None = None
    # Umsatz je Buchung im selben Zeitfenster. Eigener Wert und nicht im
    # Frontend aus `revenue_30d / checkins_30d` gerechnet: der Nenner ist NICHT
    # `checkins_30d` — Eigentümer-Aufenthalte zählen als Check-in, aber nicht
    # als Umsatzbuchung, die Division ergäbe also einen zu kleinen Schnitt.
    # Dieselbe Sichtbarkeitsregel wie `revenue_30d` (Betrag = Betrag).
    revenue_per_booking_30d: DashboardKpi | None = None
    confirmed_30d: DashboardKpi
    currency: str = ""
    # Objektbestand des Betriebs (Owner: nur seine). „Entwurf" ist bei uns das,
    # was Hostaway „incomplete" nennt: angelegt, aber nicht verkaufsfertig.
    objekte_gesamt: int = 0
    objekte_inaktiv: int = 0
    objekte_entwurf: int = 0


class DashboardKpiMetrik(StrEnum):
    """Welche Kachel der Startseite nachgeladen wird.

    Geschlossene Menge statt freiem Feldnamen: sonst wäre der Parameter ein
    Hebel, mit dem sich beliebige Spalten aggregieren ließen (Wurzel 8).
    """

    checkins = "checkins"
    revenue = "revenue"
    revenue_per_booking = "revenue_per_booking"
    confirmed = "confirmed"


class DashboardKpiResponse(BaseModel):
    """Eine einzelne KPI-Kachel für einen gewählten Zeitraum."""

    metrik: DashboardKpiMetrik
    # Der gerechnete Zeitraum und seine Tageszahl — beides mit, damit die
    # Oberfläche ihre Auswahl BESTÄTIGT bekommt statt sie nur zu vermuten.
    zeitraum: str
    tage: int
    # None heißt „diesen Wert gibt es für dich/diese Daten nicht" (Owner ohne
    # Betrags-Sichtbarkeit, gemischte Währungen, keine zahlende Buchung im
    # Fenster) — nie ein maskierter 0-Wert.
    kpi: DashboardKpi | None = None
    currency: str = ""


class DashboardListe(StrEnum):
    """Welche Liste der Startseite nachgeladen wird."""

    checkouts = "checkouts"
    checkins = "checkins"
    freigabe = "freigabe"
    upcoming = "upcoming"
    im_haus = "im_haus"


class DashboardFenster(StrEnum):
    """Das Zeitfenster einer Liste, gerechnet ab heute.

    Geschlossene Menge (Wurzel 8): „alle" ist der einzige unbegrenzte Wert und
    trifft trotzdem auf den Listen-Deckel, ein freier Tageswert wäre ein
    offener Hebel in die Zukunft.
    """

    heute = "heute"
    d1 = "1d"
    d2 = "2d"
    d7 = "7d"
    d30 = "30d"
    alle = "alle"


class DashboardListeResponse(BaseModel):
    """Eine nachgeladene Liste der Startseite samt ihrer echten Anzahl."""

    liste: DashboardListe
    fenster: DashboardFenster
    # Die UNGEDECKELTE Anzahl — die Kachel zeigt sie. `len(items)` wäre bei
    # vollem Fenster das Limit und nicht die Anzahl (live stand deshalb
    # zweimal „50" auf der Startseite).
    gesamt: int = 0
    items: list[DashboardEntry] = Field(default_factory=list)


class ChannelBreakdown(BaseModel):
    """Verteilung je Kanal (für die Donut-Diagramme). amount=None ohne Betrags-
    Sichtbarkeit (Daten-Split); nights bleibt sichtbar (keine Finanzangabe)."""

    channel: str
    ota_name: str | None = None
    amount: float | None = None
    nights: int = 0


class StatPoint(BaseModel):
    """Ein Tageswert einer KPI-Zeitreihe (Sparkline / Detail-Chart)."""

    date: date
    value: float


class StatSeries(BaseModel):
    """Zeitreihe EINER KPI über die gewählte Periode (Tagesauflösung).

    Trägt die Kennung (metric) für die Detailseite, den maskierbaren Sichtbar-
    keits-Schalter und die Tagespunkte. Bei Beträgen ohne Sichtbarkeit ist
    `points` leer und `visible=False` (keine erfundenen Werte)."""

    metric: str
    visible: bool = True
    points: list[StatPoint] = []


class StatComparePeriod(BaseModel):
    """Eine Vergleichsperiode auf der KPI-Detailseite (gleiche Länge, davor).

    label = Perioden-Bereich („10 Mai – 8 Jun"); value = Summe/Wert der Periode;
    change_pct = Veränderung ggü. dieser Periode (None ohne Basis)."""

    label: str
    date_from: date
    date_to: date
    value: float | None = None
    change_pct: float | None = None


class StatMetricDetail(BaseModel):
    """Detail-Daten EINER KPI (KPI-Detailseite): die aktuelle Tagesreihe,
    bis zu vier gleich lange Vergleichsperioden davor und die Breakout-Matrix
    (Perioden × Tag-Offset). Beträge maskiert (visible=False → leer)."""

    metric: str
    is_money: bool = False
    visible: bool = True
    currency: str = ""
    date_from: date
    date_to: date
    series: list[StatPoint] = []
    periods: list[StatComparePeriod] = []
    # Breakout: je Vergleichsperiode die Tageswerte (Index 0 = erster Tag der
    # jeweiligen Periode) — für die Tabelle unten auf der Detailseite.
    breakout: list[list[float]] = []


class PropertyStats(BaseModel):
    """Objekt-Kennzahlen für den Statistiken-Reiter (Kontrollzentrum).

    Alle Betrags-KPIs sind maskierbar (None ohne Betrags-Sichtbarkeit, §4.2) und
    tragen die Währung aus den Daten (leer bei gemischten Währungen — keine
    Mischsumme). Zähl-KPIs (Gäste, Nächte, Reservierungen) sind immer sichtbar.
    Jede KPI vergleicht die gewählte Periode mit der gleich langen Vorperiode."""

    property_id: str
    property_title: str = ""
    currency: str = ""
    date_from: date
    date_to: date
    # Betrags-KPIs (None ohne Betrags-Sichtbarkeit)
    revenue: DashboardKpi | None = None
    payments_received: DashboardKpi | None = None
    avg_booking_value: DashboardKpi | None = None
    avg_price_per_night: DashboardKpi | None = None
    # Zähl-KPIs (immer sichtbar)
    hosted_guests: DashboardKpi
    booked_nights: DashboardKpi
    occupancy_rate: DashboardKpi  # Prozent 0..100 (value), change ggü. Vorperiode
    days_booked_ahead: DashboardKpi
    avg_stay_length: DashboardKpi
    created_reservations: DashboardKpi
    cancelled_reservations: DashboardKpi
    cancelled_nights: DashboardKpi
    # Kanal-Verteilung (Einnahmen + Nächte je Kanal)
    by_channel: list[ChannelBreakdown] = []
    # Tages-Zeitreihen je KPI (Sparkline in der Kachel). metric = KPI-Kennung;
    # Betrags-Metriken sind bei fehlender Sichtbarkeit visible=False + leer.
    series: list[StatSeries] = []


class StatMetricDetailResponse(BaseModel):
    """Antwort der KPI-Detailseite (ein einzelnes Aggregat je Metrik)."""

    property_id: str
    property_title: str = ""
    detail: StatMetricDetail


class TimelineEvent(BaseModel):
    """Ein Eintrag der Buchungs-Zeitleiste (Zeitleiste).

    `kind` ist der stabile Schlüssel (created/moved/repriced/checked_in/
    checked_out/cancelled/task_created) — die Beschriftung/Übersetzung macht das
    Frontend. `synthetic=True` markiert ein aus vorhandenen Zeitstempeln
    abgeleitetes Basis-Event (Altbuchungen ohne echten Log-Eintrag). `detail`
    ist bereits maskierungsbereinigt (keine Beträge ohne Freigabe)."""

    id: str
    kind: str
    at: str  # ISO-Zeitstempel
    by_user_id: str | None = None
    detail: dict = {}
    synthetic: bool = False


class TimelineResponse(BaseModel):
    """Chronologische Ereignis-Zeitleiste einer Buchung (neueste zuerst).

    `property_title`/`property_photo` sind der gemeinsame Objekt-Kontext aller
    Ereignisse (je Karte das Objekt-Thumbnail + den Namen) — einmal
    geliefert statt je Event dupliziert. `photo` = null → das UI zeigt einen
    Platzhalter (kein erfundenes Bild)."""

    property_id: str = ""
    property_title: str = ""
    property_photo: str | None = None
    items: list[TimelineEvent] = []


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
