/**
 * Document Type Utilities
 * Funktionen zur Bestimmung und Verwalt  cancellation: {
    titleKey: 'cancellation',
    numberLabelKey: 'invoiceNumber',
    dateLabelKey: 'date',
    dueDateLabel: 'dueDate',
    recipientLabelKey: 'recipient',
    showPaymentTerms: false,
    showDueDate: true,
  },okumenttypen
 */

import type { DocumentTranslations } from '@/hooks/pdf/useDocumentTranslation';

export type DocumentType =
  | 'invoice'
  | 'quote'
  | 'reminder'
  | 'credit-note'
  | 'cancellation'
  | 'delivery-note'
  | 'deliveryNote'
  | 'order-confirmation'
  | 'orderConfirmation';

export interface DocumentTypeConfig {
  title: string;
  numberLabel: string;
  dateLabel: string;
  dueDateLabel: string;
  recipientLabel: string;
  color: string;
  showPaymentTerms: boolean;
  showDueDate: boolean;
}

export interface DocumentTypeMapping {
  titleKey: keyof DocumentTranslations;
  numberLabelKey: keyof DocumentTranslations;
  dateLabelKey: keyof DocumentTranslations;
  dueDateLabelKey: keyof DocumentTranslations;
  recipientLabelKey: keyof DocumentTranslations;
  showPaymentTerms: boolean;
  showDueDate: boolean;
}

// Neue dynamische Übersetzungs-Mappings
export const DOCUMENT_TYPE_MAPPINGS: Record<DocumentType, DocumentTypeMapping> = {
  invoice: {
    titleKey: 'invoice',
    numberLabelKey: 'invoiceNumber',
    dateLabelKey: 'date',
    dueDateLabelKey: 'dueDate',
    recipientLabelKey: 'recipient',
    showPaymentTerms: true,
    showDueDate: true,
  },
  quote: {
    titleKey: 'quote',
    numberLabelKey: 'quoteNumber',
    dateLabelKey: 'date',
    dueDateLabelKey: 'validUntil',
    recipientLabelKey: 'recipient',
    showPaymentTerms: false,
    showDueDate: true,
  },
  reminder: {
    titleKey: 'invoice', // Fallback - kann später erweitert werden
    numberLabelKey: 'invoiceNumber',
    dateLabelKey: 'date',
    dueDateLabelKey: 'dueDate',
    recipientLabelKey: 'recipient',
    showPaymentTerms: true,
    showDueDate: true,
  },
  'credit-note': {
    titleKey: 'invoice', // Fallback
    numberLabelKey: 'invoiceNumber',
    dateLabelKey: 'date',
    dueDateLabelKey: 'dueDate',
    recipientLabelKey: 'recipient',
    showPaymentTerms: false,
    showDueDate: false,
  },
  cancellation: {
    titleKey: 'cancellation', // ✅ RICHTIG: 'cancellation' statt 'invoice'
    numberLabelKey: 'invoiceNumber',
    dateLabelKey: 'date',
    dueDateLabelKey: 'dueDate',
    recipientLabelKey: 'recipient',
    showPaymentTerms: false,
    showDueDate: true,
  },
  'delivery-note': {
    titleKey: 'deliveryNote',
    numberLabelKey: 'deliveryNoteNumber',
    dateLabelKey: 'date',
    dueDateLabelKey: 'deliveryDate',
    recipientLabelKey: 'recipient',
    showPaymentTerms: false,
    showDueDate: false,
  },
  deliveryNote: {
    titleKey: 'deliveryNote',
    numberLabelKey: 'deliveryNoteNumber',
    dateLabelKey: 'date',
    dueDateLabelKey: 'deliveryDate',
    recipientLabelKey: 'recipient',
    showPaymentTerms: false,
    showDueDate: false,
  },
  'order-confirmation': {
    titleKey: 'orderConfirmation',
    numberLabelKey: 'orderConfirmationNumber',
    dateLabelKey: 'date',
    dueDateLabelKey: 'deliveryDate',
    recipientLabelKey: 'recipient',
    showPaymentTerms: true,
    showDueDate: true,
  },
  orderConfirmation: {
    titleKey: 'orderConfirmation',
    numberLabelKey: 'orderConfirmationNumber',
    dateLabelKey: 'date',
    dueDateLabelKey: 'deliveryDate',
    recipientLabelKey: 'recipient',
    showPaymentTerms: true,
    showDueDate: true,
  },
};

