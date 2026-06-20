// Textvorlagen-System ähnlich SevDesk

// Type-Definitionen
export type TextTemplateCategory = 'DOCUMENT' | 'EMAIL' | 'LETTER';
export type ObjectType =
  | 'QUOTE'
  | 'INVOICE'
  | 'REMINDER'
  | 'DELIVERY_NOTE'
  | 'ORDER_CONFIRMATION'
  | 'CREDIT_NOTE'
  | 'CANCELLATION';
export type TextTemplateType = 'HEAD' | 'FOOT' | 'BODY' | 'SUBJECT';

export interface TextTemplate {
  id: string;
  name: string;
  category: TextTemplateCategory;
  objectType: ObjectType;
  textType: TextTemplateType;
  text: string; // Rich Text mit Platzhaltern
  isDefault: boolean;
  isPrivate: boolean; // "Nur für mich sichtbar"
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Verwendungsoptionen für Dokumente
export const DOCUMENT_USAGE_OPTIONS = [
  { value: 'QUOTE', label: 'Angebote' },
  { value: 'INVOICE', label: 'Rechnungen' },
  { value: 'REMINDER', label: 'Mahnungen' },
  { value: 'DELIVERY_NOTE', label: 'Lieferscheine' },
  { value: 'ORDER_CONFIRMATION', label: 'Auftragsbestätigungen' },
] as const;

// Kategorie-Optionen
export const CATEGORY_OPTIONS = [
  { value: 'DOCUMENT', label: 'Dokument' },
  { value: 'EMAIL', label: 'E-Mail' },
  { value: 'LETTER', label: 'Brief' },
] as const;

// Position-Optionen für Dokumente
export const DOCUMENT_POSITION_OPTIONS = [
  { value: 'HEAD', label: 'Kopf-Text' },
  { value: 'FOOT', label: 'Fuß-Text' },
] as const;

// Position-Optionen für E-Mails
export const EMAIL_POSITION_OPTIONS = [
  { value: 'SUBJECT', label: 'Betreff' },
  { value: 'BODY', label: 'Nachricht' },
] as const;

// Position-Optionen für Briefe
export const LETTER_POSITION_OPTIONS = [
  { value: 'HEAD', label: 'Kopf-Text' },
  { value: 'BODY', label: 'Haupttext' },
  { value: 'FOOT', label: 'Fuß-Text' },
] as const;

// Platzhalter-Definitionen
export const PLACEHOLDER_CATEGORIES = {
  customer: {
    label: 'Kunde',
    placeholders: {
      '[%KUNDENNAME%]': {
        description: 'Name des Kunden',
        example: 'Max Mustermann GmbH',
        dataPath: 'data.customerName',
      },
      '[%VOLLEANREDE%]': {
        description: 'Vollständige Anrede',
        example: 'Sehr geehrter Herr Mustermann',
        dataPath: 'getFullSalutation()',
      },
      '[%KUNDENNUMMER%]': {
        description: 'Kundennummer',
        example: 'KD-XXXX',
        dataPath: 'data.customerNumber',
      },
      '[%EMAIL%]': {
        description: 'E-Mail-Adresse des Kunden',
        example: 'max@mustermann.de',
        dataPath: 'data.customerEmail',
      },
      '[%STRASSE%]': {
        description: 'Straße und Hausnummer',
        example: 'Musterstraße 123',
        dataPath: 'data.customerAddress?.street',
      },
      '[%PLZ%]': {
        description: 'Postleitzahl',
        example: '12345',
        dataPath: 'data.customerAddress?.zipCode',
      },
      '[%ORT%]': {
        description: 'Ort',
        example: 'Musterstadt',
        dataPath: 'data.customerAddress?.city',
      },
    },
  },
  financial: {
    label: 'Finanzen',
    placeholders: {
      '[%BETRAG%]': {
        description: 'Gesamtbetrag',
        example: '1.234,56 €',
        dataPath: 'formatCurrency(data.total)',
      },
      '[%WAEHRUNG%]': {
        description: 'Währung',
        example: 'EUR',
        dataPath: 'data.currency',
      },
      '[%ANGEBOTSNUMMER%]': {
        description: 'Angebotsnummer',
        example: 'AN-2024-001',
        dataPath: 'data.quoteNumber',
      },
      '[%RECHNUNGSNUMMER%]': {
        description: 'Rechnungsnummer',
        example: 'RE-YYYY-XXX',
        dataPath: 'data.invoiceNumber',
      },
      '[%ZAHLUNGSZIEL%]': {
        description: 'Zahlungsziel',
        example: '15.10.2025',
        dataPath: 'formatDate(data.paymentDue)',
      },
      '[%ZAHLDATUM%]': {
        description: 'Datum der Zahlung',
        example: '14.09.2025',
        dataPath: 'formatDate(data.paymentDate)',
      },
      '[%NETTOBETRAG%]': {
        description: 'Nettobetrag',
        example: '1.000,00 €',
        dataPath: 'formatCurrency(data.subtotal)',
      },
      '[%STEUERBETRAG%]': {
        description: 'Steuerbetrag',
        example: '190,00 €',
        dataPath: 'formatCurrency(data.taxAmount)',
      },
      '[%LIEFERSCHEINNUMMER%]': {
        description: 'Lieferscheinnummer',
        example: 'LS-2024-001',
        dataPath: 'data.deliveryNoteNumber',
      },
      '[%AB_NUMMER%]': {
        description: 'Auftragsbestätigungsnummer',
        example: 'AB-2024-001',
        dataPath: 'data.orderConfirmationNumber',
      },
      '[%LIEFERDATUM%]': {
        description: 'Lieferdatum',
        example: '20.01.2026',
        dataPath: 'formatDate(data.deliveryDate)',
      },
      '[%BESTELLNUMMER%]': {
        description: 'Bestellnummer des Kunden',
        example: 'BEST-12345',
        dataPath: 'data.customerOrderNumber',
      },
    },
  },
  company: {
    label: 'Unternehmen',
    placeholders: {
      '[%KONTAKTPERSON%]': {
        description: 'Name der Kontaktperson',
        example: 'Anna Schmidt',
        dataPath: 'companySettings.contactPerson',
      },
      '[%FIRMENNAME%]': {
        description: 'Name des Unternehmens',
        example: 'Musterfirma GmbH',
        dataPath: 'companySettings.name',
      },
      '[%TELEFON%]': {
        description: 'Telefonnummer',
        example: '+49 123 456789',
        dataPath: 'companySettings.contactInfo?.phone',
      },
      '[%FIRMEN_EMAIL%]': {
        description: 'Firmen-E-Mail',
        example: 'info@musterfirma.de',
        dataPath: 'companySettings.contactInfo?.email',
      },
      '[%WEBSITE%]': {
        description: 'Website',
        example: 'www.musterfirma.de',
        dataPath: 'companySettings.contactInfo?.website',
      },
      '[%USTIDNR%]': {
        description: 'Umsatzsteuer-ID',
        example: 'DE123456789',
        dataPath: 'companySettings.vatId',
      },
      '[%HANDELSREGISTER%]': {
        description: 'Handelsregister',
        example: 'HRB 12345',
        dataPath: 'companySettings.commercialRegister',
      },
    },
  },
  dates: {
    label: 'Datum & Zeit',
    placeholders: {
      '[%DATUM%]': {
        description: 'Aktuelles Datum',
        example: '14.09.2025',
        dataPath: 'formatDate(new Date())',
      },
      '[%ANGEBOTSDATUM%]': {
        description: 'Datum des Angebots',
        example: '14.09.2025',
        dataPath: 'formatDate(data.createdAt)',
      },
      '[%GUELTIG_BIS%]': {
        description: 'Gültigkeitsdatum',
        example: '15.10.2025',
        dataPath: 'formatDate(data.validUntil)',
      },
    },
  },
} as const;

// Standard-Textvorlagen (wie bei SevDesk)
// Standard-Textvorlagen (SevDesk-kompatibel)
export const DEFAULT_TEXT_TEMPLATES: Omit<
  TextTemplate,
  'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'
>[] = [
  // Angebote
  {
    name: 'Angebot Kopf-Text',
    category: 'DOCUMENT',
    objectType: 'QUOTE',
    textType: 'HEAD',
    text: 'Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen das gewünschte freibleibende Angebot:',
    isDefault: true,
    isPrivate: false,
  },
  {
    name: 'Angebot Fuß-Text',
    category: 'DOCUMENT',
    objectType: 'QUOTE',
    textType: 'FOOT',
    text: 'Für Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung. Wir bedanken uns sehr für Ihr Vertrauen.\n\nMit freundlichen Grüßen\n[%KONTAKTPERSON%]',
    isDefault: true,
    isPrivate: false,
  },

  // Rechnungen
  {
    name: 'Rechnung Kopf-Text',
    category: 'DOCUMENT',
    objectType: 'INVOICE',
    textType: 'HEAD',
    text: 'Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihren Auftrag und das damit verbundene Vertrauen! Hiermit stelle ich Ihnen die folgenden Leistungen in Rechnung:',
    isDefault: true,
    isPrivate: false,
  },
  {
    name: 'Rechnung Fuß-Text',
    category: 'DOCUMENT',
    objectType: 'INVOICE',
    textType: 'FOOT',
    text: 'Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer auf das unten angegebene Konto. Der Rechnungsbetrag ist bis zum [%ZAHLUNGSZIEL%] fällig.\n\nMit freundlichen Grüßen\n[%KONTAKTPERSON%]',
    isDefault: true,
    isPrivate: false,
  },

  // Mahnungen
  {
    name: 'Mahnung Kopf-Text',
    category: 'DOCUMENT',
    objectType: 'REMINDER',
    textType: 'HEAD',
    text: 'Sehr geehrte Damen und Herren,\n\nsicherlich haben Sie unsere Rechnung in Ihrem Postfach übersehen. Daher bitten wir Sie höflichst, die ausstehenden Forderungen schnellstmöglich zu begleichen.',
    isDefault: true,
    isPrivate: false,
  },
  {
    name: 'Mahnung Fuß-Text',
    category: 'DOCUMENT',
    objectType: 'REMINDER',
    textType: 'FOOT',
    text: 'Sofern Sie zwischenzeitlich die Zahlung veranlasst haben, bitten wir Sie, dieses Schreiben als gegenstandslos zu betrachten.\n\nMit freundlichen Grüßen\n[%KONTAKTPERSON%]',
    isDefault: true,
    isPrivate: false,
  },

  // Lieferscheine
  {
    name: 'Lieferschein Kopf-Text',
    category: 'DOCUMENT',
    objectType: 'DELIVERY_NOTE',
    textType: 'HEAD',
    text: 'Sehr geehrte Damen und Herren,\n\nhiermit übersenden wir Ihnen den Lieferschein für die folgenden Artikel:',
    isDefault: true,
    isPrivate: false,
  },
  {
    name: 'Lieferschein Fuß-Text',
    category: 'DOCUMENT',
    objectType: 'DELIVERY_NOTE',
    textType: 'FOOT',
    text: 'Bitte prüfen Sie die gelieferte Ware auf Vollständigkeit und Unversehrtheit. Reklamationen melden Sie uns bitte innerhalb von 14 Tagen.\n\nMit freundlichen Grüßen\n[%KONTAKTPERSON%]',
    isDefault: true,
    isPrivate: false,
  },

  // Auftragsbestätigungen
  {
    name: 'Auftragsbestätigung Kopf-Text',
    category: 'DOCUMENT',
    objectType: 'ORDER_CONFIRMATION',
    textType: 'HEAD',
    text: 'Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihren Auftrag! Hiermit bestätigen wir die Bestellung der folgenden Leistungen:',
    isDefault: true,
    isPrivate: false,
  },
  {
    name: 'Auftragsbestätigung Fuß-Text',
    category: 'DOCUMENT',
    objectType: 'ORDER_CONFIRMATION',
    textType: 'FOOT',
    text: 'Die voraussichtliche Lieferung erfolgt am [%LIEFERDATUM%]. Bei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\n[%KONTAKTPERSON%]',
    isDefault: true,
    isPrivate: false,
  },

  // E-Mail Templates
  {
    name: 'E-Mail (Alle Dokumente) Nachricht',
    category: 'EMAIL',
    objectType: 'QUOTE',
    textType: 'BODY',
    text: 'Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihren Auftrag. Ihre Rechnung befindet sich im Anhang.\n\nMit freundlichen Grüßen',
    isDefault: true,
    isPrivate: false,
  },
  {
    name: 'E-Mail (Zahlungsbestätigung) Nachricht',
    category: 'EMAIL',
    objectType: 'INVOICE',
    textType: 'BODY',
    text: '[%VOLLEANREDE%],\n\nhiermit bestätigen wir Ihnen, dass wir am [%ZAHLDATUM%] eine Zahlung in Höhe von [%BETRAG%] erhalten haben. Die Rechnung [%RECHNUNGSNUMMER%] gilt somit als bezahlt.\n\nMit freundlichen Grüßen\n[%KONTAKTPERSON%]',
    isDefault: true,
    isPrivate: false,
  },
];
