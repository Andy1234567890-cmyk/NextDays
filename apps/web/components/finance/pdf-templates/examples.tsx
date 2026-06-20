/**
 * Beispiel für die Verwendung der neuen modularen PDF-Template-Struktur
 *
 * Diese Datei zeigt, wie die Templates nach der Refactoring verwendet werden.
 */

import type React from 'react';
import PDFTemplate from '@/components/finance/PDFTemplates';
import {
  type PDFTemplateProps,
  type ProcessedPDFData,
  StandardTemplate,
  TotalsDisplay,
  usePDFTemplateData,
} from '@/components/finance/pdf-templates';
import { TaxRuleType } from '@/types/taxRules';

// === GRUNDLEGENDE VERWENDUNG ===

const BasicUsageExample: React.FC = () => {
  const sampleInvoiceData: PDFTemplateProps['document'] = {
    id: 'sample-invoice-1',
    number: 'RE-MOCK-001',
    invoiceNumber: 'RE-MOCK-001',
    sequentialNumber: 1,
    date: '2026-03-09',
    issueDate: '2026-03-09',
    dueDate: '2026-03-23',
    companyName: 'Meine Firma GmbH',
    companyAddress: 'Musterstrasse 1, 10115 Berlin',
    companyEmail: 'info@meinefirma.de',
    companyPhone: '+49 30 123456',
    companyWebsite: 'https://meinefirma.de',
    companyLogo: 'https://example.com/logo.png',
    companyVatId: 'DE123456789',
    companyTaxNumber: '12/345/67890',
    customerName: 'Max Mustermann',
    customerEmail: 'max@example.com',
    customerAddress: 'Kundenweg 10, 20095 Hamburg',
    description: 'Rechnung fuer Beratungsleistung',
    isSmallBusiness: false,
    vatRate: 19,
    priceInput: 'netto',
    taxRuleType: TaxRuleType.DE_TAXABLE,
    items: [
      {
        id: 'item-1',
        description: 'Beratungsleistung',
        quantity: 5,
        unitPrice: 100,
        total: 500,
      },
    ],
    amount: 500,
    tax: 95,
    total: 595,
    status: 'draft',
    createdAt: new Date(),
    year: 2026,
    companyId: 'company-1',
    isStorno: false,

    // ... weitere Felder
  };

  return (
    <PDFTemplate
      document={sampleInvoiceData}
      template="TEMPLATE_ELEGANT"
      color="#b82028"
      logoUrl="https://example.com/logo.png"
      logoSize={60}
      documentType="invoice"
    />
  );
};

// === ERWEITERTE VERWENDUNG MIT HOOK ===

const AdvancedUsageExample: React.FC<{ document: PDFTemplateProps['document'] }> = ({
  document,
}) => {
  // Verwende den Hook direkt für Custom Logic
  const data = usePDFTemplateData({
    document,
    template: 'TEMPLATE_STANDARD',
    color: '#b82028',
    logoSize: 50,
    documentType: 'invoice',
  });

  // Zugriff auf alle berechneten Werte

  return (
    <div className="custom-pdf-wrapper">
      <StandardTemplate data={data} color="#b82028" logoSize={50} />
    </div>
  );
};

// === EIGENE TEMPLATE-KOMPONENTE ERSTELLEN ===

interface CustomTemplateProps {
  data: ProcessedPDFData;
  color: string;
  logoSize: number;
}

const MyCustomTemplate: React.FC<CustomTemplateProps> = ({ data, color, logoSize }) => {
  return (
    <div className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-6">
      {/* Custom Header */}
      <header className="mb-8 border-b-2" style={{ borderColor: color }}>
        <h1 className="font-bold text-3xl" style={{ color }}>
          {data.documentLabel} - {data.invoiceNumber}
        </h1>
        {data.companyLogo && (
          <img src={data.companyLogo} alt="Logo" style={{ height: `${logoSize}px` }} />
        )}
      </header>

      {/* Verwende Common Components */}
      <div className="mb-8">
        <h2 className="mb-4 font-semibold text-lg">Kundeninformationen</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>{data.customerName}</strong>
            <br />
            {data.customerAddressParsed.street}
            <br />
            {data.customerAddressParsed.postalCode} {data.customerAddressParsed.city}
          </div>
          <div>
            <strong>Rechnungsdetails</strong>
            <br />
            Nummer: {data.invoiceNumber}
            <br />
            Datum: {data.invoiceDate}
          </div>
        </div>
      </div>

      {/* Wiederverwendbare Totals-Komponente */}
      <TotalsDisplay data={data} color={color} variant="elegant" />
    </div>
  );
};

