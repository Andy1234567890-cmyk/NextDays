"""Schemas des Spenden-Slices."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from .berechnung import MAX_SHARE_BPS


class DonationRecipient(BaseModel):
    """Eine wählbare Spendenorganisation."""

    id: str
    name: str
    description: str | None = None
    website: str | None = None


class DonationSettings(BaseModel):
    """Der eingerichtete Spendenanteil eines Betriebs."""

    # 0 = keine Spende eingerichtet.
    share_bps: int = 0
    recipient_id: str | None = None
    recipient_name: str | None = None
    accepted_at: datetime | None = None
    # Was der Gastgeber maximal setzen kann — nach Abzug von Plattform-Gebühr
    # und bestehenden Beteiligungen. Das Frontend zeigt damit eine echte
    # Obergrenze statt einer geratenen (Wurzel 4).
    max_share_bps: int = 0
    # Feste Plattform-Gebühr, für die Beispielrechnung in der UI.
    platform_fee_bps: int = 0
    # Auszahlungskonto verbunden und abrechnungsfähig? Ohne das ist Spenden
    # sinnlos — es gibt keine Auszahlung, von der etwas abgehen könnte.
    payouts_ready: bool = False


class DonationSettingsUpdate(BaseModel):
    """Spendenanteil festlegen oder ändern."""

    share_bps: int = Field(ge=0, le=MAX_SHARE_BPS)
    # Pflicht, sobald ein Satz > 0 gesetzt wird (der Service prüft das) — nie
    # einen Empfänger raten.
    recipient_id: str | None = None
    # Zustimmung zu den Spendenbedingungen. Ohne sie kein Satz > 0.
    accept_terms: bool = False


class DonationRow(BaseModel):
    """Eine Spendenzeile (je Buchung)."""

    id: str
    reservation_id: str
    recipient_id: str
    recipient_name: str | None = None
    share_bps: int
    gross_amount_cents: int
    amount_cents: int
    reversed_amount_cents: int
    currency: str
    status: str
    created_at: datetime


class DonationSummary(BaseModel):
    """Übersicht je Währung — für die Anzeige „deine Spenden bisher"."""

    currency: str
    total_amount_cents: int
    reversed_amount_cents: int
    count: int


class DonationOverview(BaseModel):
    """Was die Spenden-Ansicht des Gastgebers braucht."""

    settings: DonationSettings
    recipients: list[DonationRecipient]
    summary: list[DonationSummary]
    recent: list[DonationRow]
