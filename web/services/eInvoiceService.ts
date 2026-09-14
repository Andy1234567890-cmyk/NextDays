/**
 * E-Invoice Service für ZUGFeRD und XRechnung Standards
 * Implementiert die deutsche E-Rechnungspflicht nach sevdesk Vorbild
 */

'use client';

import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { PDFDocument } from 'pdf-lib';
import { api } from '@/lib/api-client';
import {
  belegWaehrungErzwingen,
  steuersatzErzwingen,
} from '@/lib/steuer-waehrung';

// Eingaben der XML-Erzeugung. Beleg und Firma kommen aus unterschiedlichen
// Quellen (Editor-Formular, gespeicherte Rechnung, Firmenprofil) mit teils
// alternativen Feldnamen — deshalb optionale Felder plus offener Rest statt
// `any`: was das XML liest, ist benannt; was es nicht liest, stört nicht.
export interface EInvoicePosition {
  description?: string;
  name?: string;
  articleNumber?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  price?: number;
  total?: number;
  totalPrice?: number;
  taxRate?: number;
  vatRate?: number;
  [key: string]: unknown;
}

export interface EInvoiceBeleg {
  // Pflichtangaben einer E-Rechnung (EN 16931) — ohne sie gibt es kein XML.
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  isStorno?: boolean;
  currency?: string;
  currencyCode?: string;
  amount: number;
  tax: number;
  total: number;
  vatRate?: number;
  items: EInvoicePosition[];
  customerName: string;
  customerAddress: string;
  customerEmail?: string;
  customerNumber?: string;
  customerVatId?: string;
  customerCountry?: string;
  customer?: { country?: string } | null;
  notes?: string;
  paymentTerms?: string;
  paymentTermsDays?: number;
  purchaseOrderNumber?: string;
  buyerReference?: string;
  buyerAccountingReference?: string;
  leitwegId?: string;
  [key: string]: unknown;
}

export interface EInvoiceFirma {
  companyName: string;
  companyAddress: string;
  companyEmail?: string;
  companyVatId?: string;
  taxNumber?: string;
  registrationNumber?: string;
  legalForm?: string;
  iban?: string;
  bic?: string;
  accountHolder?: string;
  companyCountry?: string;
  country?: string;
  tenantCountry?: string;
  [key: string]: unknown;
}

