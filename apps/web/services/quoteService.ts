'use client';

import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import type { TaxRuleType } from '@/types/taxRules';
import { InventoryService } from './inventoryService';
import { NumberSequenceService } from './numberSequenceService';

/**
 * QuoteService - Angebotsverwaltung
 * Migriert zu: Frontend → FastAPI → Supabase
 */

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate?: number;
  unit?: string;
  category?: string;
  inventoryItemId?: string; // Verknüpfung zu Inventar-Artikel
  discountPercent?: number; // Optionaler prozentualer Rabatt je Position
  extendedDescription?: string; // Erweiterte Beschreibung unter der Position
}

export interface Quote {
  id: string;
  companyId: string;
  number: string;

  // Kunde
  customerId?: string;
  customerName: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerNumber?: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?:
    | string
    | {
        street: string;
        city: string;
        postalCode: string;
        country: string;
      };

  // Datum & Gültigkeit
  date: Date;
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;

  // Status
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

  // Inhalt
  title?: string;
  description?: string;
  headTextHtml?: string;
  notes?: string;
  footerText?: string;
  customerOrderNumber?: string; // Referenz / Bestellnummer des Kunden
  servicePeriod?: string;
  // Zusätzliche optionale Felder (Mehr Optionen)
  taxRule?: TaxRuleType;
  internalContactPerson?: string;
  deliveryTerms?: string;
  paymentTerms?: string;

  // Skonto-Einstellungen
  skontoEnabled?: boolean;
  skontoDays?: number;
  skontoPercentage?: number;
  skontoText?: string;

  // Positionen
  items: QuoteItem[];

  // Beträge
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;

  // Versand
  deliveryDate?: Date;
  deliveryMethod?: string;
  deliveryAddress?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };

  // Metadaten
  createdBy: string;
  lastModifiedBy?: string;
  template?: string;
  language?: string;

  // Konvertierung
  convertedToInvoice?: boolean;
  invoiceId?: string;
  convertedAt?: Date;

  // Workflow
  sentAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  cancelledAt?: Date;

  // PDF
  pdfUrl?: string;

  // Tags
  tags?: string[];
}

export interface QuoteSettings {
  companyId: string;
  numberPrefix: string;
  numberFormat: string; // z.B. "A-{YYYY}-{NNN}"
  currentNumber: number;
  defaultValidityDays: number;
  defaultTaxRate: number;
  defaultCurrency: string;
  emailTemplate: string;
  emailSubject: string;
  terms?: string;
  footer?: string;
  autoSend: boolean;
  autoConvertToInvoice: boolean;
  reminderDays: number[];
}

export class QuoteService {
  /**
   * Alle Angebote für eine Company abrufen
   */
  static async getQuotes(companyId: string, status?: string): Promise<Quote[]> {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);

      const quotes = await api.get<Quote[]>(
        `/api/v1/quotes/company/${companyId}?${params.toString()}`,
      );

