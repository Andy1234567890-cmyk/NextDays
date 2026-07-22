"""Pydantic-Schemas für die Rabatt-/Deal-Engine (property_discounts, 0185)."""
from datetime import date

from pydantic import BaseModel, Field, field_validator, model_validator

DISCOUNT_TYPES: frozenset[str] = frozenset(
    {"length_of_stay", "early_booker", "last_minute", "custom"}
)


class DiscountBase(BaseModel):
    """Gemeinsame Felder einer Rabattregel. Die je-Typ-Pflichtfelder werden hier
    (fail-closed 422) UND per DB-CHECK erzwungen — der Client kann keine sinnlose
    Regel anlegen (LOS ohne min_nights, custom ohne Zeitraum)."""

    discount_type: str
    discount_bps: int = Field(ge=1, le=10000)  # 100 = 1,00 %
    active: bool = True
    min_nights: int | None = Field(default=None, ge=1)
    days_before: int | None = Field(default=None, ge=0)
    starts_on: date | None = None
    ends_on: date | None = None
    name: dict[str, str] = Field(default_factory=dict)  # {locale: text}, i18n

    @field_validator("discount_type")
    @classmethod
    def _type_supported(cls, v: str) -> str:
        if v not in DISCOUNT_TYPES:
            raise ValueError("Unbekannter Rabatt-Typ.")
        return v

    @model_validator(mode="after")
    def _fields_by_type(self) -> "DiscountBase":
        t = self.discount_type
        if t == "length_of_stay":
            if self.min_nights is None:
                raise ValueError("length_of_stay braucht min_nights.")
            if any((self.days_before is not None, self.starts_on, self.ends_on)):
                raise ValueError("length_of_stay erlaubt nur min_nights.")
        elif t == "early_booker":
            if self.days_before is None or self.days_before < 1:
                raise ValueError("early_booker braucht days_before >= 1.")
            if any((self.min_nights is not None, self.starts_on, self.ends_on)):
                raise ValueError("early_booker erlaubt nur days_before.")
        elif t == "last_minute":
            if self.days_before is None:
                raise ValueError("last_minute braucht days_before.")
            if any((self.min_nights is not None, self.starts_on, self.ends_on)):
                raise ValueError("last_minute erlaubt nur days_before.")
        elif t == "custom":
            if self.starts_on is None or self.ends_on is None:
                raise ValueError("custom braucht starts_on und ends_on.")
            if self.starts_on > self.ends_on:
                raise ValueError("starts_on muss <= ends_on sein.")
            if self.min_nights is not None or self.days_before is not None:
                raise ValueError("custom erlaubt nur starts_on/ends_on.")
        return self


class DiscountCreate(DiscountBase):
    """Body für POST — eine neue Rabattregel."""


class DiscountUpdate(BaseModel):
    """PATCH: nur gesendete Felder werden gesetzt. discount_type ist NICHT
    änderbar (sonst müssten alle Typ-Felder neu validiert werden) — für einen
    Typwechsel: löschen + neu anlegen."""

    discount_bps: int | None = Field(default=None, ge=1, le=10000)
    active: bool | None = None
    min_nights: int | None = Field(default=None, ge=1)
    days_before: int | None = Field(default=None, ge=0)
    starts_on: date | None = None
    ends_on: date | None = None
    name: dict[str, str] | None = None


class DiscountResponse(DiscountBase):
    id: str
    property_id: str
    created_at: str | None = None
    updated_at: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
