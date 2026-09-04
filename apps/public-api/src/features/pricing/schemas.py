"""Pydantic-Schemas für den pricing-Slice (zentrale Preis-Wahrheit).

Der pricing-Slice ist die EINZIGE Stelle, die einen Effektivpreis pro Tag und
einen vollständigen Buchungs-Quote berechnet. Kalender, Reservierungs-Wizard und
Buchungsstrecke lesen ausschließlich hierüber — kein direktes Preis-Tabellenlesen
mehr in anderen Slices.
"""
# SCHWESTERDATEI — byte-identisch in beiden Bäumen halten:
#     apps/api/src/features/pricing/schemas.py
#     apps/public-api/src/features/pricing/schemas.py
# Die Ein- und Ausgabeformen der Preisberechnung. Drift hier bricht den
# Resolver in einem der beiden Bäume — die Felder müssen dieselben sein.
from datetime import date

from pydantic import BaseModel, Field, model_validator

# Harte Obergrenze für einen Quote-Zeitraum (Wurzel 8: kein unbegrenzter
# Nächte-Loop aus Client-Input). Zwei Jahre decken jede reale Buchung ab —
# auch Langzeitmiete —, ein längerer Zeitraum ist ein Fehler, kein Angebot.
MAX_QUOTE_NIGHTS = 730


class EffectivePriceDay(BaseModel):
    """Effektiver Preis eines einzelnen Tages (kein Fallback: None = kein Preis)."""

    date: date
    price: float | None = None
    # Herkunft des Preises: override | dynamic | weekday | base | none.
    source: str = "none"
    # Faktor-Aufschlüsselung (nur bei source=dynamic): {faktor: multiplikator}
    # für die „Warum dieser Preis?"-Erklärung im Kalender.
    factors: dict[str, float] | None = None


class AddonSelection(BaseModel):
    """Ein vom Gast gewähltes Upsell (Katalog-ID + Menge) für den Quote."""

    addon_id: str
    qty: int = Field(default=1, ge=1)


class QuoteRequest(BaseModel):
    """Anfrage für einen Buchungs-Quote (Preisaufschlüsselung)."""

    property_id: str
    check_in: date
    check_out: date  # exklusiv (Abreisetag ist wieder frei)
    guests: int = Field(default=1, ge=1)
    # Mitgebrachte Tiere. Multipliziert Gebühren mit `basis: per_pet_stay`
    # („pro Tier und Aufenthalt"). Ohne Angabe 0 — dann kostet eine solche
    # Gebühr nichts, was genau richtig ist: kein Tier, keine Tiergebühr.
    pets: int = Field(default=0, ge=0, le=50)
    # Sprache des GASTES für die Bezeichnungen der Aufschlüsselung (Gebühr,
    # Steuer, Zusatzleistung). Sie ist eine Anzeige-Achse, keine Rechen-Achse:
    # die Beträge sind davon unberührt.
    #
    # Fehlt sie, greift Englisch (`_pick_locale_text`) und nicht Deutsch — das
    # Produkt läuft in 27 Ländern, und ein deutscher Posten auf der Rechnung
    # eines dänischen Gastes ist keine Voreinstellung, sondern eine
    # Falschaussage (Wurzel 4, dieselbe Begründung wie Migration 0335 für die
    # Mail-Sprache). Regionsvarianten („de-AT", "pt_BR") kappt der Resolver auf
    # die Basissprache; ein unbekannter Code fällt auf Englisch zurück.
    locale: str = "en"
    # Kanal bestimmt den Markup-Aufschlag (direct = kein Markup).
    channel: str = "direct"
    # Hotel: der KONKRETE Rate-Plan der Buchung (BAR vs. B&B kosten verschieden).
    # Ohne ihn wird property-weit bepreist (FeWo: das eine Objekt-Rate-Plan).
    rate_plan_id: str | None = None
    # Optionale Zusatzleistungen (Upsells); werden nach Basis + Steuer als eigene
    # Positionen in die Aufschlüsselung gerechnet.
    addons: list[AddonSelection] = Field(default_factory=list)
    # Vom Gast GEWÄHLTE optionale Gebühren (`fees[].optional`, deren IDs).
    #
    # Eine als optional markierte Gebühr wird ohne ihre ID hier NICHT berechnet.
    # Das ist die Zusage der Oberfläche („Optional — Gast kann ab-/zuwählen");
    # bisher las der Resolver das Flag überhaupt nicht und berechnete sie jedem
    # Gast, der sie damit gar nicht abwählen KONNTE. Leere Liste = keine
    # gewählt, nicht „alle" — sonst wäre ein Gast, der nichts anklickt,
    # schlechter dran als einer, der abwählt.
    fees: list[str] = Field(default_factory=list, max_length=50)
    # Buchungs-/Bezugsdatum für zeitabhängige Rabatte (early_booker/last_minute:
    # Abstand as_of→check_in). Default heute. EXPLIZIT im Request, damit der
    # Resolver deterministisch bleibt (kein date.today() tief in der Rechnung) —
    # zwei Quotes mit gleichem as_of liefern immer denselben Preis.
    as_of: date = Field(default_factory=date.today)
    # Angebotscode des Gastes („Aktionscode" im Branchenstandard). Eine Aktion mit
    # gepflegten Codes greift NUR mit einem davon; ohne Codes ist das Feld
    # bedeutungslos. Groß-/Kleinschreibung egal (serverseitig normalisiert) —
    # sonst tippt der Gast „sommer26" und findet den Grund nie.
    promo_code: str | None = Field(default=None, max_length=15)

    @model_validator(mode="after")
    def _check_order(self) -> "QuoteRequest":
        if self.check_out <= self.check_in:
            raise ValueError("check_out muss nach check_in liegen")
        if (self.check_out - self.check_in).days > MAX_QUOTE_NIGHTS:
            raise ValueError(
                f"Zeitraum zu lang (höchstens {MAX_QUOTE_NIGHTS} Nächte)"
            )
        return self


