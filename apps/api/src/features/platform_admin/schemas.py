"""Schemas des platform_admin-Slice (Plattform-Backoffice)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class PlatformMe(BaseModel):
    """Identität + Rolle des eingeloggten Backoffice-Nutzers.

    Das Frontend gated seine Navigation daran (Support sieht keine Freigabe-
    Aktionen). Die Autorisierung selbst passiert IMMER serverseitig — dieses
    Objekt ist reine Anzeige-Information.
    """

    user_id: str
    email: str | None = None
    platform_role: str
    # True nur bei 'platform_admin' (schreibende Aktionen erlaubt).
    can_write: bool


class AuditEntry(BaseModel):
    """Ein Eintrag des Backoffice-Protokolls."""

    id: str
    actor_user_id: str
    actor_email: str | None = None
    action: str
    target_type: str | None = None
    target_id: str | None = None
    tenant_id: str | None = None
    detail: dict = {}
    ip: str | None = None
    created_at: datetime


class AuditList(BaseModel):
    """Seite des Protokolls (neueste zuerst)."""

    items: list[AuditEntry]
    total: int


class TenantSummary(BaseModel):
    """Ein Betrieb in der Backoffice-Liste (Kennzahlen, keine Detaildaten)."""

    id: str
    name: str
    country: str | None = None
    currency: str | None = None
    account_type: str | None = None
    business_type: str | None = None
    created_at: datetime
    # Abgeleitete Kennzahlen (aus properties/users), damit die Liste ohne
    # Nachladen einschätzbar ist.
    property_count: int = 0
    active_property_count: int = 0
    user_count: int = 0


class TenantList(BaseModel):
    items: list[TenantSummary]
    total: int


class TenantDetail(TenantSummary):
    """Detailsicht eines Betriebs inkl. Zahlungs-/Abo-Status."""

    # Aus tenant_billing_profile: darf dieser Betrieb überhaupt verkaufen?
    stripe_charges_enabled: bool = False
    stripe_account_id: str | None = None
    # Aus tenant_subscription (falls vorhanden).
    subscription_status: str | None = None


class PlatformUser(BaseModel):
    """Ein Betriebs-Nutzer (Supply-Seite) in der Registrierungs-Übersicht."""

    id: str
    tenant_id: str | None = None
    tenant_name: str | None = None
    email: str | None = None
    full_name: str | None = None
    role: str | None = None
    created_at: datetime


class PlatformUserList(BaseModel):
    items: list[PlatformUser]
    total: int


class PlatformGuest(BaseModel):
    """Ein Plattform-Gast (Demand-Seite, portal_guests)."""

    id: str
    email: str | None = None
    name: str | None = None
    preferred_locale: str | None = None
    preferred_currency: str | None = None
    marketing_opt_in: bool | None = None
    created_at: datetime


class PlatformGuestList(BaseModel):
    items: list[PlatformGuest]
    total: int


class ModerationProperty(BaseModel):
    """Ein Objekt in der Freigabe-Warteschlange des Betreibers."""

    id: str
    tenant_id: str
    tenant_name: str | None = None
    title: str
    city: str | None = None
    country: str | None = None
    status: str
    moderation_status: str
    moderation_note: str | None = None
    moderation_submitted_at: datetime | None = None
    moderation_reviewed_at: datetime | None = None
    photos: list[str] = []
    max_guests: int | None = None
    currency: str | None = None


class ModerationList(BaseModel):
    items: list[ModerationProperty]
    total: int


class ModerationDecision(BaseModel):
    """Entscheidung des Betreibers über ein Objekt.

    Bei einer Ablehnung ist die Begründung Pflicht — sie wird dem Gastgeber
    angezeigt, damit er nachbessern kann (eine wortlose Ablehnung wäre für ihn
    nicht handhabbar).
    """

    note: str | None = Field(default=None, max_length=1000)


class FinanzKennzahlen(BaseModel):
    """Aggregierte Finanzsicht des Betreibers.

    Beträge in Cent (wie in platform_fees gespeichert) — die Anzeige formatiert
    sie mit der jeweiligen Währung. KEINE Umrechnung zwischen Währungen: das
    wäre ein erfundener Kurs (Wurzel 4), darum wird je Währung getrennt
    ausgewiesen.
    """

    currency: str
    # Vermitteltes Volumen (Summe der Buchungsbeträge, auf denen Provision lag).
    gross_amount_cents: int = 0
    # Unsere Provision daraus.
    fee_amount_cents: int = 0
    # Davon zurückerstattet (Storno/Teilrückzahlung).
    reversed_amount_cents: int = 0
    fee_count: int = 0


class PlatformFeeRow(BaseModel):
    """Eine einzelne Provisionsbuchung."""

    id: str
    tenant_id: str
    tenant_name: str | None = None
    reservation_id: str | None = None
    fee_bps: int | None = None
    gross_amount_cents: int | None = None
    fee_amount_cents: int | None = None
    reversed_amount_cents: int | None = None
    currency: str | None = None
    gateway: str | None = None
    status: str | None = None
    created_at: datetime


class FinanzUebersicht(BaseModel):
    """Finanzsicht: Kennzahlen je Währung + die jüngsten Provisionsbuchungen."""

    kennzahlen: list[FinanzKennzahlen]
    letzte: list[PlatformFeeRow]
    # Betriebe, die (noch) nicht für Zahlungen freigeschaltet sind — sie können
    # nicht veröffentlichen und sind damit ein Onboarding-Rückstand.
    tenants_ohne_zahlung: int = 0
    # Abo-Status über alle Betriebe (status → Anzahl).
    abos: dict[str, int] = {}


class SupportMessage(BaseModel):
    """Eine Nachricht in einem Support-Ticket."""

    id: str
    ticket_id: str
    author_kind: str
    author_user_id: str | None = None
    body: str
    # Interne Team-Notiz — wird dem Melder NIE ausgeliefert.
    internal: bool = False
    created_at: datetime


class SupportTicket(BaseModel):
    """Ein Support-Ticket in der Backoffice-Liste."""

    id: str
    reporter_user_id: str | None = None
    reporter_guest_id: str | None = None
    tenant_id: str | None = None
    tenant_name: str | None = None
    subject: str
    category: str | None = None
    status: str
    priority: str
    assignee_user_id: str | None = None
    reservation_id: str | None = None
    property_id: str | None = None
    created_at: datetime
    last_message_at: datetime | None = None


class SupportTicketDetail(SupportTicket):
    """Ticket inkl. Verlauf (im Backoffice MIT internen Notizen)."""

    messages: list[SupportMessage] = []


class SupportTicketList(BaseModel):
    items: list[SupportTicket]
    total: int


class SupportReply(BaseModel):
    """Antwort oder interne Notiz eines Bearbeiters."""

    body: str = Field(min_length=1, max_length=5000)
    # true = nur fürs Team sichtbar.
    internal: bool = False


class SupportTicketUpdate(BaseModel):
    """Statuswechsel/Zuweisung durch das Betreiber-Team."""

    status: str | None = Field(default=None, pattern="^(open|waiting|resolved|closed)$")
    priority: str | None = Field(default=None, pattern="^(low|normal|high|urgent)$")
    assignee_user_id: str | None = None


class VorgangEintrag(BaseModel):
    """Ein fachlicher Vorgang aus der Historie eines Betriebs.

    Zusammengeführt aus mehreren Quelltabellen (Reservierungen, Stornierungen,
    Anmeldungen, Zuweisungen). Bewusst nur GESCHÄFTSVORGÄNGE — keine
    Klickpfade, keine Seitenaufrufe: das wäre Verhaltenskontrolle, hier geht es
    um Nachvollziehbarkeit dessen, was fachlich passiert ist.
    """

    # Woher der Eintrag stammt: 'reservierung' | 'stornierung' | 'anmeldung'
    # | 'zuweisung'.
    quelle: str
    # Art des Vorgangs innerhalb der Quelle (z. B. 'created', 'cancelled').
    art: str
    # Menschenlesbare Zusammenfassung.
    beschreibung: str
    # Wer gehandelt hat (falls bekannt).
    user_id: str | None = None
    user_email: str | None = None
    # Betroffener Datensatz (Reservierung, Thread …).
    ziel_id: str | None = None
    # Zusatzangaben der Quelle (Grund, Kanal, Gerät).
    detail: dict = {}
    created_at: datetime


class VorgangList(BaseModel):
    """Vorgangshistorie eines Betriebs (neueste zuerst)."""

    items: list[VorgangEintrag]
