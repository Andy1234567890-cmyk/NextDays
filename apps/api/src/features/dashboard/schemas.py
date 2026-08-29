"""Pydantic-Schemas für den dashboard-Slice."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class DashboardEntrySnapshot(BaseModel):
    guest_name: str | None = None
    property_title: str | None = None
    channel: str
    ota_name: str | None = None
    check_in: str
    check_out: str
    status: str


class DashboardKpiSnapshot(BaseModel):
    value: float
    change_pct: float | None = None


class DashboardPropertySnapshot(BaseModel):
    id: str
    title: str
    property_type: str
    status: str
    city: str | None = None
    country: str | None = None
    max_guests: int | None = None


class DashboardVoiceSnapshot(BaseModel):
    today: str
    checkouts_today: list[DashboardEntrySnapshot] = Field(default_factory=list)
    checkins_today: list[DashboardEntrySnapshot] = Field(default_factory=list)
    upcoming: list[DashboardEntrySnapshot] = Field(default_factory=list)
    properties: list[DashboardPropertySnapshot] = Field(default_factory=list)
    checkins_30d: DashboardKpiSnapshot
    revenue_30d: DashboardKpiSnapshot | None = None
    confirmed_30d: DashboardKpiSnapshot
    currency: str


class DashboardVoiceRequest(BaseModel):
    utterance: str
    snapshot: DashboardVoiceSnapshot


class DashboardVoiceResponse(BaseModel):
    reply: str


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


class OnboardingStatus(BaseModel):
    """Onboarding-Fortschritt des Tenants. Das Dashboard zeigt den Assistenten,
    bis `completed` true ist."""

    # customer_type: "new" (Neukunde, legt Objekte neu an) vs. "switch"
    # (Wechselkunde, importiert Bestands-Listings via Channex). None = Weiche
    # noch offen.
    customer_type: Literal["new", "switch"] | None = None
    has_ota: bool | None = None
    selected_portals: list[str] = Field(default_factory=list)
    company_data_set: bool = False
    # imported_from_ota: mindestens ein Bestands-Listing wurde importiert
    # (Fortschritt des Import-Schritts beim Wechselkunden, nicht nur Absicht).
    imported_from_ota: bool = False
    object_created: bool = False
    # Anzahl der ECHTEN Objekte — ohne das Geruest „Airbnb-Uebernahme laeuft",
    # das beim Klick auf „Airbnb verbinden" entsteht und nur den Platz freihaelt.
    # Die Oberflaeche zeigt diese Zahl („n Objekte uebernommen"); rechnete sie
    # sie selbst aus `/properties` aus, waere das eine zweite Wahrheit, die vom
    # Server abweicht, sobald sich der Platzhalter aendert (Wurzel 4).
    object_count: int = 0
    price_set: bool = False
    channels_done: bool = False
    # Laeuft ein Abo (`tenant_subscription.status` in active/trialing)?
    # Zusammen mit `company_data_set` entscheidet es, ob die Oberflaeche
    # ueberhaupt bedienbar ist: ohne Firmendaten und ohne Abo kann der Betrieb
    # weder veroeffentlichen noch Geld empfangen — dann fuehrt jeder
    # Menuepunkt in eine Sackgasse.
    #
    # Serverseitig GEMESSEN, nicht aus einem Flag: dasselbe Problem wie bei
    # `company_data_set`, das am 29.08.2026 in 4 Betrieben auf `true` stand,
    # waehrend es in der ganzen DB genau EIN Abrechnungsprofil gab.
    subscription_active: bool = False
    # Laeuft gerade die kostenlose Testphase (Status genau `trialing`)?
    # Getrennt von `subscription_active`, weil beide verschiedene Fragen
    # beantworten: „darf der Betrieb arbeiten" (ja, auch im Test) gegenueber
    # „wurde schon gezahlt" (nein). Der Hinweis im Dashboard haengt an DIESER
    # Unterscheidung — ohne sie saehe die Testphase aus wie ein bezahltes Abo.
    in_trial: bool = False
    # Ende der Testphase, ISO-8601, aus Stripe (`current_period_end` waehrend
    # `trialing`). None, wenn keine Testphase laeuft ODER Stripe keinen Wert
    # geliefert hat — dann zeigt die Oberflaeche kein Datum statt eines
    # gerechneten (Wurzel 4/5b: fremder Zeitpunkt, fremde Quelle).
    trial_ends_at: str | None = None
    completed: bool = False


class OnboardingUpdate(BaseModel):
    """Teil-Update des Onboarding-Status (nur gesetzte Felder werden geschrieben)."""

    customer_type: Literal["new", "switch"] | None = None
    has_ota: bool | None = None
    selected_portals: list[str] | None = None
    company_data_set: bool | None = None
    imported_from_ota: bool | None = None
    object_created: bool | None = None
    price_set: bool | None = None
    channels_done: bool | None = None
    completed: bool | None = None
