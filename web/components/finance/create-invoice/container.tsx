'use client';

// Container der Rechnungserstellung (Phase 3 des Splits von create-invoice-page.tsx):
// besitzt alle geteilten States, ruft die Hooks in fester Reihenfolge auf
// (Loaders -> computeTotals -> Actions -> Popovers), haelt Script-Preload +
// immer gerendertes SendDocumentModal (via InvoiceModals) zusammen und
// komponiert die vier JSX-Module. Guard bewusst NACH allen Hooks.

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Customer as CustomerType } from '@/components/finance/AddCustomerModal';
import { useNewAuth } from '@/contexts/NewAuthContext';
import { api } from '@/lib/api-client';
import { formatCurrency as formatCurrencyIntl } from '@/lib/currency';
import type { QuoteItem } from '@/services/quoteService';
import type { CreateInvoiceFormData } from '@/types/formData';
import type { InvoiceData, InvoiceData as InvoiceType } from '@/types/invoiceTypes';
import { TaxRuleType } from '@/types/taxRules';
import GeneralInfoCard, {
  InvoiceHeaderBar,
} from '@/components/finance/create-invoice/general-info-card';
import ItemsCard from '@/components/finance/create-invoice/items-card';
import SecondaryCards from '@/components/finance/create-invoice/secondary-cards';
import InvoiceModals, {
  CompanySettingsBanner,
  ComplianceSheetInline,
} from '@/components/finance/create-invoice/invoice-modals';
import {
  computeItemTotalNet,
  computeTotals,
} from '@/components/finance/create-invoice/calc';
import {
  buildInvoiceDataForPreview as buildInvoiceDataForPreviewPure,
  type PreviewDataArgs,
} from '@/components/finance/create-invoice/preview-data';
import { useInvoiceActions } from '@/components/finance/create-invoice/use-invoice-actions';
import { useInvoiceLoaders } from '@/components/finance/create-invoice/use-invoice-loaders';
import { useItemPopovers } from '@/components/finance/create-invoice/use-item-popovers';
import {
  type InvoicePreview,
  getInvoicePreview,
} from '@/lib/buchhaltung-bookings';
import type { NewProductValues } from '@/components/inventory/NewProductModal';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useNextInvoiceNumber } from '@/hooks/useNextInvoiceNumber';
import { InventoryService } from '@/services/inventoryService';

