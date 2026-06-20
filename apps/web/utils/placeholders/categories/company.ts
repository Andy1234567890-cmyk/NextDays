// Firmen-Platzhalter - Zentrale Implementierung
import type { PlaceholderContext, PlaceholderRegistry } from '../types';

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

export const companyPlaceholders: PlaceholderRegistry = {
  // Basis Firmen-Informationen
  FIRMENNAME: (context: PlaceholderContext) =>
    asString(context.company?.companyName) || asString(context.company?.name),

  FIRMENADRESSE: (context: PlaceholderContext) => {
    const company = context.company;
    if (!company) return '';

    const parts = [
      asString(company.street),
      `${asString(company.postalCode)} ${asString(company.city)}`.trim(),
      asString(company.country),
    ].filter(Boolean);

    return parts.join(', ');
  },

  FIRMENSTRASSE: (context: PlaceholderContext) => asString(context.company?.street),

  FIRMENPLZ: (context: PlaceholderContext) => asString(context.company?.postalCode),

  FIRMENORT: (context: PlaceholderContext) => asString(context.company?.city),

  FIRMENLAND: (context: PlaceholderContext) => asString(context.company?.country),

  // Kontakt-Informationen
  FIRMENTELEFON: (context: PlaceholderContext) => asString(context.company?.phone),

  FIRMENEMAIL: (context: PlaceholderContext) => asString(context.company?.email),

  FIRMENFAX: (context: PlaceholderContext) => asString(context.company?.fax),

  FIRMENWEBSITE: (context: PlaceholderContext) => asString(context.company?.website),

  // Steuerliche Informationen - Standardisiert
  UMSATZSTEUER_ID: (context: PlaceholderContext) =>
    asString(context.company?.vatId) || asString(context.company?.umsatzsteuerId) || asString(context.company?.taxId),

  UMSATZSTEUERID: (context: PlaceholderContext) =>
    asString(context.company?.vatId) || asString(context.company?.umsatzsteuerId) || asString(context.company?.taxId),

  VAT_ID: (context: PlaceholderContext) =>
    asString(context.company?.vatId) || asString(context.company?.umsatzsteuerId) || asString(context.company?.taxId),

  STEUERNUMMER: (context: PlaceholderContext) =>
    asString(context.company?.taxNumber) || asString(context.company?.steuernummer),

  TAX_NUMBER: (context: PlaceholderContext) =>
    asString(context.company?.taxNumber) || asString(context.company?.steuernummer),

  // Bankverbindung
  FIRMENIBAN: (context: PlaceholderContext) =>
    asString(asRecord(context.company?.bankDetails)?.iban) || asString(context.company?.iban),

  FIRMENBIC: (context: PlaceholderContext) =>
    asString(asRecord(context.company?.bankDetails)?.bic) || asString(context.company?.bic),

  FIRMENBANK: (context: PlaceholderContext) =>
    asString(asRecord(context.company?.bankDetails)?.bankName) || asString(context.company?.bankName),

  FIRMENKONTOINHABER: (context: PlaceholderContext) =>
    asString(asRecord(context.company?.bankDetails)?.accountHolder) || asString(context.company?.accountHolder),

  // Geschäftsführung und Registrierung
  GESCHAEFTSFUEHRER: (context: PlaceholderContext) =>
    asString(context.company?.ceo) || asString(context.company?.owner),

  HANDELSREGISTER: (context: PlaceholderContext) => asString(context.company?.commercialRegister),

  AMTSGERICHT: (context: PlaceholderContext) => asString(context.company?.court),

  RECHTSFORM: (context: PlaceholderContext) => asString(context.company?.legalForm),

  // Zusätzliche Firmen-Felder
  FIRMENBESCHREIBUNG: (context: PlaceholderContext) => asString(context.company?.description),

  BRANCHE: (context: PlaceholderContext) => asString(context.company?.industry),

  GRUENDUNGSJAHR: (context: PlaceholderContext) =>
    context.company?.foundedYear ? String(context.company.foundedYear) : '',

  MITARBEITERANZAHL: (context: PlaceholderContext) =>
    context.company?.employeeCount ? String(context.company.employeeCount) : '',

  // Logo und Corporate Design
  FIRMENLOGO: (context: PlaceholderContext) => asString(context.company?.logoUrl),

  FIRMENFARBE: (context: PlaceholderContext) => asString(context.company?.brandColor),

  // Spezielle Formate für verschiedene Dokumente
  FIRMENADRESSE_MEHRZEILIG: (context: PlaceholderContext) => {
    const company = context.company;
    if (!company) return '';

    const lines = [
      asString(company.street),
      `${asString(company.postalCode)} ${asString(company.city)}`.trim(),
      asString(company.country),
    ].filter(Boolean);

    return lines.join('\n');
  },

  FIRMENKONTAKT_KOMPLETT: (context: PlaceholderContext) => {
    const company = context.company;
    if (!company) return '';

    const contact: string[] = [];
    const phone = asString(company.phone);
    const email = asString(company.email);
    const fax = asString(company.fax);
    const website = asString(company.website);
    if (phone) contact.push(`Tel: ${phone}`);
    if (email) contact.push(`E-Mail: ${email}`);
    if (fax) contact.push(`Fax: ${fax}`);
    if (website) contact.push(`Web: ${website}`);

    return contact.join(', ');
  },

  STEUERINFO_KOMPLETT: (context: PlaceholderContext) => {
    const company = context.company;
    if (!company) return '';

    const taxInfo: string[] = [];
    const vatId = asString(company.vatId) || asString(company.umsatzsteuerId) || asString(company.taxId);
    const taxNumber = asString(company.taxNumber) || asString(company.steuernummer);

    if (vatId) taxInfo.push(`USt-IdNr.: ${vatId}`);
    if (taxNumber) taxInfo.push(`Steuernr.: ${taxNumber}`);

    return taxInfo.join(', ');
  },

  // Kontaktperson - Für KONTAKTPERSON Platzhalter
  KONTAKTPERSON: (context: PlaceholderContext) => {
    return (
      asString(context.contactPerson?.name) ||
      asString(context.company?.ceo) ||
      asString(context.company?.owner) ||
      asString(context.company?.companyName) ||
      asString(context.company?.name)
    );
  },
};

export default companyPlaceholders;
