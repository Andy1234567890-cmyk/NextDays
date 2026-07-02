"""Pydantic-Schemas für die Reisebüro-/Partner-Kartei (travel_agencies).

Modell nach OPERA „Sales Account / Travel Agent Profile" (Profil +
Negotiated Rates + Attachments), auf myNextDays-Größe reduziert: Partner-
Stammdaten, Kontaktpersonen, Verträge (Gültigkeit von–bis → Jahres-Gruppen)
und Saison-Preiszeilen (Rate-Sheet) am Vertrag.
"""
from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class SliceHealth(BaseModel):
    slice: str = "travel_agencies"
    status: str = "ok"


class AgencyKind(StrEnum):
    travel_agent = "travel_agent"
    tour_operator = "tour_operator"
    company = "company"
    source = "source"


class Settlement(StrEnum):
    hotel_collect = "hotel_collect"    # Gast zahlt uns, Kommission wird abgerechnet
    agency_collect = "agency_collect"  # Partner kassiert und führt ab


class ContractKind(StrEnum):
    allotment = "allotment"
    guarantee = "guarantee"
    free_sale = "free_sale"
    other = "other"


class RateBasis(StrEnum):
    net = "net"      # Nettorate — Partner kalkuliert die Marge selbst
    gross = "gross"  # Bruttopreis — Kommission wird abgezogen


class AgencyBase(BaseModel):
    kind: AgencyKind = AgencyKind.travel_agent
    name: str = Field(min_length=1, max_length=200)
    iata_number: str | None = None
    vat_id: str | None = None
    address: str | None = None
    city: str | None = None
    postal_code: str | None = None
    country: str | None = None   # ISO-2
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    language: str | None = None  # ISO-639-1
    currency: str | None = None  # ISO-4217 (Referenzwährung)
    commission_pct: float | None = Field(default=None, ge=0, le=100)
    settlement: Settlement | None = None
    payment_term_days: int | None = Field(default=None, ge=0)
    is_active: bool = True
    notes: str | None = None


class AgencyCreate(AgencyBase):
    pass


class AgencyUpdate(BaseModel):
    """PATCH — nur gesetzte Felder ändern sich."""
    kind: AgencyKind | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    iata_number: str | None = None
    vat_id: str | None = None
    address: str | None = None
    city: str | None = None
    postal_code: str | None = None
    country: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    language: str | None = None
    currency: str | None = None
    commission_pct: float | None = Field(default=None, ge=0, le=100)
    settlement: Settlement | None = None
    payment_term_days: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    notes: str | None = None


class AgencyResponse(AgencyBase):
    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AgencyListResponse(BaseModel):
    items: list[AgencyResponse] = []
    total: int = 0


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary: bool = False


class ContactResponse(ContactCreate):
    id: str


class ContractCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: ContractKind = ContractKind.other
    valid_from: date
    valid_to: date
    currency: str = Field(pattern=r"^[A-Z]{3}$")  # ISO-4217, Pflicht am Rate-Sheet
    commission_pct: float | None = Field(default=None, ge=0, le=100)
    release_days: int | None = Field(default=None, ge=0)
    notes: str | None = None

    @model_validator(mode="after")
    def _check_range(self) -> "ContractCreate":
        if self.valid_to < self.valid_from:
            raise ValueError("valid_to darf nicht vor valid_from liegen")
        return self


class ContractUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: ContractKind | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    commission_pct: float | None = Field(default=None, ge=0, le=100)
    release_days: int | None = Field(default=None, ge=0)
    notes: str | None = None


class ContractResponse(BaseModel):
    id: str
    agency_id: str
    title: str
    kind: ContractKind
    valid_from: date
    valid_to: date
    currency: str
    commission_pct: float | None = None
    release_days: int | None = None
    storage_path: str | None = None
    file_name: str | None = None
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ContractListResponse(BaseModel):
    items: list[ContractResponse] = []
    total: int = 0


class RateCreate(BaseModel):
    property_id: str
    season_start: date
    season_end: date
    price: float = Field(ge=0)  # pro Nacht, in der Vertragswährung
    basis: RateBasis
    min_stay: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def _check_range(self) -> "RateCreate":
        if self.season_end < self.season_start:
            raise ValueError("season_end darf nicht vor season_start liegen")
        return self


class RateResponse(RateCreate):
    id: str
    contract_id: str


class RateListResponse(BaseModel):
    items: list[RateResponse] = []
    total: int = 0


class FileUrlResponse(BaseModel):
    """Zeitlich begrenzte, signierte Download-URL (privater Bucket)."""
    url: str
    expires_in: int