class QuoteLine(BaseModel):
    """Eine Position der Aufschlüsselung (Label + Betrag; negativ = Rabatt).

    `kind` klassifiziert die Zeile für die Rechnungserstellung (Booking→Invoice,
    buchhaltung/reservation_invoice): lodging|surcharge|fee|discount|tax|addon.
    'tax' (Abgaben wie Kurtaxe) wird mit 0 % USt fakturiert, alles andere mit
    dem Übernachtungs-Steuersatz. Optional, damit Bestands-Snapshots ohne kind
    (ältere reservations.quote_items) gültig bleiben — dort greift die
    Label-Heuristik.

    `tax_rate` ist der zeilen-eigene USt-Satz in % als Snapshot zum
    Buchungszeitpunkt (Gebühren mit eigenem Satz, z. B. Frühstück 19 % neben
    Logis 7 %; Quelle: fees[].taxRate der property_pricing_config). None =
    kein eigener Satz — die Rechnung nutzt dann die kind-/Label-Logik."""

    label: str
    amount: float
    kind: str | None = None
    tax_rate: float | None = None
    # Nur bei kind="fee": die Gebühren-ID aus der Objekt-Preiskonfiguration.
    # Prozent-Steuern mit gewählter Bemessungsgrundlage brauchen sie, um „diese
    # Gebühr zählt, jene nicht" sicher zu treffen — Labels sind nicht eindeutig.
    fee_id: str | None = None


class OptionalFeeOffer(BaseModel):
    """Eine wählbare Gebühr mit ihrem Betrag FÜR DIESEN Aufenthalt.

    Der Resolver rechnet sie mit, auch wenn der Gast sie nicht gewählt hat —
    sonst müsste die Oberfläche „80 pro Nacht × 7 Nächte" selbst hochrechnen und
    käme bei Prozent- oder Gast-Basis auf einen anderen Betrag als der Server
    (Wurzel 3: der Preis wird nicht im Browser gebildet).
    """

    id: str
    label: str
    amount: float
    selected: bool = False


class QuoteResponse(BaseModel):
    """Vollständige Preisaufschlüsselung eines Aufenthalts.

    nightly_total = Summe der Effektiv-Tagespreise (inkl. Längen-/Kurzaufenthalts-
    Logik + Markup + Extra-Gast). lines enthält die einzelnen Positionen in
    Anzeigereihenfolge; total ist die Endsumme. currency stammt aus der Konfig/
    dem Rate-Plan (kein erfundener Default).
    """

    property_id: str
    check_in: date
    check_out: date
    nights: int
    guests: int
    channel: str
    currency: str
    nightly_total: float
    lines: list[QuoteLine] = []
    total: float
    # Wählbare Gebühren des Objekts samt gerechnetem Betrag. Die gewählten
    # stehen zusätzlich in `lines` und sind hier `selected=True`.
    optional_fees: list[OptionalFeeOffer] = []
    # Hat der mitgeschickte Angebotscode WIRKLICH eine Aktion ausgelöst? Ohne
    # diese Antwort könnte die Buchungsstrecke nicht zwischen „Code angewendet"
    # und „Code ungültig, aber es gilt eine automatische Aktion" unterscheiden —
    # der Gast sähe einen Rabatt und dächte, sein Code habe gewirkt.
    promo_code_applied: bool = False
    # True, wenn das Objekt keinen bepreisbaren Tag hat (kein Rate-Plan/Override/
    # Wochentagspreis) — der Aufrufer muss dann manuell bepreisen, statt 0 zu zeigen.
    priceless: bool = False
    # Anzahl der Nächte OHNE Preis. `priceless` meldet nur den Totalausfall;
    # bei einer TEILWEISE bepreisten Spanne (z. B. Overrides für 3 von 7 Nächten)
    # bliebe es False, und `total` wäre still der Preis der 3 Nächte — der Gast
    # bucht 7 und zahlt 3. Verkaufspfade müssen deshalb auf dieses Feld sehen,
    # nicht auf `priceless` (Wurzel 4: lieber klar fehlschlagen als ein
    # plausibler, zu niedriger Betrag).
    unpriced_nights: int = 0


