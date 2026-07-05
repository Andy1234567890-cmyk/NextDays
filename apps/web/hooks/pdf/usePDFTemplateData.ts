'use client';

import { useEffect, useMemo, useState } from 'react';
import { translateStandardFooterText } from '@/hooks/pdf/useDocumentTranslation';
import { api } from '@/lib/api-client';
import { type DocumentType, detectDocumentType, getDocumentTypeConfig } from '@/lib/document-utils';
import { formatDate } from '@/lib/utils';
import { type InvoiceData, type InvoiceItem, TaxRuleType } from '@/types/invoiceTypes';
import { type PlaceholderData, replacePlaceholders } from '@/utils/placeholderSystem';

/** Extended document data for PDF templates — includes fields from various document types (quotes, credits, etc.) */
interface ExtendedDocumentData extends InvoiceData {
  language?: string;
  headerText?: string;
  introText?: string;
  hinweise?: string;
  additionalNotes?: string;
  conclusionText?: string;
  validUntil?: string;
  expiryDate?: string;
  serviceDate?: string;
  performanceDate?: string;
  invoiceDate?: string;
  quoteDate?: string;
  quoteNumber?: string;
  customerTaxNumber?: string;
  customerCompany?: string;
  customerFax?: string;
  customerWebsite?: string;
  customerRegister?: string;
  companyFax?: string;
  contactPerson?: string;
  closingText?: string;
  discountAmount?: number;
  discountPercentage?: number;
  orderNumber?: string;
  purchaseOrderNumber?: string;
  projectDescription?: string;
  step4?: Record<string, unknown>;
  step3?: Record<string, unknown>;
  showNet?: boolean;
  createdBy?: string;
  profilePictureFirebaseUrl?: string;
  stornoNumber?: string;
  taxGrouped?: { rate: number; taxAmount: number }[] | boolean;
}

// Hilfsfunktion zur Pruefung ob eine Steuerregel keine Steuer berechnet
function isTaxExemptRule(taxRule: string | undefined): boolean {
  if (!taxRule) return false;

  // Reverse Charge Regeln
  if (taxRule.includes('REVERSE')) return true;
  if (taxRule === TaxRuleType.DE_REVERSE_13B) return true;
  if (taxRule === TaxRuleType.EU_REVERSE_18B) return true;

  // Steuerfreie Regeln
  if (taxRule === TaxRuleType.DE_EXEMPT_4_USTG) return true;
  if (taxRule === TaxRuleType.EU_INTRACOMMUNITY_SUPPLY) return true;
  if (taxRule === TaxRuleType.NON_EU_EXPORT) return true;
  if (taxRule === TaxRuleType.NON_EU_OUT_OF_SCOPE) return true;

  return false;
}

// Hook zum Laden der Kundennummer basierend auf Kundenname
export function useCustomerNumber(companyId: string, customerName: string): string {
  const [customerNumber, setCustomerNumber] = useState('');

  useEffect(() => {
    if (!companyId || !customerName) {
      setCustomerNumber('');
      return;
    }

    const loadCustomerNumber = async () => {
      try {
        // Versuche zuerst die Subcollection Struktur (nur falls authentifiziert)
        if (companyId && customerName) {
          const response = await api.get<{
            items?: { customerNumber?: string }[];
            data?: { customerNumber?: string }[];
          }>(
            `/api/v1/companies/${companyId}/customers?name=${encodeURIComponent(customerName)}&limit=1`,
          );

          const items = response.items || response.data || [];
          if (items.length > 0) {
            setCustomerNumber(items[0].customerNumber || '');
            return;
          }
        }

        // Fallback: Generiere Kundennummer aus dem Namen (ohne DB-Zugriff)
        const nameWords = customerName.split(' ').filter(word => word.length > 0);
        let fallbackNumber = '';

        if (nameWords.length === 1) {
          fallbackNumber = `${nameWords[0].substring(0, 4).toUpperCase()}-001`;
        } else {
          const initials = nameWords.map(word => word.charAt(0).toUpperCase()).join('');
          fallbackNumber = `${initials}-001`;
        }

        setCustomerNumber(fallbackNumber);
      } catch {
        // Stiller Fallback bei Fehlern - keine Console-Error-Ausgabe
        const nameWords = customerName.split(' ').filter(word => word.length > 0);
        const initials = nameWords
          .map(word => word.charAt(0).toUpperCase())
          .join('')
          .substring(0, 4);
        setCustomerNumber(`${initials}-001`);
      }
    };

    loadCustomerNumber();
  }, [companyId, customerName]);

  return customerNumber;
}

