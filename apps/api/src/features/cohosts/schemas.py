"""Schemas des cohosts-Slice (Co-Gastgeber, Plattform-Marktplatz)."""
from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


class CohostAccess(StrEnum):
    """Zugriffsstufen — genau die drei von Airbnb (Artikel 1534)."""

    full = "full"
    calendar_messaging = "calendar_messaging"
    calendar = "calendar"


class CohostStatus(StrEnum):
    pending = "pending"
    active = "active"
    declined = "declined"
    revoked = "revoked"


class Cohost(BaseModel):
    """Ein Co-Gastgeber eines Objekts (Sicht des Eigentümers)."""

    id: str
    property_id: str
    user_id: str
    access: CohostAccess
    status: CohostStatus
    note: str | None = None
    created_at: datetime
    accepted_at: datetime | None = None
    # Anzeigedaten des Co-Gastgebers. Nachgeladen, weil er in einem anderen
    # Tenant sitzt und nicht über einen Join erreichbar ist.
    full_name: str | None = None
    email: str | None = None
    # Vereinbarte Beteiligung je Buchung (zusätzlich zur Plattform-Gebühr).
    share_kind: str = "none"
    share_bps: int | None = None
    share_fixed_cents: int | None = None
    share_currency: str | None = None


class CohostInvite(BaseModel):
    """Eine Einladung aussprechen."""

    email: EmailStr
    access: CohostAccess
    note: str | None = Field(default=None, max_length=500)


class CohostInviteResponse(BaseModel):
    """Antwort auf eine Einladung.

    ``link`` ist der Einladungslink zum Weitergeben. Solange kein Mailversand
    existiert (eigener Auftrag), ist das der Weg zum Empfänger — bewusst
    sichtbar statt eines stillen Versands, der nie ankommt.
    """

    id: str
    email: str
    access: CohostAccess
    expires_at: datetime
    link: str


class CohostInvitation(BaseModel):
    """Eine offene Einladung (Sicht des Eigentümers). Ohne Token."""

    id: str
    property_id: str
    email: str
    access: CohostAccess
    note: str | None = None
    expires_at: datetime
    created_at: datetime


class CohostAccessUpdate(BaseModel):
    """Zugriffsstufe eines bestehenden Co-Gastgebers ändern."""

    access: CohostAccess


class ShareKind(StrEnum):
    """Art der Beteiligung je Buchung (Airbnb: „percentage or fixed amount")."""

    none = "none"
    percent = "percent"
    fixed = "fixed"


class CohostShareUpdate(BaseModel):
    """Beteiligung eines Co-Gastgebers festlegen.

    Die Plattform-Gebühr bleibt davon unberührt — diese Beteiligung kommt
    obendrauf und geht zulasten des Gastgebers.
    """

    share_kind: ShareKind
    # Basispunkte (500 = 5 %). Nur bei 'percent'.
    share_bps: int | None = Field(default=None, ge=1, le=10000)
    # Fixer Betrag in Cent. Nur bei 'fixed'.
    share_fixed_cents: int | None = Field(default=None, ge=1)
    # Währung des Fixbetrags — ohne sie wäre der Betrag bedeutungslos.
    share_currency: str | None = Field(default=None, min_length=3, max_length=3)

    @model_validator(mode="after")
    def _stimmig(self) -> CohostShareUpdate:
        """Die Felder müssen zur gewählten Art passen.

        Dieselbe Regel steht als CHECK in der DB (0214) — hier fängt sie den
        Fehler früher ab und mit einer verständlichen Meldung.
        """
        if self.share_kind is ShareKind.none:
            if (
                self.share_bps is not None
                or self.share_fixed_cents is not None
                or self.share_currency is not None
            ):
                raise ValueError(
                    "Ohne Beteiligung dürfen weder Satz noch Betrag gesetzt sein."
                )
        elif self.share_kind is ShareKind.percent:
            if self.share_bps is None:
                raise ValueError("Prozentuale Beteiligung braucht einen Satz.")
            if self.share_fixed_cents is not None:
                raise ValueError(
                    "Prozentuale Beteiligung und Fixbetrag schließen sich aus."
                )
        elif self.share_kind is ShareKind.fixed:
            if self.share_fixed_cents is None:
                raise ValueError("Fixe Beteiligung braucht einen Betrag.")
            if not self.share_currency:
                raise ValueError("Fixe Beteiligung braucht eine Währung.")
            if self.share_bps is not None:
                raise ValueError(
                    "Fixbetrag und prozentuale Beteiligung schließen sich aus."
                )
        return self


class CohostStripeStatus(BaseModel):
    """Stand des Stripe-Kontos eines Co-Gastgebers.

    Ohne auszahlungsbereites Konto kann keine Beteiligung fließen — deshalb
    Pflicht, bevor eine Einladung angenommen werden kann.
    """

    verbunden: bool
    payouts_enabled: bool = False
    charges_enabled: bool = False
    # Was Stripe noch braucht (requirements.currently_due) — damit die
    # Oberfläche sagen kann, WAS fehlt, statt nur „nicht bereit".
    offene_anforderungen: list[str] = []
    # Onboarding-Link, falls noch etwas fehlt.
    onboarding_url: str | None = None


class CohostStripeCreate(BaseModel):
    """Auszahlungskonto anlegen."""

    email: EmailStr
    # ISO-3166-1 alpha-2. Bestimmt bei Stripe die KYC-Pflichtfelder.
    country: str = Field(min_length=2, max_length=2)
    business_type: Literal["individual", "company"] = "individual"


class CohostOnboardingRequest(BaseModel):
    """Onboarding-Link anfordern."""

    # Wohin Stripe nach dem Onboarding zurückkehrt.
    return_url: str = Field(min_length=1, max_length=500)


class CohostPayout(BaseModel):
    """Eine Beteiligung an einer konkreten Buchung."""

    id: str
    reservation_id: str
    share_kind: str
    share_bps: int | None = None
    gross_amount_cents: int
    payout_amount_cents: int
    currency: str
    status: str
    paid_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime


class PendingInvitation(BaseModel):
    """Eine an MICH gerichtete Einladung (Sicht des Eingeladenen)."""

    id: str
    property_id: str
    property_title: str | None = None
    access: CohostAccess
    note: str | None = None
    expires_at: datetime
    # Wer einlädt — sonst nimmt man eine Einladung von einem Unbekannten an.
    inviter_name: str | None = None


class CohostAssignment(BaseModel):
    """Ein Objekt, das ich als Co-Gastgeber mitbetreue."""

    id: str
    property_id: str
    property_title: str | None = None
    access: CohostAccess
    accepted_at: datetime | None = None
