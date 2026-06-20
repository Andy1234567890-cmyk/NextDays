// Platzhalter-Aliase für Kompatibilität und Standardisierung
import type { PlaceholderRegistry } from './types';

/**
 * Zentrale Definition von Aliasen für Platzhalter-Namen
 * Dies gewährleistet Konsistenz zwischen verschiedenen Dokumenttypen
 */

/**
 * Alias-Mapping für verschiedene Schreibweisen
 * Ermöglicht mehrere Namen für denselben Platzhalter
 */
export const PLACEHOLDER_ALIASES: { [alias: string]: string } = {
  // Umsatzsteuer-ID Aliase (häufigste Inkonsistenz)
  VAT_ID: 'UMSATZSTEUER_ID',
  VATID: 'UMSATZSTEUER_ID',
  UMSATZSTEUERID: 'UMSATZSTEUER_ID',
  UST_ID: 'UMSATZSTEUER_ID',
  USTID: 'UMSATZSTEUER_ID',
  TAX_ID: 'UMSATZSTEUER_ID',
  TAXID: 'UMSATZSTEUER_ID',

  // Steuernummer Aliase
  TAX_NUMBER: 'STEUERNUMMER',
  TAXNUMBER: 'STEUERNUMMER',
  STEUER_NUMMER: 'STEUERNUMMER',
  STEUER_NR: 'STEUERNUMMER',
  STEUERNR: 'STEUERNUMMER',

  // Bankdaten Aliase
  IBAN: 'FIRMENIBAN',
  BIC: 'FIRMENBIC',
  SWIFT: 'FIRMENBIC',
  BANKNAME: 'FIRMENBANK',
  BANK_NAME: 'FIRMENBANK',
  BANK: 'FIRMENBANK',
  KONTOINHABER: 'FIRMENKONTOINHABER',
  ACCOUNT_HOLDER: 'FIRMENKONTOINHABER',

  // Kundendaten Aliase
  CUSTOMER_NAME: 'KUNDENNAME',
  CUSTOMERNAME: 'KUNDENNAME',
  KUNDE_NAME: 'KUNDENNAME',
  CUSTOMER_NUMBER: 'KUNDENNUMMER',
  CUSTOMERNUMBER: 'KUNDENNUMMER',
  KUNDE_NUMMER: 'KUNDENNUMMER',
  CUSTOMER_PHONE: 'KUNDENTELEFON',
  CUSTOMERPHONE: 'KUNDENTELEFON',
  KUNDE_TELEFON: 'KUNDENTELEFON',
  CUSTOMER_EMAIL: 'KUNDENEMAIL',
  CUSTOMEREMAIL: 'KUNDENEMAIL',
  KUNDE_EMAIL: 'KUNDENEMAIL',

  // Firmendaten Aliase
  COMPANY_NAME: 'FIRMENNAME',
  COMPANYNAME: 'FIRMENNAME',
  FIRMA_NAME: 'FIRMENNAME',
  COMPANY_ADDRESS: 'FIRMENADRESSE',
  COMPANYADDRESS: 'FIRMENADRESSE',
  FIRMA_ADRESSE: 'FIRMENADRESSE',
  COMPANY_PHONE: 'FIRMENTELEFON',
  COMPANYPHONE: 'FIRMENTELEFON',
  FIRMA_TELEFON: 'FIRMENTELEFON',
  COMPANY_EMAIL: 'FIRMENEMAIL',
  COMPANYEMAIL: 'FIRMENEMAIL',
  FIRMA_EMAIL: 'FIRMENEMAIL',

  // Rechnungsbeträge Aliase
  NETTO: 'NETTOBETRAG',
  NETTO_BETRAG: 'NETTOBETRAG',
  NET_AMOUNT: 'NETTOBETRAG',
  NETAMOUNT: 'NETTOBETRAG',
  BRUTTO: 'BRUTTOBETRAG',
  BRUTTO_BETRAG: 'BRUTTOBETRAG',
  GROSS_AMOUNT: 'BRUTTOBETRAG',
  GROSSAMOUNT: 'BRUTTOBETRAG',
  STEUER: 'STEUERBETRAG',
  STEUER_BETRAG: 'STEUERBETRAG',
  TAX_AMOUNT: 'STEUERBETRAG',
  TAXAMOUNT: 'STEUERBETRAG',
  VAT_AMOUNT: 'STEUERBETRAG',
  VATAMOUNT: 'STEUERBETRAG',

  // Datum Aliase
  DATUM: 'DATUM_HEUTE',
  TODAY: 'DATUM_HEUTE',
  HEUTE: 'DATUM_HEUTE',
  CURRENT_DATE: 'DATUM_HEUTE',
  CURRENTDATE: 'DATUM_HEUTE',
};

/**
 * Hilfsfunktion um Platzhalter-Namen zu normalisieren
 * Konvertiert Aliase zu Standard-Namen
 */
export function normalizePlaceholderName(name: string): string {
  const upperName = name.trim().toUpperCase();
  return PLACEHOLDER_ALIASES[upperName] || upperName;
}

/**
 * Erstellt eine Registry mit allen Aliasen
 * Kann in der Engine verwendet werden um automatische Aliase zu unterstützen
 */
export function createAliasRegistry(baseRegistry: PlaceholderRegistry): PlaceholderRegistry {
  const aliasRegistry: PlaceholderRegistry = { ...baseRegistry };

  // Füge alle Aliase hinzu
  Object.entries(PLACEHOLDER_ALIASES).forEach(([alias, standardName]) => {
    if (baseRegistry[standardName]) {
      aliasRegistry[alias] = baseRegistry[standardName];
    }
  });

  return aliasRegistry;
}

/**
 * Validiert Platzhalter-Namen und gibt Warnungen für veraltete Namen
 */
export function validatePlaceholderName(name: string): {
  isValid: boolean;
  standardName: string;
  isDeprecated: boolean;
  suggestion?: string;
} {
  const upperName = name.trim().toUpperCase();
  const standardName = normalizePlaceholderName(upperName);
  const isAlias = PLACEHOLDER_ALIASES[upperName] !== undefined;

  return {
    isValid: true, // Alle Namen sind erstmal gültig
    standardName,
    isDeprecated: isAlias,
    suggestion: isAlias ? `Verwende besser: [%${standardName}%]` : undefined,
  };
}

export default {
  PLACEHOLDER_ALIASES,
  normalizePlaceholderName,
  createAliasRegistry,
  validatePlaceholderName,
};
