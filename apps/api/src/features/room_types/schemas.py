"""Pydantic-Schemas für den room_types-Slice (Zimmerkategorien eines Hotels).

Eine room_types-Zeile schaltet die Property in den Hotel-Modus (0140): mehrere
Zimmerkategorien je Objekt, Verfügbarkeit als Zahl freier Zimmer. Ohne Zeile
bleibt das Ferienwohnungs-Modell (eine Einheit, binär). Die occ_*-Felder
spiegeln die Channex-Pflichtfelder; default_occupancy darf occ_adults nicht
übersteigen (Channex-Regel, DB-Check in 0140).
"""
from pydantic import BaseModel, Field, model_validator


class RoomTypeCreate(BaseModel):
    property_id: str
    title: str = Field(min_length=1, max_length=255)
    count_of_rooms: int = Field(ge=1)
    occ_adults: int = Field(ge=1)
    occ_children: int = Field(default=0, ge=0)
    occ_infants: int = Field(default=0, ge=0)
    default_occupancy: int = Field(ge=1)

    @model_validator(mode="after")
    def _default_le_adults(self) -> "RoomTypeCreate":
        if self.default_occupancy > self.occ_adults:
            raise ValueError("default_occupancy darf occ_adults nicht übersteigen.")
        return self


class RoomTypeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    count_of_rooms: int | None = Field(default=None, ge=1)
    occ_adults: int | None = Field(default=None, ge=1)
    occ_children: int | None = Field(default=None, ge=0)
    occ_infants: int | None = Field(default=None, ge=0)
    default_occupancy: int | None = Field(default=None, ge=1)
    position: int | None = Field(default=None, ge=0)


class RoomTypeResponse(BaseModel):
    id: str
    property_id: str
    title: str
    count_of_rooms: int
    occ_adults: int
    occ_children: int
    occ_infants: int
    default_occupancy: int
    position: int


class RoomTypeListResponse(BaseModel):
    items: list[RoomTypeResponse] = []
    total: int = 0


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