class LastMinuteRule(BaseModel):
    """Eine Last-Minute-Regel: ab `days_before` Tagen vor Anreise `discount_pct`."""

    days_before: int = Field(ge=1)
    discount_pct: float = Field(ge=0, le=100)


class RateRuleMatch(BaseModel):
    """Trefferkriterien einer manuellen Rate Rule (alle optional, UND-verknüpft)."""

    weekday: int | list[int] | None = None  # 0=Mo .. 6=So
    month: int | list[int] | None = None
    min_days_before: int | None = None
    max_days_before: int | None = None


class RateRule(BaseModel):
    """Manuelle Zusatzregel (KI + Fachwissen): match → adjust_pct (Auf/Abschlag)."""

    match: RateRuleMatch = Field(default_factory=RateRuleMatch)
    adjust_pct: float = Field(ge=-100, le=200)


class FarFutureRule(BaseModel):
    """Aufschlag fuer lange Vorausbuchung: ab `days_before` Tagen `uplift_pct`.

    Gegenstueck zu LastMinuteRule. Es gilt die WEITESTE erreichte Schwelle.
    Grenzen deckungsgleich mit dem DB-CHECK `dp_far_future_gueltig` (0555).
    """

    days_before: int = Field(ge=1, le=730)
    uplift_pct: float = Field(ge=0, le=300)


class OccupancyStep(BaseModel):
    """Eine Stufe der Auslastungs-Leiter: ab `ab_pct` Auslastung `adjust_pct`.

    Es gilt die HÖCHSTE erreichte Stufe — kein Addieren, keine Interpolation.
    Die Grenzen sind deckungsgleich mit dem DB-CHECK
    `dp_occupancy_steps_gueltig` (0550): weicht eines von beiden ab, wirft die
    Datenbank einen 500 auf einen Wert, den das Schema durchgelassen hat.
    """

    ab_pct: float = Field(ge=0, le=100)
    adjust_pct: float = Field(ge=-90, le=300)


class DpSettingsResponse(BaseModel):
    """Dynamic-Pricing-Konfiguration eines Objekts (dp_settings)."""

    property_id: str
    enabled: bool = False
    min_price: float | None = None
    max_price: float | None = None
    weekend_uplift_pct: float = 15.0
    last_minute: list[LastMinuteRule] = []
    orphan_gap_discount_pct: float = 15.0
    occupancy_sensitivity: float = 30.0
    min_stay_min: int = 1
    min_stay_max: int = 7
    # Phase 2: Markt-/Wettbewerbs-Signal (opt-in zusätzlich zu enabled).
    market_enabled: bool = False
    market_sensitivity: float = 20.0
    market_max_adjust_pct: float = 25.0
    market_key: str | None = None
    comp_refs: list[str] = []
    # Hostaway-Modell: Basispreis-Modus + Aggressivität.
    base_mode: str = "data_driven"  # 'data_driven' | 'manual'
    base_rate_mode: str = "recommended"  # 'conservative' | 'recommended' | 'aggressive'
    manual_base_price: float | None = None
    # Phase 4 / RateBoard-Bausteine. (autopilot_enabled wurde entfernt:
    # enabled heißt „gilt überall, auch auf den Portalen".)
    weather_enabled: bool = False
    weather_max_adjust_pct: float = 10.0
    rate_rules: list[RateRule] = []
    # Auslastungs-Stufenleiter (0550). Nicht leer => ersetzt
    # occupancy_sensitivity fuer den Auslastungs-Faktor.
    occupancy_steps: list[OccupancyStep] = []
    # Aufschlag fuer lange Vorausbuchung (0555). Leer = kein Aufschlag.
    far_future: list[FarFutureRule] = []
    # Freigabe vor dem Senden (0554): true = berechnete Preise warten auf den
    # Knopf, statt sofort an die Portale zu gehen.
    freigabe_noetig: bool = False


