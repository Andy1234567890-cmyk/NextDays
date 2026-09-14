"""Schemas des Bereichs »versand« (Belegversand per Mail, Versand-Protokoll,
Textvorlagen).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — die
beiden Bestands-Modals (`EmailSendModal`, `EmailDialog`) und
`TextTemplateService.ts` schicken camelCase und werden nicht umgebaut.
`extra="ignore"`, weil die Modals Darstellungsfelder mitschicken
(`companySlug`, `meta`, `senderName`), die keine Fachdaten sind.

Die Literale MÜSSEN mit den `check`-Klauseln in 0694/0695 deckungsgleich
bleiben (Regel „DB-CHECK und Pydantic-Literal deckungsgleich").
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

# Deckungsgleich mit 0694 `check (document_type in (...))`.
DocumentType = Literal[
    "invoice", "quote", "reminder", "credit_note", "delivery_note",
    "order_confirmation", "cancellation", "contract", "receipt", "other",
]
DOCUMENT_TYPES: frozenset[str] = frozenset({
    "invoice", "quote", "reminder", "credit_note", "delivery_note",
    "order_confirmation", "cancellation", "contract", "receipt", "other",
})
# Die Belegart-Namen des Versand-Dialogs (`EmailSendModal.documentType`) auf
# die DB-Werte — EINE Stelle, damit `delivery` nicht an drei Orten erraten wird.
DOCUMENT_TYPE_ALIASE: dict[str, str] = {
    "delivery": "delivery_note",
    "delivery-note": "delivery_note",
    "order": "order_confirmation",
    "order-confirmation": "order_confirmation",
    "credit-note": "credit_note",
    "creditnote": "credit_note",
}
# Deckungsgleich mit 0694 `check (status in (...))`.
SendStatus = Literal["pending", "sent", "failed"]

# Deckungsgleich mit 0695.
TemplateCategory = Literal["DOCUMENT", "EMAIL", "LETTER"]
TemplateObjectType = Literal[
    "QUOTE", "INVOICE", "REMINDER", "DELIVERY_NOTE",
    "ORDER_CONFIRMATION", "CREDIT_NOTE", "CANCELLATION",
]
TemplateTextType = Literal["HEAD", "FOOT", "BODY", "SUBJECT"]
TEMPLATE_CATEGORIES: frozenset[str] = frozenset({"DOCUMENT", "EMAIL", "LETTER"})
TEMPLATE_OBJECT_TYPES: frozenset[str] = frozenset({
    "QUOTE", "INVOICE", "REMINDER", "DELIVERY_NOTE",
    "ORDER_CONFIRMATION", "CREDIT_NOTE", "CANCELLATION",
})
TEMPLATE_TEXT_TYPES: frozenset[str] = frozenset({"HEAD", "FOOT", "BODY", "SUBJECT"})

# Obergrenzen (Wurzel 8): Listen ≤ 500, Empfänger je Feld ≤ 20, Anhänge ≤ 10.
LIMIT_MAX = 500
LIMIT_STANDARD = 100
EMPFAENGER_MAX = 20
ANHAENGE_MAX = 10
TEXT_MAX = 20_000
TEMPLATE_TEXT_MAX = 20_000
# Ein Anhang ist Base64 — 15 MB entschlüsselt sind rund 20 MB Text.
ANHANG_BASE64_MAX = 21 * 1024 * 1024


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


def belegart_normalisieren(wert: str) -> str:
    """Belegart des Clients (`delivery`, `credit-note`, `INVOICE`) auf den
    DB-Wert — oder ValueError, wenn sie unbekannt ist."""
    roh = wert.strip().lower()
    art = DOCUMENT_TYPE_ALIASE.get(roh, roh)
    if art not in DOCUMENT_TYPES:
        raise ValueError(f"Unbekannte Belegart: {wert}")
    return art


def sprache_normalisieren(wert: str | None) -> str | None:
    """ISO-639-1 klein, leer → None (= alle Sprachen). Kein Default „de"."""
    if wert is None or not wert.strip():
        return None
    w = wert.strip().lower()
    if len(w) != 2 or not w.isalpha():
        raise ValueError("language muss ein ISO-639-1-Code sein (z. B. de).")
    return w


