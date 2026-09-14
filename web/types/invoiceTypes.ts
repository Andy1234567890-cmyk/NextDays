'use client';

import { TaxRuleCategory, TaxRuleType } from './taxRules';

// Re-export für Convenience - sowohl als Typ als auch als Wert
export { TaxRuleType, TaxRuleCategory };

/**
 * Deutsche Rechnungstypen für GoBD-konforme Buchführung
 * Implementiert fortlaufende Rechnungsnummerierung und Storno-Funktionalität
 * nach deutschem Steuerrecht
 */

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number; // Rabatt in Prozent (0-100), optional für Rückwärtskompatibilität
  total: number;
  taxRate?: number;
  unit?: string;
  category?: string;
  inventoryItemId?: string | null;
  // Aufenthalt DIESER Position (0702): das Dokument zeigt unter einer
  // Übernachtung „Objekt · Anreise – Abreise"; Zusatzleistungen stehen
  // eingerückt unter der Übernachtung, an der sie hängen.
  propertyId?: string | null;
  /** Nur Anzeige — der Titel wird beim Laden aus property_id aufgelöst. */
  propertyTitle?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  parentItemId?: string | null;
}

export interface InvoiceData {
  // Basis-Identifikation
  id: string;
  number: string;
  invoiceNumber: string;
  sequentialNumber: number; // Fortlaufende Nummer (GoBD-konform)

  // Datum-Informationen
  date: string;
  issueDate: string;
  dueDate: string;

  // Kundendaten
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  customerVatId?: string; // VAT ID des Kunden (für B2B-Geschäfte)
  // Strukturierte Kundendaten für Templates
  customer?: {
    name: string;
    email: string;
    address: {
      street: string;
      zipCode: string;
      city: string;
      country: string;
    };
    taxNumber?: string;
    vatId?: string;
  };

  // Rechnungsbeschreibung
  description: string;

  // Dokumentsprache des Belegs (0099, ISO 639-1, z. B. de/en/it);
  // Rechnungssprache = Gastsprache, Fallback de.
  language?: string;

  // Unternehmensdaten
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  companyLogo: string;
  profilePictureURL?: string;
  logo?: string;
  companyVatId: string;
  companyTaxNumber: string;
  companyRegister?: string;
  districtCourt?: string;
  legalForm?: string;
  companyTax?: string;
  // Strukturierte Adressfelder für Templates
  companyStreet?: string;
  companyHouseNumber?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyCountry?: string;
  // Land des Kunden als EIGENES Feld, nicht nur in der Adresszeile: Die
  // E-Rechnung braucht den ISO-3166-Code getrennt (BT-40 Käufer, BT-55
  // Verkäufer) und trug ihn bis zum 10.09.2026 fest als „DE" — womit jede
  // Auslandsrechnung die Reverse-Charge-Auflösung brach.
  customerCountry?: string;
  // Bankdaten für Templates
  companyIban?: string;
  companyBic?: string;
  // Registrierungsdaten
  companyRegistrationNumber?: string;
  // Buchhaltungseinstellungen
  taxRate?: number | string;
  taxMethod?: string;
  accountingSystem?: string;
  // Strukturierte Unternehmensdaten für Templates
  company?: {
    name: string;
    email: string;
    phone: string;
    website?: string;
    address?: {
      street: string;
      zipCode: string;
      city: string;
      country: string;
    };
    taxNumber?: string;
    vatId?: string;
    bankDetails?: {
      iban: string;
      bic: string;
      accountHolder: string;
    };
  };

  // Steuereinstellungen
  isSmallBusiness: boolean; // Kleinunternehmerregelung §19 UStG
  vatRate: number;
  priceInput: 'netto' | 'brutto';

  // Erweiterte Steuerregeln
  taxRuleType: TaxRuleType; // Verwendung des TaxRuleType Enums
  taxRule?: TaxRuleType; // Alternative Schreibweise für Kompatibilität
  taxRuleCategory?: TaxRuleCategory; // Optionale Kategorisierung
  taxRuleText?: string; // Benutzerdefinierter Text für Steuerhinweise
  taxRuleReason?: string; // Begründung für Steuerbefreiung oder spezielle Regelung
  reverseChargeInfo?: {
    customerVatId: string;
    validatedAt?: Date;
    euCountryCode: string;
  };

  // Finanzielle Daten
  items: InvoiceItem[];
  amount: number; // Nettobetrag
  tax: number; // Steuerbetrag
  total: number; // Gesamtbetrag

  // Status und Metadaten
  status: 'draft' | 'finalized' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'storno';
  createdAt: Date;
  year: number;
  companyId: string;

