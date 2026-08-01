import type { InvoiceData } from '@/types/invoiceTypes';

interface XRechnungLineItem {
  id: string;
  description: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  taxRate: number;
  taxCategory: string;
  totalAmount: number;
}

interface XRechnungData {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  currency: string;
  buyerReference?: string;

  // Seller
  sellerName: string;
  sellerAddress: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  sellerEmail?: string;
  sellerTaxId?: string;

  // Buyer
  buyerName: string;
  buyerAddress: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  buyerEmail?: string;

  // Payment
  paymentTerms?: string;
  iban?: string;
  bic?: string;
  accountHolder?: string;

  // Amounts
  lineItems: XRechnungLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRate: number;

  // 🎯 Auto-Detection: Einnahme oder Ausgabe?
  isOwnInvoice?: boolean; // true = Einnahme (eigene Rechnung), false = Ausgabe (Lieferantenrechnung)
}

export class XRechnungParserService {
  /**
   * Parse XRechnung/ZUGFeRD XML to InvoiceData
   * @param xmlString - E-Rechnung XML Content
   * @param companyName - Optional: Firmenname für Auto-Detection (Einnahme vs. Ausgabe)
   */
  static async parseXML(xmlString: string, companyName?: string): Promise<XRechnungData> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('XML Parsing Fehler: Ungültiges XML-Format');
    }

    // Namespace handling
    const getElementText = (parent: Element, tagName: string): string => {
      const elements = parent.getElementsByTagName(tagName);
      return elements.length > 0 ? elements[0].textContent?.trim() || '' : '';
    };

    const getElementByPath = (paths: string[]): string => {
      for (const path of paths) {
        const elements = xmlDoc.getElementsByTagName(path);
        if (elements.length > 0 && elements[0].textContent?.trim()) {
          return elements[0].textContent.trim();
        }
      }
      return '';
    };

    try {
      // Extract basic invoice data - MUST use ExchangedDocument section to avoid confusion with GuidelineSpecifiedDocumentContextParameter
      const exchangedDocument = xmlDoc.getElementsByTagName('rsm:ExchangedDocument')[0];

      if (!exchangedDocument) {
        throw new Error('Kein rsm:ExchangedDocument gefunden - ungültige E-Rechnung');
      }

      // Get invoice number - get ALL ram:ID elements and filter by length
      // Invoice numbers are SHORT (e.g. "RE-1079"), specification IDs are LONG (URNs)
      const allIds = Array.from(exchangedDocument.getElementsByTagName('ram:ID'));

      // Find the SHORTEST ram:ID - that's the invoice number
      const invoiceNumber =
        allIds
          .map(el => el.textContent?.trim() || '')
          .filter(text => text.length > 0 && text.length < 50) // Invoice numbers < 50 chars
          .sort((a, b) => a.length - b.length)[0] || '';

      if (!invoiceNumber) {
        throw new Error('Keine Rechnungsnummer (ram:ID) im ExchangedDocument gefunden');
      }

      // Get issue date from ExchangedDocument > ram:IssueDateTime > udt:DateTimeString
      const issueDateTimeElements = exchangedDocument.getElementsByTagName('ram:IssueDateTime');
      const issueDateRaw =
        issueDateTimeElements.length > 0
          ? getElementText(issueDateTimeElements[0], 'udt:DateTimeString')
          : '';
      const issueDate = XRechnungParserService.parseDate(issueDateRaw);

      const dueDateElements = xmlDoc.getElementsByTagName('ram:DueDateDateTime');
      let dueDate: string | undefined;
      if (dueDateElements.length > 0) {
        const dueDateStr = getElementText(dueDateElements[0], 'udt:DateTimeString');
        dueDate = XRechnungParserService.parseDate(dueDateStr);
      }

      const currency = getElementByPath(['ram:InvoiceCurrencyCode']);
      const buyerReference = getElementByPath(['ram:BuyerReference']);

      // Extract seller information
      const sellerParty = xmlDoc.getElementsByTagName('ram:SellerTradeParty')[0];
      const sellerName = getElementText(sellerParty, 'ram:Name');
      const sellerAddress = sellerParty.getElementsByTagName('ram:PostalTradeAddress')[0];

      const sellerAddressData = {
        street: getElementText(sellerAddress, 'ram:LineOne'),
        postalCode: getElementText(sellerAddress, 'ram:PostcodeCode'),
        city: getElementText(sellerAddress, 'ram:CityName'),
        country: getElementText(sellerAddress, 'ram:CountryID'),
      };

      const sellerEmailElements = sellerParty.getElementsByTagName('ram:URIID');
      let sellerEmail: string | undefined;
      for (let i = 0; i < sellerEmailElements.length; i++) {
        const schemeID = sellerEmailElements[i].getAttribute('schemeID');
        if (schemeID === 'EM') {
          sellerEmail = sellerEmailElements[i].textContent?.trim();
          break;
        }
      }

      const sellerTaxElements = sellerParty.getElementsByTagName('ram:SpecifiedTaxRegistration');
      let sellerTaxId: string | undefined;
      for (let i = 0; i < sellerTaxElements.length; i++) {
        const idElement = sellerTaxElements[i].getElementsByTagName('ram:ID')[0];
        const schemeID = idElement?.getAttribute('schemeID');
        if (schemeID === 'VA' || schemeID === 'FC') {
          sellerTaxId = idElement.textContent?.trim();
          break;
        }
      }

      // Extract buyer information
      const buyerParty = xmlDoc.getElementsByTagName('ram:BuyerTradeParty')[0];
      const buyerName = getElementText(buyerParty, 'ram:Name');
      const buyerAddress = buyerParty.getElementsByTagName('ram:PostalTradeAddress')[0];

      const buyerAddressData = {
        street: getElementText(buyerAddress, 'ram:LineOne'),
        postalCode: getElementText(buyerAddress, 'ram:PostcodeCode'),
        city: getElementText(buyerAddress, 'ram:CityName'),
        country: getElementText(buyerAddress, 'ram:CountryID'),
      };

      const buyerEmailElements = buyerParty.getElementsByTagName('ram:URIID');
      let buyerEmail: string | undefined;
      for (let i = 0; i < buyerEmailElements.length; i++) {
        const schemeID = buyerEmailElements[i].getAttribute('schemeID');
        if (schemeID === 'EM') {
          buyerEmail = buyerEmailElements[i].textContent?.trim();
          break;
        }
      }

      // Extract payment information
      const paymentTermsElements = xmlDoc.getElementsByTagName('ram:SpecifiedTradePaymentTerms');
      let paymentTerms: string | undefined;
      if (paymentTermsElements.length > 0) {
        paymentTerms = getElementText(paymentTermsElements[0], 'ram:Description');
      }

      const paymentMeans = xmlDoc.getElementsByTagName(
        'ram:SpecifiedTradeSettlementPaymentMeans',
      )[0];
      let iban: string | undefined;
      let bic: string | undefined;
      let accountHolder: string | undefined;

      if (paymentMeans) {
        iban = getElementText(paymentMeans, 'ram:IBANID');
        bic = getElementText(paymentMeans, 'ram:BICID');
        accountHolder = getElementText(paymentMeans, 'ram:AccountName');
      }

      // Extract line items
      const lineItems: XRechnungLineItem[] = [];
      const lineItemElements = xmlDoc.getElementsByTagName('ram:IncludedSupplyChainTradeLineItem');

      for (let i = 0; i < lineItemElements.length; i++) {
        const lineItem = lineItemElements[i];

        const lineId = getElementText(lineItem, 'ram:LineID');
        const description = getElementText(lineItem, 'ram:Name');
        const quantityElement = lineItem.getElementsByTagName('ram:BilledQuantity')[0];
        const quantity = parseFloat(quantityElement?.textContent?.trim() || '1');
        const unitCode = quantityElement?.getAttribute('unitCode') || 'C62';

        const unitPrice = parseFloat(getElementText(lineItem, 'ram:ChargeAmount') || '0');
        const totalAmount = parseFloat(getElementText(lineItem, 'ram:LineTotalAmount') || '0');

        const tradeTax = lineItem.getElementsByTagName('ram:ApplicableTradeTax')[0];
        const taxRate = parseFloat(getElementText(tradeTax, 'ram:RateApplicablePercent') || '0');
        const taxCategory = getElementText(tradeTax, 'ram:CategoryCode');

        lineItems.push({
          id: lineId,
          description,
          quantity,
          unitCode,
          unitPrice,
          taxRate,
          taxCategory,
          totalAmount,
        });
      }

      // Extract monetary summation
      const monetarySummation = xmlDoc.getElementsByTagName(
        'ram:SpecifiedTradeSettlementHeaderMonetarySummation',
      )[0];
      const subtotal = parseFloat(getElementText(monetarySummation, 'ram:LineTotalAmount') || '0');
      const taxAmount = parseFloat(getElementText(monetarySummation, 'ram:TaxTotalAmount') || '0');
      const total = parseFloat(getElementText(monetarySummation, 'ram:GrandTotalAmount') || '0');

      // Get overall tax rate from header
      const headerTax = xmlDoc.getElementsByTagName('ram:ApplicableTradeTax')[0];
      const taxRate = parseFloat(getElementText(headerTax, 'ram:RateApplicablePercent') || '19');

      // 🎯 Auto-Detection: Ist dies eine eigene Rechnung (Einnahme) oder Lieferantenrechnung (Ausgabe)?
      const isOwnInvoice = companyName
        ? XRechnungParserService.compareCompanyNames(sellerName, companyName)
        : undefined;

      return {
        invoiceNumber,
        issueDate,
        dueDate,
        currency,
        buyerReference,
        sellerName,
        sellerAddress: sellerAddressData,
        sellerEmail,
        sellerTaxId,
        buyerName,
        buyerAddress: buyerAddressData,
        buyerEmail,
        paymentTerms,
        iban,
        bic,
        accountHolder,
        lineItems,
        subtotal,
        taxAmount,
        total,
        taxRate,
        isOwnInvoice, // 🎯 Einnahme/Ausgabe Detection
      };
    } catch (error) {
      console.error('XRechnung Parsing Error:', error);
      throw new Error('Fehler beim Parsen der E-Rechnung. Bitte überprüfen Sie das XML-Format.', { cause: error });
    }
  }

  /**
   * Parse date from format YYYYMMDD to YYYY-MM-DD
   */
  private static parseDate(dateString: string): string {
    if (!dateString || dateString.length !== 8) {
      return new Date().toISOString().split('T')[0];
    }

    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);

    return `${year}-${month}-${day}`;
  }

  /**
   * Convert XRechnungData to InvoiceData for import
   */
  static convertToInvoiceData(xrechnung: XRechnungData, companyId: string): Partial<InvoiceData> {
    const items = xrechnung.lineItems.map((item, index) => ({
      id: `item-${index + 1}`,
      description: item.description,
      quantity: item.quantity,
      unit: XRechnungParserService.mapUnitCode(item.unitCode),
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      total: item.totalAmount,
    }));

    return {
      companyId,
      invoiceNumber: xrechnung.invoiceNumber,
      issueDate: xrechnung.issueDate,
      dueDate: xrechnung.dueDate || XRechnungParserService.calculateDueDate(xrechnung.issueDate),
      status: 'draft',
      items,
      amount: xrechnung.subtotal, // Nettobetrag
      vatRate: xrechnung.taxRate,
      tax: xrechnung.taxAmount,
      total: xrechnung.total,
      paymentTerms: xrechnung.paymentTerms || 'Zahlbar binnen 14 Tagen',
      notes: `Importiert aus E-Rechnung am ${new Date().toISOString().split('T')[0]}`,

      // Customer data from E-Invoice
      customerName: xrechnung.buyerName || '',
      customerEmail: xrechnung.buyerEmail || '',
      customerAddress: `${xrechnung.buyerAddress.street}\n${xrechnung.buyerAddress.postalCode} ${xrechnung.buyerAddress.city}`,

      // Structured customer data for templates
      customer: {
        name: xrechnung.buyerName || '',
        email: xrechnung.buyerEmail || '',
        address: {
          street: xrechnung.buyerAddress.street,
          zipCode: xrechnung.buyerAddress.postalCode,
          city: xrechnung.buyerAddress.city,
          country: xrechnung.buyerAddress.country || 'Deutschland',
        },
      },
    };
  }

  /**
   * Map UN/CEFACT unit codes to readable German units
   */
  private static mapUnitCode(code: string): string {
    const unitMap: Record<string, string> = {
      C62: 'Stück',
      HUR: 'Stunde',
      DAY: 'Tag',
      MTR: 'Meter',
      KGM: 'Kilogramm',
      LTR: 'Liter',
      MTK: 'm²',
      MTQ: 'm³',
      TNE: 'Tonne',
      SET: 'Set',
      PCE: 'Stück',
    };

    return unitMap[code] || code;
  }

  /**
   * Calculate due date (14 days from invoice date)
   */
  private static calculateDueDate(invoiceDate: string): string {
    const date = new Date(invoiceDate);
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  }

  /**
   * Vergleicht zwei Firmennamen (fuzzy match für Auto-Detection)
   * @returns true wenn die Namen übereinstimmen
   */
  private static compareCompanyNames(name1: string, name2: string): boolean {
    // Normalisiere Namen: Kleinbuchstaben, nur alphanumerisch
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/gmbh|ag|e\.k\.|ug|kg|ohg|gbr|ltd|llc|inc/gi, '') // Rechtsformen entfernen
        .replace(/[^a-z0-9]/g, ''); // Nur Buchstaben und Zahlen

    const normalized1 = normalize(name1);
    const normalized2 = normalize(name2);

    // Exakte Übereinstimmung nach Normalisierung
    if (normalized1 === normalized2) return true;

    // Fuzzy Match: Name1 enthält Name2 oder umgekehrt
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }

    return false;
  }

  /**
   * 📉 Convert XRechnung to Expense Data (für Lieferantenrechnungen)
   * Wandelt E-Rechnung in Ausgabe um (wenn Unternehmen der Käufer ist)
   */
  static convertToExpenseData(xrechnung: XRechnungData, companyId: string): any {
    return {
      companyId,
      title: `Rechnung ${xrechnung.invoiceNumber}`,
      amount: xrechnung.total,
      category: 'Sonstiges', // Default, User kann ändern
      date: xrechnung.issueDate,
      dueDate: xrechnung.dueDate || XRechnungParserService.calculateDueDate(xrechnung.issueDate),
      paymentTerms: xrechnung.paymentTerms || 'Zahlbar sofort',
      description: `E-Rechnung Import von ${xrechnung.sellerName}`,

      // Rechnungsinformationen
      vendor: xrechnung.sellerName,
      invoiceNumber: xrechnung.invoiceNumber,

      // Steuerliche Daten
      vatAmount: xrechnung.taxAmount,
      netAmount: xrechnung.subtotal,
      vatRate: xrechnung.taxRate,
      taxDeductible: true, // Geschäftsausgaben sind meist abzugsfähig

      // Lieferanten-Daten (vom Seller der E-Rechnung)
      companyName: xrechnung.sellerName,
      companyAddress: `${xrechnung.sellerAddress.street}\n${xrechnung.sellerAddress.postalCode} ${xrechnung.sellerAddress.city}`,
      companyVatNumber: xrechnung.sellerTaxId || '',
      contactEmail: xrechnung.sellerEmail || '',
      contactPhone: '', // Nicht in E-Rechnung Standard

      // Hinweis auf Import
      notes: `Importiert aus E-Rechnung am ${new Date().toISOString().split('T')[0]}`,
    };
  }
}