class DpSettingsUpdate(BaseModel):
    """PATCH-Form: nur gesetzte Felder werden übernommen."""

    enabled: bool | None = None
    min_price: float | None = Field(default=None, ge=0)
    max_price: float | None = Field(default=None, ge=0)
    weekend_uplift_pct: float | None = Field(default=None, ge=0, le=200)
    last_minute: list[LastMinuteRule] | None = None
    orphan_gap_discount_pct: float | None = Field(default=None, ge=0, le=100)
    occupancy_sensitivity: float | None = Field(default=None, ge=0, le=100)
    min_stay_min: int | None = Field(default=None, ge=1)
    min_stay_max: int | None = Field(default=None, ge=1)
    market_enabled: bool | None = None
    market_sensitivity: float | None = Field(default=None, ge=0, le=100)
    market_max_adjust_pct: float | None = Field(default=None, ge=0, le=100)
    market_key: str | None = None
    comp_refs: list[str] | None = None
    base_mode: str | None = Field(default=None, pattern="^(data_driven|manual)$")
    base_rate_mode: str | None = Field(
        default=None, pattern="^(conservative|recommended|aggressive)$"
    )
    manual_base_price: float | None = Field(default=None, ge=0)
    # Phase 4 / RateBoard-Bausteine.
    weather_enabled: bool | None = None
    weather_max_adjust_pct: float | None = Field(default=None, ge=0, le=100)
    rate_rules: list[RateRule] | None = None
    # Hoechstens 20 Stufen — dieselbe Grenze wie der DB-CHECK aus 0550.
    occupancy_steps: list[OccupancyStep] | None = Field(default=None, max_length=20)
    # Hoechstens 10 Stufen — dieselbe Grenze wie der DB-CHECK aus 0555.
    far_future: list[FarFutureRule] | None = Field(default=None, max_length=10)
    freigabe_noetig: bool | None = None


class DpOverviewItem(BaseModel):
    """Eine Zeile der Dynamic-Pricing-Objekt-Übersicht (Hostaway-Tabelle)."""

    property_id: str
    title: str
    photo: str | None = None  # erstes Objektfoto (Thumbnail), None = keins
    status: str = "draft"  # Veröffentlichungs-Status des Objekts: draft|active|inactive
    currency: str | None = None
    enabled: bool = False
    base_mode: str = "data_driven"
    base_rate_mode: str = "recommended"
    # Effektiver Basispreis (Anker), den die Engine nutzt: manueller Wert oder
    # Grundpreis aus dem Rate-Plan. None = kein Grundpreis hinterlegt (kein Fallback).
    base_rate: float | None = None
    min_price: float | None = None
    max_price: float | None = None
    # Verteilkanäle, auf denen das Objekt LIVE ist: "platform" (eigene
    # Buchungsplattform, wenn status=active) + aktive OTA-Portal-Codes aus
    # channex_channel_connection (z. B. BookingCom, AirBNB, VRBO, Expedia).
    channels: list[str] = []
    # Wartet dieses Objekt mit dem Senden auf eine Freigabe, und wie viele
    # berechnete Tage stehen aus? 0 = nichts offen (oder keine Freigabepflicht).
    freigabe_noetig: bool = False
    offene_tage: int = 0


class DpOverviewResponse(BaseModel):
    items: list[DpOverviewItem] = []
    # Ist das kostenpflichtige Modul „Dynamische Preise" (0,5 % vom
    # Buchungsumsatz) gebucht? Die Fläche selbst sagt, ob sie freigeschaltet
    # ist — die UI muss dafür NICHT den Abo-Endpunkt abfragen (der verlangt
    # MANAGE_BILLING, das ein Vertriebs-Nutzer nicht hat; er würde sonst
    # fälschlich die Verkaufsseite sehen). Fail-CLOSED: Default false.
    module_active: bool = False


class PriceSuggestResponse(BaseModel):
    """Empfohlene Smart-Pricing-Spanne aus der Dynamic-Pricing-Engine.

    min/max = Extrema der von Nachfrage/Saison/Wochenende/Auslastung getriebenen
    Tagespreise über den Horizont. available=False, wenn kein Basispreis existiert
    (kein Vorschlag ohne Datengrundlage — kein erfundener Wert)."""

    property_id: str
    available: bool = False
    min_price: float | None = None
    max_price: float | None = None


class RecomputeResponse(BaseModel):
    properties: int
    days: int


class PriceExplainResponse(BaseModel):
    """KI-Klartext-Begründung eines berechneten Tagespreises (on-demand)."""

    property_id: str
    date: date
    price: float
    explanation: str


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
