// Zentrale TypeScript-Definitionen für das Platzhalter-System

export type DocumentType = 'invoice' | 'quote' | 'reminder' | 'credit' | 'delivery' | 'common';

export interface PlaceholderContext {
  type: DocumentType;
  company?: Record<string, unknown>;
  customer?: Record<string, unknown>;
  selectedCustomer?: Record<string, unknown>;
  contactPerson?: Record<string, unknown>;
  invoice?: Record<string, unknown>;
  quote?: Record<string, unknown>;
  reminder?: Record<string, unknown>;
  credit?: Record<string, unknown>;
  delivery?: Record<string, unknown>;
  [key: string]: unknown;
}

export type PlaceholderFunction = (context: PlaceholderContext) => string;

export interface PlaceholderRegistry {
  [key: string]: PlaceholderFunction;
}

export interface PlaceholderCategory {
  name: string;
  description: string;
  placeholders: PlaceholderRegistry;
}

// Standard Placeholder-Namen für Konsistenz
export const STANDARD_PLACEHOLDER_NAMES = {
  // Datum & Zeit
  TODAY: 'HEUTE',
  DATE: 'DATUM',
  YEAR: 'JAHR',
  YEAR_SHORT: 'JAHR.KURZ',
  MONTH: 'MONAT',
  MONTH_SHORT: 'MONAT.KURZ',
  MONTH_NUMBER: 'MONAT.ZAHL',
  DAY: 'TAG',
  WEEKDAY: 'WOCHENTAG',
  WEEK_NUMBER: 'KALENDERWOCHE',
  QUARTER: 'QUARTAL',

  // Firmen-Daten
  COMPANY_NAME: 'FIRMENNAME',
  COMPANY_ADDRESS: 'FIRMENADRESSE',
  COMPANY_PHONE: 'FIRMENTELEFON',
  COMPANY_EMAIL: 'FIRMENEMAIL',
  COMPANY_VAT_ID: 'UMSATZSTEUER_ID', // Standardisierter Name
  COMPANY_TAX_NUMBER: 'STEUERNUMMER',

  // Kunden-Daten
  CUSTOMER_NAME: 'KUNDENNAME',
  CUSTOMER_ADDRESS: 'KUNDENADRESSE',
  CUSTOMER_PHONE: 'KUNDENTELEFON',
  CUSTOMER_EMAIL: 'KUNDENEMAIL',

  // Dokument-spezifische Platzhalter
  INVOICE_NUMBER: 'RECHNUNGSNUMMER',
  INVOICE_DATE: 'RECHNUNGSDATUM',
  QUOTE_NUMBER: 'ANGEBOTSNUMMER',
  QUOTE_DATE: 'ANGEBOTSDATUM',
} as const;

export type StandardPlaceholderName =
  (typeof STANDARD_PLACEHOLDER_NAMES)[keyof typeof STANDARD_PLACEHOLDER_NAMES];
