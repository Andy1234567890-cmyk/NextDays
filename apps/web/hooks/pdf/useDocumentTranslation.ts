'use client';

import { useMemo } from 'react';

export interface DocumentTranslations {
  // Document types
  invoice: string;
  quote: string;
  offer: string;
  deliveryNote: string;
  order: string;
  cancellation: string;
  orderConfirmation: string;

  // Labels
  recipient: string;
  documentDetails: string;
  invoiceNumber: string;
  quoteNumber: string;
  orderNumber: string;
  deliveryNoteNumber: string;
  orderConfirmationNumber: string;
  date: string;
  dueDate: string;
  validUntil: string;
  deliveryDate: string;

  // Table headers
  position: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  vatRate: string;
  articleNumber: string;
  total: string;
  amount: string;

  // Totals
  subtotal: string;
  vatAmount: string;
  totalAmount: string;

  // Units
  piece: string;
  hour: string;
  kilogram: string;
  meter: string;

  // Footer texts
  thankYou: string;
  paymentTerms: string;
  bankDetails: string;
  contactInfo: string;

  // QR Codes
  qrCodePayment: string;
  sepaTransfer: string;

  // Page info
  page: string;
  of: string;

  // Customer info
  customerNumber: string;
  contact: string;
  vatId: string;
  reference: string; // Referenznummer / Bestellnummer

  // Tax information
  taxTreatment: string;

  // Footer text replacements
  inReminder: string;
  asQuote: string;
  inInvoice: string;
  bestRegards: string;

  // Standard texts
  dearCustomer: string;
  quoteIntroduction: string;
  quoteClosing: string;
  taxableRevenue: string;

  // Standard footer text
  standardFooterText: string;
}

