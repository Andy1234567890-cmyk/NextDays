import { api } from '@/lib/api-client';
import type { InvoiceData } from '@/types/invoiceTypes';

export class InvoiceService {
  static async getInvoicesByCompany(companyId: string): Promise<InvoiceData[]> {
    return api.get<InvoiceData[]>(`/api/v1/invoices?company_id=${companyId}`);
  }

  static async saveInvoice(data: Record<string, unknown>): Promise<string> {
    const result = await api.post<{ id: string }>('/api/v1/invoices', data);
    return result.id;
  }

  static async getInvoiceById(_companyId: string, invoiceId: string): Promise<InvoiceData | null> {
    try {
      return await api.get<InvoiceData>(`/api/v1/invoices/${invoiceId}`);
    } catch {
      return null;
    }
  }

  static async getNextInvoiceNumber(
    companyId: string,
    belegart: 'invoice' | 'quote' = 'invoice',
  ): Promise<{ formattedNumber: string; sequentialNumber: number }> {
    const result = await api.get<{ formattedNumber: string; sequentialNumber: number }>(
      `/api/v1/${belegart === 'quote' ? 'quotes' : 'invoices'}/next-number/${companyId}`,
    );
    return result;
  }

  static async createAndSaveStornoInvoice(
    invoice: InvoiceData,
    companyId: string,
    reason: string,
  ): Promise<InvoiceData> {
    const result = await api.post<InvoiceData>(`/api/v1/invoices/${invoice.id}/storno`, {
      companyId,
      reason,
    });
    return result;
  }

  static async updateInvoice(invoiceId: string, data: Record<string, unknown>): Promise<void> {
    await api.patch<void>(`/api/v1/invoices/${invoiceId}`, data);
  }
}

export const firestoreInvoiceService = new InvoiceService();

export default firestoreInvoiceService;
