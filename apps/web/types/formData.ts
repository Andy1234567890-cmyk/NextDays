import type { TaxRuleType } from './taxRules';

export interface CreateInvoiceFormData {
  // Rechnungsdetails
  title: string;
  invoiceDate: string;
  validUntil: string;
  deliveryDate?: string;
  servicePeriod?: string; // Für Lieferzeitraum/Leistungszeitraum Text
  customerOrderNumber?: string;

  // Kundendaten
  customerName: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerNumber?: string;
  customerEmail: string;
  customerAddress?: string;

  // Währung und Steuer
  currency: string;
  taxRule: TaxRuleType;

  // Texte
  headTextHtml: string;
  footerText: string;
  notes: string;
  internalContactPerson: string;

  // Lieferung und Zahlung
  deliveryTerms: string;
  paymentTerms: string;

  // Skonto-Einstellungen
  skontoEnabled?: boolean;
  skontoDays?: number;
  skontoPercentage?: number;
  skontoText?: string;
}