const translations: Record<string, DocumentTranslations> = {
  de: {
    // Document types
    invoice: 'Rechnung',
    quote: 'Angebot',
    offer: 'Angebot',
    deliveryNote: 'Lieferschein',
    order: 'Auftrag',
    cancellation: 'Stornorechnung',
    orderConfirmation: 'Auftragsbestätigung',

    // Labels
    recipient: 'Empfänger',
    documentDetails: 'Dokumentdetails',
    invoiceNumber: 'Rechnungsnummer',
    quoteNumber: 'Angebotsnummer',
    orderNumber: 'Auftragsnummer',
    deliveryNoteNumber: 'Lieferscheinnummer',
    orderConfirmationNumber: 'AB-Nr.',
    date: 'Datum',
    dueDate: 'Fälligkeitsdatum',
    validUntil: 'Gültig bis',
    // Hotel/Ferienobjekt: Leistungs- statt Lieferdatum (Aufenthalt/Service)
    deliveryDate: 'Leistungsdatum',

    // Table headers
    position: 'Pos.',
    description: 'Beschreibung',
    quantity: 'Menge',
    unitPrice: 'Einzelpreis',
    discount: 'Rabatt',
    vatRate: 'MwSt.',
    articleNumber: 'Art.-Nr.',
    total: 'Gesamtpreis',
    amount: 'Betrag',

    // Totals
    subtotal: 'Zwischensumme',
    vatAmount: 'MwSt.',
    totalAmount: 'Gesamtbetrag',

    // Units
    piece: 'Stk.',
    hour: 'Std.',
    kilogram: 'kg',
    meter: 'm',

    // Footer texts
    thankYou: 'Vielen Dank für Ihr Vertrauen!',
    paymentTerms: 'Zahlungsbedingungen',
    bankDetails: 'Bankverbindung',
    contactInfo: 'Kontaktinformationen',

    // QR Codes
    qrCodePayment: 'QR-Code für Zahlung',
    sepaTransfer: 'SEPA-Überweisung',

    // Page info
    page: 'Seite',
    of: 'von',

    // Customer info
    customerNumber: 'Kundennummer',
    contact: 'Kontakt',
    vatId: 'USt-IdNr.',
    reference: 'Referenz',

    // Tax information
    taxTreatment: 'Steuerliche Behandlung',

    // Footer text replacements
    inReminder: 'in Mahnung',
    asQuote: 'als Angebot',
    inInvoice: 'in Rechnung',
    bestRegards: 'Mit freundlichen Grüßen',

    // Standard texts
    dearCustomer: 'Sehr geehrte Damen und Herren',
    quoteIntroduction:
      'vielen Dank für Ihre Anfrage! Hiermit unterbreiten wir Ihnen gerne unser Angebot für die folgenden Leistungen:',
    quoteClosing:
      'Dieses Angebot ist gültig bis {date}. Bei Annahme unseres Angebots erstellen wir Ihnen gerne eine entsprechende Rechnung. Für Rückfragen stehen wir Ihnen jederzeit zur Verfügung.',
    taxableRevenue:
      'Steuerpflichtiger Umsatz (Regelsteuersatz 19 %, § 1 Abs. 1 Nr. 1 i.V.m. § 12 Abs. 1 UStG)',
    standardFooterText:
      'Wir bitten Sie, den Rechnungsbetrag von [%GESAMTBETRAG%] unter Angabe der Rechnungsnummer [%RECHNUNGSNUMMER%] auf das unten angegebene Konto zu überweisen. Zahlungsziel: [%ZAHLUNGSZIEL%] Rechnungsdatum: [%RECHNUNGSDATUM%] Vielen Dank für Ihr Vertrauen und die angenehme Zusammenarbeit!<br>Mit freundlichen Grüßen<br>[%KONTAKTPERSON%]',
  },

  en: {
    // Document types
    invoice: 'Invoice',
    quote: 'Quote',
    offer: 'Offer',
    deliveryNote: 'Delivery Note',
    order: 'Order',
    cancellation: 'Cancellation Invoice',
    orderConfirmation: 'Order Confirmation',

    // Labels
    recipient: 'Recipient',
    documentDetails: 'Document Details',
    invoiceNumber: 'Invoice Number',
    quoteNumber: 'Quote Number',
    orderNumber: 'Order Number',
    deliveryNoteNumber: 'Delivery Note Number',
    orderConfirmationNumber: 'Order Confirmation No.',
    date: 'Date',
    dueDate: 'Due Date',
    validUntil: 'Valid Until',
    deliveryDate: 'Service Date',

    // Table headers
    position: 'Pos.',
    description: 'Description',
    quantity: 'Quantity',
    unitPrice: 'Unit Price',
    discount: 'Discount',
    vatRate: 'VAT',
    articleNumber: 'Art. No.',
    total: 'Total',
    amount: 'Amount',

    // Totals
    subtotal: 'Subtotal',
    vatAmount: 'VAT',
    totalAmount: 'Total Amount',

    // Units
    piece: 'pcs.',
    hour: 'hrs.',
    kilogram: 'kg',
    meter: 'm',

    // Footer texts
    thankYou: 'Thank you for your trust!',
    paymentTerms: 'Payment Terms',
    bankDetails: 'Bank Details',
    contactInfo: 'Contact Information',

    // QR Codes
    qrCodePayment: 'QR Code for Payment',
    sepaTransfer: 'SEPA Transfer',

    // Page info
    page: 'Page',
    of: 'of',

    // Customer info
    customerNumber: 'Customer Number',
    contact: 'Contact',
    vatId: 'VAT ID',
    reference: 'Reference',

    // Tax information
    taxTreatment: 'Tax Treatment',

    // Footer text replacements
    inReminder: 'in reminder',
    asQuote: 'as quote',
    inInvoice: 'in invoice',
    bestRegards: 'Best regards',

    // Standard texts
    dearCustomer: 'Dear Sir or Madam',
    quoteIntroduction:
      'thank you for your inquiry! We are pleased to submit our quote for the following services:',
    quoteClosing:
      'This quote is valid until {date}. Upon acceptance of our quote, we will be happy to issue you a corresponding invoice. Please feel free to contact us if you have any questions.',
    taxableRevenue:
      'Taxable revenue (standard rate 19%, § 1 para. 1 no. 1 in conjunction with § 12 para. 1 VAT Act)',
    standardFooterText:
      'Please transfer the invoice amount of [%GESAMTBETRAG%] to the account below, quoting the invoice number [%RECHNUNGSNUMMER%]. Payment terms: [%ZAHLUNGSZIEL%] Invoice date: [%RECHNUNGSDATUM%] Thank you for your trust and the pleasant cooperation!<br>Best regards<br>[%KONTAKTPERSON%]',
  },

  // Weitere Sprachen hier minimiert für bessere Performance
  fr: {
    invoice: 'Facture',
    quote: 'Devis',
    offer: 'Offre',
    deliveryNote: 'Bon de livraison',
    order: 'Commande',
    cancellation: "Facture d'annulation",
    orderConfirmation: 'Confirmation de commande',
    recipient: 'Destinataire',
    documentDetails: 'Détails du document',
    invoiceNumber: 'Numéro de facture',
    quoteNumber: 'Numéro de devis',
    orderNumber: 'Numéro de commande',
    deliveryNoteNumber: 'Numéro de bon de livraison',
    orderConfirmationNumber: 'N° confirmation de commande',
    date: 'Date',
    dueDate: "Date d'échéance",
    validUntil: "Valide jusqu'au",
    deliveryDate: 'Date de prestation',
    position: 'Pos.',
    description: 'Description',
    quantity: 'Quantité',
    unitPrice: 'Prix unitaire',
    discount: 'Remise',
    vatRate: 'TVA',
    articleNumber: 'Réf.',
    total: 'Total',
    amount: 'Montant',
    subtotal: 'Sous-total',
    vatAmount: 'TVA',
    totalAmount: 'Montant total',
    piece: 'pièces',
    hour: 'heures',
    kilogram: 'kg',
    meter: 'm',
    thankYou: 'Merci pour votre confiance!',
    paymentTerms: 'Conditions de paiement',
    bankDetails: 'Coordonnées bancaires',
    contactInfo: 'Informations de contact',
    qrCodePayment: 'QR Code pour paiement',
    sepaTransfer: 'Virement SEPA',
    page: 'Page',
    of: 'de',
    customerNumber: 'Numéro client',
    contact: 'Contact',
    vatId: 'N° TVA',
    taxTreatment: 'Traitement fiscal',
    inReminder: 'en rappel',
    asQuote: 'comme devis',
    inInvoice: 'en facture',
    bestRegards: 'Meilleures salutations',
    reference: 'Référence',

    // Standard texts
    dearCustomer: 'Mesdames et Messieurs',
    quoteIntroduction:
      'merci pour votre demande! Nous avons le plaisir de vous soumettre notre devis pour les services suivants:',
    quoteClosing:
      "Ce devis est valable jusqu'au {date}. En cas d'acceptation de notre devis, nous vous établirons volontiers une facture correspondante. Nous restons à votre disposition pour toute question.",
    taxableRevenue:
      "Chiffre d'affaires imposable (taux normal 19%, § 1 al. 1 n° 1 en liaison avec § 12 al. 1 TVA)",
    standardFooterText:
      'Nous vous prions de virer le montant de la facture de [%GESAMTBETRAG%] sur le compte ci-dessous en indiquant le numéro de facture [%RECHNUNGSNUMMER%]. Délai de paiement : [%ZAHLUNGSZIEL%] Date de facturation : [%RECHNUNGSDATUM%] Merci pour votre confiance et notre agréable collaboration!<br>Meilleures salutations<br>[%KONTAKTPERSON%]',
  },
};

