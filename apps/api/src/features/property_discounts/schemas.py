"""Pydantic-Schemas für Aktionen/Rabatte (property_discounts, 0185 + 0276).

Eine Aktion ist: EIN Betrag (Prozent oder Pauschale) plus BELIEBIG VIELE
Bedingungen, die alle zutreffen müssen (UND). Genau so führt es der
Branchenstandard (Lodgify „Aktionsangebot", live abgelesen 03.08.2026): drei
unabhängige Checkboxen unter „Art der Aktion", dazu Aufenthaltsdaten,
Buchungsdaten und Angebotscodes.

Die alte Form „ein Typ = genau eine Bedingung" (`days_before` bedeutete je nach
Typ „mindestens" ODER „höchstens", `starts_on/ends_on` durfte nur `custom`
haben) ist mit 0276 in allgemeine Achsen überführt. `discount_type` beschreibt
weiter die ART der Aktion für Oberfläche und Rechnung, steuert aber nicht mehr,
welches Feld gelesen wird.

`days_before` bleibt als EINGABE erhalten, weil `gastgeber` und die Doku es
kennen: es wird nach Typ auf `lead_min_days`/`lead_max_days` abgebildet und in
der Antwort daraus zurückgerechnet. Zwei Speicherorte gibt es dafür nicht.
"""
from datetime import date

from pydantic import BaseModel, Field, field_validator, model_validator

DISCOUNT_TYPES: frozenset[str] = frozenset(
    {"length_of_stay", "early_booker", "last_minute", "custom", "promotion"}
)
DISCOUNT_KINDS: frozenset[str] = frozenset({"percent", "fixed"})

# Angebotscode: der Standard begrenzt das Feld live auf 15 Zeichen (Zähler
# „0/15" am Eingabefeld). Mehr als 20 Codes je Aktion ist keine Aktion mehr,
# sondern eine Liste — harte Obergrenze wie bei jeder Liste (Wurzel 8).
PROMO_CODE_MAX_LEN = 15
PROMO_CODES_MAX = 20
STAY_RANGES_MAX = 24


class StayRange(BaseModel):
    """Ein Aufenthaltszeitraum, in dem die Aktion gilt (beide Tage inklusiv)."""

    from_: date = Field(alias="from")
    to: date

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def _reihenfolge(self) -> "StayRange":
        if self.from_ > self.to:
            raise ValueError("Zeitraum: „von“ muss vor „bis“ liegen.")
        return self


