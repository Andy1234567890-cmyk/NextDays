'use client';

import { api } from '@/lib/api-client';

export interface ServiceUsageRecord {
  serviceId: string;
  serviceType: 'servicePackage' | 'inlineService';
  quantity: number;
  revenue: number;
  source: 'invoice' | 'platform_booking' | 'quote';
  metadata?: {
    invoiceId?: string;
    orderId?: string;
    quoteId?: string;
    customerName?: string;
    bookingDate?: string;
  };
}

/**
 * Service für die Verfolgung der Service-Nutzung über alle Plattformen hinweg
 * Trackt sowohl servicePackages als auch inlineInvoiceServices
 */
export class ServiceUsageTrackingService {
  /**
   * Automatische Reparatur fehlender inventoryItemId in Rechnungsitems
   */
  static async repairInvoiceInventoryIds(companyId: string, invoiceId: string): Promise<boolean> {
    try {
      const result = await api.post<{ repaired: boolean }>(
        `/api/v1/invoices/${companyId}/${invoiceId}/repair-inventory-ids`,
        {},
      );
      return result.repaired || false;
    } catch (error) {
      console.error('❌ Error repairing invoice inventory IDs:', error);
      return false;
    }
  }

  /**
   * Trackt Service-Nutzung bei Rechnungserstellung
   * Wird aufgerufen, wenn eine Rechnung erstellt/gespeichert wird
   */
  static async trackInvoiceServiceUsage(
    companyId: string,
    invoiceId: string,
    items: Array<{
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
      inventoryItemId?: string;
      category?: string;
    }>,
    customerName?: string,
  ): Promise<void> {
    try {
      await api.post(`/api/v1/companies/${companyId}/service-usage/track-invoice`, {
        invoiceId,
        items,
        customerName,
      });
    } catch (error) {
      console.error('❌ ServiceUsageTracking: Error tracking invoice service usage:', error);
      // Nicht werfen - Service-Tracking soll die Hauptfunktion nicht blockieren
    }
  }

  /**
   * Trackt Service-Nutzung bei Plattform-Buchungen
   * Wird aufgerufen, wenn ein Auftrag über die Plattform gebucht wird
   */
  static async trackPlatformBookingUsage(
    providerId: string,
    orderId: string,
    servicePackageData: {
      servicePackageId?: string;
      packageName: string;
      packagePrice: number;
      subcategory: string;
    },
    customerName?: string,
    bookingDate?: string,
  ): Promise<void> {
    try {
      await api.post(`/api/v1/companies/${providerId}/service-usage/track-platform-booking`, {
        orderId,
        servicePackageData,
        customerName,
        bookingDate,
      });
    } catch (error) {
      console.error('❌ ServiceUsageTracking: Error tracking platform booking usage:', error);
      // Nicht werfen - Service-Tracking soll die Hauptfunktion nicht blockieren
    }
  }

  /**
   * Holt Service-Nutzungsstatistiken für das Dashboard
   */
  static async getServiceUsageStats(companyId: string): Promise<{
    servicePackages: Array<{
      id: string;
      name: string;
      usageCount: number;
      totalRevenue: number;
      lastUsed?: Date;
    }>;
    inlineServices: Array<{
      id: string;
      name: string;
      usageCount: number;
      totalRevenue: number;
      lastUsed?: Date;
    }>;
  }> {
    try {
      return await api.get<{
        servicePackages: Array<{
          id: string;
          name: string;
          usageCount: number;
          totalRevenue: number;
          lastUsed?: Date;
        }>;
        inlineServices: Array<{
          id: string;
          name: string;
          usageCount: number;
          totalRevenue: number;
          lastUsed?: Date;
        }>;
      }>(`/api/v1/companies/${companyId}/service-usage/stats`);
    } catch (error) {
      console.error('Error getting service usage stats:', error);
      return { servicePackages: [], inlineServices: [] };
    }
  }
}
