'use client';

import { Icon } from '@iconify/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@tasko/ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useNewAuth } from '@/contexts/NewAuthContext';
import {
  DOCUMENT_LANGUAGES,
  DOCUMENT_LANGUAGE_LABELS,
} from '@/hooks/pdf/document-translations';
import { resolveDocumentLanguage } from '@/hooks/pdf/useDocumentTranslation';
import { api } from '@/lib/api-client';
import { type BackendInvoice, invoiceToDocument } from '@/lib/invoice-document';
import { formatDate } from '@/lib/utils';
// PDF-API wird serverseitig verwendet - keine Client-Dependencies nötig
import { InvoiceService } from '@/services/firestoreInvoiceService';
import type { Quote } from '@/services/quoteService';
import type { GoBDLockStatus } from '@/types/gobdTypes';
import type { InvoiceData } from '@/types/invoiceTypes';
import type { TaxRuleType } from '@/types/taxRules';

// E-Invoice data structure matching InvoiceData.eInvoiceData
interface EInvoiceData {
  format: string;
  version: string;
  guid: string;
  xmlUrl?: string;
  validationStatus?: 'valid' | 'invalid' | 'pending';
  createdAt: string;
}

// Base document type with common fields between Invoice and Quote
interface BaseDocument {
  id: string;
  number: string;
  customerName: string;
  customerEmail: string;
  customerAddress?: string | { street: string; city: string; postalCode: string; country: string };
  customerNumber?: string;
  customerOrderNumber?: string;
  total: number;
  status: string;
  notes?: string;
  footerText?: string;
  headTextHtml?: string;
  title?: string;
  currency?: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    taxRate?: number;
    unit?: string;
    discountPercent?: number;
  }>;
  // Skonto fields (shared)
  skontoEnabled?: boolean;
  skontoDays?: number;
  skontoPercentage?: number;
  skontoText?: string;
  // Tax rule fields
  taxRule?: string;
  taxRuleType?: string;
  paymentTerms?: string;
  // Date fields (string for compatibility)
  date: string | Date;
}

// Document type that can have optional fields from various document types
interface DocumentWithGoBD extends BaseDocument {
  gobdStatus?: GoBDLockStatus;
  totalAmount?: number; // Alternative field name for total
  validUntil?: string; // Quote-specific field
  // Invoice-specific fields (optional)
  invoiceNumber?: string;
  sequentialNumber?: number;
  issueDate?: string;
  dueDate?: string;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyWebsite?: string;
  companyLogo?: string;
  companyVatId?: string;
  companyTaxNumber?: string;
  customerVatId?: string;
  documentNumber?: string;
  bankDetails?: {
    iban: string;
    bic?: string;
    accountHolder: string;
    bankName?: string;
  };
  tax?: number;
  amount?: number;
  vatRate?: number;
  eInvoiceData?: EInvoiceData;
  // Steuerregelfelder fuer korrekte Speicherung
  taxRuleLabel?: string;
  isSmallBusiness?: boolean;
  // Dokumentsprache des Belegs (0099, Gastsprache) — belegt die Sprach-
  // Auswahl im Dialog vor; fehlt sie (Bestand/manuell) → de.
  language?: string | null;
}

// Send options for email/download/print actions
interface SendOptions {
  recipientEmail?: string;
  subject?: string;
  message?: string;
  sendCopy?: boolean;
  pdfBlob?: Blob;
  [key: string]: unknown;
}

// Invoice data for saving - extends InvoiceData with optional fields
type InvoiceToSave = Partial<InvoiceData> & {
  companyId: string;
  customerName: string;
  items: InvoiceData['items'];
  total: number;
  invoiceNumber: string;
  number: string;
  sequentialNumber: number;
  createdAt: Date;
  updatedAt: Date;
};

import { useGoBDActionWarning } from '@/components/finance/gobd';
import { useTemplatePageDetection } from '@/hooks/useTemplatePageDetection';
import { A4_DIMENSIONS } from '@/utils/a4-page-utils';
import { EmailSendModal } from './EmailSendModal';
import PDFTemplate from './PDFTemplates';
import type { PDFTemplateProps } from './pdf-templates';
import { SimplePDFViewer } from './SimplePDFViewer';
import { NativeSelect } from '@/components/ui/native-select';

interface SendDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentWithGoBD;
  documentType: 'invoice' | 'quote' | 'reminder' | 'credit-note' | 'cancellation';
  companyId: string;
  onSend?: (
    method: 'email' | 'download' | 'print' | 'save' | 'post',
    options?: SendOptions,
  ) => Promise<void>;
  redirectAfterAction?: string | ((documentId: string, documentType: string) => string);
}

interface CompanyResponse {
  companyName?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  companyPhoneNumber?: string;
  website?: string;
  companyWebsite?: string;
  companyStreet?: string;
  companyHouseNumber?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyCountry?: string;
  vatId?: string;
  taxNumber?: string;
  profilePictureURL?: string;
  profilePictureFirebaseUrl?: string;
  companyLogo?: string;
  gobdSettings?: {
    autoLockConsent?: boolean;
  };
}

type SendOption =
  | 'email'
  | 'mail'
  | 'print'
  | 'save'
  | 'download'
  | 'logo'
  | 'color'
  | 'layout'
  | 'settings'
  | 'einvoice';

// Template State Management with useReducer
interface _TemplateState {
  layout: string;
  color: string;
  logoUrl: string | null;
  logoFile: File | null;
  logoSize: number;
  pageMode: 'single' | 'multi';
  zoomLevel: number;
  activeOption: SendOption;
  expandedSections: Set<SendOption>;
}

type _TemplateAction =
  | { type: 'SET_LAYOUT'; payload: string }
  | { type: 'SET_COLOR'; payload: string }
  | { type: 'SET_LOGO'; payload: { url: string | null; file: File | null } }
  | { type: 'SET_LOGO_SIZE'; payload: number }
  | { type: 'SET_PAGE_MODE'; payload: 'single' | 'multi' }
  | { type: 'SET_ZOOM_LEVEL'; payload: number }
  | { type: 'SET_ACTIVE_OPTION'; payload: SendOption }
  | { type: 'TOGGLE_SECTION'; payload: SendOption }
  | { type: 'RESET' };

const DOCUMENT_TYPE_LABELS = {
  invoice: 'Rechnung',
  quote: 'Angebot',
  reminder: 'Erinnerung',
  'credit-note': 'Gutschrift',
  cancellation: 'Storno',
} as const;