export interface EInvoiceData {
  id?: string;
  invoiceId: string;
  companyId: string;
  format: 'zugferd' | 'xrechnung';
  standard: 'EN16931' | 'BASIC' | 'COMFORT' | 'EXTENDED';
  xmlContent: string;
  pdfContent?: string; // Base64 encoded PDF
  amount?: number; // Rechnungsbetrag für Statistiken
  validationStatus: 'valid' | 'invalid' | 'pending';
  validationErrors?: string[];
  transmissionStatus: 'draft' | 'sent' | 'received' | 'processed' | 'pending';
  transmissionMethod?: 'email' | 'webservice' | 'portal'; // Übertragungsart
  recipientType?: 'business' | 'government'; // B2B oder B2G
  recipientEndpoint?: string;
  leitweg?: string; // XRechnung Leitweg-ID
  buyerReference?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EInvoiceSettings {
  id?: string;
  companyId: string;
  defaultFormat: 'zugferd' | 'xrechnung';
  defaultStandard: 'EN16931' | 'BASIC' | 'COMFORT' | 'EXTENDED';
  enableAutoGeneration: boolean;
  peppol: {
    enabled: boolean;
    participantId?: string;
    endpoint?: string;
  };
  xrechnung?: {
    leitwegId: string;
    buyerReference?: string;
  };
  validation: {
    strictMode: boolean;
    autoCorrection: boolean;
  };
  tse?: {
    enabled: boolean;
    serialNumber?: string;
    publicKey?: string;
    certificateSerial?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface XRechnungMetadata {
  buyerReference: string;
  leitwegId: string;
  processingNote?: string;
  specificationId: string;
  businessProcessType: string;
}

export interface ZUGFeRDMetadata {
  conformanceLevel: 'BASIC' | 'COMFORT' | 'EXTENDED';
  guideline: string;
  specificationId: string;
}

export interface TSEData {
  serialNumber: string;
  signatureAlgorithm: string;
  transactionNumber: string;
  startTime: string;
  finishTime: string;
  signature: string;
  publicKey: string;
  certificateSerial: string;
}

export class EInvoiceService {
  /**
   * Erstellt eine neue E-Rechnung
   */
  static async createEInvoice(
    eInvoiceData: Omit<EInvoiceData, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    try {
      if (!eInvoiceData.invoiceId || !eInvoiceData.companyId || !eInvoiceData.xmlContent) {
        throw new Error(
          `Missing required fields: invoiceId=${!!eInvoiceData.invoiceId}, companyId=${!!eInvoiceData.companyId}, xmlContent=${!!eInvoiceData.xmlContent}`,
        );
      }

      const response = await api.post<{ id: string }>(
        `/api/v1/einvoice/${eInvoiceData.companyId}`,
        eInvoiceData,
      );
      return response.id;
    } catch (error) {
      console.error('❌ Failed to create E-Invoice:', error);
      throw new Error(
        `E-Rechnung konnte nicht erstellt werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        { cause: error },
      );
    }
  }

  /**
   * Generiert ZUGFeRD XML für eine Rechnung
   */
  static async generateZUGFeRDXML(
    invoiceData: EInvoiceBeleg,
    metadata: ZUGFeRDMetadata,
    companyData: EInvoiceFirma,
  ): Promise<string> {
    try {
      // Wurzel 4: Waehrung IMMER aus den Belegdaten, nie hardcoden. Fehlt sie,
      // ist das ein Datenfehler → fail-closed, kein plausibler EUR-Ersatzwert
      // (die E-Rechnung ist rechtsverbindlich, eine falsche Waehrung ist fatal).
      const currency = EInvoiceService.requireCurrency(invoiceData);
      const xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
                          xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
                          xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
                          xmlns:xs="http://www.w3.org/2001/XMLSchema"
                          xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${metadata.guideline || 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${invoiceData.invoiceNumber}</ram:ID>
    <ram:TypeCode>${invoiceData.isStorno ? '381' : '380'}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${invoiceData.issueDate.replace(/-/g, '')}</udt:DateTimeString>
    </ram:IssueDateTime>
    ${invoiceData.notes ? `<ram:IncludedNote>\n      <ram:Content>${invoiceData.notes}</ram:Content>\n    </ram:IncludedNote>` : ''}
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${invoiceData.buyerReference || invoiceData.leitwegId || invoiceData.customerNumber || 'KUNDE'}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${companyData.companyName}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${EInvoiceService.extractPostcode(companyData.companyAddress)}</ram:PostcodeCode>
          <ram:LineOne>${EInvoiceService.extractAddressLine(companyData.companyAddress)}</ram:LineOne>
          <ram:CityName>${EInvoiceService.extractCity(companyData.companyAddress)}</ram:CityName>
          <ram:CountryID>${EInvoiceService.requireCountry(companyData?.companyCountry ?? companyData?.country ?? companyData?.tenantCountry, 'Verkäufer')}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${companyData.companyEmail ? `<ram:URIUniversalCommunication>\n          <ram:URIID schemeID="EM">${companyData.companyEmail}</ram:URIID>\n        </ram:URIUniversalCommunication>` : ''}
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${companyData.companyVatId}</ram:ID>
        </ram:SpecifiedTaxRegistration>
        ${companyData.taxNumber ? `<ram:SpecifiedTaxRegistration>\n          <ram:ID schemeID="FC">${companyData.taxNumber}</ram:ID>\n        </ram:SpecifiedTaxRegistration>` : ''}
        ${companyData.legalForm && companyData.registrationNumber ? `<ram:SpecifiedLegalOrganization>\n          <ram:ID>${companyData.registrationNumber}</ram:ID>\n          <ram:TradingBusinessName>${companyData.companyName}</ram:TradingBusinessName>\n        </ram:SpecifiedLegalOrganization>` : ''}
      </ram:SellerTradeParty>

      <ram:BuyerTradeParty>
        <ram:Name>${invoiceData.customerName}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${EInvoiceService.extractPostcode(invoiceData.customerAddress)}</ram:PostcodeCode>
          <ram:LineOne>${EInvoiceService.extractAddressLine(invoiceData.customerAddress)}</ram:LineOne>
          <ram:CityName>${EInvoiceService.extractCity(invoiceData.customerAddress)}</ram:CityName>
          <ram:CountryID>${EInvoiceService.requireCountry(invoiceData?.customerCountry ?? invoiceData?.customer?.country, 'Käufer')}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${invoiceData.customerEmail ? `<ram:URIUniversalCommunication>\n          <ram:URIID schemeID="EM">${invoiceData.customerEmail}</ram:URIID>\n        </ram:URIUniversalCommunication>` : ''}
        ${invoiceData.customerVatId ? `<ram:SpecifiedTaxRegistration>\n          <ram:ID schemeID="VA">${invoiceData.customerVatId}</ram:ID>\n        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${invoiceData.issueDate.replace(/-/g, '')}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>

    <ram:ApplicableHeaderTradeSettlement>
      ${invoiceData.buyerAccountingReference || invoiceData.purchaseOrderNumber ? `<ram:ReceivableSpecifiedTradeAccountingAccount>\n        <ram:ID>${invoiceData.buyerAccountingReference || invoiceData.purchaseOrderNumber}</ram:ID>\n      </ram:ReceivableSpecifiedTradeAccountingAccount>` : ''}
      <ram:PaymentReference>${invoiceData.invoiceNumber}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>
      ${companyData.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans>\n        <ram:TypeCode>58</ram:TypeCode>\n        <ram:PayeePartyCreditorFinancialAccount>\n          <ram:IBANID>${companyData.iban}</ram:IBANID>\n          <ram:AccountName>${companyData.accountHolder || companyData.companyName}</ram:AccountName>\n        </ram:PayeePartyCreditorFinancialAccount>\n        ${companyData.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution>\n          <ram:BICID>${companyData.bic}</ram:BICID>\n        </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}\n      </ram:SpecifiedTradeSettlementPaymentMeans>` : ''}

      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${invoiceData.tax.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${invoiceData.amount.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${invoiceData.vatRate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>

      <ram:SpecifiedTradePaymentTerms>
        ${invoiceData.paymentTerms || invoiceData.paymentTermsDays ? `<ram:Description>${invoiceData.paymentTerms || `Zahlbar innerhalb von ${invoiceData.paymentTermsDays || 14} Tagen ohne Abzug.`}</ram:Description>` : ''}
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${invoiceData.dueDate.replace(/-/g, '')}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>

      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${invoiceData.amount.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${invoiceData.amount.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${invoiceData.tax.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${invoiceData.total.toFixed(2)}</ram:GrandTotalAmount>
        <ram:TotalPrepaidAmount>0.00</ram:TotalPrepaidAmount>
        <ram:DuePayableAmount>${invoiceData.total.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>

    ${EInvoiceService.generateLineItems(invoiceData.items)}
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

      return xmlTemplate;
    } catch (error) {
      console.error('ZUGFeRD XML Generation Error:', error);
      throw new Error(
        `ZUGFeRD XML konnte nicht generiert werden: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  /**
   * Generiert XRechnung XML für eine Rechnung
   */
  static async generateXRechnungXML(
    invoiceData: EInvoiceBeleg,
    metadata: XRechnungMetadata,
    companyData: EInvoiceFirma,
  ): Promise<string> {
    try {
      // Wurzel 4: Belegwaehrung durchreichen statt EUR hardcoden; fehlt sie,
      // fail-closed (rechtsverbindliches Dokument, kein Ersatzwert).
      const currency = EInvoiceService.requireCurrency(invoiceData);
      const xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

  <cbc:CustomizationID>${metadata.specificationId}</cbc:CustomizationID>
  <cbc:ProfileID>${metadata.businessProcessType}</cbc:ProfileID>
  <cbc:ID>${invoiceData.invoiceNumber}</cbc:ID>
  <cbc:IssueDate>${invoiceData.issueDate}</cbc:IssueDate>
  <cbc:DueDate>${invoiceData.dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>${invoiceData.isStorno ? '381' : '380'}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${metadata.buyerReference}</cbc:BuyerReference>

  ${metadata.processingNote ? `<cbc:Note>${metadata.processingNote}</cbc:Note>` : ''}

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${companyData.companyName}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${EInvoiceService.extractAddressLine(companyData.companyAddress)}</cbc:StreetName>
        <cbc:CityName>${EInvoiceService.extractCity(companyData.companyAddress)}</cbc:CityName>
        <cbc:PostalZone>${EInvoiceService.extractPostcode(companyData.companyAddress)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${EInvoiceService.requireCountry(companyData?.companyCountry ?? companyData?.country ?? companyData?.tenantCountry, 'Verkäufer')}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${companyData.companyVatId}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${invoiceData.customerName}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${EInvoiceService.extractAddressLine(invoiceData.customerAddress)}</cbc:StreetName>
        <cbc:CityName>${EInvoiceService.extractCity(invoiceData.customerAddress)}</cbc:CityName>
        <cbc:PostalZone>${EInvoiceService.extractPostcode(invoiceData.customerAddress)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${EInvoiceService.requireCountry(invoiceData?.customerCountry ?? invoiceData?.customer?.country, 'Käufer')}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cbc:PaymentID>${invoiceData.invoiceNumber}</cbc:PaymentID>
  </cac:PaymentMeans>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${invoiceData.tax.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${invoiceData.amount.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${invoiceData.tax.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${invoiceData.vatRate}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${invoiceData.amount.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${invoiceData.amount.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${invoiceData.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${invoiceData.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  ${EInvoiceService.generateXRechnungLineItems(invoiceData.items, currency)}
</Invoice>`;

      return xmlTemplate;
    } catch {
      throw new Error('XRechnung XML konnte nicht generiert werden');
    }
  }

  /**
   * Validiert E-Rechnung nach EN 16931 Standard
   */
  static async validateEInvoice(
    xmlContent: string,
    format: 'zugferd' | 'xrechnung',
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Basis XML-Validierung
      if (!xmlContent.trim()) {
        errors.push('XML-Inhalt ist leer');
        return { isValid: false, errors, warnings };
      }

      // Format-spezifische Validierung
      if (format === 'zugferd') {
        if (!xmlContent.includes('CrossIndustryInvoice')) {
          errors.push('Ungültiges ZUGFeRD Format - CrossIndustryInvoice Element fehlt');
        }

        // ZUGFeRD spezifische Pflichtfelder prüfen
        const zugferdRequiredFields = [
          'rsm:ExchangedDocument',
          'ram:ID',
          'ram:TypeCode',
          'ram:IssueDateTime',
          'ram:InvoiceCurrencyCode',
          'ram:SellerTradeParty',
          'ram:BuyerTradeParty',
        ];

        for (const field of zugferdRequiredFields) {
          if (!xmlContent.includes(field)) {
            errors.push(`Pflichtfeld fehlt: ${field}`);
          }
        }

        // ZUGFeRD spezifische Warnungen
        if (!xmlContent.includes('GuidelineSpecifiedDocumentContextParameter')) {
          warnings.push(
            'GuidelineSpecifiedDocumentContextParameter sollte für Standards-Konformität vorhanden sein',
          );
        }
      } else if (format === 'xrechnung') {
        if (!xmlContent.includes('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2')) {
          errors.push('Ungültiges XRechnung Format - UBL Namespace fehlt');
        }

        // XRechnung spezifische Pflichtfelder prüfen
        const xrechnungRequiredFields = [
          'ID',
          'IssueDate',
          'InvoiceTypeCode',
          'DocumentCurrencyCode',
          'AccountingSupplierParty',
          'AccountingCustomerParty',
        ];

        for (const field of xrechnungRequiredFields) {
          if (!xmlContent.includes(field)) {
            errors.push(`Pflichtfeld fehlt: ${field}`);
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validierung fehlgeschlagen: ${(error as Error).message}`],
        warnings: [],
      };
    }
  }

  /**
   * Lädt alle E-Rechnungen für ein Unternehmen
   */
  static async getEInvoicesByCompany(companyId: string): Promise<EInvoiceData[]> {
    try {
      return await api.get<EInvoiceData[]>(`/api/v1/einvoice/${companyId}`);
    } catch {
      throw new Error('E-Rechnungen konnten nicht geladen werden');
    }
  }

  /**
   * Lädt eine einzelne E-Rechnung anhand der ID
   */
  static async getEInvoiceById(companyId: string, id: string): Promise<EInvoiceData | null> {
    try {
      return await api.get<EInvoiceData>(`/api/v1/einvoice/${companyId}/${id}`);
    } catch {
      return null;
    }
  }

  /**
   * Speichert oder aktualisiert E-Rechnungs-Einstellungen
   */
  static async saveEInvoiceSettings(
    settings: Omit<EInvoiceSettings, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    try {
      await api.put(`/api/v1/einvoice/${settings.companyId}/settings`, settings);
    } catch {
      throw new Error('E-Rechnungs-Einstellungen konnten nicht gespeichert werden');
    }
  }

  /**
   * Lädt E-Rechnungs-Einstellungen für ein Unternehmen
   */
  static async getEInvoiceSettings(companyId: string): Promise<EInvoiceSettings> {
    try {
      return await api.get<EInvoiceSettings>(`/api/v1/einvoice/${companyId}/settings`);
    } catch (error) {
      console.error('Fehler beim Laden der E-Rechnungs-Einstellungen:', error);
      throw new Error('E-Rechnungs-Einstellungen konnten nicht geladen werden', { cause: error });
    }
  }

  // Hilfsmethoden für Adressparsingg
  private static extractAddressLine(address: string): string {
    return address.split('\n')[0] || '';
  }

  private static extractPostcode(address: string): string {
    const lines = address.split('\n');
    for (const line of lines) {
      const match = line.match(/(\d{5})/);
      if (match) return match[1];
    }
    return '';
  }

  private static extractCity(address: string): string {
    const lines = address.split('\n');
    for (const line of lines) {
      const match = line.match(/\d{5}\s+(.+)/);
      if (match) return match[1];
    }
    return '';
  }

  // Generiert Positionen für ZUGFeRD
  private static generateLineItems(items: EInvoicePosition[] = []): string {
    return items
      .map(
        (item, index) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${index + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${item.description || item.name || 'Leistung'}</ram:Name>
        ${item.articleNumber ? `<ram:SellerAssignedID>${item.articleNumber}</ram:SellerAssignedID>` : ''}
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${(item.unitPrice || item.price || 0).toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${item.unit || 'HUR'}">${item.quantity || 1}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${EInvoiceService.requireTaxRate(item)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${(item.total || item.totalPrice || 0).toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`,
      )
      .join('');
  }

  // Generiert Positionen für XRechnung
  private static generateXRechnungLineItems(items: EInvoicePosition[] = [], currency: string): string {
    return items
      .map(
        (item, index) => `
  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="HUR">${item.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${(item.total ?? item.totalPrice ?? 0).toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${item.description}</cbc:Name>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${(item.unitPrice ?? item.price ?? 0).toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`,
      )
      .join('');
  }

  /**
   * Belegwaehrung aus den Rechnungsdaten holen (Wurzel 4). Fehlt sie, ist das
   * ein Datenfehler → fail-closed statt EUR erfinden. Das erzeugte ZUGFeRD/
   * XRechnung-XML ist rechtsverbindlich; eine falsche Waehrung waere fatal.
   * Akzeptiert die ueblichen Feldnamen aus dem Rechnungs-API (currency /
   * currencyCode) und normalisiert auf ISO-4217 (Grossbuchstaben).
   */
  private static requireCurrency(invoiceData: EInvoiceBeleg): string {
    // Eine Quelle (lib/steuer-waehrung) statt eigener Prüf-Kopie hier.
    return belegWaehrungErzwingen(
      'E-Rechnung',
      invoiceData?.currency,
      invoiceData?.currencyCode,
    );
  }

  /**
   * Steuersatz einer Position fuer das XML. Fail-closed ueber die EINE Quelle:
   * frueher stand hier `item.taxRate || item.vatRate || 19`, was (a) den
   * deutschen Regelsatz auf jeden Beleg ohne eigenen Satz erfand und (b) per
   * `||` die legitime 0 einer steuerbefreiten Position auf 19 % hochzog. Beides
   * sind falsche Angaben auf einem rechtsverbindlichen Dokument.
   */
  private static requireTaxRate(item: EInvoicePosition): number {
    return steuersatzErzwingen(
      `E-Rechnung, Position „${item?.description ?? item?.name ?? '?'}"`,
      item?.taxRate,
      item?.vatRate,
    );
  }

  /**
   * Laendercode (ISO-3166-1 alpha-2) fuer eine Adresse im XML. Frueher stand
   * hier fest `DE` fuer Verkaeufer UND Kaeufer — bei einem daenischen Betrieb
   * eine Falschangabe im rechtsverbindlichen Beleg, die niemand sieht.
   * Fail-closed: fehlt das Land, wird kein Land erfunden.
   */
  private static requireCountry(wert: unknown, rolle: string): string {
    const code = typeof wert === 'string' ? wert.trim().toUpperCase() : '';
    if (!/^[A-Z]{2}$/.test(code)) {
      throw new Error(
        `Länderkennung des ${rolle} fehlt oder ist ungültig — die E-Rechnung ` +
          'verlangt einen ISO-3166-1-alpha-2-Code (z. B. DE, DK). Land in den ' +
          'Stammdaten bzw. am Kunden hinterlegen.',
      );
    }
    return code;
  }

  /**
   * Erweiterte XML-Validierung mit fast-xml-parser
   */
  static async validateXMLStructure(xmlContent: string): Promise<{
    isValid: boolean;
    parsedData?: unknown;
    errors: string[];
  }> {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        allowBooleanAttributes: true,
      });

      const parsedData = parser.parse(xmlContent);

      // Grundlegende Struktur-Validierung
      if (!parsedData) {
        return {
          isValid: false,
          errors: ['XML konnte nicht geparst werden'],
        };
      }

      return {
        isValid: true,
        parsedData,
        errors: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`XML-Parsing Fehler: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Generiert ZUGFeRD XML mit TSE-Daten
   */
  static async generateZUGFeRDWithTSE(
    invoiceData: EInvoiceBeleg,
    metadata: ZUGFeRDMetadata,
    companyData: EInvoiceFirma,
    tseData?: TSEData,
  ): Promise<string> {
    try {
      const baseXML = await EInvoiceService.generateZUGFeRDXML(invoiceData, metadata, companyData);

      if (!tseData) {
        return baseXML;
      }

      // TSE-Daten in XML integrieren
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });

      const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        format: true,
      });

      const parsedXML = parser.parse(baseXML);

      // TSE-Daten-Block hinzufügen
      if (parsedXML['rsm:CrossIndustryInvoice']) {
        if (!parsedXML['rsm:CrossIndustryInvoice']['rsm:ExchangedDocument']['ram:IncludedNote']) {
          parsedXML['rsm:CrossIndustryInvoice']['rsm:ExchangedDocument']['ram:IncludedNote'] = [];
        }

        // TSE-Daten als Notiz hinzufügen
        parsedXML['rsm:CrossIndustryInvoice']['rsm:ExchangedDocument']['ram:IncludedNote'].push({
          'ram:Content': `TSE: ${tseData.serialNumber}`,
          'ram:SubjectCode': 'TSE',
        });

        // TSE-spezifische Felder in SupplyChainTradeTransaction
        if (parsedXML['rsm:CrossIndustryInvoice']['rsm:SupplyChainTradeTransaction']) {
          parsedXML['rsm:CrossIndustryInvoice']['rsm:SupplyChainTradeTransaction']['ram:TSEData'] =
            {
              'ram:SerialNumber': tseData.serialNumber,
              'ram:SignatureAlgorithm': tseData.signatureAlgorithm,
              'ram:TransactionNumber': tseData.transactionNumber,
              'ram:StartTime': tseData.startTime,
              'ram:FinishTime': tseData.finishTime,
              'ram:Signature': tseData.signature,
              'ram:PublicKey': tseData.publicKey,
              'ram:CertificateSerial': tseData.certificateSerial,
            };
        }
      }

      return builder.build(parsedXML);
    } catch (error) {
      console.error('Fehler beim Generieren der ZUGFeRD XML mit TSE:', error);
      throw new Error('ZUGFeRD XML mit TSE konnte nicht generiert werden', { cause: error });
    }
  }

  /**
   * Erstellt PDF/A-3 Datei mit eingebetteter XML (ZUGFeRD)
   */
  static async createPDFA3WithXML(
    pdfBuffer: ArrayBuffer,
    xmlContent: string,
    filename: string = 'zugferd-data.xml',
  ): Promise<ArrayBuffer> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);

      // XML als Anhang einbetten
      const xmlBytes = new TextEncoder().encode(xmlContent);

      await pdfDoc.attach(xmlBytes, filename, {
        mimeType: 'text/xml',
        description: 'ZUGFeRD Invoice Data',
        creationDate: new Date(),
        modificationDate: new Date(),
      });

      // PDF/A-3 Metadaten setzen
      const _metadata = `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;

      pdfDoc.setTitle('E-Rechnung (ZUGFeRD)');
      pdfDoc.setSubject('Elektronische Rechnung nach ZUGFeRD Standard');
      pdfDoc.setKeywords(['ZUGFeRD', 'E-Rechnung', 'PDF/A-3']);
      pdfDoc.setProducer('NextDays E-Invoice System');
      pdfDoc.setCreationDate(new Date());
      pdfDoc.setModificationDate(new Date());

      const pdfBytes = await pdfDoc.save();
      return new ArrayBuffer(pdfBytes.byteLength).slice(0).constructor === ArrayBuffer
        ? (pdfBytes.buffer as ArrayBuffer)
        : (pdfBytes.buffer.slice(
            pdfBytes.byteOffset,
            pdfBytes.byteOffset + pdfBytes.byteLength,
          ) as ArrayBuffer);
    } catch (error) {
      console.error('Fehler beim Erstellen der PDF/A-3 Datei:', error);
      throw new Error('PDF/A-3 Datei konnte nicht erstellt werden', { cause: error });
    }
  }

  /**
   * Konvertiert XML zwischen verschiedenen Formaten
   */
  static async convertXMLFormat(
    xmlContent: string,
    fromFormat: 'zugferd' | 'xrechnung',
    toFormat: 'zugferd' | 'xrechnung',
  ): Promise<string> {
    if (fromFormat === toFormat) {
      return xmlContent;
    }

    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });

      const parsedData = parser.parse(xmlContent);

      // Vereinfachte Konvertierungslogik (kann erweitert werden)
      if (fromFormat === 'zugferd' && toFormat === 'xrechnung') {
        // ZUGFeRD zu XRechnung konvertieren
        return EInvoiceService.convertZUGFeRDToXRechnung(parsedData);
      } else if (fromFormat === 'xrechnung' && toFormat === 'zugferd') {
        // XRechnung zu ZUGFeRD konvertieren
        return EInvoiceService.convertXRechnungToZUGFeRD(parsedData);
      }

      throw new Error(`Konvertierung von ${fromFormat} zu ${toFormat} nicht unterstützt`);
    } catch (error) {
      console.error('Fehler bei XML-Konvertierung:', error);
      throw new Error('XML-Konvertierung fehlgeschlagen', { cause: error });
    }
  }

  private static convertZUGFeRDToXRechnung(_zugferdData: unknown): string {
    // Implementierung der ZUGFeRD zu XRechnung Konvertierung
    // Dies ist eine vereinfachte Version - in der Praxis wäre eine vollständige Feldmapping notwendig
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!-- XRechnung konvertiert aus ZUGFeRD -->';
  }

  private static convertXRechnungToZUGFeRD(_xrechnungData: unknown): string {
    // Implementierung der XRechnung zu ZUGFeRD Konvertierung
    // Dies ist eine vereinfachte Version - in der Praxis wäre eine vollständige Feldmapping notwendig
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!-- ZUGFeRD konvertiert aus XRechnung -->';
  }
}
