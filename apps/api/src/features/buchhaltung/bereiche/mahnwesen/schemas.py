"""Schemas des Bereichs »mahnwesen« (Mahnungen in drei Stufen).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — so passen
die portierten Frontend-Aufrufe (`reminderLevel`, `invoiceId`) ohne Umbau.
`extra="ignore"`, weil `SendDocumentModal` beim Drucken/Versenden ein Bündel
Darstellungsfelder patcht (`templateId`, `color`, `documentSettings`, …), die
hier gesammelt in `template_settings` landen und keine Fachdaten sind.

Die Literale MÜSSEN mit den `check`-Klauseln in 0640 deckungsgleich bleiben
(Regel „DB-CHECK und Pydantic-Literal deckungsgleich": 'stripe' fehlte einmal
im Schema → 500 beim LESEN, ganzes Dashboard tot).
"""

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

# Deckungsgleich mit 0640 `check (status in (...))`.
ReminderStatus = Literal["draft", "sent", "paid", "cancelled"]
REMINDER_STATUSES: frozenset[str] = frozenset({"draft", "sent", "paid", "cancelled"})
# Deckungsgleich mit 0640 `check (level between 1 and 3)`.
ReminderLevel = Literal[1, 2, 3]
MAX_LEVEL = 3

# Obergrenzen für Listen und Zeiträume (Regel: limit ≤ 500, Spannen ≤ 366 Tage).
LIMIT_MAX = 500
LIMIT_STANDARD = 200
# Wie weit ein Mahndatum rückdatiert bzw. eine Zahlungsfrist vorausgesetzt
# werden darf. Ein Client-Datum im Jahr 9999 ist kein Fachfall, sondern Unsinn.
MAX_RUECKDATIERUNG_TAGE = 366
MAX_FRIST_TAGE = 365
# `document_settings` des Versand-Dialogs (Wurzel 8: kein unbegrenztes jsonb aus
# dem Client) — serialisiert höchstens 64 KB.
DOCUMENT_SETTINGS_MAX_BYTES = 64 * 1024
_URL_SCHEMATA = ("http://", "https://", "/")


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


# --- Einstellungen -------------------------------------------------------------


class StufenEinstellung(_Camel):
    """Eine Mahnstufe: Zahlungsfrist (Tage ab Mahndatum), Gebühr, Titel, Text."""

    days: int = Field(ge=0, le=365)
    fee: Decimal = Field(ge=0)
    title: str = Field(min_length=1, max_length=120)
    text: str | None = Field(default=None, max_length=4000)


class ReminderSettingsUpdate(_Camel):
    """PUT /reminders/settings/{company}: alle Felder Pflicht — es gibt keinen
    stillen Ersatzwert, mit dem eine halbe Einstellung sinnvoll wäre."""

    level1: StufenEinstellung
    level2: StufenEinstellung
    level3: StufenEinstellung
    interest_rate: Decimal = Field(ge=0, le=100)
    auto_mark_overdue: bool


class ReminderSettingsResponse(_Camel):
    """GET: fehlt die Zeile oder eine Stufe, stehen dort `null`-Felder und
    `configured=false` — die Oberfläche verlangt die Einstellungen dann VOR der
    ersten Mahnung, der Server antwortet ohne sie mit 422."""

    level1: StufenEinstellung | None = None
    level2: StufenEinstellung | None = None
    level3: StufenEinstellung | None = None
    interest_rate: Decimal | None = None
    auto_mark_overdue: bool | None = None
    configured: bool
    updated_at: datetime | None = None


# --- Mahnungen -----------------------------------------------------------------


class ReminderCreate(_Camel):
    """POST /reminders: die nächste Stufe zu einer überfälligen Rechnung.

    `level` darf fehlen (dann die nächste) — wird es mitgegeben, MUSS es die
    nächste sein (Stufe n+1 nur, wenn n existiert). Gebühr, Zinssatz und Texte
    kommen aus den Einstellungen und dürfen je Mahnung überschrieben werden.
    Beträge der Rechnung (offener Betrag, Währung) kommen NIE vom Client.
    """

    invoice_id: str = Field(min_length=1)
    level: ReminderLevel | None = None
    reminder_date: date | None = None
    due_date: date | None = None
    fee: Decimal | None = Field(default=None, ge=0)
    interest_rate: Decimal | None = Field(default=None, ge=0, le=100)
    text_header: str | None = Field(default=None, max_length=4000)
    text_footer: str | None = Field(default=None, max_length=4000)
    notes: str | None = Field(default=None, max_length=4000)