export interface DocumentSettings {
  language: string;
  showQRCode: boolean;
  showEPCQRCode: boolean;
  showCustomerNumber: boolean;
  showContactPerson: boolean;
  showVATPerPosition: boolean;
  showArticleNumber: boolean;
  showFoldLines: boolean;
  showPageNumbers: boolean;
  showFooter: boolean;
  showWatermark: boolean;
  qrCodeUrl?: string; // QR-Code URL für die Anzeige im Template
  epcQrCodeUrl?: string; // EPC QR-Code URL für SEPA-Überweisungen (Girocode)
}

export interface PDFTemplateProps {
  document: ExtendedDocumentData;
  template: string;
  color: string;
  logoUrl?: string | null;
  logoSize?: number;
  documentType: DocumentType;
  pageMode?: 'single' | 'multi';
  documentSettings?: DocumentSettings;
  userData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    uid?: string;
  };
}

export interface ParsedAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface ProcessedPDFData {
  // Document labels
  documentLabel: string;

  // Calculated values
  realItems: InvoiceItem[];
  vatRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;

  // Formatted dates
  formattedInvoiceDate: string;
  formattedDueDate: string;

  // Company data
  companyAddressParsed: ParsedAddress;
  customerAddressParsed: ParsedAddress;

  // Original data for fallback
  originalDocument: ExtendedDocumentData;

  // Settings
  language: string;
  isSmallBusiness: boolean;

  // Template texts (processed with placeholders)
  processedHeaderText: string;
  processedFooterText: string;
  processedHeadTextHtml: string;

  // All other fields from document
  [key: string]: unknown;

  // Company details
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  companyTaxNumber: string;
  companyVatId: string;

  // Customer details
  customerName: string;
  customerAddress: string;
  customerEmail: string;
  customerOrderNumber?: string; // Referenznummer / Bestellnummer des Kunden
  customerVatId?: string; // USt-IdNr. des Kunden
  customerPhone?: string; // Telefon des Kunden

  // Invoice details
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  date?: string;
  validUntil?: string;
  documentNumber?: string;
  quoteNumber?: string;
  quoteDate?: string;
  title?: string; // Betreff für Stornorechnungen

  // Assets / optional media
  companyLogo?: string;
  qrCodeUrl?: string;
  epcQrCodeUrl?: string;

  // Optional customer extras
  customerNumber?: string;

  // Items
  items: InvoiceItem[];

  // Text content
  description: string | undefined;
  headerText: string | undefined;
  footerText: string | undefined;
  headTextHtml: string | undefined;
  introText: string | undefined;
  notes: string | undefined;
  hinweise: string | undefined;
  additionalNotes: string | undefined;
  conclusionText: string | undefined;
  paymentTerms: string | undefined;
  deliveryDate: string | undefined;
  servicePeriod: string | undefined;
  internalContactPerson: string | undefined;
  contactPersonName: string | undefined;

  // Tax settings
  priceInput: string;
  taxRuleType: string;
  taxGrouped?: { rate: number; taxAmount: number }[];
  taxRule?: string;

  // Skonto
  skontoEnabled?: boolean;
  skontoDays?: number;
  skontoPercentage?: number;

  // Bank details
  bankDetails: InvoiceData['bankDetails'];
}

function parseAddress(
  address:
    | string
    | { street?: string; city?: string; postalCode?: string; country?: string }
    | null,
): ParsedAddress {
  if (!address) {
    return { street: '', city: '', postalCode: '', country: '' };
  }

  // Wenn address bereits ein Objekt ist, direkt verwenden
  if (typeof address === 'object' && address !== null) {
    return {
      street: address.street || '',
      city: address.city || '',
      postalCode: address.postalCode || '',
      country: address.country || '',
    };
  }

  // Wenn address ein String ist, wie bisher parsen
  const lines = address
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  if (lines.length === 0) {
    return { street: '', city: '', postalCode: '', country: '' };
  }

  // Einfache Parsing-Logik
  const street = lines[0] || '';
  const cityLine = lines[1] || '';
  const country = lines[2] || '';

  // PLZ und Stadt aus der zweiten Zeile extrahieren
  const cityMatch = cityLine.match(/^(\d+)\s+(.+)$/);
  const postalCode = cityMatch ? cityMatch[1] : '';
  const city = cityMatch ? cityMatch[2] : cityLine;

  return { street, city, postalCode, country };
}

