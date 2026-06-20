import { api } from '@/lib/api-client';

// Type für Timestamps
type FieldValue = string | Date;

// Interface für Transaction Link (Client-Side)
export interface TransactionLink {
  id?: string;
  transactionId: string;
  documentId: string;
  documentType: 'beleg' | 'rechnung' | 'gutschrift' | 'INVOICE' | 'EXPENSE';
  documentNumber: string;
  documentDate: string;
  documentAmount: number;
  customerName: string;
  linkDate: Date | string | FieldValue;
  createdBy: string;
  // Buchungsstatus
  bookingStatus: 'open' | 'booked';
  bookedAt?: Date | string | FieldValue;
  // Differenz-Informationen
  amountDifference?: number;
  amountDifferenceReason?: string;
  // Buchungskonto-Informationen
  bookingAccount?: {
    id: string;
    number: string;
    name: string;
    type: 'INCOME' | 'EXPENSE';
  };
  // Bidirektionale Referenzen
  transactionData: {
    id: string;
    name: string;
    verwendungszweck: string;
    buchungstag: string;
    betrag: number;
    accountId: string;
  };
  documentData: {
    id: string;
    type: string;
    number: string;
    customerName: string;
    total: number;
    date: string;
  };
}

export class TransactionLinkService {
  /**
   * Erstelle eine neue Transaction-Document Verknüpfung
   */
  static async createLink(
    companyId: string,
    transactionId: string,
    documentId: string,
    transactionData: any,
    documentData: any,
    userId: string,
    linkData?: any,
  ): Promise<{ success: boolean; linkId?: string; error?: string }> {
    try {
      if (!companyId || !transactionId || !documentId) {
        throw new Error('Company ID, Transaction ID und Document ID sind erforderlich');
      }

      // Eindeutige Link ID für bidirektionale Suche
      const linkId = `${transactionId}_${documentId}`;

      // STRIKTE DOCUMENT-TYPE VALIDIERUNG - BLOCKIERE FALSCHE ZUORDNUNGEN
      const documentNumber =
        documentData.documentNumber || documentData.invoiceNumber || documentId;
      const isInvoice = documentNumber.startsWith('RE-');
      const isExpense = documentNumber.startsWith('BE-');
      const isStorno = documentData.isStorno === true;
      const isPositiveTransaction = (transactionData.betrag || transactionData.amount || 0) > 0;

      // BLOCKIERE falsche Zuordnungen
      if (isInvoice && !isStorno && !isPositiveTransaction) {
        throw new Error(
          '❌ EINNAHMEN-RECHNUNGEN können nur mit EINGÄNGEN (positive Beträge) verknüpft werden!',
        );
      }

      if (isExpense && isPositiveTransaction) {
        throw new Error(
          '❌ AUSGABEN-BELEGE können nur mit AUSGÄNGEN (negative Beträge) verknüpft werden!',
        );
      }

      // Bestimme den Dokumenttyp basierend auf der Dokumentnummer
      let documentType: 'beleg' | 'rechnung' | 'gutschrift';

      if (documentData.isStorno) {
        documentType = 'gutschrift';
      } else if (documentNumber.startsWith('BE-')) {
        documentType = 'beleg';
      } else {
        documentType = 'rechnung';
      }

      const transactionLink = {
        transactionId,
        documentId,
        documentType,
        documentNumber,
        documentDate: documentData.date || documentData.issueDate || new Date().toISOString(),
        documentAmount: documentData.total || 0,
        customerName: documentData.customerName || 'Unbekannter Kunde',
        linkDate: new Date().toISOString(),
        createdBy: userId,
        // Buchungsstatus - automatisch auf "gebucht" setzen bei Verknüpfung
        bookingStatus: 'booked',
        bookedAt: new Date().toISOString(),
        // Differenz-Informationen speichern (nur wenn vorhanden)
        ...(documentData.amountDifference !== undefined && documentData.amountDifference !== null
          ? { amountDifference: documentData.amountDifference }
          : {}),
        ...(documentData.amountDifferenceReason
          ? { amountDifferenceReason: documentData.amountDifferenceReason }
          : {}),
        // Buchungskonto-Informationen von linkData hinzufügen
        ...(linkData?.bookingAccount ? { bookingAccount: linkData.bookingAccount } : {}),
        transactionData: {
          id: transactionData.id,
          name: transactionData.name || transactionData.counterpartName || '',
          verwendungszweck: transactionData.verwendungszweck || transactionData.purpose || '',
          buchungstag: transactionData.buchungstag || transactionData.bookingDate || '',
          betrag: transactionData.betrag || transactionData.amount || 0,
          accountId: transactionData.accountId || '',
        },
        documentData: {
          id: documentData.id,
          type: documentData.isStorno ? 'gutschrift' : 'rechnung',
          number: documentData.documentNumber || documentData.invoiceNumber || documentId,
          customerName: documentData.customerName || 'Unbekannter Kunde',
          total: documentData.total || 0,
          date: documentData.date || documentData.issueDate || new Date().toISOString(),
        },
      };

      // API Call zum Backend
      await api.post(`/api/v1/companies/${companyId}/transaction-links`, transactionLink);

      return {
        success: true,
        linkId,
      };
    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Transaction Link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      };
    }
  }

  /**
   * Hole alle Transaction Links für ein Unternehmen
   */
  static async getLinks(
    companyId: string,
    transactionId?: string,
    documentId?: string,
  ): Promise<{ success: boolean; links?: TransactionLink[]; error?: string }> {
    try {
      if (!companyId) {
        throw new Error('Company ID ist erforderlich');
      }

      // Build query params
      const params = new URLSearchParams();
      if (transactionId) params.append('transactionId', transactionId);
      if (documentId) params.append('documentId', documentId);

      const queryString = params.toString() ? `?${params.toString()}` : '';

      // API Call zum Backend
      const links = await api.get<TransactionLink[]>(
        `/api/v1/companies/${companyId}/transaction-links${queryString}`,
      );

      return {
        success: true,
        links,
      };
    } catch (error) {
      console.error('❌ Fehler beim Laden der Transaction Links:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      };
    }
  }

  /**
   * Prüfe ob Transaction bereits verknüpft ist
   */
  static async isTransactionLinked(
    companyId: string,
    transactionId: string,
  ): Promise<{ isLinked: boolean; links?: TransactionLink[] }> {
    try {
      const result = await TransactionLinkService.getLinks(companyId, transactionId);

      if (result.success && result.links) {
        return {
          isLinked: result.links.length > 0,
          links: result.links,
        };
      }

      return { isLinked: false };
    } catch (error) {
      console.error('❌ Fehler beim Prüfen der Transaction Link:', error);
      return { isLinked: false };
    }
  }

  /**
   * Entferne Transaction Link
   */
  static async removeLink(
    companyId: string,
    transactionId: string,
    documentId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!companyId || !transactionId || !documentId) {
        throw new Error('Company ID, Transaction ID und Document ID sind erforderlich');
      }

      const linkId = `${transactionId}_${documentId}`;

      // API Call zum Backend
      await api.delete(`/api/v1/companies/${companyId}/transaction-links/${linkId}`);

      return { success: true };
    } catch (error) {
      console.error('❌ Fehler beim Entfernen der Transaction Link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      };
    }
  }

  /**
   * Hole alle Dokumente die mit einer Transaction verknüpft sind
   */
  static async getLinkedDocuments(
    companyId: string,
    transactionId: string,
  ): Promise<{ success: boolean; documents?: any[]; error?: string }> {
    try {
      const result = await TransactionLinkService.getLinks(companyId, transactionId);

      if (result.success && result.links) {
        const documents = result.links.map(link => ({
          id: link.documentId,
          type: link.documentType,
          number: link.documentNumber,
          customerName: link.customerName,
          amount: link.documentAmount,
          date: link.documentDate,
          linkDate: link.linkDate,
        }));

        return {
          success: true,
          documents,
        };
      }

      return {
        success: false,
        error: 'Keine verknüpften Dokumente gefunden',
      };
    } catch (error) {
      console.error('❌ Fehler beim Laden der verknüpften Dokumente:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      };
    }
  }

  /**
   * Hole alle Transaktionen die mit einem Dokument verknüpft sind
   */
  static async getLinkedTransactions(
    companyId: string,
    documentId: string,
  ): Promise<{ success: boolean; transactions?: any[]; error?: string }> {
    try {
      const result = await TransactionLinkService.getLinks(companyId, undefined, documentId);

      if (result.success && result.links) {
        const transactions = result.links.map(link => ({
          id: link.transactionId,
          name: link.transactionData.name,
          verwendungszweck: link.transactionData.verwendungszweck,
          buchungstag: link.transactionData.buchungstag,
          betrag: link.transactionData.betrag,
          accountId: link.transactionData.accountId,
          linkDate: link.linkDate,
          bookingStatus: link.bookingStatus || 'booked',
        }));

        return {
          success: true,
          transactions,
        };
      }

      return {
        success: false,
        error: 'Keine verknüpften Transaktionen gefunden',
      };
    } catch (error) {
      console.error('❌ Fehler beim Laden der verknüpften Transaktionen:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      };
    }
  }

  /**
   * Aktualisiere Buchungsstatus einer Transaction Link
   */
  static async updateBookingStatus(
    companyId: string,
    transactionId: string,
    documentId: string,
    bookingStatus: 'open' | 'booked',
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!companyId || !transactionId || !documentId) {
        throw new Error('Company ID, Transaction ID und Document ID sind erforderlich');
      }

      const linkId = `${transactionId}_${documentId}`;

      const updateData: any = {
        bookingStatus,
        updatedAt: new Date().toISOString(),
      };

      if (bookingStatus === 'booked') {
        updateData.bookedAt = new Date().toISOString();
      }

      // API Call zum Backend
      await api.patch(
        `/api/v1/companies/${companyId}/transaction-links/${linkId}/booking-status`,
        updateData,
      );

      return { success: true };
    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren des Buchungsstatus:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      };
    }
  }
}
