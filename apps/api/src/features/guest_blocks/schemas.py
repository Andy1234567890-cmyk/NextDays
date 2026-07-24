"""Schemas des guest_blocks-Slice (Airbnb „Blockierte Personen", Artikel 4046)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class BlockedGuest(BaseModel):
    """Ein blockierter Plattform-Gast in der Liste des Betriebs.

    name/email sind gast-sichere Anzeigefelder aus portal_guests (der Betrieb
    kennt den Gast ohnehin aus der Kommunikation). Können None sein → UI zeigt „—".
    """

    id: str
    portal_guest_id: str
    name: str | None = None
    email: str | None = None
    reason: str | None = None
    created_at: str | None = None


class BlockGuestRequest(BaseModel):
    """Einen Plattform-Gast blockieren. Der Gast wird über seine portal_guest_id
    identifiziert (aus der Nachrichten-/Buchungshistorie des Betriebs)."""

    portal_guest_id: str = Field(min_length=1)
    reason: str | None = Field(default=None, max_length=1000)
