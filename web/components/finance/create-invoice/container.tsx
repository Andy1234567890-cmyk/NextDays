'use client';

// Container der Rechnungserstellung (Phase 3 des Splits von create-invoice-page.tsx):
// besitzt alle geteilten States, ruft die Hooks in fester Reihenfolge auf
// (Loaders -> computeTotals -> Actions -> Popovers), haelt Script-Preload +
// immer gerendertes SendDocumentModal (via InvoiceModals) zusammen und
// komponiert die vier JSX-Module. Guard bewusst NACH allen Hooks.

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
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
import { computeItemTotalNet, computeTotals } from '@/components/finance/create-invoice/calc';
import {
  buildInvoiceDataForPreview as buildInvoiceDataForPreviewPure,
  type PreviewDataArgs,
} from '@/components/finance/create-invoice/preview-data';
import { useInvoiceActions } from '@/components/finance/create-invoice/use-invoice-actions';
import { useInvoiceLoaders } from '@/components/finance/create-invoice/use-invoice-loaders';
import { mengeAusBasis, naechteAus } from '@/lib/positions-basis';
import { naechteJeZeile } from '@/components/finance/create-invoice/aufenthalt-zeilen';
import { useItemPopovers } from '@/components/finance/create-invoice/use-item-popovers';
import { type InvoicePreview, getInvoicePreview } from '@/lib/buchhaltung-bookings';
import type { NewProductValues } from '@/components/inventory/NewProductModal';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useNextInvoiceNumber } from '@/hooks/useNextInvoiceNumber';
import { InventoryService } from '@/services/inventoryService';
import { type Quote, QuoteService } from '@/services/quoteService';

// Belegart des EINEN Editors: Rechnung (Standard) oder Angebot. Der alte
// Angebots-Editor war eine 4 552-Zeilen-Kopie dieses Formulars; hier schaltet
// die Art nur Titel, Nummernkreis, „Gültig bis", Speicherpfad und Versand-Dialog.
export type Belegart = 'invoice' | 'quote';