// Alte Konfiguration für Kompatibilität (wird nach und nach ersetzt)
export const DOCUMENT_TYPE_CONFIGS: Record<DocumentType, Omit<DocumentTypeConfig, 'color'>> = {
  invoice: {
    title: 'Rechnung',
    numberLabel: 'Rechnungsnummer',
    dateLabel: 'Rechnungsdatum',
    dueDateLabel: 'Fälligkeitsdatum',
    recipientLabel: 'Rechnungsempfänger',
    showPaymentTerms: true,
    showDueDate: true,
  },
  quote: {
    title: 'Angebot',
    numberLabel: 'Angebotsnummer',
    dateLabel: 'Angebotsdatum',
    dueDateLabel: 'Gültig bis',
    recipientLabel: 'Angebotsempfänger',
    showPaymentTerms: false,
    showDueDate: true,
  },
  reminder: {
    title: 'Mahnung',
    numberLabel: 'Mahnungsnummer',
    dateLabel: 'Mahnungsdatum',
    dueDateLabel: 'Zahlungsfrist',
    recipientLabel: 'Schuldner',
    showPaymentTerms: true,
    showDueDate: true,
  },
  'credit-note': {
    title: 'Gutschrift',
    numberLabel: 'Gutschriftnummer',
    dateLabel: 'Gutschriftdatum',
    dueDateLabel: 'Auszahlungsdatum',
    recipientLabel: 'Empfänger',
    showPaymentTerms: false,
    showDueDate: false,
  },
  cancellation: {
    title: 'Stornorechnung',
    numberLabel: 'Storno-Nr.',
    dateLabel: 'Storno-Datum',
    dueDateLabel: 'Ursprünglich fällig',
    recipientLabel: 'Rechnungsempfänger',
    showPaymentTerms: false,
    showDueDate: true,
  },
  'delivery-note': {
    title: 'Lieferschein',
    numberLabel: 'Lieferschein-Nr.',
    dateLabel: 'Lieferdatum',
    dueDateLabel: 'Lieferdatum',
    recipientLabel: 'Empfänger',
    showPaymentTerms: false,
    showDueDate: false,
  },
  deliveryNote: {
    title: 'Lieferschein',
    numberLabel: 'Lieferschein-Nr.',
    dateLabel: 'Lieferdatum',
    dueDateLabel: 'Lieferdatum',
    recipientLabel: 'Empfänger',
    showPaymentTerms: false,
    showDueDate: false,
  },
  'order-confirmation': {
    title: 'Auftragsbestätigung',
    numberLabel: 'AB-Nr.',
    dateLabel: 'Bestelldatum',
    dueDateLabel: 'Voraussichtliche Lieferung',
    recipientLabel: 'Auftraggeber',
    showPaymentTerms: true,
    showDueDate: true,
  },
  orderConfirmation: {
    title: 'Auftragsbestätigung',
    numberLabel: 'AB-Nr.',
    dateLabel: 'Bestelldatum',
    dueDateLabel: 'Voraussichtliche Lieferung',
    recipientLabel: 'Auftraggeber',
    showPaymentTerms: true,
    showDueDate: true,
  },
};

export const DOCUMENT_TYPE_COLORS: Record<DocumentType, string> = {
  invoice: '#3b82f6', // Blue
  quote: '#8b5cf6', // Purple
  reminder: '#ef4444', // Red
  'credit-note': '#22c55e', // Green
  cancellation: '#f59e0b', // Orange
  'delivery-note': '#14ad9f', // Teal (Taskilo Primary)
  deliveryNote: '#14ad9f', // Teal (Taskilo Primary)
  'order-confirmation': '#0ea5e9', // Sky Blue
  orderConfirmation: '#0ea5e9', // Sky Blue
};

