"""Pydantic-Schemas für den whatsapp-Slice.

Bidirektionaler WhatsApp-Kanal über die Meta WhatsApp Cloud API. Eine
Konversation je Gast-Telefonnummer; Nachrichten in beide Richtungen.
"""
from pydantic import BaseModel


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


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
