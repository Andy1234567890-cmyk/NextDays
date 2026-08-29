"""Pydantic-Schemas für den whatsapp-Slice.

Bidirektionaler WhatsApp-Kanal über die Meta WhatsApp Cloud API. Eine
Konversation je Gast-Telefonnummer; Nachrichten in beide Richtungen.
"""
from typing import Literal

from pydantic import BaseModel, Field


class WhatsAppConversation(BaseModel):
    id: str
    wa_phone: str
    guest_name: str | None = None
    reservation_id: str | None = None
    last_message: str | None = None
    last_at: str | None = None
    is_read: bool = True


class WhatsAppConversationList(BaseModel):
    items: list[WhatsAppConversation] = []
    total: int = 0


class WhatsAppMessage(BaseModel):
    id: str | None = None
    direction: str                 # "in" | "out"
    body: str
    status: str = "sent"
    sent_at: str | None = None


class WhatsAppMessageList(BaseModel):
    items: list[WhatsAppMessage] = []
    total: int = 0


class SendWhatsAppRequest(BaseModel):
    # Entweder bestehende Konversation oder neue Nummer.
    conversation_id: str | None = None
    to_phone: str | None = None    # E.164 (mit/ohne '+'); nötig, wenn keine conversation_id
    body: str


class SendWhatsAppTemplateRequest(BaseModel):
    """Template-Nachricht (Meta-Regel: außerhalb des 24-h-Fensters Pflicht)."""

    conversation_id: str | None = None
    to_phone: str | None = None    # nötig, wenn keine conversation_id
    template_name: str             # von Meta freigegebener Template-Name
    language_code: str = "de"      # Sprachcode des Templates (z.B. de, en_US)
    # Geordnete Variablenwerte für den Body des Templates ({{1}}, {{2}}, …).
    # Leer = Template ohne Variablen.
    variables: list[str] = []


class WhatsAppStatus(BaseModel):
    """White-label Konfig-Status (KEIN Token im Response)."""

    configured: bool               # Credentials vorhanden?
    sandbox: bool                  # Mock-Modus aktiv?
    phone_number_id_set: bool


class OnboardingRequest(BaseModel):
    """Code aus Metas Embedded-Signup-Fenster. Lebt nur ~30 Sekunden.

    Der Tenant kommt bewusst NICHT hier hinein, sondern aus dem JWT — sonst
    könnte ein Betrieb den WhatsApp-Kanal eines anderen überschreiben.
    """

    code: str


class TemplateRolloutResult(BaseModel):
    angelegt: list[str] = []
    uebersprungen: list[str] = []
    fehler: list[str] = []


class OnboardingResult(BaseModel):
    """Ergebnis des Embedded-Signup-Abschlusses. Ohne Zugangstoken."""

    waba_id: str
    phone_number_id: str
    display_phone_number: str | None = None
    # None = Meta hat keinen Zustand geliefert; NICHT als „darf senden" deuten.
    can_send_message: bool | None = None
    # z. B. „141006: There is an error with the payment method." — der Betrieb
    # muss dann bei Meta eine Zahlungsmethode hinterlegen.
    send_block_reason: str | None = None
    templates: TemplateRolloutResult = TemplateRolloutResult()


class OnboardingStartLink(BaseModel):
    """Einstieg in Metas gehostete Embedded-Signup-Seite.

    `available=False` heißt: die Konfiguration fehlt noch. Dann bleibt `url`
    leer und `reason` sagt, was fehlt — kein Link ins Nichts.
    """

    available: bool
    url: str | None = None
    reason: str | None = None


class OnboardingStatus(BaseModel):
    """Kanal-Zustand eines Betriebs für die UI. Nie mit Token."""

    connected: bool = False
    waba_id: str | None = None
    phone_number_id: str | None = None
    display_phone_number: str | None = None
    verified_name: str | None = None
    can_send_message: bool | None = None
    send_block_reason: str | None = None
    quality_rating: str | None = None
    messaging_limit_tier: str | None = None
    status: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


class TemplateCreate(BaseModel):
    """Eine neue Meta-Vorlage. Name und Sprache sind später unveränderlich —
    Meta kennt kein Umbenennen, dafür braucht es eine neue Vorlage."""

    name: str = Field(min_length=1, max_length=512)
    language: str = Field(min_length=2, max_length=10)
    category: Literal["UTILITY", "MARKETING", "AUTHENTICATION"] = "UTILITY"
    # Text in UNSERER Schreibweise: {{guest_first_name}}. Metas positionelle
    # Form entsteht erst beim Übertragen, die Beispielwerte ebenso.
    body: str = Field(min_length=1, max_length=1024)
    footer: str | None = Field(default=None, max_length=60)


class TemplateUpdate(BaseModel):
    """Änderung einer Vorlage. Metas Update ERSETZT alle Komponenten, deshalb
    gehört die Fußzeile mit in die Anfrage, auch wenn sie unverändert bleibt.

    ``name`` und ``language`` sind nicht änderbar — sie stehen hier, weil die
    Feld-Zuordnung an ihnen hängt und ohne sie nicht wiederzufinden wäre."""

    name: str = Field(min_length=1, max_length=512)
    language: str = Field(min_length=2, max_length=10)
    body: str = Field(min_length=1, max_length=1024)
    footer: str | None = Field(default=None, max_length=60)


class TemplateHide(BaseModel):
    """Vorlage in myNextDays aus- oder einblenden — bei Meta ändert sich nichts."""

    language: str = Field(min_length=2, max_length=10)
    hidden: bool = True
