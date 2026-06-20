// Kunden-Platzhalter - Zentrale Implementierung
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

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

export const customerPlaceholders: PlaceholderRegistry = {
  // Basis Kunden-Informationen
  KUNDENNAME: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    if (!customer) return '';

    // Für Firmenkunden
    if (customer.companyName) return asString(customer.companyName);

    // Für Privatkunden
    const firstName = asString(customer.firstName) || asString(customer.vorname);
    const lastName = asString(customer.lastName) || asString(customer.nachname);
    return `${firstName} ${lastName}`.trim();
  },

  KUNDENVORNAME: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    return asString(customer?.firstName) || asString(customer?.vorname);
  },

  KUNDENNACHNAME: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    return asString(customer?.lastName) || asString(customer?.nachname);
  },

  KUNDENFIRMA: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    return asString(customer?.companyName) || asString(customer?.company);
  },

  // Kunden-Adresse
  KUNDENADRESSE: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    if (!customer) return '';

    const parts: string[] = [];
    const street = asString(customer.street);
    if (street) parts.push(street);

    const cityLine = `${asString(customer.postalCode)} ${asString(customer.city)}`.trim();
    if (cityLine) parts.push(cityLine);

    const country = asString(customer.country);
    if (country) parts.push(country);

    return parts.join(', ');
  },

  KUNDENSTRASSE: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    const address = asRecord(customer?.address);
    return asString(customer?.street) || asString(address?.street);
  },

  KUNDENPLZ: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    const address = asRecord(customer?.address);
    return asString(customer?.postalCode) || asString(address?.postalCode);
  },

  KUNDENORT: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    const address = asRecord(customer?.address);
    return asString(customer?.city) || asString(address?.city);
  },

  KUNDENLAND: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    const address = asRecord(customer?.address);
    return asString(customer?.country) || asString(address?.country);
  },

  // Kunden-Kontakt
  KUNDENTELEFON: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    return asString(customer?.phone) || asString(customer?.telefon);
  },

  KUNDENEMAIL: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    return asString(customer?.email) || asString(customer?.emailAddress);
  },

  KUNDENFAX: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    return asString(customer?.fax);
  },

  KUNDENMOBIL: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    return asString(customer?.mobile) || asString(customer?.handy);
  },

  // Kunden-Identifikation
  KUNDENNUMMER: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    return asString(customer?.customerNumber) || asString(customer?.id);
  },

  KUNDEN_ID: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    return asString(customer?.id) || asString(customer?.customerId);
  },

  // Steuerliche Informationen
  KUNDEN_UMSATZSTEUER_ID: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    return asString(customer?.vatId) || asString(customer?.umsatzsteuerId);
  },

  KUNDEN_STEUERNUMMER: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    return asString(customer?.taxNumber) || asString(customer?.steuernummer);
  },

  // Ansprechpartner (für B2B-Kunden)
  ANSPRECHPARTNER: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    const contacts = Array.isArray(customer?.contactPersons)
      ? (customer.contactPersons as Array<Record<string, unknown>>)
      : undefined;
    if (!contacts?.length) return '';

    const contact = contacts[0];
    return `${asString(contact.firstName)} ${asString(contact.lastName)}`.trim();
  },

  ANSPRECHPARTNER_VORNAME: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    const contacts = Array.isArray(customer?.contactPersons)
      ? (customer.contactPersons as Array<Record<string, unknown>>)
      : undefined;
    if (!contacts?.length) return '';
    return asString(contacts[0].firstName);
  },

  ANSPRECHPARTNER_NACHNAME: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    const contacts = Array.isArray(customer?.contactPersons)
      ? (customer.contactPersons as Array<Record<string, unknown>>)
      : undefined;
    if (!contacts?.length) return '';
    return asString(contacts[0].lastName);
  },

  ANSPRECHPARTNER_EMAIL: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    const contacts = Array.isArray(customer?.contactPersons)
      ? (customer.contactPersons as Array<Record<string, unknown>>)
      : undefined;
    if (!contacts?.length) return '';
    return asString(contacts[0].email);
  },

  ANSPRECHPARTNER_TELEFON: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    const contacts = Array.isArray(customer?.contactPersons)
      ? (customer.contactPersons as Array<Record<string, unknown>>)
      : undefined;
    if (!contacts?.length) return '';
    return asString(contacts[0].phone);
  },

  // Zusätzliche Kunden-Informationen
  KUNDENTYP: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    if (!customer) return '';
    return customer.companyName ? 'Geschäftskunde' : 'Privatkunde';
  },

  KUNDE_SEIT: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    if (!customer?.createdAt) return '';

    const date = toDateValue(customer.createdAt as string | Date);
    return date.toLocaleDateString('de-DE');
  },

  // Mehrzeilige Formate
  KUNDENADRESSE_MEHRZEILIG: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    if (!customer) return '';

    const lines: string[] = [];

    // Name/Firma
    const companyName = asString(customer.companyName);
    if (companyName) {
      lines.push(companyName);
    } else {
      const fullName = `${asString(customer.firstName)} ${asString(customer.lastName)}`.trim();
      if (fullName) lines.push(fullName);
    }

    // Ansprechpartner bei Firmen
    const contacts = Array.isArray(customer.contactPersons)
      ? (customer.contactPersons as Array<Record<string, unknown>>)
      : undefined;
    if (companyName && contacts?.length) {
      const contact = contacts[0];
      const contactName = `${asString(contact.firstName)} ${asString(contact.lastName)}`.trim();
      if (contactName) lines.push(`z.Hd. ${contactName}`);
    }

    // Adresse
    const street = asString(customer.street);
    if (street) lines.push(street);

    const cityLine = `${asString(customer.postalCode)} ${asString(customer.city)}`.trim();
    if (cityLine) lines.push(cityLine);

    const country = asString(customer.country);
    if (country) lines.push(country);

    return lines.join('\n');
  },

  KUNDENKONTAKT_KOMPLETT: (context: PlaceholderContext) => {
    const customer = context.selectedCustomer || context.customer;
    if (!customer) return '';

    const parts: string[] = [];
    const phone = asString(customer.phone);
    const mobile = asString(customer.mobile);
    const email = asString(customer.email);
    const fax = asString(customer.fax);
    if (phone) parts.push(`Tel: ${phone}`);
    if (mobile) parts.push(`Mobil: ${mobile}`);
    if (email) parts.push(`E-Mail: ${email}`);
    if (fax) parts.push(`Fax: ${fax}`);

    return parts.join(', ');
  },
};

export default customerPlaceholders;
