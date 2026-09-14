// Pure Aufbereitung der Vorschau-Daten für Rechnungs-Templates (aus create-invoice-page.tsx extrahiert)

import type { Customer as CustomerType } from '@/components/finance/AddCustomerModal';
import type { InvoiceTemplate } from '@/components/finance/InvoiceTemplates';
import type { AuthUser } from '@/contexts/NewAuthContext';
import type { CompanySettings } from '@/hooks/useCompanySettings';
import type { QuoteItem } from '@/services/quoteService';
import type { CreateInvoiceFormData } from '@/types/formData';
import type { InvoiceData } from '@/types/invoiceTypes';
import { TaxRuleType } from '@/types/taxRules';
import { formatDateDE } from './calc';
import {
  type CompanyDocument,
  type CompanyStepData,
  getStepValue,
  type PreviewTemplateData,
} from './types';

// Alle Werte, die buildPreviewData aus dem Component-Scope liest
export type PreviewDataArgs = {
  uid: string;
  company: CompanyDocument | null;
  settings: CompanySettings | null;
  user: AuthUser | null;
  formData: CreateInvoiceFormData;
  customers: CustomerType[];
  items: QuoteItem[];
  taxRate: number;
  showNet: boolean;
  paymentDays: number;
  subtotal: number;
  vat: number;
  grandTotal: number;
  skontoEnabled: boolean;
  skontoDays: number | undefined;
  skontoPercentage: number | undefined;
  skontoText: string;
  deliveryDateType: 'single' | 'range';
  deliveryDateRange: { from?: Date; to?: Date };
  selectedTemplate: InvoiceTemplate;
};

