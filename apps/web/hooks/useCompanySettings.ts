'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

export interface CompanySettings {
  // Firmendaten
  companyName: string;
  companyAddress?: string;
  companyCountry?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyWebsite?: string;
  companyLogo?: string; // URL zum Firmenlogo

  // Steuerliche Einstellungen
  taxNumber?: string;
  vatId?: string;
  companyRegister?: string;
  districtCourt?: string;

  // Buchhaltungseinstellungen
  ust?: 'standard' | 'kleinunternehmer'; // Umsatzsteuer-Status
  profitMethod?: 'euer' | 'guv'; // Gewinnermittlung
  taxMethod?: 'soll' | 'ist'; // Versteuerungsart
  defaultTaxRate?: '0' | '7' | '19'; // Standard-Steuersatz
  priceInput?: 'netto' | 'brutto'; // Preiseingabe
  accountingSystem?: 'skro3' | 'skro4'; // Kontenrahmen
  lastInvoiceNumber?: string; // Letzte Rechnungsnummer aus altem System (für Migration)

  // Banking
  iban?: string;
  bic?: string;
  bankName?: string;
  accountHolder?: string;
  defaultCurrency?: string;

  // Zahlungskonditionen
  defaultPaymentTerms?: {
    days: number; // Standard-Zahlungsziel in Tagen
    text: string; // Text für Rechnung (z.B. "Zahlbar binnen 14 Tagen ohne Abzug")
    skontoEnabled?: boolean; // Skonto aktiviert
    skontoDays?: number; // Skonto-Frist in Tagen
    skontoPercentage?: number; // Skonto-Prozentsatz
  };

  // Mahngebühren-Einstellungen
  reminderFees?: {
    level1: {
      fee: number; // Mahngebühr für 1. Mahnung
      days: number; // Zahlungsfrist in Tagen
      title: string; // Titel der Mahnung
    };
    level2: {
      fee: number; // Mahngebühr für 2. Mahnung
      days: number; // Zahlungsfrist in Tagen
      title: string; // Titel der Mahnung
    };
    level3: {
      fee: number; // Mahngebühr für 3. Mahnung
      days: number; // Zahlungsfrist in Tagen
      title: string; // Titel der Mahnung
    };
  };

  // Rechtliche Angaben
  legalForm?: string;
}

