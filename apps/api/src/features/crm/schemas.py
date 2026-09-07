"""Pydantic-Schemas für den crm-Slice (Leads, Notizen, Konvertierung, Partner, Deals).

Adressen strikt getrennt (Straße, Hausnummer, PLZ, Ort, Land — Lastenheft §6);
Land immer ISO-3166-1 alpha-2, Währung immer aus den Daten (Wurzel 4).
"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from src.core.countries import normalize_country
from src.features.owner_statements.currencies import normalize_currency
from src.features.properties.schemas import PropertyType

from .common import DiscountKind, LeadSource, LeadStatus


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


def _land_iso2(value: str | None) -> str | None:
    """Land IMMER als ISO-2-Code speichern; leer bleibt leer; unbekannt → 422."""
    if value is None or not value.strip():
        return None
    code = normalize_country(value)
    if code is None:
        raise ValueError(
            f"Unbekanntes Land: {value!r}. Bitte ein gültiges Land wählen "
            "(ISO-3166-1 alpha-2, z. B. DK)."
        )
    return code


def _leer_zu_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


# --- Leads -------------------------------------------------------------------

class LeadBase(BaseModel):
    """Stammdaten des Interessenten + Eckdaten des potenziellen Objekts."""

    name: str = Field(min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=50)
    lead_source: LeadSource | None = None

    # Anschrift des Interessenten (§6, getrennt). `address` (Freitext, 0013)
    # bleibt für Import/Altbestand lesbar, wird aber nicht mehr gepflegt.
    street: str | None = Field(default=None, max_length=200)
    house_number: str | None = Field(default=None, max_length=20)
    postal_code: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=120)
    country: str | None = None

    # Potenzielles Objekt: Anschrift getrennt, Fläche, Kapazität.
    object_street: str | None = Field(default=None, max_length=200)
    object_house_number: str | None = Field(default=None, max_length=20)
    object_postal_code: str | None = Field(default=None, max_length=20)
    object_city: str | None = Field(default=None, max_length=120)
    object_country: str | None = None
    object_sqm: int | None = Field(default=None, ge=1, le=100000)
    object_max_guests: int | None = Field(default=None, ge=1, le=99)

    # Zuständigkeit + Wiedervorlage.
    assigned_user_id: str | None = None
    next_action_at: datetime | None = None

    _land = field_validator("country", "object_country")(_land_iso2)
    _leer = field_validator(
        "email", "phone", "street", "house_number", "postal_code", "city",
        "object_street", "object_house_number", "object_postal_code", "object_city",
    )(_leer_zu_none)


class LeadCreate(LeadBase):
    """Neuer Lead. Status ist IMMER `new` (serverseitig gesetzt). Eine erste
    Notiz kann mitkommen — sie landet im Verlauf (`lead_notes`), nicht in einem
    überschreibbaren Feld."""

    erste_notiz: str | None = Field(default=None, max_length=5000)


class LeadUpdate(BaseModel):
    """Partielle Aktualisierung. `status` folgt dem Zustandsgraphen
    (`common.LEAD_TRANSITIONS`); `lost` verlangt `lost_reason`."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=50)
    lead_source: LeadSource | None = None
    street: str | None = Field(default=None, max_length=200)
    house_number: str | None = Field(default=None, max_length=20)
    postal_code: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=120)
    country: str | None = None
    object_street: str | None = Field(default=None, max_length=200)
    object_house_number: str | None = Field(default=None, max_length=20)
    object_postal_code: str | None = Field(default=None, max_length=20)
    object_city: str | None = Field(default=None, max_length=120)
    object_country: str | None = None
    object_sqm: int | None = Field(default=None, ge=1, le=100000)
    object_max_guests: int | None = Field(default=None, ge=1, le=99)
    assigned_user_id: str | None = None
    next_action_at: datetime | None = None
    status: LeadStatus | None = None
    lost_reason: str | None = Field(default=None, max_length=1000)

    _land = field_validator("country", "object_country")(_land_iso2)


class LeadResponse(LeadBase):
    id: str
    tenant_id: str
    status: LeadStatus
    lost_reason: str | None = None
    # Altfeld aus 0013 — nur lesbar, der Verlauf liegt in `lead_notes`.
    address: str | None = None
    object_address: str | None = None
    notes: str | None = None
    converted_owner_id: str | None = None
    converted_property_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class LeadListResponse(BaseModel):
    items: list[LeadResponse]
    total: int
    offset: int
    limit: int


class LeadNoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)

    @field_validator("body")
    @classmethod
    def _nicht_leer(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Die Notiz darf nicht leer sein.")
        return v.strip()


class LeadNoteResponse(BaseModel):
    id: str
    lead_id: str
    author_id: str | None = None
    body: str
    created_at: datetime | None = None


class LeadConvertRequest(BaseModel):
    """Lead → Eigentümer (+ optional Objekt-Gerüst).

    Alles, was das Objekt BRAUCHT und der Lead nicht sicher trägt, kommt
    explizit mit: Titel und Typ. Fehlt eines davon (oder `object_max_guests`
    am Lead), antwortet der Service 422 mit der Liste der fehlenden Felder —
    kein Objekt mit erfundenem Titel oder geratenem Typ (Wurzel 4).
    """

    mit_objekt: bool = False
    property_title: str | None = Field(default=None, min_length=1, max_length=200)
    property_type: PropertyType | None = None
    # Vereinbarte Provision des Eigentümers; None = noch nicht vereinbart
    # (owners.default_commission_pct, NULL ≠ 0 %).
    default_commission_pct: float | None = Field(default=None, ge=0, le=100)
    # Portalzugang gleich einrichten (owners-Slice verlangt dafür eine E-Mail).
    portalzugang: bool = False


class LeadConvertResponse(BaseModel):
    lead: LeadResponse
    owner_id: str
    property_id: str | None = None
    # True, wenn der Aufruf nichts Neues angelegt hat (Wiederholung, Wurzel 2).
    bereits_konvertiert: bool = False


# --- Partner -------------------------------------------------------------------

class PartnerBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    street: str | None = Field(default=None, max_length=200)
    house_number: str | None = Field(default=None, max_length=20)
    postal_code: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=120)
    country: str | None = None
    contact_name: str | None = Field(default=None, max_length=200)
    contact_email: str | None = Field(default=None, max_length=320)
    contact_phone: str | None = Field(default=None, max_length=50)

    _land = field_validator("country")(_land_iso2)
    _leer = field_validator(
        "street", "house_number", "postal_code", "city",
        "contact_name", "contact_email", "contact_phone",
    )(_leer_zu_none)


class PartnerCreate(PartnerBase):
    pass


class PartnerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    street: str | None = Field(default=None, max_length=200)
    house_number: str | None = Field(default=None, max_length=20)
    postal_code: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=120)
    country: str | None = None
    contact_name: str | None = Field(default=None, max_length=200)
    contact_email: str | None = Field(default=None, max_length=320)
    contact_phone: str | None = Field(default=None, max_length=50)

    _land = field_validator("country")(_land_iso2)


class PartnerResponse(PartnerBase):
    id: str
    tenant_id: str
    # Altfelder aus 0013 (Freitext), nur lesbar.
    address: str | None = None
    contact_info: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PartnerListResponse(BaseModel):
    items: list[PartnerResponse]
    total: int


# --- Deals ----------------------------------------------------------------------

def _pruefe_deal(kind: str, value: float, currency: str | None,
                 von: date | None, bis: date | None) -> None:
    """Fachregeln eines Deals — EINE Stelle für Create UND Update (der Service
    validiert nach dem Merge dieselben Regeln über `DealBase`)."""
    if kind == "fixed" and not currency:
        raise ValueError(
            "Ein Fixbetrag braucht eine Währung — sie wird nicht aus dem Konto geraten."
        )
    if kind == "percent" and value > 100:
        raise ValueError("Ein Prozent-Rabatt kann höchstens 100 % betragen.")
    if kind == "percent" and currency:
        raise ValueError("Ein Prozent-Rabatt trägt keine Währung.")
    if von and bis and bis < von:
        raise ValueError("gueltig_bis darf nicht vor gueltig_von liegen.")


class DealBase(BaseModel):
    discount_kind: DiscountKind
    discount_value: float = Field(ge=0, le=1_000_000)
    # Pflicht bei `fixed`, verboten bei `percent`; nie aus dem Tenant geraten.
    currency: str | None = None
    # Eindeutig je Mandant (Unique-Index 0597). Nur Zeichen, die ein Gast
    # abtippen kann.
    discount_code: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    gueltig_von: date | None = None
    gueltig_bis: date | None = None
    im_gastportal_sichtbar: bool = False

    @field_validator("currency")
    @classmethod
    def _waehrung(cls, v: str | None) -> str | None:
        return normalize_currency(v)

    @field_validator("discount_code", mode="before")
    @classmethod
    def _code_trim(cls, v: object) -> object:
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @model_validator(mode="after")
    def _regeln(self) -> DealBase:
        _pruefe_deal(
            self.discount_kind, self.discount_value, self.currency,
            self.gueltig_von, self.gueltig_bis,
        )
        return self


class DealCreate(DealBase):
    pass


class DealUpdate(BaseModel):
    """Partiell; die Fachregeln prüft der Service auf dem GEMERGTEN Zustand."""

    discount_kind: DiscountKind | None = None
    discount_value: float | None = Field(default=None, ge=0, le=1_000_000)
    currency: str | None = None
    discount_code: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    gueltig_von: date | None = None
    gueltig_bis: date | None = None
    im_gastportal_sichtbar: bool | None = None

    @field_validator("currency")
    @classmethod
    def _waehrung(cls, v: str | None) -> str | None:
        return normalize_currency(v)

    @field_validator("discount_code", mode="before")
    @classmethod
    def _code_trim(cls, v: object) -> object:
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class DealResponse(DealBase):
    id: str
    tenant_id: str
    partner_id: str
    # Ob ein hochgeladenes QR-Bild vorliegt. Der Speicherpfad selbst bleibt
    # intern — die Anzeige holt eine signierte URL über `/qr-url`.
    hat_qr_bild: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DealListResponse(BaseModel):
    items: list[DealResponse]
    total: int


class FileUrlResponse(BaseModel):
    url: str
    expires_in: int
