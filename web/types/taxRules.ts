export enum TaxRuleCategory {
  DOMESTIC = 'DOMESTIC', // Deutschland
  EU_REVERSE = 'EU_REVERSE', // EU Reverse Charge
  EU_DELIVERY = 'EU_DELIVERY', // Innergemeinschaftliche Lieferung
  NON_EU = 'NON_EU', // Außerhalb EU
  TAX_FREE = 'TAX_FREE', // Steuerbefreit
}

export enum TaxRuleType {
  DE_TAXABLE = 'DE_TAXABLE', // Umsatzsteuerpflichtige Umsätze (19%)
  DE_TAXABLE_REDUCED = 'DE_TAXABLE_REDUCED', // Ermäßigter Steuersatz (7%)
  DE_EXEMPT_4_USTG = 'DE_EXEMPT_4_USTG', // Steuerfreie Umsätze §4 UStG
  DE_REVERSE_13B = 'DE_REVERSE_13B', // Reverse Charge gem. §13b UStG
  EU_REVERSE_18B = 'EU_REVERSE_18B', // Reverse Charge gem. §18b UStG
  EU_INTRACOMMUNITY_SUPPLY = 'EU_INTRACOMMUNITY_SUPPLY', // Innergemeinschaftliche Lieferungen
  EU_OSS = 'EU_OSS', // OSS – One-Stop-Shop
  NON_EU_EXPORT = 'NON_EU_EXPORT', // Ausfuhren
  NON_EU_OUT_OF_SCOPE = 'NON_EU_OUT_OF_SCOPE', // Nicht im Inland steuerbare Leistung
}

export interface TaxRule {
  id: TaxRuleType; // Verwenden des Enums statt string
  name: string; // Anzeigename
  category: TaxRuleCategory; // Hauptkategorie für Gruppierung
  taxRate: number; // Standard-Steuersatz
  invoiceText: string; // Text der auf der Rechnung erscheint
  legalBasis: string; // Rechtliche Grundlage
  description: string; // Beschreibung für UI
  validCountries: string[]; // Gültige Länder
  requirements?: string[]; // Besondere Anforderungen
}

// Typ für die Rechnungs-Steuerberechnung
export interface TaxCalculation {
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  grossAmount: number;
  isReverseCharge: boolean;
  invoiceText: string;
}
