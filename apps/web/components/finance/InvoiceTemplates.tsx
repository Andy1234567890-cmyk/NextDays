import type React from 'react';
import type { PDFTemplateProps } from '@/hooks/pdf/usePDFTemplateData';
import PDFTemplate from './PDFTemplates';

// Kompatibilität: Re-exportiere den zentralen Invoice-Datentyp
export type { InvoiceData } from '@/types/invoiceTypes';

// Wrapper-Komponente für Kompatibilität
const PDFTemplateWrapper: React.FC<{ data: any; companySettings?: any; customizations?: any }> = ({
  data,
  companySettings,
  customizations,
}) => {
  // Konvertiere die Props zum PDFTemplateProps-Format
  const pdfProps: PDFTemplateProps = {
    document: data,
    template: data.template || 'TEMPLATE_STANDARD',
    color: customizations?.color || 'var(--accent)',
    logoUrl: companySettings?.logoUrl || null,
    logoSize: customizations?.logoSize || 50,
    documentType: data.documentType || 'invoice',
  };

  return <PDFTemplate {...pdfProps} />;
};

// PDF-Template-Typen basierend auf den neuen PDF-Templates
export type InvoiceTemplate =
  | 'TEMPLATE_STANDARD'
  | 'TEMPLATE_NEUTRAL'
  | 'TEMPLATE_ELEGANT'
  | 'TEMPLATE_TECHNICAL'
  | 'TEMPLATE_GEOMETRIC'
  | 'TEMPLATE_DYNAMIC';

// Verfügbare PDF-Templates für alle Dokumenttypen
export const AVAILABLE_TEMPLATES: Array<{
  id: InvoiceTemplate;
  name: string;
  description: string;
  component: React.ComponentType<{ data: any; companySettings?: any; customizations?: any }>;
}> = [
  {
    id: 'TEMPLATE_STANDARD',
    name: 'Standard Business Template',
    description: 'Klassisches, professionelles Design für alle Dokumenttypen',
    component: PDFTemplateWrapper,
  },
  {
    id: 'TEMPLATE_NEUTRAL',
    name: 'Neutrales Template',
    description: 'Minimalistisches Design ohne Ablenkungen',
    component: PDFTemplateWrapper,
  },
  {
    id: 'TEMPLATE_ELEGANT',
    name: 'Elegantes Template',
    description: 'Stilvolles Design für gehobene Ansprüche',
    component: PDFTemplateWrapper,
  },
  {
    id: 'TEMPLATE_TECHNICAL',
    name: 'Technisches Template',
    description: 'Strukturiertes Design für technische Dokumente',
    component: PDFTemplateWrapper,
  },
  {
    id: 'TEMPLATE_GEOMETRIC',
    name: 'Geometrisches Template',
    description: 'Modernes Design mit geometrischen Elementen',
    component: PDFTemplateWrapper,
  },
  {
    id: 'TEMPLATE_DYNAMIC',
    name: 'Dynamisches Template',
    description: 'Flexibles Design mit dynamischen Anpassungen',
    component: PDFTemplateWrapper,
  },
];

// Standard Template für normale Rechnungen
export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplate = 'TEMPLATE_STANDARD';

// Template-Konstanten für verschiedene Dokumenttypen
export const DOCUMENT_TYPE_TEMPLATES = {
  invoice: 'TEMPLATE_STANDARD',
  reminder: 'TEMPLATE_STANDARD',
  quote: 'TEMPLATE_STANDARD',
  delivery: 'TEMPLATE_STANDARD',
  cancellation: 'TEMPLATE_STANDARD', // Stornorechnung
} as const;

export interface InvoiceTemplateRendererProps {
  template: InvoiceTemplate;
  data: any;
  preview?: boolean;
  onRender?: (html: string) => void;
  companySettings?: any;
  customizations?: {
    showLogo?: boolean;
    [key: string]: any;
  };
  pageMode?: 'single' | 'multi';
  documentSettings?: any;
}

export const InvoiceTemplateRenderer: React.FC<InvoiceTemplateRendererProps> = ({
  template,
  data,
  preview: _preview = false,
  onRender: _onRender,
  companySettings,
  customizations = { showLogo: true },
  pageMode = 'multi',
  documentSettings,
}) => {
  // PDF-Template verwenden - alle Templates sind jetzt PDF-basiert
  const normalizedData = {
    ...data,
    company: {
      ...data?.company,
      bankDetails: data?.company?.bankDetails || data?.bankDetails || {},
    },
  };

  // PDFTemplate-Props korrekt für die PDFTemplateProps-Interface
  const pdfTemplateProps = {
    document: normalizedData, // InvoiceData-Format
    template, // Template-ID
    color: customizations?.color || 'var(--accent)', // Akzentfarbe als Standard
    logoUrl: customizations?.logoUrl || companySettings?.logoUrl || null,
    logoSize: customizations?.logoSize || 50,
    documentType: (data.documentType || 'invoice') as
      | 'invoice'
      | 'quote'
      | 'reminder'
      | 'cancellation',
    pageMode: pageMode, // Single oder Multi Page
    documentSettings: documentSettings, // Dokumenteinstellungen
  };

  // Alle Templates verwenden jetzt PDFTemplate
  return <PDFTemplate {...pdfTemplateProps} />;
};
