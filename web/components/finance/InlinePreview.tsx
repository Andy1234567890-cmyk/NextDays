'use client';

// 1:1 aus dem Taskilo-Finanzwerkzeug (components/finance/InlinePreview.tsx):
// rendert einen Beleg mit der gewählten PDF-Vorlage in der Seite (A4, 80 %),
// angereichert um die Firmendaten des Betriebs. Genutzt von der Angebots-
// Detailansicht (QuoteDetailView) als Live-Vorschau und als Quelle des
// PDF-Downloads (`[data-pdf-template]`).
// Anpassungen: Texte über useTranslations, Ladeindikator im Accent-Token,
// `companyId` ist der Tenant aus der NextDays-Session (kein [uid]-Parameter).
import { useTranslations } from 'next-intl';
import type React from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { DocumentType } from '@/lib/document-utils';
import type { InvoiceData } from '@/types/invoiceTypes';
import PDFTemplate from './PDFTemplates';

interface InlinePreviewProps {
  document: InvoiceData | Record<string, unknown>;
  documentType: DocumentType;
  companyId: string;
  className?: string;
}

type LooseRecord = Record<string, unknown>;

export function InlinePreview({
  document,
  documentType,
  companyId,
  className = '',
}: InlinePreviewProps) {
  const t = useTranslations('finance');
  const [realDocumentData, setRealDocumentData] = useState<LooseRecord | null>(null);
  const [companyData, setCompanyData] = useState<LooseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const documentId = (document as LooseRecord)?.id as string | undefined;

  // Lade die echten Daten via FastAPI - BEIDE Beleg UND Company
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      try {
        // 1. Company-Daten (Firmenprofil des Betriebs)
        const company = await api.get<LooseRecord>(`/api/v1/companies/${companyId}`);
        if (!company) {
          throw new Error(`Company not found: ${companyId}`);
        }
        setCompanyData(company);

        // 2. Beleg-Daten frisch laden (Positionen, Kunde, Vorlage)
        let realDocument: LooseRecord | null = null;
        if (documentId) {
          if (documentType === 'quote') {
            const { QuoteService } = await import('@/services/quoteService');
            realDocument = (await QuoteService.getQuote(documentId)) as LooseRecord | null;
          } else {
            try {
              const invoiceResponse = await api.get<LooseRecord>(
                `/api/v1/invoices/${documentId}`,
              );
              if (invoiceResponse) {
                realDocument = invoiceResponse;
              }
            } catch {
              console.warn('InlinePreview: Rechnung via API nicht gefunden');
            }
          }

          if (realDocument) {
            // Vorlagen-Überschreibungen aus den Props (Detailansicht/URL) behalten.
            setRealDocumentData({ ...realDocument, ...pickTemplateOverrides(document) });
          } else {
            console.warn('InlinePreview: Keine Beleg-Daten gefunden, verwende Props');
            setRealDocumentData(document as LooseRecord);
          }
        } else {
          setRealDocumentData(document as LooseRecord);
        }
      } catch (error) {
        console.error('InlinePreview: Fehler beim Laden der Daten:', error);
        setRealDocumentData(document as LooseRecord);
      } finally {
        setLoading(false);
      }
    };

    if (document && companyId) {
      loadAllData();
    }
    // `document` bewusst nicht als Abhängigkeit: die Detailansicht baut das
    // Objekt bei jedem Render neu, was hier eine Ladeschleife auslöste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, companyId, documentType]);

  if (loading) {
    return (
      <div className={`flex h-96 items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-accent border-b-2"></div>
          <p className="text-muted-foreground">{t('InlinePreview.loading')}</p>
        </div>
      </div>
    );
  }

  if (!realDocumentData) {
    return (
      <div className={`flex h-96 items-center justify-center ${className}`}>
        <div className="text-center">
          <p className="text-muted-foreground">{t('InlinePreview.noDocument')}</p>
        </div>
      </div>
    );
  }

  // KRITISCH: Company-Daten MÜSSEN vorhanden sein
  if (!companyData) {
    return (
      <div className={`flex h-96 items-center justify-center ${className}`}>
        <div className="text-center">
          <p className="font-semibold text-destructive">{t('InlinePreview.noCompany')}</p>
        </div>
      </div>
    );
  }

  // Template-Einstellungen aus Beleg + Company-Daten kombinieren
  const docData = realDocumentData;
  const company = companyData;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  // Angereicherte Dokument-Daten mit Company-Informationen
  const enrichedDocument = {
    ...realDocumentData,
    // Company-Daten hinzufügen
    companyName: str(company.companyName) || str(company.name),
    companyAddress: [
      [str(company.companyStreet), str(company.companyHouseNumber)].filter(Boolean).join(' '),
      [str(company.companyPostalCode), str(company.companyCity)].filter(Boolean).join(' '),
      str(company.companyCountry),
    ]
      .filter(Boolean)
      .join('\n'),
    companyEmail: str(company.contactEmail) || str(company.email),
    companyPhone: str(company.phoneNumber) || str(company.companyPhoneNumber),
    companyWebsite: str(company.companyWebsiteForBackend) || str(company.website),
    companyVatId: str(company.vatId),
    companyTaxNumber: str(company.taxNumber),
    // Bank-Details aus Company
    bankDetails: (company.bankDetails as LooseRecord | undefined) || {
      iban: str(company.iban),
      bic: str(company.bic),
      accountHolder: str(company.accountHolder),
      bankName: str(company.bankName),
    },
    // Template-Einstellungen: Beleg vor Betrieb vor neutraler Vorlage
    template:
      docData.template ||
      docData.templateId ||
      // Aufenthaltsangebot (Objektbezug): Vorlage Aufenthalt, sonst Betrieb/neutral.
      (docData.stay ? 'TEMPLATE_STAY' : undefined) ||
      company.preferredInvoiceTemplate ||
      'TEMPLATE_NEUTRAL',
    color: docData.color || 'var(--accent)',
    logoUrl:
      docData.logoUrl || company.profilePictureURL || company.profilePictureFirebaseUrl || null,
    logoSize: docData.logoSize || 50,
    pageMode: docData.pageMode || 'single',
    documentSettings: {
      // Dokumentsprache des Belegs (invoices/quotes.language); Bestand ohne Wert → de.
      language: (docData.language as string) || 'de',
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
      // Übernehme spezifische Settings aus dem Beleg
      ...((docData.documentSettings as LooseRecord | undefined) || {}),
    },
    // KRITISCH: Steuer-Einstellungen aus dem gespeicherten Dokument (nicht Company!)
    taxRule: docData.taxRule || docData.taxRuleType,
    taxRuleType: docData.taxRuleType || docData.taxRule,
    isSmallBusiness: Boolean(docData.isSmallBusiness),
    vatRate: docData.vatRate || docData.taxRate || 0,
    taxRate: docData.taxRate || docData.vatRate || 0,
    // Fallback auf Company-Einstellungen nur wenn keine Dokument-spezifischen vorhanden
    priceInput: docData.priceInput || company.priceInput || 'netto',
    kleinunternehmer: docData.kleinunternehmer || company.kleinunternehmer || 'nein',
  };

  const templateProps = {
    document: enrichedDocument,
    template: enrichedDocument.template,
    color: enrichedDocument.color,
    logoUrl: enrichedDocument.logoUrl,
    logoSize: enrichedDocument.logoSize,
    documentType: documentType,
    pageMode: enrichedDocument.pageMode,
    documentSettings: enrichedDocument.documentSettings,
  } as unknown as React.ComponentProps<typeof PDFTemplate>;

  return (
    <div
      className={className}
      data-pdf-template
      style={{
        width: '210mm',
        minHeight: '297mm',
        transform: 'scale(0.8)',
        transformOrigin: 'center top',
      }}
    >
      <PDFTemplate {...templateProps} />
    </div>
  );
}

// Vorlagen-Felder, die der Aufrufer über die geladenen Daten legen darf.
function pickTemplateOverrides(document: unknown): LooseRecord {
  const src = (document || {}) as LooseRecord;
  const out: LooseRecord = {};
  for (const key of ['template', 'color', 'logoSize', 'pageMode', 'logoUrl', 'documentSettings']) {
    if (src[key] !== undefined && src[key] !== null) out[key] = src[key];
  }
  return out;
}
