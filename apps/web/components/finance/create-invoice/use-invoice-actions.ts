'use client';

// Handler und Datums-Sync der Rechnungserstellung (aus create-invoice-page.tsx extrahiert).
// Zyklen-Auflösung: useInvoiceActions wird in der Hauptdatei VOR useItemPopovers
// aufgerufen und liefert handleItemChange, das dorthin durchgereicht wird.
// isManualDateChangeRef koppelt handleValidUntilChange mit dem Tage→Datum-Effekt —
// Ref, Effekte und Handler müssen deshalb zusammen in diesem Hook bleiben.

import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { Customer as CustomerType } from '@/components/finance/AddCustomerModal';
import type { InvoiceTemplate as ImportedInvoiceTemplate } from '@/components/finance/InvoiceTemplates';
import {
  computeItemTotalNet,
  computeTotals,
} from '@/components/finance/create-invoice/calc';
import {
  type CompanyDocument,
  getStepValue,
} from '@/components/finance/create-invoice/types';
import type { CompanySettingsFormData } from '@/components/finance/create-invoice/use-invoice-loaders';
import type { AuthUser } from '@/contexts/NewAuthContext';
import type { CompanySettings } from '@/hooks/useCompanySettings';
import { api } from '@/lib/api-client';
import type { QuoteItem } from '@/services/quoteService';
import type { CreateInvoiceFormData } from '@/types/formData';
import type { InvoiceData, InvoiceData as InvoiceType } from '@/types/invoiceTypes';
import { TaxRuleType } from '@/types/taxRules';

type UseInvoiceActionsArgs = {
  uid: string;
  user: AuthUser | null;
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  formData: CreateInvoiceFormData;
  setFormData: Dispatch<SetStateAction<CreateInvoiceFormData>>;
  items: QuoteItem[];
  setItems: Dispatch<SetStateAction<QuoteItem[]>>;
  customers: CustomerType[];
  company: CompanyDocument | null;
  setCompany: Dispatch<SetStateAction<CompanyDocument | null>>;
  settings: CompanySettings | null;
  showNet: boolean;
  taxRate: number;
  nextNumber: number;
  paymentDays: number;
  setPaymentDays: Dispatch<SetStateAction<number>>;
  skontoEnabled: boolean;
  skontoDays: number | undefined;
  skontoPercentage: number | undefined;
  skontoText: string;
  deliveryDateType: 'single' | 'range';
  deliveryDateRange: { from?: Date; to?: Date };
  selectedTemplate: ImportedInvoiceTemplate;
  eInvoiceEnabled: boolean;
  setEInvoiceEnabled: Dispatch<SetStateAction<boolean>>;
  eInvoiceSettings: Record<string, unknown> | null;
  setEInvoiceSettings: Dispatch<SetStateAction<Record<string, unknown> | null>>;
  contactType: 'organisation' | 'person';
  invalidFields: Set<string>;
  setInvalidFields: Dispatch<SetStateAction<Set<string>>>;
  setComplianceErrors: Dispatch<SetStateAction<string[]>>;
  setShowCompliancePanel: Dispatch<SetStateAction<boolean>>;
  companySettingsFormData: CompanySettingsFormData;
  setShowCompanySettingsModal: Dispatch<SetStateAction<boolean>>;
  setShowCompanySettingsBanner: Dispatch<SetStateAction<boolean>>;
  setShowCustomerSearchPopup: Dispatch<SetStateAction<boolean>>;
  serviceDraft: { name: string; description: string; price: string; unit: string };
  setServiceDraft: Dispatch<
    SetStateAction<{ name: string; description: string; price: string; unit: string }>
  >;
  setSavingService: Dispatch<SetStateAction<boolean>>;
  setServiceModalOpen: Dispatch<SetStateAction<boolean>>;
  setCreatedDocument: Dispatch<SetStateAction<InvoiceType | null>>;
  setShowSendDocumentModal: Dispatch<SetStateAction<boolean>>;
  subtotal: number;
  vat: number;
  grandTotal: number;
  taxGrouped: Array<{ rate: number; netAmount: number; taxAmount: number }>;
  // Buchungs-Brücke (0092): „Rechnung aus Buchung" — Backend verknüpft die
  // Rechnung mit der Reservierung und verhindert Doppelrechnungen (409).
  reservationId?: string | null;
  reservationCustomerId?: string | null;
  // Dokumentsprache (0099, Gastsprache aus der Buchungs-Vorschau; sonst de).
  documentLanguage?: string;
};

