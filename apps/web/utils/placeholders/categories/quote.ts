// Angebots-spezifische Platzhalter - Zentrale Implementierung
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

export const quotePlaceholders: PlaceholderRegistry = {
  // Basis Angebots-Informationen
  ANGEBOTSNUMMER: (context: PlaceholderContext) =>
    asString(context.quote?.quoteNumber) || asString(context.quote?.number) || '',

  ANGEBOTSDATUM: (context: PlaceholderContext) => {
    const quote = context.quote;
    if (!quote?.quoteDate) return '';

    const date = toDateValue(quote.quoteDate as string | Date);
    return date.toLocaleDateString('de-DE');
  },

  GUELTIGKEITSDATUM: (context: PlaceholderContext) => {
    const quote = context.quote;
    if (!quote?.validUntil) return '';

    const date = toDateValue(quote.validUntil as string | Date);
    return date.toLocaleDateString('de-DE');
  },

  GUELTIGKEITSDAUER: (context: PlaceholderContext) => {
    const quote = context.quote;
    return quote?.validityPeriod ? `${quote.validityPeriod} Tage` : '';
  },

  // Angebots-Beträge
  ANGEBOT_NETTOBETRAG: (context: PlaceholderContext) => {
    const quote = context.quote;
    const amount = asNumber(quote?.netAmount);
    if (amount === null) return '';
    return toCurrency(amount, asString(quote?.currency) || undefined);
  },

  ANGEBOT_STEUERBETRAG: (context: PlaceholderContext) => {
    const quote = context.quote;
    const amount = asNumber(quote?.taxAmount);
    if (amount === null) return '';
    return toCurrency(amount, asString(quote?.currency) || undefined);
  },

  ANGEBOT_GESAMTBETRAG: (context: PlaceholderContext) => {
    const quote = context.quote;
    const amount = asNumber(quote?.totalAmount);
    if (amount === null) return '';
    return toCurrency(amount, asString(quote?.currency) || undefined);
  },

  // Status und Metadaten
  ANGEBOTSSTATUS: (context: PlaceholderContext) => {
    const status = asString(context.quote?.status);
    const statusMap: { [key: string]: string } = {
      draft: 'Entwurf',
      sent: 'Versendet',
      accepted: 'Angenommen',
      rejected: 'Abgelehnt',
      expired: 'Abgelaufen',
    };
    return statusMap[status] || status || '';
  },

  ANGEBOTS_REVISION: (context: PlaceholderContext) =>
    context.quote?.revision ? context.quote.revision.toString() : '1',

  // Projektbezug
  ANGEBOT_PROJEKTNAME: (context: PlaceholderContext) => asString(context.quote?.projectName) || '',

  ANGEBOT_PROJEKTBESCHREIBUNG: (context: PlaceholderContext) =>
    asString(context.quote?.projectDescription) || '',

  // Zahlungskonditionen
  ANGEBOT_ZAHLUNGSBEDINGUNGEN: (context: PlaceholderContext) =>
    asString(context.quote?.paymentTerms) || '',

  ANGEBOT_LIEFERBEDINGUNGEN: (context: PlaceholderContext) =>
    asString(context.quote?.deliveryTerms) || '',

  // Gültigkeitsberechnungen
  TAGE_BIS_ABLAUF: (context: PlaceholderContext) => {
    const quote = context.quote;
    if (!quote?.validUntil) return '';

    const validUntil = toDateValue(quote.validUntil as string | Date);
    const today = new Date();
    const diffTime = validUntil.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays.toString();
  },

  ANGEBOT_ABLAUF_STATUS: (context: PlaceholderContext) => {
    const quote = context.quote;
    if (!quote?.validUntil) return '';

    const validUntil = toDateValue(quote.validUntil as string | Date);
    const today = new Date();

    return validUntil > today ? 'Gültig' : 'Abgelaufen';
  },

  // Bemerkungen
  ANGEBOT_BEMERKUNGEN: (context: PlaceholderContext) =>
    asString(context.quote?.notes) || asString(context.quote?.remarks) || '',

  ANGEBOT_BEDINGUNGEN: (context: PlaceholderContext) => asString(context.quote?.conditions) || '',
};

export default quotePlaceholders;
