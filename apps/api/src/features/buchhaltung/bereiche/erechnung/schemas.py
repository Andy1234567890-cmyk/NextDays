"""Schemas des Bereichs »erechnung« (XRechnung/ZUGFeRD zu Rechnungen).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — so passt
der Browser-Erzeuger (`eInvoiceService.createEInvoice` schickt `invoiceId`,
`xmlContent`, `format`) ohne Umbau. `extra="ignore"`, weil der Bestand ein
Bündel Darstellungsfelder mitschickt (`companyId`, `standard`, `pdfContent`,
`amount`, `transmissionStatus` …), die keine Fachdaten sind: Beträge und
Status ermittelt der Server aus dem XML und der Rechnung.

Die Literale MÜSSEN mit den `check`-Klauseln in 0688–0690 deckungsgleich
bleiben (Regel „DB-CHECK und Pydantic-Literal deckungsgleich").
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

# Deckungsgleich mit 0688/0690 `check (format in (...))`.
EInvoiceFormat = Literal["xrechnung_ubl", "xrechnung_cii", "zugferd_en16931"]
EINVOICE_FORMATS: frozenset[str] = frozenset({"xrechnung_ubl", "xrechnung_cii", "zugferd_en16931"})
# Grobe Formatnamen des Bestands (`autoEInvoiceService`: 'zugferd'|'xrechnung')
# → genaue Syntax. Der Browser-Erzeuger baut XRechnung als UBL und ZUGFeRD als
# CII (eInvoiceService.ts, generateXRechnungXML/generateZUGFeRDXML).
LEGACY_FORMAT: dict[str, str] = {"zugferd": "zugferd_en16931", "xrechnung": "xrechnung_ubl"}
# Deckungsgleich mit 0688 `check (validation_status in (...))`.
ValidationStatus = Literal["valid", "invalid", "unchecked"]
# Deckungsgleich mit 0689.
TransmissionChannel = Literal["email", "peppol_manuell", "download"]
TransmissionStatus = Literal["pending", "sent", "failed", "downloaded"]
Severity = Literal["error", "warning"]

# Obergrenzen (Regel: limit ≤ 500, Spannen ≤ 366 Tage, Upload gecappt).
LIMIT_MAX = 500
LIMIT_STANDARD = 200
XML_MAX_BYTES = 10 * 1024 * 1024
ZEITRAUM_MAX_TAGE = 366


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


# --- Befunde -------------------------------------------------------------------


class Finding(_Camel):
    """Ein Prüfbefund der EN-16931-Kernprüfung. `bt` = Business Term (BT-10 …),
    `code` stabil für die Oberfläche, `message` deutsch für die Anzeige."""

    code: str
    severity: Severity
    bt: str | None = None
    message: str


# --- Anlegen -------------------------------------------------------------------


class EInvoiceCreate(_Camel):
    """POST /einvoices: das XML kommt aus dem Browser-Erzeuger — Base64
    (`xmlBase64`) ODER roh als Text (`xmlContent`, der Bestandsaufruf). Genau
    eines der beiden. Der Server prüft Wohlgeformtheit, lehnt DOCTYPE/ENTITY
    ab (Wurzel 8), rechnet den Hash und prüft die Pflichtfelder."""

    invoice_id: str = Field(min_length=1)
    format: str = Field(min_length=1, max_length=40)
    xml_base64: str | None = Field(default=None, min_length=1)
    xml_content: str | None = Field(default=None, min_length=1)

    @field_validator("format")
    @classmethod
    def _format_normalisieren(cls, wert: str) -> str:
        genau = LEGACY_FORMAT.get(wert.strip().lower(), wert.strip().lower())
        if genau not in EINVOICE_FORMATS:
            raise ValueError(
                "format muss xrechnung_ubl, xrechnung_cii oder zugferd_en16931 sein."
            )
        return genau


class TransmissionCreate(_Camel):
    """POST /einvoices/{id}/transmissions: Protokoll-Eintrag. Den Mail-Versand
    selbst macht der Bereich »versand«; er ruft danach diesen Endpunkt mit
    `channel='email'`, Empfänger, Status und ggf. Fehlertext auf."""

    channel: TransmissionChannel
    recipient: str | None = Field(default=None, max_length=320)
    status: TransmissionStatus = "sent"
    message_id: str | None = Field(default=None, max_length=300)
    error: str | None = Field(default=None, max_length=2000)
    transmitted_at: datetime | None = None


class EInvoiceSettingsUpdate(_Camel):
    """PUT /einvoices/settings: das Standardformat ist Pflicht; Leitweg-ID und
    Pflichtdatum darf ein Betrieb bewusst leer lassen (kein Default)."""

    default_format: EInvoiceFormat
    leitweg_id: str | None = Field(default=None, max_length=60)
    mandatory_from: date | None = None


# --- Antworten -----------------------------------------------------------------


class TransmissionResponse(_Camel):
    id: str
    e_invoice_id: str
    channel: TransmissionChannel
    recipient: str | None = None
    status: TransmissionStatus
    transmitted_at: datetime
    message_id: str | None = None
    error: str | None = None
    created_by: str | None = None
    created_at: datetime


class EInvoiceResponse(_Camel):
    id: str
    tenant_id: str
    invoice_id: str
    invoice_number: str | None = None
    customer_id: str | None = None
    customer_name: str | None = None
    format: EInvoiceFormat
    validation_status: ValidationStatus
    findings: list[Finding] = Field(default_factory=list)
    xml_sha256: str
    xml_bytes: int
    version: int
    # Pfad für den Browser-Download über den Next-Proxy (Bearer aus dem Cookie).
    download_path: str
    generated_at: datetime
    validated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    transmissions: list[TransmissionResponse] = Field(default_factory=list)


class CustomerGap(_Camel):
    """Ein Kunde, dem für die E-Rechnung etwas fehlt."""

    customer_id: str
    customer_name: str
    missing_email: bool
    missing_leitweg_id: bool
    invoice_count: int


class ComplianceResponse(_Camel):
    """GET /einvoices/compliance: Anteil ausgestellter Rechnungen im Zeitraum
    mit gültiger E-Rechnung, plus Lücken je Kunde."""

    from_date: date
    to_date: date
    invoices_total: int
    with_valid_einvoice: int
    with_invalid_einvoice: int
    without_einvoice: int
    # 0..100, zwei Nachkommastellen; None, wenn es keine Rechnungen gibt
    # (0 % wäre eine Aussage, die nicht stimmt).
    valid_share_percent: float | None
    customer_gaps: list[CustomerGap]
    mandatory_from: date | None = None


class EInvoiceSettingsResponse(_Camel):
    default_format: EInvoiceFormat | None = None
    leitweg_id: str | None = None
    mandatory_from: date | None = None
    # Land des Betriebs (tenants.country) — zur Anzeige, welche nationale
    # Pflicht gilt. Kein Datum wird daraus abgeleitet.
    country: str | None = None
    configured: bool
    updated_at: datetime | None = None