# --- Versand -----------------------------------------------------------------


class Anhang(_Camel):
    """Ein Anhang, wie der Versand-Dialog ihn schickt: Dateiname + Base64.

    Das Backend rendert keine Belege (kein PDF-Werkzeug in apps/api); das PDF
    kommt vom Client. Geprüft wird serverseitig: Base64 gültig, ≤ 15 MB, und
    ein `.pdf` MUSS mit `%PDF-` beginnen (Magic Bytes, nicht der Dateiname).
    """

    filename: str = Field(min_length=1, max_length=200)
    content_base64: str = Field(min_length=1, max_length=ANHANG_BASE64_MAX)
    content_type: str | None = Field(default=None, max_length=120)


class SendDocumentRequest(_Camel):
    """POST /email/send-document (EmailSendModal) — Empfänger, Betreff, Text,
    Belegart+ID, Anhänge. `sendCopy` legt den Absender-Betrieb in BCC."""

    to: list[EmailStr] = Field(min_length=1, max_length=EMPFAENGER_MAX)
    cc: list[EmailStr] | None = Field(default=None, max_length=EMPFAENGER_MAX)
    bcc: list[EmailStr] | None = Field(default=None, max_length=EMPFAENGER_MAX)
    subject: str = Field(min_length=1, max_length=300)
    message: str = Field(min_length=1, max_length=TEXT_MAX)
    signature: str | None = Field(default=None, max_length=4000)
    send_copy: bool = False
    attachments: list[Anhang] = Field(default_factory=list, max_length=ANHAENGE_MAX)
    document_type: str = Field(min_length=1, max_length=40)
    document_id: str = Field(min_length=1, max_length=120)
    document_number: str | None = Field(default=None, max_length=120)

    @field_validator("document_type")
    @classmethod
    def _belegart(cls, wert: str) -> str:
        return belegart_normalisieren(wert)

    @field_validator("to", "cc", "bcc")
    @classmethod
    def _empfaenger_dedupe(cls, werte: list[str] | None) -> list[str] | None:
        if werte is None:
            return None
        gesehen: dict[str, None] = {}
        for w in werte:
            gesehen.setdefault(w.strip().lower(), None)
        return list(gesehen)


class SendInvoiceEmailRequest(_Camel):
    """POST /send-invoice-email (EmailDialog) — die ältere, flache Form:
    EIN Empfänger, `message` statt Text-Feldern, kein Anhang im Body.

    `pdfBase64` ist optional: schickt der Dialog keines mit, geht die Mail
    OHNE Anhang raus und die Antwort sagt `pdfAttached=false` — kein
    serverseitiges Rendern, kein erfundenes PDF.
    """

    invoice_id: str = Field(min_length=1, max_length=120)
    recipient_email: EmailStr
    recipient_name: str | None = Field(default=None, max_length=200)
    subject: str = Field(min_length=1, max_length=300)
    message: str = Field(min_length=1, max_length=TEXT_MAX)
    pdf_base64: str | None = Field(default=None, max_length=ANHANG_BASE64_MAX)
    filename: str | None = Field(default=None, max_length=200)
    send_copy: bool = False

    def als_send_document(self) -> SendDocumentRequest:
        anhaenge: list[Anhang] = []
        if self.pdf_base64:
            anhaenge.append(
                Anhang(
                    filename=self.filename or f"{self.invoice_id}.pdf",
                    content_base64=self.pdf_base64,
                    content_type="application/pdf",
                )
            )
        return SendDocumentRequest(
            to=[self.recipient_email],
            subject=self.subject,
            message=self.message,
            send_copy=self.send_copy,
            attachments=anhaenge,
            document_type="invoice",
            document_id=self.invoice_id,
        )


class DocumentSendResponse(_Camel):
    """Eine Zeile des Versand-Protokolls."""

    id: str
    tenant_id: str
    document_type: DocumentType
    document_id: str
    document_number: str | None = None
    kanal: str
    empfaenger: list[str]
    cc: list[str] = Field(default_factory=list)
    bcc: list[str] = Field(default_factory=list)
    betreff: str
    text_vorschau: str | None = None
    anhaenge: list[dict] = Field(default_factory=list)
    status: SendStatus
    message_id: str | None = None
    fehler: str | None = None
    sent_at: datetime | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