export default function CreateQuotePage({
  belegart: belegartProp,
  editQuoteId = null,
}: {
  belegart?: Belegart;
  /** Bestehendes Angebot bearbeiten: Formular aus dem Beleg befüllen, Speichern = PATCH. */
  editQuoteId?: string | null;
} = {}) {
  const t = useTranslations('finance');
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const belegart: Belegart =
    belegartProp ?? (searchParams?.get('belegart') === 'quote' ? 'quote' : 'invoice');
  const { user } = useNewAuth();
  // NextDays: kein [uid]-Routenparameter — Tenant kommt aus der Session (user.uid).
  // Fallback auf params.uid erhält Kompatibilität, falls doch als Param übergeben.
  const uid = (typeof params?.uid === 'string' ? params.uid : '') || user?.uid || '';
  const prefillCustomerId = searchParams?.get('customerId');
  // „Rechnung aus Buchung" (0092): ?reservation=<id> (Deeplink aus dem
  // Kalender-Slider) ODER Auswahl im Buchungs-Picker.
  const prefillReservationId = searchParams?.get('reservation');
  // „Als Vorlage verwenden": bestehendes Angebot als Startpunkt eines NEUEN
  // (Positionen/Texte/Kunde übernehmen, Nummer und Datum neu).
  const vorlageQuoteId = searchParams?.get('vorlage');
  const {
    nextNumber: naechsteNummer,
    isLoading: nextNumberLoading,
    error: nextNumberError,
  } = useNextInvoiceNumber(uid, belegart);
  // Beim Bearbeiten trägt der Beleg seine Nummer schon — die wird angezeigt,
  // nicht die nächste freie (die gehört dem nächsten NEUEN Angebot).
  const [bearbeiteNummer, setBearbeiteNummer] = useState<string | null>(null);
  const nextInvoiceNumber = bearbeiteNummer ?? naechsteNummer;

  const [showLivePreview, setShowLivePreview] = useState(false);

  // Erweiterte States für Dienstleistungen
  // Der Dialog „Neue Leistung" lebt seit 0698 in der Preisliste; der Actions-Hook
  // verlangt die Setter noch in seiner Signatur.
  const [_serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceDraft, setServiceDraft] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'Stk',
  });
  // Nur der Setter geht nach unten (Leistung-Speichern); den Zustand liest
  // aktuell keine Oberfläche.
  const [, setSavingService] = useState(false);

  const { settings } = useCompanySettings(uid);

  // UI state
  const [loading, setLoading] = useState(false);
  const [showNet, setShowNet] = useState(true);
  const [paymentDays, setPaymentDays] = useState(belegart === 'quote' ? 30 : 14);

  // Produkt-anlegen Prompt/Modal State
  const [dismissedCreatePromptIds, setDismissedCreatePromptIds] = useState<Set<string>>(new Set());
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [createProductForIndex, setCreateProductForIndex] = useState<number | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);
  // Startwert 0 statt eines Regelsatzes: ein Formular, das noch keinen Betrieb
  // kennt, darf keinen Steuersatz behaupten (Wurzel 4 — bisher stand hier eine
  // feste 19, die ein daenischer Betrieb mit 25 % still geerbt haette). Den
  // echten Satz setzt items-card beim Oeffnen der Anlage aus Position bzw.
  // Belegsatz, und der Belegsatz stammt seinerseits aus den Stammdaten
  // (use-invoice-loaders, settings.defaultTaxRate).
  const [newProduct, setNewProduct] = useState<NewProductValues>({
    name: '',
    imageUrl: '',
    sku: '',
    category: 'Artikel',
    unit: 'Stk',
    stock: 0,
    taxRate: 0,
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
  // Angebot = Aufenthalt (Anreise–Abreise) als Vorgabe; Rechnung = Leistungstag.
  const [deliveryDateType, setDeliveryDateType] = useState<'single' | 'range'>(
    belegart === 'quote' ? 'range' : 'single',
  );
  const [deliveryDateRange, setDeliveryDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>({});
  // Personen im Belegkopf (0698) — Menge für Positionen „je Person" / „je Person × Nacht".
  const [guestCount, setGuestCount] = useState<number>(0);
  // Objekt für „Aus Preisliste" (Gebühren/Zusatzleistungen/Abgaben des Objekts) —
  // aus der Buchung vorbelegt, im Dialog wechselbar.
  const [preislisteObjektId, setPreislisteObjektId] = useState<string | null>(null);
  // Anzahlung des Aufenthaltsangebots (0701) als Formularwert; leer = keine.
  const [depositAmount, setDepositAmount] = useState<string>('');
  const naechte = naechteAus(deliveryDateRange.from, deliveryDateRange.to);

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
      // Fälligkeit (Rechnung: heute + 14 Tage) bzw. Gültigkeit (Angebot: 30 Tage)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (belegart === 'quote' ? 30 : 14));
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
      // Erste Zeile ist die Übernachtung (0698): je Nacht; Steuersatz kommt
      // per Effekt aus dem Firmenprofil, sobald es geladen ist.
      basis: 'per_night',
      unit: t('itemsCard.basis.per_night'),
      category: 'Aufenthalt',
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
    if (p.propertyId) setPreislisteObjektId(p.propertyId);
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
    if (typeof p.guestCount === 'number' && p.guestCount > 0) setGuestCount(p.guestCount);
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
        basis: it.basis,
        category: 'Aufenthalt',
        propertyId: it.propertyId || undefined,
        checkIn: it.checkIn || undefined,
        checkOut: it.checkOut || undefined,
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

  // Bestehendes Angebot in den Editor laden — zum Bearbeiten (editQuoteId,
  // Nummer/Datum bleiben) oder als Vorlage (?vorlage=, Nummer und Datum neu).
  const applyQuote = (q: Quote, alsVorlage: boolean) => {
    const adresse =
      typeof q.customerAddress === 'string'
        ? q.customerAddress
        : q.customerAddress
          ? [
              q.customerAddress.street,
              `${q.customerAddress.postalCode} ${q.customerAddress.city}`.trim(),
              q.customerAddress.country,
            ]
              .filter(Boolean)
              .join('\n')
          : '';
    if (!alsVorlage) setBearbeiteNummer(q.number || null);
    setDocumentLanguage(q.language || 'de');
    // Person/Organisation aus dem Debitor — ohne diese Zeile stand jeder
    // geladene Beleg auf dem Vorgabewert „Organisation", auch der eines
    // Privatgastes aus dem Kalender-Angebot (14.09.2026).
    if (q.customerType) setContactType(q.customerType === 'business' ? 'organisation' : 'person');
    setFormData(prev => ({
      ...prev,
      customerName: q.customerName,
      customerEmail: q.customerEmail || '',
      customerNumber: q.customerNumber || '',
      customerAddress: adresse || prev.customerAddress,
      title: q.title || '',
      customerOrderNumber: q.customerOrderNumber || '',
      invoiceDate: alsVorlage ? prev.invoiceDate : q.date.toISOString().split('T')[0],
      validUntil: alsVorlage ? prev.validUntil : q.validUntil.toISOString().split('T')[0],
      headTextHtml: q.headTextHtml || prev.headTextHtml,
      footerText: q.footerText || prev.footerText,
      notes: q.notes || '',
      currency: q.currency || prev.currency,
      taxRule: (q.taxRule as TaxRuleType) || prev.taxRule,
    }));
    if (q.stayFrom && q.stayTo) {
      setDeliveryDateType('range');
      setDeliveryDateRange({
        from: new Date(`${q.stayFrom}T00:00:00`),
        to: new Date(`${q.stayTo}T00:00:00`),
      });
    }
    if (typeof q.guestCount === 'number' && q.guestCount > 0) setGuestCount(q.guestCount);
    if (q.propertyId) setPreislisteObjektId(q.propertyId);
    setDepositAmount(q.depositAmount != null ? String(q.depositAmount) : '');
    if (q.items.length > 0) {
      setItems(
        q.items.map(it => ({
          // Zeilen-ID des Belegs beibehalten: `parentItemId` einer Zusatz-
          // leistung zeigt auf die ID ihrer Übernachtungszeile (0702) — eine
          // neu gewürfelte ID hätte die Zuordnung beim Laden zerrissen.
          id:
            it.id ||
            (typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2)),
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.quantity * it.unitPrice,
          taxRate: it.taxRate,
          unit: it.unit,
          basis: it.basis,
          // Positionen liegen ohne Kategorie in der DB; die Übernachtung ist die
          // Zeile „je Nacht" (so schreibt sie die Kalender-Brücke 0699). Sie
          // trägt Objekt und Zeitraum selbst (0702) — Bestand vor 0702 erbt
          // beides aus dem Belegkopf, statt leer zu stehen.
          category: it.category || (it.basis === 'per_night' ? 'Aufenthalt' : 'Leistung'),
          discountPercent: it.discountPercent,
          extendedDescription: it.extendedDescription,
          propertyId: it.propertyId ?? (it.basis === 'per_night' ? q.propertyId : undefined),
          propertyTitle: it.propertyTitle,
          checkIn: it.checkIn ?? (it.basis === 'per_night' ? q.stayFrom : undefined),
          checkOut: it.checkOut ?? (it.basis === 'per_night' ? q.stayTo : undefined),
          parentItemId: it.parentItemId,
        })),
      );
    }
  };

  useEffect(() => {
    const id = editQuoteId || vorlageQuoteId;
    if (!id) return;
    let aktuell = true;
    QuoteService.getQuote(id)
      .then(q => {
        if (!aktuell) return;
        if (!q) {
          toast.error(t('container.quoteNotFound'));
          return;
        }
        applyQuote(q, !editQuoteId);
      })
      .catch(err => {
        console.error('angebot_laden_fehlgeschlagen', err);
        toast.error(t('container.quoteNotFound'));
      });
    return () => {
      aktuell = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Mount/Param-Wechsel
  }, [editQuoteId, vorlageQuoteId]);

  // Lade-Effekte (Kunden, Firma, Dienstleistungen, Vorlagen, Nummernkreis, E-Rechnung, Defaults)
  const {
    customers,
    setCustomers,
    company,
    setCompany,
    showCompanySettingsBanner,
    setShowCompanySettingsBanner,
    companySettingsFormData,
    setCompanySettingsFormData,
    taxRate,
    selectedTemplate,
  } = useInvoiceLoaders({
    uid,
    user,
    belegart,
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
    guestCount,
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
    belegart,
    editQuoteId,
    propertyId: preislisteObjektId,
    depositAmount,
  });

  // Übernachtungssatz des Betriebs aus dem Firmenprofil (String im Formular) —
  // null = nicht hinterlegt; die Positionskarte lässt das Feld dann leer (Wurzel 4).
  const lodgingTaxRateZahl = (() => {
    const r = parseFloat(companySettingsFormData.lodgingTaxRate);
    return Number.isFinite(r) ? r : null;
  })();

  // Kopfdaten → Mengen (0698): ändern sich Nächte oder Personen, folgen die
  // Positionen mit Basis je Nacht / je Person / je Person × Nacht. Stück und
  // pauschal bleiben unberührt.
  // Zeilen mit EIGENEM Zeitraum (0702) folgen ihrem eigenen, nicht dem Kopf.
  useEffect(() => {
    setItems(prev => {
      let geaendert = false;
      const karte = naechteJeZeile(prev, naechte);
      const next = prev.map(it => {
        if (!it.basis || it.basis === 'per_unit' || it.basis === 'per_stay') return it;
        const menge = mengeAusBasis(it.basis, karte.get(it.id) ?? naechte, guestCount);
        if (menge === null || menge === it.quantity) return it;
        geaendert = true;
        return {
          ...it,
          quantity: menge,
          total: computeItemTotalNet(menge, it.unitPrice),
        };
      });
      return geaendert ? next : prev;
    });
  }, [naechte, guestCount]);

  // Übernachtungssatz nachtragen, sobald das Firmenprofil geladen ist — nur auf
  // Übernachtungszeilen, die noch keinen Satz tragen (kein Überschreiben).
  useEffect(() => {
    if (lodgingTaxRateZahl === null) return;
    setItems(prev => {
      let geaendert = false;
      const next = prev.map(it => {
        if (it.category !== 'Aufenthalt' || it.taxRate !== undefined) return it;
        geaendert = true;
        return { ...it, taxRate: lodgingTaxRateZahl };
      });
      return geaendert ? next : prev;
    });
  }, [lodgingTaxRateZahl]);

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
  //
  // useCallback ist hier PFLICHT, nicht Feinschliff: `invoice-modals.tsx` ruft
  // die Funktion direkt im JSX auf (`document={buildInvoiceDataForPreview()}`).
  // Ohne stabile Referenz entstand bei jedem Render ein neues Objekt, und die
  // `document`-Dependencies in LivePreviewModal feuerten endlos.
  const buildInvoiceDataForPreview = useCallback(
    (): InvoiceData => buildInvoiceDataForPreviewPure(previewArgs()),
    // previewArgs liest diese Werte aus dem Component-Scope; fehlte einer,
    // zeigte die Vorschau einen veralteten Stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
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
    ],
  );

  // Guard
  const isOwner = user?.uid === uid;
  const isEmployee = user?.user_type === 'mitarbeiter' && user?.company_id === uid;

  if (!user || (!isOwner && !isEmployee)) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 font-semibold text-gray-900 text-xl">
            {t('container.accessDeniedTitle')}
          </h2>
          <p className="text-gray-600">{t('container.accessDeniedBody')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Kein html2pdf.js-Preload mehr: seit dem Umzug auf die PDF-API
          (/api/v1/generate-pdf-single, SendDocumentModal) liest keine Stelle
          `window.html2pdf`; das CDN-Skript warf nur noch einen Ladefehler in
          die Konsole (13.09.2026). */}
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header - SevDesk Style */}
        <InvoiceHeaderBar
          belegart={belegart}
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
          belegart={belegart}
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
          guestCount={guestCount}
          setGuestCount={setGuestCount}
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
          documentLanguage={documentLanguage}
          lodgingTaxRate={lodgingTaxRateZahl}
          naechte={naechte}
          personen={guestCount}
          onPersonen={setGuestCount}
          objektId={preislisteObjektId}
          setObjektId={setPreislisteObjektId}
          aufenthaltVon={deliveryDateRange.from?.toISOString().split('T')[0] ?? ''}
          aufenthaltBis={deliveryDateRange.to?.toISOString().split('T')[0] ?? ''}
          onAufenthalt={e => {
            // Kopf folgt dem bepreisten Aufenthalt: Objekt, Zeitraum, Personen, Währung.
            setPreislisteObjektId(e.propertyId);
            setDeliveryDateType('range');
            setDeliveryDateRange({
              from: new Date(`${e.checkIn}T00:00:00`),
              to: new Date(`${e.checkOut}T00:00:00`),
            });
            setGuestCount(e.guests);
            setFormData(prev => ({
              ...prev,
              currency: e.currency || prev.currency,
            }));
          }}
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
          userUid={user?.uid || ''}
          belegart={belegart}
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
          depositAmount={depositAmount}
          setDepositAmount={setDepositAmount}
        />
      </div>

      {/* === MODALS - Außerhalb des Hauptcontainers === */}
      {/* Inline-Logik (Produkt anlegen, Kundenliste neu laden, Versand) bleibt hier als Props-Callbacks */}
      <InvoiceModals
        belegart={belegart}
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
            router.push(belegart === 'quote' ? '/buchhaltung/angebote' : '/buchhaltung');
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