      return quotes.map(q => QuoteService.parseQuoteResponse(q));
    } catch (error) {
      console.error('[QuoteService] Error getting quotes:', error);
      throw error;
    }
  }

  /**
   * Angebot nach ID abrufen
   */
  static async getQuote(quoteId: string): Promise<Quote | null> {
    try {
      const quote = await api.get<Quote>(`/api/v1/quotes/${quoteId}`);
      return QuoteService.parseQuoteResponse(quote);
    } catch (error) {
      console.error('[QuoteService] Error getting quote:', error);
      return null;
    }
  }

  /**
   * Neues Angebot erstellen
   */
  static async createQuote(
    companyId: string,
    quoteData: Omit<Quote, 'id' | 'number' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    try {
      // Angebotsnummer generieren
      const number = await QuoteService.generateQuoteNumber(companyId);

      const params = new URLSearchParams({ company_id: companyId });

      // Items konvertieren
      const items = quoteData.items.map((item, index) => ({
        position: index + 1,
        description: item.description,
        quantity: String(item.quantity),
        unit: item.unit || 'Stk',
        unit_price_cents: Math.round(item.unitPrice * 100),
        tax_rate: String(item.taxRate || 19),
      }));

      const response = await api.post<{ id: string }>(`/api/v1/quotes?${params.toString()}`, {
        customer_id: quoteData.customerId,
        quote_date: quoteData.date.toISOString().split('T')[0],
        valid_until: quoteData.validUntil.toISOString().split('T')[0],
        tax_rate: String(quoteData.items[0]?.taxRate || 19),
        notes: quoteData.notes || '',
        internal_notes: quoteData.footerText || '',
        items,
      });

      // Automatisch Aktivität in Kundenhistorie erstellen
      try {
        await QuoteService.createCustomerActivity(
          companyId,
          quoteData.customerId || quoteData.customerName,
          'document',
          `Angebot erstellt: ${number}`,
          `Ein neues Angebot über ${formatCurrency(quoteData.total, quoteData.currency)} wurde erstellt.`,
          {
            quoteId: response.id,
            quoteNumber: number,
            amount: quoteData.total,
            currency: quoteData.currency,
          },
        );
      } catch (activityError) {
        console.warn('Could not create customer activity:', activityError);
      }

      return response.id;
    } catch (error) {
      console.error('[QuoteService] Error creating quote:', error);
      throw error;
    }
  }

  /**
   * Angebot aktualisieren
   */
  static async updateQuote(quoteId: string, updates: Partial<Quote>): Promise<void> {
    try {
      await api.patch(`/api/v1/quotes/${quoteId}`, {
        status: updates.status,
        quote_date: updates.date?.toISOString().split('T')[0],
        valid_until: updates.validUntil?.toISOString().split('T')[0],
        notes: updates.notes,
        internal_notes: updates.footerText,
        pdf_url: updates.pdfUrl,
      });
    } catch (error) {
      console.error('[QuoteService] Error updating quote:', error);
      throw error;
    }
  }

  /**
   * Angebot löschen
   */
  static async deleteQuote(companyId: string, quoteId: string): Promise<void> {
    try {
      // Vor dem Löschen: Angebotsdaten für Aktivität speichern
      const quote = await QuoteService.getQuote(quoteId);

      // Evtl. bestehende Reservierungen freigeben
      if (quote && (quote.status === 'draft' || quote.status === 'sent')) {
        const inventoryItems = (quote.items || [])
          .filter(it => it.inventoryItemId && it.quantity > 0 && it.category !== 'discount')
          .map(it => ({ itemId: it.inventoryItemId as string, quantity: it.quantity }));
        if (inventoryItems.length > 0) {
          await InventoryService.releaseReservationForQuote(companyId, quoteId, inventoryItems);
        }
      }

      // Angebot löschen
      await api.delete(`/api/v1/quotes/${quoteId}`);

      // Automatisch Aktivität in Kundenhistorie erstellen
      if (quote && (quote.customerId || quote.customerName)) {
        try {
          await QuoteService.createCustomerActivity(
            companyId,
            (quote.customerId || quote.customerName) as string,
            'system',
            `Angebot gelöscht: ${quote.number}`,
            `Das Angebot wurde aus dem System gelöscht.`,
            {
              quoteNumber: quote.number,
              amount: quote.total,
              currency: quote.currency,
              actionType: 'deleted',
            },
          );
        } catch (activityError) {
          console.warn('Could not create customer activity for quote deletion:', activityError);
        }
      }
    } catch (error) {
      console.error('[QuoteService] Error deleting quote:', error);
      throw error;
    }
  }

  /**
   * Angebot versenden
   */
  static async sendQuote(quoteId: string): Promise<void> {
    try {
      await api.patch(`/api/v1/quotes/${quoteId}`, {
        status: 'sent',
      });
    } catch (error) {
      console.error('[QuoteService] Error sending quote:', error);
      throw error;
    }
  }

  /**
   * Angebot annehmen
   */
  static async acceptQuote(companyId: string, quoteId: string): Promise<void> {
    try {
      const quote = await QuoteService.getQuote(quoteId);

      await api.patch(`/api/v1/quotes/${quoteId}`, {
        status: 'accepted',
      });

      // Reservierte Artikel als verkauft markieren
      const inventoryItems = (quote?.items || [])
        .filter(it => it.inventoryItemId && it.quantity > 0 && it.category !== 'discount')
        .map(it => ({ itemId: it.inventoryItemId as string, quantity: it.quantity }));
      if (inventoryItems.length > 0) {
        await InventoryService.sellReservedItems(companyId, quoteId, inventoryItems);
      }

      // Automatisch Aktivität in Kundenhistorie erstellen
      if (quote?.customerId || quote?.customerName) {
        try {
          await QuoteService.createCustomerActivity(
            companyId,
            (quote.customerId || quote.customerName) as string,
            'system',
            `Angebot angenommen: ${quote.number}`,
            `Das Angebot wurde vom Kunden angenommen und der Auftrag ist bestätigt.`,
            {
              quoteId: quoteId,
              quoteNumber: quote.number,
              amount: quote.total,
              currency: quote.currency,
              actionType: 'accepted',
            },
          );
        } catch (activityError) {
          console.warn('Could not create customer activity for quote acceptance:', activityError);
        }
      }
    } catch (error) {
      console.error('[QuoteService] Error accepting quote:', error);
      throw error;
    }
  }

  /**
   * Angebot ablehnen
   */
  static async rejectQuote(companyId: string, quoteId: string, reason?: string): Promise<void> {
    try {
      const quote = await QuoteService.getQuote(quoteId);

      await api.patch(`/api/v1/quotes/${quoteId}`, {
        status: 'rejected',
      });

      // Reservierungen freigeben
      const inventoryItems = (quote?.items || [])
        .filter(it => it.inventoryItemId && it.quantity > 0 && it.category !== 'discount')
        .map(it => ({ itemId: it.inventoryItemId as string, quantity: it.quantity }));
      if (inventoryItems.length > 0) {
        await InventoryService.releaseReservationForQuote(companyId, quoteId, inventoryItems);
      }

      // Automatisch Aktivität in Kundenhistorie erstellen
      if (quote?.customerId || quote?.customerName) {
        try {
          const description = reason
            ? `Das Angebot wurde abgelehnt. Grund: ${reason}`
            : 'Das Angebot wurde vom Kunden abgelehnt.';

          await QuoteService.createCustomerActivity(
            companyId,
            (quote.customerId || quote.customerName) as string,
            'system',
            `Angebot abgelehnt: ${quote.number}`,
            description,
            {
              quoteId: quoteId,
              quoteNumber: quote.number,
              amount: quote.total,
              currency: quote.currency,
              actionType: 'rejected',
              rejectionReason: reason,
            },
          );
        } catch (activityError) {
          console.warn('Could not create customer activity for quote rejection:', activityError);
        }
      }
    } catch (error) {
      console.error('[QuoteService] Error rejecting quote:', error);
      throw error;
    }
  }

  /**
   * Angebot stornieren
   */
  static async cancelQuote(companyId: string, quoteId: string): Promise<void> {
    try {
      const quote = await QuoteService.getQuote(quoteId);

      await api.patch(`/api/v1/quotes/${quoteId}`, {
        status: 'cancelled',
      });

      // Reservierungen freigeben (falls vorhanden)
      const inventoryItems = (quote?.items || [])
        .filter(it => it.inventoryItemId && it.quantity > 0 && it.category !== 'discount')
        .map(it => ({ itemId: it.inventoryItemId as string, quantity: it.quantity }));
      if (inventoryItems.length > 0) {
        await InventoryService.releaseReservationForQuote(companyId, quoteId, inventoryItems);
      }
    } catch (error) {
      console.error('[QuoteService] Error cancelling quote:', error);
      throw error;
    }
  }

  /**
   * Angebot in Rechnung umwandeln
   */
  static async convertToInvoice(companyId: string, quoteId: string): Promise<string> {
    try {
      const quote = await QuoteService.getQuote(quoteId);
      if (!quote) {
        throw new Error('Angebot nicht gefunden');
      }

      if (quote.status !== 'accepted') {
        throw new Error('Nur angenommene Angebote können in Rechnungen umgewandelt werden');
      }

      const result = await api.post<{ invoice_id: string }>(
        `/api/v1/quotes/${quoteId}/convert-to-invoice`,
        { company_id: companyId },
      );
      return result.invoice_id;
    } catch (error) {
      console.error('[QuoteService] Error converting to invoice:', error);
      throw error;
    }
  }

  /**
   * Angebotsnummer generieren (Client-Side)
   */
  static async generateQuoteNumber(companyId: string): Promise<string> {
    try {
      const result = await NumberSequenceService.getNextNumberForType(companyId, 'Angebot');
      return result.formattedNumber;
    } catch (error) {
      console.error('Fehler beim Generieren der Angebotsnummer:', error);
      // Fallback
      return `AG-${Date.now().toString().slice(-4)}`;
    }
  }

  /**
   * Angebots-Einstellungen laden
   */
  static async getQuoteSettings(companyId: string): Promise<QuoteSettings> {
    const defaultSettings: QuoteSettings = {
      companyId,
      numberPrefix: 'A',
      numberFormat: '{PREFIX}-{YYYY}-{NNN}',
      currentNumber: 0,
      defaultValidityDays: 30,
      defaultTaxRate: 19,
      defaultCurrency: 'EUR',
      emailTemplate: 'Anbei erhalten Sie unser Angebot {NUMBER}.',
      emailSubject: 'Angebot {NUMBER}',
      autoSend: false,
      autoConvertToInvoice: false,
      reminderDays: [7, 3, 1],
    };

    return defaultSettings;
  }

  /**
   * Angebots-Einstellungen aktualisieren
   */
  static async updateQuoteSettings(
    companyId: string,
    settings: Partial<QuoteSettings>,
  ): Promise<void> {
    await api.patch(`/api/v1/companies/${companyId}/quote-settings`, settings).catch(() => null);
  }

  /**
   * Statistiken abrufen (Client-Side Berechnung)
   */
  static async getQuoteStatistics(companyId: string): Promise<{
    total: number;
    draft: number;
    sent: number;
    accepted: number;
    rejected: number;
    expired: number;
    totalValue: number;
    acceptedValue: number;
  }> {
    try {
      const quotes = await QuoteService.getQuotes(companyId);

      const stats = {
        total: quotes.length,
        draft: quotes.filter(q => q.status === 'draft').length,
        sent: quotes.filter(q => q.status === 'sent').length,
        accepted: quotes.filter(q => q.status === 'accepted').length,
        rejected: quotes.filter(q => q.status === 'rejected').length,
        expired: quotes.filter(q => q.status === 'expired').length,
        totalValue: quotes.reduce((sum, q) => sum + q.total, 0),
        acceptedValue: quotes
          .filter(q => q.status === 'accepted')
          .reduce((sum, q) => sum + q.total, 0),
      };

      return stats;
    } catch (error) {
      console.error('[QuoteService] Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Live-Updates via Polling (30s Intervall)
   */
  static subscribeToQuotes(companyId: string, callback: (quotes: Quote[]) => void): () => void {
    // Polling-Fallback bis Supabase Realtime integriert ist
    const interval = setInterval(async () => {
      try {
        const quotes = await QuoteService.getQuotes(companyId);
        callback(quotes);
      } catch (error) {
        console.error('Error in quote subscription:', error);
      }
    }, 5000); // Poll alle 5 Sekunden

    // Cleanup function
    return () => clearInterval(interval);
  }

  /**
   * Aktivität in Kundenhistorie speichern
   */
  static async createCustomerActivity(
    companyId: string,
    customerIdOrName: string,
    type: 'call' | 'email' | 'meeting' | 'document' | 'system' | 'invoice' | 'note',
    title: string,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await api
      .post(`/api/v1/companies/${companyId}/customer-activities`, {
        customer_id_or_name: customerIdOrName,
        type,
        title,
        description,
        metadata,
      })
      .catch(() => null);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private static parseQuoteResponse(data: any): Quote {
    const toDate = (val: any): Date => {
      if (!val) return new Date();
      if (val instanceof Date) return val;
      return new Date(val);
    };

    // Items konvertieren
    const items: QuoteItem[] = (data.items || []).map((item: any) => ({
      id: item.id || `item_${Math.random()}`,
      description: item.description || '',
      quantity: parseFloat(item.quantity) || 0,
      unitPrice: (item.unit_price_cents || 0) / 100,
      total: (item.total_cents || 0) / 100,
      taxRate: parseFloat(item.tax_rate) || 0,
      unit: item.unit || 'Stk',
      category: item.category,
      inventoryItemId: item.inventory_item_id,
      discountPercent: item.discount_percent,
    }));

    return {
      id: data.id,
      companyId: data.company_id || data.companyId,
      number: data.quote_number || data.number || '',
      customerId: data.customer_id || data.customerId,
      customerName: data.customer_name || data.customerName || '',
      customerEmail: data.customer_email || data.customerEmail || '',
      customerPhone: data.customer_phone || data.customerPhone,
      customerAddress: data.customer_address || data.customerAddress,
      date: toDate(data.quote_date || data.date),
      validUntil: toDate(data.valid_until || data.validUntil),
      createdAt: toDate(data.created_at || data.createdAt),
      updatedAt: toDate(data.updated_at || data.updatedAt),
      status: data.status || 'draft',
      notes: data.notes || '',
      footerText: data.internal_notes || data.footerText,
      items,
      subtotal: (data.subtotal_cents || 0) / 100,
      taxAmount: (data.tax_cents || 0) / 100,
      total: (data.total_cents || 0) / 100,
      // Wurzel 4: echte gespeicherte Angebotswaehrung durchreichen (die API
      // liefert sie als Pflichtfeld), nicht bedingungslos EUR erfinden. Fehlt
      // sie ausnahmsweise, leer lassen — Formatter rendern symbollos statt EUR.
      currency: data.currency || '',
      pdfUrl: data.pdf_url || data.pdfUrl,
      sentAt: data.sent_at ? toDate(data.sent_at) : undefined,
      acceptedAt: data.accepted_at ? toDate(data.accepted_at) : undefined,
      rejectedAt: data.rejected_at ? toDate(data.rejected_at) : undefined,
      createdBy: data.created_by || data.createdBy || '',
    };
  }
}