export function useCompanySettings(userId?: string) {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCompanySettings = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Für Firmen: Erst companies endpoint prüfen
        let userData: any = null;

        try {
          userData = await api.get(`/api/v1/companies/${userId}`);
        } catch {
          // Fallback: users endpoint
          try {
            userData = await api.get(`/api/v1/users/${userId}`);
          } catch {
            userData = null;
          }
        }

        if (userData) {
          const companySettings: CompanySettings = {
            // Firmendaten
            companyName: userData.companyName || userData.step2?.companyName || '',
            companyAddress:
              userData.address ||
              [
                userData.companyStreet && userData.companyHouseNumber
                  ? `${userData.companyStreet} ${userData.companyHouseNumber}`
                  : userData.companyStreet,
                userData.companyPostalCode && userData.companyCity
                  ? `${userData.companyPostalCode} ${userData.companyCity}`
                  : undefined,
                userData.companyCountry || userData.step2?.country,
              ]
                .filter(Boolean)
                .join('\n') ||
              undefined,
            companyCountry: userData.companyCountry || userData.step2?.country,
            companyEmail: userData.email || userData.step2?.email,
            companyPhone: userData.companyPhoneNumber || userData.step2?.companyPhoneNumber,
            companyWebsite: userData.companyWebsite || userData.step2?.website,
            companyLogo:
              userData.profilePictureURL ||
              userData.companyLogo ||
              userData.step2?.logo ||
              userData.logoUrl,

            // Steuerliche Einstellungen
            taxNumber: userData.taxNumber || userData.step3?.taxNumber,
            vatId: userData.vatId || userData.step3?.vatId,
            companyRegister: userData.companyRegister || userData.step3?.companyRegister,
            districtCourt: userData.districtCourt || userData.step3?.districtCourt,

            // Buchhaltungseinstellungen
            ust: userData.step3?.ust || 'standard',
            profitMethod: userData.step3?.profitMethod || 'euer',
            taxMethod: userData.step3?.taxMethod || 'soll',
            defaultTaxRate: userData.step3?.defaultTaxRate || '19',
            priceInput: userData.step3?.priceInput || 'netto',
            accountingSystem: userData.step3?.accountingSystem || 'skro4',

            // Banking
            iban: userData.iban || userData.step4?.iban,
            accountHolder: userData.accountHolder || userData.step4?.accountHolder,

            // Zahlungskonditionen - Priorität: settings.paymentTerms.defaultPaymentTerms > root defaultPaymentTerms > paymentTermsSettings > fallback
            defaultPaymentTerms: userData.settings?.paymentTerms?.defaultPaymentTerms ||
              userData.defaultPaymentTerms ||
              userData.paymentTermsSettings?.defaultPaymentTerms ||
              // Prüfe auch direkt in step5 für Migration
              (userData.step5?.paymentTerms
                ? {
                    days: userData.step5.paymentTerms.days || 14,
                    text:
                      userData.step5.paymentTerms.text ||
                      `Zahlbar binnen ${userData.step5.paymentTerms.days || 14} Tagen ohne Abzug`,
                    skontoEnabled: userData.step5.paymentTerms.skontoEnabled || false,
                    skontoDays: userData.step5.paymentTerms.skontoDays || 10,
                    skontoPercentage: userData.step5.paymentTerms.skontoPercentage || 2,
                  }
                : null) || {
                days: 14, // Standard: 14 Tage Zahlungsziel
                text: 'Zahlbar binnen 14 Tagen ohne Abzug',
                skontoEnabled: false,
                skontoDays: 10,
                skontoPercentage: 2,
              },

            // Mahngebühren-Einstellungen
            reminderFees: userData.reminderFees || {
              level1: { fee: 5.0, days: 7, title: '1. Mahnung' },
              level2: { fee: 10.0, days: 14, title: '2. Mahnung' },
              level3: { fee: 15.0, days: 21, title: '3. Mahnung / Inkasso-Androhung' },
            },

            // Rechtliche Angaben
            legalForm: userData.legalForm || userData.step2?.legalForm,
          };

          setSettings(companySettings);
        } else {
          setError('Unternehmensdaten nicht gefunden');
        }
      } catch {
        setError('Fehler beim Laden der Unternehmenseinstellungen');
      } finally {
        setLoading(false);
      }
    };

    loadCompanySettings();
  }, [userId]);

  return { settings, loading, error };
}

// Hilfsfunktion für VAT-Berechnung basierend auf Unternehmensstatus
export function calculateVAT(
  amount: number,
  settings: CompanySettings | null,
): {
  isSmallBusiness: boolean;
  vatRate: number;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
} {
  const isSmallBusiness = settings?.ust === 'kleinunternehmer';
  const vatRate = isSmallBusiness ? 0 : parseInt(settings?.defaultTaxRate || '19', 10);

  let netAmount: number;
  let vatAmount: number;
  let totalAmount: number;

  if (isSmallBusiness) {
    // Kleinunternehmer: keine MwSt
    netAmount = amount;
    vatAmount = 0;
    totalAmount = amount;
  } else if (settings?.priceInput === 'brutto') {
    // Brutto-Eingabe: MwSt ist bereits enthalten
    totalAmount = amount;
    netAmount = amount / (1 + vatRate / 100);
    vatAmount = amount - netAmount;
  } else {
    // Netto-Eingabe: MwSt muss hinzugerechnet werden
    netAmount = amount;
    vatAmount = amount * (vatRate / 100);
    totalAmount = amount + vatAmount;
  }

  return {
    isSmallBusiness,
    vatRate,
    netAmount: Math.round(netAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}
