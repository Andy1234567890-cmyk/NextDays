"""Pydantic-Schemas für den rates-Slice (Preispläne pro Objekt).

Die rate_plans-Tabelle ist die Wahrheit für den Basispreis und die Quelle des
Channex-Rate-Plans. Detail-Preisfelder (Aufschläge etc.) liegen weiterhin im
type_attributes der Property; hier zählt der buchbare Basispreis.
"""
from pydantic import BaseModel, Field


class RatePlanCreate(BaseModel):
    property_id: str
    name: str = "Standard"
    base_price: float = Field(ge=0)
    currency: str = "EUR"
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


class RatePlanListResponse(BaseModel):
    items: list[RatePlanResponse] = []
    total: int = 0


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