export function SendDocumentModal({
  isOpen,
  onClose,
  document,
  documentType,
  companyId,
  onSend,
  redirectAfterAction,
}: SendDocumentModalProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [showCompanySettings, setShowCompanySettings] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const templateRef = useRef<HTMLDivElement>(null);
  const [autoLockConsent, setAutoLockConsent] = useState<boolean | null>(null);
  // PDF-API ist immer bereit - keine Client-Library nötig

  // Auth Context für Auto-Lock
  const { user } = useNewAuth();

  // ✅ Dynamic redirect handler
  const handleRedirectAfterAction = useCallback(
    (invoiceId?: string) => {
      if (!redirectAfterAction || !invoiceId) return;

      let redirectUrl: string;

      if (typeof redirectAfterAction === 'function') {
        // Function: Custom redirect logic
        redirectUrl = redirectAfterAction(invoiceId, documentType);
      } else {
        // String: Direct URL or template
        redirectUrl = redirectAfterAction
          .replace('{documentId}', invoiceId)
          .replace('{companyId}', companyId);
      }

      router.push(redirectUrl);
    },
    [redirectAfterAction, documentType, companyId, router],
  );

  // GoBD Action Warning Hook
  const { showWarning, WarningComponent } = useGoBDActionWarning(); // Document Settings States
  const [documentSettings, setDocumentSettings] = useState({
    // Dokumentsprache aus dem Beleg vorbelegen (Rechnungssprache =
    // Gastsprache, 0099). Bei „immer gemountetem" Modal ist document beim
    // ersten Render leer — der Effekt unten zieht die Sprache nach, sobald das
    // Dokument gesetzt ist. Manuell im Dialog umstellbar.
    language: resolveDocumentLanguage(document?.language),
    showQRCode: false,
    showEPCQRCode: false,
    showCustomerNumber: false, // ✅ Deaktiviert - User muss selbst aktivieren
    showContactPerson: false, // ✅ Deaktiviert - User muss selbst aktivieren
    showVATPerPosition: false,
    showArticleNumber: false,
    showFoldLines: true,
    showPageNumbers: true,
    showFooter: true,
    showWatermark: false,
  });

  const [emailMessage, setEmailMessage] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendCopy, _setSendCopy] = useState(false);

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [_activeOption, setActiveOption] = useState<SendOption>('download'); // Start with download like SevDesk
  const [expandedSections, setExpandedSections] = useState<Set<SendOption>>(
    new Set(['download', 'layout', 'color']),
  );
  const [zoomLevel, setZoomLevel] = useState(4); // Start at 100% zoom (index 4 in zoomLevels)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(50); // Logo size in percentage
  const [selectedLayout, setSelectedLayout] = useState('TEMPLATE_NEUTRAL');
  const [selectedColor, setSelectedColor] = useState('var(--accent)');

  // 🤖 SMART DEFAULT: Start with single as default, then auto-adjust
  const [pageMode, setPageMode] = useState<'single' | 'multi'>('single');
  const [manualOverride, setManualOverride] = useState(false);

  // 💰 SKONTO-STATES (NUR FÜR DATENBANK-SPEICHERUNG!)
  const [skontoEnabled, setSkontoEnabled] = useState<boolean | undefined>(document?.skontoEnabled);
  const [skontoDays, setSkontoDays] = useState<number | undefined>(document?.skontoDays);
  const [skontoPercentage, setSkontoPercentage] = useState<number | undefined>(
    document?.skontoPercentage,
  );
  const [skontoText, setSkontoText] = useState<string | undefined>(document?.skontoText);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // E-Invoice specific states
  const [eInvoiceData, setEInvoiceData] = useState<EInvoiceData | null>(null);
  const [loadingEInvoiceData, setLoadingEInvoiceData] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [_epcQrCodeUrl, setEpcQrCodeUrl] = useState<string | null>(null);
  const [realDocumentData, setRealDocumentData] = useState<InvoiceData | null>(null);
  const [enrichedDocumentData, setEnrichedDocumentData] = useState<InvoiceData | null>(null);
  const [_templateReady, setTemplateReady] = useState(true); // Start optimistically as ready
  const [cachedHtml, setCachedHtml] = useState<string | null>(null);
  const [preExtractedHtml, setPreExtractedHtml] = useState<string | null>(null);

  // 🤖 INITIAL SETUP: Set smart mode when document loads
  useEffect(() => {
    const newItemsCount = document?.items?.length || 0;
    const _newSmartMode = newItemsCount >= 3 ? 'multi' : 'single';

    // Set initial mode when document first loads (not manually overridden)
    if (newItemsCount > 0 && !manualOverride) {
      setPageMode(_newSmartMode);
    }
  }, [document?.items?.length, manualOverride]);

  // 🚨 CRITICAL: Clear cached HTML when pageMode changes OR template updates
  useEffect(() => {
    setCachedHtml(null);
    setPreExtractedHtml(null);
  }, []);

  // 🔥 FORCE CACHE CLEAR: Clear HTML cache when component updates (force fresh render)
  useEffect(() => {
    setCachedHtml(null);
    setPreExtractedHtml(null);
  }, []);

  // 💰 KRITISCH: Skonto-States aktualisieren wenn sich Document ändert
  useEffect(() => {
    setSkontoEnabled(document?.skontoEnabled);
    setSkontoDays(document?.skontoDays);
    setSkontoPercentage(document?.skontoPercentage);
    setSkontoText(document?.skontoText);
  }, [
    document?.skontoEnabled,
    document?.skontoDays,
    document?.skontoPercentage,
    document?.skontoText,
  ]);

  // 🎯 Handle manual pageMode changes
  const handlePageModeChange = (newPageMode: 'single' | 'multi') => {
    setPageMode(newPageMode);
    setManualOverride(true); // User has manually overridden the smart detection
  };

  // Template Page Detection
  const _templatePageInfo = useTemplatePageDetection({
    templateId: selectedLayout,
    documentData: { items: (realDocumentData || document)?.items },
    enableDynamicAnalysis: true,
  });

  // QR-Code Generierung (stabile useCallback Funktionen für useEffect-Deps)
  const generateQRCode = useCallback(
    async (_guid: string, _invoiceData: DocumentWithGoBD) => {
      try {
        let qrContent: string;
        if (documentType === 'quote') {
          qrContent = 'https://nextdays.de';
        } else if (documentType === 'invoice') {
          qrContent = 'https://nextdays.de/kontakt';
        } else {
          qrContent = 'https://nextdays.de';
        }
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrContent)}`;
        setQrCodeUrl(qrUrl);
        setDocumentSettings(prev => ({
          ...prev,
          qrCodeUrl: qrUrl,
        }));
      } catch (error) {
        console.error('\u274c Error generating QR Code:', error);
      }
    },
    [documentType],
  );

  // EPC QR-Code (Girocode) Generierung
  const generateEPCQRCode = useCallback(async (invoiceData: DocumentWithGoBD) => {
    try {
      const docWithExtras = invoiceData;
      const inv = invoiceData as any;
      const bank = inv.bankDetails || {};
      const epcIban = (bank.iban || inv.iban || '').replace(/\s+/g, '');
      const epcBic = bank.bic || inv.bic || '';
      const epcHolder = bank.accountHolder || inv.companyName || '';
      // Ohne echte IBAN keinen QR mit Fremddaten erzeugen.
      if (!epcIban) {
        setEpcQrCodeUrl(null);
        return;
      }
      // EPC/Girocode (SEPA Credit Transfer) unterstützt ausschließlich EUR.
      // NUR bei explizit als EUR ausgewiesener Rechnung einen QR erzeugen. Bei
      // Fremdwährung ODER leerer/fehlender Belegwährung KEINEN QR — ein EUR-Präfix
      // auf einen CHF/PLN- oder währungslosen Betrag ergäbe eine falsche
      // Überweisungssumme (kein erfundener EUR-Default).
      const docCurrency = (inv.currency || '').toUpperCase();
      if (docCurrency !== 'EUR') {
        setEpcQrCodeUrl(null);
        return;
      }
      const epcData = [
        'BCD',
        '002',
        '1',
        'SCT',
        epcBic,
        epcHolder,
        epcIban,
        `EUR${(docWithExtras.total || docWithExtras.totalAmount || 0).toFixed(2)}`,
        '',
        `RE-${invoiceData.invoiceNumber || invoiceData.number || ''}`,
        '',
      ].join('\n');
      const epcQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(epcData)}`;
      setEpcQrCodeUrl(epcQrUrl);
      setDocumentSettings(prev => ({
        ...prev,
        epcQrCodeUrl: epcQrUrl,
      }));
    } catch (error) {
      console.error('\u274c Error generating EPC QR Code:', error);
    }
  }, []);

  // Document type labels
  const documentLabels = DOCUMENT_TYPE_LABELS;

  // Load real invoice data from database when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadRealDocumentData = async () => {
      if (!companyId) return; // Check companyId inside the function
      setLoadingEInvoiceData(true);

      try {
        // Wenn document.id vorhanden ist, lade echte Daten aus der Datenbank
        if (document?.id) {
          let realDoc: InvoiceData | Quote | null = null;

          // Je nach Dokumenttyp den entsprechenden Service verwenden
          if (documentType === 'quote') {
            const { QuoteService } = await import('@/services/quoteService');
            realDoc = await QuoteService.getQuote(document.id);
          } else if (documentType === 'invoice') {
            const { InvoiceService } = await import('@/services/firestoreInvoiceService');
            realDoc = await InvoiceService.getInvoiceById(companyId, document.id);
          }

          if (realDoc) {
            // FastAPI liefert die Rechnung snake_case (InvoiceResponse) —
            // in die camelCase-Dokumentform übersetzen; Felder, die das
            // Backend nicht am Beleg speichert (Empfänger/Firma), kommen aus
            // dem übergebenen document.
            if ('invoice_number' in (realDoc as unknown as Record<string, unknown>)) {
              const mapped = invoiceToDocument(realDoc as unknown as BackendInvoice, {
                customerName: document?.customerName,
                customerEmail: document?.customerEmail,
                customerAddress:
                  typeof document?.customerAddress === 'string'
                    ? document.customerAddress
                    : undefined,
              });
              realDoc = { ...document, ...mapped } as unknown as InvoiceData;
              // Dokumentsprache des Belegs (0099) in die Sprach-Auswahl übernehmen.
              if (mapped.language) {
                setDocumentSettings(prev => ({
                  ...prev,
                  language: resolveDocumentLanguage(mapped.language),
                }));
              }
            }
            // Cast to InvoiceData for setRealDocumentData (which expects InvoiceData)
            setRealDocumentData(realDoc as InvoiceData);

            // Lade E-Invoice-Daten wenn vorhanden (nur für Rechnungen)
            const invoiceDoc = realDoc as DocumentWithGoBD;
            if (documentType === 'invoice' && invoiceDoc?.eInvoiceData) {
              setEInvoiceData(invoiceDoc.eInvoiceData);

              // Generiere QR-Code für E-Invoice
              if (invoiceDoc.eInvoiceData.guid) {
                await generateQRCode(invoiceDoc.eInvoiceData.guid, invoiceDoc as InvoiceData);
              }
            }

            // Set default email
            if (realDoc?.customerEmail) {
              setRecipientEmail(realDoc.customerEmail);
            }
          } else {
            setRealDocumentData(document as InvoiceData);
          }
        } else {
          // Für neue Dokumente (ohne ID): Verwende direkt die übergebenen Daten
          setRealDocumentData(document as InvoiceData);

          // Set default email from document
          if (document.customerEmail) {
            setRecipientEmail(document.customerEmail);
          }
        }
      } catch (error) {
        console.error('❌ Error loading real document data:', error);
        setRealDocumentData(document as InvoiceData); // Fallback to provided document
        toast.error(`Fehler beim Laden der ${documentLabels[documentType] || 'Dokument'}-Daten`);
      } finally {
        setLoadingEInvoiceData(false);
      }
    };

    loadRealDocumentData();
  }, [isOpen, document?.id, document, documentType, companyId, generateQRCode]);

  // Dokumentsprache aus dem übergebenen Beleg nachziehen (0099). Nötig, weil
  // das Modal im Erstell-Flow „immer gemountet" ist und beim ersten Render ein
  // leeres document bekommt — der useState-Initializer greift dann nicht.
  useEffect(() => {
    if (document?.language) {
      setDocumentSettings(prev => ({
        ...prev,
        language: resolveDocumentLanguage(document.language),
      }));
    }
  }, [document?.language]);

  // Load company data and enrich document data
  useEffect(() => {
    if (!isOpen) return;

    const enrichDocumentWithCompanyData = async () => {
      if (!companyId) return;
      try {
        // Load company data from API
        const companyData = await api.get<CompanyResponse>(`/api/v1/companies/${companyId}`);

        if (companyData) {
          // Lade Auto-Lock-Zustimmung
          const consent = companyData?.gobdSettings?.autoLockConsent || false;
          setAutoLockConsent(consent);

          // Always enrich document data with fresh company info
          setRealDocumentData(prevData => {
            if (!prevData) {
              return prevData;
            }

            const enrichedData = {
              ...prevData,
              // Always use fresh company data
              companyName: companyData?.companyName || companyData?.name || prevData.companyName,
              companyEmail: companyData?.email || prevData.companyEmail || '',
              companyPhone:
                companyData?.phoneNumber ||
                companyData?.companyPhoneNumber ||
                prevData.companyPhone ||
                '',
              companyWebsite:
                companyData?.website ||
                companyData?.companyWebsite ||
                prevData.companyWebsite ||
                '',
              companyAddress: (() => {
                const address = [
                  [
                    companyData?.companyStreet?.replace(/\s+/g, ' ').trim(),
                    companyData?.companyHouseNumber,
                  ]
                    .filter(Boolean)
                    .join(' '),
                  [companyData?.companyPostalCode, companyData?.companyCity]
                    .filter(Boolean)
                    .join(' '),
                  companyData?.companyCountry,
                ]
                  .filter(Boolean)
                  .join('\n');
                return address || prevData.companyAddress || '';
              })(),
              companyVatId: companyData?.vatId || prevData.companyVatId || '',
              companyTaxNumber: companyData?.taxNumber || prevData.companyTaxNumber || '',
              companyLogo:
                companyData?.profilePictureURL ||
                companyData?.profilePictureFirebaseUrl ||
                companyData?.companyLogo ||
                prevData.companyLogo ||
                '',
            };

            // Set company logo if available and no manual logo is set
            const logoToUse =
              companyData?.profilePictureURL ||
              companyData?.profilePictureFirebaseUrl ||
              companyData?.companyLogo;
            if (logoToUse && !logoUrl) {
              setLogoUrl(logoToUse);
            }

            // Also set the enriched data in a separate state for immediate use
            setEnrichedDocumentData(enrichedData);

            return enrichedData;
          });
        }
      } catch (error) {
        console.error('❌ Error loading company data:', error);
        // Don't show error to user, just use existing data
      }
    };

    // Delay to ensure realDocumentData is set first
    const timer = setTimeout(() => {
      enrichDocumentWithCompanyData();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, companyId, logoUrl]); // ✅ FIX: realDocumentData removed to prevent infinite loop

  // PDF-API ist serverseitig verfügbar - keine Client-Library-Checks nötig

  // Generate QR Code when showQRCode is enabled
  useEffect(() => {
    if (documentSettings.showQRCode && (realDocumentData || document)) {
      const docData = (realDocumentData || document) as DocumentWithGoBD;
      const guid = docData?.eInvoiceData?.guid || 'default-guid';
      generateQRCode(guid, docData as InvoiceData);
    } else {
      setQrCodeUrl(null); // Clear QR code when disabled
      setDocumentSettings(prev => ({
        ...prev,
        qrCodeUrl: undefined,
      }));
    }
  }, [documentSettings.showQRCode, realDocumentData, document, generateQRCode]);

  // Generate EPC QR Code when showEPCQRCode is enabled
  useEffect(() => {
    if (documentSettings.showEPCQRCode && (realDocumentData || document)) {
      const docData = (realDocumentData || document) as DocumentWithGoBD;
      generateEPCQRCode(docData);
    } else {
      setEpcQrCodeUrl(null); // Clear EPC QR code when disabled
      setDocumentSettings(prev => ({
        ...prev,
        epcQrCodeUrl: undefined,
      }));
    }
  }, [documentSettings.showEPCQRCode, realDocumentData, document, generateEPCQRCode]);

  // Generate QR Code for E-Invoice (legacy function for E-Invoice specific QR codes)
  const _generateEInvoiceQRCode = async (guid: string, invoiceData: InvoiceData) => {
    try {
      // E-Invoice QR-Code-Inhalt nach GS1 Standard
      const docWithExtras = invoiceData as DocumentWithGoBD;
      const qrContent = JSON.stringify({
        format: 'ZUGFeRD',
        version: '2.1.1',
        guid: guid,
        invoiceNumber: invoiceData.invoiceNumber || invoiceData.number,
        issueDate: invoiceData.date || invoiceData.issueDate,
        dueDate: invoiceData.dueDate || docWithExtras.validUntil,
        totalAmount: invoiceData.total,
        currency: invoiceData.currency || 'EUR',
        seller: {
          name: invoiceData.companyName,
          vatId: invoiceData.companyVatId,
        },
        buyer: {
          name: invoiceData.customerName,
          vatId: invoiceData.customerVatId,
        },
        downloadUrl: `${window.location.origin}/api/einvoices/${guid}/xml`,
      });

      // Hier würdest du normalerweise eine QR-Code-Bibliothek verwenden
      // Für jetzt erstellen wir eine Placeholder-URL
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrContent)}`;
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('❌ Error generating QR Code:', error);
    }
  };

  // Layout definitions with SVG previews
  const layouts = {
    standard: [
      {
        value: 'TEMPLATE_STANDARD',
        name: 'Standard',
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
            aria-hidden="true"
            focusable="false"
          >
            <rect width="100%" height="100%" rx="4" fill="white"></rect>
            <line y1="5" x2="72" y2="5" stroke={selectedColor} strokeWidth="10"></line>
            <path
              d="M51.2451 29.1655C49.2899 29.1655 47.8906 28.211 47.8906 26.265C47.8906 24.0688 49.605 23.3553 51.6899 23.1885C53.4413 23.0403 54.0807 22.9013 54.0807 22.3175V22.2711C54.0807 21.6873 53.5618 21.2889 52.7185 21.2889C51.8289 21.2889 51.2822 21.7151 51.2173 22.3823H48.252C48.391 20.2603 49.9942 19 52.8297 19C55.6746 19 57.2407 20.251 57.2407 22.4101V28.9987H54.1271V27.6272H54.09C53.5062 28.6836 52.6259 29.1655 51.2451 29.1655ZM52.2181 27.0805C53.2838 27.0805 54.1085 26.4411 54.1085 25.4774V24.5878C53.7657 24.7453 53.1633 24.8658 52.3757 24.9955C51.5231 25.1252 50.9115 25.4774 50.9115 26.1168C50.9115 26.7191 51.4397 27.0805 52.2181 27.0805Z"
              fill="black"
            ></path>
            <line x1="48" y1="44.5" x2="60" y2="44.5" stroke="#060314" strokeOpacity="0.46"></line>
            <line x1="48" y1="48.5" x2="64" y2="48.5" stroke="#060314" strokeOpacity="0.46"></line>
            <line x1="48" y1="52.5" x2="56" y2="52.5" stroke="#060314" strokeOpacity="0.46"></line>
            <line x1="48" y1="83.5" x2="60" y2="83.5" stroke="#060314" strokeOpacity="0.46"></line>
            <line x1="48" y1="87.5" x2="64" y2="87.5" stroke="#060314" strokeOpacity="0.46"></line>
            <line x1="48" y1="91.5" x2="56" y2="91.5" stroke="#060314" strokeOpacity="0.46"></line>
            <line x1="8" y1="45.5" x2="43" y2="45.5" stroke="#F4F2E5" strokeWidth="3"></line>
            <line x1="8" y1="51.5" x2="43" y2="51.5" stroke="#F4F2E5" strokeWidth="3"></line>
            <line x1="8" y1="57.5" x2="43" y2="57.5" stroke="#F4F2E5" strokeWidth="3"></line>
            <line x1="8" y1="63.5" x2="43" y2="63.5" stroke="#F4F2E5" strokeWidth="3"></line>
          </svg>
        ),
      },
      {
        value: 'TEMPLATE_NEUTRAL',
        name: 'Neutral',
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
            aria-hidden="true"
            focusable="false"
          >
            <rect width="100%" height="100%" rx="4" fill="white"></rect>
            <path
              d="M51.3906 30.1406C48.0938 30.1406 45.7344 28.5312 45.7344 25.25C45.7344 21.5469 48.625 20.3438 52.1406 20.0625C55.0938 19.8125 56.1719 19.5781 56.1719 18.5938V18.5156C56.1719 17.5312 55.2969 16.8594 53.875 16.8594C52.375 16.8594 51.4531 17.5781 51.3438 18.7031H46.3438C46.5781 15.125 49.2812 13 54.0625 13C58.8594 13 61.5 15.1094 61.5 18.75V29.8594H56.25V27.5469H56.1875C55.2031 29.3281 53.7188 30.1406 51.3906 30.1406ZM53.0312 26.625C54.8281 26.625 56.2188 25.5469 56.2188 23.9219V22.4219C55.6406 22.6875 54.625 22.8906 53.2969 23.1094C51.8594 23.3281 50.8281 23.9219 50.8281 25C50.8281 26.0156 51.7188 26.625 53.0312 26.625Z"
              fill={selectedColor}
            ></path>
            <line
              x1="12"
              y1="43.5"
              x2="61"
              y2="43.5"
              stroke="#060314"
              strokeOpacity="0.28"
              strokeWidth="3"
            ></line>
            <line
              x1="12"
              y1="49.5"
              x2="61"
              y2="49.5"
              stroke="#060314"
              strokeOpacity="0.28"
              strokeWidth="3"
            ></line>
            <line
              x1="12"
              y1="55.5"
              x2="61"
              y2="55.5"
              stroke="#060314"
              strokeOpacity="0.28"
              strokeWidth="3"
            ></line>
            <line
              x1="12"
              y1="61.5"
              x2="61"
              y2="61.5"
              stroke="#060314"
              strokeOpacity="0.28"
              strokeWidth="3"
            ></line>
            <line x1="12" y1="85.5" x2="24" y2="85.5" stroke={selectedColor}></line>
            <line x1="12" y1="89.5" x2="28" y2="89.5" stroke={selectedColor}></line>
            <line x1="12" y1="93.5" x2="20" y2="93.5" stroke={selectedColor}></line>
            <line x1="40" y1="85.5" x2="52" y2="85.5" stroke={selectedColor}></line>
            <line x1="40" y1="89.5" x2="56" y2="89.5" stroke={selectedColor}></line>
            <line x1="40" y1="93.5" x2="48" y2="93.5" stroke={selectedColor}></line>
          </svg>
        ),
      },
      {
        value: 'TEMPLATE_ELEGANT',
        name: 'Elegant',
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
            aria-hidden="true"
            focusable="false"
          >
            <rect width="100%" height="100%" rx="4" fill="white"></rect>
            <path
              d="M53.4263 29.55C52.6723 29.55 51.9833 29.381 51.3593 29.043C50.7353 28.731 50.2413 28.302 49.8773 27.756C49.5133 27.184 49.3313 26.56 49.3313 25.884C49.3313 24.974 49.6173 24.207 50.1893 23.583C50.7873 22.959 51.6453 22.4 52.7633 21.906L56.1173 20.424C56.6373 20.19 56.9623 19.982 57.0923 19.8C57.2223 19.592 57.2873 19.241 57.2873 18.747L57.3263 16.602C57.3523 15.848 57.2353 15.276 56.9753 14.886C56.7153 14.47 56.3123 14.262 55.7663 14.262C55.4543 14.262 55.1293 14.34 54.7913 14.496C54.4533 14.626 54.2063 14.782 54.0503 14.964C53.9723 15.068 53.9203 15.185 53.8943 15.315C53.8683 15.445 53.8553 15.575 53.8553 15.705C53.8553 15.861 53.8683 16.069 53.8943 16.329C53.9203 16.563 53.9333 16.758 53.9333 16.914C53.9333 17.096 53.7123 17.317 53.2703 17.577C52.8283 17.811 52.3213 18.032 51.7493 18.24C51.1773 18.422 50.6833 18.513 50.2673 18.513C50.0593 18.513 49.8773 18.435 49.7213 18.279C49.5913 18.097 49.5263 17.876 49.5263 17.616C49.5263 17.2 49.6693 16.797 49.9553 16.407C50.2413 16.017 50.7223 15.549 51.3983 15.003C52.1003 14.431 52.8673 13.924 53.6993 13.482C54.5313 13.04 55.3503 12.689 56.1563 12.429C56.9623 12.143 57.6513 12 58.2233 12C59.7053 12 60.8883 12.481 61.7723 13.443C62.6563 14.379 63.0723 15.64 63.0203 17.226L62.8253 24.792C62.7993 25.39 62.8903 25.91 63.0983 26.352C63.3323 26.768 63.6183 26.976 63.9563 26.976C64.4243 26.976 64.8403 26.807 65.2043 26.469C65.2823 26.391 65.3603 26.352 65.4383 26.352C65.5683 26.352 65.6723 26.404 65.7503 26.508C65.8543 26.586 65.9063 26.69 65.9063 26.82C65.9063 27.132 65.6463 27.548 65.1263 28.068C64.6323 28.562 64.0993 28.926 63.5273 29.16C62.9553 29.42 62.3573 29.55 61.7333 29.55C60.2253 29.55 58.9643 28.796 57.9503 27.288H57.8723C57.0143 28.094 56.2473 28.666 55.5713 29.004C54.8953 29.368 54.1803 29.55 53.4263 29.55ZM55.8443 26.859C56.0783 26.859 56.2733 26.82 56.4293 26.742C56.5853 26.664 56.7283 26.534 56.8583 26.352C56.9363 26.248 56.9883 26.118 57.0143 25.962C57.0663 25.806 57.0923 25.637 57.0923 25.455L57.2093 22.452C57.2093 22.218 57.1703 22.075 57.0923 22.023C57.0143 21.945 56.9233 21.906 56.8193 21.906C56.7673 21.906 56.7023 21.919 56.6243 21.945C56.5723 21.945 56.5073 21.971 56.4293 22.023C55.8053 22.361 55.3243 22.712 54.9863 23.076C54.6743 23.414 54.5183 24.038 54.5183 24.948C54.5183 25.702 54.6613 26.209 54.9473 26.469C55.2593 26.729 55.5583 26.859 55.8443 26.859Z"
              fill="#8A6701"
            ></path>
            <line x1="8" y1="44.5" x2="43" y2="44.5" stroke="#060314" strokeOpacity="0.28"></line>
            <line x1="51" y1="44.5" x2="63" y2="44.5" stroke="#8A6701"></line>
            <line x1="49" y1="48.5" x2="65" y2="48.5" stroke="#8A6701"></line>
            <line x1="53" y1="52.5" x2="61" y2="52.5" stroke="#8A6701"></line>
            <line x1="51" y1="83.5" x2="63" y2="83.5" stroke="#8A6701"></line>
            <line x1="49" y1="87.5" x2="65" y2="87.5" stroke="#8A6701"></line>
            <line x1="53" y1="91.5" x2="61" y2="91.5" stroke="#8A6701"></line>
            <line x1="8" y1="50.5" x2="43" y2="50.5" stroke="#060314" strokeOpacity="0.28"></line>
            <line x1="8" y1="56.5" x2="43" y2="56.5" stroke="#060314" strokeOpacity="0.28"></line>
            <line x1="8" y1="62.5" x2="43" y2="62.5" stroke="#060314" strokeOpacity="0.28"></line>
          </svg>
        ),
      },
      {
        value: 'TEMPLATE_TECHNICAL',
        name: 'Technisch',
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
            aria-hidden="true"
            focusable="false"
          >
            <rect width="100%" height="100%" rx="4" fill="white"></rect>
            <path
              d="M61.3374 27.672H59.2974C57.8334 27.672 56.8734 26.88 56.7294 25.488H56.6094C56.1774 27.096 54.7374 27.96 52.8414 27.96C50.4414 27.96 48.8574 26.592 48.8574 24.264C48.8574 21.672 50.8014 20.448 54.4254 20.448H56.4174V19.824C56.4174 18.36 55.7934 17.592 54.1614 17.592C52.6734 17.592 51.8094 18.24 51.1374 19.152L49.1934 17.424C50.0094 16.032 51.8094 15 54.5694 15C57.9534 15 59.9694 16.56 59.9694 19.68V25.104H61.3374V27.672ZM54.1854 25.632C55.4334 25.632 56.4174 25.008 56.4174 23.856V22.368H54.5214C53.1054 22.368 52.3374 22.872 52.3374 23.832V24.312C52.3374 25.176 53.0574 25.632 54.1854 25.632Z"
              fill={selectedColor}
            ></path>
            <line x1="12" y1="44.5" x2="61" y2="44.5" stroke="#060314" strokeOpacity="0.28"></line>
            <line x1="12" y1="50.5" x2="61" y2="50.5" stroke="#060314" strokeOpacity="0.28"></line>
            <line x1="12" y1="56.5" x2="61" y2="56.5" stroke="#060314" strokeOpacity="0.28"></line>
            <line x1="12" y1="62.5" x2="61" y2="62.5" stroke="#060314" strokeOpacity="0.28"></line>
            <line x1="12" y1="85.5" x2="56" y2="85.5" stroke={selectedColor}></line>
            <line x1="12" y1="89.5" x2="60" y2="89.5" stroke={selectedColor}></line>
            <line x1="12" y1="93.5" x2="41" y2="93.5" stroke={selectedColor}></line>
          </svg>
        ),
      },
      {
        value: 'TEMPLATE_GEOMETRIC',
        name: 'Geometrisch',
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
            aria-hidden="true"
            focusable="false"
          >
            <rect width="100%" height="100%" rx="4" fill="white"></rect>
            <path
              d="M58.0763 13.32H59.6443V28.04H58.0763V13.32ZM45.4043 20.68C45.4043 19.08 45.7243 17.7147 46.3643 16.584C47.0043 15.432 47.8576 14.5467 48.9243 13.928C50.0123 13.3093 51.207 13 52.5083 13C53.7883 13 54.887 13.3413 55.8043 14.024C56.7216 14.6853 57.4363 15.592 57.9483 16.744C58.4816 17.896 58.7483 19.208 58.7483 20.68C58.7483 22.1307 58.4816 23.4427 57.9483 24.616C57.4363 25.768 56.7216 26.6853 55.8043 27.368C54.887 28.0293 53.7883 28.36 52.5083 28.36C51.207 28.36 50.0123 28.0507 48.9243 27.432C47.8576 26.8133 47.0043 25.928 46.3643 24.776C45.7243 23.624 45.4043 22.2587 45.4043 20.68ZM47.1003 20.68C47.1003 21.96 47.3456 23.0587 47.8363 23.976C48.3483 24.8933 49.031 25.5973 49.8843 26.088C50.759 26.5573 51.7083 26.792 52.7323 26.792C53.6496 26.792 54.503 26.5253 55.2923 25.992C56.103 25.4587 56.7536 24.7333 57.2443 23.816C57.735 22.8987 57.9803 21.8533 57.9803 20.68C57.9803 19.5067 57.735 18.4613 57.2443 17.544C56.7536 16.6267 56.103 15.9013 55.2923 15.368C54.503 14.8347 53.6496 14.568 52.7323 14.568C51.7083 14.568 50.759 14.8133 49.8843 15.304C49.031 15.7733 48.3483 16.4667 47.8363 17.384C47.3456 18.3013 47.1003 19.4 47.1003 20.68Z"
              fill="#E64111"
            ></path>
            <line x1="12" y1="44.5" x2="61" y2="44.5" stroke="#060314" strokeOpacity="0.9"></line>
            <line x1="12" y1="50.5" x2="61" y2="50.5" stroke="#060314" strokeOpacity="0.28"></line>
            <line x1="12" y1="56.5" x2="61" y2="56.5" stroke="#060314" strokeOpacity="0.9"></line>
            <line x1="12" y1="62.5" x2="61" y2="62.5" stroke="#060314" strokeOpacity="0.28"></line>
            <line x1="12" y1="85.5" x2="24" y2="85.5" stroke="#E64111"></line>
            <line x1="12" y1="89.5" x2="28" y2="89.5" stroke="#E64111"></line>
            <line x1="12" y1="93.5" x2="20" y2="93.5" stroke="#E64111"></line>
            <line x1="40" y1="85.5" x2="52" y2="85.5" stroke="#E64111"></line>
            <line x1="40" y1="89.5" x2="56" y2="89.5" stroke="#E64111"></line>
            <line x1="40" y1="93.5" x2="48" y2="93.5" stroke="#E64111"></line>
          </svg>
        ),
      },
      {
        value: 'TEMPLATE_DYNAMIC',
        name: 'Dynamisch',
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <clipPath id="clip0_663_547">
                <rect width="100%" height="100%" rx="4" fill="white"></rect>
              </clipPath>
            </defs>
            <g clipPath="url(#clip0_663_547)">
              <rect width="100%" height="100%" rx="4" fill="white"></rect>
              <ellipse cx="18" cy="6" rx="54" ry="25" fill="#2BB7C4"></ellipse>
              <path
                d="M17.6099 22.594C16.6272 22.594 15.7765 22.3373 15.0579 21.824C14.3539 21.296 13.8112 20.592 13.4299 19.712C13.0632 18.832 12.8799 17.8787 12.8799 16.852C12.8799 15.7373 13.0925 14.74 13.5179 13.86C13.9432 12.98 14.5665 12.2833 15.3879 11.77C16.2239 11.2567 17.2212 11 18.3799 11C18.7172 11 19.1352 11.022 19.6339 11.066C20.1472 11.0953 20.5799 11.1393 20.9319 11.198H22.4059V20.328C22.4059 20.5333 22.4499 20.6947 22.5379 20.812C22.6406 20.9147 22.7872 20.966 22.9779 20.966C23.2272 20.966 23.4252 20.8413 23.5719 20.592L24.8039 21.406C24.6132 21.7727 24.3345 22.066 23.9679 22.286C23.6159 22.4913 23.2346 22.594 22.8239 22.594C22.2812 22.594 21.8119 22.44 21.4159 22.132C21.0345 21.8093 20.8292 21.4353 20.7999 21.01V21.032C20.5505 21.516 20.1325 21.8973 19.5459 22.176C18.9592 22.4547 18.3139 22.594 17.6099 22.594ZM17.7419 20.966C18.3285 20.966 18.8492 20.812 19.3039 20.504C19.7585 20.196 20.1032 19.8073 20.3379 19.338C20.4699 19.0887 20.5432 18.876 20.5579 18.7C20.5872 18.524 20.6019 18.326 20.6019 18.106V12.782L19.6779 12.716C18.9445 12.6573 18.4532 12.628 18.2039 12.628C17.0892 12.628 16.2239 13.024 15.6079 13.816C14.9919 14.608 14.6839 15.6127 14.6839 16.83C14.6839 17.9593 14.9552 18.9347 15.4979 19.756C16.0405 20.5627 16.7885 20.966 17.7419 20.966Z"
                fill="white"
              ></path>
              <line
                x1="12"
                y1="43.5"
                x2="61"
                y2="43.5"
                stroke="#060314"
                strokeOpacity="0.28"
                strokeWidth="3"
              ></line>
              <line
                x1="12"
                y1="49.5"
                x2="61"
                y2="49.5"
                stroke="#060314"
                strokeOpacity="0.28"
                strokeWidth="3"
              ></line>
              <line
                x1="12"
                y1="55.5"
                x2="61"
                y2="55.5"
                stroke="#060314"
                strokeOpacity="0.28"
                strokeWidth="3"
              ></line>
              <line
                x1="12"
                y1="61.5"
                x2="61"
                y2="61.5"
                stroke="#060314"
                strokeOpacity="0.28"
                strokeWidth="3"
              ></line>
              <line x1="12" y1="85.5" x2="24" y2="85.5" stroke="#2BB7C4"></line>
              <line x1="12" y1="89.5" x2="28" y2="89.5" stroke="#2BB7C4"></line>
              <line x1="12" y1="93.5" x2="20" y2="93.5" stroke="#2BB7C4"></line>
              <line x1="40" y1="85.5" x2="52" y2="85.5" stroke="#2BB7C4"></line>
              <line x1="40" y1="89.5" x2="56" y2="89.5" stroke="#2BB7C4"></line>
              <line x1="40" y1="93.5" x2="48" y2="93.5" stroke="#2BB7C4"></line>
            </g>
          </svg>
        ),
      },
    ],
  };

  const documentLabel = documentLabels[documentType] || 'Dokument';

  // Zoom levels matching SevDesk
  const zoomLevels = [2, 1.75, 1.5, 1.25, 1, 0.75, 0.5];
  const _zoomLabels = ['200%', '175%', '150%', '125%', '100%', '75%', '50%'];

  const toggleSection = (section: SendOption) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
    setActiveOption(section);
  };

  const isExpanded = (section: SendOption) => expandedSections.has(section);

  // Cleanup logo URL on unmount
  useEffect(() => {
    return () => {
      if (logoUrl) {
        URL.revokeObjectURL(logoUrl);
      }
    };
  }, [logoUrl]);

  // Monitor template readiness - Include DOM element check
  useEffect(() => {
    if (isOpen) {
      // Check both data and DOM element availability
      const hasData = !loadingEInvoiceData && (!!realDocumentData || !!document);
      const hasTemplateElement = !!templateRef.current && !!templateRef.current.innerHTML;
      const ready = hasData && hasTemplateElement;

      setTemplateReady(ready);
    }
  }, [isOpen, loadingEInvoiceData, realDocumentData, document]);

  // Extract HTML with all styles
  const extractHtmlWithStyles = useCallback(async () => {
    // Find template element - use templateRef first, then search DOM
    let templateElement = templateRef.current;
    if (!templateElement) {
      templateElement = window.document.querySelector('[data-pdf-template]') as HTMLDivElement;
    }

    if (!templateElement) return null;

    // Get the template element
    if (!templateElement) {
      console.error('❌ Template element is null');
      return null;
    }

    // Clone the template element
    const clonedElement = templateElement.cloneNode(true) as HTMLElement;

    // Remove preview-only transform styles
    const removePreviewStyles = (element: HTMLElement) => {
      if (element.style) {
        element.style.removeProperty('transform');
        element.style.removeProperty('transform-origin');
      }
      element.querySelectorAll('*').forEach(child => {
        if ((child as HTMLElement).style) {
          (child as HTMLElement).style.removeProperty('transform');
          (child as HTMLElement).style.removeProperty('transform-origin');
        }
      });
    };
    removePreviewStyles(clonedElement);

    // Extract ALL styles from document
    const allStyles: string[] = [];

    // Get all <style> tags
    const styleTags = window.document.querySelectorAll('style');

    styleTags.forEach((styleElement, _index) => {
      if (styleElement.textContent) {
        allStyles.push(styleElement.textContent);
      }
    });

    // Get all linked stylesheets
    const linkTags = window.document.querySelectorAll('link[rel="stylesheet"]');

    linkTags.forEach((linkElement, _index) => {
      try {
        const link = linkElement as HTMLLinkElement;
        if (link.sheet?.cssRules) {
          let css = '';
          for (let i = 0; i < link.sheet.cssRules.length; i++) {
            css += `${link.sheet.cssRules[i].cssText}\n`;
          }

          allStyles.push(css);
        }
      } catch {}
    });

    // Create complete HTML with ALL styles
    const completeHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <style>
    /* ALL APP STYLES */
    ${allStyles.join('\n\n')}
    
    /* PDF SPECIFIC */
    @page { size: A4; margin: 0; }
    html, body { 
      margin: 0 !important; 
      padding: 0 !important; 
      width: 210mm; 
      background: white;
      font-family: system-ui, -apple-system, sans-serif;
    }
    * { 
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  ${clonedElement.outerHTML}
</body>
</html>`;

    return completeHtml;
  }, []);

  // Cache template HTML for later use
  const cacheTemplateHtml = useCallback(async () => {
    if (!templateRef.current) return;

    try {
      const htmlContent = await extractHtmlWithStyles();
      setCachedHtml(htmlContent);
    } catch (error) {
      console.error('❌ Failed to cache HTML:', error);
    }
  }, [extractHtmlWithStyles]);

  // Separate effect to monitor template ref changes
  useEffect(() => {
    if (isOpen && !loadingEInvoiceData && (realDocumentData || document)) {
      const checkTemplate = () => {
        const hasTemplateElement = !!templateRef.current && !!templateRef.current.innerHTML;
        const hasData = !loadingEInvoiceData && (!!realDocumentData || !!document);
        setTemplateReady(hasData && hasTemplateElement);

        // Cache HTML when template is available
        if (hasTemplateElement && templateRef.current) {
          cacheTemplateHtml();
        }
      };

      // Check immediately
      checkTemplate();

      // Check again after a short delay to catch DOM updates
      const timeoutId = setTimeout(checkTemplate, 100);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isOpen, loadingEInvoiceData, realDocumentData, document, cacheTemplateHtml]);

  useEffect(() => {
    if (isOpen && document) {
      // Set default email subject and message
      const subject = `${documentLabel} ${document.invoiceNumber || document.number}`;
      setEmailSubject(subject);

      // Convert date to string if it's a Date object
      const dateStr =
        typeof document.date === 'string' ? document.date : document.date?.toISOString?.() || '';
      const dueDateStr = document.dueDate || dateStr;

      const message = `Sehr geehrte Damen und Herren,

anbei erhalten Sie Ihre ${documentLabel.toLowerCase()} ${document.invoiceNumber || document.number} vom ${formatDate(dateStr)}.

${documentType === 'invoice' ? `Die ${documentLabel.toLowerCase()} ist bis zum ${formatDate(dueDateStr)} zu begleichen.` : ''}

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
${document.companyName || 'Ihr Unternehmen'}`;

      setEmailMessage(message);

      // Set recipient email if available
      if (document.customerEmail) {
        setRecipientEmail(document.customerEmail);
      }

      // Reset to download option when opening (like SevDesk)
      setActiveOption('download');
      setExpandedSections(new Set(['download']));
      setZoomLevel(4); // Start at 100% zoom
      setLogoFile(null);
      if (logoUrl) {
        URL.revokeObjectURL(logoUrl);
      }
      setLogoUrl(null);
      setLogoSize(50);
    }
  }, [isOpen, document, documentType, documentLabel, logoUrl]);

  // ✅ Extract rendered HTML from the current template with ALL EXISTING STYLES
  // Check if template is ready - simplified version
  const isTemplateReady = useCallback(() => {
    // Basic check: not loading and have document data
    const basicReady = !loadingEInvoiceData && (!!realDocumentData || !!document);

    return basicReady;
  }, [loadingEInvoiceData, realDocumentData, document]);

  const getRenderedHtml = useCallback(async () => {
    // Prüfen ob Daten noch geladen werden
    if (loadingEInvoiceData) {
      console.error('Data is still loading');
      return null;
    }

    // Prüfen ob Dokument-Daten verfügbar sind
    if (!realDocumentData && !document) {
      console.error('No document data available');
      return null;
    }

    // First try to use pre-extracted HTML
    if (preExtractedHtml) {
      return preExtractedHtml;
    }

    // Second try to use cached HTML
    if (cachedHtml) {
      return cachedHtml;
    }

    // Last resort: try to extract immediately

    return await extractHtmlWithStyles();
  }, [
    preExtractedHtml,
    loadingEInvoiceData,
    realDocumentData,
    document,
    cachedHtml,
    extractHtmlWithStyles,
  ]);

  const handleSend = async (method: 'email' | 'download' | 'print' | 'save' | 'post') => {
    if (sending) return;

    // GoBD-Warnung nur für Rechnungen zeigen
    if (documentType === 'invoice') {
      const actionTypeMap = {
        download: 'download',
        print: 'print',
        email: 'email',
        save: 'save',
        post: 'post',
      } as const;

      // Wenn Auto-Lock-Zustimmung bereits gegeben wurde, direkt ausführen
      if (autoLockConsent === true) {
        await performSend(method);
        return;
      }

      // Ansonsten GoBD-Warnung anzeigen
      const docWithGoBD = document as DocumentWithGoBD;
      showWarning({
        actionType: actionTypeMap[method],
        documentType: 'Rechnung',
        documentNumber: docWithGoBD.documentNumber || 'Unbekannt',
        companyId: companyId || 'unknown',
        documentId: document.id,
        isAlreadyLocked: docWithGoBD.gobdStatus?.isLocked || false,
        onConfirm: () => performSend(method),
        onConsentSaved: () => {
          // Aktualisiere den State, damit beim nächsten Mal nicht mehr gefragt wird
          setAutoLockConsent(true);
        },
      });
      return;
    }

    // Direkter Versand für andere Dokumenttypen (ohne GoBD-Warnung)
    await performSend(method);
  };

  // Separate Funktion für den eigentlichen Versand
  const performSend = async (method: 'email' | 'download' | 'print' | 'save' | 'post') => {
    // 💰 KRITISCH: Skonto-Daten bei JEDER ACTION in Datenbank speichern!
    if (document?.id && companyId) {
      try {
        // Collection basierend auf documentType bestimmen
        const collectionName =
          documentType === 'invoice'
            ? 'invoices'
            : documentType === 'quote'
              ? 'quotes'
              : 'invoices';

        const updateData = {
          skontoEnabled: skontoEnabled,
          skontoDays: skontoDays,
          skontoPercentage: skontoPercentage,
          skontoText: skontoText,
          updatedAt: new Date().toISOString(),
        };

        await api.patch(
          `/api/v1/${collectionName}/${document.id}?company_id=${companyId}`,
          updateData,
        );
      } catch (error) {
        console.error('❌ Fehler beim Speichern der Skonto-Daten:', error);
        // Weiter machen - Action nicht abbrechen
      }
    }

    // 1. Finale PDF-Daten aus Template holen
    // Annahme: PDFTemplateProps stehen zur Verfügung (siehe PDFTemplates.tsx)
    // Wir nutzen enrichedDocumentData oder realDocumentData als Basis
    const _pdfTemplateProps = {
      document: {
        ...(enrichedDocumentData || realDocumentData || document),
        // Skonto-Daten für PDF-Generierung hinzufügen
        skontoEnabled: skontoEnabled,
        skontoDays: skontoDays,
        skontoPercentage: skontoPercentage,
        skontoText: skontoText,
      },
      template: selectedLayout,
      color: selectedColor,
      logoUrl,
      logoSize,
      documentType,
      pageMode,
      documentSettings,
    };
    // usePDFTemplateData ist ein Hook, daher nicht direkt hier nutzbar. Wir nehmen die Props als "finalData".

    // 2. PDF als Blob generieren

    let pdfBlob: Blob | null = null;

    // Für "print" verwenden wir die dedizierte Print-Seite direkt (kein PDF-Blob nötig)
    // Für "print" verwenden wir die dedizierte Print-Seite direkt (kein PDF-Blob nötig)
    if (method === 'print') {
    } else if (method === 'download' || method === 'email') {
      // Für Download/Email: Nutze die bestehende PDF-API anstatt html2pdf

      if (!templateRef.current) {
        console.error('❌ templateRef.current ist null - kann kein PDF generieren!');
        toast.error('Keine Vorlage zum Generieren verfügbar');
        return;
      }

      // Sicherstellen, dass wir im Browser sind
      if (typeof window === 'undefined' || !window.document) {
        toast.error('PDF-Generierung ist nur im Browser möglich');
        return;
      }

      try {
        // Extrahiere HTML mit allen Styles (wie bei EmailSendModalNormal)
        const templateElement = templateRef.current;
        const clonedElement = templateElement.cloneNode(true) as HTMLElement;

        // Entferne Preview-Transform-Styles
        const removePreviewStyles = (element: HTMLElement) => {
          if (element.style) {
            element.style.removeProperty('transform');
            element.style.removeProperty('transform-origin');
          }
          element.querySelectorAll('*').forEach(child => {
            if ((child as HTMLElement).style) {
              (child as HTMLElement).style.removeProperty('transform');
              (child as HTMLElement).style.removeProperty('transform-origin');
            }
          });
        };
        removePreviewStyles(clonedElement);

        // Extrahiere ALLE Styles vom Dokument
        const allStyles: string[] = [];

        // Hole alle <style> Tags
        const styleTags = window.document.querySelectorAll('style');
        styleTags.forEach(styleElement => {
          if (styleElement.textContent) {
            allStyles.push(styleElement.textContent);
          }
        });

        // Hole alle verlinkten Stylesheets
        const linkTags = window.document.querySelectorAll('link[rel="stylesheet"]');
        linkTags.forEach(linkElement => {
          try {
            const link = linkElement as HTMLLinkElement;
            if (link.sheet?.cssRules) {
              let css = '';
              for (let i = 0; i < link.sheet.cssRules.length; i++) {
                css += `${link.sheet.cssRules[i].cssText}\n`;
              }
              allStyles.push(css);
            }
          } catch {
            // Ignoriere CORS-Fehler für externe Stylesheets
          }
        });

        // Erstelle komplettes HTML mit ALLEN Styles
        const completeHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <style>
    /* ALL APP STYLES */
    ${allStyles.join('\n\n')}
    
    /* PDF SPECIFIC */
    @page { size: A4; margin: 0; }
    html, body { 
      margin: 0 !important; 
      padding: 0 !important; 
      width: 210mm; 
      background: white;
      font-family: system-ui, -apple-system, sans-serif;
    }
    * { 
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  ${clonedElement.outerHTML}
</body>
</html>`;

        // Nutze die bestehende PDF-API
        const response = await fetch('/api/v1/generate-pdf-single', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            htmlContent: completeHtml,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'PDF-Generation fehlgeschlagen');
        }

        const result = await response.json();

        if (!result.success || !result.pdfBase64) {
          throw new Error('PDF-Generation returned empty result');
        }

        // Konvertiere base64 zu Blob
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        pdfBlob = new Blob([byteArray], { type: 'application/pdf' });
      } catch (pdfError) {
        console.error('❌ Fehler bei PDF-API:', pdfError);
        toast.error('PDF-Generierung fehlgeschlagen');
        return;
      }
    }

    try {
      setSending(true);

      // 3. Dokument ZUERST speichern, wenn noch keine ID vorhanden (für neue Dokumente)
      let invoiceId: string | undefined = realDocumentData?.id || document?.id;

      // WICHTIG: Für Print müssen wir IMMER überprüfen, ob das Dokument in Firestore existiert
      // weil die ID aus dem Client-State kommen könnte und nicht aus Firestore
      let needsSaving = false;

      if (method === 'print' && invoiceId) {
        // Prüfe ob Dokument in Firestore existiert
        try {
          let collectionName = 'invoices';
          if (documentType === 'quote') collectionName = 'quotes';
          if (documentType === 'reminder') collectionName = 'reminders';

          // Check via API if document exists
          try {
            await api.get(`/api/v1/${collectionName}/${invoiceId}?company_id=${companyId}`);
          } catch {
            needsSaving = true;
            invoiceId = undefined; // Setze ID zurück, damit neue ID generiert wird
          }
        } catch (e) {
          console.error('Fehler beim Prüfen des Dokuments:', e);
          needsSaving = true;
          invoiceId = undefined;
        }
      }

      // Wenn keine ID vorhanden ist oder needsSaving true ist, MUSS das Dokument erst gespeichert werden
      // Für Print: Immer speichern wenn Dokument nicht in Firestore existiert
      const shouldSave = !invoiceId || needsSaving;

      if (shouldSave && documentType === 'invoice') {
        try {
          // Kombiniere die Daten aus realDocumentData und document
          // Cast to DocumentWithGoBD for accessing optional invoice-specific fields
          const sourceData = (realDocumentData || document) as DocumentWithGoBD;

          // 🔥 KRITISCHER FIX: Generiere neue Rechnungsnummer falls noch nicht vorhanden
          let finalInvoiceNumber = sourceData.invoiceNumber || '';
          let finalSequentialNumber = sourceData.sequentialNumber || 1;

          // 🔥 KRITISCH: IMMER neue Nummer generieren bei neuen Dokumenten (keine ID = neues Dokument)
          if (!invoiceId || !finalInvoiceNumber || finalInvoiceNumber.startsWith('RE-1')) {
            try {
              const numberResult = await InvoiceService.getNextInvoiceNumber(companyId);
              finalInvoiceNumber = numberResult.formattedNumber;
              finalSequentialNumber = numberResult.sequentialNumber;
            } catch (numberError) {
              console.error(
                '❌ SendDocumentModal: Fehler bei Nummernkreis-Generierung:',
                numberError,
              );
              // Fallback nur im Notfall
              finalInvoiceNumber = `RE-${Date.now().toString().slice(-4)}`;
              finalSequentialNumber = Date.now() % 1000;
            }
          }

          // Helper to convert address to string
          const getAddressString = (
            addr:
              | string
              | { street: string; city: string; postalCode: string; country: string }
              | undefined,
          ): string => {
            if (!addr) return '';
            if (typeof addr === 'string') return addr;
            return `${addr.street}, ${addr.postalCode} ${addr.city}, ${addr.country}`;
          };

          // Helper to convert date to string
          const getDateString = (date: string | Date | undefined): string => {
            if (!date) return new Date().toISOString();
            if (typeof date === 'string') return date;
            return date.toISOString();
          };

          // Bereite die Invoice-Daten vor und entferne undefined Felder
          const invoiceToSave: InvoiceToSave = {
            companyId,
            customerName: sourceData.customerName || '',
            customerAddress: getAddressString(sourceData.customerAddress),
            customerEmail: sourceData.customerEmail || '',
            items: sourceData.items || [],
            total: sourceData.total || 0,
            status: (sourceData.status as InvoiceData['status']) || 'draft',
            invoiceNumber: finalInvoiceNumber, // ✅ Atomisch generierte Nummer
            number: finalInvoiceNumber, // ✅ Atomisch generierte Nummer
            sequentialNumber: finalSequentialNumber, // ✅ Atomisch generierte Nummer
            date: getDateString(sourceData.date),
            issueDate: sourceData.issueDate || new Date().toISOString(),
            dueDate: sourceData.dueDate || new Date().toISOString(),
            createdAt: new Date(),
            updatedAt: new Date(),
            // Nur definierte Felder hinzufügen
            ...(sourceData.customerNumber && { customerNumber: sourceData.customerNumber }),
            ...(sourceData.customerOrderNumber && {
              customerOrderNumber: sourceData.customerOrderNumber,
            }),
            ...(sourceData.notes && { notes: sourceData.notes }),
            ...(sourceData.paymentTerms && { paymentTerms: sourceData.paymentTerms }),
            ...(sourceData.bankDetails && { bankDetails: sourceData.bankDetails }),
            ...(sourceData.footerText && { footerText: sourceData.footerText }),
            ...(sourceData.headTextHtml && { headTextHtml: sourceData.headTextHtml }),
            ...(sourceData.title && { title: sourceData.title }),
            ...(sourceData.tax && { tax: sourceData.tax }),
            ...(sourceData.amount && { amount: sourceData.amount }),
            ...(sourceData.vatRate !== undefined && { vatRate: sourceData.vatRate }),
            ...(sourceData.currency && { currency: sourceData.currency }),
            ...(sourceData.eInvoiceData && { eInvoiceData: sourceData.eInvoiceData }),
            // KRITISCH: Steuerregel muss gespeichert werden fuer korrekte Anzeige!
            ...(sourceData.taxRule && { taxRule: sourceData.taxRule as TaxRuleType }),
            ...(sourceData.taxRuleType && { taxRuleType: sourceData.taxRuleType as TaxRuleType }),
            ...((sourceData as DocumentWithGoBD).taxRuleLabel && {
              taxRuleLabel: (sourceData as DocumentWithGoBD).taxRuleLabel,
            }),
            // Kleinunternehmer-Status ebenfalls speichern
            ...((sourceData as DocumentWithGoBD).isSmallBusiness !== undefined && {
              isSmallBusiness: (sourceData as DocumentWithGoBD).isSmallBusiness,
            }),
            // Dokumentsprache (0099): die im Dialog gewählte/vorbelegte Sprache
            // mitspeichern, damit die Gastsprache nicht verloren geht, wenn der
            // Nutzer direkt aus der Vorschau speichert/versendet.
            ...(documentSettings.language && { language: documentSettings.language }),
          };

          // Speichere direkt in Firestore über den Service
          invoiceId = await InvoiceService.saveInvoice(
            invoiceToSave as unknown as Record<string, unknown>,
          );

          // Update das realDocumentData und document mit der neuen ID
          if (realDocumentData) {
            realDocumentData.id = invoiceId;
          }
          if (document) {
            document.id = invoiceId;
          }

          toast.success('Dokument wurde automatisch gespeichert');
        } catch (saveError) {
          console.error('❌ Fehler beim Speichern des Dokuments:', saveError);
          toast.error('Fehler beim Speichern des Dokuments');
          setSending(false);
          return;
        }
      }

      // 4. KEINE Storage-Speicherung mehr - direkt zu Aktionen

      // 5. Spezielle Aktionen ausführen
      if (method === 'email') {
        if (!recipientEmail.trim()) {
          toast.error('Bitte geben Sie eine Empfänger-E-Mail-Adresse ein');
          return;
        }
        if (!emailSubject.trim()) {
          toast.error('Bitte geben Sie einen Betreff ein');
          return;
        }
      }

      // 🔥 CRITICAL: GoBD-System für ALLE Aktionen aktivieren
      const activateGoBDLock = async () => {
        if (documentType === 'invoice' && invoiceId && companyId) {
          try {
            const { GoBDService } = await import('@/services/gobdService');

            const userId = user?.uid || 'unknown';
            const userName =
              `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Unbekannt';

            await GoBDService.autoLockOnSend(companyId, invoiceId, userId, userName);
          } catch (gobdError) {
            console.error('❌ GoBD Auto-Lock fehlgeschlagen:', gobdError);
            // Nicht kritisch - Aktion wurde trotzdem ausgeführt
          }
        }
      };

      // Spezialbehandlung für Save-Operation
      if (method === 'save') {
        await activateGoBDLock();

        // 🔥 CRITICAL: Status auf 'finalized' setzen für Save-Aktion
        if (documentType === 'invoice' && invoiceId && companyId) {
          try {
            await api.patch(`/api/v1/invoices/${invoiceId}?company_id=${companyId}`, {
              status: 'finalized',
              finalizedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } catch (statusError) {
            console.error('❌ Fehler beim Status-Update:', statusError);
            // Nicht kritisch - Action trotzdem fortsetzen
          }
        }

        toast.success(`${documentLabel} gespeichert`);

        // 🔥 CRITICAL: onSend aufrufen für Navigation zur Detailseite
        if (onSend) {
          await onSend(method, { invoiceId });
        }

        // 🔀 Dynamic redirect after action
        handleRedirectAfterAction(invoiceId);
        onClose();
        return;
      }

      // Spezialbehandlung für Post-Operation (noch nicht implementiert)
      if (method === 'post') {
        await activateGoBDLock();

        // 🔥 CRITICAL: Status auf 'finalized' setzen für Post-Aktion
        if (documentType === 'invoice' && invoiceId && companyId) {
          try {
            await api.patch(`/api/v1/invoices/${invoiceId}?company_id=${companyId}`, {
              status: 'finalized',
              finalizedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } catch (statusError) {
            console.error('❌ Fehler beim Status-Update:', statusError);
            // Nicht kritisch - Action trotzdem fortsetzen
          }
        }

        toast.error('Per Post versenden ist noch nicht verfügbar');

        // 🔥 CRITICAL: onSend aufrufen für Navigation zur Detailseite
        if (onSend) {
          await onSend(method, { invoiceId });
        }

        // 🔀 Dynamic redirect after action
        handleRedirectAfterAction(invoiceId);
        onClose();
        return;
      }

      // 6. Führe die eigentliche Aktion aus
      if (method === 'print') {
        // 💰 KRITISCH: Skonto-Daten auch bei Print in Datenbank speichern!
        if (document?.id && companyId) {
          try {
            const collectionName =
              documentType === 'invoice'
                ? 'invoices'
                : documentType === 'quote'
                  ? 'quotes'
                  : 'invoices';

            await api.patch(`/api/v1/${collectionName}/${document.id}?company_id=${companyId}`, {
              skontoEnabled: skontoEnabled,
              skontoDays: skontoDays,
              skontoPercentage: skontoPercentage,
              skontoText: skontoText,
              updatedAt: new Date().toISOString(),
            });
          } catch (error) {
            console.error('❌ PRINT: Fehler beim Speichern der Skonto-Daten:', error);
          }
        }

        // Dokument MUSS in Firestore gespeichert sein
        // Rufe onSend auf, um das Dokument zu speichern (handleSubmit)
        if (onSend) {
          try {
            await onSend(method, {});

            // Hole die neue ID aus dem document Objekt (wurde von handleSubmit aktualisiert)
            const newId = realDocumentData?.id || document?.id;

            if (newId && newId !== invoiceId) {
              invoiceId = newId;
            }
          } catch (saveError) {
            console.error('❌ Fehler beim Speichern:', saveError);
            toast.error('Dokument konnte nicht gespeichert werden');
            setSending(false);
            return;
          }
        }

        if (!invoiceId) {
          toast.error('Dokument muss zuerst gespeichert werden');
          setSending(false);
          return;
        }

        // 🔥 CRITICAL: Speichere Template-Einstellungen in Firestore BEVOR Print-Seite geöffnet wird

        try {
          let collectionName = 'invoices';
          if (documentType === 'quote') collectionName = 'quotes';
          if (documentType === 'reminder') collectionName = 'reminders';

          // 🚨 Remove undefined values (API doesn't accept them)
          const cleanDocumentSettings = JSON.parse(
            JSON.stringify(documentSettings, (_key, value) => {
              return value === undefined ? null : value;
            }),
          );

          // 🔥 CRITICAL FIX: Stelle sicher, dass footerText immer Platzhalter enthält (nie gerenderte Werte)
          // Problem: Footer-Text könnte bereits mit gerenderten Beträgen gespeichert sein
          let cleanFooterText = document?.footerText || '';
          if (cleanFooterText && !cleanFooterText.includes('[%GESAMTBETRAG%]')) {
            // Wenn kein Platzhalter vorhanden, setze Standard-Footer-Text mit Platzhaltern
            cleanFooterText =
              'Wir bitten Sie, den Rechnungsbetrag von [%GESAMTBETRAG%] unter Angabe der Rechnungsnummer [%RECHNUNGSNUMMER%] auf das unten angegebene Konto zu überweisen. Zahlungsziel: [%ZAHLUNGSZIEL%] Rechnungsdatum: [%RECHNUNGSDATUM%] Vielen Dank für Ihr Vertrauen und die angenehme Zusammenarbeit!<br>Mit freundlichen Grüßen<br>[%KONTAKTPERSON%]';
          }

          const docWithTaxRule = document as DocumentWithGoBD;
          const realDocWithTaxRule = realDocumentData as DocumentWithGoBD | null;
          await api.patch(`/api/v1/${collectionName}/${invoiceId}?company_id=${companyId}`, {
            templateId: selectedLayout,
            template: selectedLayout,
            templateType: selectedLayout,
            color: selectedColor,
            logoUrl: logoUrl || null,
            logoSize: logoSize,
            pageMode: pageMode,
            documentSettings: cleanDocumentSettings,
            footerText: cleanFooterText,
            taxRule: docWithTaxRule?.taxRule || realDocWithTaxRule?.taxRule || null,
            taxRuleType: docWithTaxRule?.taxRuleType || realDocWithTaxRule?.taxRuleType || null,
            updatedAt: new Date().toISOString(),
          });
        } catch (updateError) {
          console.error('⚠️ Template-Einstellungen konnten nicht gespeichert werden:', updateError);
          // Nicht kritisch - drucken trotzdem
        }

        // Kein PDF-Storage bei Print - direkt zur Print-Seite

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Bestimme den Type-Parameter für die Print-Seite
        let printType = 'invoice';
        if (documentType === 'quote') printType = 'quote';
        if (documentType === 'reminder') printType = 'reminder';

        // CRITICAL FIX: Include companyId in URL for efficient Firestore lookup
        // New URL structure: /print/{type}/{companyId}/{documentId}
        const printUrl = `/print/${printType}/${companyId}/${invoiceId}`;

        const printWindow = window.open(printUrl, '_blank');

        if (printWindow) {
          toast.success(`${documentLabel} wird gedruckt`);
        } else {
          // Popup wurde blockiert
          toast.info('Bitte erlauben Sie Pop-ups, um das Dokument zu drucken');
        }

        // 🔥 CRITICAL: GoBD-System nach erfolgreichem Drucken aktivieren
        await activateGoBDLock();

        // 🔥 CRITICAL: Status auf 'finalized' setzen für Print-Aktion
        if (documentType === 'invoice' && invoiceId && companyId) {
          try {
            await api.patch(`/api/v1/invoices/${invoiceId}?company_id=${companyId}`, {
              status: 'finalized',
              finalizedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } catch (statusError) {
            console.error('❌ Fehler beim Status-Update:', statusError);
            // Nicht kritisch - Action trotzdem fortsetzen
          }
        }

        // 🔥 CRITICAL: onSend aufrufen für Navigation zur Detailseite
        if (onSend) {
          await onSend(method, { invoiceId });
        }

        // 🔀 Dynamic redirect after action
        handleRedirectAfterAction(invoiceId);
        onClose();
        return;
      }

      // onSend nur für Email aufrufen
      if (onSend && method === 'email') {
        await onSend(method, {
          email: recipientEmail,
          subject: emailSubject,
          message: emailMessage,
          sendCopy: sendCopy,
        });

        // 🔥 CRITICAL: GoBD-System aktivieren nach erfolgreichem E-Mail-Versand
        if (documentType === 'invoice' && invoiceId && companyId) {
          try {
            const { GoBDService } = await import('@/services/gobdService');

            // Get current user from existing auth hook (already imported at top)
            // Note: useAuth hook is already imported and used in this component
            const userId = user?.uid || 'unknown';
            const userName =
              `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Unbekannt';

            await GoBDService.autoLockOnSend(companyId, invoiceId, userId, userName);

            // 🔥 CRITICAL: Status auf 'sent' setzen für E-Mail-Aktion
            await api.patch(`/api/v1/invoices/${invoiceId}?company_id=${companyId}`, {
              status: 'sent',
              sentAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } catch (gobdError) {
            console.error('❌ GoBD Auto-Lock oder Status-Update fehlgeschlagen:', gobdError);
            // Nicht kritisch - E-Mail wurde trotzdem versendet
          }
        }

        toast.success(`${documentLabel} erfolgreich versendet`);
        // 🔀 Dynamic redirect after action
        handleRedirectAfterAction(invoiceId);
        onClose();
        return;
      }

      // 🔥 CRITICAL: Download-Logik mit PDF-API implementieren
      if (method === 'download') {
        if (!pdfBlob) {
          toast.error('PDF konnte nicht generiert werden');
          return;
        }

        // Sicherstellen, dass wir im Browser sind
        if (typeof window === 'undefined' || !window.document) {
          toast.error('Download ist nur im Browser möglich');
          return;
        }

        try {
          // PDF herunterladen
          const pdfUrl = URL.createObjectURL(pdfBlob);
          const link = window.document.createElement('a');
          link.href = pdfUrl;
          link.download = `${documentLabel}_${document.documentNumber || document.number || document.id?.substring(0, 8) || 'document'}.pdf`;
          window.document.body.appendChild(link);
          link.click();
          window.document.body.removeChild(link);
          URL.revokeObjectURL(pdfUrl);

          // 🔥 CRITICAL: GoBD-System nach erfolgreichem Download aktivieren
          await activateGoBDLock();

          // 🔥 CRITICAL: Status auf 'finalized' setzen für Download-Aktion
          if (documentType === 'invoice' && invoiceId && companyId) {
            try {
              await api.patch(`/api/v1/invoices/${invoiceId}?company_id=${companyId}`, {
                status: 'finalized',
                finalizedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            } catch (statusError) {
              console.error('❌ Fehler beim Status-Update:', statusError);
              // Nicht kritisch - Action trotzdem fortsetzen
            }
          }

          toast.success(`${documentLabel} erfolgreich heruntergeladen`);

          // 🔥 CRITICAL: onSend aufrufen für Navigation zur Detailseite
          if (onSend) {
            await onSend(method, { invoiceId });
          }

          // 🔀 Dynamic redirect after action
          handleRedirectAfterAction(invoiceId);
          onClose();
          return;
        } catch (downloadError) {
          console.error('❌ Download fehlgeschlagen:', downloadError);
          toast.error('Download fehlgeschlagen');
          return;
        }
      }
    } catch (error) {
      console.error('Error sending document:', error);
      toast.error(`Fehler beim Versenden der ${documentLabel.toLowerCase()}`);
    } finally {
      setSending(false);
    }
  };

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogPrimitive.Content className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 flex h-[90vh] w-[95vw] max-w-7xl translate-x-[-50%] translate-y-[-50%] flex-col gap-4 overflow-hidden border bg-background p-0 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in sm:rounded-lg">
        <DialogHeader className="relative shrink-0 border-b bg-accent px-6 py-4 text-white">
          {/* Weißes X-Icon */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-4 z-10000 rounded p-2 text-white transition-colors hover:bg-white/10 hover:text-white/80"
            style={{ color: '#FFFFFF !important', fontSize: '20px', fontWeight: 'bold' }}
          >
            ✕
          </button>
          <DialogTitle className="font-semibold text-white text-xl">
            {documentLabel} versenden
          </DialogTitle>
          <DialogDescription className="sr-only">
            {documentLabel} versenden, drucken oder herunterladen
          </DialogDescription>
        </DialogHeader>
        <div className="flex h-full min-h-0 flex-1">
          {/* Left side - Send Options */}
          <div className="flex min-h-0 w-80 flex-col border-r bg-white">
            {/* Company Settings Warning */}
            {showCompanySettings && (
              <div className="shrink-0 border-b p-4">
                <Alert>
                  <Icon icon="lucide:alert-triangle" className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">Angaben zu deinem Unternehmen</p>
                      <p className="text-sm">
                        Damit deine {documentLabel.toLowerCase()} rechtssicher und GoBD-konform
                        sind, ergänze noch Angaben zu dir und deinem Unternehmen.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => setShowCompanySettings(false)}
                      >
                        Angaben vervollständigen
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Send Options Accordion - SevDesk Style */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* Main Actions Section */}
              <div className="border-b">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h3 className="font-medium text-gray-700 text-sm">Aktionen</h3>
                </div>

                {/* Download Option - Default active like SevDesk */}
                <div className="border-b">
                  <button
                    type="button"
                    className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${
                      isExpanded('download') ? 'border-accent border-l-4 bg-gray-50' : ''
                    }`}
                    onClick={() => toggleSection('download')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon="lucide:download" className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">Herunterladen</span>
                    </div>
                    {isExpanded('download') ? (
                      <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {isExpanded('download') && (
                    <div className="bg-gray-50 px-4 pb-4">
                      <Button
                        onClick={() => handleSend('download')}
                        disabled={sending}
                        className="w-full bg-accent hover:bg-accent/90"
                      >
                        {sending ? (
                          <>
                            <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
                            PDF herunterladen
                          </>
                        ) : (
                          <>
                            <Icon icon="lucide:download" className="mr-2 h-4 w-4" />
                            PDF herunterladen
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Email Option */}
                <div className="border-b">
                  <button
                    type="button"
                    className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50"
                    onClick={async () => {
                      // Extract HTML before opening EmailSendModal

                      try {
                        const html = await extractHtmlWithStyles();
                        setPreExtractedHtml(html);
                      } catch (error) {
                        console.error('❌ Failed to pre-extract HTML:', error);
                      }
                      setShowEmailModal(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon="lucide:mail" className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">Als E-Mail versenden</span>
                    </div>
                    <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                  </button>
                </div>

                {/* Mail Option */}
                <div className="border-b">
                  <button
                    type="button"
                    className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${
                      isExpanded('mail') ? 'border-accent border-l-4 bg-gray-50' : ''
                    }`}
                    onClick={() => toggleSection('mail')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon="lucide:mail" className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">Per Post verschicken</span>
                    </div>
                    {isExpanded('mail') ? (
                      <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {isExpanded('mail') && (
                    <div className="bg-gray-50 px-4 pb-4">
                      <div className="mb-3 text-gray-600 text-sm">
                        Versende deine {documentLabel.toLowerCase()} automatisch per Post.
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleSend('post')}
                        disabled={sending || true} // Deaktiviert bis implementiert
                      >
                        <Icon icon="lucide:mail" className="mr-2 h-4 w-4" />
                        Per Post senden (Beta)
                      </Button>
                    </div>
                  )}
                </div>

                {/* Print Option */}
                <div className="border-b">
                  <button
                    type="button"
                    className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${
                      isExpanded('print') ? 'border-accent border-l-4 bg-gray-50' : ''
                    }`}
                    onClick={() => toggleSection('print')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon="lucide:printer" className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">Drucken</span>
                    </div>
                    {isExpanded('print') ? (
                      <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {isExpanded('print') && (
                    <div className="bg-gray-50 px-4 pb-4">
                      <Button
                        variant="outline"
                        onClick={() => handleSend('print')}
                        disabled={sending}
                        className="w-full"
                      >
                        {sending ? (
                          <>
                            <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
                            Wird gedruckt...
                          </>
                        ) : (
                          <>
                            <Icon icon="lucide:printer" className="mr-2 h-4 w-4" />
                            Drucken
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Save Option */}
                <div className="border-b">
                  <button
                    type="button"
                    className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${
                      isExpanded('save') ? 'border-accent border-l-4 bg-gray-50' : ''
                    }`}
                    onClick={() => toggleSection('save')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon="lucide:check-circle" className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">Speichern</span>
                    </div>
                    {isExpanded('save') ? (
                      <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {isExpanded('save') && (
                    <div className="bg-gray-50 px-4 pb-4">
                      <div className="mb-3 text-gray-600 text-sm">
                        {documentLabel} als finalisiertes Dokument speichern.
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleSend('save')}
                        disabled={sending}
                      >
                        <Icon icon="lucide:check-circle" className="mr-2 h-4 w-4" />
                        Speichern
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Settings Section */}
              <div>
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h3 className="font-medium text-gray-700 text-sm">Anpassungen</h3>
                </div>

                {/* Logo Option */}
                <div className="border-b">
                  <button
                    type="button"
                    className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${
                      isExpanded('logo') ? 'border-accent border-l-4 bg-gray-50' : ''
                    }`}
                    onClick={() => toggleSection('logo')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon="lucide:image" className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">Dein Firmenlogo</span>
                    </div>
                    {isExpanded('logo') ? (
                      <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {isExpanded('logo') && (
                    <div className="space-y-4 bg-gray-50 px-4 pb-4">
                      {/* Logo Upload */}
                      <div className="space-y-3">
                        <div className="rounded-lg border-2 border-gray-300 border-dashed p-6 text-center transition-colors hover:border-accent">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".jpg,.jpeg,.png"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Cleanup previous URL
                                if (logoUrl) {
                                  URL.revokeObjectURL(logoUrl);
                                }

                                // Create new URL for preview
                                const newUrl = URL.createObjectURL(file);
                                setLogoFile(file);
                                setLogoUrl(newUrl);
                                toast.success('Logo erfolgreich hochgeladen');
                              }
                            }}
                          />

                          <div className="cursor-pointer">
                            <Icon
                              icon="lucide:upload"
                              className="mx-auto mb-2 h-8 w-8 text-gray-400"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="mb-2"
                              onClick={e => {
                                e.preventDefault();
                                fileInputRef.current?.click();
                              }}
                            >
                              Logo hochladen
                            </Button>
                            <p className="text-gray-500 text-sm">oder hier hineinziehen</p>
                            <p className="text-gray-400 text-xs">.jpg, .jpeg, .png (max. 10 MB)</p>
                          </div>
                        </div>

                        {logoFile && logoUrl && (
                          <div className="space-y-2">
                            <div className="text-center text-green-600 text-sm">
                              ✓ Logo hochgeladen: {logoFile.name}
                            </div>
                            <div className="flex justify-center">
                              <Image
                                src={logoUrl}
                                alt="Logo Vorschau"
                                width={96}
                                height={48}
                                unoptimized
                                className="max-h-12 max-w-24 rounded border object-contain"
                                style={{
                                  transform: `scale(${logoSize / 100})`,
                                  transformOrigin: 'center',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Logo Size Control */}
                      <div className="space-y-2">
                        <Label className="font-medium text-sm">Größe</Label>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLogoSize(Math.max(25, logoSize - 25))}
                            disabled={logoSize <= 25}
                            className="h-8 w-8 p-0"
                          >
                            <Icon icon="lucide:minus" className="h-3 w-3" />
                          </Button>
                          <span className="min-w-12 text-center font-medium text-sm">
                            {logoSize}%
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLogoSize(Math.min(100, logoSize + 25))}
                            disabled={logoSize >= 100}
                            className="h-8 w-8 p-0"
                          >
                            <Icon icon="lucide:plus" className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Color Option */}
                <div className="border-b">
                  <button
                    type="button"
                    className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${
                      isExpanded('color') ? 'border-accent border-l-4 bg-gray-50' : ''
                    }`}
                    onClick={() => toggleSection('color')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon="lucide:palette" className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">Farbe</span>
                    </div>
                    {isExpanded('color') ? (
                      <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {isExpanded('color') && (
                    <div className="bg-gray-50 px-4 pb-4">
                      <div className="color-palette">
                        <div className="mb-3 grid grid-cols-6 gap-2">
                          {[
                            { name: 'Grau', color: '#313131', label: 'Grey' },
                            { name: 'Hellgrau', color: '#848484', label: 'Light Grey' },
                            { name: 'Türkis', color: '#0d8375', label: 'Teal' },
                            { name: 'Blau', color: '#1d65b3', label: 'Blue' },
                            { name: 'Lila', color: '#a964d9', label: 'Purple' },
                            { name: 'Rot', color: '#c31919', label: 'Red' },
                            { name: 'Orange', color: '#f46e32', label: 'Orange' },
                            { name: 'Gelb', color: '#ffcf00', label: 'Yellow' },
                            { name: 'Rosa', color: '#fd88ab', label: 'Pink' },
                            { name: 'Beige', color: '#c0ab60', label: 'Beige' },
                            { name: 'Braun', color: '#7e4528', label: 'Brown' },
                            { name: 'Akzent', color: 'var(--accent)', label: 'Accent' },
                          ].map(colorOption => (
                            <button
                              key={colorOption.color}
                              type="button"
                              aria-label={colorOption.label}
                              className={`h-8 w-8 rounded border-2 transition-all hover:scale-110 ${
                                selectedColor === colorOption.color
                                  ? 'border-gray-800 ring-2 ring-gray-300'
                                  : 'border-gray-200 hover:border-gray-400'
                              }`}
                              style={{ backgroundColor: colorOption.color }}
                              onClick={() => setSelectedColor(colorOption.color)}
                              title={colorOption.name}
                            />
                          ))}
                        </div>

                        {/* Custom Color Input */}
                        <div className="space-y-2">
                          <Label className="font-medium text-sm">Benutzerdefinierte Farbe</Label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={selectedColor}
                              onChange={e => setSelectedColor(e.target.value)}
                              className="h-8 w-12 cursor-pointer rounded border border-gray-300"
                              title="Benutzerdefinierte Farbe auswählen"
                            />

                            <Input
                              type="text"
                              value={selectedColor}
                              onChange={e => {
                                const value = e.target.value;
                                if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                                  setSelectedColor(value);
                                }
                              }}
                              placeholder="var(--accent)"
                              className="flex-1 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Layout Option */}
                <div className="border-b">
                  <button
                    type="button"
                    className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${
                      isExpanded('layout') ? 'border-accent border-l-4 bg-gray-50' : ''
                    }`}
                    onClick={() => toggleSection('layout')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon="lucide:layout" className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">Layout auswählen</span>
                    </div>
                    {isExpanded('layout') ? (
                      <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {isExpanded('layout') && (
                    <div className="bg-gray-50 px-4 pb-4">
                      <div
                        className="layouts-container"
                        style={{ '--layout-color': selectedColor } as React.CSSProperties}
                      >
                        {/* Standard Layouts */}
                        <div className="layouts layouts--normal layouts--big-thumbnail mb-4">
                          <div className="grid grid-cols-2 gap-2">
                            {layouts.standard.map(layout => (
                              <button
                                type="button"
                                key={layout.value}
                                className={`layout cursor-pointer rounded-lg border p-2 transition-all hover:border-accent ${
                                  selectedLayout === layout.value
                                    ? 'border-accent ring-2 ring-accent/20'
                                    : 'border-gray-200'
                                }`}
                                onClick={() => setSelectedLayout(layout.value)}
                              >
                                <div className="mb-1 flex h-16 w-full items-center justify-center">
                                  <div className="h-14 w-12">{layout.svg}</div>
                                </div>
                                <span className="block cursor-pointer text-center text-xs">
                                  {layout.name}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* E-Invoice Section */}
                {eInvoiceData && (
                  <div className="border-b">
                    <button
                      type="button"
                      className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${
                        isExpanded('einvoice') ? 'border-accent border-l-4 bg-gray-50' : ''
                      }`}
                      onClick={() => toggleSection('einvoice')}
                    >
                      <div className="flex items-center gap-3">
                        <Icon icon="lucide:file-text" className="h-5 w-5 text-green-600" />
                        <span className="font-medium">E-Rechnung</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                          {eInvoiceData.validationStatus === 'valid' ? 'Gültig' : 'Fehlerhaft'}
                        </Badge>
                      </div>
                      {isExpanded('einvoice') ? (
                        <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    {isExpanded('einvoice') && (
                      <div className="bg-gray-50 px-4 pb-4">
                        <div className="space-y-4">
                          {/* E-Invoice Status */}
                          <div className="rounded-lg border bg-white p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-medium text-sm">Status</span>
                              <Badge
                                variant={
                                  eInvoiceData.validationStatus === 'valid'
                                    ? 'default'
                                    : 'destructive'
                                }
                                className="text-xs"
                              >
                                {eInvoiceData.validationStatus === 'valid'
                                  ? 'Gültig'
                                  : 'Fehlerhaft'}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-gray-600 text-xs">
                              <div>Format: {eInvoiceData.format?.toUpperCase() || 'ZUGFeRD'}</div>
                              <div>GUID: {eInvoiceData.guid}</div>
                              <div>Erstellt: {formatDate(eInvoiceData.createdAt)}</div>
                            </div>
                          </div>

                          {/* QR Code */}
                          {qrCodeUrl && (
                            <div className="rounded-lg border bg-white p-3 text-center">
                              <div className="mb-2 font-medium text-sm">QR-Code</div>
                              <Image
                                src={qrCodeUrl}
                                alt="E-Invoice QR Code"
                                width={96}
                                height={96}
                                unoptimized
                                className="mx-auto h-24 w-24 rounded border"
                              />

                              <div className="mt-2 text-gray-500 text-xs">
                                Für E-Invoice-Validierung
                              </div>
                            </div>
                          )}

                          {/* Download Actions */}
                          <div className="space-y-2">
                            <Button
                              variant="outline"
                              className="w-full text-sm"
                              onClick={async () => {
                                try {
                                  if (eInvoiceData.xmlUrl) {
                                    window.open(eInvoiceData.xmlUrl, '_blank');
                                    toast.success('XML-Datei wird heruntergeladen');
                                  } else {
                                    toast.error('XML-URL nicht verfügbar');
                                  }
                                } catch (error) {
                                  console.error('XML download error:', error);
                                  toast.error('Fehler beim XML-Download');
                                }
                              }}
                            >
                              <Icon icon="lucide:download" className="mr-2 h-4 w-4" />
                              XML herunterladen
                            </Button>

                            <Button
                              variant="outline"
                              className="w-full text-sm"
                              onClick={() => {
                                toast.info('ZUGFeRD-PDF wird generiert...');
                                // Hier würde die ZUGFeRD-PDF-Generierung stattfinden
                              }}
                            >
                              <Icon icon="lucide:download" className="mr-2 h-4 w-4" />
                              ZUGFeRD-PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* More Settings */}
                <div className="border-b">
                  <button
                    type="button"
                    className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${
                      isExpanded('settings') ? 'border-accent border-l-4 bg-gray-50' : ''
                    }`}
                    onClick={() => toggleSection('settings')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon="lucide:settings" className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">Weitere Einstellungen</span>
                    </div>
                    {isExpanded('settings') ? (
                      <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {isExpanded('settings') && (
                    <div className="bg-gray-50 px-4 pb-4">
                      <div className="space-y-4">
                        {/* Sprache */}
                        <div className="space-y-2">
                          <Label className="font-medium text-sm">Sprache</Label>
                          <NativeSelect
                            value={documentSettings.language}
                            onChange={e =>
                              setDocumentSettings(prev => ({ ...prev, language: e.target.value }))
                            }
                            className="w-full"
                          >
                            {DOCUMENT_LANGUAGES.map(code => (
                              <option key={code} value={code}>
                                {DOCUMENT_LANGUAGE_LABELS[code] ?? code}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>

                        {/* QR-Code Optionen */}
                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-sm">QR-Code anzeigen</Label>
                          <Checkbox
                            checked={documentSettings.showQRCode}
                            onCheckedChange={checked =>
                              setDocumentSettings(prev => ({
                                ...prev,
                                showQRCode: checked as boolean,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-sm">EPC-QR-Code (GiroCode)</Label>
                          <Checkbox
                            checked={documentSettings.showEPCQRCode}
                            onCheckedChange={checked =>
                              setDocumentSettings(prev => ({
                                ...prev,
                                showEPCQRCode: checked as boolean,
                              }))
                            }
                          />
                        </div>

                        {/* Weitere Display-Optionen */}
                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-sm">Kundennummer</Label>
                          <Checkbox
                            checked={documentSettings.showCustomerNumber}
                            onCheckedChange={checked =>
                              setDocumentSettings(prev => ({
                                ...prev,
                                showCustomerNumber: checked as boolean,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-sm">Kontaktperson</Label>
                          <Checkbox
                            checked={documentSettings.showContactPerson}
                            onCheckedChange={checked =>
                              setDocumentSettings(prev => ({
                                ...prev,
                                showContactPerson: checked as boolean,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-sm">USt. pro Position</Label>
                          <Checkbox
                            checked={documentSettings.showVATPerPosition}
                            onCheckedChange={checked =>
                              setDocumentSettings(prev => ({
                                ...prev,
                                showVATPerPosition: checked as boolean,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-sm">Artikelnummer</Label>
                          <Checkbox
                            checked={documentSettings.showArticleNumber}
                            onCheckedChange={checked =>
                              setDocumentSettings(prev => ({
                                ...prev,
                                showArticleNumber: checked as boolean,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-sm">Falz- und Lochmarken</Label>
                          <Checkbox
                            checked={documentSettings.showFoldLines}
                            onCheckedChange={checked =>
                              setDocumentSettings(prev => ({
                                ...prev,
                                showFoldLines: checked as boolean,
                              }))
                            }
                          />
                        </div>

                        {/* Standard-Optionen */}
                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-sm">Seitenzahlen anzeigen</Label>
                          <Checkbox
                            checked={documentSettings.showPageNumbers}
                            onCheckedChange={checked =>
                              setDocumentSettings(prev => ({
                                ...prev,
                                showPageNumbers: checked as boolean,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-sm">Fußzeile einblenden</Label>
                          <Checkbox
                            checked={documentSettings.showFooter}
                            onCheckedChange={checked =>
                              setDocumentSettings(prev => ({
                                ...prev,
                                showFooter: checked as boolean,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-sm">Wasserzeichen</Label>
                          <Checkbox
                            checked={documentSettings.showWatermark}
                            onCheckedChange={checked =>
                              setDocumentSettings(prev => ({
                                ...prev,
                                showWatermark: checked as boolean,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Document Preview */}
          <div className="flex min-h-0 flex-1 flex-col">
            {loadingEInvoiceData ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-3 text-gray-500">
                  <Icon icon="lucide:loader2" className="h-6 w-6 animate-spin" />
                  <span>
                    Lade {documentLabels[documentType] || 'Dokument'}-Daten aus der Datenbank...
                  </span>
                </div>
              </div>
            ) : (
              <SimplePDFViewer
                zoomLevel={zoomLevels[zoomLevel]}
                a4Width={A4_DIMENSIONS.WEB.width}
                a4Height={A4_DIMENSIONS.WEB.height}
                pageMode={pageMode}
                onPageModeChange={handlePageModeChange}
                onZoomChange={newZoom => {
                  const newIndex = zoomLevels.indexOf(newZoom);
                  if (newIndex !== -1) {
                    setZoomLevel(newIndex);
                  }
                }}
              >
                <div ref={templateRef} data-pdf-template>
                  <PDFTemplate
                    key={`${selectedLayout}-${pageMode}-${enrichedDocumentData?.companyName || 'no-company'}`}
                    document={
                      (enrichedDocumentData ||
                        realDocumentData ||
                        document) as PDFTemplateProps['document']
                    }
                    template={selectedLayout}
                    color={selectedColor}
                    logoUrl={logoUrl}
                    logoSize={logoSize}
                    documentType={documentType}
                    pageMode={pageMode}
                    documentSettings={documentSettings}
                  />
                </div>
              </SimplePDFViewer>
            )}
          </div>
        </div>{' '}
        {/* End of main flex container */}
      </DialogPrimitive.Content>

      {/* Email Send Modal */}
      <EmailSendModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        document={realDocumentData || document}
        documentType={documentType}
        companyId={companyId}
        selectedTemplate={selectedLayout}
        pageMode={pageMode}
        getRenderedHtml={getRenderedHtml}
        isTemplateReady={isTemplateReady()}
        _onSend={async emailData => {
          if (onSend) {
            await onSend('email', emailData as unknown as SendOptions);
          }
        }}
      />

      {/* GoBD Action Warning Modal */}
      {WarningComponent}
    </Dialog>
  );
}