class ReminderUpdate(_Camel):
    """PATCH /reminders/{id}: Texte/Notizen/Fristen eines ENTWURFS; die
    Darstellungsfelder des Versand-Dialogs werden in `template_settings`
    gesammelt (siehe Service). Beträge sind hier bewusst NICHT änderbar —
    sie sind Tatsachen zum Mahnzeitpunkt."""

    text_header: str | None = Field(default=None, max_length=4000)
    text_footer: str | None = Field(default=None, max_length=4000)
    footer_text: str | None = Field(default=None, max_length=4000)  # Alias des Dialogs
    head_text: str | None = Field(default=None, max_length=4000)  # Alias des Dialogs
    notes: str | None = Field(default=None, max_length=4000)
    due_date: date | None = None
    # Darstellung (Versand-Dialog) — durchgereicht, keine Fachdaten. Trotzdem
    # begrenzt (Wurzel 8): Längen, URL-Schema, Gesamtgröße des jsonb.
    template_id: str | None = Field(default=None, max_length=120)
    template: str | None = Field(default=None, max_length=120)
    template_type: str | None = Field(default=None, max_length=120)
    color: str | None = Field(default=None, max_length=40)
    logo_url: str | None = Field(default=None, max_length=2000)
    logo_size: int | None = Field(default=None, ge=0, le=2000)
    page_mode: str | None = Field(default=None, max_length=40)
    document_settings: dict | None = None

    @field_validator("logo_url")
    @classmethod
    def _logo_url_schema(cls, wert: str | None) -> str | None:
        """Nur http(s) oder relativ — `javascript:`/`data:` landen sonst als
        `src` im gedruckten Beleg (Wurzel 8)."""
        if wert is None or not wert.strip():
            return None
        if not wert.strip().lower().startswith(_URL_SCHEMATA):
            raise ValueError("logoUrl muss mit http://, https:// oder / beginnen.")
        return wert.strip()

    @field_validator("document_settings")
    @classmethod
    def _document_settings_gedeckelt(cls, wert: dict | None) -> dict | None:
        if wert is None:
            return None
        if len(json.dumps(wert, ensure_ascii=False).encode("utf-8")) > DOCUMENT_SETTINGS_MAX_BYTES:
            raise ValueError("documentSettings ist größer als 64 KB.")
        return wert


class ReminderStatusUpdate(_Camel):
    status: ReminderStatus


class ReminderSend(_Camel):
    """POST /reminders/{id}/send: das PDF kommt Base64 vom Client (das Backend
    rendert keine Belege, wie beim Rechnungsversand)."""

    to: list[EmailStr] = Field(min_length=1, max_length=20)
    subject: str = Field(min_length=1, max_length=300)
    text: str = Field(min_length=1, max_length=20000)
    pdf_base64: str = Field(min_length=1)
    filename: str | None = Field(default=None, max_length=200)
    cc: list[EmailStr] | None = Field(default=None, max_length=20)
    bcc: list[EmailStr] | None = Field(default=None, max_length=20)
    kopie_an_absender: bool = False


class UeberfaelligLaufResult(_Camel):
    """Ergebnis eines Tages-Laufs `ueberfaellig_markieren` (Diagnose)."""

    tenants_geprueft: int
    rechnungen_markiert: int
    tenants_mit_rest: int


class ReminderResponse(_Camel):
    id: str
    tenant_id: str
    reminder_number: str
    # `number` als Zweitname — die Belegliste des Bestands liest `number`.
    number: str
    invoice_id: str
    invoice_number: str | None = None
    customer_id: str | None = None
    customer_name: str | None = None
    customer_email: str | None = None
    customer_address: str | None = None
    level: int
    reminder_date: date
    due_date: date
    invoice_due_date: date | None = None
    days_overdue: int
    fee: Decimal
    interest: Decimal
    interest_rate: Decimal
    amount_open: Decimal
    amount_total: Decimal
    currency: str
    status: ReminderStatus
    sent_at: datetime | None = None
    sent_message_id: str | None = None
    text_header: str | None = None
    text_footer: str | None = None
    notes: str | None = None
    template_settings: dict = Field(default_factory=dict)
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


class ReminderListResponse(_Camel):
    items: list[ReminderResponse]
    total: int


class OverdueInvoiceResponse(_Camel):
    """GET /reminders/overdue-invoices: eine überfällige Rechnung mit Tagen
    überfällig und letzter Mahnstufe. `next_level` ist `null`, wenn die dritte
    Stufe bereits existiert."""

    id: str
    invoice_number: str | None = None
    status: str
    customer_id: str | None = None
    customer_name: str | None = None
    customer_email: str | None = None
    issue_date: date | None = None
    due_date: date
    days_overdue: int
    gross_amount: Decimal
    paid_amount: Decimal
    amount_open: Decimal
    currency: str
    last_level: int
    last_reminder_id: str | None = None
    last_reminder_status: ReminderStatus | None = None
    next_level: int | None = None


class SendResult(_Camel):
    id: str
    status: ReminderStatus
    sent_at: datetime
    sent_message_id: str