export function useInvoiceActions({
  uid,
  user,
  loading,
  setLoading,
  formData,
  setFormData,
  items,
  setItems,
  customers,
  company,
  setCompany,
  settings,
  showNet,
  taxRate,
  nextNumber,
  paymentDays,
  setPaymentDays,
  skontoEnabled,
  skontoDays,
  skontoPercentage,
  skontoText,
  deliveryDateType,
  deliveryDateRange,
  selectedTemplate,
  eInvoiceEnabled,
  setEInvoiceEnabled,
  eInvoiceSettings,
  setEInvoiceSettings,
  contactType,
  invalidFields,
  setInvalidFields,
  setComplianceErrors,
  setShowCompliancePanel,
  companySettingsFormData,
  setShowCompanySettingsModal,
  setShowCompanySettingsBanner,
  setShowCustomerSearchPopup,
  serviceDraft,
  setServiceDraft,
  setSavingService,
  setServiceModalOpen,
  setCreatedDocument,
  setShowSendDocumentModal,
  subtotal,
  vat,
  grandTotal,
  taxGrouped,
  reservationId,
  reservationCustomerId,
  documentLanguage,
}: UseInvoiceActionsArgs) {
  // Ref um manuelle Datumsänderungen zu tracken (verhindert Sync-Loops)
  const isManualDateChangeRef = useRef(false);

  // Zahlungsbedingungen Synchronisation: Tage → Datum + paymentTerms aktualisieren
  useEffect(() => {
    // Überspringe wenn manuelle Datumsänderung erkannt wurde
    if (isManualDateChangeRef.current) {
      isManualDateChangeRef.current = false;
      return;
    }

    const currentInvoiceDate = formData.invoiceDate;
    if (!currentInvoiceDate || paymentDays <= 0) return;

    const invoiceDate = new Date(currentInvoiceDate);
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(invoiceDate.getDate() + paymentDays);
    const dueDateString = dueDate.toISOString().split('T')[0];

    // Aktualisiere validUntil UND paymentTerms synchron
    setFormData(prev => ({
      ...prev,
      validUntil: dueDateString,
      paymentTerms: `Zahlbar binnen ${paymentDays} Tagen ohne Abzug`,
    }));
  }, [paymentDays, formData.invoiceDate]);

  // Initiale Berechnung: Setze paymentDays aus validUntil beim Laden
  useEffect(() => {
    const currentInvoiceDate = formData.invoiceDate;
    if (!currentInvoiceDate) return;

    if (!formData.validUntil) {
      // Wenn kein Fälligkeitsdatum gesetzt ist, verwende Standard 14 Tage
      const invoiceDate = new Date(currentInvoiceDate);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(invoiceDate.getDate() + 14);
      const dueDateString = dueDate.toISOString().split('T')[0];

      setFormData(prev => ({
        ...prev,
        validUntil: dueDateString,
        paymentTerms: 'Zahlbar binnen 14 Tagen ohne Abzug',
      }));
    }
  }, [formData.invoiceDate, formData.validUntil]);

  // Handler für manuelle Änderung des Fälligkeitsdatums → berechne paymentDays zurück
  const handleValidUntilChange = useCallback(
    (newValidUntil: string) => {
      const currentInvoiceDate = formData.invoiceDate;
      if (!currentInvoiceDate || !newValidUntil) return;

      const invoiceDate = new Date(currentInvoiceDate);
      const dueDate = new Date(newValidUntil);
      const diffTime = dueDate.getTime() - invoiceDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Markiere als manuelle Änderung um Sync-Loop zu verhindern
      isManualDateChangeRef.current = true;

      // Aktualisiere alle drei Werte synchron
      if (diffDays > 0) {
        setPaymentDays(diffDays);
        setFormData(prev => ({
          ...prev,
          validUntil: newValidUntil,
          paymentTerms: `Zahlbar binnen ${diffDays} Tagen ohne Abzug`,
        }));
      } else {
        // Negatives Datum: nur validUntil setzen, paymentDays auf 0
        setPaymentDays(0);
        setFormData(prev => ({
          ...prev,
          validUntil: newValidUntil,
          paymentTerms: 'Zahlbar sofort ohne Abzug',
        }));
      }
    },
    [formData.invoiceDate],
  );

  // Customer helper functions
  const selectCustomer = (customer: CustomerType) => {
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      customerEmail: customer.email,
      customerNumber: customer.customerNumber || '',
      customerAddress:
        customer.street && customer.city
          ? `${customer.street}\n${customer.postalCode || ''} ${customer.city}\n${customer.country || 'Deutschland'}`
          : prev.customerAddress,
    }));
    setShowCustomerSearchPopup(false);
  };

  // Dienstleistung in Subcollection speichern
  const saveServiceToSubcollection = async () => {
    toast('SERVICE SAVE TRIGGERED (UI)', {
      description: 'Die Save-Funktion wurde im Client aufgerufen.',
    });

    if (!uid || !serviceDraft.name.trim()) {
      return;
    }
    setSavingService(true);
    try {
      const serviceData = {
        name: serviceDraft.name.trim(),
        description: serviceDraft.description?.trim() || '',
        price: parseFloat(serviceDraft.price) || 0,
        unit: serviceDraft.unit || 'Stk',
      };

      await api.post(`/api/v1/inline-invoice-services?company_id=${uid}`, serviceData);

      toast.success('Dienstleistung gespeichert');
      setServiceDraft({ name: '', description: '', price: '', unit: 'Stk' });
      setServiceModalOpen(false);
    } catch (e) {
      console.error('[Dienstleistung speichern] Fehler:', e);
      toast.error('Fehler beim Speichern der Dienstleistung');
    } finally {
      setSavingService(false);
    }
  };

  // Handlers
  const removeItem = (index: number) => {
    setItems(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  // Positions-Handler (wird auch vom Popover-Hook als Debounce-Grundlage genutzt)
  const handleItemChange = (
    index: number,
    field: keyof QuoteItem,
    value: string | number | boolean,
  ) => {
    setItems(prev =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next: QuoteItem = { ...item };
        if (field === 'description') next.description = String(value);
        if (field === 'quantity') next.quantity = parseFloat(String(value)) || 0;
        if (field === 'unitPrice') {
          const input = parseFloat(String(value)) || 0;
          const net = showNet ? input : input / (1 + taxRate / 100);
          next.unitPrice = net;
        }
        next.total = computeItemTotalNet(next.quantity, next.unitPrice);
        return next;
      }),
    );
  };

  const handleOpenSendModal = () => {
    // Validation
    if (!formData.customerName || !formData.validUntil) {
      toast.error('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }
    const hasValidItems = items.some(it => it.description && it.quantity > 0);
    if (!hasValidItems) {
      toast.error('Bitte fügen Sie mindestens eine gültige Position hinzu');
      return;
    }

    // Kundensuche für vollständige Daten
    const selectedCustomer = customers.find(c => c.name === formData.customerName);

    // Zahlungsbedingungen final (inkl. Skonto, falls aktiv)
    const skontoSentence =
      skontoEnabled && skontoDays && skontoPercentage
        ? skontoText?.trim() || `Bei Zahlung binnen ${skontoDays} Tagen ${skontoPercentage}% Skonto`
        : '';
    const finalPaymentTerms =
      [formData.paymentTerms?.trim(), skontoSentence].filter(Boolean).join('\n\n') || undefined;

    // Summen für die Vorschau berechnen
    const { subtotal, vat, grandTotal } = computeTotals(items, taxRate);

    // Create temporary invoice data for modal preview
    const tempInvoiceData: InvoiceType = {
      id: '',
      companyId: uid,
      invoiceNumber: formData.title || `RE-${nextNumber}`,
      number: formData.title || `RE-${nextNumber}`,
      sequentialNumber: nextNumber,
      status: 'draft',

      // Dates
      date: formData.invoiceDate
        ? new Date(formData.invoiceDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      issueDate: formData.invoiceDate
        ? new Date(formData.invoiceDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      dueDate: formData.validUntil
        ? new Date(formData.validUntil).toISOString().split('T')[0]
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],

      // Customer Data
      customerName: formData.customerName || '',
      customerFirstName: formData.customerFirstName || '',
      customerLastName: formData.customerLastName || '',
      customerNumber: formData.customerNumber || '',
      customerEmail: formData.customerEmail || selectedCustomer?.email || '',
      customerAddress: formData.customerAddress || '',
      customerOrderNumber: formData.customerOrderNumber || '',
      customerPhone: selectedCustomer?.phone || '',
      customerVatId: selectedCustomer?.vatId || '', // Customer VAT ID
      // Rechnungsbeschreibung
      description: formData.title || `Rechnung ${nextNumber}`,

      // Finanzielle Daten
      amount: subtotal, // Nettobetrag
      tax: vat, // Steuerbetrag
      total: grandTotal, // Gesamtbetrag

      // Status und Metadaten
      year: new Date().getFullYear(),

      // Steuereinstellungen
      isSmallBusiness: false, // Wird durch taxRule bestimmt
      vatRate: taxRate,
      priceInput: 'brutto', // Standardmäßig brutto

      // Erweiterte Steuerregeln
      taxRule: formData.taxRule || TaxRuleType.DE_TAXABLE,
      taxRuleType: formData.taxRule || TaxRuleType.DE_TAXABLE,

      // Skonto-Einstellungen
      skontoEnabled: formData.skontoEnabled || skontoEnabled || false,
      skontoDays: formData.skontoDays || skontoDays || 0,
      skontoPercentage: formData.skontoPercentage || skontoPercentage || 0,
      skontoText: formData.skontoText || skontoText || '',

      // Unternehmensdaten
      companyName: company?.companyName || '',
      companyAddress: [
        [company?.companyStreet?.replace(/\s+/g, ' ').trim(), company?.companyHouseNumber]
          .filter(Boolean)
          .join(' '),
        [company?.companyPostalCode, company?.companyCity].filter(Boolean).join(' '),
        company?.companyCountry,
      ]
        .filter(Boolean)
        .join('\n'),
      companyEmail: (company?.email as string) || '',
      companyPhone:
        (company?.phoneNumber as string) || (company?.companyPhoneNumber as string) || '',
      companyWebsite: '',
      companyLogo: '',
      profilePictureURL: (company?.profilePictureURL as string) || undefined,
      companyVatId:
        (company?.vatId as string) ||
        (company?.vatIdForBackend as string) ||
        getStepValue(company, 'step3', 'vatId') ||
        '',
      companyTaxNumber:
        (company?.taxNumber as string) ||
        (company?.taxNumberForBackend as string) ||
        getStepValue(company, 'step3', 'taxNumber') ||
        '',
      companyRegister:
        (company?.companyRegisterPublic as string) ||
        (company?.companyRegister as string) ||
        getStepValue(company, 'step3', 'companyRegister') ||
        (settings?.districtCourt as string) ||
        (settings?.companyRegister as string) ||
        undefined,

      // Items and totals
      items: items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        taxRate: item.taxRate,
        discountPercent: item.discountPercent || 0,
        unit: item.unit || 'Stk',
        category: item.category || 'Artikel',
        inventoryItemId: item.inventoryItemId || null,
        extendedDescription: item.extendedDescription || '', // Erweiterte Beschreibung
      })),

      // Additional fields
      currency: formData.currency || 'EUR',
      paymentTerms: formData.paymentTerms || finalPaymentTerms,
      internalContactPerson: formData.internalContactPerson || '',
      deliveryTerms: formData.deliveryTerms || '',
      deliveryDate: formData.deliveryDate || '',
      servicePeriod: (() => {
        // Debug: Schaue was in servicePeriod steht

        // Wenn servicePeriod leer ist oder dem deliveryDate entspricht, leeren
        if (
          !formData.servicePeriod ||
          formData.servicePeriod.trim() === '' ||
          formData.servicePeriod === formData.deliveryDate
        ) {
          return '';
        }
        return formData.servicePeriod;
      })(),
      headTextHtml: formData.headTextHtml || '', // Kopftext für Modal
      footerText: formData.footerText || '',
      notes: formData.notes || '',

      // E-Invoice Daten (falls aktiviert)
      eInvoice: eInvoiceEnabled
        ? {
          format: (eInvoiceSettings?.defaultFormat as string) || 'zugferd',
          version: '1.0',
          guid: crypto.randomUUID(),
        }
        : undefined,
      eInvoiceData:
        eInvoiceEnabled && eInvoiceSettings
          ? {
            format: (eInvoiceSettings.defaultFormat as string) || 'zugferd',
            version: '1.0',
            guid: crypto.randomUUID(),
            validationStatus: 'pending' as const,
            createdAt: new Date().toISOString(),
          }
          : undefined,

      // Metadata
      createdAt: new Date(),
      isStorno: false,
      // Dokumentsprache (0099): Gastsprache aus der Buchungs-Vorschau —
      // belegt die Sprach-Auswahl im Vorschau-/Versand-Dialog vor.
      language: documentLanguage || 'de',
    };

    setCreatedDocument(tempInvoiceData);
    setShowSendDocumentModal(true);
  };

  const handleSubmit = async (asDraft = true) => {
    if (loading) return;
    setLoading(true);
    try {
      // Validation
      if (!formData.customerName || !formData.validUntil) {
        toast.error('Bitte füllen Sie alle Pflichtfelder aus');
        return;
      }
      const hasValidItems = items.some(it => it.description && it.quantity > 0);
      if (!hasValidItems) {
        toast.error('Bitte fügen Sie mindestens eine gültige Position hinzu');
        return;
      }

      // Kundensuche für vollständige Daten
      const selectedCustomer = customers.find(c => c.name === formData.customerName);

      // Zahlungsbedingungen final (inkl. Skonto, falls aktiv)
      const skontoSentence =
        skontoEnabled && skontoDays && skontoPercentage
          ? skontoText?.trim() ||
          `Bei Zahlung binnen ${skontoDays} Tagen ${skontoPercentage}% Skonto`
          : '';
      const finalPaymentTerms =
        [formData.paymentTerms?.trim(), skontoSentence].filter(Boolean).join('\n\n') || undefined;

      // Die GoBD-Rechnungsnummer wird AUSSCHLIESSLICH serverseitig atomar über
      // next_document_number vergeben — und nur bei Finalisierung, nicht für
      // Entwürfe (sonst reißt jeder verworfene Entwurf eine Lücke). Der Client
      // zieht/sendet KEINE Nummer mehr (kein Date.now()-Fallback, der außerhalb
      // des Nummernkreises läge und GoBD-Lückenlosigkeit brechen würde).

      // 🚨 COMPLETE INVOICE DATA OBJECT - **EVERY SINGLE FIELD** FROM THE FORM!
      // This object must contain ALL form fields to ensure complete data persistence
      const invoiceData = {
        // Basic Invoice Info - ID + Nummer werden vom Server vergeben.
        id: '', // Assigned by the API after creation
        companyId: uid,
        status: asDraft ? 'draft' : 'finalized',

        // Dates - ALLE Datumswerte aus dem Formular
        date: formData.invoiceDate
          ? new Date(formData.invoiceDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        issueDate: formData.invoiceDate
          ? new Date(formData.invoiceDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        dueDate: formData.validUntil
          ? new Date(formData.validUntil).toISOString().split('T')[0]
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        invoiceDate: formData.invoiceDate || '',
        validUntil: formData.validUntil || '',
        deliveryDate: formData.deliveryDate || '',

        // Customer Data - ALLE Kundenfelder aus dem Formular
        customerName: formData.customerName || '',
        customerFirstName: formData.customerFirstName || '',
        customerLastName: formData.customerLastName || '',
        customerNumber: formData.customerNumber || '',
        customerEmail: formData.customerEmail || selectedCustomer?.email || '',
        customerAddress: formData.customerAddress || '',
        customerOrderNumber: formData.customerOrderNumber || '',
        customerPhone: selectedCustomer?.phone || '',
        customerVatId: selectedCustomer?.vatId || '',
        customerTaxNumber: selectedCustomer?.taxNumber || '',

        // Invoice Identifiers - ALLE Titel und Referenz-Felder
        title: formData.title || '',
        documentNumber: formData.title || `RE-${nextNumber}`,
        reference: formData.customerOrderNumber || undefined,

        // Company Data - ALLE Firmendaten aus Settings
        companyName:
          company?.companyName || settings?.companyName || user?.displayName || 'Ihr Unternehmen',
        companyAddress: [
          [company?.companyStreet?.replace(/\s+/g, ' ').trim(), company?.companyHouseNumber]
            .filter(Boolean)
            .join(' '),
          [company?.companyPostalCode, company?.companyCity].filter(Boolean).join(' '),
          company?.companyCountry,
        ]
          .filter(Boolean)
          .join('\n'),
        companyEmail: (company?.email as string) || '',
        companyPhone:
          (company?.phoneNumber as string) || (company?.companyPhoneNumber as string) || '',
        companyWebsite: (company?.website as string) || (company?.companyWebsite as string) || '',
        companyVatId: (company?.vatId as string) || (company?.vatIdForBackend as string) || '',
        companyTaxNumber:
          (company?.taxNumber as string) || (company?.taxNumberForBackend as string) || '',
        companyRegister:
          (company?.companyRegisterPublic as string) || (company?.companyRegister as string) || '',
        companyLogo: (company?.companyLogo as string) || '',
        profilePictureURL: (company?.profilePictureURL as string) || '',

        // **CRITICAL**: ALLE Textfelder - Kopftext, Footer, Notizen
        description: formData.headTextHtml || '',
        headTextHtml: formData.headTextHtml || '', // MUSS gespeichert werden!
        footerText: formData.footerText || '', // MUSS gespeichert werden!
        notes: formData.notes || '',

        // Contact Person - ALLE Kontaktfelder
        internalContactPerson: formData.internalContactPerson || '',
        contactPersonName: formData.internalContactPerson || '',

        // Payment & Delivery Terms - ALLE Zahlungs- und Lieferbedingungen
        paymentTerms:
          finalPaymentTerms || formData.paymentTerms || 'Zahlbar binnen 14 Tagen ohne Abzug',
        deliveryTerms: formData.deliveryTerms || '',
        deliveryMethod: formData.deliveryTerms ? 'custom' : null,

        // Skonto Data - ALLE Skonto-Einstellungen
        skontoEnabled: skontoEnabled || false,
        skontoDays: skontoDays || null,
        skontoPercentage: skontoPercentage || null,
        skontoText: skontoText || '',

        // Financial Data - ALLE Items mit vollständigen Details
        items: items
          .filter(it => it.description && it.quantity > 0)
          .map(item => ({
            id: item.id || crypto.randomUUID(),
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            // ?? statt ||: 0 % ist gültig (Kurtaxe/Abgaben aus Buchungs-
            // rechnungen) und darf nicht auf den Standardsatz kippen.
            taxRate: item.taxRate ?? taxRate,
            unit: item.unit || 'Stk',
            category: item.category || 'Leistung',
            discountPercent: item.discountPercent || 0,
            inventoryItemId: item.inventoryItemId || null,
          })),
        amount: subtotal, // Nettobetrag
        tax: vat, // Steuerbetrag
        total: grandTotal, // Gesamtbetrag
        subtotal: subtotal,
        taxAmount: vat,

        // Tax & Business Settings - ALLE Steuer-Einstellungen
        vatRate: taxRate,
        taxGrouped: taxGrouped, // SevDesk-style multi-tax support
        isSmallBusiness: settings?.ust === 'kleinunternehmer' || taxRate === 0,
        priceInput: showNet ? 'netto' : 'brutto',
        taxRuleType: (formData.taxRule as TaxRuleType) || 'DE_TAXABLE',
        taxRule: (formData.taxRule as TaxRuleType) || 'DE_TAXABLE',
        showNet: showNet,

        // Currency & Formatting
        currency: formData.currency || 'EUR',

        // Required metadata fields
        year: new Date().getFullYear(),
        createdAt: new Date(),
        updatedAt: new Date(),

        // User IDs
        createdBy: uid,
        lastModifiedBy: uid,

        // Bank Details - ALLE Bankdaten
        bankDetails: company
          ? {
            iban: getStepValue(company, 'step4', 'iban') || (company?.iban as string) || '',
            bic: getStepValue(company, 'step4', 'bic') || (company?.bic as string) || '',
            bankName:
              getStepValue(company, 'step4', 'bankName') || (company?.bankName as string) || '',
            accountHolder:
              getStepValue(company, 'step4', 'accountHolder') ||
              (company?.accountHolder as string) ||
              company?.companyName ||
              '',
          }
          : undefined,

        // Template & UI Settings
        template: selectedTemplate || 'TEMPLATE_STANDARD',
        templateId: selectedTemplate || 'TEMPLATE_STANDARD',
        templateType: selectedTemplate || 'TEMPLATE_STANDARD',
        // Dokumentsprache (0099): Gastsprache aus der Buchungs-Vorschau.
        language: documentLanguage || 'de',

        // Additional Control Fields
        isStorno: false,
        isRecurring: false,

        // Buchungs-Brücke (0092): verknüpft die Rechnung mit der Buchung;
        // Backend prüft Check-in-Pflicht + Doppelrechnungs-Schutz (409).
        reservationId: reservationId || undefined,
        customerId: reservationCustomerId || undefined,

        // E-Invoice Settings (if enabled)
        isEInvoice: eInvoiceEnabled || false,
        eInvoiceType: eInvoiceEnabled ? 'zugferd' : null,
        eInvoiceSettings: eInvoiceEnabled ? eInvoiceSettings : null,

        // Document Paths
        eInvoiceXmlPath: null,

        // Delivery Date Configuration
        deliveryDateType: deliveryDateType || 'single',
        deliveryDateRange:
          deliveryDateType === 'range'
            ? {
              from: deliveryDateRange.from?.toISOString().split('T')[0] || null,
              to: deliveryDateRange.to?.toISOString().split('T')[0] || null,
            }
            : null,

        // Original form state preservation for debugging
        _originalFormData: {
          ...formData,
          items: items,
          skontoEnabled,
          skontoDays,
          skontoPercentage,
          skontoText,
          showNet,
          taxRate,
          eInvoiceEnabled,
          deliveryDateType,
          deliveryDateRange,
        },
      } as Record<string, unknown>;

      // CRITICAL: Remove all undefined values before sending to API
      const cleanInvoiceData = JSON.parse(
        JSON.stringify(invoiceData, (_key, value) => {
          return value === undefined ? null : value;
        }),
      );

      // Restore Date objects that got converted to strings
      cleanInvoiceData.createdAt = new Date(cleanInvoiceData.createdAt);
      cleanInvoiceData.updatedAt = new Date(cleanInvoiceData.updatedAt);

      // Save Invoice via FastAPI Backend - TARGET: invoices collection
      const savedInvoice = (await api.post(
        `/api/v1/invoices?company_id=${uid}`,
        cleanInvoiceData,
      )) as any;
      const createdInvoiceId = savedInvoice?.id || savedInvoice;

      // 📊 SERVICE USAGE TRACKING - Track service usage for analytics
      try {
        const { ServiceUsageTrackingService } = await import(
          '@/services/serviceUsageTrackingService'
        );
        await ServiceUsageTrackingService.trackInvoiceServiceUsage(
          uid,
          createdInvoiceId,
          items || [],
          selectedCustomer?.name || formData.customerName,
        );
      } catch (trackingError) {
        // Tracking ist nicht kritisch — nur loggen, nie blockieren.
        console.warn('Usage-Tracking fehlgeschlagen:', trackingError);
      }

      // Inventory Management
      try {
        const inventoryItems = (items || [])
          .filter(it => it.inventoryItemId && it.quantity > 0 && it.category !== 'discount')
          .map(it => ({ itemId: it.inventoryItemId as string, quantity: it.quantity }));

        if (inventoryItems.length > 0) {
        }
      } catch (reserveErr: unknown) {
        console.error('Inventory reservation failed:', reserveErr);
        // Continue anyway - inventory reservation is not critical for invoice creation
      }

      // ✅ Invoice number sequence is now automatically managed by NumberSequenceService
      // ❌ REMOVED: setNextNumber manipulation - causes race conditions!
      // NumberSequenceService handles all numbering automatically

      toast.success(asDraft ? 'Rechnung als Entwurf gespeichert' : 'Rechnung erstellt');

      // 🚀 E-INVOICE GENERIERUNG NACH SPEICHERN (falls aktiviert)
      if (!asDraft && eInvoiceEnabled && createdInvoiceId) {
        try {
          const { AutoEInvoiceService } = await import('@/services/autoEInvoiceService');

          // Lade die gerade gespeicherte Rechnung
          const savedInvoiceData = await api.get(
            `/api/v1/invoices/${createdInvoiceId}?company_id=${uid}`,
          );
          if (savedInvoiceData) {
            const eInvoiceResult = await AutoEInvoiceService.generateEInvoiceForInvoice(
              savedInvoiceData,
              {
                companyId: uid,
                enabled: true,
                defaultFormat: 'zugferd',
                autoTransmit: false,
                tseEnabled: false,
              },
            );

            if (eInvoiceResult) {
              // Update die Rechnung mit den E-Invoice-Daten
              const updateData = {
                eInvoiceData: {
                  format: eInvoiceResult.format,
                  version: '1.0', // Standard version
                  guid: eInvoiceResult.id || crypto.randomUUID(), // Use the E-Invoice ID as GUID
                  xmlUrl: `/api/einvoices/${eInvoiceResult.id}/xml`, // Generate XML URL
                  validationStatus: eInvoiceResult.validationStatus,
                  createdAt: eInvoiceResult.createdAt?.toISOString() || new Date().toISOString(),
                },
                companyId: uid, // Required for updateInvoice method
              };

              await api.patch(`/api/v1/invoices/${createdInvoiceId}`, updateData);

              toast.success('E-Rechnung erfolgreich generiert');
            } else {
            }
          }
        } catch (eInvoiceError) {
          console.error('❌ E-Invoice generation failed:', eInvoiceError);
          toast.error('E-Rechnung konnte nicht generiert werden');
        }
      }

      // 🚨 CRITICAL: Update invoiceData with the newly created ID from the API
      invoiceData.id = createdInvoiceId;

      // Open send document modal instead of navigating
      setCreatedDocument(invoiceData as unknown as InvoiceData);
      setShowSendDocumentModal(true);
    } catch (e) {
      console.error('❌ CRITICAL ERROR in handleSubmit:', e);
      // Backend-Fachfehler im Klartext zeigen (z. B. 409 „Zu dieser Buchung
      // existiert bereits eine Rechnung." aus der Buchungs-Brücke).
      const message =
        e instanceof Error && e.message && !e.message.startsWith('API Error')
          ? e.message
          : 'Rechnung konnte nicht gespeichert werden';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // E-Rechnung Toggle Handler
  const handleEInvoiceToggle = async (enabled: boolean) => {
    if (!enabled) {
      setEInvoiceEnabled(false);
      return;
    }

    // Umfassende E-Rechnung Compliance Prüfung
    try {
      const complianceErrors: string[] = [];
      const invalidFieldsSet = new Set<string>();

      // 1. Lade Company-Daten für vollständige Prüfung
      let companyData: CompanyDocument | null = null;
      try {
        const companyResponse = await api.get<CompanyDocument>(`/api/v1/companies/${uid}`);
        if (companyResponse) {
          companyData = companyResponse;
        } else {
          complianceErrors.push('Unternehmensdaten nicht gefunden');
        }
      } catch {
        complianceErrors.push('Fehler beim Laden der Unternehmensdaten');
      }

      // 2. Unternehmensdaten Prüfung (§14 UStG) - aus companies collection
      if (companyData) {
        // Firmenname (Pflichtfeld)
        if (!companyData.companyName?.trim()) {
          complianceErrors.push('Firmenname ist erforderlich');
        }

        // Vollständige Firmenanschrift prüfen (aus der echten DB-Struktur)
        if (!companyData.companyStreet?.trim()) {
          complianceErrors.push('Firmenstraße ist erforderlich');
        }
        if (!companyData.companyCity?.trim()) {
          complianceErrors.push('Firmenort ist erforderlich');
        }
        if (!companyData.companyPostalCode?.trim()) {
          complianceErrors.push('Postleitzahl der Firma ist erforderlich');
        }
        if (!companyData.companyCountry?.trim()) {
          complianceErrors.push('Land der Firma ist erforderlich');
        }

        // E-Mail für Versendung (aus der echten DB-Struktur)
        const hasEmail = companyData.contactEmail?.trim() || companyData.email?.trim();
        if (!hasEmail) {
          complianceErrors.push('Firmen-E-Mail-Adresse ist erforderlich');
        }

        // Telefonnummer (aus der echten DB-Struktur)
        const hasPhone = companyData.companyPhoneNumber?.trim() || companyData.phoneNumber?.trim();
        if (!hasPhone) {
          complianceErrors.push('Firmen-Telefonnummer ist für E-Rechnungen empfohlen');
        }

        // Steuerliche Identifikation (aus der echten DB-Struktur)
        const hasVatId = companyData.vatId?.trim() || companyData.step3?.vatId?.trim();
        const hasTaxNumber = companyData.taxNumber?.trim() || companyData.step3?.taxNumber?.trim();

        if (!hasVatId && !hasTaxNumber) {
          complianceErrors.push('USt-IdNr. oder Steuernummer ist erforderlich für E-Rechnungen');
        }

        // Kleinunternehmer-spezifische Prüfung (aus der echten DB-Struktur)
        const isKleinunternehmer =
          companyData.kleinunternehmer === 'ja' ||
          companyData.ust === 'kleinunternehmer' ||
          companyData.step2?.kleinunternehmer === 'ja';

        if (isKleinunternehmer) {
          if (hasVatId) {
            complianceErrors.push(
              'Kleinunternehmer dürfen keine USt-IdNr. auf Rechnungen ausweisen',
            );
          }
          if (!hasTaxNumber) {
            complianceErrors.push('Kleinunternehmer benötigen eine Steuernummer für E-Rechnungen');
          }
        } else {
          // Regelbesteuerte Unternehmen
          if (!hasVatId && !hasTaxNumber) {
            complianceErrors.push(
              'Regelbesteuerte Unternehmen benötigen USt-IdNr. oder Steuernummer',
            );
          }
        }

        // Rechtsform und Registrierung (aus der echten DB-Struktur)
        const legalForm = companyData.legalForm || companyData.step2?.legalForm;
        if (legalForm && legalForm !== 'Einzelunternehmen' && legalForm !== 'Freiberufler') {
          // Kapitalgesellschaften benötigen Handelsregistereintrag
          const hasRegister =
            companyData.companyRegister?.trim() ||
            companyData.step3?.companyRegister?.trim() ||
            companyData.registrationNumber?.trim();
          if (!hasRegister) {
            complianceErrors.push(
              'Handelsregisternummer ist für Kapitalgesellschaften erforderlich',
            );
          }
        }

        // Bankverbindung für Zahlungen (aus der echten DB-Struktur)
        const hasIban = companyData.iban?.trim() || companyData.step4?.iban?.trim();
        const hasBic = companyData.bic?.trim() || companyData.step4?.bic?.trim();
        const hasBankName = companyData.bankName?.trim() || companyData.step4?.bankName?.trim();
        const hasAccountHolder =
          companyData.accountHolder?.trim() || companyData.step4?.accountHolder?.trim();

        if (!hasIban) {
          complianceErrors.push('IBAN ist für E-Rechnungen erforderlich');
        }
        if (!hasBic) {
          complianceErrors.push('BIC ist für E-Rechnungen erforderlich');
        }
        if (!hasBankName) {
          complianceErrors.push('Bankname ist für E-Rechnungen erforderlich');
        }
        if (!hasAccountHolder) {
          complianceErrors.push('Kontoinhaber ist für E-Rechnungen erforderlich');
        }

        // Website (aus der echten DB-Struktur)
        const hasWebsite =
          companyData.website?.trim() ||
          companyData.companyWebsite?.trim() ||
          companyData.step1?.website?.trim() ||
          companyData.companyWebsiteForBackend?.trim();
        if (!hasWebsite) {
          complianceErrors.push('Firmen-Website ist für professionelle E-Rechnungen empfohlen');
        }

        // Logo für Branding (aus der echten DB-Struktur)
        const hasLogo =
          companyData.profilePictureURL?.trim() || companyData.profilePictureFirebaseUrl?.trim();
        if (!hasLogo) {
          complianceErrors.push('Firmen-Logo ist für professionelle E-Rechnungen empfohlen');
        }

        // Branchenangabe (aus der echten DB-Struktur)
        const hasIndustry =
          companyData.selectedCategory?.trim() ||
          companyData.step2?.industry?.trim() ||
          companyData.industry?.trim();
        if (!hasIndustry) {
          complianceErrors.push('Branchenangabe ist für E-Rechnungen empfohlen');
        }

        // Geschäftsbeschreibung (aus der echten DB-Struktur)
        if (!companyData.description?.trim()) {
          complianceErrors.push(
            'Geschäftsbeschreibung ist für professionelle E-Rechnungen empfohlen',
          );
        }
      } else {
        complianceErrors.push(
          'Unternehmensdaten nicht vollständig - bitte Firmenprofil vervollständigen',
        );
      }

      // 3. Kundendaten Prüfung - Prüfe ob gültiger Kunde ausgewählt wurde
      const selectedCustomer = customers.find(c => c.name === formData.customerName);

      if (!formData.customerName.trim()) {
        complianceErrors.push('Kundenname ist erforderlich');
        invalidFieldsSet.add('customerName');
      } else if (!selectedCustomer) {
        // Neuer Kunde - prüfe manuell eingegebene Daten
        if (!formData.customerAddress?.trim()) {
          complianceErrors.push('Vollständige Kundenanschrift ist erforderlich');
          invalidFieldsSet.add('customerAddress');
        } else {
          const addressLines = formData.customerAddress.split('\n').filter(line => line.trim());
          if (addressLines.length < 3) {
            complianceErrors.push('Kundenanschrift muss Straße, PLZ/Ort und Land enthalten');
            invalidFieldsSet.add('customerAddress');
          }
        }

        if (!formData.customerEmail?.trim()) {
          complianceErrors.push('Kunden-E-Mail-Adresse für E-Rechnung Versendung erforderlich');
          invalidFieldsSet.add('customerEmail');
        }
      } else {
        // Existierender Kunde - prüfe Vollständigkeit in der Customers Collection
        if (!selectedCustomer.email?.trim()) {
          complianceErrors.push(
            `Kunde &quot;${selectedCustomer.name}&quot; hat keine E-Mail-Adresse hinterlegt`,
          );
        }

        if (
          !selectedCustomer.street?.trim() ||
          !selectedCustomer.city?.trim() ||
          !selectedCustomer.postalCode?.trim()
        ) {
          complianceErrors.push(
            `Kunde &quot;${selectedCustomer.name}&quot; hat unvollständige Adressdaten`,
          );
        }

        // Für B2B-Kunden (mit VAT-ID) zusätzliche Prüfungen
        if (selectedCustomer.vatId?.trim()) {
          if (!selectedCustomer.vatValidated) {
            complianceErrors.push(
              `USt-IdNr. von Kunde &quot;${selectedCustomer.name}&quot; ist nicht validiert`,
            );
          }
        }
      }

      // 4. Rechnungsdaten Prüfung
      if (!formData.title?.trim()) {
        complianceErrors.push('Rechnungsnummer ist erforderlich');
        invalidFieldsSet.add('title');
      }

      // 5. Positionen Prüfung
      const validItems = items.filter(
        item =>
          item.description?.trim() &&
          item.quantity > 0 &&
          item.unitPrice >= 0 &&
          item.category !== 'discount',
      );

      if (validItems.length === 0) {
        complianceErrors.push('Mindestens eine gültige Position ist erforderlich');
        invalidFieldsSet.add('items');
      }

      // 6. Steuerliche Prüfung
      if (!formData.taxRule) {
        complianceErrors.push('Steuerliche Behandlung muss definiert sein');
        invalidFieldsSet.add('taxRule');
      }

      // 7. E-Rechnung spezifische Anforderungen
      if (contactType === 'organisation') {
        // Für B2B E-Rechnungen
        if (!formData.customerEmail) {
          complianceErrors.push('Kunden-E-Mail-Adresse für E-Rechnung Versendung erforderlich');
        }
      }

      // 8. Format-spezifische Prüfungen
      const defaultFormat = eInvoiceSettings?.defaultFormat || 'zugferd';

      if (defaultFormat === 'xrechnung') {
        // XRechnung benötigt zusätzliche Metadaten
        if (!formData.customerOrderNumber?.trim()) {
          complianceErrors.push('Bestellnummer für XRechnung erforderlich');
        }
      }

      // 9. Betragsprüfung
      const totalAmount = subtotal + vat;
      if (totalAmount <= 0) {
        complianceErrors.push('Rechnungsbetrag muss größer als 0 sein');
      }

      // 10. Währungsprüfung
      if (formData.currency !== 'EUR') {
        complianceErrors.push('E-Rechnungen werden aktuell nur in EUR unterstützt');
      }

      // 11. Datum Prüfungen
      const today = new Date();
      const invoiceDate = new Date();

      if (invoiceDate > today) {
        complianceErrors.push('Rechnungsdatum darf nicht in der Zukunft liegen');
      }

      // Zeige Compliance Fehler oder aktiviere E-Rechnung
      if (complianceErrors.length > 0) {
        setEInvoiceEnabled(false);
        setComplianceErrors(complianceErrors);
        setInvalidFields(invalidFieldsSet);
        setShowCompliancePanel(true);

        // Kurze Toast-Nachricht mit Hinweis auf Panel
        toast.error('E-Rechnung kann nicht aktiviert werden', {
          description: `${complianceErrors.length} Probleme gefunden. Fehlende Felder sind rot markiert.`,
          duration: 5000,
        });

        return;
      }

      // Alle Prüfungen bestanden - E-Rechnung aktivieren
      setEInvoiceEnabled(true);
      setInvalidFields(new Set()); // Clear invalid fields

      // Update settings in company document
      try {
        const updatedSettings = {
          defaultFormat: eInvoiceSettings?.defaultFormat || 'zugferd',
          defaultStandard: eInvoiceSettings?.defaultStandard || 'EN16931',
          enableAutoGeneration: true,
          peppol: eInvoiceSettings?.peppol || {
            enabled: false,
            participantId: '',
            endpoint: '',
          },
          validation: eInvoiceSettings?.validation || {
            strictMode: true,
            autoCorrection: false,
          },
          updatedAt: new Date(),
        };

        await api.patch(`/api/v1/companies/${uid}`, {
          eInvoiceSettings: updatedSettings,
        });

        setEInvoiceSettings(updatedSettings);
      } catch (updateError) {
        console.error('Fehler beim Speichern der E-Rechnung Einstellungen:', updateError);
        // Don't fail the whole process if settings can't be saved
      }

      toast.success('E-Rechnung aktiviert', {
        description:
          'Alle Compliance-Anforderungen erfüllt. E-Rechnungen werden automatisch generiert.',
      });
    } catch (error) {
      console.error('Fehler bei E-Rechnung Compliance-Prüfung:', error);
      toast.error('E-Rechnung Prüfung fehlgeschlagen', {
        description:
          'Technischer Fehler bei der Compliance-Prüfung. Bitte versuchen Sie es erneut.',
      });
      setEInvoiceEnabled(false);
    }
  };

  // Company Settings Save Handler
  const handleCompanySettingsSave = async () => {
    try {
      await api.patch(`/api/v1/companies/${uid}`, {
        companyName: companySettingsFormData.companyName,
        companyStreet: companySettingsFormData.street,
        companyCity: companySettingsFormData.city,
        companyPostalCode: companySettingsFormData.zip,
        taxNumber: companySettingsFormData.taxNumber,
        vatId: companySettingsFormData.vatNumber,
        email: companySettingsFormData.email,
        phoneNumber: companySettingsFormData.phone,
        iban: companySettingsFormData.iban,
        bic: companySettingsFormData.bic,
        firstName: companySettingsFormData.companyOwner.split(' ')[0] || '',
        lastName: companySettingsFormData.companyOwner.split(' ').slice(1).join(' ') || '',
        // USt-Satz Übernachtung (0092): nur mitschicken, wenn gesetzt und
        // gültig — leer lässt den gespeicherten Wert unangetastet.
        lodgingTaxRate: Number.isFinite(Number(companySettingsFormData.lodgingTaxRate))
          && companySettingsFormData.lodgingTaxRate.trim() !== ''
          ? Number(companySettingsFormData.lodgingTaxRate)
          : undefined,
      });

      toast.success('Unternehmensdaten gespeichert');
      setShowCompanySettingsModal(false);
      setShowCompanySettingsBanner(false);

      // Reload company data
      const updatedCompany = await api.get<CompanyDocument>(`/api/v1/companies/${uid}`);
      if (updatedCompany) {
        setCompany(updatedCompany);
      }
    } catch (error) {
      console.error('Fehler beim Speichern der Unternehmensdaten:', error);
      toast.error('Fehler beim Speichern der Unternehmensdaten');
    }
  };

  // Hilfsfunktion für fehlerhafte Felder
  const getFieldErrorClass = (fieldName: string) => {
    return invalidFields.has(fieldName)
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : '';
  };

  return {
    selectCustomer,
    saveServiceToSubcollection,
    removeItem,
    handleItemChange,
    handleValidUntilChange,
    handleOpenSendModal,
    handleSubmit,
    handleEInvoiceToggle,
    handleCompanySettingsSave,
    getFieldErrorClass,
  };
}
