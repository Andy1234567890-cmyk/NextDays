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
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@tasko/ui';
import { useTranslations, useLocale } from 'next-intl';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { NativeSelect } from '@nextdays/ui/native-select';
import { useNewAuth } from '@/contexts/NewAuthContext';
import { api } from '@/lib/api-client';
import type { DocumentType } from '@/lib/document-utils';
import type { Quote } from '@/services/quoteService';
import { formatDate } from '@/lib/utils';
import type { InvoiceData } from '@/types/invoiceTypes';
import { A4_DIMENSIONS } from '@/utils/a4-page-utils';
import PDFTemplate from './PDFTemplates';
import { SimplePDFViewer } from './SimplePDFViewer';
import { MARKETING_START } from '@/lib/marketing-url';

interface LivePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: InvoiceData | Quote | { [key: string]: unknown }; // Flexible für verschiedene Datentypen
  documentType: DocumentType;
  companyId: string;
  onSend?: (method: 'email' | 'download' | 'print', options?: any) => Promise<void>;
  onSaveAsDraft?: () => void; // Callback für "Als Entwurf speichern"
  mode?: 'preview' | 'view'; // preview = nur Vorschau (Create), view = alle Aktionen (Detail)
}

type SendOption =
  | 'email'
  | 'print'
  | 'save'
  | 'download'
  | 'logo'
  | 'color'
  | 'layout'
  | 'settings'
  | 'einvoice';

