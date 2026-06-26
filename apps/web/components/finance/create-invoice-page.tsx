'use client';

import { Icon } from '@iconify/react';
import {
  Button,
  Calendar,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tasko/ui';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Customer as CustomerType } from '@/components/finance/AddCustomerModal';
import FooterTextEditor from '@/components/finance/FooterTextEditor';
import {
  AVAILABLE_TEMPLATES,
  DEFAULT_INVOICE_TEMPLATE,
  type InvoiceTemplate as ImportedInvoiceTemplate,
} from '@/components/finance/InvoiceTemplates';
import { LivePreviewModal } from '@/components/finance/LivePreviewModal';
import { QuickAddService } from '@/components/QuickAddService';
import InventorySelector from '@/components/quotes/InventorySelector';

// ...
// State für Dienstleistungs-Modal innerhalb der Komponente anlegen!

import { COUNTRIES } from '@/constants/countries';
import { useNewAuth } from '@/contexts/NewAuthContext';
import { getAllCurrencies } from '@/data/currencies';
import { api } from '@/lib/api-client';
import { formatCurrency as formatCurrencyIntl } from '@/lib/currency';
import { cn } from '@/lib/utils';
import type { QuoteItem as InvoiceItem, QuoteItem } from '@/services/quoteService';
import type { CreateInvoiceFormData } from '@/types/formData';
import type { InvoiceData, InvoiceData as InvoiceType } from '@/types/invoiceTypes';
import { TaxRuleType } from '@/types/taxRules';
import type { TextTemplate } from '@/types/textTemplates';

// Helper-Typ für sicheren Zugriff auf verschachtelte Company-Daten
type CompanyStepData = Record<string, unknown>;

// Typ für Company-Dokument aus MongoDB (hat viele optionale Felder + step-basierte Onboarding-Daten)
type CompanyDocument = Record<string, unknown> & {
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
function getStepValue(
  obj: object | null | undefined,
  step: string,
  key: string,
): string | undefined {
  const objRecord = obj as Record<string, unknown> | null | undefined;
  const stepData = objRecord?.[step] as CompanyStepData | undefined;
  const value = stepData?.[key];
  return typeof value === 'string' ? value : undefined;
}

import InvoiceHeaderTextSection from '@/components/finance/InvoiceHeaderTextSection';
import { TaxRuleSelector } from '@/components/finance/TaxRuleSelector';
// Use ImportedInvoiceTemplate type from @/components/finance/InvoiceTemplates
import { UserPreferencesService } from '@/lib/userPreferences';
import { TextTemplateService } from '@/services/TextTemplateService';
import { replacePlaceholders as systemReplacePlaceholders } from '@/utils/placeholderSystem';
// Import der zentralen Platzhalter-Engine
import {
  replacePlaceholders as centralReplacePlaceholders,
  type PlaceholderContext,
} from '@/utils/placeholders';

type PreviewTemplateData = {
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

import NewCustomerModal from '@/components/finance/NewCustomerModal';
import { SendDocumentModal } from '@/components/finance/SendDocumentModal';
import NewProductModal, { type NewProductValues } from '@/components/inventory/NewProductModal';

import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useNextInvoiceNumber } from '@/hooks/useNextInvoiceNumber';
import { InventoryService } from '@/services/inventoryService';

export default function CreateQuotePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useNewAuth();
  // NextDays: kein [uid]-Routenparameter — Tenant kommt aus der Session (user.uid).
  // Fallback auf params.uid erhält Kompatibilität, falls doch als Param übergeben.
  const uid =
    (typeof params?.uid === 'string' ? params.uid : '') || user?.uid || '';
  const prefillCustomerId = searchParams?.get('customerId');
  const {
    nextNumber: nextInvoiceNumber,
    isLoading: nextNumberLoading,
    error: nextNumberError,
    refresh: _refreshNextNumber,
  } = useNextInvoiceNumber(uid);

  // 🔍 DEBUG: Hook-Status loggen
  React.useEffect(() => { }, []);

  const [selectedTemplate, setSelectedTemplate] =
    useState<ImportedInvoiceTemplate>(DEFAULT_INVOICE_TEMPLATE);

  const [showLivePreview, setShowLivePreview] = useState(false);
  const [_loadingTemplate, setLoadingTemplate] = useState(false);

  const _renderProductsCard = () => (
    <Card>
      <CardHeader>
        <CardTitle>
          <Icon icon="lucide:calculator" className="mr-2 h-5 w-5 text-accent" />
          Produkte
        </CardTitle>
      </CardHeader>
      <CardContent>
        <QuickAddService
          companyId={uid}
          onServiceAdded={service => {
            setItems(prev => [...prev, service]);
            toast.success('Dienstleistung wurde zur Rechnung hinzugefügt');
          }}
        />

        {/* Rest des Card Contents */}
        <div className="mb-3 flex items-center justify-between">
          {/* ... existierender Content ... */}
        </div>
      </CardContent>
    </Card>
  );

  interface InvoiceService {
    id: string;
    name: string;
    description?: string;
    price: number | string;
    unit: string;
    source: 'inlineInvoiceServices';
  }

  // Hilfsfunktion zur Preiskonvertierung
  const _parsePrice = (price: number | string): number => {
    if (typeof price === 'number') return price;
    return parseFloat(price) || 0;
  };

  // Erweiterte States für Dienstleistungen
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [existingServices, setExistingServices] = useState<InvoiceService[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [showPopover, setShowPopover] = useState(false);
  const [loadingSavedServices, setLoadingSavedServices] = useState(false);
  const [savedServices, setSavedServices] = useState<InvoiceService[]>([]);
  const [serviceDraft, setServiceDraft] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'Stk',
  });
  const [savingService, setSavingService] = useState(false);

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
        setExistingServices(inlineInvoiceServices);
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
  // ComboBox für Dienstleistungsauswahl
  const _ServiceSelector = () => (
    <div className="ml-2 flex items-center gap-2 border-gray-200 border-l pl-4">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              'min-w-70 justify-between border-input',
              'hover:bg-accent hover:text-accent-foreground',
              'focus:ring-2 focus:ring-accent focus:ring-offset-2',
              selectedService && 'border-accent text-accent',
            )}
          >
            {selectedService
              ? existingServices.find(service => service.name === selectedService)?.name
              : 'Dienstleistung auswählen oder neu erstellen...'}
            <Icon icon="lucide:chevrons-up-down" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-70 p-0">
          <Command>
            <CommandInput
              placeholder="Dienstleistung suchen..."
              className="border-none focus:ring-0 focus-visible:ring-0"
            />

            <CommandEmpty>
              <div className="p-4 text-center text-sm">
                <p className="mb-2 text-muted-foreground">Keine Dienstleistung gefunden.</p>
                <Button
                  variant="ghost"
                  className="mt-2 w-full text-accent"
                  onClick={() => {
                    setServiceDraft(prev => ({ ...prev, name: '' }));
                    setServiceModalOpen(true);
                  }}
                >
                  <Icon icon="lucide:plus" className="mr-2 h-4 w-4" />
                  Neue Dienstleistung erstellen
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {existingServices.map(service => (
                <CommandItem
                  key={service.id}
                  onSelect={() => {
                    setSelectedService(service.name);
                    setServiceDraft({
                      name: service.name,
                      description: service.description || '',
                      price: service.price?.toString() || '',
                      unit: service.unit || 'Stk',
                    });
                  }}
                  className="text-sm hover:bg-accent/10 aria-selected:bg-accent/10"
                >
                  <Icon
                    icon="lucide:check"
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedService === service.name ? 'text-accent opacity-100' : 'opacity-0',
                    )}
                  />

                  {service.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedService ? (
        <Button
          className="bg-accent text-white hover:bg-accent/90"
          onClick={saveServiceToSubcollection}
          disabled={savingService}
        >
          {savingService ? <>Speichert...</> : <>Dienstleistung übernehmen</>}
        </Button>
      ) : (
        <Button
          variant="outline"
          className="border-accent text-accent hover:bg-accent hover:text-white"
          onClick={() => {
            setServiceDraft(prev => ({ ...prev, name: '' }));
            setServiceModalOpen(true);
          }}
        >
          <Icon icon="lucide:plus" className="mr-2 h-4 w-4" />
          Neu
        </Button>
      )}
    </div>
  );

  // Dienstleistung in Subcollection speichern
  const saveServiceToSubcollection = async () => {
    toast('SERVICE SAVE TRIGGERED (UI)', {
      description: 'Die Save-Funktion wurde im Client aufgerufen.',
    });

    if (!uid || !serviceDraft.name.trim()) {
      console.warn('[Dienstleistung speichern] Abbruch: UID oder Name fehlt', {
        uid,
        name: serviceDraft.name,
      });
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
  // States für Quick-Add Service Funktion
  const [quickServiceName, setQuickServiceName] = useState('');
  const [quickServicePrice, setQuickServicePrice] = useState('');
  const [_savingQuickService, setSavingQuickService] = useState(false);

  // Quick-Add Service Handler
  const _handleQuickAddService = async () => {
    if (!uid || !quickServiceName.trim()) {
      toast.error('Bitte geben Sie einen Namen für die Dienstleistung ein');
      return;
    }

    setSavingQuickService(true);
    try {
      // 1. In inlineInvoiceServices speichern
      const serviceData = {
        name: quickServiceName.trim(),
        description: '',
        price: parseFloat(quickServicePrice) || 0,
        unit: 'Std',
      };

      const result = (await api.post(
        `/api/v1/inline-invoice-services?company_id=${uid}`,
        serviceData,
      )) as any;

      // 2. Direkt zur Rechnung hinzufügen
      const newItem = {
        id: crypto.randomUUID(),
        description: serviceData.name,
        quantity: 1,
        unitPrice: serviceData.price,
        unit: serviceData.unit,
        total: serviceData.price,
        category: 'Dienstleistung',
        inventoryItemId: result?.id,
      };

      setItems(prev => [...prev, newItem]);

      // 3. UI zurücksetzen
      setQuickServiceName('');
      setQuickServicePrice('');
      toast.success('Dienstleistung gespeichert und zur Rechnung hinzugefügt');
    } catch (e) {
      console.error('Fehler beim Quick-Add Service:', e);
      toast.error('Fehler beim Speichern der Dienstleistung');
    } finally {
      setSavingQuickService(false);
    }
  };

  // State für neue Dienstleistung (Service)
  const [newServiceName, setNewServiceName] = useState<string>('');
  const { settings } = useCompanySettings(uid);

  // UI state
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerType[]>([]);
  const [_loadingCustomers, setLoadingCustomers] = useState(false);
  const [showNet, setShowNet] = useState(true);
  const [taxRate, setTaxRate] = useState(19);
  const [showDetailedOptions, setShowDetailedOptions] = useState(false);
  const [paymentDays, setPaymentDays] = useState(14); // Standard 14 Tage
  const [company, setCompany] = useState<CompanyDocument | null>(null);
  // E-Mail Versand UI (für zukünftige Verwendung)
  const [emailCardOpen, _setEmailCardOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Produkt-anlegen Prompt/Modal State
  const [dismissedCreatePromptIds, setDismissedCreatePromptIds] = useState<Set<string>>(new Set());
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [createProductForIndex, setCreateProductForIndex] = useState<number | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProductValues>({
    name: '',
    imageUrl: '',
    sku: '',
    category: 'Artikel',
    unit: 'Stk',
    stock: 0,
    taxRate: 19,
    purchaseNet: 0,
    purchaseGross: 0,
    sellingNet: 0,
    sellingGross: 0,
    description: '',
    internalNote: '',
  });

  // Kunden-anlegen Modal State
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [creatingCustomer, _setCreatingCustomer] = useState(false);
  const [showCustomerSearchPopup, setShowCustomerSearchPopup] = useState(false);

  // Kontakttyp State (neu für SevDesk-Style Interface)
  const [contactType, setContactType] = useState<'organisation' | 'person'>('organisation');

  // Adresszusatz State
  const [showAddressAddition, setShowAddressAddition] = useState(false);

  // Lieferdatum State (Einzeldatum vs. Zeitraum)
  const [deliveryDateType, setDeliveryDateType] = useState<'single' | 'range'>('single');
  const [deliveryDateRange, setDeliveryDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [deliveryDatePopoverOpen, setDeliveryDatePopoverOpen] = useState(false);

  // Textvorlagen State
  const [_textTemplates, setTextTemplates] = useState<TextTemplate[]>([]);
  const [_loadingTemplates, setLoadingTemplates] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [_selectedHeadTemplate, setSelectedHeadTemplate] = useState<string>('');
  const [_selectedFooterTemplate, setSelectedFooterTemplate] = useState<string>('');

  // Nummernkreis Modal State
  const [showNumberingModal, setShowNumberingModal] = useState(false);
  const [numberingFormat, setNumberingFormat] = useState('RE-%NUMBER');
  const [nextNumber, setNextNumber] = useState(1000);

  // E-Rechnung State
  const [eInvoiceEnabled, setEInvoiceEnabled] = useState(false);
  const [showCompliancePanel, setShowCompliancePanel] = useState(false);
  const [complianceErrors, setComplianceErrors] = useState<string[]>([]);
  const [eInvoiceSettings, setEInvoiceSettings] = useState<Record<string, unknown> | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  // Company Settings Banner State
  const [showCompanySettingsBanner, setShowCompanySettingsBanner] = useState(false);
  const [showCompanySettingsModal, setShowCompanySettingsModal] = useState(false);
  const [showSendDocumentModal, setShowSendDocumentModal] = useState(false);
  const [createdDocument, setCreatedDocument] = useState<InvoiceType | null>(null);
  const [companySettingsFormData, setCompanySettingsFormData] = useState({
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
  });

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

  const setShowNewCustomerModal = (show: boolean) => {
    setCreateCustomerOpen(show);
  };

  // Handle preview settings update
  const _handlePreviewSettingsUpdate = (_settings: Record<string, unknown>) => { };

  // Nummernkreis Vorschau generieren
  const generateNumberPreview = (format: string, number: number): string => {
    const now = new Date();
    return format
      .replace('%NUMBER', number.toString())
      .replace('%YYYY', now.getFullYear().toString())
      .replace('%YY', now.getFullYear().toString().slice(-2))
      .replace('%MM', (now.getMonth() + 1).toString().padStart(2, '0'))
      .replace('%M', (now.getMonth() + 1).toString())
      .replace('%DD', now.getDate().toString().padStart(2, '0'))
      .replace('%D', now.getDate().toString());
  };

  // Sync Preisfelder Netto/Brutto
  const syncGrossFromNet = (net: number, rate: number) =>
    Number.isFinite(net) ? net * (1 + Math.max(0, rate) / 100) : 0;
  const _syncNetFromGross = (gross: number, rate: number) =>
    Number.isFinite(gross) ? gross / (1 + Math.max(0, rate) / 100) : 0;

  // Popover-Open-Status pro Zeile und Debounce-Timer pro Item
  const itemsRef = useRef<InvoiceItem[]>([]);
  const [popoverOpenIds, setPopoverOpenIds] = useState<Set<string>>(new Set());
  const popoverTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Debounced onChange für Beschreibung
  const handleDescriptionChange = (index: number, id: string, value: string) => {
    handleItemChange(index, 'description', value);
    const timers = popoverTimersRef.current;
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      const list = itemsRef.current;
      const current = list.find(i => i.id === id);
      const shouldOpen =
        Boolean(current) &&
        current?.category !== 'discount' &&
        Boolean((current?.description || '').trim()) &&
        !current?.inventoryItemId &&
        !dismissedCreatePromptIds.has(id) &&
        !createProductOpen;
      setPopoverOpenIds(prev => {
        const next = new Set(prev);
        if (shouldOpen) next.add(id);
        else next.delete(id);
        return next;
      });

      // Auto-Mapping aus Inventar: Wenn Beschreibung wie Name oder SKU passt, Produktdaten übernehmen
      (async () => {
        try {
          const row = itemsRef.current.find(i => i.id === id);
          if (!row || row.inventoryItemId) return;
          const term = (row.description || '').trim();
          if (!term || term.length < 2) return;
          const results = await InventoryService.findInventoryItems(uid, term);
          if (!results || results.length === 0) return;
          const lower = term.toLowerCase();
          const exactSku = results.find(r => (r.sku || '').toLowerCase() === lower);
          const exactName = results.find(r => (r.name || '').toLowerCase() === lower);
          const match = exactSku || exactName || (results.length === 1 ? results[0] : undefined);
          if (!match) return;
          setItems(prev =>
            prev.map((it, i) => {
              if (i !== index) return it;
              const unitPriceNet = Number(match.sellingPrice) || 0;
              const qty = Number.isFinite(it.quantity) ? it.quantity : 1;
              return {
                ...it,
                description: match.name || it.description,
                unit: match.unit || 'Stk',
                unitPrice: unitPriceNet,
                total: computeItemTotalNet(qty, unitPriceNet),
                inventoryItemId: match.id,
              };
            }),
          );
          setPopoverOpenIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        } catch {
          // ignoriere Fehler in der Auto-Suche
        }
      })();
    }, 2000); // 2 Sekunden Delay - weniger aufdringlich
    timers.set(id, t);
  };

  // Konsistenz: Wenn Items/Modal/“dismissed” sich ändern, Popover neu bewerten
  useEffect(() => {
    setPopoverOpenIds(prev => {
      const next = new Set(prev);
      const list = itemsRef.current;
      for (const id of Array.from(prev)) {
        const current = list.find(i => i.id === id);
        const shouldOpen =
          Boolean(current) &&
          current?.category !== 'discount' &&
          Boolean((current?.description || '').trim()) &&
          !current?.inventoryItemId &&
          !dismissedCreatePromptIds.has(id) &&
          !createProductOpen;
        if (!shouldOpen) next.delete(id);
      }
      return next;
    });
  }, [dismissedCreatePromptIds, createProductOpen]);

  // Cleanup: ausstehende Timer beim Unmount löschen
  useEffect(() => {
    const timers = popoverTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  // Kein automatisches Modal mehr – wir nutzen einen kleinen Popover unter dem Feld

  // Skonto-UI-State
  const [skontoEnabled, setSkontoEnabled] = useState<boolean>(false);
  const [skontoDays, setSkontoDays] = useState<number | undefined>(undefined);
  const [skontoPercentage, setSkontoPercentage] = useState<number | undefined>(undefined);
  const [skontoText, setSkontoText] = useState<string>('');

  // Lade E-Invoice Settings aus Company
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
  }, [uid]);

  // Form state
  const [formData, setFormData] = useState<CreateInvoiceFormData>({
    customerName: '',
    customerFirstName: '',
    customerLastName: '',
    customerNumber: '',
    customerEmail: '',
    customerAddress: '',
    title: '',
    customerOrderNumber: '',
    validUntil: (() => {
      // Berechne Fälligkeitsdatum (heute + 14 Tage)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      return dueDate.toISOString().split('T')[0];
    })(),
    invoiceDate: new Date().toISOString().split('T')[0],
    deliveryDate: new Date().toISOString().split('T')[0],
    servicePeriod: '', // Lieferzeitraum/Leistungszeitraum
    headTextHtml: '[%VOLLEANREDE%],\n\n[%INVOICE_INTRO_TEXT%]',
    footerText:
      'Wir bitten Sie, den Rechnungsbetrag von [%GESAMTBETRAG%] unter Angabe der Rechnungsnummer [%RECHNUNGSNUMMER%] auf das unten angegebene Konto zu überweisen. Zahlungsziel: [%ZAHLUNGSZIEL%] Rechnungsdatum: [%RECHNUNGSDATUM%] Vielen Dank für Ihr Vertrauen und die angenehme Zusammenarbeit!<br>Mit freundlichen Grüßen<br>[%KONTAKTPERSON%]',
    notes: '',
    currency: 'EUR',
    internalContactPerson: '',
    deliveryTerms: '',
    paymentTerms: 'Zahlbar binnen 14 Tagen ohne Abzug',
    taxRule: TaxRuleType.DE_TAXABLE,
    // Skonto-Felder
    skontoEnabled: false,
    skontoDays: 0,
    skontoPercentage: 0,
    skontoText: '',
  });

  // Items (Netto im State)
  const [items, setItems] = useState<QuoteItem[]>([
    {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      description: 'Leistung',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    },
  ]);
  const [_showDetailsForItem, _setShowDetailsForItem] = useState<Set<string>>(new Set());

  // Halte itemsRef synchron, damit Debounce/Popover-Logik nicht vor Deklaration auf items zugreift
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Bei jeder Items-Änderung Popover-Entscheidungen neu evaluieren
  useEffect(() => {
    setPopoverOpenIds(prev => {
      const next = new Set(prev);
      for (const id of Array.from(prev)) {
        const current = items.find(i => i.id === id);
        const shouldOpen =
          Boolean(current) &&
          current?.category !== 'discount' &&
          Boolean((current?.description || '').trim()) &&
          !current?.inventoryItemId &&
          !dismissedCreatePromptIds.has(id) &&
          !createProductOpen;
        if (!shouldOpen) next.delete(id);
      }
      return next;
    });
  }, [items, dismissedCreatePromptIds, createProductOpen]);

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
  }, [prefillCustomerId, uid]);

  // Popup schließen beim Klicken außerhalb
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCustomerSearchPopup) {
        const target = event.target as Element;
        if (!target.closest('.customer-search-container')) {
          setShowCustomerSearchPopup(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomerSearchPopup]);

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
  }, [uid]);

  // Steuerlogik aus der Auswahl ableiten (berücksichtigt Standard-Steuersatz aus Einstellungen)
  useEffect(() => {
    if (formData.taxRule === TaxRuleType.DE_TAXABLE) {
      const rate = settings?.defaultTaxRate ? parseInt(settings.defaultTaxRate, 10) : 19;
      setTaxRate(Number.isFinite(rate) ? rate : 19);
    } else {
      setTaxRate(0);
    }
  }, [formData.taxRule, settings?.defaultTaxRate]);

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
      } catch (error) {
        console.warn('Fehler beim Laden der Template-Preferences:', error);
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
  }, [uid, formData.headTextHtml, formData.footerText]);

  // Template-Komponente dynamisch rendern (für zukünftige Verwendung)
  const _renderTemplateComponent = (templateId: ImportedInvoiceTemplate) => {
    const template = AVAILABLE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      return template.component;
    }
    console.warn('Unbekannte Template-ID:', templateId, 'Verwende Standard Template als Fallback');
    return null; // Template System wird über AVAILABLE_TEMPLATES verwaltet
  };
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

      // Währung vorbelegen (falls vorhanden und noch nicht bewusst geändert)
      if (prev.currency === 'EUR' && (company?.defaultCurrency as string)) {
        next.currency = company?.defaultCurrency as string;
      }

      return next;
    });
  }, [settings, company?.defaultCurrency]);

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
  }, [settings?.defaultPaymentTerms]);

  // E-Rechnung Einstellungen laden
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
  }, [uid]);

  // Währungen: alle ISO-4217 Codes mit lokalisierten Namen
  const allCurrencies = React.useMemo(() => getAllCurrencies('de-DE'), []);

  // Quick-Add Service Komponente
  const QuickAddServiceSection = () => (
    <div className="mb-4 border-b pb-4">
      <QuickAddService
        companyId={uid}
        onServiceAdded={service => {
          setItems(prev => [...prev, service]);
          toast.success('Dienstleistung wurde zur Rechnung hinzugefügt');
        }}
      />
    </div>
  );

  // CardContent rendern (für zukünftige Verwendung)
  const _renderCardContent = () => (
    <div data-slot="card-content" className="px-6">
      <QuickAddServiceSection />
      {/* Rest des Card Contents */}
      <div className="mb-3 flex items-center justify-between">
        {/* ... existierender Content ... */}
      </div>
    </div>
  );

  // Einheiten-Auswahl (analog zur gewünschten Liste)
  const UNIT_OPTIONS = React.useMemo(
    () => [
      { label: 'Stk', value: 'Stk' },
      { label: 'pauschal', value: 'pauschal' },
      { label: 'Std', value: 'Std' },
      { label: '%', value: '%' },
      { label: 'Tag(e)', value: 'Tag(e)' },
      // Hinweis: SelectItem darf keinen leeren value haben – 'none' dient als Platzhalter und wird auf '' gemappt
      { label: '—', value: 'none' },
      { label: 'm²', value: 'm²' },
      { label: 'm', value: 'm' },
      { label: 'kg', value: 'kg' },
      { label: 't', value: 't' },
      { label: 'lfm', value: 'lfm' },
      { label: 'm³', value: 'm³' },
      { label: 'km', value: 'km' },
      { label: 'L', value: 'L' },
    ],

    [],
  );

  // Currency-Formatter (Währung aus den Formulardaten, kein €-Hardcode)
  const formatCurrency = (amount: number) => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    try {
      return formatCurrencyIntl(safeAmount, formData.currency);
    } catch {
      return `${safeAmount.toFixed(2)} ${formData.currency}`;
    }
  };

  // Datum als dd.mm.yyyy formatieren
  const formatDateDE = (d: Date | string | undefined): string => {
    if (!d) return '';
    try {
      const dateObj = typeof d === 'string' ? new Date(d) : d;
      if (Number.isNaN(dateObj.getTime())) return '';
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = String(dateObj.getFullYear());
      return `${dd}.${mm}.${yyyy}`;
    } catch {
      return '';
    }
  };

  // Datum-Hilfsfunktionen für erweiterte Platzhalter (für zukünftige Verwendung)
  const _getISOWeek = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  const _getMonthName = (monthIndex: number): string => {
    const adjustedMonth = ((monthIndex % 12) + 12) % 12; // Handle negative values
    const date = new Date(2000, adjustedMonth, 1);
    return date.toLocaleDateString('de-DE', { month: 'long' });
  };

  const _getMonthNameShort = (monthIndex: number): string => {
    const adjustedMonth = ((monthIndex % 12) + 12) % 12;
    const date = new Date(2000, adjustedMonth, 1);
    return date.toLocaleDateString('de-DE', { month: 'short' });
  };

  const _getMonthNumber = (monthIndex: number): string => {
    const adjustedMonth = ((monthIndex % 12) + 12) % 12;
    return (adjustedMonth + 1).toString().padStart(2, '0');
  };

  const _getNextQuarter = (): number => {
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
    return currentQuarter === 4 ? 1 : currentQuarter + 1;
  };

  const _getPreviousQuarter = (): number => {
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
    return currentQuarter === 1 ? 4 : currentQuarter - 1;
  };

  const _getYesterday = (): Date => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  };

  const _getDaysInCurrentMonth = (): number => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  };

  // Platzhalter-Ersetzung für Textvorlagen - NEUE ZENTRALE ENGINE
  const _replacePlaceholders = (text: string, data: PreviewTemplateData): string => {
    if (!text) return '';

    // Erstelle Kontext für die zentrale Engine
    const context: PlaceholderContext = {
      type: 'invoice',
      company: {
        companyName: data.companyName || '',
        name: data.companyName || '',
        email: data.companyEmail || '',
        phone: data.companyPhone || '',
        website: data.companyWebsite || '',
        vatId: data.companyVatId || '',
        taxNumber: data.companyTaxNumber || '',
        // Strukturierte Adresse wenn verfügbar
        street: data.companyAddress?.split('\n')[0] || '',
        postalCode: data.companyAddress?.split('\n')[1]?.split(' ')[0] || '',
        city: data.companyAddress?.split('\n')[1]?.split(' ').slice(1).join(' ') || '',
        country: data.companyAddress?.split('\n')[2] || '',
        // Bankdaten
        bankDetails: data.bankDetails
          ? {
            iban: data.bankDetails.iban || '',
            bic: data.bankDetails.bic || '',
            bankName: data.bankDetails.bankName || '',
            accountHolder: data.bankDetails.accountHolder || '',
          }
          : undefined,
      },
      selectedCustomer: {
        companyName: data.customerName || '',
        email: data.customerEmail || '',
        phone: data.customerPhone || '',
        street: (data.customerAddress?.split('\n')[0] || '').replace(/\s+/g, ' ').trim(),
        postalCode: data.customerAddress?.split('\n')[1]?.split(' ')[0] || '',
        city: data.customerAddress?.split('\n')[1]?.split(' ').slice(1).join(' ') || '',
        country: data.customerAddress?.split('\n')[2] || '',
      },
      invoice: {
        invoiceNumber: data.invoiceNumber || '',
        invoiceDate: data.date || '',
        dueDate: data.validUntil || '',
        deliveryDate: data.deliveryDate || '',
        serviceDate: data.deliveryDate || '',
        netAmount: data.subtotal || 0,
        taxAmount: data.tax || 0,
        totalAmount: data.total || 0,
        currency: data.currency || 'EUR',
        taxRate: data.vatRate || 0,
        paymentTerms: parseInt(data.paymentTerms || '14', 10),
        notes: data.notes || '',
        reference: data.reference || '',
        title: data.title || '',
      },
      contactPerson: {
        name:
          data.internalContactPerson ||
          (company?.contactPerson?.name || '') ||
          [company?.firstName, company?.lastName].filter(Boolean).join(' ') ||
          '',
      },
    };

    // Spezial: Kontaktperson ODER Firmenname am Ende
    let result = centralReplacePlaceholders(text, context);
    if (result.includes('[%KONTAKTPERSON]')) {
      const kontakt = (context.contactPerson?.name as string | undefined)?.trim();
      const fallbackFirma =
        (context.company?.companyName as string | undefined)?.trim() || (context.company?.name as string | undefined)?.trim() || '';
      const value = kontakt ? kontakt : fallbackFirma;
      result = result.replace(/\[%KONTAKTPERSON_ODER_FIRMENNAME%\]/g, value);
    }

    // Debug: Platzhalter-Ersetzung validieren

    return result;
  };

  // Vorschau-Daten für das Template zusammenbauen
  const buildPreviewData = (): PreviewTemplateData => {
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

      // DEBUG: Customer-Daten loggen

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
      currency:
        formData.currency ||
        (company?.defaultCurrency as string) ||
        settings?.defaultCurrency ||
        'EUR',
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

    // DEBUG: Tax Rule Ausgabe

    // DEBUG: CompanyId und Customer-Daten

    return data;
  };

  // Convert current form data for LivePreviewModal (SAME AS SendDocumentModal!)
  const buildInvoiceDataForPreview = (): InvoiceData => {
    // ✅ NUTZT EXAKT DIE GLEICHEN DATEN WIE SendDocumentModal!
    const previewData = buildPreviewData();
    return {
      ...previewData,
      companyId: uid, // Explizit die companyId hinzufügen
    } as unknown as InvoiceData;
  };

  // Platzhalter in Textvorlagen ersetzen (für zukünftige Verwendung)
  const _getProcessedPreviewData = (): PreviewTemplateData => {
    const data = buildPreviewData();

    // Platzhalter in Kopf- und Fußtext ersetzen mit Sprach-Unterstützung
    // Deutsch als Standard, da das ein deutsches System ist
    const processedData = {
      ...data,
      headTextHtml: data.headTextHtml
        ? systemReplacePlaceholders(data.headTextHtml, data, 'de')
        : undefined,
      footerText: data.footerText
        ? systemReplacePlaceholders(data.footerText, data, 'de')
        : undefined,
    };

    return processedData;
  };

  // E-Mail Defaults setzen, wenn das E-Mail-Card geöffnet wird
  useEffect(() => {
    if (!emailCardOpen) return;
    const data = buildPreviewData();
    if (!emailSubject) {
      setEmailSubject(`Angebot ${data.companyName}${data.title ? ` – ${data.title}` : ''}`);
    }
    if (!emailBody) {
      setEmailBody(
        `Hallo ${data.customerName || ''},\n\n` +
        `anbei erhalten Sie unser Angebot${data.title ? ` zu: ${data.title}` : ''}.` +
        `\n\nGesamtbetrag: ${formatCurrency(data.total)}\nGültig bis: ${data.validUntil}` +
        `\n\nBei Fragen melden Sie sich gerne.` +
        `\n\nBeste Grüße\n${data.companyName}`,
      );
    }
    if (!emailTo && formData.customerEmail) setEmailTo(formData.customerEmail);
  }, [
    emailCardOpen,
    buildPreviewData,
    emailBody,
    emailSubject,
    emailTo,
    formData.customerEmail,
    formatCurrency,
  ]);

  // Browser-Druck (deaktiviert)
  const _printInBrowser = () => {
    toast.message('Browser-Druck wurde deaktiviert.');
  };

  // Guard
  const isOwner = user?.uid === uid;
  const isEmployee = user?.user_type === 'mitarbeiter' && user?.company_id === uid;

  if (!user || (!isOwner && !isEmployee)) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 font-semibold text-gray-900 text-xl">Zugriff verweigert</h2>
          <p className="text-gray-600">Sie sind nicht berechtigt, diese Seite zu sehen.</p>
        </div>
      </div>
    );
  }

  // Helpers
  const computeItemTotalNet = (qty: number, unitNet: number) => {
    const q = Number.isFinite(qty) ? Math.max(0, qty) : 0;
    const p = Number.isFinite(unitNet) ? Math.max(0, unitNet) : 0;
    return q * p;
  };

  // Totals (Rabatt-Positionen abziehen)
  const subtotal = items.reduce((sum, it) => {
    const t = it.total || 0;
    if (it.category === 'discount') {
      return sum + -Math.abs(t);
    }
    const factor = 1 - Math.max(0, Math.min(100, it.discountPercent || 0)) / 100;
    return sum + t * factor;
  }, 0);
  const vat = subtotal * (taxRate / 100);
  const grandTotal = subtotal + vat;

  // SevDesk-style tax grouping: Group items by tax rate for multi-tax invoices
  const taxGroups: { [rate: number]: { netAmount: number; taxAmount: number } } = {};

  items.forEach(item => {
    if (item.category === 'discount') return; // Skip discount items

    const itemTaxRate = item.taxRate || taxRate;
    const t = item.total || 0;
    const factor = 1 - Math.max(0, Math.min(100, item.discountPercent || 0)) / 100;
    const netAmount = t * factor;
    const itemTaxAmount = netAmount * (itemTaxRate / 100);

    if (!taxGroups[itemTaxRate]) {
      taxGroups[itemTaxRate] = { netAmount: 0, taxAmount: 0 };
    }

    taxGroups[itemTaxRate].netAmount += netAmount;
    taxGroups[itemTaxRate].taxAmount += itemTaxAmount;
  });

  // Convert to array format like SevDesk
  const taxGrouped = Object.entries(taxGroups)
    .map(([rate, amounts]) => ({
      rate: Number(rate),
      netAmount: Math.round(amounts.netAmount * 100) / 100,
      taxAmount: Math.round(amounts.taxAmount * 100) / 100,
    }))
    .sort((a, b) => b.rate - a.rate); // Sort descending (19%, 7%, 0%)

  // Handlers
  const _handleCustomerSelect = (customerName: string) => {
    const customer = customers.find(c => c.name === customerName);
    if (!customer) return;
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      customerNumber: customer.customerNumber || '',
      customerEmail: customer.email || '',
      customerAddress:
        customer.street && customer.city
          ? `${customer.street}\n${customer.postalCode || ''} ${customer.city}\n${customer.country || 'Deutschland'}`
          : prev.customerAddress,
    }));
  };

  const _addItem = () => {
    const newItem: QuoteItem = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      unit: 'Stk',
      discountPercent: 0,
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (index: number) => {
    setItems(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

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

    // Calculate totals for preview
    const subtotal = items.reduce((sum, it) => {
      const t = it.total || 0;
      if (it.category === 'discount') {
        return sum + -Math.abs(t);
      }
      const factor = 1 - Math.max(0, Math.min(100, it.discountPercent || 0)) / 100;
      return sum + t * factor;
    }, 0);
    const vat = subtotal * (taxRate / 100);
    const grandTotal = subtotal + vat;
    const _totalNet = subtotal;

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

      // � KRITISCHER FIX: Generiere Rechnungsnummer DYNAMISCH beim Speichern!
      // Verhindert Race Conditions bei gleichzeitiger Rechnungserstellung

      let finalInvoiceNumber = '';
      let finalSequentialNumber = 1;

      try {
        const numberResult = (await api.post(`/api/v1/number-sequences/next?company_id=${uid}`, {
          type: 'Rechnung',
        })) as any;
        finalInvoiceNumber =
          numberResult?.formattedNumber || `RE-${Date.now().toString().slice(-4)}`;
        finalSequentialNumber = numberResult?.sequentialNumber || 1;
      } catch (numberError) {
        console.error('❌ Fehler bei Rechnungsnummer-Generierung:', {
          error: numberError,
          errorMessage: numberError instanceof Error ? numberError.message : 'Unknown error',
          errorStack: numberError instanceof Error ? numberError.stack : undefined,
          uid,
        });
        // Fallback nur im Notfall
        finalInvoiceNumber = `RE-${Date.now().toString().slice(-4)}`;
        finalSequentialNumber = Date.now() % 1000;
      }

      // �🚨 COMPLETE INVOICE DATA OBJECT - **EVERY SINGLE FIELD** FROM THE FORM!
      // This object must contain ALL form fields to ensure complete data persistence
      const invoiceData = {
        // Basic Invoice Info - ID will be assigned by the API
        id: '', // Assigned by the API after creation
        companyId: uid,
        invoiceNumber: finalInvoiceNumber, // ✅ Atomisch generierte Nummer
        number: finalInvoiceNumber, // ✅ Atomisch generierte Nummer
        sequentialNumber: finalSequentialNumber, // ✅ Korrekte sequentielle Nummer
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
            taxRate: item.taxRate || taxRate,
            unit: item.unit || 'Stk',
            category: item.category || 'Artikel',
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
        language: 'de',

        // Additional Control Fields
        isStorno: false,
        isRecurring: false,

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
        console.warn('⚠️ Service usage tracking failed (non-critical):', trackingError);
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
      toast.error('Rechnung konnte nicht gespeichert werden');
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

  return (
    <>
      {/* ✅ Preload html2pdf.js global - wird sofort beim Seitenaufruf geladen */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
        strategy="afterInteractive"
        onLoad={() => { }}
        onError={e => {
          console.error('❌ Fehler beim Laden von html2pdf.js via Next.js Script:', e);
        }}
      />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header - SevDesk Style */}
        <header className="w-full" style={{ maxWidth: '1440px' }}>
          <div className="flex items-center justify-between border-gray-200 border-b py-4">
            {/* Left side - Title */}
            <div className="flex items-center">
              <div>
                <h2 className="font-bold text-2xl text-gray-900">Neue Rechnung</h2>
              </div>
            </div>

            {/* Right side - Controls and Actions */}
            <div className="flex items-center gap-4">
              {/* E-Rechnung Toggle */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={eInvoiceEnabled}
                    onCheckedChange={handleEInvoiceToggle}
                    style={{
                      backgroundColor: eInvoiceEnabled ? 'var(--accent)' : undefined,
                    }}
                    className=""
                  />

                  <span className="font-medium text-gray-700 text-sm">E-Rechnung</span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-300"></div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                >
                  {loading ? (
                    <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icon icon="lucide:save" className="mr-2 h-4 w-4" />
                  )}
                  Als Entwurf speichern
                </Button>

                <Button
                  variant="outline"
                  size="default"
                  onClick={() => setShowLivePreview(true)}
                  className="border-accent text-accent hover:bg-accent hover:text-white"
                >
                  <Icon icon="lucide:eye" className="mr-2 h-4 w-4" />
                  Live-Vorschau
                </Button>

                <Button
                  className="bg-accent text-white hover:bg-accent/90"
                  size="default"
                  onClick={handleOpenSendModal}
                  disabled={loading}
                >
                  {loading ? (
                    <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icon icon="lucide:send" className="mr-2 h-4 w-4" />
                  )}
                  Rechnung erstellen
                </Button>

                {/* More Options Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="default" className="px-2">
                      <Icon icon="lucide:more-horizontal" className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => {
                        toast.success('Aufgabe erstellen - Feature wird implementiert');
                      }}
                      className="w-full"
                    >
                      <div className="w-full">
                        <Button
                          variant="default"
                          className="w-full justify-center bg-accent text-white hover:bg-accent/90"
                          size="sm"
                        >
                          Aufgabe erstellen
                        </Button>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        toast.success('Löschen - Feature wird implementiert');
                      }}
                      className="w-full"
                    >
                      <div className="w-full">
                        <Button
                          variant="default"
                          className="w-full justify-center bg-gray-600 text-white hover:bg-gray-700"
                          size="sm"
                        >
                          Löschen
                        </Button>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* Company Settings Warning Banner */}
        {showCompanySettingsBanner && (
          <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-start gap-3">
              <Icon
                icon="lucide:alert-triangle"
                className="mt-0.5 h-6 w-6 shrink-0 text-orange-600"
              />
              <div className="flex-1">
                <div className="mb-1 font-medium text-orange-800">
                  Angaben zu deinem Unternehmen
                </div>
                <div className="mb-3 text-orange-700 text-sm">
                  Damit deine Rechnungen rechtssicher und GoBD-konform sind, ergänze noch Angaben zu
                  dir und deinem Unternehmen.
                </div>
                <Button
                  onClick={() => setShowCompanySettingsModal(true)}
                  className="bg-accent text-white hover:bg-accent/90"
                  size="sm"
                >
                  Angaben vervollständigen
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompanySettingsBanner(false)}
                className="h-auto p-1"
              >
                <Icon icon="lucide:x" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* E-Rechnung Compliance Panel */}
        {showCompliancePanel && (
          <Sheet open={showCompliancePanel} onOpenChange={setShowCompliancePanel}>
            <SheetContent className="w-100 border-accent/20 border-l bg-white sm:w-135">
              <SheetHeader className="border-accent/10 border-b pb-4">
                <SheetTitle className="flex items-center gap-2 text-accent">
                  <Icon icon="lucide:alert-triangle" className="h-5 w-5 text-accent" />
                  E-Rechnung Compliance Prüfung
                </SheetTitle>
                <SheetDescription className="font-medium text-gray-600">
                  Folgende Probleme verhindern die Aktivierung der E-Rechnung:
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-3">
                {complianceErrors.length > 0 && (
                  <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-accent font-bold text-white text-xs">
                        !
                      </div>
                      <h4 className="font-semibold text-accent text-sm">
                        Erforderliche Angaben
                      </h4>
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent text-xs">
                        {complianceErrors.length}
                      </span>
                    </div>
                    <div className="space-y-1 text-gray-700 text-xs">
                      {complianceErrors.map((error, index) => (
                        <div key={index} className="flex items-start gap-1.5">
                          <span className="mt-0.5 text-accent text-xs">•</span>
                          <span className="leading-tight">{error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-3">
                <h4 className="mb-1 flex items-center gap-2 font-medium text-accent text-sm">
                  <Icon icon="lucide:info" className="h-3 w-3" />
                  E-Rechnung Mindestanforderungen
                </h4>
                <div className="text-gray-700 text-xs leading-tight">
                  Vollständige Firmen- und Kundendaten, Steuer-ID, Bankverbindung, gültige
                  E-Mail-Adressen
                </div>
              </div>

              <SheetFooter className="mt-6 border-accent/10 border-t pt-4">
                <Button
                  onClick={() => setShowCompliancePanel(false)}
                  variant="default"
                  className="w-full bg-accent text-white hover:bg-accent/90"
                  size="sm"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = '#129488';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'var(--accent)';
                  }}
                >
                  Schließen
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        )}

        {/* Allgemeine Angaben - SevDesk Style */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Icon icon="lucide:user" className="mr-2 h-5 w-5 text-accent" />
              Allgemeine Angaben
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 2-Spalten Grid für Empfänger und Rechnungsinformationen */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Empfänger Sektion - Links */}
              <div className="space-y-4">
                <div>
                  <h3 className="mb-4 font-semibold text-gray-900 text-lg">Empfänger</h3>

                  {/* Kontakttyp Toggle */}
                  <div className="mb-4 flex items-center gap-2">
                    <Label className="font-medium text-gray-700 text-sm">Kontakt</Label>
                    <span className="text-red-500">*</span>
                    <div className="ml-auto flex">
                      <Button
                        type="button"
                        variant={contactType === 'organisation' ? 'default' : 'outline'}
                        size="sm"
                        className={`rounded-r-none ${contactType === 'organisation'
                            ? 'bg-accent text-white hover:bg-accent/90'
                            : 'hover:bg-gray-50'
                          }`}
                        onClick={() => setContactType('organisation')}
                      >
                        Organisation
                      </Button>
                      <Button
                        type="button"
                        variant={contactType === 'person' ? 'default' : 'outline'}
                        size="sm"
                        className={`rounded-l-none ${contactType === 'person'
                            ? 'bg-accent text-white hover:bg-accent/90'
                            : 'hover:bg-gray-50'
                          }`}
                        onClick={() => setContactType('person')}
                      >
                        Person
                      </Button>
                    </div>
                  </div>

                  {/* Kontakt Name Input */}
                  <div className="mb-4 space-y-2">
                    {contactType === 'organisation' ? (
                      /* Organisation - Ein Feld für Organisationsname */
                      <div className="customer-search-container relative">
                        <Input
                          type="text"
                          value={formData.customerName}
                          onChange={e => {
                            const value = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              customerName: value,
                            }));

                            // Zeige Popup nur wenn mindestens 2 Zeichen eingegeben wurden
                            if (value.length >= 2) {
                              setShowCustomerSearchPopup(true);
                            } else {
                              setShowCustomerSearchPopup(false);
                            }
                          }}
                          placeholder="Name der Organisation"
                          className={`flex-1 ${getFieldErrorClass('customerName')}`}
                          required
                        />

                        {/* Intelligenter Such-Popup */}
                        {showCustomerSearchPopup && formData.customerName.length >= 2 && (
                          <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                            {/* Gefilterte Kunden anzeigen */}
                            {customers
                              .filter(customer =>
                                customer.name
                                  .toLowerCase()
                                  .includes(formData.customerName.toLowerCase()),
                              )
                              .slice(0, 5)
                              .map(customer => (
                                <div
                                  key={customer.id}
                                  className="cursor-pointer p-2 text-sm hover:bg-gray-100"
                                  onClick={() => selectCustomer(customer)}
                                >
                                  <div className="font-medium">{customer.name}</div>
                                  {customer.email && (
                                    <div className="text-gray-500">{customer.email}</div>
                                  )}
                                </div>
                              ))}

                            {/* "Neuen Kunden erstellen" Option */}
                            <div
                              className="cursor-pointer rounded-md p-2 hover:bg-gray-100"
                              onClick={() => {
                                setShowNewCustomerModal(true);
                                setShowCustomerSearchPopup(false);
                              }}
                            >
                              + Neuen Kunden &quot;{formData.customerName}&quot; erstellen
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Person - Zwei Felder für Vor- und Nachname mit Kundensuche */
                      <div className="customer-search-container relative">
                        <div className="mb-3 grid grid-cols-2 gap-3">
                          <div>
                            <Label className="font-medium text-gray-700 text-sm">Vorname</Label>
                            <span className="text-red-500">*</span>
                            <Input
                              type="text"
                              value={formData.customerFirstName || ''}
                              onChange={e => {
                                const value = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  customerFirstName: value,
                                  // Kombiniere Vor- und Nachname für customerName
                                  customerName: `${value} ${prev.customerLastName || ''}`.trim(),
                                }));

                                // Trigger Kundensuche wenn kombinierter Name >= 2 Zeichen
                                const combinedName =
                                  `${value} ${formData.customerLastName || ''}`.trim();
                                if (combinedName.length >= 2) {
                                  setShowCustomerSearchPopup(true);
                                } else {
                                  setShowCustomerSearchPopup(false);
                                }
                              }}
                              placeholder="Vorname"
                              className={getFieldErrorClass('customerName')}
                              required
                            />
                          </div>
                          <div>
                            <Label className="font-medium text-gray-700 text-sm">Nachname</Label>
                            <span className="text-red-500">*</span>
                            <Input
                              type="text"
                              value={formData.customerLastName || ''}
                              onChange={e => {
                                const value = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  customerLastName: value,
                                  // Kombiniere Vor- und Nachname für customerName
                                  customerName: `${prev.customerFirstName || ''} ${value}`.trim(),
                                }));

                                // Trigger Kundensuche wenn kombinierter Name >= 2 Zeichen
                                const combinedName =
                                  `${formData.customerFirstName || ''} ${value}`.trim();
                                if (combinedName.length >= 2) {
                                  setShowCustomerSearchPopup(true);
                                } else {
                                  setShowCustomerSearchPopup(false);
                                }
                              }}
                              placeholder="Nachname"
                              className={getFieldErrorClass('customerName')}
                              required
                            />
                          </div>
                        </div>

                        {/* Intelligenter Such-Popup für Person - gleiche Struktur wie Organisation */}
                        {showCustomerSearchPopup && formData.customerName.length >= 2 && (
                          <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                            {/* Gefilterte Kunden anzeigen */}
                            {customers
                              .filter(customer =>
                                customer.name
                                  .toLowerCase()
                                  .includes(formData.customerName.toLowerCase()),
                              )
                              .slice(0, 5)
                              .map(customer => (
                                <div
                                  key={customer.id}
                                  className="cursor-pointer p-2 text-sm hover:bg-gray-100"
                                  onClick={() => {
                                    // Bei Person-Auswahl Namen splitten
                                    const nameParts = customer.name.split(' ');
                                    const firstName = nameParts[0] || '';
                                    const lastName = nameParts.slice(1).join(' ') || '';

                                    setFormData(prev => ({
                                      ...prev,
                                      customerName: customer.name,
                                      customerFirstName: firstName,
                                      customerLastName: lastName,
                                      customerEmail: customer.email,
                                      customerNumber: customer.customerNumber || '',
                                      customerAddress:
                                        customer.street && customer.city
                                          ? `${customer.street}\n${customer.postalCode || ''} ${customer.city}\n${customer.country || 'Deutschland'}`
                                          : prev.customerAddress,
                                    }));
                                    setShowCustomerSearchPopup(false);
                                  }}
                                >
                                  <div className="font-medium">{customer.name}</div>
                                  {customer.email && (
                                    <div className="text-gray-500">{customer.email}</div>
                                  )}
                                </div>
                              ))}

                            {/* "Neuen Kunden erstellen" Option */}
                            <div
                              className="cursor-pointer rounded-md p-2 hover:bg-gray-100"
                              onClick={() => {
                                setCreateCustomerOpen(true);
                                setShowCustomerSearchPopup(false);
                              }}
                            >
                              + Neuen Kunden &quot;{formData.customerName}&quot; erstellen
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Anschrift */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Label className="font-medium text-gray-700 text-sm">Anschrift</Label>
                        <span className="text-red-500">*</span>
                      </div>
                      <button
                        type="button"
                        className="font-medium text-accent text-sm hover:text-accent/90"
                        onClick={() => setShowAddressAddition(true)}
                      >
                        Adresszusatz +
                      </button>
                    </div>

                    {/* Straße und Hausnummer */}
                    <Input
                      placeholder="Straße und Hausnummer"
                      value={formData.customerAddress?.split('\n')[0] || ''}
                      onChange={e => {
                        const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                        lines[0] = e.target.value;
                        setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                      }}
                      className={getFieldErrorClass('customerAddress')}
                    />

                    {/* Adresszusatz (optional) */}
                    {showAddressAddition && (
                      <div className="relative">
                        <Input
                          placeholder="Adresszusatz (z.B. c/o, Abteilung, etc.)"
                          value={formData.customerAddress?.split('\n')[1] || ''}
                          onChange={e => {
                            const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                            lines[1] = e.target.value;
                            setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                          }}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          onClick={() => {
                            setShowAddressAddition(false);
                            // Entferne den Adresszusatz aus der Adresse
                            const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                            lines[1] = ''; // Leere den Adresszusatz
                            setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                          }}
                          title="Adresszusatz entfernen"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </Button>
                      </div>
                    )}

                    {/* PLZ und Ort */}
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Postleitzahl"
                        value={
                          formData.customerAddress
                            ?.split('\n')
                          [showAddressAddition ? 2 : 1]?.split(' ')[0] || ''
                        }
                        onChange={e => {
                          const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                          const lineIndex = showAddressAddition ? 2 : 1;
                          const city = lines[lineIndex]?.split(' ').slice(1).join(' ') || '';
                          lines[lineIndex] = `${e.target.value} ${city}`.trim();
                          setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                        }}
                        className={getFieldErrorClass('customerAddress')}
                      />

                      <Input
                        placeholder="Ort"
                        value={
                          formData.customerAddress
                            ?.split('\n')
                          [showAddressAddition ? 2 : 1]?.split(' ')
                            .slice(1)
                            .join(' ') || ''
                        }
                        onChange={e => {
                          const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                          const lineIndex = showAddressAddition ? 2 : 1;
                          const zip = lines[lineIndex]?.split(' ')[0] || '';
                          lines[lineIndex] = `${zip} ${e.target.value}`.trim();
                          setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                        }}
                        className={getFieldErrorClass('customerAddress')}
                      />
                    </div>

                    {/* Land */}
                    <Select
                      value={
                        formData.customerAddress?.split('\n')[showAddressAddition ? 3 : 2] ||
                        'Deutschland'
                      }
                      onValueChange={value => {
                        const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                        const lineIndex = showAddressAddition ? 3 : 2;
                        lines[lineIndex] = value;
                        setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Bitte auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(country => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Rechnungsinformationen Sektion - Rechts */}
              <div className="space-y-4">
                <div>
                  <h3 className="mb-4 font-semibold text-gray-900 text-lg">
                    Rechnungsinformationen
                  </h3>

                  {/* 2x2 Grid für Rechnungsfelder */}
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    {/* Rechnungsdatum */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Label className="font-medium text-gray-700 text-sm">Rechnungsdatum</Label>
                        <span className="text-red-500">*</span>
                      </div>
                      <Input
                        type="date"
                        value={formData.invoiceDate}
                        onChange={e => {
                          setFormData(prev => ({ ...prev, invoiceDate: e.target.value }));
                        }}
                        required
                      />
                    </div>

                    {/* Lieferdatum */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Label
                            className={`cursor-pointer font-medium text-sm ${deliveryDateType === 'single' ? 'text-gray-900' : 'text-gray-500'
                              }`}
                            onClick={() => {
                              setDeliveryDateType('single');
                              // Leere servicePeriod und deliveryDateRange wenn Einzeldatum-Modus aktiviert wird
                              setFormData(prev => ({ ...prev, servicePeriod: '' }));
                              setDeliveryDateRange({});
                            }}
                          >
                            Lieferdatum
                          </Label>
                          <span className="text-red-500">*</span>
                        </div>
                        <button
                          type="button"
                          className={`cursor-pointer font-medium text-sm ${deliveryDateType === 'range' ? 'text-gray-900' : 'text-gray-500'
                            }`}
                          onClick={() => {
                            setDeliveryDateType('range');
                            // Leere deliveryDate wenn Zeitraum-Modus aktiviert wird
                            setFormData(prev => ({ ...prev, deliveryDate: '' }));
                          }}
                        >
                          Zeitraum
                        </button>
                      </div>

                      {deliveryDateType === 'single' ? (
                        <Input
                          type="date"
                          value={formData.deliveryDate}
                          onChange={e => {
                            setFormData(prev => ({
                              ...prev,
                              deliveryDate: e.target.value,
                              servicePeriod: '', // Leere servicePeriod wenn Einzeldatum verwendet wird
                            }));
                          }}
                          required
                        />
                      ) : (
                        <Popover
                          open={deliveryDatePopoverOpen}
                          onOpenChange={setDeliveryDatePopoverOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              onClick={() => setDeliveryDatePopoverOpen(true)}
                            >
                              <Icon icon="lucide:calendar" className="mr-2 h-4 w-4" />
                              {deliveryDateRange.from ? (
                                deliveryDateRange.to ? (
                                  <>
                                    {format(deliveryDateRange.from, 'dd.MM.yyyy', { locale: de })} -{' '}
                                    {format(deliveryDateRange.to, 'dd.MM.yyyy', { locale: de })}
                                  </>
                                ) : (
                                  format(deliveryDateRange.from, 'dd.MM.yyyy', { locale: de })
                                )
                              ) : (
                                'Zeitraum auswählen'
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              initialFocus
                              mode="range"
                              defaultMonth={deliveryDateRange.from}
                              selected={{
                                from: deliveryDateRange.from,
                                to: deliveryDateRange.to,
                              }}
                              onSelect={range => {
                                setDeliveryDateRange(range || {});
                                // Aktualisiere servicePeriod in formData wenn Zeitraum komplett ist
                                if (range?.from && range?.to) {
                                  const servicePeriodText = `${formatDateDE(range.from)} - ${formatDateDE(range.to)}`;
                                  setFormData(prev => ({
                                    ...prev,
                                    servicePeriod: servicePeriodText,
                                  }));
                                  setDeliveryDatePopoverOpen(false);
                                }
                              }}
                              numberOfMonths={2}
                              locale={de}
                              className="rounded-md border"
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    {/* Rechnungsnummer */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Label className="font-medium text-gray-700 text-sm">Rechnungsnummer</Label>
                        <span className="text-red-500">*</span>
                      </div>
                      <div className="relative">
                        <Input
                          placeholder={
                            nextNumberLoading
                              ? 'Lädt nächste Rechnungsnummer...'
                              : nextNumberError
                                ? `Fehler beim Laden: ${nextNumberError}`
                                : nextInvoiceNumber
                                  ? `${nextInvoiceNumber}`
                                  : 'Wird beim Speichern automatisch vergeben'
                          }
                          value={
                            formData.title ||
                            (nextInvoiceNumber && !nextNumberLoading && !nextNumberError
                              ? nextInvoiceNumber
                              : '')
                          }
                          onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                          className="bg-gray-50 pr-10 text-gray-600"
                          readOnly
                          title="Die Rechnungsnummer wird beim Speichern automatisch vergeben, um doppelte Nummern zu verhindern."
                        />

                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 p-0 hover:bg-gray-100"
                          type="button"
                          onClick={() => setShowNumberingModal(true)}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1.06 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1.06H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1.06-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.06 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1.06H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1.06z" />
                          </svg>
                        </Button>
                      </div>
                    </div>

                    {/* Referenznummer */}
                    <div className="space-y-2">
                      <Label className="font-medium text-gray-700 text-sm">Referenznummer</Label>
                      <Input
                        placeholder="Optional"
                        value={formData.customerOrderNumber}
                        onChange={e =>
                          setFormData(prev => ({ ...prev, customerOrderNumber: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {/* Zahlungsziel - Ganze Zeile */}
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-700 text-sm">Zahlungsziel</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={formData.validUntil}
                        onChange={e => handleValidUntilChange(e.target.value)}
                        className="flex-1"
                      />

                      <span className="text-gray-500 text-sm">in</span>
                      <Input
                        type="number"
                        placeholder="14"
                        value={paymentDays}
                        onChange={e => setPaymentDays(Number(e.target.value) || 0)}
                        className="w-16 text-center"
                      />

                      <span className="text-gray-500 text-sm">Tagen</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kopf-Text & Textvorlagen */}
        <InvoiceHeaderTextSection
          title={formData.title}
          headTextHtml={formData.headTextHtml}
          onTitleChange={value => setFormData(prev => ({ ...prev, title: value }))}
          onHeadTextChange={html => setFormData(prev => ({ ...prev, headTextHtml: html }))}
          companyId={uid}
          userId={user?.uid || ''}
          getFieldErrorClass={getFieldErrorClass}
        />

        {/* Produkte / Positionen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Icon icon="lucide:calculator" className="mr-2 h-5 w-5 text-accent" />
              Produkte
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Brutto/Netto Schalter */}
            <div className="mb-3 flex items-center justify-between">
              <div className="text-gray-600 text-sm">Preisanzeige</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={showNet ? 'default' : 'outline'}
                  className={showNet ? 'bg-accent text-white hover:bg-accent/90' : ''}
                  onClick={() => setShowNet(true)}
                  size="sm"
                >
                  Netto
                </Button>
                <Button
                  type="button"
                  variant={!showNet ? 'default' : 'outline'}
                  className={!showNet ? 'bg-accent text-white hover:bg-accent/90' : ''}
                  onClick={() => setShowNet(false)}
                  size="sm"
                >
                  Brutto
                </Button>
              </div>
            </div>

            {/* Positions-Steuerleiste */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  const newItem: QuoteItem = {
                    id:
                      typeof crypto !== 'undefined' && 'randomUUID' in crypto
                        ? crypto.randomUUID()
                        : Math.random().toString(36).slice(2),
                    description: '',
                    quantity: 1,
                    unitPrice: 0,
                    total: 0,
                    taxRate: taxRate, // Verwende globalen Steuersatz als Standard
                  };
                  setItems(prev => [...prev, newItem]);
                }}
                className="px-0 text-accent"
              >
                + Position hinzufügen
              </Button>
              <InventorySelector
                companyId={uid}
                onSelectItem={(invItem, quantity) => {
                  const qty = Math.max(1, quantity || 1);
                  const unitPriceNet = invItem.sellingPrice || 0;
                  const newItem: QuoteItem = {
                    id:
                      typeof crypto !== 'undefined' && 'randomUUID' in crypto
                        ? crypto.randomUUID()
                        : Math.random().toString(36).slice(2),
                    description: invItem.name,
                    quantity: qty,
                    unitPrice: unitPriceNet,
                    total: computeItemTotalNet(qty, unitPriceNet),
                    unit: invItem.unit,
                    inventoryItemId: invItem.id,
                    discountPercent: 0,
                    taxRate: taxRate, // Verwende globalen Steuersatz als Standard
                  };
                  setItems(prev => [...prev, newItem]);
                }}
                selectedItems={items.map(i => i.inventoryItemId).filter(Boolean) as string[]}
              />

              <Button
                type="button"
                variant="link"
                onClick={() => {
                  const newItem: QuoteItem = {
                    id:
                      typeof crypto !== 'undefined' && 'randomUUID' in crypto
                        ? crypto.randomUUID()
                        : Math.random().toString(36).slice(2),
                    description: 'Gesamtrabatt',
                    quantity: 1,
                    unitPrice: 0,
                    total: 0,
                    category: 'discount',
                    taxRate: 0, // Rabatte haben normalerweise 0% Steuer
                  };
                  setItems(prev => [...prev, newItem]);
                }}
                className="px-0 text-accent"
              >
                + Gesamtrabatt hinzufügen
              </Button>

              {/* Dienstleistung anlegen */}
              <div className="ml-2 flex items-center gap-2 border-gray-200 border-l pl-4">
                <div className="relative w-125">
                  <Input
                    type="text"
                    value={newServiceName || ''}
                    onChange={e => {
                      const value = e.target.value;
                      setNewServiceName(value);
                      // Zeige Dropdown ab 2 Zeichen
                      if (value.trim().length >= 2) {
                        setShowPopover(true);
                      } else {
                        setShowPopover(false);
                      }
                    }}
                    placeholder="Dienstleistung suchen oder neue erstellen..."
                    className="w-full"
                  />

                  {/* Dropdown für Vorschläge */}
                  {showPopover && (
                    <div className="absolute right-0 left-0 z-50 mt-1 rounded-lg border bg-white shadow-lg">
                      <div className="max-h-100 overflow-y-auto p-4">
                        {loadingSavedServices ? (
                          <div className="flex items-center gap-2 p-2">
                            <Icon icon="lucide:loader2" className="h-4 w-4 animate-spin" />
                            <span>Lade Dienstleistungen...</span>
                          </div>
                        ) : (
                          <>
                            {/* Vorhandene Dienstleistungen */}
                            {(savedServices || [])
                              .filter(
                                service =>
                                  !newServiceName ||
                                  service.name.toLowerCase().includes(newServiceName.toLowerCase()),
                              )
                              .map(service => (
                                <div
                                  key={service.id}
                                  className="flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-gray-100"
                                  onClick={() => {
                                    const price =
                                      typeof service.price === 'string'
                                        ? parseFloat(service.price)
                                        : service.price;
                                    setItems(prev => [
                                      ...prev,
                                      {
                                        id: crypto.randomUUID(),
                                        description: service.name,
                                        quantity: 1,
                                        unitPrice: price,
                                        total: price,
                                        unit: service.unit || 'Stk',
                                        taxRate: taxRate, // Verwende globalen Steuersatz als Standard
                                      },
                                    ]);
                                    setNewServiceName('');
                                    setShowPopover(false);
                                    toast.success('Dienstleistung zur Rechnung hinzugefügt');
                                  }}
                                >
                                  <div>
                                    <div className="font-medium">{service.name}</div>
                                    <div className="text-gray-500 text-sm">{service.unit}</div>
                                  </div>
                                  <div className="font-medium">
                                    {formatCurrency(
                                      typeof service.price === 'string'
                                        ? parseFloat(service.price)
                                        : service.price,
                                    )}
                                  </div>
                                </div>
                              ))}

                            {/* Option zum Erstellen einer neuen Dienstleistung */}
                            {newServiceName && newServiceName.trim().length >= 2 && (
                              <div
                                className={
                                  savedServices.filter(service =>
                                    service.name
                                      .toLowerCase()
                                      .includes(newServiceName.toLowerCase()),
                                  ).length > 0
                                    ? 'mt-2 border-gray-200 border-t pt-2'
                                    : ''
                                }
                              >
                                <div
                                  className="cursor-pointer rounded-md p-2 hover:bg-gray-100"
                                  onClick={() => {
                                    setServiceDraft({
                                      name: newServiceName,
                                      description: '',
                                      price: '',
                                      unit: 'Stk',
                                    });
                                    setServiceModalOpen(true);
                                    setNewServiceName('');
                                    setShowPopover(false);
                                  }}
                                >
                                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                                    <Icon icon="lucide:plus" className="h-4 w-4" />
                                    <span>
                                      Neue Dienstleistung &quot;{newServiceName}&quot; erstellen
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Modal für neue Dienstleistung */}
              <Dialog open={serviceModalOpen} onOpenChange={setServiceModalOpen}>
                <DialogContent className="max-w-md" aria-describedby="service-dialog-description">
                  <DialogHeader>
                    <DialogTitle>Neue Dienstleistung anlegen</DialogTitle>
                    <div id="service-dialog-description" className="sr-only">
                      Dialog zum Anlegen einer neuen Dienstleistung mit Name und weiteren Details
                    </div>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block font-medium text-sm">Name *</label>
                      <input
                        type="text"
                        className="w-full rounded border px-2 py-1"
                        value={serviceDraft.name}
                        onChange={e => setServiceDraft(d => ({ ...d, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-sm">Beschreibung</label>
                      <textarea
                        className="w-full rounded border px-2 py-1"
                        value={serviceDraft.description}
                        onChange={e =>
                          setServiceDraft(d => ({ ...d, description: e.target.value }))
                        }
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block font-medium text-sm">Preis *</label>
                        <input
                          type="number"
                          className="w-full rounded border px-2 py-1"
                          value={serviceDraft.price}
                          onChange={e => setServiceDraft(d => ({ ...d, price: e.target.value }))}
                          min="0"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-medium text-sm">Einheit</label>
                        <select
                          className="rounded border px-2 py-1"
                          value={serviceDraft.unit}
                          onChange={e => setServiceDraft(d => ({ ...d, unit: e.target.value }))}
                        >
                          <option value="Stk">Stk</option>
                          <option value="Std">Std</option>
                          <option value="Pauschale">Pauschale</option>
                          <option value="%">%</option>
                          <option value="Tag(e)">Tag(e)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      className="bg-accent text-white hover:bg-accent/90"
                      onClick={async () => {
                        if (!serviceDraft.name.trim() || !serviceDraft.price) return;

                        // 1. Zuerst via API speichern
                        await saveServiceToSubcollection();

                        // 2. Dann als Position zur Rechnung hinzufügen
                        setItems(prev => [
                          ...prev,
                          {
                            id:
                              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                                ? crypto.randomUUID()
                                : Math.random().toString(36).slice(2),
                            description:
                              serviceDraft.name +
                              (serviceDraft.description ? `: ${serviceDraft.description}` : ''),
                            quantity: 1,
                            unitPrice: parseFloat(serviceDraft.price),
                            total: parseFloat(serviceDraft.price),
                            unit: serviceDraft.unit,
                            taxRate: taxRate, // Verwende globalen Steuersatz als Standard
                          },
                        ]);

                        // 3. Dialog schließen und Form zurücksetzen
                        setServiceModalOpen(false);
                        setServiceDraft({ name: '', description: '', price: '', unit: 'Stk' });
                        toast.success('Dienstleistung zur Rechnung hinzugefügt');
                      }}
                      disabled={!serviceDraft.name.trim() || !serviceDraft.price}
                    >
                      Speichern & hinzufügen
                    </Button>
                    <DialogClose asChild>
                      <Button variant="outline" type="button">
                        Abbrechen
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Header-Zeile für Spalten (nur einmal anzeigen) */}
            {items.length > 0 && (
              <div className="flex gap-3 rounded-lg bg-gray-50 px-4 py-2 font-medium text-gray-700 text-sm">
                <div style={{ flex: 1 }}>
                  <label className="block">Produkt oder Service</label>
                </div>
                <div style={{ width: '80px' }}>
                  <label className="block">Menge</label>
                </div>
                <div style={{ width: '100px' }}>
                  <label className="block">Einheit</label>
                </div>
                <div style={{ width: '120px' }}>
                  <label className="block">
                    Preis <small>({showNet ? 'Netto' : 'Brutto'})</small>
                  </label>
                </div>
                <div style={{ width: '80px' }}>
                  <label className="block">USt.</label>
                </div>
                <div style={{ width: '80px' }}>
                  <label className="block">Rabatt</label>
                </div>
                <div style={{ width: '100px', textAlign: 'right' }}>
                  <label className="block">Betrag</label>
                </div>
                <div style={{ width: '36px' }}></div>
              </div>
            )}

            {/* Positionsliste */}
            <div className="space-y-2">
              {items.map((item, index) => {
                const itemTaxRate = item.taxRate ?? taxRate;
                const unitPriceDisplay = showNet
                  ? item.unitPrice
                  : item.unitPrice * (1 + itemTaxRate / 100);
                // Rabatt-Positionen als negative Beträge darstellen
                const baseTotalNet = item.total || 0;
                const sign = item.category === 'discount' ? -1 : 1;
                // Positions-Rabatt anwenden, außer bei speziellen Rabatt-Positionszeilen
                const discountFactor =
                  item.category === 'discount'
                    ? 1
                    : 1 - Math.max(0, Math.min(100, item.discountPercent || 0)) / 100;
                const totalNet = baseTotalNet * sign * discountFactor;
                const totalGross = totalNet * (1 + itemTaxRate / 100);
                return (
                  <div key={item.id} className="rounded-lg border border-gray-200">
                    {/* Hauptzeile mit allen Feldern */}
                    <div className="flex items-end gap-3 p-4 hover:bg-gray-50">
                      <div style={{ flex: 1 }}>
                        <div className="sr-only">
                          <Label>Beschreibung</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                aria-label="Hinweis zur Beschreibung"
                                className="inline-flex cursor-help"
                              >
                                <Icon icon="lucide:info" className="h-4 w-4 text-accent" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start" className="max-w-xs text-sm">
                              <p>
                                Hinweis: Die Beschreibung ist für den Kunden sichtbar. Du kannst
                                auch die SKU oder den exakten Produktnamen eingeben, um Werte
                                automatisch aus dem Inventar zu übernehmen.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Popover
                          open={popoverOpenIds.has(item.id)}
                          onOpenChange={open => {
                            if (!open) {
                              setDismissedCreatePromptIds(prev => new Set(prev).add(item.id));
                            }
                          }}
                        >
                          <div className="relative">
                            <Input
                              value={item.description}
                              onChange={e =>
                                handleDescriptionChange(index, item.id, e.target.value)
                              }
                              placeholder={
                                item.category === 'discount'
                                  ? 'Rabatt / Nachlass'
                                  : 'Leistungsbeschreibung'
                              }
                            />

                            <PopoverAnchor />
                          </div>
                          <PopoverContent side="bottom" align="start">
                            <div className="text-sm">
                              <div className="mb-2 font-medium">Als Produkt speichern?</div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-accent text-white hover:bg-accent/90"
                                  onClick={() => {
                                    const rate = Number.isFinite(taxRate) ? taxRate : 19;
                                    const name = item.description || '';
                                    const unit = (item.unit as string) || 'Stk';
                                    const sellingNet = Number.isFinite(item.unitPrice)
                                      ? item.unitPrice
                                      : 0;
                                    setNewProduct({
                                      name,
                                      imageUrl: '',
                                      sku: '',
                                      category: 'Artikel',
                                      unit,
                                      stock: 0,
                                      taxRate: rate,
                                      purchaseNet: 0,
                                      purchaseGross: 0,
                                      sellingNet,
                                      sellingGross: Number(
                                        syncGrossFromNet(sellingNet, rate).toFixed(2),
                                      ),
                                      description: '',
                                      internalNote: '',
                                    });
                                    setCreateProductForIndex(index);
                                    setCreateProductOpen(true);
                                    setDismissedCreatePromptIds(prev => new Set(prev).add(item.id));
                                  }}
                                >
                                  Produkt erstellen
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setDismissedCreatePromptIds(prev => new Set(prev).add(item.id))
                                  }
                                >
                                  Später
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div style={{ width: '80px' }}>
                        <div className="sr-only">
                          <Label>Menge</Label>
                        </div>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={e =>
                            handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div style={{ width: '100px' }}>
                        <div className="sr-only">
                          <Label>Einheit</Label>
                        </div>
                        <Select
                          value={(item.unit as string) ?? 'Stk'}
                          onValueChange={val => {
                            const mapped = val === 'none' ? '' : val;
                            setItems(prev =>
                              prev.map((it, i) => (i === index ? { ...it, unit: mapped } : it)),
                            );
                          }}
                          disabled={item.category === 'discount'}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Einheit" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {UNIT_OPTIONS.map(u => (
                              <SelectItem key={u.value || 'blank'} value={u.value}>
                                {u.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div style={{ width: '120px' }}>
                        <div className="sr-only">
                          <Label>
                            Preis
                            <small className="font-normal text-gray-500">
                              {' '}
                              ({showNet ? 'Netto' : 'Brutto'})
                            </small>
                          </Label>
                        </div>
                        <Input
                          type="number"
                          value={
                            Number.isFinite(unitPriceDisplay)
                              ? Number(unitPriceDisplay.toFixed(2))
                              : 0
                          }
                          onChange={e =>
                            handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.01"
                          className="h-8 w-28 px-2 text-sm md:w-32"
                        />
                      </div>
                      <div style={{ width: '80px' }}>
                        <div className="sr-only">
                          <Label>USt. %</Label>
                        </div>
                        <Select
                          value={(item.taxRate ?? taxRate).toString()}
                          onValueChange={val => {
                            const newTaxRate = parseFloat(val);
                            setItems(prev =>
                              prev.map((it, i) =>
                                i === index ? { ...it, taxRate: newTaxRate } : it,
                              ),
                            );
                          }}
                          disabled={item.category === 'discount'}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="7">7%</SelectItem>
                            <SelectItem value="19">19%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div style={{ width: '80px' }}>
                        <div className="sr-only">
                          <Label>Rabatt %</Label>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={item.category === 'discount' ? 0 : (item.discountPercent ?? 0)}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            setItems(prev =>
                              prev.map((it, i) =>
                                i === index
                                  ? {
                                    ...it,
                                    discountPercent: Number.isFinite(v)
                                      ? Math.max(0, Math.min(100, v))
                                      : 0,
                                  }
                                  : it,
                              ),
                            );
                          }}
                          disabled={item.category === 'discount'}
                        />
                      </div>
                      <div style={{ width: '100px', textAlign: 'right' }}>
                        <div className="sr-only">
                          <Label>Betrag</Label>
                        </div>
                        <div
                          className={`flex h-10 items-center justify-end font-medium text-sm ${item.category === 'discount' ? 'text-red-600' : ''}`}
                        >
                          {formatCurrency(showNet ? totalNet : totalGross)}
                        </div>
                      </div>
                      <div style={{ width: '36px' }} className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={items.length === 1}
                        >
                          <Icon icon="lucide:x" className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Erweiterte Beschreibung - Automatisch anzeigen wenn Beschreibung vorhanden */}
                    {item.description && item.description.trim().length > 0 && (
                      <div className="px-4 pb-4">
                        <textarea
                          placeholder="Erweiterte Beschreibung (optional) - wird auf der Rechnung unter der Position angezeigt"
                          value={item.extendedDescription || ''}
                          onChange={e => {
                            setItems(prev =>
                              prev.map((it, i) =>
                                i === index ? { ...it, extendedDescription: e.target.value } : it,
                              ),
                            );
                          }}
                          className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                          rows={4}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Fuß-Text (unter Positionen) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">Fuß-Text</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="footerText">Fuß-Text mit Platzhaltern</Label>
            <FooterTextEditor
              value={formData.footerText}
              onChange={(html: string) => setFormData(prev => ({ ...prev, footerText: html }))}
              companyId={uid}
              objectType="INVOICE"
              textType="FOOT"
            />
          </CardContent>
        </Card>

        {/* Mehr Optionen */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Mehr Optionen</CardTitle>
              <Button
                type="button"
                variant="link"
                className="px-0 text-accent"
                onClick={() => setShowDetailedOptions(v => !v)}
              >
                {!showDetailedOptions
                  ? 'Weitere Optionen einblenden'
                  : 'Weitere Optionen ausblenden'}
              </Button>
            </div>
          </CardHeader>
          {showDetailedOptions && (
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Währung</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={val => setFormData(prev => ({ ...prev, currency: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Bitte auswählen" />
                      </SelectTrigger>
                      <SelectContent
                        className="max-h-96 overflow-y-auto"
                        style={{ scrollbarGutter: 'stable' }}
                      >
                        {allCurrencies.map(c => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name} ({c.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Interne Kontaktperson</Label>
                    <Input
                      value={formData.internalContactPerson}
                      onChange={e =>
                        setFormData(p => ({ ...p, internalContactPerson: e.target.value }))
                      }
                      placeholder="Name der Kontaktperson"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Lieferbedingungen</Label>
                    <Input
                      value={formData.deliveryTerms}
                      onChange={e => setFormData(p => ({ ...p, deliveryTerms: e.target.value }))}
                      placeholder="z.B. Lieferung innerhalb von 14 Tagen"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Zahlungsbedingungen</Label>
                    <Input
                      value={formData.paymentTerms}
                      onChange={e => setFormData(p => ({ ...p, paymentTerms: e.target.value }))}
                      placeholder="z.B. 14 Tage netto"
                    />
                  </div>

                  {/* Skonto-Einstellungen */}
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">Skonto</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 text-xs">aktivieren</span>
                        <Switch checked={skontoEnabled} onCheckedChange={setSkontoEnabled} />
                      </div>
                    </div>
                    {skontoEnabled && (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Skontotage</Label>
                          <Input
                            type="number"
                            min={1}
                            value={skontoDays ?? ''}
                            onChange={e => {
                              const v = parseInt(e.target.value, 10);
                              setSkontoDays(Number.isFinite(v) ? Math.max(1, v) : undefined);
                            }}
                            placeholder="z.B. 10"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Skonto %</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            value={skontoPercentage ?? ''}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              setSkontoPercentage(Number.isFinite(v) ? Math.max(0, v) : undefined);
                            }}
                            placeholder="z.B. 2"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-1">
                          <Label>Text (optional)</Label>
                          <Input
                            value={skontoText}
                            onChange={e => setSkontoText(e.target.value)}
                            placeholder="Bei Zahlung binnen X Tagen Y% Skonto"
                          />
                        </div>
                      </div>
                    )}
                    {skontoEnabled && (
                      <div className="text-gray-500 text-xs">
                        Vorschau:{' '}
                        {skontoText?.trim() ||
                          (skontoDays && skontoPercentage
                            ? `Bei Zahlung binnen ${skontoDays} Tagen ${skontoPercentage}% Skonto`
                            : '—')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Umsatzsteuerregelung */}
                <div className="space-y-3">
                  <Label className="font-semibold">Umsatzsteuerregelung</Label>

                  <TaxRuleSelector
                    value={formData.taxRule}
                    onChange={value => setFormData(p => ({ ...p, taxRule: value }))}
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Summen */}
        <Card>
          <CardHeader>
            <CardTitle>Summen</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm">
              <li className="flex justify-between border-b py-2">
                <span>Gesamtsumme Netto (inkl. Rabatte / Aufschläge)</span>
                <span>{formatCurrency(subtotal)}</span>
              </li>
              {!showNet && taxGrouped.length > 0
                ? // SevDesk-style: Show multiple tax rates
                taxGrouped
                  .filter(tax => tax.taxAmount > 0)
                  .map((tax, index) => (
                    <li key={index} className="flex justify-between border-b py-2">
                      <span>Umsatzsteuer {tax.rate}%</span>
                      <span>{formatCurrency(tax.taxAmount)}</span>
                    </li>
                  ))
                : // Fallback: Single tax rate display
                !showNet &&
                taxRate > 0 && (
                  <li className="flex justify-between border-b py-2">
                    <span>Umsatzsteuer {taxRate}%</span>
                    <span>{formatCurrency(vat)}</span>
                  </li>
                )}
              <li className="flex justify-between py-2">
                <span className="font-semibold text-lg">
                  {showNet ? 'Gesamt (Netto)' : 'Gesamt (Brutto)'}
                </span>
                <span className="font-semibold text-lg">
                  {formatCurrency(showNet ? subtotal : grandTotal)}
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Interne Notizen */}
        <Card>
          <CardHeader>
            <CardTitle>Interne Notizen</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Interne Notizen (werden nicht im Angebot angezeigt)..."
              rows={3}
            />
          </CardContent>
        </Card>
      </div>

      {/* === MODALS - Außerhalb des Hauptcontainers === */}

      {/* Modal: Neues Produkt */}
      <NewProductModal
        open={createProductOpen}
        onOpenChange={setCreateProductOpen}
        defaultValues={newProduct}
        saving={creatingProduct}
        onSave={async vals => {
          if (!uid || !vals.name.trim()) return;
          setCreatingProduct(true);
          try {
            const itemId = await InventoryService.addInventoryItem(uid, {
              name: vals.name.trim(),
              description: vals.description || undefined,
              sku: vals.sku || '',
              category: vals.category || 'Allgemein',
              unit: vals.unit || 'Stk',
              currentStock: vals.stock || 0,
              reservedStock: 0,
              availableStock: (vals.stock || 0) - 0,
              minStock: 0,
              maxStock: undefined,
              purchasePrice: Number(vals.purchaseNet) || 0,
              sellingPrice: Number(vals.sellingNet) || 0,
              supplierName: undefined,
              supplierContact: undefined,
              location: undefined,
              barcode: undefined,
              image: vals.imageUrl || undefined,
              status: 'active',
              notes: vals.internalNote || undefined,
            });

            if (createProductForIndex !== null) {
              setItems(prev =>
                prev.map((it, i) =>
                  i === createProductForIndex
                    ? {
                      ...it,
                      inventoryItemId: itemId,
                      unit: vals.unit,
                      unitPrice:
                        Number.isFinite(it.unitPrice) && it.unitPrice > 0
                          ? it.unitPrice
                          : vals.sellingNet || 0,
                      total: computeItemTotalNet(
                        it.quantity,
                        Number.isFinite(it.unitPrice) && it.unitPrice > 0
                          ? it.unitPrice
                          : vals.sellingNet || 0,
                      ),
                    }
                    : it,
                ),
              );
            }

            toast.success('Produkt angelegt und Position verknüpft');
            setCreateProductOpen(false);
          } catch (err) {
            console.error(err);
            toast.error('Produkt konnte nicht angelegt werden');
          } finally {
            setCreatingProduct(false);
          }
        }}
      />

      {/* Company Settings Modal */}
      <Dialog open={showCompanySettingsModal} onOpenChange={setShowCompanySettingsModal}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deine Angaben</DialogTitle>
            <DialogDescription>Bearbeite deine Firmendaten und Einstellungen</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Pflichtangaben */}
            <div>
              <h3 className="mb-4 font-medium text-lg">Pflichtangaben</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Inhaber</Label>
                  <Input
                    value={companySettingsFormData.companyOwner}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({
                        ...prev,
                        companyOwner: e.target.value,
                      }))
                    }
                    placeholder="Inhaber"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Firma</Label>
                  <Input
                    value={companySettingsFormData.companyName}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, companyName: e.target.value }))
                    }
                    placeholder="Firma"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Anschrift</Label>
                  <Input
                    value={companySettingsFormData.street}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, street: e.target.value }))
                    }
                    placeholder="Straße und Hausnummer"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Input
                      value={companySettingsFormData.zip}
                      onChange={e =>
                        setCompanySettingsFormData(prev => ({ ...prev, zip: e.target.value }))
                      }
                      placeholder="PLZ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      value={companySettingsFormData.city}
                      onChange={e =>
                        setCompanySettingsFormData(prev => ({ ...prev, city: e.target.value }))
                      }
                      placeholder="Ort"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Steuernummer</Label>
                  <Input
                    value={companySettingsFormData.taxNumber}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, taxNumber: e.target.value }))
                    }
                    placeholder="Steuernummer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Umsatzsteuer-ID</Label>
                  <Input
                    value={companySettingsFormData.vatNumber}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, vatNumber: e.target.value }))
                    }
                    placeholder="Umsatzsteuer-ID"
                  />
                </div>
              </div>
            </div>

            {/* Optionale Angaben */}
            <div>
              <h3 className="mb-4 font-medium text-lg">Optionale Angaben</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>E-Mail</Label>
                  <Input
                    type="email"
                    value={companySettingsFormData.email}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="marie@musterfrau.de"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input
                    value={companySettingsFormData.phone}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="07821 127384"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>IBAN</Label>
                  <Input
                    value={companySettingsFormData.iban}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, iban: e.target.value }))
                    }
                    placeholder="DE01100100000010101010"
                  />
                </div>
                <div className="space-y-2">
                  <Label>BIC</Label>
                  <Input
                    value={companySettingsFormData.bic}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, bic: e.target.value }))
                    }
                    placeholder="BELADEBE"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setShowCompanySettingsModal(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCompanySettingsSave}
              className="bg-accent text-white hover:bg-accent/90"
            >
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Neuer Kunde */}
      <NewCustomerModal
        open={createCustomerOpen}
        onOpenChange={setCreateCustomerOpen}
        defaultValues={{
          name: formData.customerName || '',
          firstName: contactType === 'person' ? formData.customerFirstName : undefined,
          lastName: contactType === 'person' ? formData.customerLastName : undefined,
        }}
        contactType={contactType}
        saving={creatingCustomer}
        persistDirectly={true}
        companyId={uid}
        onSaved={async _customerId => {
          try {
            // Lade Kunden neu direkt aus Backend-API
            const customersData = (await api.get(`/api/v1/customers?company_id=${uid}`)) as any[];
            const loadedCustomers: CustomerType[] = (customersData || [])
              .filter((data: any) => !data.isSupplier && !data.customerNumber?.startsWith('LF-'))
              .map((data: any) => ({
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
            toast.success('Kunde erfolgreich erstellt');
          } catch (error) {
            console.error('Fehler beim Aktualisieren der Kundenliste:', error);
          }
        }}
      />

      {/* Modal: Textvorlagen verwalten */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="w-full max-w-200">
          <DialogHeader>
            <DialogTitle>Textvorlagen verwalten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              Hier können Sie neue Textvorlagen für Kopf- und Fußtexte erstellen und verwalten.
            </p>
            <div className="py-8 text-center text-gray-500">
              <Icon icon="lucide:file-text" className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>Textvorlagen-Verwaltung wird in Kürze verfügbar sein.</p>
              <p className="mt-1 text-xs">
                Navigieren Sie zu Finance → Textvorlagen für die vollständige Verwaltung.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowTemplateModal(false)}>Schließen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Nummernkreis bearbeiten */}
      <Dialog open={showNumberingModal} onOpenChange={setShowNumberingModal}>
        <DialogContent className="w-80 max-w-none sm:w-80">
          <DialogHeader>
            <DialogTitle>Nummernkreis bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Format */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700 text-sm">Format</Label>
              <Input
                value={numberingFormat}
                onChange={e => setNumberingFormat(e.target.value)}
                placeholder="RE-%NUMBER"
              />
            </div>

            {/* Nächste Zahl */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700 text-sm">Nächste Zahl</Label>
              <Input
                type="number"
                value={nextNumber}
                onChange={e => setNextNumber(parseInt(e.target.value, 10) || 0)}
                placeholder="1000"
              />
            </div>

            {/* Vorschau */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700 text-sm">Vorschau</Label>
              <div className="rounded-md border bg-gray-50 p-3">
                <code className="font-mono text-gray-800 text-sm">
                  {generateNumberPreview(numberingFormat, nextNumber)}
                </code>
              </div>
            </div>

            {/* Verfügbare Variablen */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700 text-sm">
                Folgende Variablen stehen für das Format zur Verfügung:
              </Label>
              <div className="space-y-1 text-gray-600 text-xs">
                <div>
                  <code className="rounded bg-gray-100 px-1">%NUMBER</code> - Nächste Zahl{' '}
                  <span className="text-red-500">Obligatorisch</span>
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%YYYY</code> - Aktuelles Jahr (2025)
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%YY</code> - Aktuelles Jahr (25)
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%MM</code> - Aktueller Monat (09)
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%M</code> - Aktueller Monat (9)
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%DD</code> - Aktueller Tag (15)
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%D</code> - Aktueller Tag (15)
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowNumberingModal(false)}>
                Abbrechen
              </Button>
              <Button
                className="bg-accent text-white hover:bg-accent/90"
                onClick={async () => {
                  try {
                    // Nummernkreis-Einstellungen werden jetzt automatisch durch NumberSequenceService verwaltet
                    // Keine manuellen Updates der invoiceNumbering Felder mehr nötig

                    // Aktualisiere das Rechnungsnummer-Feld mit der neuen Vorschau
                    setFormData(prev => ({
                      ...prev,
                      title: generateNumberPreview(numberingFormat, nextNumber),
                    }));

                    setShowNumberingModal(false);
                    toast.success('Nummernkreis-Einstellungen gespeichert');
                  } catch (error) {
                    console.error('Fehler beim Speichern der Nummernkreis-Einstellungen:', error);
                    toast.error('Fehler beim Speichern der Einstellungen');
                  }
                }}
              >
                Übernehmen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* E-Rechnung Compliance Panel - von rechts ausfahrend */}
      <Sheet open={showCompliancePanel} onOpenChange={setShowCompliancePanel}>
        <SheetContent side="right" className="w-100 sm:w-135">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Icon icon="lucide:alert-triangle" className="h-5 w-5 text-red-500" />
              E-Rechnung Compliance Prüfung
            </SheetTitle>
            <SheetDescription>
              Folgende Probleme verhindern die Aktivierung der E-Rechnung:
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {(() => {
              // Kategorisiere die Compliance-Fehler in Pflicht und Empfohlen
              const criticalErrors = complianceErrors.filter(
                error =>
                  !error.includes('empfohlen') &&
                  !error.includes('Website') &&
                  !error.includes('Logo') &&
                  !error.includes('Branchenangabe') &&
                  !error.includes('Geschäftsbeschreibung') &&
                  !error.includes('Telefonnummer'),
              );

              const recommendedErrors = complianceErrors.filter(
                error =>
                  error.includes('empfohlen') ||
                  error.includes('Website') ||
                  error.includes('Logo') ||
                  error.includes('Branchenangabe') ||
                  error.includes('Geschäftsbeschreibung') ||
                  error.includes('Telefonnummer'),
              );

              return (
                <>
                  {/* Kritische Fehler - Kompakt */}
                  {criticalErrors.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 font-bold text-white text-xs">
                          !
                        </div>
                        <h4 className="font-semibold text-red-800 text-sm">
                          Erforderliche Angaben
                        </h4>
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700 text-xs">
                          {criticalErrors.length}
                        </span>
                      </div>
                      <div className="space-y-1 text-red-700 text-xs">
                        {criticalErrors.slice(0, 5).map((error, index) => (
                          <div key={index} className="flex items-start gap-1.5">
                            <span className="mt-0.5 text-red-400 text-xs">•</span>
                            <span className="leading-tight">{error}</span>
                          </div>
                        ))}
                        {criticalErrors.length > 5 && (
                          <div className="mt-1 font-medium text-red-600 text-xs">
                            ... und {criticalErrors.length - 5} weitere
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Empfehlungen - Kollapsible */}
                  {recommendedErrors.length > 0 && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-white text-xs">
                          i
                        </div>
                        <h4 className="font-semibold text-sm text-yellow-800">Empfehlungen</h4>
                        <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                          {recommendedErrors.length}
                        </span>
                      </div>
                      <div className="text-xs text-yellow-700">
                        <div className="leading-tight">
                          {recommendedErrors.slice(0, 2).join(', ')}
                          {recommendedErrors.length > 2 &&
                            ` und ${recommendedErrors.length - 2} weitere Verbesserungen`}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Kompakte Hilfe-Section */}
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <h4 className="mb-1 flex items-center gap-2 font-medium text-blue-800 text-sm">
              <Icon icon="lucide:info" className="h-3 w-3" />
              E-Rechnung Mindestanforderungen
            </h4>
            <div className="text-blue-700 text-xs leading-tight">
              Vollständige Firmen- und Kundendaten, Steuer-ID, Bankverbindung, gültige
              E-Mail-Adressen
            </div>
          </div>

          <SheetFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowCompliancePanel(false)}
              className="h-8 w-full text-sm"
            >
              Schließen
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Send Document Modal - IMMER gerendert für html2pdf.js Preload */}
      <SendDocumentModal
        isOpen={showSendDocumentModal && !!createdDocument}
        onClose={() => {
          setShowSendDocumentModal(false);
          setCreatedDocument(null);
        }}
        document={createdDocument || ({} as InvoiceData)}
        documentType="invoice"
        companyId={uid}
        redirectAfterAction={`/dashboard/company/${uid}/finance/invoices`}
        onSend={async (method, options) => {
          try {
            // Get the invoice ID from the created document or options
            const _invoiceId = options?.invoiceId || createdDocument?.id;

            // Then handle the sending logic
            if (method === 'email') {
              toast.success('Rechnung wurde gespeichert und E-Mail-Versand wird vorbereitet');
            } else if (method === 'download') {
              toast.success('PDF-Download wird vorbereitet');
            } else if (method === 'print') {
              toast.success('Druckvorbereitung abgeschlossen');
            } else if (method === 'save') {
              // Save action - already handled in SendDocumentModal
              toast.success('Rechnung erfolgreich gespeichert');
            } else if (method === 'post') {
              // Post action - already handled in SendDocumentModal
              toast.success('Per Post versenden wurde bearbeitet');
            }

            // Navigate to invoice list after successful action
            router.push(`/dashboard/company/${uid}/finance/invoices`);
          } catch (error) {
            console.error('Error sending document:', error);
            toast.error('Fehler beim Versenden der Rechnung');
          }
        }}
      />

      {/* Live Preview Modal - NUTZT JETZT DIE GLEICHEN DATEN WIE SendDocumentModal! */}
      <LivePreviewModal
        isOpen={showLivePreview}
        onClose={() => setShowLivePreview(false)}
        document={buildInvoiceDataForPreview()}
        documentType="invoice"
        companyId={uid}
        mode="preview"
        onSaveAsDraft={() => {
          setShowLivePreview(false);
          handleSubmit(true); // Als Entwurf speichern
        }}
      />
    </>
  );
}