class SendDocumentResult(_Camel):
    """Antwort BEIDER Versand-Routen — trägt die Felder, die die zwei Modals
    lesen (`success`, `pdfAttached`, `attachmentFilename`) plus das Protokoll."""

    success: bool
    send: DocumentSendResponse
    pdf_attached: bool
    attachment_filename: str | None = None
    # True, wenn dieser Aufruf einen Versand der letzten 60 s wiederverwendet
    # hat statt eine zweite Mail zu schicken (Wurzel 2) — Debugging-Signal.
    wiederverwendet: bool = False
    # Ob der Beleg auf `sent` gehoben wurde; `null` = kein Beleg mit Status
    # (Lieferschein, Vertrag) oder Beleg nicht änderbar (Entwurf ohne Nummer).
    beleg_status_gesetzt: bool | None = None
    kopie_an: str | None = None


class DocumentSendListResponse(_Camel):
    items: list[DocumentSendResponse]
    total: int


# --- Textvorlagen ------------------------------------------------------------


class TextTemplateCreate(_Camel):
    """POST /text-templates/{company}: die Form von `TextTemplate` im Frontend.
    `companyId` aus dem Body wird ignoriert — autoritativ ist der Tenant."""

    name: str = Field(min_length=1, max_length=200)
    category: TemplateCategory
    object_type: TemplateObjectType
    text_type: TemplateTextType
    text: str = Field(min_length=1, max_length=TEMPLATE_TEXT_MAX)
    language: str | None = Field(default=None, max_length=8)
    is_default: bool = False
    is_private: bool = False

    @field_validator("language")
    @classmethod
    def _sprache(cls, wert: str | None) -> str | None:
        return sprache_normalisieren(wert)


class TextTemplateUpdate(_Camel):
    """PATCH/PUT /text-templates/{company}/{id}: alle Felder optional."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: TemplateCategory | None = None
    object_type: TemplateObjectType | None = None
    text_type: TemplateTextType | None = None
    text: str | None = Field(default=None, min_length=1, max_length=TEMPLATE_TEXT_MAX)
    language: str | None = Field(default=None, max_length=8)
    is_default: bool | None = None
    is_private: bool | None = None

    @field_validator("language")
    @classmethod
    def _sprache(cls, wert: str | None) -> str | None:
        return sprache_normalisieren(wert)


class TextTemplateResponse(_Camel):
    id: str
    company_id: str
    name: str
    category: TemplateCategory
    object_type: TemplateObjectType
    text_type: TemplateTextType
    text: str
    language: str | None = None
    is_default: bool
    is_private: bool
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


class TextTemplateRenderRequest(_Camel):
    """POST /text-templates/render: Platzhalter serverseitig aus dem Beleg
    füllen. Entweder `templateId` ODER `text` — nicht beides, nicht keines."""

    template_id: str | None = Field(default=None, max_length=120)
    text: str | None = Field(default=None, max_length=TEMPLATE_TEXT_MAX)
    document_type: str = Field(min_length=1, max_length=40)
    document_id: str = Field(min_length=1, max_length=120)
    language: str | None = Field(default=None, max_length=8)

    @field_validator("document_type")
    @classmethod
    def _belegart(cls, wert: str) -> str:
        return belegart_normalisieren(wert)

    @field_validator("language")
    @classmethod
    def _sprache(cls, wert: str | None) -> str | None:
        return sprache_normalisieren(wert)

    @model_validator(mode="after")
    def _genau_eine_quelle(self) -> TextTemplateRenderRequest:
        if bool(self.template_id) == bool(self.text):
            raise ValueError("Entweder templateId oder text angeben — genau eines.")
        return self


class TextTemplateRenderResponse(_Camel):
    text: str
    # Platzhalter, die im Text standen und für die der Beleg KEINEN Wert hatte
    # (leer ersetzt). Sichtbar gemacht statt still — der Nutzer sieht, was fehlt.
    offene_platzhalter: list[str] = Field(default_factory=list)
    language: str
