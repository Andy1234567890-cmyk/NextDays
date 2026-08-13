"""Schemas des Auszahlungs-Slices."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

PayoutInterval = Literal["daily", "weekly", "monthly"]


class PayoutSettings(BaseModel):
    """Auszahlungsrhythmus eines Betriebs (Booking-Modell)."""

    interval: PayoutInterval = "weekly"
    paused: bool = False
    paused_reason: str | None = None


class PayoutSettingsUpdate(BaseModel):
    """Rhythmus ändern. ``paused`` setzt nur die Plattform, nie der Betrieb."""

    interval: PayoutInterval


class PayoutRow(BaseModel):
    """Eine Auszahlung je Buchung."""

    id: str
    reservation_id: str
    gross_amount_cents: int
    platform_fee_cents: int
    donation_cents: int
    cohost_cents: int
    net_amount_cents: int
    currency: str
    status: str
    due_at: datetime
    paid_at: datetime | None = None


class PayoutAdjustmentRow(BaseModel):
    """Ein Verrechnungsposten (Storno nach Auszahlung, Rückbuchung, Gebühr)."""

    id: str
    reservation_id: str | None = None
    kind: str
    amount_cents: int
    settled_cents: int
    currency: str
    note: str | None = None
    created_at: datetime


class PayoutSummary(BaseModel):
    """Summen je Währung — offen und bereits ausgezahlt."""

    currency: str
    pending_amount_cents: int
    paid_amount_cents: int
    count: int


class PayoutOverview(BaseModel):
    """Was die Auszahlungsansicht braucht — in einem Aufruf."""

    settings: PayoutSettings
    summary: list[PayoutSummary]
    recent: list[PayoutRow]
    adjustments: list[PayoutAdjustmentRow]


# --- Guthaben auf dem verbundenen Stripe-Konto -------------------------------
#
# Zweiter Topf neben dem Plattform-Ledger oben: was der Betrieb selbst kassiert
# hat (Zusatzleistungen + Direktbuchungen als Direct Charge). Beträge in Cent,
# Währung immer mitgeführt — ein Betrieb kann in mehreren Währungen kassieren.

StripePayoutInterval = Literal["manual", "daily", "weekly", "monthly"]


class StripeSaldoPosten(BaseModel):
    """Saldo einer Währung."""

    currency: str
    amount_cents: int


class StripeAuszahlung(BaseModel):
    """Eine Auszahlung des verbundenen Kontos auf dessen Bankkonto."""

    id: str
    amount_cents: int
    currency: str
    status: str
    # true = von Stripe nach Rhythmus ausgelöst, false = vom Betrieb beantragt.
    automatic: bool
    created: str | None = None
    arrival_date: str | None = None
    failure_message: str | None = None


class StripeGuthaben(BaseModel):
    """Was die Abrechnungs-Seite über das verbundene Konto braucht."""

    konto_verbunden: bool
    stripe_account_id: str | None = None
    payouts_enabled: bool = False
    # Rhythmus laut Stripe (leer, solange kein Konto verbunden ist).
    interval: str = ""
    weekly_anchor: str | None = None
    monthly_anchor: int | None = None
    verfuegbar: list[StripeSaldoPosten] = []
    ausstehend: list[StripeSaldoPosten] = []
    letzte_auszahlungen: list[StripeAuszahlung] = []


class StripeAuszahlungAnfordern(BaseModel):
    """Auszahlung beantragen. Ohne Betrag: das gesamte verfügbare Guthaben."""

    currency: str
    amount_cents: int | None = Field(default=None, gt=0)


class StripeRhythmusUpdate(BaseModel):
    """Auszahlungs-Rhythmus, den der Betrieb selbst wählt."""

    interval: StripePayoutInterval
    # Nur bei weekly/monthly relevant; Stripe ignoriert sie sonst.
    weekly_anchor: str | None = None
    monthly_anchor: int | None = Field(default=None, ge=1, le=31)


# --- Protokoll: jede Geldbewegung des verbundenen Kontos ---------------------
#
# „Damit der Kunde alles nachvollziehen kann": eine Zeile je Bewegung, in beide
# Richtungen. Quelle ist Stripe (das Konto selbst), angereichert um unsere
# Zuordnung — welche Buchung, welche Zusatzleistung.

ProtokollRichtung = Literal["eingang", "ausgang"]


class ProtokollEintrag(BaseModel):
    """Eine Geldbewegung auf dem Konto des Betriebs."""

    id: str
    # Stripe-Typ (charge, payment, payout, refund, application_fee, …) — roh,
    # damit die Oberfläche unbekannte Typen anzeigen kann statt sie zu
    # verschlucken.
    typ: str
    richtung: ProtokollRichtung
    amount_cents: int
    fee_cents: int
    # Saldo-Wirkung nach Gebühren. Nur die Summe der net-Werte ergibt den Saldo.
    net_cents: int
    currency: str
    status: str
    created: str | None = None
    # Ab wann der Betrag auszahlbar ist (Abwicklungsfrist).
    available_on: str | None = None
    beschreibung: str | None = None
    # Zuordnung aus UNSEREN Daten, soweit vorhanden.
    reservation_id: str | None = None
    # Bezahlte Zusatzleistungen dieser Bewegung (Namen), für „Wofür war das?".
    zusatzleistungen: list[str] = []


class OffenerPosten(BaseModel):
    """Eine noch NICHT bezahlte Forderung — ein offener Zahlungslink.

    Gehört zum Reiter „Empfangene Zahlungen": Ohne die offene Seite zeigte das
    Protokoll nur, was schon da ist, und nie, worauf der Betrieb noch wartet.
    """

    id: str
    reservation_id: str
    amount_cents: int
    currency: str
    url: str
    positionen: list[str] = []
    created_at: str | None = None


class ProtokollAntwort(BaseModel):
    """Protokoll je Richtung — getrennte Reiter „Empfangen"/„Versendet"."""

    eingang: list[ProtokollEintrag] = []
    ausgang: list[ProtokollEintrag] = []
    # Offene Forderungen (noch nicht bezahlte Zahlungslinks).
    offen: list[OffenerPosten] = []
    konto_verbunden: bool = False