// === TEMPLATE IN MAIN CONTAINER REGISTRIEREN ===

// In PDFTemplates.tsx ergänzen:
/*
const PDFTemplate: React.FC<PDFTemplateProps> = (props) => {
  const data = usePDFTemplateData(props);

  const renderTemplate = () => {
    switch (props.template) {
      case 'TEMPLATE_MYCUSTOM':
        return <MyCustomTemplate data={data} color={props.color} logoSize={props.logoSize || 50} />;
      // ... andere Templates
      default:
        return <NeutralTemplate data={data} color={props.color} logoSize={props.logoSize || 50} />;
    }
  };

  return (
    <div className="w-full h-full bg-white shadow-lg">
      {renderTemplate()}
    </div>
  );
};
*/

// === TESTING BEISPIEL ===

// Mock für Tests
const createMockInvoiceData = (
  overrides: Partial<PDFTemplateProps['document']> = {},
): PDFTemplateProps['document'] => ({
  id: 'test-invoice',
  number: 'TEST-MOCK',
  invoiceNumber: 'TEST-MOCK',
  sequentialNumber: 1,
  date: '2026-03-09',
  issueDate: '2026-03-09',
  dueDate: '2026-03-23',
  companyName: 'Test Company',
  companyAddress: 'Teststrasse 1, 10115 Berlin',
  companyEmail: 'test@company.de',
  companyPhone: '+49 30 555555',
  companyWebsite: 'https://test-company.de',
  companyLogo: '',
  companyVatId: 'DE000000000',
  companyTaxNumber: '00/000/00000',
  customerName: 'Test Customer',
  customerEmail: 'customer@test.de',
  customerAddress: 'Kundenstrasse 2, 20095 Hamburg',
  description: 'Testrechnung',
  items: [{ id: 'item-test-1', description: 'Test Item', quantity: 1, unitPrice: 100, total: 100 }],
  amount: 100,
  tax: 19,
  total: 119,
  isSmallBusiness: false,
  vatRate: 19,
  priceInput: 'netto',
  taxRuleType: TaxRuleType.DE_TAXABLE,
  status: 'draft',
  createdAt: new Date(),
  year: 2026,
  companyId: 'company-test',
  isStorno: false,
  ...overrides,
});

// Jest Test Beispiel
/*
describe('PDF Templates', () => {
  test('should render StandardTemplate correctly', () => {
    const mockData = createMockInvoiceData();
    const { container } = render(
      <PDFTemplate
        document={mockData}
        template="TEMPLATE_STANDARD"
        color="#b82028"
        documentType="invoice"
      />
    );

    expect(container.querySelector('[data-testid="invoice-number"]'))
      .toHaveTextContent('TEST-MOCK');
  });

  test('should calculate totals correctly', () => {
    const mockData = createMockInvoiceData({
      items: [
        { description: 'Item 1', quantity: 2, unitPrice: 50, total: 100 },
        { description: 'Item 2', quantity: 1, unitPrice: 200, total: 200 }
      ]
    });

    const { result } = renderHook(() => usePDFTemplateData({
      document: mockData,
      template: 'TEMPLATE_STANDARD',
      color: '#b82028',
      documentType: 'invoice',
      logoSize: 50
    }));

    expect(result.current.subtotal).toBe(300);
    expect(result.current.taxAmount).toBe(57); // 19% von 300
    expect(result.current.total).toBe(357);
  });
});
*/

export { BasicUsageExample, AdvancedUsageExample, MyCustomTemplate, createMockInvoiceData };
