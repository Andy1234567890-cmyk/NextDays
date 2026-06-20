'use client';

import { api } from '@/lib/api-client';

export interface BookingAccount {
  id: string;
  number: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE';
  automaticBooking: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BookingAccountData {
  number: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE';
  automaticBooking: boolean;
}

export class BookingAccountService {
  /**
   * Lädt alle Buchungskonten für eine Company
   * Backend kombiniert custom accounts mit DATEV-Standard-Konten
   */
  static async getBookingAccounts(companyUid: string): Promise<BookingAccount[]> {
    try {
      return await api.get<BookingAccount[]>(`/api/v1/booking-accounts/${companyUid}`);
    } catch (error) {
      console.error('Fehler beim Laden der Buchungskonten:', error);
      throw error;
    }
  }

  /**
   * Erstellt ein neues Buchungskonto
   */
  static async createBookingAccount(
    companyUid: string,
    accountData: BookingAccountData,
  ): Promise<BookingAccount> {
    try {
      return await api.post<BookingAccount>(`/api/v1/booking-accounts/${companyUid}`, accountData);
    } catch (error) {
      console.error('Fehler beim Erstellen des Buchungskontos:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert ein existierendes Buchungskonto
   */
  static async updateBookingAccount(
    companyUid: string,
    accountId: string,
    updates: Partial<BookingAccountData>,
  ): Promise<void> {
    try {
      await api.patch(`/api/v1/booking-accounts/${companyUid}/${accountId}`, updates);
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Buchungskontos:', error);
      throw error;
    }
  }

  /**
   * Löscht ein Buchungskonto
   */
  static async deleteBookingAccount(companyUid: string, accountId: string): Promise<void> {
    try {
      await api.delete(`/api/v1/booking-accounts/${companyUid}/${accountId}`);
    } catch (error) {
      console.error('Fehler beim Löschen des Buchungskontos:', error);
      throw error;
    }
  }

  /**
   * Erstellt Standard-Buchungskonten für eine neue Company
   */
  static async createDefaultBookingAccounts(companyUid: string): Promise<BookingAccount[]> {
    const defaultAccounts: BookingAccountData[] = [];

    try {
      const createdAccounts: BookingAccount[] = [];

      for (const accountData of defaultAccounts) {
        const account = await BookingAccountService.createBookingAccount(companyUid, accountData);
        createdAccounts.push(account);
      }

      return createdAccounts;
    } catch (error) {
      console.error('Fehler beim Erstellen der Standard-Buchungskonten:', error);
      throw error;
    }
  }

  /**
   * Prüft ob ein Buchungskonto mit der Nummer bereits existiert
   */
  static async accountNumberExists(
    companyUid: string,
    accountNumber: string,
    excludeId?: string,
  ): Promise<boolean> {
    try {
      const accounts = await BookingAccountService.getBookingAccounts(companyUid);
      return accounts.some(account => account.number === accountNumber && account.id !== excludeId);
    } catch (error) {
      console.error('Fehler beim Prüfen der Kontonummer:', error);
      return false;
    }
  }

  /**
   * Löscht alle Buchungskonten einer Company (für Cleanup/Reset)
   */
  static async deleteAllBookingAccounts(companyUid: string): Promise<void> {
    try {
      const accounts = await BookingAccountService.getBookingAccounts(companyUid);
      const deletePromises = accounts.map(account =>
        BookingAccountService.deleteBookingAccount(companyUid, account.id),
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Fehler beim Löschen aller Buchungskonten:', error);
      throw error;
    }
  }
}