function normalizeTaxGrouped(
  value: ExtendedDocumentData['taxGrouped'],
): { rate: number; taxAmount: number }[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is { rate: number; taxAmount: number } =>
      typeof entry === 'object' &&
      entry !== null &&
      'rate' in entry &&
      'taxAmount' in entry &&
      typeof entry.rate === 'number' &&
      typeof entry.taxAmount === 'number',
  );
}

export function usePDFTemplateData(props: PDFTemplateProps): ProcessedPDFData {
  const { document: documentData, logoUrl, logoSize, documentSettings, userData } = props;
  const language = documentSettings?.language || documentData.language || 'de';

  // Kundendaten-Anreicherung via API - DEFENSIVE PROGRAMMIERUNG
  const companyId =
    documentData && typeof documentData === 'object' ? documentData.companyId || '' : '';
  const customerName = documentData?.customerName || 'Kunde';
  const enrichedCustomerNumber = useCustomerNumber(companyId, customerName);

  return useMemo(() => {
    // Dokumenttyp erkennen - props.documentType hat Vorrang
    const detectedType = props.documentType || detectDocumentType(documentData);
    const _documentTypeConfig = getDocumentTypeConfig(detectedType);

    // Steuerregel aus Dokument extrahieren
    const taxRule = documentData.taxRule || documentData.taxRuleType;
    const isTaxExempt = isTaxExemptRule(taxRule);

    // Items verarbeiten
    const realItems = documentData.items || [];
    // Beleg-Steuersatz als Fallback für Positionen OHNE eigenen Satz. Kein
    // erfundener 19er-Default (Projektregel: keine Fallback-Ersatzwerte, MwSt.
    // nie hartkodieren) und 0 ist ein gültiger Satz (?? statt ||) — fehlt jeder
    // Satz, wird nicht besteuert statt „19 % weil Deutschland" zu erfinden.
    const docRate = documentData.vatRate ?? documentData.taxRate;
    const vatRate: number = isTaxExempt || docRate == null ? 0 : Number(docRate);

    // Beträge berechnen. Steuer PRO Position aus deren eigenem Satz summieren
    // (nicht ein globaler Satz auf die Zwischensumme) — sonst weicht `total` bei
    // gemischten Sätzen (z. B. 19 % Übernachtung + 0 % Kurtaxe) von den pro Satz
    // gerenderten Steuerzeilen (TotalsDisplay/taxGrouped) ab. Gleiche Regel wie
    // calc.ts::computeTotals: Zeilen-Satz vor Beleg-Satz.
    let subtotal = 0;
    let taxAmount = 0;
    const taxable = !documentData.isSmallBusiness && !isTaxExempt;

    realItems.forEach(item => {
      // Verwende unitPrice (nicht price) und berücksichtige discountPercent
      const unitPrice =
        item.unitPrice || ((item as unknown as Record<string, unknown>).price as number) || 0;
      const quantity = item.quantity || 0;
      const discountPercent = item.discountPercent || 0;

      // Berechne Gesamtpreis: (Menge × Einzelpreis) × (1 - Rabatt/100)
      const itemTotal = quantity * unitPrice * (1 - discountPercent / 100);
      subtotal += itemTotal;

      if (taxable) {
        // Zeilen-eigener Satz (0 ist gültig!) vor Beleg-Satz — ?? statt ||.
        const rawRate = (item as unknown as Record<string, unknown>).vatRate ??
          (item as unknown as Record<string, unknown>).taxRate;
        const lineRate = rawRate == null ? vatRate : Number(rawRate);
        taxAmount += itemTotal * (lineRate / 100);
      }
    });

    const total = subtotal + taxAmount;

    // Dokument-Label basierend auf Dokumenttyp und Sprache
    const getDocumentLabel = () => {
      const detectedType = props.documentType || detectDocumentType(documentData);

      if (language === 'en') {
        switch (detectedType) {
          case 'quote':
            return 'Quote';
          case 'invoice':
            return 'Invoice';
          case 'reminder':
            return 'Reminder';
          case 'credit-note':
            return 'Credit Note';
          case 'cancellation':
            return 'Cancellation';
          default:
            return 'Document';
        }
      } else {
        // Deutsch (Standard)
        switch (detectedType) {
          case 'quote':
            return 'Angebot';
          case 'invoice':
            return 'Rechnung';
          case 'reminder':
            return 'Mahnung';
          case 'credit-note':
            return 'Gutschrift';
          case 'cancellation':
            return 'Stornorechnung';
          default:
            return 'Dokument';
        }
      }
    };

    const documentLabel = getDocumentLabel();

    // Datumsformatierung mit korrigierter formatDate Funktion
    const formattedInvoiceDate = formatDate(
      documentData.date || documentData.issueDate || documentData.invoiceDate || '',
    );
    const formattedDueDate = formatDate(documentData.dueDate || documentData.validUntil || '');

    // Benutzerfreundlichere Bezeichnungen

    const companyName = documentData.companyName || 'Ihr Unternehmen';

    const customerName = documentData.customerName || 'Kunde';
    const invoiceNumber =
      documentData.invoiceNumber ||
      documentData.number ||
      documentData.documentNumber ||
      documentData.title ||
      'INV-001';
    const invoiceDate = formatDate(
      documentData.date || documentData.issueDate || documentData.invoiceDate || '',
    );
    const dueDate = formatDate(documentData.dueDate || documentData.validUntil || '');
    const sequentialNumber = documentData.sequentialNumber || '';

    // Kundendaten
    const customerAddress = documentData.customerAddress || '';
    const customerEmail = documentData.customerEmail || '';
    const customerPhone = documentData.customerPhone || '';
    const customerNumber = enrichedCustomerNumber || documentData.customerNumber || ''; // Angereicherte Kundennummer via API-Fallback
    // customerOrderNumber kann als "customerOrderNumber" oder "reference" übergeben werden
    const customerOrderNumber = documentData.customerOrderNumber || documentData.reference || '';
    const customerFirstName = documentData.customerFirstName || '';
    const customerLastName = documentData.customerLastName || '';
    const customerTaxNumber = documentData.customerTaxNumber || '';
    const customerVatId = documentData.customerVatId || '';

    // Firmendaten
    const companyAddress = documentData.companyAddress || '';
    const companyEmail = documentData.companyEmail || '';
    const companyPhone = documentData.companyPhone || '';
    const companyWebsite = documentData.companyWebsite || '';
    const companyVatId = documentData.companyVatId || '';
    const companyTaxNumber = documentData.companyTaxNumber || '';
    const _companyRegister = documentData.companyRegister || '';

    // Textinhalte
    const headTextHtml = documentData.headTextHtml;
    const description = documentData.description;
    const introText = documentData.introText;
    const headerText = documentData.headerText;

    // Footer-Text (bereits mit Platzhaltern aus Datenbank) + Übersetzung
    let footerText = documentData.footerText || '';
    // Übersetze Standard-Footer-Text basierend auf Sprache
    footerText = translateStandardFooterText(footerText, language);

    const notes = documentData.notes;
    const hinweise = documentData.hinweise;
    const additionalNotes = documentData.additionalNotes;
    const conclusionText = documentData.conclusionText;
    const paymentTerms = documentData.paymentTerms || documentData.paymentTerms;
    const deliveryDate = documentData.deliveryDate;
    const servicePeriod = documentData.servicePeriod;
    const internalContactPerson = documentData.internalContactPerson;
    const contactPersonName = documentData.contactPersonName;

    // Steuereinstellungen
    const isSmallBusiness = documentData.isSmallBusiness || false;
    const priceInput = documentData.priceInput || 'netto';
    const taxRuleType = documentData.taxRuleType || '';
    const normalizedTaxGrouped = normalizeTaxGrouped(documentData.taxGrouped);

    // Adress-Parsing
    const companyAddressParsed = parseAddress(companyAddress);
    const customerAddressParsed = parseAddress(customerAddress);

    // 🆕 Platzhalter-Daten erstellen und Texte verarbeiten - ALLE verfügbaren Platzhalter
    const placeholderData: PlaceholderData = {
      // Firmen-Informationen
      companyName,
      companyStreet: companyAddressParsed.street,
      companyCity: companyAddressParsed.city,
      companyPostalCode: companyAddressParsed.postalCode,
      companyCountry: companyAddressParsed.country,
      companyPhone,
      companyEmail,
      companyWebsite,
      companyTaxNumber,
      companyVatId,
      companyRegistrationNumber:
        documentData.companyRegister || documentData.companyRegistrationNumber || '',
      companyIban: documentData.companyIban || '',
      companyBic: documentData.companyBic || '',
      companyFax: documentData.companyFax || '',

      // Kunden-Informationen (vollständig)
      customerName,
      customerEmail,
      customerAddress:
        customerAddress || // Original falls vorhanden
        (customerAddressParsed.street // Ansonsten aus parsed zusammenbauen
          ? `${customerAddressParsed.street}\n${customerAddressParsed.postalCode} ${customerAddressParsed.city}\n${customerAddressParsed.country}`.trim()
          : ''), // Leer lassen wenn keine Daten
      customerStreet: customerAddressParsed.street,
      customerCity: customerAddressParsed.city,
      customerPostalCode: customerAddressParsed.postalCode,
      customerCountry: customerAddressParsed.country,
      customerPhone,
      customerNumber,
      customerOrderNumber,
      customerFirstName,
      customerLastName,
      customerTaxNumber,
      customerVatId,

      // Dokument-Informationen
      documentNumber: invoiceNumber,
      invoiceNumber: invoiceNumber, // Für RECHNUNGSNUMMER
      quoteNumber: documentData.quoteNumber || invoiceNumber,
      documentDate:
        invoiceDate || formatDate(String(documentData.date || documentData.createdAt || '')), // Für RECHNUNGSDATUM
      dueDate: dueDate, // Nur wenn vorhanden
      validUntil: dueDate || formatDate(documentData.validUntil || documentData.expiryDate || ''), // Für GUELTIG_BIS
      expiryDate:
        formatDate(documentData.expiryDate || '') ||
        dueDate ||
        formatDate(documentData.validUntil || ''),
      serviceDate:
        formatDate(
          documentData.serviceDate ||
            documentData.performanceDate ||
            documentData.deliveryDate ||
            '',
        ) ||
        invoiceDate ||
        '', // Für LEISTUNGSDATUM
      servicePeriod: documentData.servicePeriod || '',

      // Beträge (auch wenn 0, damit Platzhalter ersetzt werden)
      totalAmount: total, // Für GESAMTBETRAG
      subtotalAmount: subtotal, // Für NETTOBETRAG
      taxAmount: taxAmount,
      netAmount: subtotal,

      // Zahlungskonditionen
      paymentTerms: paymentTerms || documentData.paymentTerms || '', // Nur wenn vorhanden
      skontoText: documentData.skontoText || '',

      // Kontaktperson - Prioritätsbasierte Fallback-Logik
      internalContactPerson:
        userData?.firstName && userData?.lastName
          ? `${userData.firstName} ${userData.lastName}`
          : documentData.internalContactPerson || documentData.contactPerson || '',

      contactPersonName: documentData.contactPersonName || '',

      // User-spezifische Daten
      firstName: userData?.firstName || '',
      lastName: userData?.lastName || '',
      userEmail: userData?.email || '',
      userPhone: userData?.phone || '',

      // Template-Texte
      headerText: documentData.headerText || '',
      footerText: documentData.footerText || '',
      introText: documentData.introText || documentData.description || '',
      closingText: documentData.closingText || '',

      // Gültigkeitsdatum
      // Gültigkeit (bereits oben mit besseren Fallbacks definiert)

      // Kleine Unternehmer Regelung
      isSmallBusiness: isSmallBusiness,

      // Erweiterte Firmen-Daten (companyFax und companyRegister bereits oben definiert)

      // Erweiterte Kunden-Daten
      customerCompany: documentData.customerCompany || customerName,
      customerFax: documentData.customerFax || '',
      customerWebsite: documentData.customerWebsite || '',
      customerRegister: documentData.customerRegister || '',

      // Erweiterte Beträge und Finanzen
      discountAmount: documentData.discountAmount || 0,
      discountPercentage: documentData.discountPercentage || 0,
      orderNumber: documentData.orderNumber || documentData.purchaseOrderNumber || '',
      currency: documentData.currency || 'EUR',

      // Steuersatz
      vatRate: vatRate,

      // Projekt-Informationen
      projectTitle: documentData.projectTitle || documentData.title || '',
      projectDescription: documentData.projectDescription || documentData.description || '',

      // Bank-Daten aus document übernehmen (für Fallback-Zugriff)
      bankDetails: documentData.bankDetails,
      step4: documentData.step4,
      step3: documentData.step3,

      // Projekt-Informationen bereits oben definiert

      // Aktuelle Zeit-Informationen (für Datumsplatzhalter)
      currentDate: new Date().toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US'),
      currentYear: new Date().getFullYear().toString(),
      currentMonth: new Date().toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
        month: 'long',
      }),
    };

    // Platzhalter in Texten ersetzen mit Sprach-Support
    const docLanguage = language || 'de'; // Verwende bereits vorhandene language Variable
    const processedHeaderText = replacePlaceholders(headerText ?? '', placeholderData, docLanguage);
    const processedFooterText = replacePlaceholders(footerText, placeholderData, docLanguage);
    const processedHeadTextHtml = replacePlaceholders(
      headTextHtml ?? '',
      placeholderData,
      docLanguage,
    );

    return {
      documentLabel,
      realItems,
      vatRate,
      subtotal,
      taxAmount,
      total,
      formattedInvoiceDate,
      formattedDueDate,
      companyAddressParsed,
      customerAddressParsed,
      originalDocument: documentData,
      language,
      isSmallBusiness,
      processedHeaderText,
      processedFooterText,
      processedHeadTextHtml,

      // Direct fields
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      companyTaxNumber,
      companyVatId,
      customerName,
      customerAddress,
      customerEmail,
      customerNumber, // Kundennummer aus Dokument oder Datenbank
      companyId: documentData.companyId || '', // Company ID für useCustomerNumber Hook
      invoiceNumber,
      documentNumber:
        documentData.documentNumber || documentData.number || documentData.invoiceNumber || '',
      quoteNumber: documentData.quoteNumber || '',
      quoteDate: documentData.quoteDate || documentData.validUntil || '',
      invoiceDate,
      dueDate,
      validUntil: dueDate, // Für Template-Kompatibilität - bereits formatiert
      date: invoiceDate, // Für Template-Kompatibilität - bereits formatiert
      sequentialNumber,
      title: documentData.title || '', // Betreff für Stornorechnungen
      originalInvoiceNumber: documentData.originalInvoiceNumber || '', // Original-Rechnungsnummer bei Storno
      stornoNumber: documentData.stornoNumber || '', // Storno-Nummer

      // Kunden-Zusatzdaten
      customerOrderNumber, // Referenznummer / Bestellnummer des Kunden
      customerVatId, // USt-IdNr. des Kunden
      customerPhone, // Telefon des Kunden

      items: realItems,
      description,
      headerText,
      footerText,
      headTextHtml,
      introText,
      notes,
      hinweise,
      additionalNotes,
      conclusionText,
      paymentTerms,
      deliveryDate,
      servicePeriod,
      internalContactPerson,
      contactPersonName,
      priceInput,
      taxRuleType,
      bankDetails: documentData.bankDetails,

      // Fehlende Eigenschaften aus Screenshots (nur neue)
      taxRule: documentData.taxRule || '',
      showNet: documentData.showNet || false,
      taxGrouped: normalizedTaxGrouped,
      skontoEnabled: documentData.skontoEnabled || false,
      skontoDays: documentData.skontoDays || 0,
      skontoPercentage: documentData.skontoPercentage || 0,
      skontoText: documentData.skontoText || '',
      eInvoice: documentData.eInvoice || false,
      eInvoiceData: documentData.eInvoiceData || {},
      status: documentData.status || 'draft',
      currency: documentData.currency || 'EUR',
      createdBy: documentData.createdBy || '',
      deliveryTerms: documentData.deliveryTerms || '',
      companyLogo: (() => {
        const resolvedLogo =
          documentData.companyLogo ||
          logoUrl ||
          documentData.profilePictureURL ||
          documentData.profilePictureFirebaseUrl ||
          '';

        return resolvedLogo;
      })(),
      logoSize: logoSize || 80,

      // QR-Code URLs aus documentSettings
      qrCodeUrl: documentSettings?.qrCodeUrl,
      epcQrCodeUrl: documentSettings?.epcQrCodeUrl,
    };
  }, [
    documentData,
    logoUrl,
    logoSize,
    documentSettings,
    userData,
    enrichedCustomerNumber,
    language,
    props.documentType,
  ]);
}
