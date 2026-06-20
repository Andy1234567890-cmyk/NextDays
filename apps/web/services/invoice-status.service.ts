'use client';

import { api } from '@/lib/api-client';

export interface InvoiceStatusUpdate {
  status: 'open' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: Date | null;
  paidAmount?: number;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
}

export class InvoiceStatusService {
  /**
   * Aktualisiert den Status einer Rechnung
   */
  static async updateStatus(
    companyId: string,
    invoiceId: string,
    statusUpdate: InvoiceStatusUpdate,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!companyId || !invoiceId) {
        throw new Error('Company ID und Invoice ID sind erforderlich');
      }

      await api.patch(`/api/v1/invoices/${companyId}/${invoiceId}/status`, statusUpdate);

      return { success: true };
    } catch (error) {
      console.error(`❌ Fehler beim Aktualisieren von Rechnung ${invoiceId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      };
    }
  }

  /**
   * Markiert eine Rechnung als bezahlt
   */
  static async markAsPaid(
    companyId: string,
    invoiceId: string,
    paidAmount: number,
    transactionId?: string,
    paymentMethod: string = 'Banküberweisung',
  ): Promise<{ success: boolean; error?: string }> {
    return InvoiceStatusService.updateStatus(companyId, invoiceId, {
      status: 'paid',
      paidAmount,
      paymentMethod,
      transactionId,
      paidAt: new Date(),
    });
  }

  /**
   * Markiert eine Rechnung als offen
   */
  static async markAsOpen(
    companyId: string,
    invoiceId: string,
  ): Promise<{ success: boolean; error?: string }> {
    return InvoiceStatusService.updateStatus(companyId, invoiceId, { status: 'open' });
  }

  /**
   * Markiert eine Rechnung als überfällig
   */
  static async markAsOverdue(
    companyId: string,
    invoiceId: string,
  ): Promise<{ success: boolean; error?: string }> {
    return InvoiceStatusService.updateStatus(companyId, invoiceId, { status: 'overdue' });
  }
}