export function LivePreviewModal({
  isOpen,
  onClose,
  document,
  documentType,
  companyId,
  onSend,
  onSaveAsDraft,
  mode = 'view', // Standard: view (alle Aktionen), bei Create-Seiten: preview
}: LivePreviewModalProps) {
  type EInvoicePayload = {
    guid?: string;
    [key: string]: unknown;
  };

  type LiveDocument = (InvoiceData | Quote) & {
    id?: string;
    eInvoiceData?: EInvoicePayload;
    [key: string]: unknown;
  };

  const t = useTranslations('finance');

  const locale = useLocale();
  const { user } = useNewAuth(); // User-Daten aus Auth Context
  const [sending, setSending] = useState(false);
  const [showCompanySettings, setShowCompanySettings] = useState(false);

  // Preview-Modus: Nur Vorschau ohne Download/Drucken (für Create-Seiten)
  const isPreviewMode = mode === 'preview';

  const templateRef = useRef<HTMLDivElement>(null);

  const [_activeOption, setActiveOption] = useState<SendOption>('save'); // Start with save
  const [expandedSections, setExpandedSections] = useState<Set<SendOption>>(
    new Set(['save', 'layout']),
  );
  const [zoomLevel, setZoomLevel] = useState(4); // Start at 100% zoom (index 4 in zoomLevels)
  const [_logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(50); // Logo size in percentage
  const [selectedLayout, setSelectedLayout] = useState('TEMPLATE_NEUTRAL');
  const [selectedColor, setSelectedColor] = useState('var(--accent)');
  const [pageMode, setPageMode] = useState<'single' | 'multi'>('single'); // Default: IMMER single (einseitig)

  // Document Settings States
  const [documentSettings, setDocumentSettings] = useState({
    language: 'de',
    showQRCode: false,
    showEPCQRCode: false,
    showCustomerNumber: false,
    showContactPerson: false,
    showVATPerPosition: false,
    showArticleNumber: false,
    showFoldLines: true,
    showPageNumbers: true,
    showFooter: true,
    showWatermark: false,
  });

  // ✅ Template-Einstellungen aus übergebenen Daten initialisieren
  useEffect(() => {
    if (document) {
      const docData = document as any;

      if (docData.template || docData.templateId) {
        setSelectedLayout(docData.template || docData.templateId);
      }
      if (docData.color) {
        setSelectedColor(docData.color);
      }
      if (docData.logoUrl) {
        setLogoUrl(docData.logoUrl);
      }
      if (docData.logoSize) {
        setLogoSize(docData.logoSize);
      }
      if (docData.pageMode) {
        setPageMode(docData.pageMode);
      }
      if (docData.documentSettings) {
        setDocumentSettings(prev => ({
          ...prev,
          ...docData.documentSettings,
        }));
      }
    }
  }, [document]);

  // E-Invoice specific states
  const [eInvoiceData, setEInvoiceData] = useState<EInvoicePayload | null>(null);
  const [loadingEInvoiceData, setLoadingEInvoiceData] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [epcQrCodeUrl, setEpcQrCodeUrl] = useState<string | null>(null);
  const [realDocumentData, setRealDocumentData] = useState<LiveDocument | null>(null);

  // Template Page Detection

  // Document type labels
  const documentLabels: Record<DocumentType, string> = useMemo(() => ({
    invoice: t('LivePreviewModal.docType.invoice'),
    quote: t('LivePreviewModal.docType.quote'),
    reminder: t('LivePreviewModal.docType.reminder'),
    'credit-note': t('LivePreviewModal.docType.creditNote'),
    cancellation: t('LivePreviewModal.docType.cancellation'),
    'delivery-note': t('LivePreviewModal.docType.deliveryNote'),
    deliveryNote: t('LivePreviewModal.docType.deliveryNote'),
    'order-confirmation': t('LivePreviewModal.docType.orderConfirmation'),
    orderConfirmation: t('LivePreviewModal.docType.orderConfirmation'),
  }), [t]);

  // Funktion zum Anreichern der Dokumentdaten mit Kundennummer und Kontaktperson
  const enrichDocumentWithCustomerData = useCallback(
    async (docData: any) => {
      // ✅ SICHERHEITSCHECK: Gar keine Datenbank-Operationen wenn nicht nötig
      const needsCustomerData =
        documentSettings.showCustomerNumber || documentSettings.showContactPerson;

      if (!needsCustomerData) {
        return docData; // Sofortiger Return ohne DB-Zugriff
      }

      if (!docData?.customerName || !companyId) {
        return docData;
      }

      try {
        // Lade Kundendaten aus der API nur wenn explizit benötigt
        const encodedName = encodeURIComponent(docData.customerName);
        const customersResult = await api.get<{ items: Array<Record<string, unknown>> }>(
          `/api/v1/customers?company_id=${companyId}&name=${encodedName}&limit=1`,
        );

        const customerData = customersResult?.items?.[0];

        if (customerData) {
          const contactPersons = customerData.contactPersons as
            | Array<{ firstName?: string; lastName?: string; phone?: string; email?: string }>
            | undefined;
          const contactPersonName = contactPersons?.[0]
            ? `${contactPersons[0].firstName || ''} ${contactPersons[0].lastName || ''}`.trim()
            : (docData.contactPersonName as string) || '';

          const enrichedDoc = {
            ...docData,
            // Nur setzen wenn die entsprechende Einstellung aktiviert ist
            customerNumber: documentSettings.showCustomerNumber
              ? (customerData.customerNumber as string) || (docData.customerNumber as string) || ''
              : (docData.customerNumber as string) || '',
            contactPersonName: documentSettings.showContactPerson
              ? contactPersonName
              : (docData.contactPersonName as string) || '',
            customerPhone:
              contactPersons?.[0]?.phone ||
              (customerData.phone as string) ||
              (docData.customerPhone as string) ||
              '',
            customerEmail:
              contactPersons?.[0]?.email ||
              (customerData.email as string) ||
              (docData.customerEmail as string) ||
              '',
          };

          return enrichedDoc;
        } else {
          return docData;
        }
      } catch (error) {
        console.error('❌ LivePreviewModal: Firebase-Fehler beim Laden der Kundendaten:', error);
        return docData; // Fallback bei Fehlern - KEINE Weiterleitung des Fehlers
      }
    },
    [companyId, documentSettings.showCustomerNumber, documentSettings.showContactPerson],
  );

  // Generate QR Code for Document (Quote/Invoice)
  const generateQRCode = useCallback(async () => {
    try {
      // Domain aus lib/marketing-url (respektiert NEXT_PUBLIC_MARKETING_URL).
      // Hier stand bis zum 10.09.2026 dreimal `https://nextdays.de` — eine
      // Domain, die uns NICHT gehoert und in keiner Weiterleitung steht
      // (deploy/DOMAIN-CUTOVER.md kennt nur mynextdays.de/.net/.org). Der
      // QR-Code auf einer Kundenrechnung zeigte damit ins Leere; zusaetzlich
      // trug er die Marke „NextDays" statt „myNextDays".
      // Ein Angebot fuehrt zur Kontaktaufnahme, eine Rechnung zur Startseite
      // — vorher war genau das vertauscht.
      const qrContent =
        documentType === 'quote'
          ? `${MARKETING_START}/kontakt`
          : MARKETING_START;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrContent)}`;
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('❌ Error generating QR Code:', error);
    }
  }, [documentType]);

  // Generate EPC QR Code (Girocode) for SEPA transfers
  const generateEPCQRCode = useCallback(async (invoiceData: LiveDocument) => {
    try {
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
      // EPC/Girocode unterstützt NUR EUR — QR nur erzeugen, wenn die Belegwährung
      // AUSDRÜCKLICH EUR ist. Eine leere/fehlende Währung (docCurrency === '') darf
      // NICHT als EUR gelten (sonst falscher EUR-QR auf einem fremdwährigen Betrag).
      const docCurrency = ((invoiceData as { currency?: string }).currency || '').toUpperCase();
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
        `EUR${(invoiceData.total || (invoiceData as { totalAmount?: number }).totalAmount || 0).toFixed(2)}`,
        '',
        `RE-${invoiceData.invoiceNumber || invoiceData.number || ''}`,
        '',
      ].join('\n');
      const epcQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(epcData)}`;
      setEpcQrCodeUrl(epcQrUrl);
    } catch (error) {
      console.error('❌ Error generating EPC QR Code:', error);
    }
  }, []);

  // Load real invoice data from database when modal opens or document changes
  useEffect(() => {
    if (!isOpen || !companyId) return;

    const loadRealInvoiceData = async () => {
      setLoadingEInvoiceData(true);
      try {
        const documentId = typeof document?.id === 'string' ? document.id : undefined;

        // Wenn document.id vorhanden ist, lade echte Daten aus der Datenbank
        if (documentId) {
          // Lade das echte Dokument aus der Datenbank
          let realDocument: LiveDocument | null = null;
          if (documentType === 'quote') {
            const { QuoteService } = await import('@/services/quoteService');
            const quoteResult = await QuoteService.getQuote(documentId);
            realDocument = quoteResult ? (quoteResult as LiveDocument) : null;
          } else {
            const { InvoiceService } = await import('@/services/firestoreInvoiceService');
            realDocument = (await InvoiceService.getInvoiceById(companyId, documentId)) as LiveDocument;
          }

          if (realDocument) {
            // ✅ Beim ersten Laden: Keine Kundendaten laden (da standardmäßig deaktiviert)
            setRealDocumentData(realDocument);

            // Lade E-Invoice-Daten wenn vorhanden (nur für Rechnungen)
            if (documentType === 'invoice' && realDocument.eInvoiceData) {
              setEInvoiceData(realDocument.eInvoiceData);

              // Generiere QR-Code für E-Invoice
              if (realDocument.eInvoiceData.guid) {
                await generateQRCode();
              }
            }
          } else {
            // ✅ Beim ersten Laden: Keine Kundendaten laden (da standardmäßig deaktiviert)
            setRealDocumentData(document as LiveDocument);
          }
        } else {
          // ✅ Für neue Dokumente: Keine Kundendaten laden (da standardmäßig deaktiviert)
          setRealDocumentData(document as LiveDocument);
        }
      } catch (error) {
        console.error('❌ Error loading real invoice data:', error);
        setRealDocumentData(document as LiveDocument); // Fallback to provided document
        toast.error(
          t('LivePreviewModal.toast.loadError', {
            docType: documentLabels[documentType] || t('LivePreviewModal.docType.generic'),
          }),
        );
      } finally {
        setLoadingEInvoiceData(false);
      }
    };

    loadRealInvoiceData();
  }, [isOpen, companyId, document, documentLabels, documentType, generateQRCode, t]); // enrichDocumentWithCustomerData entfernt

  // ✅ Reload document data when customer-related settings change
  useEffect(() => {
    if (!isOpen || !realDocumentData) return;

    // Nur neu laden wenn eine der Einstellungen von false zu true wechselt
    const needsCustomerData =
      documentSettings.showCustomerNumber || documentSettings.showContactPerson;

    if (needsCustomerData) {
      const loadRealInvoiceDataWithNewSettings = async () => {
        try {
          const enrichedDocument = await enrichDocumentWithCustomerData(realDocumentData);
          setRealDocumentData(enrichedDocument);
        } catch (error) {
          console.error('❌ Error reloading document with new settings:', error);
          // Und mit vorhandenen Daten fortfahren
        }
      };

      loadRealInvoiceDataWithNewSettings();
    }
  }, [
    documentSettings.showCustomerNumber,
    documentSettings.showContactPerson,
    enrichDocumentWithCustomerData,
    isOpen,
    realDocumentData,
  ]); // Nur bei Änderung dieser Settings neu laden

  // Generate QR Code when showQRCode is enabled
  useEffect(() => {
    if (documentSettings.showQRCode && (realDocumentData || document)) {
      generateQRCode();
    } else {
      setQrCodeUrl(null); // Clear QR code when disabled
    }
  }, [documentSettings.showQRCode, realDocumentData, document, generateQRCode]);

  // Generate EPC QR Code when showEPCQRCode is enabled
  useEffect(() => {
    if (documentSettings.showEPCQRCode && (realDocumentData || document)) {
      const docData = (realDocumentData || document) as LiveDocument;
      generateEPCQRCode(docData);
    } else {
      setEpcQrCodeUrl(null); // Clear EPC QR code when disabled
    }
  }, [documentSettings.showEPCQRCode, realDocumentData, document, generateEPCQRCode]);

  // Layout definitions with SVG previews
  const layouts = {
    standard: [
      {
        value: 'TEMPLATE_STANDARD',
        name: t('LivePreviewModal.layout.standard'),
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
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
        name: t('LivePreviewModal.layout.neutral'),
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
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
        name: t('LivePreviewModal.layout.elegant'),
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
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
        name: t('LivePreviewModal.layout.technical'),
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
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
        name: t('LivePreviewModal.layout.geometric'),
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
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
        name: t('LivePreviewModal.layout.dynamic'),
        svg: (
          <svg
            viewBox="0 0 72 102"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
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

  const documentLabel = documentLabels[documentType];

  // Zoom levels matching SevDesk
  const zoomLevels = [2, 1.75, 1.5, 1.25, 1, 0.75, 0.5];

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

  // Zuruecksetzen beim OEFFNEN — an der isOpen-Flanke, nicht an `document`.
  //
  // Vorher standen hier `document` und `logoUrl` in den Dependencies. Das war
  // eine echte Endlosschleife: der Aufrufer (invoice-modals.tsx) uebergibt
  // `document={buildInvoiceDataForPreview()}`, ein bei JEDEM Render neu
  // erzeugtes Objektliteral — die Referenz aendert sich also immer. Der Effekt
  // setzte daraufhin State (u. a. `new Set(...)`, ebenfalls immer neu), was den
  // naechsten Render ausloeste. Zusaetzlich schrieb er `logoUrl`, das in seinen
  // EIGENEN Dependencies stand, waehrend der Effekt darueber es wieder setzte.
  // `logoUrl` wird als Ref gelesen, damit die Freigabe des Object-URL erhalten
  // bleibt, ohne den Effekt erneut auszuloesen.
  const logoUrlRef = useRef<string | null>(null);
  useEffect(() => {
    logoUrlRef.current = logoUrl;
  }, [logoUrl]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveOption('download');
    setExpandedSections(new Set(['download']));
    setZoomLevel(4); // Start at 100% zoom
    setLogoFile(null);
    if (logoUrlRef.current) {
      URL.revokeObjectURL(logoUrlRef.current);
    }
    setLogoUrl(null);
    setLogoSize(50);
  }, [isOpen]);

  const handleSend = async (method: 'email' | 'download' | 'print') => {
    if (sending) return;

    try {
      setSending(true);

      if (onSend) {
        await onSend(method, {});
      }

      toast.success(t('LivePreviewModal.toast.sendSuccess', { docType: documentLabel }));
      onClose();
    } catch (error) {
      console.error('Error sending document:', error);
      toast.error(
        t('LivePreviewModal.toast.sendError', { docType: documentLabel.toLowerCase() }),
      );
    } finally {
      setSending(false);
    }
  };

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => { }}>
      <DialogPrimitive.Content className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 flex h-[90vh] w-[95vw] max-w-7xl translate-x-[-50%] translate-y-[-50%] flex-col gap-4 overflow-hidden border bg-background p-0 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in sm:rounded-lg">
        <DialogHeader className="relative shrink-0 border-b bg-accent px-6 py-4 text-white">
          {/* Weißes X-Icon */}
          <button
            onClick={onClose}
            className="absolute top-2 right-4 z-9999 rounded p-2 text-white transition-colors hover:bg-white/10 hover:text-white/80"
            style={{ color: '#FFFFFF !important', fontSize: '20px', fontWeight: 'bold' }}
          >
            ✕
          </button>
          <DialogTitle className="font-semibold text-white text-xl">
            {t('LivePreviewModal.dialogTitle', { docType: documentLabel })}
          </DialogTitle>
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
                      <p className="font-medium">{t('LivePreviewModal.companySettings.title')}</p>
                      <p className="text-sm">
                        {t('LivePreviewModal.companySettings.description', {
                          docType: documentLabel.toLowerCase(),
                        })}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => setShowCompanySettings(false)}
                      >
                        {t('LivePreviewModal.companySettings.action')}
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
                  <h3 className="font-medium text-gray-700 text-sm">
                    {t('LivePreviewModal.section.actions')}
                  </h3>
                </div>

                {/* Preview Mode: Nur "Als Entwurf speichern" */}
                {isPreviewMode && (
                  <div className="border-b">
                    <div
                      className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${isExpanded('save') ? 'border-accent border-l-4 bg-gray-50' : ''
                        }`}
                      onClick={() => toggleSection('save')}
                    >
                      <div className="flex items-center gap-3">
                        <Icon icon="lucide:check-circle" className="h-5 w-5 text-gray-600" />
                        <span className="font-medium">
                          {t('LivePreviewModal.action.saveDraft')}
                        </span>
                      </div>
                      {isExpanded('save') ? (
                        <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    {isExpanded('save') && (
                      <div className="bg-gray-50 px-4 pb-4">
                        <div className="mb-3 text-gray-600 text-sm">
                          {t('LivePreviewModal.action.saveDraftDescription', {
                            docType: documentLabel,
                          })}
                        </div>
                        <Button
                          className="w-full bg-accent hover:bg-teal-700"
                          onClick={() => {
                            if (onSaveAsDraft) {
                              onSaveAsDraft();
                            } else {
                              toast.success(
                                t('LivePreviewModal.toast.draftSaved', { docType: documentLabel }),
                              );
                              onClose();
                            }
                          }}
                        >
                          <Icon icon="lucide:check-circle" className="mr-2 h-4 w-4" />
                          {t('LivePreviewModal.action.saveDraft')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* View Mode: Alle Aktionen (Download, Drucken, Speichern) */}
                {!isPreviewMode && (
                  <>
                    {/* Download Option */}
                    <div className="border-b">
                      <div
                        className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${isExpanded('download') ? 'border-accent border-l-4 bg-gray-50' : ''
                          }`}
                        onClick={() => toggleSection('download')}
                      >
                        <div className="flex items-center gap-3">
                          <Icon icon="lucide:download" className="h-5 w-5 text-gray-600" />
                          <span className="font-medium">
                            {t('LivePreviewModal.action.download')}
                          </span>
                        </div>
                        {isExpanded('download') ? (
                          <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      {isExpanded('download') && (
                        <div className="bg-gray-50 px-4 pb-4">
                          <Button
                            onClick={() => handleSend('download')}
                            disabled={sending}
                            className="w-full bg-accent hover:bg-teal-700"
                          >
                            {sending ? (
                              <Icon icon="lucide:loader-circle" className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Icon icon="lucide:download" className="mr-2 h-4 w-4" />
                            )}
                            {t('LivePreviewModal.action.downloadPdf')}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Print Option */}
                    <div className="border-b">
                      <div
                        className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${isExpanded('print') ? 'border-accent border-l-4 bg-gray-50' : ''
                          }`}
                        onClick={() => toggleSection('print')}
                      >
                        <div className="flex items-center gap-3">
                          <Icon icon="lucide:printer" className="h-5 w-5 text-gray-600" />
                          <span className="font-medium">{t('LivePreviewModal.action.print')}</span>
                        </div>
                        {isExpanded('print') ? (
                          <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      {isExpanded('print') && (
                        <div className="bg-gray-50 px-4 pb-4">
                          <Button
                            variant="outline"
                            onClick={() => handleSend('print')}
                            disabled={sending}
                            className="w-full"
                          >
                            <Icon icon="lucide:printer" className="mr-2 h-4 w-4" />
                            {t('LivePreviewModal.action.print')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Layout Section - Always visible */}
              <div>
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h3 className="font-medium text-gray-700 text-sm">
                    {t('LivePreviewModal.section.layout')}
                  </h3>
                </div>

                {/* Layout Option */}
                <div className="border-b">
                  <div
                    className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${isExpanded('layout') ? 'border-accent border-l-4 bg-gray-50' : ''
                      }`}
                    onClick={() => toggleSection('layout')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon="lucide:layout" className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">
                        {t('LivePreviewModal.action.selectTemplate')}
                      </span>
                    </div>
                    {isExpanded('layout') ? (
                      <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
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
                              <div
                                key={layout.value}
                                className={`layout cursor-pointer rounded-lg border p-2 transition-all hover:border-accent ${selectedLayout === layout.value
                                  ? 'border-accent ring-2 ring-accent/20'
                                  : 'border-gray-200'
                                  }`}
                                onClick={() => setSelectedLayout(layout.value)}
                              >
                                <div className="mb-1 flex h-16 w-full items-center justify-center">
                                  <div className="h-14 w-12">{layout.svg}</div>
                                </div>
                                <label className="block cursor-pointer text-center text-xs">
                                  {layout.name}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Color Palette Section */}
              <div className="border-b">
                <div
                  className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${isExpanded('color') ? 'border-accent border-l-4 bg-gray-50' : ''
                    }`}
                  onClick={() => toggleSection('color')}
                >
                  <div className="flex items-center gap-3">
                    <Icon icon="lucide:palette" className="h-5 w-5 text-gray-600" />
                    <span className="font-medium">{t('LivePreviewModal.section.color')}</span>
                  </div>
                  {isExpanded('color') ? (
                    <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                {isExpanded('color') && (
                  <div className="bg-gray-50 px-4 pb-4">
                    <div className="color-palette">
                      <div className="mb-3 grid grid-cols-6 gap-2">
                        {[
                          { name: t('LivePreviewModal.color.grey'), color: '#313131', label: 'Grey' },
                          {
                            name: t('LivePreviewModal.color.lightGrey'),
                            color: '#848484',
                            label: 'Light Grey',
                          },
                          { name: t('LivePreviewModal.color.teal'), color: '#0d8375', label: 'Teal' },
                          { name: t('LivePreviewModal.color.blue'), color: '#1d65b3', label: 'Blue' },
                          {
                            name: t('LivePreviewModal.color.purple'),
                            color: '#a964d9',
                            label: 'Purple',
                          },
                          { name: t('LivePreviewModal.color.red'), color: '#c31919', label: 'Red' },
                          {
                            name: t('LivePreviewModal.color.orange'),
                            color: '#f46e32',
                            label: 'Orange',
                          },
                          {
                            name: t('LivePreviewModal.color.yellow'),
                            color: '#ffcf00',
                            label: 'Yellow',
                          },
                          { name: t('LivePreviewModal.color.pink'), color: '#fd88ab', label: 'Pink' },
                          {
                            name: t('LivePreviewModal.color.beige'),
                            color: '#c0ab60',
                            label: 'Beige',
                          },
                          {
                            name: t('LivePreviewModal.color.brown'),
                            color: '#7e4528',
                            label: 'Brown',
                          },
                          {
                            name: t('LivePreviewModal.color.accent'),
                            color: 'var(--accent)',
                            label: 'Accent',
                          },
                        ].map(colorOption => (
                          <button
                            key={colorOption.color}
                            type="button"
                            aria-label={colorOption.label}
                            className={`h-8 w-8 rounded border-2 transition-all hover:scale-110 ${selectedColor === colorOption.color
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
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.color.customColor')}
                        </Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={selectedColor}
                            onChange={e => setSelectedColor(e.target.value)}
                            className="h-8 w-12 cursor-pointer rounded border border-gray-300"
                            title={t('LivePreviewModal.color.customColorSelect')}
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

              {/* E-Invoice Section - nur für Rechnungen */}
              {documentType === 'invoice' && eInvoiceData && (
                <div className="border-b">
                  <div
                    className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${isExpanded('einvoice') ? 'border-accent border-l-4 bg-gray-50' : ''
                      }`}
                    onClick={() => toggleSection('einvoice')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon="lucide:file-text" className="h-5 w-5 text-green-600" />
                      <span className="font-medium">{t('LivePreviewModal.eInvoice.title')}</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                        {eInvoiceData.validationStatus === 'valid'
                          ? t('LivePreviewModal.eInvoice.valid')
                          : t('LivePreviewModal.eInvoice.invalid')}
                      </Badge>
                    </div>
                    {isExpanded('einvoice') ? (
                      <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  {isExpanded('einvoice') && (
                    <div className="bg-gray-50 px-4 pb-4">
                      <div className="space-y-4">
                        {/* E-Invoice Status */}
                        <div className="rounded-lg border bg-white p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {t('LivePreviewModal.eInvoice.status')}
                            </span>
                            <Badge
                              variant={
                                eInvoiceData.validationStatus === 'valid'
                                  ? 'default'
                                  : 'destructive'
                              }
                              className="text-xs"
                            >
                              {eInvoiceData.validationStatus === 'valid'
                                ? t('LivePreviewModal.eInvoice.valid')
                                : t('LivePreviewModal.eInvoice.invalid')}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-gray-600 text-xs">
                            <div>
                              {t('LivePreviewModal.eInvoice.format')}:{' '}
                              {typeof eInvoiceData.format === 'string'
                                ? eInvoiceData.format.toUpperCase()
                                : 'ZUGFeRD'}
                            </div>
                            <div>GUID: {eInvoiceData.guid}</div>
                            <div>
                              {t('LivePreviewModal.eInvoice.created')}:{' '}
                              {formatDate(
                                typeof eInvoiceData.createdAt === 'string'
                                  ? eInvoiceData.createdAt
                                  : undefined, locale)}
                            </div>
                          </div>
                        </div>

                        {/* QR Code */}
                        {qrCodeUrl && (
                          <div className="rounded-lg border bg-white p-3 text-center">
                            <div className="mb-2 font-medium text-sm">
                              {t('LivePreviewModal.eInvoice.qrCode')}
                            </div>
                            <img
                              src={qrCodeUrl}
                              alt={t("pdf.eInvoiceQrCode")}
                              className="mx-auto h-24 w-24 rounded border"
                            />

                            <div className="mt-2 text-gray-500 text-xs">
                              {t('LivePreviewModal.eInvoice.qrCodeHint')}
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
                                if (typeof eInvoiceData.xmlUrl === 'string') {
                                  window.open(eInvoiceData.xmlUrl, '_blank');
                                  toast.success(t('LivePreviewModal.toast.xmlDownloading'));
                                } else {
                                  toast.error(t('LivePreviewModal.toast.xmlUrlUnavailable'));
                                }
                              } catch (error) {
                                console.error('XML download error:', error);
                                toast.error(t('LivePreviewModal.toast.xmlDownloadError'));
                              }
                            }}
                          >
                            <Icon icon="lucide:download" className="mr-2 h-4 w-4" />
                            {t('LivePreviewModal.eInvoice.downloadXml')}
                          </Button>

                          <Button
                            variant="outline"
                            className="w-full text-sm"
                            onClick={() => {
                              toast.info(t('LivePreviewModal.toast.zugferdGenerating'));
                              // Hier würde die ZUGFeRD-PDF-Generierung stattfinden
                            }}
                          >
                            <Icon icon="lucide:download" className="mr-2 h-4 w-4" />
                            {t('LivePreviewModal.eInvoice.zugferdPdf')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* More Settings */}
              <div className="border-b">
                <div
                  className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 ${isExpanded('settings') ? 'border-accent border-l-4 bg-gray-50' : ''
                    }`}
                  onClick={() => toggleSection('settings')}
                >
                  <div className="flex items-center gap-3">
                    <Icon icon="lucide:settings" className="h-5 w-5 text-gray-600" />
                    <span className="font-medium">
                      {t('LivePreviewModal.section.moreSettings')}
                    </span>
                  </div>
                  {isExpanded('settings') ? (
                    <Icon icon="lucide:chevron-down" className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Icon icon="lucide:chevron-right" className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                {isExpanded('settings') && (
                  <div className="bg-gray-50 px-4 pb-4">
                    <div className="space-y-4">
                      {/* Sprache */}
                      <div className="space-y-2">
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.settings.language')}
                        </Label>
                        <NativeSelect
                          value={documentSettings.language}
                          onChange={e =>
                            setDocumentSettings(prev => ({ ...prev, language: e.target.value }))
                          }
                          className="w-full"
                        >
                          <option value="de">Deutsch</option>
                          <option value="en">English</option>
                          <option value="fr">Français</option>
                        </NativeSelect>
                      </div>

                      {/* QR-Code Optionen */}
                      <div className="flex items-center justify-between">
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.settings.showQRCode')}
                        </Label>
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
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.settings.showEPCQRCode')}
                        </Label>
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
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.settings.customerNumber')}
                        </Label>
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
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.settings.contactPerson')}
                        </Label>
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
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.settings.vatPerPosition')}
                        </Label>
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
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.settings.articleNumber')}
                        </Label>
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
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.settings.foldLines')}
                        </Label>
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
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.settings.pageNumbers')}
                        </Label>
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
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.settings.footer')}
                        </Label>
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
                        <Label className="font-medium text-sm">
                          {t('LivePreviewModal.settings.watermark')}
                        </Label>
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

          {/* Right side - Document Preview */}
          <div className="flex min-h-0 flex-1 flex-col">
            {loadingEInvoiceData ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-3 text-gray-500">
                  <Icon icon="lucide:loader-circle" className="h-6 w-6 animate-spin" />
                  <span>
                    {t('LivePreviewModal.loading', {
                      docType: documentLabels[documentType] || t('LivePreviewModal.docType.generic'),
                    })}
                  </span>
                </div>
              </div>
            ) : (
              <SimplePDFViewer
                zoomLevel={zoomLevels[zoomLevel]}
                a4Width={A4_DIMENSIONS.WEB.width}
                a4Height={A4_DIMENSIONS.WEB.height}
                pageMode={pageMode}
                onPageModeChange={setPageMode}
                onZoomChange={newZoom => {
                  const newIndex = zoomLevels.indexOf(newZoom);
                  if (newIndex !== -1) {
                    setZoomLevel(newIndex);
                  }
                }}
              >
                <div ref={templateRef} data-pdf-template>
                  {(() => {
                    return null;
                  })()}
                  <PDFTemplate
                    document={
                      {
                        ...((realDocumentData || document) as LiveDocument),
                        companyId: companyId, // ← CompanyId hinzufügen!
                      } as InvoiceData
                    }
                    template={selectedLayout}
                    color={selectedColor}
                    logoUrl={logoUrl}
                    logoSize={logoSize}
                    documentType={documentType}
                    pageMode={pageMode}
                    documentSettings={{
                      ...documentSettings,
                      qrCodeUrl: qrCodeUrl || undefined,
                      epcQrCodeUrl: epcQrCodeUrl || undefined,
                    }}
                    userData={
                      user
                        ? {
                          firstName: user.first_name,
                          lastName: user.last_name,
                          email: user.email || undefined,
                          phone: (user as any).phone || undefined,
                          uid: user.uid,
                        }
                        : undefined
                    }
                  />
                </div>
              </SimplePDFViewer>
            )}
          </div>
        </div>{' '}
        {/* End of main flex container */}
      </DialogPrimitive.Content>
    </Dialog>
  );
}