  // Storno-spezifische Felder
  isStorno: boolean;
  originalInvoiceId?: string; // Referenz zur ursprünglichen Rechnung
  originalInvoiceNumber?: string; // Rechnungsnummer der ursprünglichen Rechnung (GoBD-konform)
  originalInvoiceDate?: string; // Datum der ursprünglichen Rechnung (GoBD-konform)
  stornoReason?: string; // Grund für die Stornierung
  stornoDate?: Date; // Datum der Stornierung
  stornoBy?: string; // Wer die Stornierung durchgeführt hat

  // Optionale Zusatzfelder
  notes?: string;
  taxNote?: 'kleinunternehmer' | 'reverse-charge' | 'none'; // Steuerhinweise (Kleinunternehmer, Reverse-Charge, etc.)
  paymentTerms?: string;
  footerText?: string;
  headTextHtml?: string;
  title?: string;
  documentNumber?: string;
  customerNumber?: string;
  customerOrderNumber?: string;
  internalContactPerson?: string;
  contactPersonName?: string; // Hinzugefügt für Storno-Kompatibilität
  projectTitle?: string; // Hinzugefügt für Storno-Kompatibilität
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
  deliveryDate?: string;
  deliveryDateType?: string;
  deliveryDateRange?: {
    from: string | null;
    to: string | null;
  };
  servicePeriod?: string; // Leistungszeitraum für Services

  // Tags für Organisation und Kategorisierung
  tags?: string[]; // Array von Tag-Namen für bessere Rechnungsorganisation
  deliveryTerms?: string;
  currency?: string;

  // Skonto-Felder
  skontoEnabled?: boolean;
  skontoDays?: number;
  skontoPercentage?: number;
  skontoText?: string;

  bankDetails?: {
    iban: string;
    bic?: string;
    accountHolder: string;
    bankName?: string;
  };

  // E-Rechnung Daten - Legacy Format
  eInvoice?: {
    format?: string;
    version?: string;
    guid?: string;
    xmlContent?: string;
  };

  // E-Rechnung Daten - Neues Format
  eInvoiceData?: {
    format: string;
    version: string;
    guid: string;
    xmlUrl?: string;
    validationStatus?: 'valid' | 'invalid' | 'pending';
    createdAt: string;
  };

  // Referenznummer
  reference?: string;

  // PDF-Speicherpfad für wiederverwendbare PDFs
  pdfPath?: string; // Firebase Storage Pfad zum gespeicherten PDF
}

/**
 * Rechnungsnummerierung für GoBD-konforme fortlaufende Nummern
 */
export interface InvoiceNumbering {
  companyId: string;
  year: number;
  lastNumber: number;
  nextNumber: number;
  updatedAt: Date;
}

/**
 * Storno-Rechnung Interface
 */
export interface StornoInvoiceData extends Omit<InvoiceData, 'items' | 'amount' | 'tax' | 'total'> {
  // Storno-Rechnungen haben negative Beträge
  items: InvoiceItem[];
  amount: number; // Negativer Nettobetrag
  tax: number; // Negativer Steuerbetrag
  total: number; // Negativer Gesamtbetrag

  // Pflichtfelder für Storno
  isStorno: true;
  originalInvoiceId: string;
  stornoReason: string;
  stornoDate: Date;
  stornoBy: string;
}

/**
 * Service-Klasse für deutsche Rechnungsbehandlung
 */
