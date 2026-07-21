"""Pydantic-Schemas für den rates-Slice (Preispläne pro Objekt).

Die rate_plans-Tabelle ist die Wahrheit für den Basispreis und die Quelle des
Channex-Rate-Plans. Detail-Preisfelder (Aufschläge etc.) liegen weiterhin im
type_attributes der Property; hier zählt der buchbare Basispreis.
"""
from datetime import date

from pydantic import BaseModel, Field, model_validator

# Harte Obergrenze für JEDEN Datums-Bereich eines Bulk-Schreibzugriffs (Wurzel 8):
# ohne sie expandiert ein einziger Request (z. B. 100 Jahre × Wochentagsmaske) zu
# zehntausenden Upsert-Zeilen UND ebenso vielen ARI-Push-Jobs — die Wochentags-
# maske verhindert dabei sogar das Bündeln benachbarter Tage. Zwei Jahre decken
# jede reale Preispflege ab (der Grid-Horizont liegt bei 400 Tagen).
_MAX_SET_DAYS = 730


def _validate_range(start: date, end: date, weekdays: list[int] | None) -> None:
    """Gemeinsame Prüfung der Bulk-Set-Schemas: Reihenfolge, Span-Obergrenze,
    Wochentagsmaske (nur 0–6, keine Duplikate; leer/None = alle Tage)."""
    if end <= start:
        raise ValueError("end muss nach start liegen")
    if (end - start).days > _MAX_SET_DAYS:
        raise ValueError(
            f"Zeitraum zu groß: höchstens {_MAX_SET_DAYS} Tage pro Anfrage"
        )
    if weekdays is None:
        return
    if any(d < 0 or d > 6 for d in weekdays) or len(set(weekdays)) != len(weekdays):
        raise ValueError("weekdays müssen 0–6 ohne Duplikate sein")


class RatePlanCreate(BaseModel):
    property_id: str
    name: str = "Standard"
    base_price: float = Field(ge=0)
    # Pflicht + nicht leer: eine Buchungswährung wird NIE erfunden (Wurzel 4,
    # 27 EU-Länder) — fehlt sie, ist die Anfrage ein Datenfehler (422).
    currency: str = Field(min_length=1)
    min_stay: int = Field(default=1, ge=1)
    # Ableitung (SiteMinder-Modell): 'manual' = eigener Preis; 'derived' = Preis
    # aus einem Basis-Plan desselben Objekts (erst Betrag, dann Prozent). Bei
    # derived ist derived_from_rate_plan_id Pflicht; base_price/currency erbt das
    # Kind vom Parent (Service erzwingt). Offsets signiert, beide optional.
    rate_mode: str = Field(default="manual", pattern="^(manual|derived)$")
    derived_from_rate_plan_id: str | None = None
    offset_amount: float | None = None
    offset_percent: float | None = None
    # Nur zusätzliche Preise: an die Buchungsportale senden? Der Grundpreis geht
    # ohnehin immer; dieser Preis geht nur an die Portale, wenn true (Default aus).
    send_to_portals: bool = False


class RatePlanUpdate(BaseModel):
    name: str | None = None
    base_price: float | None = Field(default=None, ge=0)
    currency: str | None = None
    min_stay: int | None = Field(default=None, ge=1)
    rate_mode: str | None = Field(default=None, pattern="^(manual|derived)$")
    derived_from_rate_plan_id: str | None = None
    offset_amount: float | None = None
    offset_percent: float | None = None
    send_to_portals: bool | None = None


class RatePlanResponse(BaseModel):
    id: str
    property_id: str
    name: str
    base_price: float
    currency: str
    min_stay: int
    # Anzahl der datumsgenauen Preise dieses Plans (rate_plan_price_overrides).
    # Die Übersicht zeigt damit pro Plan, ob/wie viele Datumspreise gesetzt sind.
    date_price_count: int = 0
    # Sync-Status DB↔Portale (rate_plan_sync_state): 'synced' = Preise sind bei den
    # Portalen, 'pending' = Abweichung/noch nicht abgeglichen, None = kein
    # Datumspreis gesetzt (nichts zu übertragen). Vom Desired-State-Reconciler
    # gepflegt; die UI zeigt daraus ein Status-Badge + 'Jetzt übertragen'.
    sync_status: str | None = None
    # Ableitung: 'manual' | 'derived'. Bei derived Parent-Name + Offsets für die
    # UI (Badge „Abgeleitet von {parent} · +25 € · −15 %"), base_price ist dann der
    # berechnete Grundpreis-Referenzwert (Parent-Basis + Offset).
    rate_mode: str = "manual"
    derived_from_rate_plan_id: str | None = None
    derived_from_name: str | None = None
    offset_amount: float | None = None
    offset_percent: float | None = None
    # An die Buchungsportale senden (nur zusätzliche Preise; Grundpreis geht immer).
    send_to_portals: bool = False


