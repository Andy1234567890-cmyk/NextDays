'use client';

// Lade-Effekte der Rechnungserstellung (aus create-invoice-page.tsx extrahiert).
// Der Hook besitzt die rein geladenen States (Kunden, Firma, Dienstleistungen,
// Textvorlagen, Banner, Steuersatz, Template) und gibt sie zurück; States, die
// auch von Handlern der Hauptdatei geschrieben werden (formData, showNet,
// skonto*, eInvoice*, Nummernkreis), erhält er als Setter-Parameter.
// Alle deps-Arrays sind 1:1 aus der Hauptdatei übernommen.

import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Customer as CustomerType } from '@/components/finance/AddCustomerModal';
import {
  DEFAULT_INVOICE_TEMPLATE,
  type InvoiceTemplate as ImportedInvoiceTemplate,
} from '@/components/finance/InvoiceTemplates';
import type { CompanyDocument } from '@/components/finance/create-invoice/types';
import type { AuthUser } from '@/contexts/NewAuthContext';
import type { CompanySettings } from '@/hooks/useCompanySettings';
import { api } from '@/lib/api-client';
import { UserPreferencesService } from '@/lib/userPreferences';
import { TextTemplateService } from '@/services/TextTemplateService';
import type { CreateInvoiceFormData } from '@/types/formData';
import { TaxRuleType } from '@/types/taxRules';
import type { TextTemplate } from '@/types/textTemplates';

// Inline gespeicherte Dienstleistungen (Subcollection)
export interface InvoiceService {
  id: string;
  name: string;
  description?: string;
  price: number | string;
  unit: string;
  source: 'inlineInvoiceServices';
}

// Formulardaten des „Angaben vervollständigen"-Modals
export type CompanySettingsFormData = {
  companyOwner: string;
  companyName: string;
  street: string;
  zip: string;
  city: string;
  taxNumber: string;
  vatNumber: string;
  email: string;
  phone: string;
  iban: string;
  bic: string;
  // USt-Satz Übernachtung (%) als String (Input-Feld); '' = nicht gesetzt.
  // Pflicht für die automatische Check-out-Rechnung (0092, kein Default).
  lodgingTaxRate: string;
};

type UseInvoiceLoadersArgs = {
  uid: string;
  user: AuthUser | null;
  prefillCustomerId: string | null | undefined;
  settings: CompanySettings | null;
  formData: CreateInvoiceFormData;
  setFormData: Dispatch<SetStateAction<CreateInvoiceFormData>>;
  setShowNet: Dispatch<SetStateAction<boolean>>;
  setSkontoEnabled: Dispatch<SetStateAction<boolean>>;
  setSkontoDays: Dispatch<SetStateAction<number | undefined>>;
  setSkontoPercentage: Dispatch<SetStateAction<number | undefined>>;
  setSkontoText: Dispatch<SetStateAction<string>>;
  setEInvoiceEnabled: Dispatch<SetStateAction<boolean>>;
  setEInvoiceSettings: Dispatch<SetStateAction<Record<string, unknown> | null>>;
  setNumberingFormat: Dispatch<SetStateAction<string>>;
  setNextNumber: Dispatch<SetStateAction<number>>;
};

