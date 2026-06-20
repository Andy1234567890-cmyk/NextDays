'use client';

import type { Customer } from '@/components/finance/AddCustomerModal';
import { api } from '@/lib/api-client';

export class CustomerService {
  /**
   * Alle Kunden für eine Company abrufen
   */
  static async getCustomers(companyId: string): Promise<Customer[]> {
    try {
      const customers = await api.get<Customer[]>(`/api/v1/customers/company/${companyId}`);
      return customers.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    } catch (error) {
      console.error('Fehler beim Laden der Kunden:', error);
      throw error;
    }
  }

  /**
   * Alle Lieferanten für eine Company abrufen
   */
  static async getSuppliers(companyId: string): Promise<Customer[]> {
    try {
      // Backend filtert nach isSupplier=true
      const suppliers = await api.get<Customer[]>(
        `/api/v1/customers/company/${companyId}?isSupplier=true`,
      );
      return suppliers.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    } catch (error) {
      console.error('Fehler beim Laden der Lieferanten:', error);
      throw error;
    }
  }

  /**
   * Lädt einen einzelnen Kunden
   */
  static async getCustomer(_companyId: string, customerId: string): Promise<Customer | null> {
    try {
      const customer = await api.get<Customer>(`/api/v1/customers/${customerId}`);
      return customer;
    } catch (error) {
      console.error('Fehler beim Laden des Kunden:', error);
      return null;
    }
  }

  /**
   * Erstellt einen neuen Kunden
   */
  static async addCustomer(
    companyId: string,
    customerData: Omit<
      Customer,
      'id' | 'totalInvoices' | 'totalAmount' | 'createdAt' | 'companyId'
    >,
  ): Promise<string> {
    try {
      const result = await api.post<{ id: string }>(
        `/api/v1/customers?company_id=${companyId}`,
        customerData,
      );
      return result.id;
    } catch (error) {
      console.error('Fehler beim Erstellen des Kunden:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Kunden
   */
  static async updateCustomer(
    _companyId: string,
    customerId: string,
    updates: Partial<Customer>,
  ): Promise<void> {
    try {
      await api.patch(`/api/v1/customers/${customerId}`, updates);
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Kunden:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Kunden
   */
  static async deleteCustomer(_companyId: string, customerId: string): Promise<void> {
    try {
      await api.delete(`/api/v1/customers/${customerId}`);
    } catch (error) {
      console.error('Fehler beim Löschen des Kunden:', error);
      throw error;
    }
  }

  /**
   * Sucht Kunden nach Name oder E-Mail
   */
  static async searchCustomers(companyId: string, searchTerm: string): Promise<Customer[]> {
    try {
      const customers = await CustomerService.getCustomers(companyId);

      if (!searchTerm.trim()) {
        return customers;
      }

      const term = searchTerm.toLowerCase();
      return customers.filter(
        customer =>
          customer.name.toLowerCase().includes(term) ||
          customer.email.toLowerCase().includes(term) ||
          customer.customerNumber.toLowerCase().includes(term),
      );
    } catch (error) {
      console.error('Fehler bei der Kundensuche:', error);
      throw error;
    }
  }

  /**
   * Generiert die nächste Kundennummer
   */
  static async getNextCustomerNumber(companyId: string): Promise<string> {
    try {
      const result = await api.get<{ customerNumber: string }>(
        `/api/v1/customers/next-number/${companyId}`,
      );
      return result.customerNumber;
    } catch (error) {
      console.error('Fehler beim Generieren der Kundennummer:', error);
      // Fallback
      return `KD-${Date.now().toString().slice(-4)}`;
    }
  }

  /**
   * Validiert Kundendaten
   */
  static validateCustomer(customer: Partial<Customer>): string[] {
    const errors: string[] = [];

    if (!customer.name?.trim()) {
      errors.push('Kundenname ist erforderlich');
    }

    if (!customer.email?.trim()) {
      errors.push('E-Mail-Adresse ist erforderlich');
    } else if (!/\S+@\S+\.\S+/.test(customer.email)) {
      errors.push('Ungültige E-Mail-Adresse');
    }

    if (customer.vatId && !/^[A-Z]{2}[A-Z0-9]+$/.test(customer.vatId)) {
      errors.push('Ungültige USt-IdNr. Format');
    }

    return errors;
  }

  /**
   * Prüft ob eine E-Mail bereits verwendet wird
   */
  static async isEmailTaken(
    companyId: string,
    email: string,
    excludeCustomerId?: string,
  ): Promise<boolean> {
    try {
      const customers = await CustomerService.getCustomers(companyId);
      return customers.some(
        customer =>
          customer.email.toLowerCase() === email.toLowerCase() && customer.id !== excludeCustomerId,
      );
    } catch {
      return false;
    }
  }

  /**
   * Exportiert Kunden als CSV
   */
  static async exportCustomersCSV(companyId: string): Promise<string> {
    try {
      const customers = await CustomerService.getCustomers(companyId);

      const headers = [
        'Kundennummer',
        'Name',
        'E-Mail',
        'Telefon',
        'Adresse',
        'Strasse',
        'Stadt',
        'PLZ',
        'Land',
        'Steuernummer',
        'USt-IdNr',
        'Anzahl Rechnungen',
        'Gesamtumsatz',
        'Erstellt am',
      ];

      const csvRows = [
        headers.join(','),
        ...customers.map(customer =>
          [
            customer.customerNumber,
            `"${customer.name}"`,
            customer.email,
            customer.phone || '',
            `"${customer.address}"`,
            `"${customer.street || ''}"`,
            `"${customer.city || ''}"`,
            customer.postalCode || '',
            customer.country || '',
            customer.taxNumber || '',
            customer.vatId || '',
            customer.totalInvoices?.toString() || '0',
            customer.totalAmount?.toFixed(2) || '0.00',
            new Date(String(customer.createdAt)).toLocaleDateString('de-DE'),
          ].join(','),
        ),
      ];

      return csvRows.join('\n');
    } catch (error) {
      console.error('Fehler beim Exportieren der Kunden:', error);
      throw error;
    }
  }

  /**
   * Synchronisiert den Kunden-Nummernkreis mit den existierenden Kundennummern
   */
  static async syncCustomerNumberSequence(companyId: string): Promise<void> {
    try {
      await api.post(`/api/v1/number-sequences/${companyId}/sync`, { type: 'Kunde' });
    } catch (error) {
      console.error('❌ Fehler beim Synchronisieren des Kunden-Nummernkreises:', error);
      throw error;
    }
  }

  /**
   */
  static subscribeToCustomers(
    companyId: string,
    callback: (customers: Customer[]) => void,
  ): () => void {
    console.warn(
      'Realtime subscriptions noch nicht implementiert - verwende Polling oder Supabase Realtime',
    );

    // Fallback: Polling alle 5 Sekunden
    const interval = setInterval(async () => {
      try {
        const customers = await CustomerService.getCustomers(companyId);
        callback(customers);
      } catch (error) {
        console.error('Fehler beim Polling:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }
}

export default CustomerService;
