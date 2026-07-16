"""Pydantic-Schemas für den rates-Slice (Preispläne pro Objekt).

Die rate_plans-Tabelle ist die Wahrheit für den Basispreis und die Quelle des
Channex-Rate-Plans. Detail-Preisfelder (Aufschläge etc.) liegen weiterhin im
type_attributes der Property; hier zählt der buchbare Basispreis.
"""
from datetime import date

from pydantic import BaseModel, Field, model_validator


class RatePlanCreate(BaseModel):
    property_id: str
    name: str = "Standard"
    base_price: float = Field(ge=0)
    # Pflicht + nicht leer: eine Buchungswährung wird NIE erfunden (Wurzel 4,
    # 27 EU-Länder) — fehlt sie, ist die Anfrage ein Datenfehler (422).
    currency: str = Field(min_length=1)
    min_stay: int = Field(default=1, ge=1)
    # Hotel: die Zimmerkategorie, zu der dieser Preisplan gehört (Ferienwohnung:
    # None). Ein Hotel-Rate-Plan wird nur an DEN Channex-Room-Type dieser Kategorie
    # gepusht — mehrere Pläne je Kategorie (BAR, B&B …) mit eigenem Preis.
    room_type_id: str | None = None


class RatePlanUpdate(BaseModel):
    name: str | None = None
    base_price: float | None = Field(default=None, ge=0)
    currency: str | None = None
    min_stay: int | None = Field(default=None, ge=1)


class RatePlanResponse(BaseModel):
    id: str
    property_id: str
    name: str
    base_price: float
    currency: str
    min_stay: int
    # Hotel: Zimmerkategorie des Plans (None = Ferienwohnung). Nötig, damit die UI
    # die Rate-Plans je Kategorie gruppieren kann (BAR/B&B je Room-Type).
    room_type_id: str | None = None
    # Anzahl der datumsgenauen Preise dieses Plans (rate_plan_price_overrides).
    # Die Übersicht zeigt damit pro Plan, ob/wie viele Datumspreise gesetzt sind.
    date_price_count: int = 0
    # Sync-Status DB↔Portale (rate_plan_sync_state): 'synced' = Preise sind bei den
    # Portalen, 'pending' = Abweichung/noch nicht abgeglichen, None = kein
    # Datumspreis gesetzt (nichts zu übertragen). Vom Desired-State-Reconciler
    # gepflegt; die UI zeigt daraus ein Status-Badge + 'Jetzt übertragen'.
    sync_status: str | None = None


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
    days: list[RateGridDay] = []


class RateGridRoomType(BaseModel):
    id: str
    title: str
    plans: list[RateGridPlan] = []


class RateGridResponse(BaseModel):
    """Hotel-Rate-Grid für den Belegungsplan: je Zimmerkategorie die Pläne mit
    ihren echten Tageskurven (Datumspreis > Override > Dynamic > Wochentag >
    Plan-Basis) — dieselbe Wahrheit wie Quote und Channex-Push."""

    property_id: str
    room_types: list[RateGridRoomType] = []


class RatePlanPriceSet(BaseModel):
    """Datumsgenauen Preis eines Rate-Plans für einen Zeitraum setzen (Hotel).

    [start, end) — end exklusiv (wie überall im Projekt). `price=None` nimmt den
    Datumspreis für den Zeitraum ZURÜCK (Zeile löschen → Rate-Plan-Basispreis gilt
    wieder). Ein Preis gilt identisch auf allen 3 Vertriebswegen."""

    start: date
    end: date
    price: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check_order(self) -> "RatePlanPriceSet":
        if self.end <= self.start:
            raise ValueError("end muss nach start liegen")
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

    @model_validator(mode="after")
    def _check_order(self) -> "RatePlanMinStaySet":
        if self.end <= self.start:
            raise ValueError("end muss nach start liegen")
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

    @model_validator(mode="after")
    def _check_order(self) -> "RatePlanRestrictionSet":
        if self.end <= self.start:
            raise ValueError("end muss nach start liegen")
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