export const useDocumentTranslation = (language: string = 'de') => {
  const t = useMemo(() => {
    const lang = translations[language] || translations.de;
    return (key: keyof DocumentTranslations): string => {
      return lang[key] || translations.de[key] || key;
    };
  }, [language]);

  return { t };
};

/**
 * Übersetzt den Footer-Text, wenn er dem deutschen Standard-Footer entspricht
 * @param footerText Der zu übersetzende Footer-Text
 * @param language Die Zielsprache (de, en, fr)
 * @returns Der übersetzte Footer-Text oder der Original-Text, wenn keine Übereinstimmung
 */
export function translateStandardFooterText(footerText: string, language: string = 'de'): string {
  if (!footerText || language === 'de') return footerText;

  const lang = translations[language] || translations.de;
  const germanStandard = translations.de.standardFooterText;

  // Entferne HTML-Formatierung für Vergleich
  const normalizedFooter = footerText.replace(/<br>/g, '\n').trim();
  const normalizedStandard = germanStandard.replace(/<br>/g, '\n').trim();

  // Prüfe, ob der Footer-Text dem deutschen Standard ähnelt (mit Platzhaltern)
  // Ersetze Platzhalter temporär durch Marker für Vergleich
  const footerForComparison = normalizedFooter
    .replace(/\[%[^\]]+%\]/g, 'PLACEHOLDER')
    .replace(/\s+/g, ' ');
  const standardForComparison = normalizedStandard
    .replace(/\[%[^\]]+%\]/g, 'PLACEHOLDER')
    .replace(/\s+/g, ' ');

  // Wenn ähnlich genug, verwende übersetzten Standard-Text
  if (footerForComparison === standardForComparison) {
    return lang.standardFooterText;
  }

  // Sonst: Versuche häufige deutsche Phrasen zu ersetzen
  let translatedFooter = footerText;

  if (language === 'en') {
    translatedFooter = translatedFooter
      .replace(/Wir bitten Sie,/g, 'Please')
      .replace(/den Rechnungsbetrag von/g, 'transfer the invoice amount of')
      .replace(/unter Angabe der Rechnungsnummer/g, 'quoting the invoice number')
      .replace(/auf das unten angegebene Konto zu überweisen/g, 'to the account below')
      .replace(/Zahlungsziel:/g, 'Payment terms:')
      .replace(/Rechnungsdatum:/g, 'Invoice date:')
      .replace(
        /Vielen Dank für Ihr Vertrauen und die angenehme Zusammenarbeit!/g,
        'Thank you for your trust and the pleasant cooperation!',
      )
      .replace(/Mit freundlichen Grüßen/g, 'Best regards');
  } else if (language === 'fr') {
    translatedFooter = translatedFooter
      .replace(/Wir bitten Sie,/g, 'Nous vous prions')
      .replace(/den Rechnungsbetrag von/g, 'de virer le montant de la facture de')
      .replace(/unter Angabe der Rechnungsnummer/g, 'en indiquant le numéro de facture')
      .replace(/auf das unten angegebene Konto zu überweisen/g, 'sur le compte ci-dessous')
      .replace(/Zahlungsziel:/g, 'Délai de paiement :')
      .replace(/Rechnungsdatum:/g, 'Date de facturation :')
      .replace(
        /Vielen Dank für Ihr Vertrauen und die angenehme Zusammenarbeit!/g,
        'Merci pour votre confiance et notre agréable collaboration!',
      )
      .replace(/Mit freundlichen Grüßen/g, 'Meilleures salutations');
  }

  return translatedFooter;
}
