// Typen für die Rechnungserstellung (aus create-invoice-page.tsx extrahiert)

import type { TaxRuleType } from '@/types/taxRules';

// Helper-Typ für sicheren Zugriff auf verschachtelte Company-Daten
export type CompanyStepData = Record<string, unknown>;

// Typ für Company-Dokument aus MongoDB (hat viele optionale Felder + step-basierte Onboarding-Daten)
export type CompanyDocument = Record<string, unknown> & {
  companyName?: string;
  defaultCurrency?: string;
  email?: string;
  contactEmail?: string;
  phoneNumber?: string;
  companyPhoneNumber?: string;
  companyStreet?: string;
  companyHouseNumber?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyCountry?: string;
  companyLogo?: string;
  profilePictureURL?: string;
  website?: string;
  companyWebsite?: string;
  companyWebsiteForBackend?: string;
  profilePictureFirebaseUrl?: string;
  selectedCategory?: string;
  industry?: string;
  description?: string;
  registrationNumber?: string;
  legalForm?: string;
  ust?: string;
  kleinunternehmer?: string;
  firstName?: string;
  lastName?: string;
  contactPerson?: { name?: string };
  iban?: string;
  bic?: string;
  bankName?: string;
  accountHolder?: string;
  vatId?: string;
  vatIdForBackend?: string;
  taxNumber?: string;
  taxNumberForBackend?: string;
  companyRegisterPublic?: string;
  companyRegister?: string;
  step1?: { website?: string; managingDirectors?: string;[key: string]: unknown };
  step2?: {
    website?: string;
    kleinunternehmer?: string;
    legalForm?: string;
    industry?: string;
    [key: string]: unknown;
  };
  step3?: {
    vatId?: string;
    taxNumber?: string;
    companyRegister?: string;
    districtCourt?: string;
    [key: string]: unknown;
  };
  step4?: {
    iban?: string;
    bic?: string;
    bankName?: string;
    accountHolder?: string;
    [key: string]: unknown;
  };
};

// Typsichere Helper-Funktion für Zugriff auf verschachtelte step-Properties
export function getStepValue(
  obj: object | null | undefined,
  step: string,
  key: string,
): string | undefined {
  const objRecord = obj as Record<string, unknown> | null | undefined;
  const stepData = objRecord?.[step] as CompanyStepData | undefined;
  const value = stepData?.[key];
  return typeof value === 'string' ? value : undefined;
}

export type PreviewTemplateData = {
  companyId?: string;
  invoiceNumber: string;
  documentNumber: string;
  date: string;
  validUntil?: string;
  dueDate?: string;
  title?: string;
  reference?: string;
  currency?: string;
  taxRule?: TaxRuleType;
  taxRuleLabel?: string;
  invoiceDate?: string;
  deliveryDate?: string;
  serviceDate?: string;
  servicePeriod?: string;
  customerName: string;
  customerAddress?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerNumber?: string;
  displayCustomerNumber?: string;
  customer: {
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
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyWebsite?: string;
  companyLogo?: string;
  profilePictureURL?: string;
  companyVatId?: string;
  companyTaxNumber?: string;
  items: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    taxRate?: number;
    category?: string;
    discountPercent?: number;
    unit?: string;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  vatRate?: number;
  taxGrouped?: Array<{
    rate: number;
    netAmount: number;
    taxAmount: number;
  }>;
  isSmallBusiness?: boolean;
  bankDetails?: {
    iban?: string;
    bic?: string;
    bankName?: string;
    accountHolder?: string;
  };
  notes?: string;
  headTextHtml?: string;
  headerText?: string; // Template erwartet headerText
  introText?: string; // Template erwartet auch introText
  description?: string; // Template erwartet auch description
  footerText?: string;
  contactPersonName?: string;
  internalContactPerson?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  // Zusätzliche Footer-Daten
  step1?: Record<string, unknown>;
  step2?: Record<string, unknown>;
  step3?: Record<string, unknown>;
  step4?: Record<string, unknown>;
  managingDirectors?: string;
  districtCourt?: string;
  companyRegister?: string;
  legalForm?: string;
  firstName?: string;
  lastName?: string;
  // Skonto-Felder
  skontoEnabled?: boolean;
  skontoDays?: number;
  skontoPercentage?: number;
  skontoText?: string;
  // Template-Informationen
  selectedTemplate?: string;
  // Company-Objekt für Template-Kompatibilität
  company?: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      zipCode: string;
      city: string;
      country: string;
    };
    taxNumber: string;
    vatId: string;
    website: string;
    bankDetails: {
      iban: string;
      bic: string;
      accountHolder: string;
    };
  };
};