// Vorschau-Daten für das Template zusammenbauen
export function buildPreviewData(args: PreviewDataArgs): PreviewTemplateData {
  const {
    uid,
    company,
    settings,
    user,
    formData,
    customers,
    items,
    taxRate,
    showNet,
    paymentDays,
    subtotal,
    vat,
    grandTotal,
    skontoEnabled,
    skontoDays,
    skontoPercentage,
    skontoText,
    deliveryDateType,
    deliveryDateRange,
    selectedTemplate,
  } = args;
  const today = new Date();

  // Firmenname und -adresse aus companies-Collection, mit Fallbacks
  const companyName =
    (company?.companyName as string) ||
    (settings?.companyName as string) ||
    user?.company_name ||
    user?.displayName ||
    'Ihr Unternehmen';
  // Kontaktperson: interne Eingabe > Customer-Kontakt > Company-Kontakt > Vor-/Nachname
  const contactPersonNameForFooter = (() => {
    // Zuerst interne Eingabe prüfen
    if (formData.internalContactPerson?.trim()) {
      return formData.internalContactPerson.trim();
    }

    // Dann Customer-Kontaktperson prüfen
    const selectedCustomer = customers.find(c => c.name === formData.customerName);

    if (selectedCustomer?.contactPersons && selectedCustomer.contactPersons.length > 0) {
      const firstContact = selectedCustomer.contactPersons[0];
      // Handle both string and ContactPerson types
      if (typeof firstContact === 'string') {
        return firstContact;
      } else if (firstContact) {
        // ContactPerson object: combine firstName and lastName
        const fullName = [firstContact.firstName, firstContact.lastName]
          .filter(Boolean)
          .join(' ');
        return fullName || '';
      }
    }

    // Fallback auf Company-Kontakt
    return (
      company?.contactPerson?.name ||
      [company?.firstName, company?.lastName].filter(Boolean).join(' ') ||
      undefined
    );
  })();
  const companyAddress = [
    [company?.companyStreet?.replace(/\s+/g, ' ').trim(), company?.companyHouseNumber]
      .filter(Boolean)
      .join(' '),
    [company?.companyPostalCode, company?.companyCity].filter(Boolean).join(' '),
    company?.companyCountry,
  ]
    .filter(Boolean)
    .join('\n');

  // Kopf-Text (HTML) rudimentär in Text wandeln + weitere Metadaten als Bemerkungen bündeln
  const _htmlToText = (html: string) =>
    (html || '')
      .replace(/<br\s*\/?>(\s*)/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&');
  const noteLines: string[] = [];
  // Kopf-Text und Referenz werden separat im Template angezeigt
  if (formData.deliveryTerms) noteLines.push(`Lieferbedingungen: ${formData.deliveryTerms}`);
  const basePaymentTerms =
    formData.paymentTerms?.trim() || `Zahlbar binnen ${paymentDays} Tagen ohne Abzug`;
  if (basePaymentTerms) noteLines.push(`Zahlungsbedingungen: ${basePaymentTerms}`);
  // Zahlungsbedingungen final zusammenbauen (Skonto separat anhängen, falls aktiv)
  // Skonto-Satz: Wenn Skonto aktiv ist, zuerst benutzerdefinierten Text nutzen; sonst Tage/%-Fallback
  let skontoSentence = '';
  if (skontoEnabled) {
    if (skontoText?.trim()) {
      skontoSentence = skontoText.trim();
    } else if (skontoDays && skontoPercentage) {
      skontoSentence = `Bei Zahlung binnen ${skontoDays} Tagen ${skontoPercentage}% Skonto`;
    }
  }
  const finalPaymentTerms = [basePaymentTerms, skontoSentence].filter(Boolean).join('\n\n');
  const previewNotes =
    [
      formData.deliveryTerms ? `Lieferbedingungen: ${formData.deliveryTerms}` : '',
      finalPaymentTerms ? `Zahlungsbedingungen: ${finalPaymentTerms}` : '',
    ]
      .filter(Boolean)
      .join('\n\n') || undefined;

  const taxRuleLabelMap: Record<TaxRuleType, string> = {
    [TaxRuleType.DE_TAXABLE]:
      'Steuerpflichtiger Umsatz (Regelsteuersatz 19 %, § 1 Abs. 1 Nr. 1 i.V.m. § 12 Abs. 1 UStG)',
    [TaxRuleType.DE_TAXABLE_REDUCED]:
      'Steuerpflichtiger Umsatz (ermäßigter Steuersatz 7 %, § 12 Abs. 2 UStG)',
    [TaxRuleType.DE_EXEMPT_4_USTG]: 'Steuerfreie Lieferung/Leistung gemäß § 4 UStG',
    [TaxRuleType.DE_REVERSE_13B]:
      'Reverse-Charge – Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG)',
    [TaxRuleType.EU_REVERSE_18B]:
      'Reverse-Charge – Steuerschuldnerschaft des Leistungsempfängers (Art. 196 MwStSystRL, § 18b UStG)',
    [TaxRuleType.EU_INTRACOMMUNITY_SUPPLY]:
      'Innergemeinschaftliche Lieferung, steuerfrei gemäß § 4 Nr. 1b i.V.m. § 6a UStG',
    [TaxRuleType.EU_OSS]: 'Fernverkauf über das OSS-Verfahren (§ 18j UStG)',
    [TaxRuleType.NON_EU_EXPORT]: 'Steuerfreie Ausfuhrlieferung (§ 4 Nr. 1a i.V.m. § 6 UStG)',
    [TaxRuleType.NON_EU_OUT_OF_SCOPE]:
      'Nicht im Inland steuerbare Leistung (Leistungsort außerhalb Deutschlands, § 3a Abs. 2 UStG)',
  };

  const data: PreviewTemplateData = {
    companyId: uid,
    invoiceNumber: 'Vorschau',
    documentNumber: formData.title || 'VORSCHAU',
    date: formData.invoiceDate
      ? formatDateDE(new Date(formData.invoiceDate))
      : formatDateDE(today),
    dueDate: formData.validUntil ? formatDateDE(new Date(formData.validUntil)) : undefined,
    validUntil: formatDateDE(formData.validUntil),
    deliveryDate: formData.deliveryDate
      ? formatDateDE(new Date(formData.deliveryDate))
      : undefined,
    title: formData.title || undefined,
    reference: formData.customerOrderNumber || undefined,
    // Wurzel 4: echte Währung aus Formular/Firma/Einstellungen, KEIN 'EUR'-
    // Endfallback. Fehlt sie überall, leer lassen — die PDF-Templates rendern
    // Beträge über formatCurrency symbollos statt einen Euro zu erfinden.
    currency:
      formData.currency ||
      (company?.defaultCurrency as string) ||
      settings?.defaultCurrency ||
      '',
    taxRule: formData.taxRule,
    taxRuleLabel: taxRuleLabelMap[formData.taxRule] || undefined,
    customerName: formData.customerName || '',
    customerAddress: formData.customerAddress || '',
    customerEmail: formData.customerEmail || undefined,
    companyName,
    companyAddress,
    companyEmail: (company?.email as string) || undefined,
    companyPhone:
      (company?.phoneNumber as string) || (company?.companyPhoneNumber as string) || undefined,
    companyWebsite:
      (company?.website as string) ||
      (company?.companyWebsite as string) ||
      (company?.companyWebsiteForBackend as string) ||
      getStepValue(company, 'step1', 'website') ||
      getStepValue(company, 'step2', 'website') ||
      undefined,
    companyLogo: (company?.companyLogo as string) || undefined,
    profilePictureURL: (company?.profilePictureURL as string) || undefined,
    companyVatId:
      (company?.vatId as string) ||
      (company?.vatIdForBackend as string) ||
      getStepValue(company, 'step3', 'vatId') ||
      (settings?.vatId as string) ||
      undefined,
    companyTaxNumber:
      (company?.taxNumber as string) ||
      (company?.taxNumberForBackend as string) ||
      getStepValue(company, 'step3', 'taxNumber') ||
      (settings?.taxNumber as string) ||
      undefined,
    companyRegister:
      (company?.companyRegisterPublic as string) ||
      (company?.companyRegister as string) ||
      getStepValue(company, 'step3', 'companyRegister') ||
      (settings?.districtCourt as string) ||
      (settings?.companyRegister as string) ||
      undefined,
    items: items.map(it => {
      const qty = Number.isFinite(it.quantity) ? it.quantity : 0;
      const unit = Number.isFinite(it.unitPrice) ? it.unitPrice : 0;
      const baseTotal = Number.isFinite(it.total) ? it.total : qty * unit;
      const sign = it.category === 'discount' ? -1 : 1;
      const factor =
        it.category === 'discount'
          ? 1
          : 1 - Math.max(0, Math.min(100, it.discountPercent || 0)) / 100;
      const lineTotalNet = baseTotal * sign * factor;
      return {
        id: it.id,
        description: it.description || '',
        quantity: qty,
        unitPrice: unit,
        total: lineTotalNet,
        taxRate: undefined,
        category: it.category,
        discountPercent: it.discountPercent || 0,
        unit: it.unit,
        // Aufenthalt der Zeile (0702) für „Objekt · Anreise – Abreise" in der Vorschau.
        propertyTitle: it.propertyTitle,
        checkIn: it.checkIn,
        checkOut: it.checkOut,
        parentItemId: it.parentItemId,
      };
    }),
    subtotal,
    tax: (() => {
      // Für Reverse Charge und bestimmte steuerfreie Regeln ist die Steuer immer 0
      const isReverseCharge =
        formData.taxRule?.includes('REVERSE') ||
        formData.taxRule === TaxRuleType.DE_REVERSE_13B ||
        formData.taxRule === TaxRuleType.EU_REVERSE_18B;
      const isTaxExempt =
        formData.taxRule === TaxRuleType.DE_EXEMPT_4_USTG ||
        formData.taxRule === TaxRuleType.EU_INTRACOMMUNITY_SUPPLY ||
        formData.taxRule === TaxRuleType.NON_EU_EXPORT ||
        formData.taxRule === TaxRuleType.NON_EU_OUT_OF_SCOPE;
      if (isReverseCharge || isTaxExempt) return 0;
      // Bei Netto-Anzeige keine Steuer anzeigen
      return showNet ? 0 : vat;
    })(),
    total: (() => {
      const isReverseCharge =
        formData.taxRule?.includes('REVERSE') ||
        formData.taxRule === TaxRuleType.DE_REVERSE_13B ||
        formData.taxRule === TaxRuleType.EU_REVERSE_18B;
      const isTaxExempt =
        formData.taxRule === TaxRuleType.DE_EXEMPT_4_USTG ||
        formData.taxRule === TaxRuleType.EU_INTRACOMMUNITY_SUPPLY ||
        formData.taxRule === TaxRuleType.NON_EU_EXPORT ||
        formData.taxRule === TaxRuleType.NON_EU_OUT_OF_SCOPE;
      if (isReverseCharge || isTaxExempt) return subtotal;
      // Bei Netto-Anzeige nur Netto-Summe zeigen
      return showNet ? subtotal : grandTotal;
    })(),
    vatRate: (() => {
      // Für Reverse Charge und steuerfreie Regeln ist die Steuer-Rate 0
      const isReverseCharge =
        formData.taxRule?.includes('REVERSE') ||
        formData.taxRule === TaxRuleType.DE_REVERSE_13B ||
        formData.taxRule === TaxRuleType.EU_REVERSE_18B;
      const isTaxExempt =
        formData.taxRule === TaxRuleType.DE_EXEMPT_4_USTG ||
        formData.taxRule === TaxRuleType.EU_INTRACOMMUNITY_SUPPLY ||
        formData.taxRule === TaxRuleType.NON_EU_EXPORT ||
        formData.taxRule === TaxRuleType.NON_EU_OUT_OF_SCOPE;
      if (isReverseCharge || isTaxExempt) return 0;
      // Bei Netto-Anzeige keine Steuer-Rate anzeigen
      return showNet ? 0 : taxRate;
    })(),
    isSmallBusiness: false, // Wird durch taxRule bestimmt, nicht durch settings
    bankDetails: company
      ? {
        iban:
          getStepValue(company, 'step4', 'iban') ||
          (company?.iban as string) ||
          getStepValue(settings, 'step4', 'iban') ||
          undefined,
        bic:
          getStepValue(company, 'step4', 'bic') ||
          (company?.bic as string) ||
          getStepValue(settings, 'step4', 'bic') ||
          undefined,
        bankName:
          getStepValue(company, 'step4', 'bankName') ||
          (company?.bankName as string) ||
          getStepValue(settings, 'step4', 'bankName') ||
          undefined,
        accountHolder:
          getStepValue(company, 'step4', 'accountHolder') ||
          (company?.accountHolder as string) ||
          getStepValue(settings, 'step4', 'accountHolder') ||
          (settings?.accountHolder as string) ||
          (companyName as string) ||
          undefined,
      }
      : undefined,
    notes: previewNotes,
    headTextHtml: formData.headTextHtml || undefined,
    headerText: formData.headTextHtml || undefined, // Template erwartet headerText
    introText: formData.headTextHtml || undefined, // Template erwartet auch introText
    description: formData.headTextHtml || undefined, // Template erwartet auch description
    footerText: formData.footerText || undefined,
    contactPersonName: contactPersonNameForFooter,
    paymentTerms: finalPaymentTerms || undefined,
    deliveryTerms: formData.deliveryTerms || undefined,
    // Lieferzeit/Leistungszeitraum für Template
    serviceDate: formData.deliveryDate
      ? formatDateDE(new Date(formData.deliveryDate))
      : undefined,
    servicePeriod:
      deliveryDateType === 'range' && deliveryDateRange.from && deliveryDateRange.to
        ? `${formatDateDE(deliveryDateRange.from)} - ${formatDateDE(deliveryDateRange.to)}`
        : formData.servicePeriod || undefined,
    // Customer-Objekt für Template-Kompatibilität
    customer: {
      name: formData.customerName || '',
      email: formData.customerEmail || '',
      address: (() => {
        const addressLines = (formData.customerAddress || '').split('\n');
        const streetLine = addressLines[0] || '';
        const cityLine = addressLines[1] || '';
        const zipCodeMatch = cityLine.match(/^(\d{5})\s*(.*)$/);

        return {
          street: streetLine,
          zipCode: zipCodeMatch ? zipCodeMatch[1] : '',
          city: zipCodeMatch ? zipCodeMatch[2] : cityLine,
          country: addressLines[2] || 'Deutschland',
        };
      })(),
      taxNumber: (() => {
        const selectedCustomer = customers.find(c => c.name === formData.customerName);
        return selectedCustomer?.taxNumber || undefined;
      })(),
      vatId: (() => {
        const selectedCustomer = customers.find(c => c.name === formData.customerName);
        return selectedCustomer?.vatId || undefined;
      })(),
    },
    // Company-Objekt für Template-Kompatibilität
    company: {
      name: companyName,
      email: (company?.email as string) || '',
      phone: (company?.phoneNumber as string) || (company?.companyPhoneNumber as string) || '',
      address: (() => {
        const lines = companyAddress.split('\n');
        return {
          street: lines[0] || '',
          zipCode: (lines[1] || '').split(' ')[0] || '',
          city: (lines[1] || '').split(' ').slice(1).join(' ') || '',
          country: lines[2] || '',
        };
      })(),
      taxNumber:
        (company?.taxNumber as string) ||
        (company?.taxNumberForBackend as string) ||
        getStepValue(company, 'step3', 'taxNumber') ||
        (settings?.taxNumber as string) ||
        '',
      vatId:
        (company?.vatId as string) ||
        (company?.vatIdForBackend as string) ||
        getStepValue(company, 'step3', 'vatId') ||
        (settings?.vatId as string) ||
        '',
      website:
        (company?.website as string) ||
        (company?.companyWebsite as string) ||
        (company?.companyWebsiteForBackend as string) ||
        getStepValue(company, 'step1', 'website') ||
        getStepValue(company, 'step2', 'website') ||
        '',
      bankDetails: {
        iban:
          getStepValue(company, 'step4', 'iban') ||
          (company?.iban as string) ||
          getStepValue(settings, 'step4', 'iban') ||
          '',
        bic:
          getStepValue(company, 'step4', 'bic') ||
          (company?.bic as string) ||
          getStepValue(settings, 'step4', 'bic') ||
          '',
        accountHolder:
          getStepValue(company, 'step4', 'accountHolder') ||
          (company?.accountHolder as string) ||
          getStepValue(settings, 'step4', 'accountHolder') ||
          (settings?.accountHolder as string) ||
          companyName ||
          '',
      },
    },
    // Footer-Daten aus Company-Objekt
    step1: company?.step1 as Record<string, unknown>,
    step2: company?.step2 as Record<string, unknown>,
    step3: company?.step3 as Record<string, unknown>,
    step4: company?.step4 as Record<string, unknown>,
    managingDirectors:
      (company?.managingDirectors as string) ||
      getStepValue(company, 'step1', 'managingDirectors'),
    districtCourt:
      (company?.districtCourt as string) || getStepValue(company, 'step3', 'districtCourt'),
    legalForm: getStepValue(company, 'step2', 'legalForm') || (company?.legalForm as string),
    firstName:
      (company?.firstName as string) ||
      (() => {
        const step1 = company?.step1 as CompanyStepData | undefined;
        const personalData = step1?.personalData as CompanyStepData | undefined;
        return typeof personalData?.firstName === 'string' ? personalData.firstName : undefined;
      })(),
    lastName:
      (company?.lastName as string) ||
      (() => {
        const step1 = company?.step1 as CompanyStepData | undefined;
        const personalData = step1?.personalData as CompanyStepData | undefined;
        return typeof personalData?.lastName === 'string' ? personalData.lastName : undefined;
      })(),
    // Skonto-Felder für Template
    skontoEnabled: skontoEnabled || false,
    skontoDays: skontoEnabled ? skontoDays || 0 : 0,
    skontoPercentage: skontoEnabled ? skontoPercentage || 0 : 0,
    skontoText: skontoEnabled ? skontoText || '' : '',
    // Template-Informationen
    selectedTemplate:
      typeof selectedTemplate === 'string' ? selectedTemplate : 'TEMPLATE_NEUTRAL',
    // Customer-Spezifische Daten
    customerNumber: (() => {
      const selectedCustomer = customers.find(c => c.name === formData.customerName);
      return selectedCustomer?.customerNumber || undefined;
    })(),
    displayCustomerNumber: (() => {
      const selectedCustomer = customers.find(c => c.name === formData.customerName);
      return selectedCustomer?.customerNumber || '';
    })(),
  };

  return data;
}

// Formulardaten für LivePreviewModal konvertieren (GLEICHE Daten wie SendDocumentModal)
export function buildInvoiceDataForPreview(args: PreviewDataArgs): InvoiceData {
  // ✅ NUTZT EXAKT DIE GLEICHEN DATEN WIE SendDocumentModal!
  const previewData = buildPreviewData(args);
  return {
    ...previewData,
    companyId: args.uid, // Explizit die companyId hinzufügen
  } as unknown as InvoiceData;
}