/**
 * Bestimmt den Dokumenttyp basierend auf verschiedenen Kriterien
 */
export function detectDocumentType(data: any): DocumentType {
  // Prüfe explizite documentType Felder
  if (data.documentType && Object.keys(DOCUMENT_TYPE_CONFIGS).includes(data.documentType)) {
    return data.documentType as DocumentType;
  }

  // Prüfe documentLabel für Schlüsselwörter
  const label = (data.documentLabel || '').toLowerCase();

  if (label.includes('angebot') || label.includes('quote')) {
    return 'quote';
  }

  if (label.includes('mahnung') || label.includes('reminder')) {
    return 'reminder';
  }

  if (label.includes('gutschrift') || label.includes('credit')) {
    return 'credit-note';
  }

  if (label.includes('storno') || label.includes('cancellation')) {
    return 'cancellation';
  }

  if (label.includes('lieferschein') || label.includes('delivery')) {
    return 'delivery-note';
  }

  if (
    label.includes('auftragsbestätigung') ||
    label.includes('order confirmation') ||
    label.includes('ab-')
  ) {
    return 'order-confirmation';
  }

  // Prüfe Nummern-Präfixe
  const invoiceNumber = (data.invoiceNumber || '').toLowerCase();

  if (invoiceNumber.startsWith('ang') || invoiceNumber.startsWith('quo')) {
    return 'quote';
  }

  if (invoiceNumber.startsWith('mah') || invoiceNumber.startsWith('rem')) {
    return 'reminder';
  }

  if (invoiceNumber.startsWith('gut') || invoiceNumber.startsWith('cre')) {
    return 'credit-note';
  }

  if (
    invoiceNumber.startsWith('sto') ||
    invoiceNumber.startsWith('st-') ||
    invoiceNumber.startsWith('can')
  ) {
    return 'cancellation';
  }

  if (
    invoiceNumber.startsWith('ls') ||
    invoiceNumber.startsWith('ls-') ||
    invoiceNumber.startsWith('del')
  ) {
    return 'delivery-note';
  }

  if (
    invoiceNumber.startsWith('ab') ||
    invoiceNumber.startsWith('ab-') ||
    invoiceNumber.startsWith('ord')
  ) {
    return 'order-confirmation';
  }

  // Standard: Rechnung
  return 'invoice';
}

/**
 * Erstellt die komplette Dokumenttyp-Konfiguration mit Farbe
 */
export function getDocumentTypeConfig(
  documentType: DocumentType,
  customColor?: string,
): DocumentTypeConfig {
  const baseConfig = DOCUMENT_TYPE_CONFIGS[documentType];
  const color = customColor || DOCUMENT_TYPE_COLORS[documentType];

  return {
    ...baseConfig,
    color,
  };
}

/**
 * Erstellt übersetzungsbasierte Dokumenttyp-Konfiguration
 * Diese Funktion sollte in Templates mit Übersetzungsfunktion verwendet werden
 */
export function getTranslatedDocumentTypeConfig(
  documentType: DocumentType,
  t: (key: keyof DocumentTranslations) => string,
  customColor?: string,
): DocumentTypeConfig {
  const mapping = DOCUMENT_TYPE_MAPPINGS[documentType];
  const color = customColor || DOCUMENT_TYPE_COLORS[documentType];

  return {
    title: t(mapping.titleKey),
    numberLabel: t(mapping.numberLabelKey),
    dateLabel: t(mapping.dateLabelKey),
    dueDateLabel: t(mapping.dueDateLabelKey),
    recipientLabel: t(mapping.recipientLabelKey),
    showPaymentTerms: mapping.showPaymentTerms,
    showDueDate: mapping.showDueDate,
    color,
  };
}
