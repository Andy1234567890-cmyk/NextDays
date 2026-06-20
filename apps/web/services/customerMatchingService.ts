'use client';

import { api } from '@/lib/api-client';

interface CustomerMatchCandidate {
  id: string;
  name: string;
  email?: string;
  customerNumber?: string;
  matchScore: number;
  matchReason: string;
}

export class CustomerMatchingService {
  /**
   * Sucht nach einem passenden Kunden in der Datenbank
   * Matching-Strategie: CustomerNumber > Email (exakt) > Name (exakt) > Name (ähnlich)
   */
  static async findMatchingCustomer(
    companyId: string,
    customerName: string,
    customerEmail?: string,
    customerNumber?: string,
  ): Promise<CustomerMatchCandidate | null> {
    try {
      const params = new URLSearchParams({ name: customerName });
      if (customerEmail) params.set('email', customerEmail);
      if (customerNumber) params.set('customerNumber', customerNumber);

      return await api.get<CustomerMatchCandidate | null>(
        `/api/v1/customers/${companyId}/match?${params}`,
      );
    } catch (error) {
      console.error('❌ Fehler beim Customer Matching:', error);
      return null;
    }
  }
}
