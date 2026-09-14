"""Schemas des Bereichs »artikel« (Artikelstamm der Buchhaltung).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — so passt
der portierte `web/services/inventoryService.ts` mit minimaler Anpassung
(`itemNumber`, `unitPrice`, `taxRate`, `isFavorite`).

Was hier bewusst FEHLT: alles, was im alten `InventoryItem` Lager war
(currentStock, reservedStock, minStock, Chargen, MHD, Gebinde, Lagerort).
`billing_items` ist eine Preisliste, kein Lager — siehe 0668.

Die Grenzen (Längen, Bereiche) MÜSSEN mit den `check`-Klauseln in 0668
deckungsgleich bleiben (Regel „DB-CHECK und Pydantic-Literal deckungsgleich").
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

# Präfix und doc_type des Nummernkreises. `doc_type` ist der Schlüssel in
# `number_sequences`; das Label „Artikel" für die Nummernkreis-Seite trägt der
# Koordinator in `BuchhaltungService._DOC_TYPE_MAP` nach (siehe Bericht).
NUMMERNKREIS_DOC_TYPE = "item"
NUMMERNKREIS_PREFIX = "ART-"

# Harte Obergrenze für Listen (Regel: limit ≤ 500).
LIMIT_MAX = 500
LIMIT_VORGABE = 200


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


def _gestutzt(wert: str | None) -> str | None:
    if wert is None:
        return None
    wert = wert.strip()
    return wert or None


def _waehrung_pruefen(wert: object) -> str | None:
    """Leer → None (dann gilt die Mandanten-Währung); sonst genau drei
    Buchstaben (ISO 4217), großgeschrieben. Läuft VOR der Typprüfung, damit
    „ dkk " gestutzt wird statt an der Länge zu scheitern."""
    if wert is None:
        return None
    if not isinstance(wert, str):
        raise ValueError("Währung muss ein dreibuchstabiger ISO-Code sein")
    wert = wert.strip().upper()
    if not wert:
        return None
    if len(wert) != 3 or not wert.isalpha():
        raise ValueError("Währung muss ein dreibuchstabiger ISO-Code sein")
    return wert


class BillingItemCreate(_Camel):
    """POST /items.

    `tax_rate` ist PFLICHT — kein Default (Wurzel 4). `currency` darf fehlen:
    dann gilt `tenants.currency`; fehlt auch die, antwortet der Server 422.
    `item_number` darf leer bleiben (dann zieht der Server aus dem Kreis); wird
    eine mitgegeben, muss sie je Betrieb eindeutig sein (sonst 409).
    """

    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    unit: str = Field(min_length=1, max_length=40)
    # Abrechnungsbasis (0698): per_stay | per_night | per_guest | per_guest_night | per_unit.
    basis: str = Field(
        default="per_unit", pattern="^(per_stay|per_night|per_guest|per_guest_night|per_unit)$"
    )
    unit_price: Decimal = Field(ge=0)
    tax_rate: Decimal = Field(ge=0, le=100)
    currency: str | None = None
    category: str | None = Field(default=None, max_length=80)
    is_active: bool = True
    is_favorite: bool = False
    item_number: str | None = Field(default=None, max_length=40)

    @field_validator("name", "unit", mode="after")
    @classmethod
    def _nicht_leer(cls, wert: str) -> str:
        wert = wert.strip()
        if not wert:
            raise ValueError("darf nicht leer sein")
        return wert

    @field_validator("description", "category", "item_number", mode="after")
    @classmethod
    def _stutzen(cls, wert: str | None) -> str | None:
        return _gestutzt(wert)

    @field_validator("currency", mode="before")
    @classmethod
    def _waehrung(cls, wert: object) -> str | None:
        return _waehrung_pruefen(wert)


class BillingItemUpdate(_Camel):
    """PATCH /items/{id}: jedes Feld optional; nur gesetzte Felder werden
    geschrieben (`exclude_unset`). Die Artikelnummer ist NICHT änderbar — sie
    steht bereits auf ausgestellten Belegen als Referenz."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    unit: str | None = Field(default=None, min_length=1, max_length=40)
    basis: str | None = Field(
        default=None, pattern="^(per_stay|per_night|per_guest|per_guest_night|per_unit)$"
    )
    unit_price: Decimal | None = Field(default=None, ge=0)
    tax_rate: Decimal | None = Field(default=None, ge=0, le=100)
    currency: str | None = None
    category: str | None = Field(default=None, max_length=80)
    is_active: bool | None = None
    is_favorite: bool | None = None

    @field_validator("name", "unit", mode="after")
    @classmethod
    def _nicht_leer(cls, wert: str | None) -> str | None:
        if wert is None:
            return None
        wert = wert.strip()
        if not wert:
            raise ValueError("darf nicht leer sein")
        return wert

    @field_validator("description", "category", mode="after")
    @classmethod
    def _stutzen(cls, wert: str | None) -> str | None:
        return _gestutzt(wert)

    @field_validator("currency", mode="before")
    @classmethod
    def _waehrung(cls, wert: object) -> str | None:
        return _waehrung_pruefen(wert)


class FavoriteUpdate(_Camel):
    """POST /items/{id}/favorite: der ZIELZUSTAND, kein Toggle — ein
    Doppelklick setzt zweimal `true` statt an/aus (Wurzel 2)."""

    is_favorite: bool


class BillingItemResponse(_Camel):
    id: str
    tenant_id: str
    item_number: str
    name: str
    description: str | None = None
    unit: str
    basis: str = "per_unit"
    unit_price: Decimal
    tax_rate: Decimal
    currency: str
    category: str | None = None
    is_active: bool
    is_favorite: bool
    usage_count: int
    last_used_at: datetime | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


class UsedResponse(_Camel):
    """POST /items/{id}/used: Stand NACH dem Zählen."""

    id: str
    usage_count: int
    last_used_at: datetime | None = None


class CategoryResponse(_Camel):
    """GET /items/categories: eine Kategorie mit Artikelanzahl (für den
    Filter der Liste und die Vorschläge im Formular)."""

    name: str
    item_count: int