class DiscountBase(BaseModel):
    """Betrag + Bedingungen einer Aktion.

    Die je-Typ-Pflichtfelder werden hier (fail-closed 422) UND per DB-CHECK
    erzwungen — ein Längenrabatt ohne Nächtegrenze wäre ein Rabatt auf alles.
    """

    discount_type: str
    # Prozent (Standard) oder Pauschalbetrag in der WÄHRUNG DES OBJEKTS.
    discount_kind: str = "percent"
    discount_bps: int = Field(default=1, ge=1, le=10000)  # 100 = 1,00 %
    discount_amount: float | None = Field(default=None, gt=0)
    active: bool = True
    # Regelsatz, zu dem diese Aktion gehört (0572). None = objektweit, also
    # unabhängig von einer Saison — der Bestand und weiterhin der Normalfall.
    season_id: str | None = None
    # --- Bedingungen (alle optional, alle UND-verknüpft) --------------------
    min_nights: int | None = Field(default=None, ge=1)
    lead_min_days: int | None = Field(default=None, ge=0)
    lead_max_days: int | None = Field(default=None, ge=0)
    stay_ranges: list[StayRange] = Field(
        default_factory=list, max_length=STAY_RANGES_MAX
    )
    booked_from: date | None = None
    booked_to: date | None = None
    promo_codes: list[str] = Field(default_factory=list, max_length=PROMO_CODES_MAX)
    portal_scope: list[str] = Field(default_factory=list, max_length=64)
    # --- Darstellung -------------------------------------------------------
    name: dict[str, str] = Field(default_factory=dict)  # {locale: text}, i18n
    description_html: str | None = None
    photo_url: str | None = None
    # Eingabe-Altform, siehe Modul-Docstring. Wird auf lead_min/lead_max
    # abgebildet; NICHT gespeichert.
    days_before: int | None = Field(default=None, ge=0)

    @field_validator("discount_type")
    @classmethod
    def _type_supported(cls, v: str) -> str:
        if v not in DISCOUNT_TYPES:
            raise ValueError("Unbekannter Rabatt-Typ.")
        return v

    @field_validator("discount_kind")
    @classmethod
    def _kind_supported(cls, v: str) -> str:
        if v not in DISCOUNT_KINDS:
            raise ValueError("Unbekannte Betragsart.")
        return v

    @field_validator("promo_codes")
    @classmethod
    def _codes(cls, v: list[str]) -> list[str]:
        """Codes normalisieren: getrimmt, GROSS, ohne Dubletten.

        Der Gast tippt „sommer26", der Betrieb legte „SOMMER26" an — ohne
        Normalisierung greift die Aktion nicht und niemand findet den Grund.
        """
        codes: list[str] = []
        for roh in v:
            code = str(roh).strip().upper()
            if not code:
                continue
            if len(code) > PROMO_CODE_MAX_LEN:
                raise ValueError(
                    f"Angebotscode darf höchstens {PROMO_CODE_MAX_LEN} Zeichen haben."
                )
            if code not in codes:
                codes.append(code)
        return codes

    @model_validator(mode="after")
    def _bedingungen(self) -> "DiscountBase":
        # `days_before` (Altform) auf die allgemeine Achse heben — nach Typ, denn
        # nur der Typ sagt, ob „mindestens" oder „höchstens" gemeint war.
        if self.days_before is not None:
            if self.discount_type == "early_booker" and self.lead_min_days is None:
                self.lead_min_days = self.days_before
            elif self.discount_type == "last_minute" and self.lead_max_days is None:
                self.lead_max_days = self.days_before

        if self.discount_kind == "percent":
            if self.discount_amount is not None:
                raise ValueError("Prozent-Aktion trägt keinen Pauschalbetrag.")
            # `discount_bps` hat einen Default (1), weil die Spalte NOT NULL ist
            # und eine Pauschal-Aktion sie nicht braucht. Bei einer PROZENT-Aktion
            # wäre dieser Default aber 0,01 % — ein stiller Fantasiewert. Also
            # ausdrücklich verlangen (Wurzel 4).
            if "discount_bps" not in self.model_fields_set:
                raise ValueError("Prozent-Aktion braucht einen Prozentsatz.")
        elif self.discount_amount is None:
            raise ValueError("Pauschalbetrag-Aktion braucht einen Betrag.")

        # Die Art der Aktion verlangt ihre Grenze — sonst wäre sie ein Rabatt auf
        # alles, und niemand hätte das gewollt.
        if self.discount_type == "length_of_stay" and self.min_nights is None:
            raise ValueError("„Mindestaufenthalt“ braucht eine Nächtezahl.")
        if self.discount_type == "early_booker" and self.lead_min_days is None:
            raise ValueError("„Frühbucher“ braucht einen Mindest-Vorlauf.")
        if self.discount_type == "last_minute" and self.lead_max_days is None:
            raise ValueError("„Last Minute“ braucht einen Höchst-Vorlauf.")
        if self.discount_type == "custom" and not self.stay_ranges:
            raise ValueError("Ein Zeitfenster-Rabatt braucht Aufenthaltsdaten.")

        if (
            self.lead_min_days is not None
            and self.lead_max_days is not None
            and self.lead_min_days > self.lead_max_days
        ):
            raise ValueError(
                "Vorlauf: „mindestens“ darf nicht größer als „höchstens“ sein."
            )
        if (
            self.booked_from is not None
            and self.booked_to is not None
            and self.booked_from > self.booked_to
        ):
            raise ValueError("Buchungszeitraum: „von“ muss vor „bis“ liegen.")
        return self