export class GermanInvoiceService {
  /**
   * Erstellt eine Storno-Rechnung aus einer ursprünglichen Rechnung
   */
  static createStornoInvoice(
    originalInvoice: InvoiceData,
    stornoReason: string,
    stornoBy: string,
    newSequentialNumber: number,
  ): StornoInvoiceData {
    const stornoDate = new Date();
    const currentYear = stornoDate.getFullYear();

    // Sichere Feldwerte - ersetze undefined mit sinnvollen Defaults
    const safeOriginal = {
      ...originalInvoice,
      // Sichere String-Felder
      description: originalInvoice.description || '',
      notes: originalInvoice.notes || '',
      customerOrderNumber: originalInvoice.customerOrderNumber || '',
      projectTitle: originalInvoice.projectTitle || '',
      contactPersonName: originalInvoice.contactPersonName || '',
      paymentTerms: originalInvoice.paymentTerms || 'Zahlbar sofort ohne Abzug',
      deliveryTerms: originalInvoice.deliveryTerms || '',

      // Sichere Objekt-Felder
      bankDetails: originalInvoice.bankDetails || {
        iban: '',
        bic: '',
        accountHolder: '',
        bankName: '',
      },

      // Sichere Numeric-Felder
      amount: originalInvoice.amount || 0,
      tax: originalInvoice.tax || 0,
      total: originalInvoice.total || 0,
      // `?? undefined` statt `|| 19`: Eine Stornorechnung MUSS den Satz der
      // Ursprungsrechnung tragen. `||` machte aus einer 0-%-Rechnung
      // (Kleinunternehmer, Reverse Charge, steuerbefreit) beim Stornieren
      // eine mit 19 % — aus einem korrekten Beleg wurde ein falscher.
      vatRate: originalInvoice.vatRate ?? undefined,

      // Sichere Boolean-Felder
      isSmallBusiness: originalInvoice.isSmallBusiness || false,

      // Sichere Array-Felder
      items: originalInvoice.items || [],
    };

    return {
      ...safeOriginal,
      id: `storno_${Date.now()}`,
      number: `${currentYear}-${String(newSequentialNumber).padStart(3, '0')}`,
      invoiceNumber: `${currentYear}-${String(newSequentialNumber).padStart(3, '0')}`,
      sequentialNumber: newSequentialNumber,
      date: stornoDate.toISOString().split('T')[0],
      issueDate: stornoDate.toISOString().split('T')[0],
      dueDate: stornoDate.toISOString().split('T')[0], // Storno-Rechnungen sind sofort fällig

      // Negative Beträge für Storno - ALLE Beträge negativ in der Datenbank
      items: safeOriginal.items.map(item => ({
        ...item,
        id: item.id || `item_${Date.now()}_${Math.random()}`,
        description: item.description || '',
        quantity: -Math.abs(item.quantity || 1), // Sicherstellen, dass negativ
        unitPrice: item.unitPrice || 0, // Einzelpreis bleibt positiv
        total: -Math.abs(item.total || 0), // Total negativ
        discountPercent: item.discountPercent || 0, // Rabatt-Default
        taxRate: item.taxRate || safeOriginal.vatRate,
      })),

      // Alle Summen negativ in der Datenbank speichern
      amount: -Math.abs(safeOriginal.amount), // Nettosumme negativ
      tax: -Math.abs(safeOriginal.tax), // Steuerbetrag negativ
      total: -Math.abs(safeOriginal.total), // Gesamtsumme negativ

      // Storno-spezifische Kennzeichnung
      title: `STORNO zu ${safeOriginal.title || safeOriginal.invoiceNumber || safeOriginal.number}`,
      documentNumber: `STORNO-${safeOriginal.documentNumber || safeOriginal.invoiceNumber || safeOriginal.number}`,

      // Storno-spezifische Daten
      status: 'storno',
      isStorno: true,
      originalInvoiceId: safeOriginal.id,
      stornoReason,
      stornoDate: stornoDate,
      stornoBy,

      // Neue Metadaten - als ISO String für bessere Firestore-Kompatibilität
      createdAt: stornoDate,
      year: currentYear,
    };
  } /**
   * Validiert eine Rechnung nach deutschen Standards
   */
  static validateInvoice(invoice: InvoiceData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Pflichtfelder prüfen
    if (!invoice.sequentialNumber || invoice.sequentialNumber <= 0) {
      errors.push('Fortlaufende Rechnungsnummer ist erforderlich');
    }

    if (!invoice.companyName) {
      errors.push('Firmenname ist erforderlich');
    }

    if (!invoice.companyAddress) {
      errors.push('Firmenadresse ist erforderlich');
    }

    if (!invoice.customerName) {
      errors.push('Kundenname ist erforderlich');
    }

    if (!invoice.customerAddress) {
      errors.push('Kundenadresse ist erforderlich');
    }

    if (!invoice.issueDate) {
      errors.push('Rechnungsdatum ist erforderlich');
    }

    if (!invoice.dueDate) {
      errors.push('Fälligkeitsdatum ist erforderlich');
    }

    // Steuernummer oder USt-IdNr. prüfen
    if (!invoice.companyTaxNumber && !invoice.companyVatId) {
      errors.push('Steuernummer oder USt-IdNr. ist erforderlich');
    }

    // Steuerregeln validieren
    if (invoice.isSmallBusiness && invoice.tax > 0) {
      errors.push('Bei Kleinunternehmerregelung darf keine MwSt. ausgewiesen werden');
    }

    // Erweiterte Steuerregeln prüfen
    switch (invoice.taxRuleType) {
      case TaxRuleType.EU_REVERSE_18B:
      case TaxRuleType.DE_REVERSE_13B:
        if (!invoice.reverseChargeInfo?.customerVatId) {
          errors.push('USt-IdNr. des EU-Kunden ist für Reverse-Charge erforderlich');
        }
        if (!invoice.reverseChargeInfo?.euCountryCode) {
          errors.push('EU-Ländercode ist für Reverse-Charge erforderlich');
        }
        if (invoice.tax > 0) {
          errors.push('Bei Reverse-Charge darf keine MwSt. ausgewiesen werden');
        }
        break;

      case TaxRuleType.DE_EXEMPT_4_USTG:
        if (!invoice.taxRuleReason) {
          errors.push('Begründung für Steuerbefreiung ist erforderlich');
        }
        if (invoice.tax > 0) {
          errors.push('Bei Steuerbefreiung darf keine MwSt. ausgewiesen werden');
        }
        break;

      case TaxRuleType.EU_OSS:
        if (!invoice.taxRuleText) {
          errors.push('Steuerhinweis ist bei OSS-Regelung erforderlich');
        }
        break;
    }

    // Positionen prüfen
    if (!invoice.items || invoice.items.length === 0) {
      errors.push('Mindestens eine Rechnungsposition ist erforderlich');
    }

    invoice.items?.forEach((item, index) => {
      if (!item.description) {
        errors.push(`Position ${index + 1}: Beschreibung ist erforderlich`);
      }
      if (item.quantity <= 0) {
        errors.push(`Position ${index + 1}: Menge muss größer als 0 sein`);
      }
      if (item.unitPrice <= 0) {
        errors.push(`Position ${index + 1}: Einzelpreis muss größer als 0 sein`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Formatiert eine Rechnungsnummer nach deutschem Standard
   */
  static formatInvoiceNumber(sequentialNumber: number, year?: number): string {
    const currentYear = year || new Date().getFullYear();
    return `R-${currentYear}-${String(sequentialNumber).padStart(3, '0')}`;
  }

  /**
   * Berechnet MwSt. basierend auf Netto-/Brutto-Eingabe
   */
  static calculateTax(
    amount: number,
    taxRate: number,
    isGross: boolean,
    taxRuleType: TaxRuleType = TaxRuleType.DE_TAXABLE,
    isSmallBusiness: boolean = false,
  ): {
    net: number;
    tax: number;
    gross: number;
    displayText?: string;
  } {
    // Bei bestimmten Steuerregeln wird keine MwSt. berechnet
    const noTaxRules = [
      TaxRuleType.EU_REVERSE_18B,
      TaxRuleType.DE_REVERSE_13B,
      TaxRuleType.NON_EU_EXPORT,
      TaxRuleType.DE_EXEMPT_4_USTG,
    ];
    const isNoTaxCase = noTaxRules.includes(taxRuleType as TaxRuleType) || isSmallBusiness;

    let net: number;
    let tax: number;
    let gross: number;
    let displayText: string | undefined;

    if (isNoTaxCase) {
      // Keine Steuerberechnung für spezielle Fälle
      net = isGross ? amount : amount;
      tax = 0;
      gross = net;

      // Spezifische Hinweistexte
      switch (taxRuleType) {
        case TaxRuleType.EU_REVERSE_18B:
        case TaxRuleType.DE_REVERSE_13B:
          displayText = 'Steuerschuldnerschaft des Leistungsempfängers (Reverse-Charge-Verfahren)';
          break;
        case TaxRuleType.NON_EU_EXPORT:
          displayText = 'Steuerfreie Ausfuhrlieferung';
          break;
        case TaxRuleType.DE_EXEMPT_4_USTG:
          displayText = 'Steuerbefreit gemäß §4 UStG';
          break;
      }

      if (isSmallBusiness) {
        displayText = 'Kleinunternehmer gemäß §19 UStG';
      }
    } else {
      // Normale Steuerberechnung für inländische Fälle
      if (isGross) {
        gross = amount;
        net = gross / (1 + taxRate / 100);
        tax = gross - net;
      } else {
        net = amount;
        tax = net * (taxRate / 100);
        gross = net + tax;
      }
    }

    return {
      net: Math.round(net * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      gross: Math.round(gross * 100) / 100,
      displayText,
    };
  }
}

/**
 * Status-Helper für deutsche Rechnungen
 */
export const InvoiceStatusHelper = {
  getStatusLabel: (status: InvoiceData['status']): string => {
    const labels: Record<InvoiceData['status'], string> = {
      draft: 'Entwurf',
      finalized: 'Finalisiert',
      sent: 'Gesendet',
      paid: 'Bezahlt',
      overdue: 'Überfällig',
      cancelled: 'Abgebrochen',
      storno: 'Storniert',
    };
    return labels[status];
  },

  getStatusColor: (status: InvoiceData['status']): string => {
    const colors: Record<InvoiceData['status'], string> = {
      draft: 'gray',
      finalized: 'purple',
      sent: 'blue',
      paid: 'green',
      overdue: 'red',
      cancelled: 'gray',
      storno: 'red',
    };
    return colors[status];
  },

  canBeStorniert: (invoice: InvoiceData): boolean => {
    return (invoice.status === 'sent' || invoice.status === 'paid') && !invoice.isStorno;
  },

  canBeEdited: (invoice: InvoiceData): boolean => {
    return invoice.status === 'draft' && !invoice.isStorno;
  },

  canBeDeleted: (invoice: InvoiceData): boolean => {
    return invoice.status === 'draft' && !invoice.isStorno;
  },
};