export default function CreateQuotePage() {
  const t = useTranslations('finance');
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useNewAuth();
  // NextDays: kein [uid]-Routenparameter — Tenant kommt aus der Session (user.uid).
  // Fallback auf params.uid erhält Kompatibilität, falls doch als Param übergeben.
  const uid =
    (typeof params?.uid === 'string' ? params.uid : '') || user?.uid || '';
  const prefillCustomerId = searchParams?.get('customerId');
  // „Rechnung aus Buchung" (0092): ?reservation=<id> (Deeplink aus dem
  // Kalender-Slider) ODER Auswahl im Buchungs-Picker.
  const prefillReservationId = searchParams?.get('reservation');
  const {
    nextNumber: nextInvoiceNumber,
    isLoading: nextNumberLoading,
    error: nextNumberError,
  } = useNextInvoiceNumber(uid);

  const [showLivePreview, setShowLivePreview] = useState(false);

  // Erweiterte States für Dienstleistungen
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceDraft, setServiceDraft] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'Stk',
  });
  const [savingService, setSavingService] = useState(false);

  const { settings } = useCompanySettings(uid);

  // UI state
  const [loading, setLoading] = useState(false);
  const [showNet, setShowNet] = useState(true);
  const [paymentDays, setPaymentDays] = useState(14); // Standard 14 Tage

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

  // Lieferdatum State (Einzeldatum vs. Zeitraum)
  const [deliveryDateType, setDeliveryDateType] = useState<'single' | 'range'>('single');
  const [deliveryDateRange, setDeliveryDateRange] = useState<{ from?: Date; to?: Date }>({});

  // Buchungs-Brücke (0092): verknüpfte Reservierung + deren Debitor. Gesetzt
  // durch den ?reservation=-Deeplink aus dem Kalender („Rechnung erstellen");
  // wandert beim Speichern mit ins Payload (Backend prüft Check-in +
  // Doppelrechnung). Kein sichtbares Banner — der Kalender-Klick befüllt das
  // Formular einfach vollständig.
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [reservationCustomerId, setReservationCustomerId] = useState<string | null>(null);
  // Dokumentsprache des Belegs (Rechnungssprache = Gastsprache, 0099);
  // ohne Buchungsbezug bleibt es bei Deutsch.
  const [documentLanguage, setDocumentLanguage] = useState('de');

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

  // Company Settings Modal/Versand-State (Banner + Formulardaten kommen aus useInvoiceLoaders)
  const [showCompanySettingsModal, setShowCompanySettingsModal] = useState(false);
  const [showSendDocumentModal, setShowSendDocumentModal] = useState(false);
  const [createdDocument, setCreatedDocument] = useState<InvoiceType | null>(null);

  // Skonto-UI-State
  const [skontoEnabled, setSkontoEnabled] = useState<boolean>(false);
  const [skontoDays, setSkontoDays] = useState<number | undefined>(undefined);
  const [skontoPercentage, setSkontoPercentage] = useState<number | undefined>(undefined);
  const [skontoText, setSkontoText] = useState<string>('');

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
    headTextHtml: t('container.defaultHeadTextHtml'),
    footerText: t('container.defaultFooterText'),
    notes: '',
    // Leer = "noch nicht gesetzt" (Wurzel 4: kein EUR-Seed als Doppel-Sentinel).
    // use-invoice-loaders uebernimmt dann company.defaultCurrency.
    currency: '',
    internalContactPerson: '',
    deliveryTerms: '',
    paymentTerms: t('container.defaultPaymentTerms'),
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
      description: t('container.defaultItemDescription'),
      quantity: 1,
      unitPrice: 0,
      total: 0,
    },
  ]);

  // „Rechnung aus Buchung": Backend-Vorbefüllung anwenden (EINE Routine für
  // ?reservation=-Deeplink UND Buchungs-Picker). Kunde + Positionen (netto,
  // inkl. Upsells mit Snapshot-Steuersatz) + Währung + Aufenthaltszeitraum
  // kommen aus /buchhaltung/invoice-preview — dieselbe Logik wie die
  // automatische Check-out-Rechnung (eine Quelle der Wahrheit).
  const applyReservationPreview = (p: InvoicePreview) => {
    setReservationId(p.reservationId);
    setReservationCustomerId(p.customerId);
    setDocumentLanguage(p.guestLanguage || 'de');
    // Firmengast (Gästemappe „Firma") → Empfänger ist die Organisation,
    // sonst Privatperson mit Vor-/Nachname aus der Gästemappe.
    const isOrg = !!p.company;
    setContactType(isOrg ? 'organisation' : 'person');
    // Adresse aus der Gästemappe im Formular-Format des Anschrift-Blocks:
    // Zeile 0 = Straße + Nr., Zeile 1 = "PLZ Ort", Zeile 2 = Land.
    const addressText = p.address
      ? [
          [p.address.street, p.address.houseNo].filter(Boolean).join(' '),
          [p.address.postalCode, p.address.city].filter(Boolean).join(' '),
          p.address.country,
        ].join('\n')
      : '';
    setFormData(prev => ({
      ...prev,
      customerName: isOrg ? p.company : p.customerName,
      customerFirstName: p.customerFirstName,
      customerLastName: p.customerLastName,
      customerEmail: p.customerEmail,
      customerNumber: p.customerNumber,
      customerAddress: addressText || prev.customerAddress,
      customerOrderNumber: prev.customerOrderNumber,
      currency: p.currency,
      servicePeriod: `${p.stay.from} – ${p.stay.to}`,
    }));
    setDeliveryDateType('range');
    setDeliveryDateRange({
      from: new Date(`${p.stay.from}T00:00:00`),
      to: new Date(`${p.stay.to}T00:00:00`),
    });
    setItems(
      p.items.map(it => ({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice, // netto (Backend rechnet Brutto→Netto zurück)
        total: it.quantity * it.unitPrice,
        taxRate: it.taxRate,
        unit: it.unit,
        category: 'Aufenthalt',
      })),
    );
  };

  const loadReservationPreview = async (rid: string) => {
    const res = await getInvoicePreview(rid);
    if (res.ok) {
      applyReservationPreview(res.data);
      toast.success(t('container.reservationApplied'));
    } else {
      // Klartext vom Backend (z. B. „noch nicht eingecheckt", „Rechnung
      // existiert bereits", „Übernachtungs-Steuersatz fehlt").
      toast.error(res.error);
    }
  };

  // Deeplink ?reservation=<id> (z. B. „Rechnung erstellen (vorab)" im Kalender).
  useEffect(() => {
    if (prefillReservationId) void loadReservationPreview(prefillReservationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Mount/Param-Wechsel
  }, [prefillReservationId]);

  // Lade-Effekte (Kunden, Firma, Dienstleistungen, Vorlagen, Nummernkreis, E-Rechnung, Defaults)
  const {
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
  } = useInvoiceLoaders({
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
  });

  // Summen (Rabatt-Positionen abziehen) inkl. Steuersatz-Gruppierung
  // — pure Berechnung, bewusst vor den Action-/Popover-Hooks
  const { subtotal, vat, grandTotal, taxGrouped } = computeTotals(items, taxRate);

  // Handler + Datums-Sync. Zyklen-Auflösung: useInvoiceActions läuft VOR useItemPopovers
  // und liefert handleItemChange, das unten an useItemPopovers durchgereicht wird.
  const {
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
  } = useInvoiceActions({
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
  });


  // Popover-Cluster (Debounce, Produkt-Prompt, Inventar-Auto-Mapping)
  const { popoverOpenIds, handleDescriptionChange } = useItemPopovers({
    uid,
    items,
    setItems,
    dismissedCreatePromptIds,
    createProductOpen,
    handleItemChange,
  });

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

  // Currency-Formatter (Währung aus den Formulardaten, kein €-Hardcode)
  const formatCurrency = (amount: number) => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    try {
      return formatCurrencyIntl(safeAmount, formData.currency);
    } catch {
      return `${safeAmount.toFixed(2)} ${formData.currency}`;
    }
  };

  // Args-Objekt für die pure Vorschau-Aufbereitung aus dem Component-Scope füllen
  const previewArgs = (): PreviewDataArgs => ({
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
  });

  // Formulardaten für LivePreviewModal konvertieren (gleiche Daten wie SendDocumentModal)
  const buildInvoiceDataForPreview = (): InvoiceData =>
    buildInvoiceDataForPreviewPure(previewArgs());

  // Guard
  const isOwner = user?.uid === uid;
  const isEmployee = user?.user_type === 'mitarbeiter' && user?.company_id === uid;

  if (!user || (!isOwner && !isEmployee)) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 font-semibold text-gray-900 text-xl">{t('container.accessDeniedTitle')}</h2>
          <p className="text-gray-600">{t('container.accessDeniedBody')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ✅ Preload html2pdf.js global - wird sofort beim Seitenaufruf geladen */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
        strategy="afterInteractive"
        onError={e => {
          console.error('❌ Fehler beim Laden von html2pdf.js via Next.js Script:', e);
        }}
      />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header - SevDesk Style */}
        <InvoiceHeaderBar
          eInvoiceEnabled={eInvoiceEnabled}
          handleEInvoiceToggle={handleEInvoiceToggle}
          loading={loading}
          handleSubmit={handleSubmit}
          setShowLivePreview={setShowLivePreview}
          handleOpenSendModal={handleOpenSendModal}
        />

        {/* Company Settings Warning Banner */}
        <CompanySettingsBanner
          showCompanySettingsBanner={showCompanySettingsBanner}
          setShowCompanySettingsBanner={setShowCompanySettingsBanner}
          setShowCompanySettingsModal={setShowCompanySettingsModal}
        />

        {/* E-Rechnung Compliance Panel */}
        <ComplianceSheetInline
          showCompliancePanel={showCompliancePanel}
          setShowCompliancePanel={setShowCompliancePanel}
          complianceErrors={complianceErrors}
        />

        {/* Allgemeine Angaben + Kopf-Text */}
        <GeneralInfoCard
          uid={uid}
          userUid={user?.uid || ''}
          formData={formData}
          setFormData={setFormData}
          customers={customers}
          selectCustomer={selectCustomer}
          contactType={contactType}
          setContactType={setContactType}
          showCustomerSearchPopup={showCustomerSearchPopup}
          setShowCustomerSearchPopup={setShowCustomerSearchPopup}
          setCreateCustomerOpen={setCreateCustomerOpen}
          getFieldErrorClass={getFieldErrorClass}
          nextInvoiceNumber={nextInvoiceNumber}
          nextNumberLoading={nextNumberLoading}
          nextNumberError={nextNumberError}
          setShowNumberingModal={setShowNumberingModal}
          handleValidUntilChange={handleValidUntilChange}
          paymentDays={paymentDays}
          setPaymentDays={setPaymentDays}
          deliveryDateType={deliveryDateType}
          setDeliveryDateType={setDeliveryDateType}
          deliveryDateRange={deliveryDateRange}
          setDeliveryDateRange={setDeliveryDateRange}
        />

        {/* Produkte / Positionen */}
        <ItemsCard
          uid={uid}
          items={items}
          setItems={setItems}
          taxRate={taxRate}
          showNet={showNet}
          setShowNet={setShowNet}
          formatCurrency={formatCurrency}
          currency={formData.currency}
          savedServices={savedServices}
          loadingSavedServices={loadingSavedServices}
          serviceModalOpen={serviceModalOpen}
          setServiceModalOpen={setServiceModalOpen}
          serviceDraft={serviceDraft}
          setServiceDraft={setServiceDraft}
          saveServiceToSubcollection={saveServiceToSubcollection}
          popoverOpenIds={popoverOpenIds}
          handleDescriptionChange={handleDescriptionChange}
          handleItemChange={handleItemChange}
          removeItem={removeItem}
          setDismissedCreatePromptIds={setDismissedCreatePromptIds}
          setNewProduct={setNewProduct}
          setCreateProductForIndex={setCreateProductForIndex}
          setCreateProductOpen={setCreateProductOpen}
        />

        {/* Fuß-Text, Mehr Optionen, Summen, Interne Notizen */}
        <SecondaryCards
          uid={uid}
          formData={formData}
          setFormData={setFormData}
          showNet={showNet}
          taxRate={taxRate}
          subtotal={subtotal}
          vat={vat}
          grandTotal={grandTotal}
          taxGrouped={taxGrouped}
          skontoEnabled={skontoEnabled}
          setSkontoEnabled={setSkontoEnabled}
          skontoDays={skontoDays}
          setSkontoDays={setSkontoDays}
          skontoPercentage={skontoPercentage}
          setSkontoPercentage={setSkontoPercentage}
          skontoText={skontoText}
          setSkontoText={setSkontoText}
          formatCurrency={formatCurrency}
        />
      </div>

      {/* === MODALS - Außerhalb des Hauptcontainers === */}
      {/* Inline-Logik (Produkt anlegen, Kundenliste neu laden, Versand) bleibt hier als Props-Callbacks */}
      <InvoiceModals
        uid={uid}
        formData={formData}
        setFormData={setFormData}
        contactType={contactType}
        createProductOpen={createProductOpen}
        setCreateProductOpen={setCreateProductOpen}
        newProduct={newProduct}
        creatingProduct={creatingProduct}
        onSaveNewProduct={async vals => {
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

            toast.success(t('container.productCreated'));
            setCreateProductOpen(false);
          } catch (err) {
            console.error(err);
            toast.error(t('container.productCreateFailed'));
          } finally {
            setCreatingProduct(false);
          }
        }}
        showCompanySettingsModal={showCompanySettingsModal}
        setShowCompanySettingsModal={setShowCompanySettingsModal}
        companySettingsFormData={companySettingsFormData}
        setCompanySettingsFormData={setCompanySettingsFormData}
        handleCompanySettingsSave={handleCompanySettingsSave}
        createCustomerOpen={createCustomerOpen}
        setCreateCustomerOpen={setCreateCustomerOpen}
        creatingCustomer={creatingCustomer}
        onCustomerSaved={async _customerId => {
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
            toast.success(t('container.customerCreated'));
          } catch (error) {
            console.error('Fehler beim Aktualisieren der Kundenliste:', error);
          }
        }}
        showNumberingModal={showNumberingModal}
        setShowNumberingModal={setShowNumberingModal}
        numberingFormat={numberingFormat}
        setNumberingFormat={setNumberingFormat}
        nextNumber={nextNumber}
        setNextNumber={setNextNumber}
        showCompliancePanel={showCompliancePanel}
        setShowCompliancePanel={setShowCompliancePanel}
        complianceErrors={complianceErrors}
        showSendDocumentModal={showSendDocumentModal}
        setShowSendDocumentModal={setShowSendDocumentModal}
        createdDocument={createdDocument}
        setCreatedDocument={setCreatedDocument}
        onSendDocument={async (method, options) => {
          try {
            // Get the invoice ID from the created document or options
            const _invoiceId = options?.invoiceId || createdDocument?.id;

            // Then handle the sending logic
            if (method === 'email') {
              toast.success(t('container.sendEmailPrepared'));
            } else if (method === 'download') {
              toast.success(t('container.sendDownloadPrepared'));
            } else if (method === 'print') {
              toast.success(t('container.sendPrintPrepared'));
            } else if (method === 'save') {
              // Save action - already handled in SendDocumentModal
              toast.success(t('container.sendSaved'));
            } else if (method === 'post') {
              // Post action - already handled in SendDocumentModal
              toast.success(t('container.sendPostHandled'));
            }

            // Zur Rechnungsliste (die Alt-Route /dashboard/company/… existiert
            // in NextDays nicht — Rechnungen leben unter /buchhaltung).
            router.push('/buchhaltung');
          } catch (error) {
            console.error('Error sending document:', error);
            toast.error(t('container.sendFailed'));
          }
        }}
        showLivePreview={showLivePreview}
        setShowLivePreview={setShowLivePreview}
        buildInvoiceDataForPreview={buildInvoiceDataForPreview}
        handleSubmit={handleSubmit}
      />
    </>
  );
}
