"""Schemas des Bereichs »kontenplan« (Buchungskonten, Kostenstellen,
Nummernkreise, Zahlungsarten).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — so passt
der Bestand (`web/services/bookingAccountService.ts` liest `number`, `name`,
`type`, `automaticBooking`, `createdAt`). `extra="ignore"`, weil der alte
Dienst Felder wie `companyUid` mitschickt, die hier nichts entscheiden — der
Tenant kommt IMMER aus dem JWT (Wurzel 3).

Die Literale MÜSSEN mit den `check`-Klauseln in 0671/0673 deckungsgleich
bleiben (Regel „DB-CHECK und Pydantic-Literal deckungsgleich": fehlt ein Wert
im Schema, stirbt das LESEN mit 500).
"""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

# Deckungsgleich mit 0671 `check (type in (...))`.
AccountType = Literal["INCOME", "EXPENSE", "ASSET", "LIABILITY"]
ACCOUNT_TYPES: frozenset[str] = frozenset({"INCOME", "EXPENSE", "ASSET", "LIABILITY"})
# Deckungsgleich mit 0671 `check (kontenrahmen in (...))`.
Kontenrahmen = Literal["SKR03", "SKR04"]
KONTENRAHMEN: frozenset[str] = frozenset({"SKR03", "SKR04"})
# Deckungsgleich mit 0673 `check (type in (...))`.
PaymentMethodType = Literal["bank_transfer", "cash", "card", "paypal", "direct_debit", "other"]
PAYMENT_METHOD_TYPES: frozenset[str] = frozenset(
    {"bank_transfer", "cash", "card", "paypal", "direct_debit", "other"}
)

# Harte Obergrenze für Listen (GEMEINSAME-REGELN: limit ≤ 500).
LIMIT_MAX = 500


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


def _kontonummer_pruefen(wert: str) -> str:
    """Kontonummer: 1–10 Ziffern (0671-Check). Führende/abschließende Leerzeichen
    fallen weg, alles andere ist ein 422 — nie stumm „korrigieren"."""
    nummer = wert.strip()
    if not nummer.isdigit() or len(nummer) > 10:
        raise ValueError("Kontonummer muss aus 1 bis 10 Ziffern bestehen.")
    return nummer


# --- Buchungskonten -----------------------------------------------------------


class BookingAccountCreate(_Camel):
    number: str = Field(min_length=1, max_length=10)
    name: str = Field(min_length=1, max_length=200)
    type: AccountType
    # KEIN Default: leer heißt „Satz nicht festgelegt" (Wurzel 4).
    tax_rate: Decimal | None = Field(default=None, ge=0, le=100)
    kontenrahmen: Kontenrahmen | None = None
    skr_reference: str | None = Field(default=None, max_length=10)
    description: str | None = Field(default=None, max_length=1000)
    automatic_booking: bool = False
    active: bool = True

    @field_validator("number")
    @classmethod
    def _nummer(cls, wert: str) -> str:
        return _kontonummer_pruefen(wert)


class BookingAccountUpdate(_Camel):
    """PUT/PATCH: nur gesetzte Felder werden geschrieben. `isSystem` ist bewusst
    NICHT änderbar — ein Systemkonto entsteht nur durch den Standard-Import."""

    number: str | None = Field(default=None, min_length=1, max_length=10)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    type: AccountType | None = None
    tax_rate: Decimal | None = Field(default=None, ge=0, le=100)
    kontenrahmen: Kontenrahmen | None = None
    skr_reference: str | None = Field(default=None, max_length=10)
    description: str | None = Field(default=None, max_length=1000)
    automatic_booking: bool | None = None
    active: bool | None = None

    @field_validator("number")
    @classmethod
    def _nummer(cls, wert: str | None) -> str | None:
        return None if wert is None else _kontonummer_pruefen(wert)


