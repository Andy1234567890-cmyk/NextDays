// Typen des Bereichs »versand« (Buchhaltung): Versand-Protokoll und Textvorlagen.
// camelCase wie die API-Antworten (Pydantic `to_camel`). Datumsfelder sind
// ISO-Strings — kein Date-Objekt über die Server-Action-Grenze.

export type DocumentType =
  | "invoice"
  | "quote"
  | "reminder"
  | "credit_note"
  | "delivery_note"
  | "order_confirmation"
  | "cancellation"
  | "contract"
  | "receipt"
  | "other";

export type SendStatus = "pending" | "sent" | "failed";

export type DocumentSend = {
  id: string;
  tenantId: string;
  documentType: DocumentType;
  documentId: string;
  documentNumber: string | null;
  kanal: string;
  empfaenger: string[];
  cc: string[];
  bcc: string[];
  betreff: string;
  textVorschau: string | null;
  anhaenge: { filename?: string; bytes?: number; contentType?: string }[];
  status: SendStatus;
  messageId: string | null;
  fehler: string | null;
  sentAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SendDocumentInput = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  message: string;
  signature?: string;
  sendCopy?: boolean;
  attachments?: { filename: string; contentBase64: string; contentType?: string }[];
  documentType: string;
  documentId: string;
  documentNumber?: string;
};

export type SendDocumentResult = {
  success: boolean;
  send: DocumentSend;
  pdfAttached: boolean;
  attachmentFilename: string | null;
  wiederverwendet: boolean;
  belegStatusGesetzt: boolean | null;
  kopieAn: string | null;
};

export type TemplateCategory = "DOCUMENT" | "EMAIL" | "LETTER";
export type TemplateObjectType =
  | "QUOTE"
  | "INVOICE"
  | "REMINDER"
  | "DELIVERY_NOTE"
  | "ORDER_CONFIRMATION"
  | "CREDIT_NOTE"
  | "CANCELLATION";
export type TemplateTextType = "HEAD" | "FOOT" | "BODY" | "SUBJECT";

export type TextTemplate = {
  id: string;
  companyId: string;
  name: string;
  category: TemplateCategory;
  objectType: TemplateObjectType;
  textType: TemplateTextType;
  text: string;
  language: string | null;
  isDefault: boolean;
  isPrivate: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TextTemplateInput = {
  name: string;
  category: TemplateCategory;
  objectType: TemplateObjectType;
  textType: TemplateTextType;
  text: string;
  language?: string | null;
  isDefault?: boolean;
  isPrivate?: boolean;
};

export type TextTemplateRenderResult = {
  text: string;
  offenePlatzhalter: string[];
  language: string;
};

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = ["DOCUMENT", "EMAIL", "LETTER"];
export const TEMPLATE_OBJECT_TYPES: readonly TemplateObjectType[] = [
  "QUOTE",
  "INVOICE",
  "REMINDER",
  "DELIVERY_NOTE",
  "ORDER_CONFIRMATION",
  "CREDIT_NOTE",
  "CANCELLATION",
];
// Welche Positionen je Kategorie sinnvoll sind (wie web/types/textTemplates.ts).
export const TEXT_TYPES_JE_KATEGORIE: Record<TemplateCategory, readonly TemplateTextType[]> = {
  DOCUMENT: ["HEAD", "FOOT"],
  EMAIL: ["SUBJECT", "BODY"],
  LETTER: ["HEAD", "BODY", "FOOT"],
};
// Platzhalter, die der Server füllt (bereiche/versand/service.py, _platzhalter_werte).
export const PLATZHALTER: readonly string[] = [
  "[%KUNDENNAME%]",
  "[%KUNDENNUMMER%]",
  "[%EMAIL%]",
  "[%STRASSE%]",
  "[%PLZ%]",
  "[%ORT%]",
  "[%BETRAG%]",
  "[%NETTOBETRAG%]",
  "[%STEUERBETRAG%]",
  "[%WAEHRUNG%]",
  "[%BELEGNUMMER%]",
  "[%RECHNUNGSNUMMER%]",
  "[%ANGEBOTSNUMMER%]",
  "[%ZAHLUNGSZIEL%]",
  "[%ZAHLDATUM%]",
  "[%DATUM%]",
  "[%ANGEBOTSDATUM%]",
  "[%GUELTIG_BIS%]",
  "[%FIRMENNAME%]",
  "[%FIRMEN_EMAIL%]",
  "[%USTIDNR%]",
];
