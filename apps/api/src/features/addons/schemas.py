"""Pydantic-Schemas des addons-Slice (Zusatzleistungen/Upsells je Objekt).

Trennt Katalog (``property_addons``) von gekauften Extras (``reservation_addons``).
Texte sind mehrsprachig (Locale → Text), Beträge serverseitig berechnet.
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class AddonBasis(StrEnum):
    """Abrechnungsbasis eines Upsells."""

    per_stay = "per_stay"
    per_night = "per_night"
    per_guest = "per_guest"
    per_unit = "per_unit"


class AddonSurface(StrEnum):
    """Verkaufsfläche, auf der ein Upsell erscheinen darf."""

    booking_engine = "booking_engine"
    guest_portal = "guest_portal"
    checkin = "checkin"


class AddonAvailability(StrEnum):
    """„Wann anzeigen": vor Check-in (z. B. Früh-Check-in) vs. jederzeit."""

    before_checkin = "before_checkin"
    anytime = "anytime"


class AddonStatus(StrEnum):
    """Zahlstatus eines gekauften Upsells."""

    pending = "pending"
    paid = "paid"
    cancelled = "cancelled"


class AddonBase(BaseModel):
    """Bearbeitbare Katalog-Felder eines Upsells."""

    name: dict[str, str] = Field(default_factory=dict)
    description: dict[str, str] = Field(default_factory=dict)
    media: list[str] = Field(default_factory=list, max_length=5)
    price: float = Field(default=0, ge=0)
    basis: AddonBasis = AddonBasis.per_stay
    mandatory: bool = False
    appears_in: list[AddonSurface] = Field(
        default_factory=lambda: [AddonSurface.booking_engine, AddonSurface.guest_portal]
    )
    available_until: AddonAvailability = AddonAvailability.anytime
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    active: bool = True
    sort_order: int = 0


class AddonCreate(AddonBase):
    """Anlegen — property_id kommt aus dem Pfad, nicht aus dem Body."""


class AddonUpdate(BaseModel):
    """Teil-Update; nur gesetzte Felder werden übernommen."""

    name: dict[str, str] | None = None
    description: dict[str, str] | None = None
    media: list[str] | None = Field(default=None, max_length=5)
    price: float | None = Field(default=None, ge=0)
    basis: AddonBasis | None = None
    mandatory: bool | None = None
    appears_in: list[AddonSurface] | None = None
    available_until: AddonAvailability | None = None
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    active: bool | None = None
    sort_order: int | None = None


class AddonResponse(AddonBase):
    id: str
    property_id: str


class AddonListResponse(BaseModel):
    items: list[AddonResponse]
    total: int
    # Währung des Objekts (aus dem Rate-Plan) für die Anzeige — None, wenn keine
    # hinterlegt ist (Mehrwährung über 27 EU-Länder; kein €-Fallback).
    currency: str | None = None


class AddonLibraryEntry(BaseModel):
    """Eine Zusatzleistung eines ANDEREN Objekts, übernehmbar auf dieses.

    `property_title` sagt, woher sie stammt — bei zwei gleich benannten
    „Reinigung" ist das der einzige Unterschied, den der Betrieb sieht.
    """

    addon: AddonResponse
    property_id: str
    property_title: str | None = None


class AddonLibraryResponse(BaseModel):
    """Bibliothek der übernehmbaren Zusatzleistungen.

    `currency` ist die Währung des ZIELOBJEKTS (aus seinem Rate-Plan). Ist sie
    `None`, ist die Liste leer und die Oberfläche sagt warum — kein geratenes
    EUR (Wurzel 4).
    """

    currency: str | None = None
    items: list[AddonLibraryEntry]


class AddonApplyRequest(BaseModel):
    """Zielobjekte, auf die dieselbe Zusatzleistung übertragen wird.

    Die Obergrenze ist eine harte Schranke gegen unbegrenzte Listen (Wurzel 8);
    kein Betrieb pflegt in einem Zug mehr Objekte als das.
    """

    property_ids: list[str] = Field(default_factory=list, max_length=500)


class AddonApplyResponse(BaseModel):
    """Objekte, auf die die Zusatzleistung wirklich geschrieben wurde."""

    applied_to: list[str]


class ReservationAddonResponse(BaseModel):
    """Ein gekauftes Upsell (Snapshot + Status)."""

    id: str
    reservation_id: str
    addon_id: str | None = None
    name: dict[str, str] = Field(default_factory=dict)
    price: float
    basis: AddonBasis
    tax_rate: float | None = None
    qty: int
    total: float
    status: AddonStatus
    charged_at: str | None = None
    created_at: str | None = None


class ReservationAddonListResponse(BaseModel):
    items: list[ReservationAddonResponse]
    total: float
    currency: str | None = None
    # Gästezahl der Buchung — die Vorbelegung des Mengenfeldes bei „pro
    # Gast"-Leistungen. Sie steht in der Reservierung, nicht am Add-on; ohne sie
    # müsste die Oberfläche sie erraten oder eine zweite Abfrage stellen.
    guests: int | None = None


class ReservationAddonAdd(BaseModel):
    """Schnell-Hinzufügen eines Katalog-Add-ons zu einer bestehenden Buchung.

    `qty = 0` heißt „nicht angegeben": der Server setzt dann die Vorbelegung der
    Abrechnungsbasis ein (bei `per_guest` die Gästezahl der Buchung, sonst 1,
    `pricing.vorbelegte_menge`). Der Default war früher 1 — damit hätte ein
    Client, der die Menge gar nicht kennt, jede Wäsche-Buchung stillschweigend
    auf eine Person gesetzt.
    """

    addon_id: str
    qty: int = Field(default=0, ge=0, le=99)


class ReservationAddonQty(BaseModel):
    """Menge einer bereits gebuchten Zusatzleistung ändern.

    Die Obergrenze spiegelt `service._MAX_ADDON_QTY` (Wurzel 8) — ein Tippfehler
    darf keine vierstellige Rechnung erzeugen.
    """

    qty: int = Field(ge=1, le=99)


class ZahlungslinkResponse(BaseModel):
    """Stripe-Zahlungslink über die offenen Zusatzleistungen einer Buchung.

    Beträge in Cent (kleinste Einheit), damit nichts über Float-Rundung
    verloren geht. ``application_fee_cents`` ist der Anteil, den die Plattform
    beim Charge einbehält (Satz ``fee_bps``, 500 = 5,00 %).
    """

    id: str
    reservation_id: str
    url: str
    currency: str
    amount_cents: int
    application_fee_cents: int
    fee_bps: int
    status: str
    # Anzahl der Zusatzleistungen, die dieser Link abdeckt.
    positionen: int
    paid_at: str | None = None
    created_at: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
