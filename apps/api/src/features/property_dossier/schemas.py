"""Pydantic-Schemas für den property_dossier-Slice (8-stufige Objektkartei,
Lastenheft §6).

i18n: Enum-artige Felder tragen SPRACHNEUTRALE Keys (z. B. service_type
'caretaker', trade 'electrician') — die Labels leben im Frontend (next-intl).
Kein deutsches/dänisches Wort als Wert.

Stufe 1 liefert den Eigentümer READ-ONLY aus dem verknüpften owners-Datensatz
(owner_properties); die Kartei erfasst KEINE Eigentümer-Stammdaten selbst.
"""

from datetime import date

from pydantic import BaseModel


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


# --- Stufe 1: verknüpfter Eigentümer (READ-ONLY aus owners) ------------------
class LinkedOwner(BaseModel):
    """Read-only-Sicht des via owner_properties verknüpften Eigentümers. Die
    Bearbeitung passiert im owners-Slice (/eigentuemer), nicht hier."""

    owner_id: str
    name: str
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    iban: str | None = None
    bic: str | None = None
    bank_name: str | None = None
    account_holder: str | None = None
    tax_id: str | None = None
    vat_id: str | None = None
    cpr_number: str | None = None
    ownership_share: float | None = None


# --- Stufe 2: Proces & Kontrakt (1:1) ---------------------------------------
class ProcessData(BaseModel):
    first_meeting_at: date | None = None
    contract_sent_at: date | None = None
    contract_signed_at: date | None = None
    onboarding_invoice_sent_at: date | None = None
    onboarding_invoice_paid_at: date | None = None


# --- Stufe 3: Adgang & Teknik (1:1) — nur was NICHT im Gastmodul liegt -------
class AccessData(BaseModel):
    key_status: str | None = None  # Key: agency_extra | owner_only
    key_placement: str | None = None


# --- Stufe 4: Serviceaftaler (1:n) ------------------------------------------
class ServiceAgreementBase(BaseModel):
    service_type: str  # Key: caretaker | window_cleaning | ...
    frequency: str | None = None
    price: float | None = None
    currency: str | None = None  # aus den Daten, kein Default (Wurzel 4)
    notes: str | None = None


class ServiceAgreementResponse(ServiceAgreementBase):
    id: str


# --- Stufe 5: Håndværkere (1:n) + Vollmacht (1:1) ---------------------------
class TradespersonBase(BaseModel):
    trade: str  # Key: electrician | plumbing | ...
    name: str | None = None
    phone: str | None = None
    notes: str | None = None


class TradespersonResponse(TradespersonBase):
    id: str


class EmergencyAuthority(BaseModel):
    authority_mode: str | None = None  # Key: up_to_amount | always_owner
    authority_limit: float | None = None
    currency: str | None = None


# --- Stufe 6: Markedsføring (1:1) -------------------------------------------
class MarketingData(BaseModel):
    photographer_booked_at: date | None = None
    media_received_at: date | None = None
    site_walkthrough_at: date | None = None
    defects_list_sent_at: date | None = None


# --- Stufe 7: Husmappe (1:1) — nur Status, Texte liegen in messaging ---------
class HousebookData(BaseModel):
    welcome_text_status: str | None = None  # Key: received | open
    physical_folder_placed: bool = False


# --- Stufe 8: Annoncering — Plattform-Matrix (1:n) --------------------------
class PlatformLaunchBase(BaseModel):
    platform: str  # Key: native | airbnb | booking | vrbo
    launch_at: date | None = None
    status: str | None = None


class PlatformLaunchResponse(PlatformLaunchBase):
    id: str


# --- Aggregat für Übersicht/PDF ---------------------------------------------
class DossierFull(BaseModel):
    owner: LinkedOwner | None = None  # None = kein Eigentümer zugeordnet
    process: ProcessData
    access: AccessData
    service_agreements: list[ServiceAgreementResponse]
    tradespeople: list[TradespersonResponse]
    emergency_authority: EmergencyAuthority
    marketing: MarketingData
    housebook: HousebookData
    platform_launches: list[PlatformLaunchResponse]