class RatePlanListResponse(BaseModel):
    items: list[RatePlanResponse] = []
    total: int = 0


class RateGridDay(BaseModel):
    """Effektivpreis EINES Tages eines Plans (Resolver-Kurve, mit Quelle)."""

    date: date
    price: float | None = None
    # 'rate_plan' (Datumspreis) | 'override' | 'dynamic' | 'weekday' | 'base' | 'none'
    source: str = "none"


class RateGridPlan(BaseModel):
    """Ein Rate-Plan im Belegungsplan-Grid: Stammdaten + Tageskurve."""

    id: str
    name: str
    currency: str
    base_price: float
    min_stay: int
    sync_status: str | None = None
    # Abgeleitete Pläne: Preiszellen sind read-only (Grid grau, Ketten-Badge).
    # Min-Stay/Restriktionen bleiben editierbar (nur Preise werden abgeleitet).
    rate_mode: str = "manual"
    derived_from_rate_plan_id: str | None = None
    derived_from_name: str | None = None
    offset_amount: float | None = None
    offset_percent: float | None = None
    price_read_only: bool = False
    days: list[RateGridDay] = []


class RateGridResponse(BaseModel):
    """Rate-Grid für den Belegungsplan: alle Rate-Pläne des OBJEKTS mit ihren
    echten Tageskurven (Datumspreis > Override > Dynamic > Wochentag >
    Plan-Basis) — dieselbe Wahrheit wie Quote und Channex-Push. Ein Objekt =
    eine Einheit; KEINE Zimmerkategorie-Ebene."""

    property_id: str
    plans: list[RateGridPlan] = []


class RatePlanPriceSet(BaseModel):
    """Datumsgenauen Preis eines Rate-Plans für einen Zeitraum setzen (Hotel).

    [start, end) — end exklusiv (wie überall im Projekt). `price=None` nimmt den
    Datumspreis für den Zeitraum ZURÜCK (Zeile löschen → Rate-Plan-Basispreis gilt
    wieder). Ein Preis gilt identisch auf allen 3 Vertriebswegen."""

    start: date
    end: date
    price: float | None = Field(default=None, ge=0)
    # Optionale Wochentagsmaske (0=Mo … 6=So). Leer/None → alle Tage im Bereich.
    # Nur diese Wochentage im [start, end) werden gesetzt (Quick-Bulk-Update).
    weekdays: list[int] | None = Field(default=None)

    @model_validator(mode="after")
    def _check_order(self) -> "RatePlanPriceSet":
        _validate_range(self.start, self.end, self.weekdays)
        return self


class RatePlanPriceDay(BaseModel):
    date: date
    price: float


class RatePlanPriceListResponse(BaseModel):
    rate_plan_id: str
    items: list[RatePlanPriceDay] = []


class RatePlanMinStaySet(BaseModel):
    """Datumsgenauen Mindestaufenthalt eines Rate-Plans für [start, end) setzen.

    end exklusiv. `min_stay=None` nimmt den Datums-Mindestaufenthalt zurück (Zeile
    löschen → Rate-Plan-Default gilt wieder). Gilt auf allen 3 Vertriebswegen."""

    start: date
    end: date
    min_stay: int | None = Field(default=None, ge=1)
    weekdays: list[int] | None = Field(default=None)

    @model_validator(mode="after")
    def _check_order(self) -> "RatePlanMinStaySet":
        _validate_range(self.start, self.end, self.weekdays)
        return self


class RatePlanMinStayDay(BaseModel):
    date: date
    min_stay: int


class RatePlanMinStayListResponse(BaseModel):
    rate_plan_id: str
    items: list[RatePlanMinStayDay] = []


class RatePlanRestrictionSet(BaseModel):
    """Datumsgenaue Restriktionen (CTA/CTD/Max-Stay) eines Rate-Plans für
    [start, end) setzen. end exklusiv. Die drei Felder sind der GEWÜNSCHTE
    Endzustand der Tage: None = für diese Restriktion kein Override. Sind alle
    drei None, wird der Override zurückgenommen (Zeilen löschen → Default offen/
    kein Limit gilt wieder, auch an den Portalen). Alle 3 Vertriebswege gleich."""

    start: date
    end: date
    closed_to_arrival: bool | None = None
    closed_to_departure: bool | None = None
    max_stay: int | None = Field(default=None, ge=0)
    weekdays: list[int] | None = Field(default=None)

    @model_validator(mode="after")
    def _check_order(self) -> "RatePlanRestrictionSet":
        _validate_range(self.start, self.end, self.weekdays)
        return self


class RatePlanRestrictionDay(BaseModel):
    date: date
    closed_to_arrival: bool | None = None
    closed_to_departure: bool | None = None
    max_stay: int | None = None


class RatePlanRestrictionListResponse(BaseModel):
    rate_plan_id: str
    items: list[RatePlanRestrictionDay] = []


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
