'use client';

import { useEffect, useState } from 'react';
import { InvoiceService } from '@/services/firestoreInvoiceService';

/**
 * Hook zum Laden der nächsten Rechnungsnummer für Platzhalter-Anzeige
 */
export function useNextInvoiceNumber(companyId: string | null) {
  const [nextNumber, setNextNumber] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setNextNumber('');
      return;
    }

    const loadNextNumber = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await InvoiceService.getNextInvoiceNumber(companyId);
        const previewNumber = result.formattedNumber;

        setNextNumber(previewNumber);
      } catch (err) {
        console.error('❌ Error loading next invoice number:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Nummer');

        // Fallback für Platzhalter
        setNextNumber('RE-XXXX');
      } finally {
        setIsLoading(false);
      }
    };

    loadNextNumber();
  }, [companyId]);

  return {
    nextNumber,
    isLoading,
    error,
    // Refresh-Funktion für manuelle Aktualisierung
    refresh: () => {
      if (companyId) {
        const loadNextNumber = async () => {
          try {
            const result = await InvoiceService.getNextInvoiceNumber(companyId);
            setNextNumber(result.formattedNumber);
          } catch (err) {
            console.error('❌ Error refreshing next invoice number:', err);
          }
        };
        loadNextNumber();
      }
    },
  };
}