class DiscountCreate(DiscountBase):
    """Body für POST — eine neue Aktion."""


class DiscountUpdate(BaseModel):
    """PATCH: nur gesendete Felder werden gesetzt.

    `discount_type` ist NICHT änderbar (sonst müssten alle Typ-Bedingungen neu
    geprüft werden) — für einen Typwechsel: löschen und neu anlegen.
    """

    discount_kind: str | None = None
    season_id: str | None = None
    discount_bps: int | None = Field(default=None, ge=1, le=10000)
    discount_amount: float | None = Field(default=None, gt=0)
    active: bool | None = None
    min_nights: int | None = Field(default=None, ge=1)
    lead_min_days: int | None = Field(default=None, ge=0)
    lead_max_days: int | None = Field(default=None, ge=0)
    stay_ranges: list[StayRange] | None = Field(default=None, max_length=STAY_RANGES_MAX)
    booked_from: date | None = None
    booked_to: date | None = None
    promo_codes: list[str] | None = Field(default=None, max_length=PROMO_CODES_MAX)
    portal_scope: list[str] | None = Field(default=None, max_length=64)
    name: dict[str, str] | None = None
    description_html: str | None = None
    photo_url: str | None = None

    @field_validator("discount_kind")
    @classmethod
    def _kind_supported(cls, v: str | None) -> str | None:
        if v is not None and v not in DISCOUNT_KINDS:
            raise ValueError("Unbekannte Betragsart.")
        return v


class DiscountResponse(BaseModel):
    """Eine gespeicherte Aktion.

    `days_before` wird aus `lead_min_days`/`lead_max_days` ZURÜCKGERECHNET, damit
    Bestandsclients (gastgeber) und die Doku dieselbe Form weiter sehen — es ist
    eine Ableitung, keine zweite Speicherung.
    """

    id: str
    property_id: str
    # Regelsatz, zu dem die Aktion gehört (0572). None = objektweit.
    season_id: str | None = None
    discount_type: str
    discount_kind: str = "percent"
    discount_bps: int
    discount_amount: float | None = None
    active: bool
    min_nights: int | None = None
    lead_min_days: int | None = None
    lead_max_days: int | None = None
    stay_ranges: list[StayRange] = Field(default_factory=list)
    booked_from: date | None = None
    booked_to: date | None = None
    promo_codes: list[str] = Field(default_factory=list)
    portal_scope: list[str] = Field(default_factory=list)
    name: dict[str, str] = Field(default_factory=dict)
    description_html: str | None = None
    photo_url: str | None = None
    days_before: int | None = None
    created_at: str | None = None
    updated_at: str | None = None


class DiscountLibraryEntry(BaseModel):
    """Eine bestehende Promotion des Betriebs, übernehmbar auf dieses Objekt.

    `promotion` ist der gespeicherte Eintrag selbst — die Übernahme legt genau
    die Aktion an, die woanders schon läuft, statt eine nachgebaute."""

    promotion: "DiscountResponse"
    property_id: str
    property_title: str | None = None


class DiscountLibraryResponse(BaseModel):
    """Auswahlliste für „bestehende Promotion hinzufügen".

    `currency` ist die Währung DIESES Objekts; `None` heißt „noch keine gewählt"
    — dann stehen nur Prozent-Promotions zur Auswahl, weil eine Pauschale ohne
    Währung nicht übernehmbar ist."""

    currency: str | None = None
    items: list[DiscountLibraryEntry] = Field(default_factory=list)


class DiscountApplyRequest(BaseModel):
    """Eine Aktion auf weitere eigene Objekte übertragen. Obergrenze wie bei
    Gebühren/Steuern (Wurzel 8: jede Liste bekommt eine harte Grenze)."""

    property_ids: list[str] = Field(min_length=1, max_length=200)


class DiscountApplyResponse(BaseModel):
    """Objekte, die die Aktion tatsächlich tragen."""

    applied_to: list[str]


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
