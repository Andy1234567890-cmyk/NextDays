// Rechnungs-spezifische Platzhalter - Zentrale Implementierung
import type { PlaceholderContext, PlaceholderRegistry } from '../types';

const toDateValue = (value: Date | string | { toDate: () => Date }): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate();
  }
  return new Date(value);
};

const toCurrency = (amount: number, currency: string | undefined): string =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(amount);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null);

export const invoicePlaceholders: PlaceholderRegistry = {
  // Basis Rechnungs-Informationen
  RECHNUNGSNUMMER: (context: PlaceholderContext) =>
    asString(context.invoice?.invoiceNumber) || asString(context.invoice?.number) || '',

  RECHNUNGSDATUM: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    if (!invoice?.invoiceDate) return '';

    const date = toDateValue(invoice.invoiceDate as string | Date);
    return date.toLocaleDateString('de-DE');
  },

  FAELLIGKEITSDATUM: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    if (!invoice?.dueDate) return '';

    const date = toDateValue(invoice.dueDate as string | Date);
    return date.toLocaleDateString('de-DE');
  },

  LEISTUNGSDATUM: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    if (!invoice?.serviceDate) return '';

    const date = toDateValue(invoice.serviceDate as string | Date);
    return date.toLocaleDateString('de-DE');
  },

  LEISTUNGSZEITRAUM: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    if (!invoice?.servicePeriodStart || !invoice?.servicePeriodEnd) return '';

    const startDate = toDateValue(invoice.servicePeriodStart as string | Date);
    const endDate = toDateValue(invoice.servicePeriodEnd as string | Date);

    return `${startDate.toLocaleDateString('de-DE')} - ${endDate.toLocaleDateString('de-DE')}`;
  },

  // Beträge und Steuer
  NETTOBETRAG: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    const amount = asNumber(invoice?.netAmount);
    if (amount === null) return '';
    return toCurrency(amount, asString(invoice?.currency) || undefined);
  },

  STEUERBETRAG: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    const amount = asNumber(invoice?.taxAmount);
    if (amount === null) return '';
    return toCurrency(amount, asString(invoice?.currency) || undefined);
  },

  BRUTTOBETRAG: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    const amount = asNumber(invoice?.totalAmount);
    if (amount === null) return '';
    return toCurrency(amount, asString(invoice?.currency) || undefined);
  },

  GESAMTBETRAG: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    const amount = asNumber(invoice?.totalAmount);
    if (amount === null) return '';
    return toCurrency(amount, asString(invoice?.currency) || undefined);
  },

  STEUERSATZ: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    if (!invoice?.taxRate && invoice?.taxRate !== 0) return '';
    return `${String(invoice.taxRate)}%`;
  },

  WAEHRUNG: (context: PlaceholderContext) => asString(context.invoice?.currency) || 'EUR',

  // Zahlungsinformationen
  ZAHLUNGSZIEL: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    return invoice?.paymentTerms ? `${String(invoice.paymentTerms)} Tage` : '';
  },

  ZAHLUNGSART: (context: PlaceholderContext) => asString(context.invoice?.paymentMethod),

  VERWENDUNGSZWECK: (context: PlaceholderContext) =>
    asString(context.invoice?.reference) || asString(context.invoice?.invoiceNumber) || '',

  // Status und Metadaten
  RECHNUNGSSTATUS: (context: PlaceholderContext) => {
    const status = asString(context.invoice?.status);
    const statusMap: { [key: string]: string } = {
      draft: 'Entwurf',
      sent: 'Versendet',
      paid: 'Bezahlt',
      overdue: 'Überfällig',
      cancelled: 'Storniert',
    };
    return statusMap[status] || status || '';
  },

  RECHNUNGSART: (context: PlaceholderContext) => {
    const type = asString(context.invoice?.type);
    const typeMap: { [key: string]: string } = {
      invoice: 'Rechnung',
      credit: 'Gutschrift',
      storno: 'Storno',
      reminder: 'Mahnung',
    };
    return typeMap[type] || type || 'Rechnung';
  },

  // Bestellbezug
  BESTELLNUMMER: (context: PlaceholderContext) =>
    asString(context.invoice?.orderNumber) || asString(context.invoice?.purchaseOrderNumber) || '',

  BESTELLDATUM: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    if (!invoice?.orderDate) return '';

    const date = toDateValue(invoice.orderDate as string | Date);
    return date.toLocaleDateString('de-DE');
  },

  PROJEKTNUMMER: (context: PlaceholderContext) => asString(context.invoice?.projectNumber) || '',

  PROJEKTNAME: (context: PlaceholderContext) => asString(context.invoice?.projectName) || '',

  // Rabatte und Zuschläge
  RABATTBETRAG: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    const amount = asNumber(invoice?.discountAmount);
    if (amount === null) return '';
    return toCurrency(amount, asString(invoice?.currency) || undefined);
  },

  RABATTSATZ: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    if (!invoice?.discountRate && invoice?.discountRate !== 0) return '';
    return `${String(invoice.discountRate)}%`;
  },

  // Versand und Lieferung
  VERSANDKOSTEN: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    const amount = asNumber(invoice?.shippingCost);
    if (amount === null) return '';
    return toCurrency(amount, asString(invoice?.currency) || undefined);
  },

  LIEFERADRESSE: (context: PlaceholderContext) => asString(context.invoice?.deliveryAddress) || '',

  LIEFERDATUM: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    if (!invoice?.deliveryDate) return '';

    const date = toDateValue(invoice.deliveryDate as string | Date);
    return date.toLocaleDateString('de-DE');
  },

  // Bemerkungen und Notizen
  BEMERKUNGEN: (context: PlaceholderContext) =>
    asString(context.invoice?.notes) || asString(context.invoice?.remarks) || '',

  INTERNE_NOTIZEN: (context: PlaceholderContext) => asString(context.invoice?.internalNotes) || '',

  ZAHLUNGSHINWEIS: (context: PlaceholderContext) => asString(context.invoice?.paymentNote) || '',

  // Storno-spezifische Platzhalter
  STORNO_GRUND: (context: PlaceholderContext) => asString(context.invoice?.cancelReason) || '',

  STORNO_DATUM: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    if (!invoice?.cancelDate) return '';

    const date = toDateValue(invoice.cancelDate as string | Date);
    return date.toLocaleDateString('de-DE');
  },

  ORIGINAL_RECHNUNGSNUMMER: (context: PlaceholderContext) =>
    asString(context.invoice?.originalInvoiceNumber) || '',

  // Berechnete Felder
  TAGE_BIS_FAELLIGKEIT: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    if (!invoice?.dueDate) return '';

    const dueDate = toDateValue(invoice.dueDate as string | Date);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays.toString();
  },

  POSITION_ANZAHL: (context: PlaceholderContext) => {
    const invoice = context.invoice;
    return Array.isArray(invoice?.items) ? invoice.items.length.toString() : '0';
  },
};

export default invoicePlaceholders;