export function useInvoiceLoaders({
  uid,
  user,
  prefillCustomerId,
  settings,
  formData,
  setFormData,
  setShowNet,
  setSkontoEnabled,
  setSkontoDays,
  setSkontoPercentage,
  setSkontoText,
  setEInvoiceEnabled,
  setEInvoiceSettings,
  setNumberingFormat,
  setNextNumber,
}: UseInvoiceLoadersArgs) {
  const [selectedTemplate, setSelectedTemplate] =
    useState<ImportedInvoiceTemplate>(DEFAULT_INVOICE_TEMPLATE);
  const [_loadingTemplate, setLoadingTemplate] = useState(false);

  const [loadingSavedServices, setLoadingSavedServices] = useState(false);
  const [savedServices, setSavedServices] = useState<InvoiceService[]>([]);

  const [customers, setCustomers] = useState<CustomerType[]>([]);
  const [_loadingCustomers, setLoadingCustomers] = useState(false);
  const [taxRate, setTaxRate] = useState(19);
  const [company, setCompany] = useState<CompanyDocument | null>(null);

  // Textvorlagen State
  const [_textTemplates, setTextTemplates] = useState<TextTemplate[]>([]);
  const [_loadingTemplates, setLoadingTemplates] = useState(true);
  const [_selectedHeadTemplate, setSelectedHeadTemplate] = useState<string>('');
  const [_selectedFooterTemplate, setSelectedFooterTemplate] = useState<string>('');

  // Company Settings Banner State
  const [showCompanySettingsBanner, setShowCompanySettingsBanner] = useState(false);
  const [companySettingsFormData, setCompanySettingsFormData] = useState<CompanySettingsFormData>({
    companyOwner: '',
    companyName: '',
    street: '',
    zip: '',
    city: '',
    taxNumber: '',
    vatNumber: '',
    email: '',
    phone: '',
    iban: '',
    bic: '',
    lodgingTaxRate: '',
  });

  // Lade existierende Dienstleistungen
  useEffect(() => {
    const loadExistingServices = async () => {
      if (!uid) return;
      setLoadingSavedServices(true);
      try {
        const inlineServicesData = (await api.get(
          `/api/v1/inline-invoice-services?company_id=${uid}`,
        )) as any[];
        const inlineInvoiceServices = (inlineServicesData || []).map((item: any) => ({
          id: item.id,
          name: item.name || '',
          description: item.description,
          price: item.price || 0,
          unit: item.unit || 'Stk',
          source: 'inlineInvoiceServices' as const,
        }));
        setSavedServices(inlineInvoiceServices);
      } catch (error) {
        console.error('Fehler beim Laden der Dienstleistungen:', error);
        toast.error('Dienstleistungen konnten nicht geladen werden');
      } finally {
        setLoadingSavedServices(false);
      }
    };

    loadExistingServices();
  }, [uid]);

  // Lade E-Invoice Settings aus Company
  // Hinweis: Loader #1 und #2 sind BEWUSST doppelt (Race-Verhalten der Original-Datei erhalten)
  useEffect(() => {
    const loadEInvoiceSettings = async () => {
      try {
        const companyDoc = (await api.get(`/api/v1/companies/${uid}`)) as any;
        if (companyDoc) {
          const eInvoiceSettings = companyDoc.eInvoiceSettings;

          if (eInvoiceSettings?.enableAutoGeneration) {
            setEInvoiceEnabled(true);
            setEInvoiceSettings(eInvoiceSettings);
          }
        }
      } catch (error) {
        console.error('❌ Fehler beim Laden der E-Invoice Settings:', error);
      }
    };

    if (uid) {
      loadEInvoiceSettings();
    }
  }, [uid, setEInvoiceEnabled, setEInvoiceSettings]);

  // Kunden laden - direkt aus Firebase Subcollection
  useEffect(() => {
    const loadCustomers = async () => {
      const isOwner = user?.uid === uid;
      const isEmployee = user?.user_type === 'mitarbeiter' && user?.company_id === uid;
      if (!uid || !user || (!isOwner && !isEmployee)) return;
      try {
        setLoadingCustomers(true);

        // Lade Kunden direkt aus der Backend-API
        const customersData = (await api.get(`/api/v1/customers?company_id=${uid}`)) as any[];
        const loadedCustomers: CustomerType[] = (customersData || []).map((data: any) => ({
          id: data.id,
          customerNumber: data.customerNumber || '',
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          street: data.street || '',
          city: data.city || '',
          postalCode: data.postalCode || '',
          country: data.country || '',
          taxNumber: data.taxNumber || '',
          vatId: data.vatId || '',
          vatValidated: data.vatValidated || false,
          isSupplier: data.isSupplier || false,
          totalInvoices: data.totalInvoices || 0,
          totalAmount: data.totalAmount || 0,
          createdAt: data.createdAt
            ? new Date(data.createdAt).toISOString()
            : new Date().toISOString(),
          contactPersons: data.contactPersons || [],
          companyId: uid,
        }));
        setCustomers(loadedCustomers);
      } catch (e) {
        console.error('Fehler beim Laden der Kunden:', e);
        toast.error('Fehler beim Laden der Kunden');
      } finally {
        setLoadingCustomers(false);
      }
    };
    loadCustomers();
  }, [uid, user]);

  // Prefill Customer aus Query-Parameter (z.B. von Kontakte-Seite)
  useEffect(() => {
    const loadPrefillCustomer = async () => {
      if (!prefillCustomerId || !uid) return;

      try {
        const data = (await api.get(
          `/api/v1/customers/${prefillCustomerId}?company_id=${uid}`,
        )) as any;

        if (data) {
          // Baue Adresse zusammen
          const addressParts: string[] = [];
          if (data.street) addressParts.push(data.street);
          if (data.postalCode || data.city) {
            addressParts.push(`${data.postalCode || ''} ${data.city || ''}`.trim());
          }
          if (data.country && data.country !== 'Deutschland') {
            addressParts.push(data.country);
          }

          setFormData(prev => ({
            ...prev,
            customerName: data.name || data.companyName || '',
            customerEmail: data.email || '',
            customerNumber: data.customerNumber || '',
            customerAddress: addressParts.join('\n'),
          }));

          toast.success(`Kunde "${data.name || data.companyName}" wurde geladen`);
        }
      } catch (error) {
        console.error('Fehler beim Laden des Kunden aus Query-Parameter:', error);
      }
    };

    loadPrefillCustomer();
  }, [prefillCustomerId, uid, setFormData]);

  // Firma laden (für Vorschau: Name, Adresse, Logo/Profilbild, Kontakt, Steuer/Bank)
  // Wichtig: settings als Dependency, damit Template-Daten automatisch aktualisiert werden
  useEffect(() => {
    const loadCompany = async () => {
      const isOwner = user?.uid === uid;
      const isEmployee = user?.user_type === 'mitarbeiter' && user?.company_id === uid;
      if (!uid || !user || (!isOwner && !isEmployee)) return;
      try {
        const companyData = (await api.get(`/api/v1/companies/${uid}`)) as any;
        if (companyData) {
          setCompany(companyData);

          // Prüfe Vollständigkeit der Unternehmensdaten für Banner
          const requiredFields = [
            companyData.companyName,
            companyData.companyStreet,
            companyData.companyCity,
            companyData.companyPostalCode,
            companyData.vatId ||
            companyData.taxNumber ||
            companyData.step3?.vatId ||
            companyData.step3?.taxNumber,
          ];

          const missingRequiredFields = requiredFields.some(field => !field?.trim());
          const missingOptionalFields =
            !companyData.email && !companyData.phoneNumber && !companyData.iban;

          // Zeige Banner wenn wichtige Felder fehlen
          if (missingRequiredFields || missingOptionalFields) {
            setShowCompanySettingsBanner(true);

            // Vorausfüllen der Formulardaten für das Modal
            setCompanySettingsFormData({
              companyOwner:
                companyData.firstName && companyData.lastName
                  ? `${companyData.firstName} ${companyData.lastName}`
                  : '',
              companyName: companyData.companyName || '',
              street: companyData.companyStreet || '',
              zip: companyData.companyPostalCode || '',
              city: companyData.companyCity || '',
              taxNumber: companyData.taxNumber || companyData.step3?.taxNumber || '',
              vatNumber: companyData.vatId || companyData.step3?.vatId || '',
              email: companyData.email || '',
              phone: companyData.phoneNumber || companyData.companyPhoneNumber || '',
              iban: companyData.iban || companyData.step4?.iban || '',
              bic: companyData.bic || companyData.step4?.bic || '',
              lodgingTaxRate:
                companyData.lodgingTaxRate != null
                  ? String(companyData.lodgingTaxRate)
                  : '',
            });
          }
        }
      } catch {
        // still render, but without company info
      }
    };
    loadCompany();
  }, [uid, user]); // settings als Dependency hinzugefügt für automatische Template-Updates

  // Nummernkreis-Einstellungen laden (ohne sofortige Nummer-Anzeige)
  useEffect(() => {
    const loadNumberingSettings = async () => {
      if (!uid) return;

      try {
        // 🚨 KRITISCHER FIX: Lade nur Format-Einstellungen, NICHT die nächste Nummer!
        // Die nächste Nummer wird erst beim Speichern atomisch generiert
        const result = (await api.get(`/api/v1/number-sequences?company_id=${uid}`)) as any[];
        const invoiceSequence = (result || []).find((seq: any) => seq.type === 'Rechnung');

        if (invoiceSequence) {
          setNumberingFormat(invoiceSequence.format || 'RE-{number}');
          setNextNumber(invoiceSequence.nextNumber || 1);

          // ✅ ZEIGE NUR PLATZHALTER an, NICHT die echte nächste Nummer!
          // Die echte Nummer wird erst beim Speichern vergeben
          setFormData(prev => ({
            ...prev,
            title: '', // Leer lassen - wird beim Speichern automatisch gesetzt
          }));
        } else {
          // Fallback für neue Companies ohne Nummerkreis
          setNumberingFormat('RE-{number}');
          setNextNumber(1);
          setFormData(prev => ({
            ...prev,
            title: '', // Leer lassen - wird beim Speichern automatisch gesetzt
          }));
        }
      } catch (error) {
        console.error('Fehler beim Laden der Nummernkreis-Einstellungen:', error);
        // Fallback
        setNumberingFormat('RE-{number}');
        setNextNumber(1);
        setFormData(prev => ({
          ...prev,
          title: '',
        }));
      }
    };

    loadNumberingSettings();
  }, [uid, setFormData, setNextNumber, setNumberingFormat]);

  // Steuerlogik aus der Auswahl ableiten (berücksichtigt Standard-Steuersatz aus Einstellungen)
  useEffect(() => {
    if (formData.taxRule === TaxRuleType.DE_TAXABLE) {
      const rate = settings?.defaultTaxRate ? parseInt(settings.defaultTaxRate, 10) : 19;
      setTaxRate(Number.isFinite(rate) ? rate : 19);
    } else {
      setTaxRate(0);
    }
  }, [formData.taxRule, settings?.defaultTaxRate]);

  // Template Auswahl & User Preferences laden
  useEffect(() => {
    if (!user?.uid) return;

    const loadUserTemplate = async () => {
      try {
        setLoadingTemplate(true);
        // Lade direkt die User Preferences
        const preferences = await UserPreferencesService.getUserPreferences(user.uid, uid);

        if (preferences.preferredInvoiceTemplate) {
          setSelectedTemplate(preferences.preferredInvoiceTemplate as ImportedInvoiceTemplate);
        } else {
          // Fallback auf Standard-Template wenn keine Präferenz gesetzt ist
          setSelectedTemplate(DEFAULT_INVOICE_TEMPLATE);
        }
      } catch {
        setSelectedTemplate(DEFAULT_INVOICE_TEMPLATE); // Fallback auf das Standard-Template
      } finally {
        setLoadingTemplate(false);
      }
    };

    loadUserTemplate();
  }, [user?.uid, uid]);

  // Textvorlagen laden
  useEffect(() => {
    const loadTextTemplates = async () => {
      if (!uid) return;

      try {
        setLoadingTemplates(true);
        const templates = await TextTemplateService.getTextTemplates(uid);
        setTextTemplates(templates);

        // Standard-Templates automatisch auswählen
        const headTemplate = templates.find(
          t => t.objectType === 'INVOICE' && t.textType === 'HEAD' && t.isDefault,
        );
        const footerTemplate = templates.find(
          t => t.objectType === 'INVOICE' && t.textType === 'FOOT' && t.isDefault,
        );

        if (headTemplate && !formData.headTextHtml) {
          setSelectedHeadTemplate(headTemplate.id);
          setFormData(prev => ({ ...prev, headTextHtml: headTemplate.text }));
        }

        if (footerTemplate && !formData.footerText) {
          setSelectedFooterTemplate(footerTemplate.id);
          setFormData(prev => ({ ...prev, footerText: footerTemplate.text }));
        }
      } catch (error) {
        console.error('Fehler beim Laden der Textvorlagen:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTextTemplates();
  }, [uid, formData.headTextHtml, formData.footerText, setFormData]);

  useEffect(() => {
    if (!settings) return;

    // Preisanzeige (Netto/Brutto)
    setShowNet(settings.priceInput !== 'brutto');

    // Steuerregel aus USt-Status ableiten
    setFormData(prev => {
      const next = { ...prev };
      if (settings.ust === 'kleinunternehmer') {
        // Für Kleinunternehmer: keine USt -> sinnvolle Default-Regelung
        next.taxRule = TaxRuleType.DE_EXEMPT_4_USTG;
      } else {
        // Standardfall: steuerpflichtig in DE
        next.taxRule = prev.taxRule || TaxRuleType.DE_TAXABLE;
      }

      // Zahlungsbedingungen vorbelegen (nur Basis-Text; Skonto wird separat gesteuert)
      if (!prev.paymentTerms && settings.defaultPaymentTerms) {
        const d = settings.defaultPaymentTerms;
        const baseText = d.text || `Zahlbar binnen ${d.days} Tagen ohne Abzug`;
        next.paymentTerms = baseText;
      }

      // Währung vorbelegen aus der Firmen-Default, solange noch keine gesetzt ist
      // (leerer Seed = "nicht gesetzt", kein EUR-Sentinel — Wurzel 4).
      if (!prev.currency && (company?.defaultCurrency as string)) {
        next.currency = company?.defaultCurrency as string;
      }

      return next;
    });
  }, [settings, company?.defaultCurrency, setFormData, setShowNet]);

  // Skonto-Defaults aus Einstellungen übernehmen (separat, damit Basis-Text nicht dupliziert wird)
  useEffect(() => {
    if (!settings?.defaultPaymentTerms) return;
    const d = settings.defaultPaymentTerms as Record<string, unknown>;
    // Skonto nur aktivieren, wenn gültige Daten vorhanden sind
    const shouldEnableSkonto =
      Boolean(d.skontoEnabled) && typeof d.skontoPercentage === 'number' && d.skontoPercentage > 0;
    setSkontoEnabled(shouldEnableSkonto);
    setSkontoDays(
      typeof d.skontoDays === 'number'
        ? d.skontoDays
        : typeof d.days === 'number'
          ? d.days
          : undefined,
    );
    setSkontoPercentage(typeof d.skontoPercentage === 'number' ? d.skontoPercentage : undefined);
    setSkontoText(typeof d.skontoText === 'string' ? d.skontoText : '');
  }, [settings?.defaultPaymentTerms, setSkontoDays, setSkontoEnabled, setSkontoPercentage, setSkontoText]);

  // E-Rechnung Einstellungen laden
  // Hinweis: bewusst zweiter, fast identischer Loader (siehe oben) — Race-Verhalten unverändert lassen
  useEffect(() => {
    const loadEInvoiceSettings = async () => {
      if (!uid) return;

      try {
        // Check if E-Rechnung settings exist in company document
        const companyDoc = (await api.get(`/api/v1/companies/${uid}`)) as any;

        if (companyDoc) {
          const einvoiceSettings = companyDoc.eInvoiceSettings;

          if (einvoiceSettings) {
            setEInvoiceSettings(einvoiceSettings);
            setEInvoiceEnabled(Boolean(einvoiceSettings.enableAutoGeneration));
          } else {
            setEInvoiceEnabled(false);
          }
        } else {
          setEInvoiceEnabled(false);
        }
      } catch {
        setEInvoiceEnabled(false);
      }
    };
    loadEInvoiceSettings();
  }, [uid, setEInvoiceEnabled, setEInvoiceSettings]);

  return {
    customers,
    setCustomers,
    company,
    setCompany,
    savedServices,
    loadingSavedServices,
    showCompanySettingsBanner,
    setShowCompanySettingsBanner,
    companySettingsFormData,
    setCompanySettingsFormData,
    taxRate,
    selectedTemplate,
  };
}
