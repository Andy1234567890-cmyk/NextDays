'use client';

import { useEffect, useState } from 'react';
import { InvoiceService } from '@/services/firestoreInvoiceService';

/**
 * Hook zum Laden der nächsten Rechnungsnummer für Platzhalter-Anzeige
 */
// `belegart`: 'quote' liest den Angebots-Kreis (AN-), sonst den Rechnungs-Kreis.
export function useNextInvoiceNumber(companyId: string | null, belegart: 'invoice' | 'quote' = 'invoice') {
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
        const result = await InvoiceService.getNextInvoiceNumber(companyId, belegart);
        const previewNumber = result.formattedNumber;

        setNextNumber(previewNumber);
      } catch (err) {
        console.error('❌ Error loading next invoice number:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Nummer');

        // Fallback für Platzhalter
        setNextNumber(belegart === 'quote' ? 'AN-XXXX' : 'RE-XXXX');
      } finally {
        setIsLoading(false);
      }
    };

    loadNextNumber();
  }, [companyId, belegart]);

  return {
    nextNumber,
    isLoading,
    error,
    // Refresh-Funktion für manuelle Aktualisierung
    refresh: () => {
      if (companyId) {
        const loadNextNumber = async () => {
          try {
            const result = await InvoiceService.getNextInvoiceNumber(companyId, belegart);
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