class BookingAccountResponse(_Camel):
    id: str
    tenant_id: str
    number: str
    name: str
    type: AccountType
    tax_rate: Decimal | None = None
    kontenrahmen: Kontenrahmen | None = None
    skr_reference: str | None = None
    description: str | None = None
    automatic_booking: bool
    is_system: bool
    active: bool
    created_at: datetime
    updated_at: datetime


class ImportStandardResult(_Camel):
    """Ergebnis von POST /booking-accounts/import-standard."""

    kontenrahmen: Kontenrahmen
    angelegt: int
    uebersprungen: int
    accounts: list[BookingAccountResponse]


# --- Kostenstellen -------------------------------------------------------------


class CostCenterCreate(_Camel):
    number: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    property_id: str | None = None
    active: bool = True

    @field_validator("number", "name")
    @classmethod
    def _trim(cls, wert: str) -> str:
        wert = wert.strip()
        if not wert:
            raise ValueError("Darf nicht leer sein.")
        return wert


class CostCenterUpdate(_Camel):
    number: str | None = Field(default=None, min_length=1, max_length=20)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    property_id: str | None = None
    active: bool | None = None


class CostCenterResponse(_Camel):
    id: str
    tenant_id: str
    number: str
    name: str
    description: str | None = None
    property_id: str | None = None
    active: bool
    created_at: datetime
    updated_at: datetime


# --- Zahlungsarten -------------------------------------------------------------


class PaymentMethodCreate(_Camel):
    name: str = Field(min_length=1, max_length=120)
    type: PaymentMethodType
    # KEIN Default (Wurzel 4): leer = kein Zahlungsziel hinterlegt.
    payment_term_days: int | None = Field(default=None, ge=0, le=365)
    payment_account_id: str | None = None
    is_default: bool = False
    active: bool = True
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("name")
    @classmethod
    def _trim(cls, wert: str) -> str:
        wert = wert.strip()
        if not wert:
            raise ValueError("Name darf nicht leer sein.")
        return wert


class PaymentMethodUpdate(_Camel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: PaymentMethodType | None = None
    payment_term_days: int | None = Field(default=None, ge=0, le=365)
    payment_account_id: str | None = None
    is_default: bool | None = None
    active: bool | None = None
    notes: str | None = Field(default=None, max_length=1000)


class PaymentMethodResponse(_Camel):
    id: str
    tenant_id: str
    name: str
    type: PaymentMethodType
    payment_term_days: int | None = None
    payment_account_id: str | None = None
    is_default: bool
    active: bool
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


# --- Nummernkreise -------------------------------------------------------------

# Präfix/Suffix: Buchstaben, Ziffern, Bindestrich, Schrägstrich, Punkt, Unterstrich.
# Kein Leerzeichen, keine Anführungszeichen — die Nummer landet in Dateinamen,
# E-Rechnungs-XML und DATEV-Exporten (Wurzel 8: kein roher Client-Text).
_PRAEFIX_MUSTER = r"^[A-Za-z0-9._/-]{0,20}$"
PADDING_MIN = 1
PADDING_MAX = 10


class NumberSequenceUpdate(_Camel):
    """PATCH /number-sequences/{sequence}.

    Entweder `format` (`RE-{number:4}/26`, wie `_kreis_als_bestand` es liefert)
    ODER die Einzelfelder `prefix`/`suffix`/`padding`. `nextNumber` (Startwert)
    nimmt der Server nur an, solange noch KEINE Nummer gezogen wurde — sonst
    409 (GoBD: ein Zähler mit vergebenen Nummern wird nicht verstellt).
    """

    format: str | None = Field(default=None, max_length=60)
    prefix: str | None = Field(default=None, pattern=_PRAEFIX_MUSTER)
    suffix: str | None = Field(default=None, pattern=_PRAEFIX_MUSTER)
    padding: int | None = Field(default=None, ge=PADDING_MIN, le=PADDING_MAX)
    next_number: int | None = Field(default=None, ge=1, le=999_999_999)


class CreateDefaultsResult(_Camel):
    angelegt: list[str]
    sequences: list[dict]
